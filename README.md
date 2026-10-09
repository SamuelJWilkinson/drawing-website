# drawing-website

Interactive perspective tools for drawing practice (spatial reasoning, inspired by DrawABox and Scott Robertson's *How to Draw*). Plain HTML/CSS/JS with Three.js from a CDN: no build step.

**Run:** `python3 -m http.server 5501`, then open http://localhost:5501 (ES modules need http, not `file://`; VS Code Live Server on port 5501 also works).

**Add a tool:** copy `tools/_template/` to `tools/<name>/`, edit it, add an entry to `tools.json`. See `CLAUDE.md` for the details.
