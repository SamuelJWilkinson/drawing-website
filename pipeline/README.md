# Drawing collection pipeline

Collects line drawings for the Upside Down tool. It runs in GitHub Actions (`.github/workflows/collect-drawings.yml`), not on a laptop.

- `collect.py`: downloads candidates, runs the pixel checks, rotates passing images 180° and saves them as WebP, then writes a report to `reports/`.
- `quality.py`: the pixel checks and their limits (`LIMITS`). Tune these from the numbers in the reports.
- `sources/`: one file per image source (`pixabay.py`). A new source offers `candidates()` and `download()`.
- `selftest.py`: checks the pixel checks on drawings made in memory. Run `python pipeline/selftest.py`.

The Pixabay key is a repository secret named `PIXABAY_API_KEY`. Never put it in a file.
