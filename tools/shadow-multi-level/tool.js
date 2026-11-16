import { scene } from '../../js-core/PerspectiveEngine.js';
import { createVanishingLines } from '../../js-core/Cube.js';
import { startRenderLoop } from '../../js-core/RenderLoop.js';
import { createShadowStage, setupShadowView, makeLine, setLine, makeLightPlane, setLightPlane, makeCutFace, setCutFace, setupDrawingZoom } from '../../js-core/ShadowTools.js';

// ==========================================
// 1. THE PLANE AND THE LIGHT
// The light is a bright ball that only ever moves up and down over the centre
// ==========================================
const { ground, light } = createShadowStage();
setupShadowView({ eyeDistance: 20, lookAt: new THREE.Vector3(0, 3, 0), zoom: 1.1 });
setupDrawingZoom();

const rand = (min, max) => min + Math.random() * (max - min);

// ==========================================
// 2. THE BLOCKS
// Three square blocks of different heights standing on the plane.
// The top of each block is a new level, with its own shadow origin.
// ==========================================
const blockColors = [0xd9674f, 0x4f9fd9, 0x6fbf73];

function createBlock(color) {
    // One shade per face (+x, -x, top, bottom, +z, -z) so the block reads as solid
    const base = new THREE.Color(color);
    const materials = [0.75, 0.6, 1, 0.4, 0.85, 0.65].map(shade => new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(shade) }));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0xffffff })));
    scene.add(mesh);
    return { mesh, x: 0, z: 0, half: 1, height: 1 }; // half = half the width; height = the level of its top
}
const blocks = blockColors.map(createBlock);

// Spread the blocks around the light, at different heights
function layoutBlocks() {
    const start = rand(0, Math.PI * 2);
    blocks.forEach((b, i) => {
        const angle = start + i * Math.PI * 2 / blocks.length + rand(-0.3, 0.3);
        const radius = rand(2.6, 3.4);
        b.x = Math.cos(angle) * radius;
        b.z = Math.sin(angle) * radius;
        b.half = rand(1.0, 1.2);
        b.height = rand(0.5, 1.5);
        b.mesh.scale.set(b.half * 2, b.height, b.half * 2);
        b.mesh.position.set(b.x, b.height / 2, b.z);
    });
}

// How far from the point under the light a line from it through (rx, rz) leaves the block's top
function distanceToBlockEdge(b, rx, rz) {
    let t = Infinity;
    [[b.x, rx], [b.z, rz]].forEach(([centre, r]) => {
        if (Math.abs(r) > 1e-6) t = Math.min(t, (centre + Math.sign(r) * b.half) / r);
    });
    return t;
}

// ==========================================
// 3. THE STICKS
// Each stick stands on top of a block (the sticks take the blocks in turn).
// It has its own shadow strip(s), plumb line, light ray, shadow direction line, light plane and origin.
// ==========================================
const STICK_RADIUS = 0.05;
const MAX_STICKS = 5;
const sticks = [];
const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

function createStrip() {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, STICK_RADIUS * 2), shadowMaterial);
    scene.add(strip);
    return strip;
}

function createStick(block) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(STICK_RADIUS, STICK_RADIUS, 1, 12), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(STICK_RADIUS * 1.8, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff6644 }));
    group.add(pole, tip);
    scene.add(group);

    const stick = {
        block, group, pole, tip, height: 1,
        topStrip: createStrip(),    // the shadow on top of the block
        groundStrip: createStrip(), // the rest of the shadow, if it runs off the block onto the plane
        plumbLine: makeLine(0xffffff, true),
        rayLine: makeLine(0xffee66, false),
        directionLine: makeLine(0x44ddff, false),
        origin: new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })),
        shadowTip: new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0x44ddff })),
        lightPlane: makeLightPlane(),
        cuts: blocks.map(makeCutFace) // where the light plane slices through each block
    };
    scene.add(stick.origin, stick.shadowTip);
    return stick;
}

function removeStick(s) {
    [s.group, s.topStrip, s.groundStrip, s.plumbLine, s.rayLine, s.directionLine, s.origin, s.shadowTip, s.lightPlane, ...s.cuts].forEach(o => scene.remove(o));
}

// ==========================================
// 4. WORK OUT THE SHADOWS
// With the light at height h, a stick of height s standing on a block whose top is at height b,
// d away from the point under the light: the ray through the top of the stick meets the level of the
// block's top at d x (h - b) / (h - b - s), measured from the point under the light at that level.
// If that point is past the edge of the block, the shadow runs off the block and the ray
// carries on down to the plane, landing at d x h / (h - b - s). The shadow origin then sits on the plane.
// ==========================================
const lightSlider = document.getElementById('light-slider');
const lightValue = document.getElementById('light-value');

// A flat shadow strip at height y, running from distance d1 to d2 along the direction (rx, rz)
function setStrip(strip, d1, d2, y, rx, rz) {
    strip.visible = d2 - d1 > 0.001;
    strip.scale.x = Math.max(d2 - d1, 0.001);
    strip.position.set(rx * (d1 + d2) / 2, y + 0.006, rz * (d1 + d2) / 2);
    strip.rotation.y = -Math.atan2(rz, rx);
}

