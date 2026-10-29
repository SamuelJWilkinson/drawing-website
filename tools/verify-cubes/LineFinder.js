// ==========================================
// LINE FINDER
// Finds the straight pen lines in a photo of a drawing. Two steps:
// 1. findInk: which pixels are pen, not paper (compared with the paper right around them,
//    so shadows and uneven light don't matter).
// 2. findLines: repeatedly take the straightest line the ink supports, record it, rub out
//    the ink it explains, and look again. Lines that are really one wobbly stroke are joined.
// Works in the photo's own pixels. No libraries.
// ==========================================

const ANGLE_STEPS = 180;     // line directions tried: every 1 degree
const LINE_TOLERANCE = 4;    // px: ink this close to a line counts as part of it
const MAX_GAP = 10;          // px: a break in the ink longer than this ends a line
const MERGE_ANGLE = 8 * Math.PI / 180; // lines this close in direction may be one stroke
const MERGE_OFFSET = 8;      // px: ...if they are also this close side to side
const MERGE_GAP = 15;        // px: ...and end this close to each other

// ==========================================
// 1. INK
// Returns a mask: 1 where there is ink, 0 where there is paper
// ==========================================
export function findInk(imageData, sensitivity) {
    const { width, height, data } = imageData;
    const grey = new Float32Array(width * height);
    for (let i = 0; i < grey.length; i++) grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

    // Running totals, so the average of any square patch of paper is quick to get
    const stride = width + 1;
    const total = new Float64Array(stride * (height + 1));
    for (let y = 0; y < height; y++) {
        let row = 0;
        for (let x = 0; x < width; x++) {
            row += grey[y * width + x];
            total[(y + 1) * stride + x + 1] = total[y * stride + x + 1] + row;
        }
    }

    const reach = Math.max(8, Math.round(Math.max(width, height) / 40)); // size of the "paper right around" patch
    const ink = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        const y0 = Math.max(0, y - reach), y1 = Math.min(height, y + reach + 1);
        for (let x = 0; x < width; x++) {
            const x0 = Math.max(0, x - reach), x1 = Math.min(width, x + reach + 1);
            const sum = total[y1 * stride + x1] - total[y0 * stride + x1] - total[y1 * stride + x0] + total[y0 * stride + x0];
            const average = sum / ((x1 - x0) * (y1 - y0));
            if (grey[y * width + x] < average - sensitivity) ink[y * width + x] = 1;
        }
    }
    return ink;
}

// ==========================================
// 2. LINES
// Returns [{ x1, y1, x2, y2, length }], longest first
// ==========================================
export function findLines(ink, width, height, { minLength, maxLines }) {
    let xs = [], ys = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (ink[y * width + x]) { xs.push(x); ys.push(y); }

    const cos = [], sin = [];
    for (let a = 0; a < ANGLE_STEPS; a++) { cos.push(Math.cos(a * Math.PI / ANGLE_STEPS)); sin.push(Math.sin(a * Math.PI / ANGLE_STEPS)); }
    const diagonal = Math.ceil(Math.hypot(width, height));
    const rhoCount = 2 * diagonal + 1;

    const found = [];
    for (let attempt = 0; attempt < maxLines * 3 && found.length < maxLines * 2; attempt++) {
        // Every ink pixel votes for every line it could be on; the most-voted line wins
        const votes = new Int32Array(ANGLE_STEPS * rhoCount);
        for (let i = 0; i < xs.length; i++) {
            for (let a = 0; a < ANGLE_STEPS; a++) votes[a * rhoCount + Math.round(xs[i] * cos[a] + ys[i] * sin[a]) + diagonal]++;
        }
        let best = 0;
        for (let i = 1; i < votes.length; i++) if (votes[i] > votes[best]) best = i;
        if (votes[best] < minLength) break;
        const angle = Math.floor(best / rhoCount);
        const rho = (best % rhoCount) - diagonal;

        // Ink along that line, in order, split wherever there is a long break; keep the longest stretch
        const along = (x, y) => -x * sin[angle] + y * cos[angle];
        const near = [];
        for (let i = 0; i < xs.length; i++) {
            if (Math.abs(xs[i] * cos[angle] + ys[i] * sin[angle] - rho) <= LINE_TOLERANCE) near.push(i);
        }
        near.sort((p, q) => along(xs[p], ys[p]) - along(xs[q], ys[q]));
        let run = [], bestRun = [];
        near.forEach((i, k) => {
            if (k > 0 && along(xs[i], ys[i]) - along(xs[near[k - 1]], ys[near[k - 1]]) > MAX_GAP) run = [];
            run.push(i);
            if (run.length > bestRun.length) bestRun = run.slice();
        });

        const segment = fitSegment(bestRun.map(i => [xs[i], ys[i]]));
        // Rub out the ink this line explains (also when the stretch was too short, so the search moves on)
        const rubOut = new Set(bestRun);
        if (segment.length >= minLength) {
            const dx = (segment.x2 - segment.x1) / segment.length, dy = (segment.y2 - segment.y1) / segment.length;
            for (let i = 0; i < xs.length; i++) {
                const t = (xs[i] - segment.x1) * dx + (ys[i] - segment.y1) * dy;
                const side = Math.abs(-(xs[i] - segment.x1) * dy + (ys[i] - segment.y1) * dx);
                if (t > -LINE_TOLERANCE && t < segment.length + LINE_TOLERANCE && side <= LINE_TOLERANCE) rubOut.add(i);
            }
            found.push(segment);
        }
        const keep = [];
        for (let i = 0; i < xs.length; i++) if (!rubOut.has(i)) keep.push(i);
        xs = keep.map(i => xs[i]);
        ys = keep.map(i => ys[i]);
    }

    return joinBrokenLines(found)
        .filter(line => line.length >= minLength)
        .sort((a, b) => b.length - a.length)
        .slice(0, maxLines);
}

