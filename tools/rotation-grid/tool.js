import { moveStationPoint } from '../../js-core/Apparatus.js';
import { createFaceColouredCube, createVanishingLines, wireCubeToggles } from '../../js-core/Cube.js';
import { startRenderLoop } from '../../js-core/RenderLoop.js';

// Move the eye back slightly so the whole grid fits in view
moveStationPoint(7);

// ==========================================
// 1. GENERATE THE 3x3 CUBE GRID
// ==========================================
const cubes = [];
const vanishingLines = createVanishingLines({ opacity: 0.3, backExtent: 1 }); // Lower opacity for density

const spacing = 2.5; // Distance between cubes
for (let i = 0; i < 9; i++) {
    const cube = createFaceColouredCube(1);

    // Arrange in a 3x3 grid centred around (0,0,0)
    const col = i % 3;
    const row = Math.floor(i / 3);
    cube.position.set((col - 1) * spacing, 0, (row - 1) * spacing);

    cubes.push(cube);
    vanishingLines.addCube(cube);
}

// ==========================================
// 2. APPLY ANGLES
// ==========================================
// Common drafting angles in degrees, one per cube
const angles2pt = [10, 20, 30, 40, 45, 50, 60, 70, 80];

function applyAngles() {
    const is3pt = document.getElementById('mode-3pt').checked;

    cubes.forEach((c, i) => {
        const yRot = THREE.MathUtils.degToRad(angles2pt[i]);
        // 3-point adds a 25 degree forward pitch on top of the yaw
        const xRot = is3pt ? THREE.MathUtils.degToRad(25) : 0;
        c.rotation.set(xRot, yRot, 0);
    });
    vanishingLines.update();
}

// ==========================================
// 3. UI WIRING
// ==========================================
document.addEventListener('DOMContentLoaded', applyAngles);
document.querySelectorAll('input[name="perspective-mode"]').forEach(r => r.addEventListener('change', applyAngles));
wireCubeToggles(cubes, vanishingLines);

startRenderLoop(vanishingLines.group);