function updateShadows() {
    const h = parseFloat(lightSlider.value);
    const lightPos = new THREE.Vector3(0, h, 0);
    light.position.copy(lightPos);
    lightValue.textContent = h.toFixed(1);

    sticks.forEach(s => {
        const b = s.block.height;
        const x = s.group.position.x, z = s.group.position.z;
        const d = Math.hypot(x, z);
        const rx = x / d, rz = z / d; // the direction the shadow runs in

        const dLevel = d * (h - b) / (h - b - s.height);
        const dEdge = distanceToBlockEdge(s.block, rx, rz);

        let level, dTip;
        if (dLevel <= dEdge) {
            // The whole shadow lies on top of the block
            level = b; dTip = dLevel;
            setStrip(s.topStrip, d, dTip, b, rx, rz);
            s.groundStrip.visible = false;
        } else {
            // The shadow runs off the edge and finishes on the plane
            level = 0; dTip = d * h / (h - b - s.height);
            setStrip(s.topStrip, d, dEdge, b, rx, rz);
            setStrip(s.groundStrip, dEdge * h / (h - b), dTip, 0, rx, rz);
        }

        const origin = new THREE.Vector3(0, level, 0);
        const tipPos = new THREE.Vector3(rx * dTip, level, rz * dTip);
        setLine(s.plumbLine, lightPos, origin);
        setLine(s.rayLine, lightPos, tipPos);
        setLine(s.directionLine, origin, tipPos);
        setLightPlane(s.lightPlane, h, rx, rz);
        s.cuts.forEach((cut, i) => setCutFace(cut, blocks[i], rx, rz));
        s.origin.position.copy(origin);
        s.shadowTip.position.copy(tipPos);
    });
    applyToggles();
}

// ==========================================
// 5. PLACE THE STICKS
// Each stick gets a new spot and height on its block, kept apart from the other sticks
// ==========================================
const MIN_GAP = 0.6; // between sticks

function placeStick(stick, others) {
    const b = stick.block;
    stick.height = rand(0.7, 1.0);
    stick.pole.scale.y = stick.height;
    stick.pole.position.y = stick.height / 2;
    stick.tip.position.y = stick.height;

    // Stand it on the half of the block's top nearest the light, so there is room for the shadow
    const dist = Math.hypot(b.x, b.z);
    const inX = -b.x / dist, inZ = -b.z / dist; // pointing toward the light
    for (let tries = 0; tries < 100; tries++) {
        const along = rand(-0.1, 0.6) * b.half, across = rand(-0.6, 0.6) * b.half;
        stick.group.position.set(b.x + inX * along - inZ * across, b.height, b.z + inZ * along + inX * across);
        if (others.every(o => o.group.position.distanceTo(stick.group.position) >= MIN_GAP)) break;
    }
}

function generate() {
    layoutBlocks();
    const placed = [];
    sticks.forEach(s => { placeStick(s, placed); placed.push(s); });
    updateShadows();
}

// ==========================================
// 6. UI
// ==========================================
const addBtn = document.getElementById('add-stick-btn');
const removeBtn = document.getElementById('remove-stick-btn');
const stickCount = document.getElementById('stick-count');

function updateStickButtons() {
    stickCount.textContent = sticks.length;
    addBtn.disabled = sticks.length >= MAX_STICKS;
    removeBtn.disabled = sticks.length <= 1;
}

function addStick() {
    const stick = createStick(blocks[sticks.length % blocks.length]);
    placeStick(stick, sticks.filter(o => o.block === stick.block));
    sticks.push(stick);
    updateShadows();
    applyToggles();
    updateStickButtons();
}

// Each construction toggle shows or hides its parts for every stick
const toggles = {
    origin: document.getElementById('origin-toggle'),
    plumb: document.getElementById('plumb-toggle'),
    ray: document.getElementById('ray-toggle'),
    direction: document.getElementById('direction-toggle'),
    lightPlane: document.getElementById('light-plane-toggle'),
    cuts: document.getElementById('cut-toggle')
};
function applyToggles() {
    sticks.forEach(s => {
        s.origin.visible = toggles.origin.checked;
        s.plumbLine.visible = toggles.plumb.checked;
        s.rayLine.visible = toggles.ray.checked;
        s.directionLine.visible = toggles.direction.checked;
        s.shadowTip.visible = toggles.direction.checked;
        s.lightPlane.visible = toggles.lightPlane.checked;
        s.cuts.forEach(cut => cut.visible = cut.userData.hit && toggles.lightPlane.checked && toggles.cuts.checked);
    });
}
Object.values(toggles).forEach(box => box.addEventListener('change', applyToggles));

layoutBlocks();
addStick();
document.getElementById('generate-btn').addEventListener('click', generate);
addBtn.addEventListener('click', addStick);
removeBtn.addEventListener('click', () => {
    removeStick(sticks.pop());
    updateStickButtons();
});
lightSlider.addEventListener('input', updateShadows);
document.getElementById('ground-toggle').addEventListener('change', e => ground.visible = e.target.checked);

// ==========================================
// 7. LOOP
// ==========================================
startRenderLoop(createVanishingLines().group);
