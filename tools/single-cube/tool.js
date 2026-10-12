import { createFaceColouredCube, createVanishingLines, wireCubeToggles } from '../../js-core/Cube.js';
import { createVertexInspector, wireVertexInspectToggle } from '../../js-core/VertexInspector.js';
import { createEdgeInspector, wireEdgeInspectToggle } from '../../js-core/EdgeInspector.js';
import { startRenderLoop } from '../../js-core/RenderLoop.js';

// ==========================================
// 1. THE CUBE
// ==========================================
const cube = createFaceColouredCube(1.5);
const vanishingLines = createVanishingLines();
vanishingLines.addCube(cube);
const vertexInspector = createVertexInspector([cube]);
const edgeInspector = createEdgeInspector([cube]);

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
    vertexInspector.clear();
    edgeInspector.clear();
}

document.addEventListener('DOMContentLoaded', randomizeCube);
document.getElementById('generate-btn').addEventListener('click', randomizeCube);
document.querySelectorAll('input[name="perspective-mode"]').forEach(radio => radio.addEventListener('change', randomizeCube));
wireCubeToggles([cube], vanishingLines);
wireVertexInspectToggle(vertexInspector);
wireEdgeInspectToggle(edgeInspector);

// Both inspectors cover the whole Drawing View, so only one can be on at a time
const vertexToggle = document.getElementById('vertex-inspect-toggle');
const edgeToggle = document.getElementById('edge-compare-toggle');
function switchOffOther(thisToggle, otherToggle) {
    thisToggle.addEventListener('change', () => {
        if (thisToggle.checked && otherToggle.checked) { otherToggle.checked = false; otherToggle.dispatchEvent(new Event('change')); }
    });
}
switchOffOther(vertexToggle, edgeToggle);
switchOffOther(edgeToggle, vertexToggle);

startRenderLoop(vanishingLines.group);
