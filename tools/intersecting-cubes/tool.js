import { createFaceColouredCube, createVanishingLines, wireCubeToggles } from '../../js-core/Cube.js';
import { startRenderLoop } from '../../js-core/RenderLoop.js';

// ==========================================
// 1. THE CUBES
// ==========================================
// Cube 1 "warm" colours and Cube 2 "cool" colours so they are distinct
const warmColors = [0xff4444, 0xff8844, 0xffcc44, 0xff4488, 0xffaa44, 0xff6666];
const coolColors = [0x4444ff, 0x44aaff, 0x44ffff, 0x8844ff, 0x44ffaa, 0x6666ff];

const cube1 = createFaceColouredCube(1.5, { colors: warmColors, opacity: 0.85 }); // Main block
const cube2 = createFaceColouredCube(1.0, { colors: coolColors, opacity: 0.85 }); // Smaller intersecting block
const cubes = [cube1, cube2];

const vanishingLines = createVanishingLines();
cubes.forEach(c => vanishingLines.addCube(c));

// ==========================================
// 2. UI CONTROLS
// ==========================================
function randomizeCubes() {
    const mode3pt = document.getElementById('mode-3pt').checked;
    const mode2pt = document.getElementById('mode-2pt').checked;
    const mode1pt = document.getElementById('mode-1pt').checked;

    cubes.forEach((c, index) => {
        if (mode3pt) {
            c.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
        } else if (mode2pt) {
            c.rotation.set(0, Math.random() * Math.PI * 2, 0);
        } else if (mode1pt) {
            c.rotation.set(0, 0, 0);
        }

        // Positioning: keep cube1 near centre, offset cube2 from it to guarantee an intersection
        if (index === 0) {
            c.position.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0);
        } else {
            c.position.set(
                cube1.position.x + (Math.random() - 0.5) * 1.5,
                cube1.position.y + (Math.random() - 0.5) * 1.5,
                cube1.position.z + (Math.random() - 0.5) * 1.5
            );
        }
    });

    vanishingLines.update();
}

document.addEventListener('DOMContentLoaded', randomizeCubes);
document.getElementById('generate-btn').addEventListener('click', randomizeCubes);
document.querySelectorAll('input[name="perspective-mode"]').forEach(r => r.addEventListener('change', randomizeCubes));
wireCubeToggles(cubes, vanishingLines);

startRenderLoop(vanishingLines.group);
