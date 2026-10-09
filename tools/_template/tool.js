// COPY THIS FOLDER to tools/<new-name>/, then edit index.html (title, description,
// sidebar controls) and this file. Add an entry to /tools.json so it shows on the home page.
// Remove any sidebar controls in index.html that your tool doesn't need.
import { createFaceColouredCube, createVanishingLines, wireCubeToggles } from '../../js-core/Cube.js';
import { startRenderLoop } from '../../js-core/RenderLoop.js';

// 1. OBJECTS: build whatever you want to draw
const cube = createFaceColouredCube(1.5);
const vanishingLines = createVanishingLines();
vanishingLines.addCube(cube);

// 2. UI: randomise / lay out, then call vanishingLines.update()
function generate() {
    cube.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    vanishingLines.update();
}

document.addEventListener('DOMContentLoaded', generate);
document.getElementById('generate-btn').addEventListener('click', generate);
wireCubeToggles([cube], vanishingLines);

// 3. LOOP: always last
startRenderLoop(vanishingLines.group);
