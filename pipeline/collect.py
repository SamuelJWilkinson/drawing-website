#!/usr/bin/env python3
# ==========================================
# COLLECT DRAWINGS
# Runs in GitHub Actions, never on a laptop. For each candidate from a source:
# download it once, run the pixel checks, and if it passes, rotate it 180° in the
# file itself and save it as WebP. The upright picture is never written to disk
# and nothing here displays an image.
#
# Writes (under --out, default tools/upside-down):
#   img/<id>.webp   the rotated drawings
#   manifest.json   what the tool loads: id, file, size
#   reveal.json     tags and credits, which the tool only loads at Reveal
# and a report under pipeline/reports/ with the reason for every rejection.
# ==========================================
import argparse
import csv
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

import quality
from sources import Blocked
from sources.pixabay import Pixabay

REPORT_DIR = Path(__file__).parent / 'reports'
MAX_FAILED_IN_A_ROW = 5  # stop (don't hammer a source) if this many downloads in a row fail


def load_json(path, default):
    return json.loads(path.read_text()) if path.exists() else default


def save_rotated(rgb, path):
    """Save the picture rotated 180°, then check the saved file by code. Returns its size in bytes."""
    grey = rgb.convert('L')
    grey.transpose(Image.ROTATE_180).save(path, 'WEBP', lossless=True, quality=100, method=6)
    saved = Image.open(path)
    assert saved.format == 'WEBP' and saved.size == grey.size, 'saved file has the wrong type or size'
    turned_back = saved.convert('L').transpose(Image.ROTATE_180)
    assert np.array_equal(np.asarray(turned_back), np.asarray(grey)), 'saved file is not an exact 180° rotation'
    return path.stat().st_size


def check_everything(out, manifest):
    """Final check over every drawing in the manifest: file exists, is WebP, has the recorded size."""
    problems = []
    for drawing in manifest['drawings']:
        path = out / drawing['file']
        if not path.exists():
            problems.append(f"missing file {drawing['file']}")
            continue
        image = Image.open(path)
        if image.format != 'WEBP' or list(image.size) != [drawing['width'], drawing['height']]:
            problems.append(f"{drawing['file']}: wrong type or size")
    on_disk = len(list((out / 'img').glob('*.webp')))
    if on_disk != len(manifest['drawings']):
        problems.append(f"{on_disk} files on disk but {len(manifest['drawings'])} in the manifest")
    return problems


def spread(values):
    if not values:
        return 'n/a'
    low, middle, high = np.percentile(values, [0, 50, 100])
    return f'{low:g} / {middle:g} / {high:g}'