// The best straight line through a set of points, cut to where the points start and end
function fitSegment(points) {
    const n = points.length;
    const mx = points.reduce((s, p) => s + p[0], 0) / n;
    const my = points.reduce((s, p) => s + p[1], 0) / n;
    let sxx = 0, syy = 0, sxy = 0;
    points.forEach(([x, y]) => { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); });
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let low = Infinity, high = -Infinity;
    points.forEach(([x, y]) => {
        const t = (x - mx) * dx + (y - my) * dy;
        low = Math.min(low, t); high = Math.max(high, t);
    });
    return { x1: mx + dx * low, y1: my + dy * low, x2: mx + dx * high, y2: my + dy * high, length: high - low };
}

// ==========================================
// 3. JOINING
// A wobbly stroke comes out as several short lines pointing almost the same way, end to end.
// Join those into one.
// ==========================================
function joinBrokenLines(lines) {
    let list = lines.slice();
    let joined = true;
    while (joined) {
        joined = false;
        for (let i = 0; i < list.length && !joined; i++) {
            for (let j = i + 1; j < list.length && !joined; j++) {
                const merged = tryJoin(list[i], list[j]);
                if (merged) {
                    list = list.filter((_, k) => k !== i && k !== j);
                    list.push(merged);
                    joined = true;
                }
            }
        }
    }
    return list;
}

function tryJoin(a, b) {
    const angleOf = l => Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
    let turn = Math.abs(angleOf(a) - angleOf(b)) % Math.PI;
    if (Math.min(turn, Math.PI - turn) > MERGE_ANGLE) return null;

    // Measure everything along and across the longer line
    const base = a.length >= b.length ? a : b;
    const dx = (base.x2 - base.x1) / base.length, dy = (base.y2 - base.y1) / base.length;
    const along = (x, y) => (x - base.x1) * dx + (y - base.y1) * dy;
    const across = (x, y) => Math.abs(-(x - base.x1) * dy + (y - base.y1) * dx);
    const ends = [[a.x1, a.y1], [a.x2, a.y2], [b.x1, b.y1], [b.x2, b.y2]];
    if (ends.some(([x, y]) => across(x, y) > MERGE_OFFSET)) return null;

    const spanA = [along(a.x1, a.y1), along(a.x2, a.y2)].sort((p, q) => p - q);
    const spanB = [along(b.x1, b.y1), along(b.x2, b.y2)].sort((p, q) => p - q);
    const gap = Math.max(spanA[0], spanB[0]) - Math.min(spanA[1], spanB[1]);
    if (gap > MERGE_GAP) return null;

    const sorted = ends.slice().sort((p, q) => along(p[0], p[1]) - along(q[0], q[1]));
    const [first, last] = [sorted[0], sorted[3]];
    return { x1: first[0], y1: first[1], x2: last[0], y2: last[1], length: Math.hypot(last[0] - first[0], last[1] - first[1]) };
}
