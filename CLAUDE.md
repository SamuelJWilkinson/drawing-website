# Drawing practice tools

Small static site of interactive perspective tools (Three.js r128 from CDN, global `THREE`). The owner is learning to draw, not to code: favour simple, readable code and keep the project small. No build step, no npm, no frameworks, no new dependencies without asking.

## Layout
- `index.html` + `js-core/Library.js` + `tools.json`: home page; one card per `tools.json` entry.
- `css/shared-layout.css`: all styling (home page, tool page layout, sidebar parts).
- `js-core/PerspectiveEngine.js`: shared `scene`, 3 cameras/renderers (Drawing view, Top plan, Meta 3D), mounted into `#perspective-container`, `#top-container`, `#meta-container`.
- `js-core/Apparatus.js`: station point, line of sight, picture plane, horizon line, 60°/90° cones. Wires `#horizon-toggle`, `#cov-60-toggle`, `#cov-90-toggle`, `#pp-slider`, `#sp-slider` when present. Exports `moveStationPoint(z)` and `onCameraMoved(cb)`.
- `js-core/Cube.js`: `createFaceColouredCube`, `createVanishingLines` (`addCube`, `update`, `group`), `setWireframe`, `wireCubeToggles`.
- `js-core/RenderLoop.js`: `startRenderLoop(vanishingLinesGroup)`; call it last in a tool.
- `tools/<name>/{index.html,tool.js}`: one folder per tool; a tool.js holds only what is unique to that tool (objects, layout, randomisation). Start from `tools/_template/`.
- `tools/upside-down/`: the Upside Down tool. Drawings are listed in `manifest.json`; the pictures in `img/` are already rotated 180° in their files, and Reveal turns them upright with CSS. Credits are in `reveal.json`, loaded only at Reveal. Ratings and skips live in the browser's localStorage.
- `pipeline/` + `.github/workflows/collect-drawings.yml`: collects Pixabay line drawings in GitHub Actions (started by hand from the Actions tab; needs the `PIXABAY_API_KEY` repository secret). See `pipeline/README.md`. Currently parked, see Open work.

## Conventions
- Tool pages share the same sidebar markup and element IDs (`generate-btn`, `wireframe-toggle`, `vanishing-lines-toggle`, `mode-1pt/2pt/3pt` radios named `perspective-mode`, the apparatus IDs above). `tool.js` looks these up by ID and will throw if a required one is missing; Apparatus ones are optional.
- Put shared logic in `js-core/`, not copied between tools. Use CSS classes, not inline styles.
- Match existing style: plain ES modules, `// ====` banner comments per section, brief comments.
- After moving or rotating cubes, call `vanishingLines.update()`.

## Run and verify
Start the server (`.claude/launch.json` has a `site` config, or `python3 -m http.server 5501`). There are no tests; to verify a change, open each affected page, check the console for errors, toggle every control, and look at a screenshot. Changes to `js-core/` affect every tool: check all of them.

## Adding a tool
1. Copy `tools/_template/` to `tools/<name>/` and edit title, description, controls, `tool.js`.
2. Add `{category, path, icon, title, description}` to `tools.json` (category is `Perspective` or `Observation`; a new name makes a new home-page section).
3. Verify as above.

## Open work: Upside Down drawings (come back to this)
- **Stand-ins in use.** The tool shows only two drawings (`standin-1`, `standin-2`) that the owner supplied for a drawing class; both were already upside down. `standin-1` is a scan of a book page with its caption baked into the picture, and `standin-2`'s source is not recorded. Check copyright and fill in `reveal.json` before relying on them on the public site.
- **Pixabay collection is parked.** The first test run kept 50 of 225 checked (22%, 4 MB). The owner said it was "not quite working" but hasn't said why: ask. Its pull request was merged into `main` by mistake, so the 50 pictures went live; they were then taken out of the site folder and the list went back to the stand-ins. Get them back with `git checkout 35ef7ea -- tools/upside-down/img` (merge their `manifest.json` and `reveal.json` entries by hand). The report is kept in `pipeline/reports/run-41080324137.md` and `.csv`.
- **What the run showed:** most rejections were heavy fills and too many shapes; only 17 of the 50 kept were a single continuous shape; the pixel checks can't tell a Picasso-style contour from a cartoon outline. Ideas: tighten `components_max` to about 6 and `width_spread_max` to 2.0 in `pipeline/quality.py` (keeps 28 of the 50), or use a different source. Looked at: the Met's search is blocked in bursts; lineartstock.com has only 59 AI-looking images; the National Gallery of Art's open data has 481 plain pen and pencil drawings from 1850 to 2000 (mostly pencil, pictures load fine, not built); the Art Institute of Chicago's API works but its picture server refused a script (not pursued). Pixabay forbids "systematic mass downloads", so keep runs small.
- **Not built yet:** a "Copy ratings" button, so ratings can be matched to the report's measurements.
- **Security:** the Pixabay API key was pasted into a chat. Make a new key on Pixabay and update the `PIXABAY_API_KEY` secret.

## Working with the owner
The owner describes drawing skills, not code. Ask about the learning purpose if unclear, and keep explanations non-technical.

- **One session per task.** Follow-up tweaks stay in the session; new features/tools start fresh. Prefer a branch per feature (make it with `git checkout -b <name>`, push it with `git push -u origin HEAD`, never straight to `main`); confirm the tree is clean before starting.
- **New tool:** expect a description of the skill trained, what is generated/randomised, what the user sees and toggles, the closest existing tool, and how to tell it works. Propose a plan first, then build from `tools/_template/`.
- **Feature in an existing tool:** needs the tool, the behaviour and the learning purpose. If it could serve other tools, put it in `js-core/`. Ask when a choice changes what the drawing aid teaches (e.g. screen-space vs horizon-relative lines, all vs visible vertices).
- **Project-wide change** (`js-core/`, shared CSS, sidebar layout, new dependency): plan first, own session, verify every tool.
- **Refactor:** only to remove real pain (e.g. a third copy of the same code). Never mix with a feature. Behaviour-preserving, small commits, before/after check of every tool.
- **Rework of a tool with unclear requirements** (e.g. `rotation-grid`, known to need a rewrite with explicit instructions): treat as a new tool: get a written spec and a plan first; do not patch it.
- Commit in small, separate steps, only when asked.