def write_report(label, rows, kept_bytes, stats):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    metric_names = list(quality.measure(Image.new('RGB', (64, 64), 'white')))
    with open(REPORT_DIR / f'{label}.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'decision', 'reasons', *metric_names, 'file_bytes'])
        writer.writeheader()
        writer.writerows(rows)

    analysed = [r for r in rows if r['decision'] != 'unreadable']
    kept = [r for r in rows if r['decision'] == 'kept']
    every_reason = Counter(reason for r in rows for reason in r['reasons'].split(';') if reason)
    first_reason = Counter(r['reasons'].split(';')[0] for r in rows if r['decision'] == 'rejected')
    lines = [
        f'# Collection report: {label}', '',
        f"- Search requests and downloads made: {stats['requests']}",
        f"- Candidates downloaded and checked: {len(rows)}",
        f"- Kept: **{len(kept)}** ({100 * len(kept) / max(1, len(rows)):.0f}%)",
        f"- Stopped because: {stats['stopped']}",
        f"- Size of kept files: {kept_bytes / 1024:.0f} KB total"
        + (f", {kept_bytes / len(kept) / 1024:.0f} KB average, so about {300 * kept_bytes / len(kept) / 1048576:.0f} MB for 300 drawings" if kept else ''),
        '', '## Why images were rejected', '',
        '| Reason | Images with this reason | Images where it was the first reason |', '|---|---|---|',
    ]
    lines += [f'| {reason} | {count} | {first_reason.get(reason, 0)} |' for reason, count in every_reason.most_common()]
    lines += ['', '## Measurements (min / median / max)', '', '| Measure | All checked | Kept only |', '|---|---|---|']
    for name in ('colour_share', 'background_tint', 'background', 'flat_grey', 'dark_share', 'components', 'line_width', 'width_spread'):
        lines.append(f"| {name} | {spread([r[name] for r in analysed])} | {spread([r[name] for r in kept])} |")
    lines += ['', f'Current limits: `{json.dumps(quality.LIMITS)}`', '', 'Per-image numbers are in the CSV next to this report.']
    report = '\n'.join(lines) + '\n'
    (REPORT_DIR / f'{label}.md').write_text(report)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', type=int, default=50, help='stop after keeping this many drawings')
    parser.add_argument('--max-downloads', type=int, default=250, help='stop after downloading this many candidates')
    parser.add_argument('--out', default='tools/upside-down')
    parser.add_argument('--label', default=time.strftime('run-%Y%m%d-%H%M%S'))
    parser.add_argument('--search-only', action='store_true', help='count candidates for the first page of searches, download nothing')
    args = parser.parse_args()

    key = os.environ.get('PIXABAY_API_KEY')
    if not key:
        sys.exit('PIXABAY_API_KEY is not set')
    source = Pixabay(key)
    out = Path(args.out)
    (out / 'img').mkdir(parents=True, exist_ok=True)
    manifest = load_json(out / 'manifest.json', {'drawings': []})
    reveal = load_json(out / 'reveal.json', {})
    have = {d['id'] for d in manifest['drawings']}

    rows, kept_bytes, downloaded, failed_in_a_row = [], 0, 0, 0
    stopped = 'ran out of candidates'
    try:
        for candidate in source.candidates(exclude=have):
            if args.search_only:
                downloaded += 1
                if downloaded >= 500:  # enough to count; this stays within the first page of searches
                    stopped = 'counted 500 candidates'
                    break
                continue
            if len(rows) >= args.max_downloads:
                stopped = f'reached the download limit ({args.max_downloads})'
                break
            if sum(1 for r in rows if r['decision'] == 'kept') >= args.target:
                stopped = f'kept {args.target} drawings'
                break
            try:
                data = source.download(candidate)
                failed_in_a_row = 0
            except Blocked as error:
                failed_in_a_row += 1
                print(f'{candidate.id}: download failed ({error})')
                if failed_in_a_row >= MAX_FAILED_IN_A_ROW:
                    stopped = f'{MAX_FAILED_IN_A_ROW} downloads in a row failed ({error})'
                    break
                continue
            try:
                rgb = quality.load_on_white(data)
            except Exception as error:  # not a readable image
                rows.append({'id': candidate.id, 'decision': 'unreadable', 'reasons': type(error).__name__, 'file_bytes': 0})
                continue
            metrics = quality.measure(rgb)
            reasons = quality.decide(metrics)
            row = {'id': candidate.id, 'decision': 'rejected' if reasons else 'kept', 'reasons': ';'.join(reasons), **metrics, 'file_bytes': 0}
            if not reasons:
                size = save_rotated(rgb, out / 'img' / f'{candidate.id}.webp')
                row['file_bytes'] = size
                kept_bytes += size
                manifest['drawings'].append({
                    'id': candidate.id, 'file': f'img/{candidate.id}.webp', 'source': candidate.source,
                    'width': rgb.width, 'height': rgb.height,
                })
                reveal[candidate.id] = {'tags': candidate.tags, 'credit': candidate.credit, 'creditUrl': candidate.page_url}
            rows.append(row)
            print(f"{candidate.id}: {row['decision']} {row['reasons']}")
    except Blocked as error:
        stopped = f'the source refused us: {error}'

    if args.search_only:
        print(f'Search only: {downloaded} new candidates found, {source.requests_made} requests made, stopped because: {stopped}')
        return

    manifest['drawings'].sort(key=lambda d: d['id'])
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    (out / 'reveal.json').write_text(json.dumps(dict(sorted(reveal.items())), indent=1) + '\n')
    report = write_report(args.label, rows, kept_bytes, {'requests': source.requests_made, 'stopped': stopped})
    print('\n' + report)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        Path(os.environ['GITHUB_STEP_SUMMARY']).write_text(report)

    problems = check_everything(out, manifest)
    if problems:
        sys.exit('Final check failed:\n' + '\n'.join(problems))
    print(f"Final check passed: {len(manifest['drawings'])} files, all WebP with the recorded sizes.")


if __name__ == '__main__':
    main()
