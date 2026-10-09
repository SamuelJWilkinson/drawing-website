import { createFaceColouredCube, createVanishingLines, wireCubeToggles } from '../../js-core/Cube.js';
import { startRenderLoop } from '../../js-core/RenderLoop.js';

// ==========================================
// 1. THE CUBE
// ==========================================
const cube = createFaceColouredCube(1.5);
const vanishingLines = createVanishingLines();
vanishingLines.addCube(cube);

// ==========================================
// 2. UI CONTROLS
// ==========================================
function randomizeCube() {
    const mode3pt = document.getElementById('mode-3pt').checked;
    const mode2pt = document.getElementById('mode-2pt').checked;
    const mode1pt = document.getElementById('mode-1pt').checked;

    if (mode3pt) {
        cube.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    } else if (mode2pt) {
        cube.rotation.set(0, Math.random() * Math.PI * 2, 0);
    } else if (mode1pt) {
        cube.rotation.set(0, 0, 0);
        cube.position.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0);
    }
    if (!mode1pt) cube.position.set(0, 0, 0);
    vanishingLines.update();
}

document.addEventListener('DOMContentLoaded', randomizeCube);
document.getElementById('generate-btn').addEventListener('click', randomizeCube);
document.querySelectorAll('input[name="perspective-mode"]').forEach(radio => radio.addEventListener('change', randomizeCube));
wireCubeToggles([cube], vanishingLines);

startRenderLoop(vanishingLines.group);
