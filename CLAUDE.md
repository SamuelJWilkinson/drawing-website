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

## Conventions
- Tool pages share the same sidebar markup and element IDs (`generate-btn`, `wireframe-toggle`, `vanishing-lines-toggle`, `mode-1pt/2pt/3pt` radios named `perspective-mode`, the apparatus IDs above). `tool.js` looks these up by ID and will throw if a required one is missing; Apparatus ones are optional.
- Put shared logic in `js-core/`, not copied between tools. Use CSS classes, not inline styles.
- Match existing style: plain ES modules, `// ====` banner comments per section, brief comments.
- After moving or rotating cubes, call `vanishingLines.update()`.

## Run and verify
Start the server (`.claude/launch.json` has a `site` config, or `python3 -m http.server 5501`). There are no tests; to verify a change, open each affected page, check the console for errors, toggle every control, and look at a screenshot. Changes to `js-core/` affect every tool: check all of them.

## Adding a tool
1. Copy `tools/_template/` to `tools/<name>/` and edit title, description, controls, `tool.js`.
2. Add `{path, icon, title, description}` to `tools.json`.
3. Verify as above.
