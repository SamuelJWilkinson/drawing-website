import { scene, cameraPerspective } from '../../js-core/PerspectiveEngine.js';
import { aimStationPoint } from '../../js-core/Apparatus.js';
import { createFaceColouredCube, createVanishingLines, wireCubeToggles } from '../../js-core/Cube.js';
import { startRenderLoop } from '../../js-core/RenderLoop.js';
import { setupWalkthrough } from './walkthrough.js';

// ==========================================
// 1. THE BOXES AND THE GROUND
// ==========================================
// A box is a unit cube stretched to width x height x depth
const warmColors = [0xff4444, 0xff8844, 0xffcc44, 0xff4488, 0xffaa44, 0xff6666];
const coolColors = [0x4444ff, 0x44aaff, 0x44ffff, 0x8844ff, 0x44ffaa, 0x6666ff];

const box1 = createFaceColouredCube(1, { colors: warmColors, opacity: 0.85 });
const box2 = createFaceColouredCube(1, { colors: coolColors, opacity: 0.85 });
const boxes = [box1, box2];

const vanishingLines = createVanishingLines();
boxes.forEach(b => vanishingLines.addCube(b));

const ground = new THREE.GridHelper(8, 8, 0x888888, 0x444444);
scene.add(ground);

// ==========================================
// 2. GENERATE
// ==========================================
const rand = (min, max) => min + Math.random() * (max - min);
const MIN_TURN_DIFFERENCE = 25 * Math.PI / 180; // the boxes never look lined up

function generate() {
    boxes.forEach(b => {
        b.scale.set(rand(0.7, 1.4), rand(0.6, 1.6), rand(0.7, 1.4));
        b.position.y = b.scale.y / 2; // resting on the ground
    });

    // Turn each box about its vertical axis, at clearly different angles
    box1.rotation.y = rand(0, Math.PI * 2);
    box2.rotation.y = box1.rotation.y + (Math.random() < 0.5 ? 1 : -1) * rand(MIN_TURN_DIFFERENCE, Math.PI / 2);

    // Place them apart on the ground (keep trying until they don't overlap)
    const reach = b => Math.hypot(b.scale.x, b.scale.z) / 2;
    const minGap = reach(box1) + reach(box2) + 0.2;
    for (let tries = 0; tries < 100; tries++) {
        box1.position.x = rand(-2, 2); box1.position.z = rand(-1.5, 1.5);
        box2.position.x = rand(-2, 2); box2.position.z = rand(-1.5, 1.5);
        const gap = Math.hypot(box1.position.x - box2.position.x, box1.position.z - box2.position.z);
        if (gap >= minGap) break;
    }

    vanishingLines.update();
}

// ==========================================
// 3. EYE HEIGHT
// The eye swings in an arc around a point in the middle of the boxes, always looking at it,
// so the distance stays the same and only the angle changes.
// ==========================================
const EYE_DISTANCE = 5;
const lookAtPoint = new THREE.Vector3(0, 0.75, 0);
const pitchSlider = document.getElementById('pitch-slider');
const pitchValue = document.getElementById('pitch-value');

// Zoom out a little so both boxes stay in the picture when looking steeply down
cameraPerspective.zoom = 0.75;
cameraPerspective.updateProjectionMatrix();

function applyPitch() {
    const pitch = parseFloat(pitchSlider.value) * Math.PI / 180;
    const eye = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(EYE_DISTANCE).add(lookAtPoint);
    aimStationPoint(eye, lookAtPoint);
    pitchValue.textContent = pitchSlider.value;
}

// ==========================================
// 4. UI
// ==========================================
document.addEventListener('DOMContentLoaded', () => { generate(); applyPitch(); });
document.getElementById('generate-btn').addEventListener('click', generate);
pitchSlider.addEventListener('input', applyPitch);
document.getElementById('ground-toggle').addEventListener('change', e => ground.visible = e.target.checked);
wireCubeToggles(boxes, vanishingLines);
setupWalkthrough(boxes);

// ==========================================
// 5. LOOP
// ==========================================
startRenderLoop(vanishingLines.group);
