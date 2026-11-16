import { scene } from '../../js-core/PerspectiveEngine.js';
import { createVanishingLines } from '../../js-core/Cube.js';
import { startRenderLoop } from '../../js-core/RenderLoop.js';
import { createShadowStage, setupShadowView, makeLine, setLine, makeLightPlane, setLightPlane, setupDrawingZoom } from '../../js-core/ShadowTools.js';

// ==========================================
// 1. THE PLANE AND THE LIGHT
// The light is a bright ball that only ever moves up and down over the centre
// ==========================================
const { ground, light } = createShadowStage();
setupShadowView({ eyeDistance: 17, lookAt: new THREE.Vector3(0, 2, 0), zoom: 1.25 });
setupDrawingZoom();

// ==========================================
// 2. CONSTRUCTION (each part has its own toggle)
// shadow origin: the point on the plane directly under the light
// line to origin: straight down from the light to the shadow origin
// light ray: from the light past the top of a stick down to the plane (one per stick)
// shadow direction: along the plane, from the shadow origin through a stick's foot to its shadow's tip (one per stick)
// light plane: the upright rectangle from the true ground plane up to the light, holding the light ray and the shadow direction (one per stick)
// ==========================================
const plumbLine = makeLine(0xffffff, true);
const shadowOrigin = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
scene.add(shadowOrigin);

// ==========================================
// 3. THE STICKS
// Each stick is a thin pole with a ball on top (the point whose shadow you trace),
// plus its own shadow strip, light ray, shadow direction line and light plane.
// ==========================================
const STICK_RADIUS = 0.05;
const MAX_STICKS = 5;
const sticks = [];

function createStick() {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(STICK_RADIUS, STICK_RADIUS, 1, 12), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(STICK_RADIUS * 1.8, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff6644 }));
    group.add(pole, tip);
    scene.add(group);

    // The shadow: a flat dark strip on the plane, as wide as the stick
    const shadow = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, STICK_RADIUS * 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    scene.add(shadow);

    const stick = {
        group, pole, tip, shadow, height: 1.5,
        rayLine: makeLine(0xffee66, false),
        directionLine: makeLine(0x44ddff, false),
        shadowTip: new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0x44ddff })),
        lightPlane: makeLightPlane()
    };
    scene.add(stick.shadowTip);
    return stick;
}

function removeStick(stick) {
    [stick.group, stick.shadow, stick.rayLine, stick.directionLine, stick.shadowTip, stick.lightPlane].forEach(o => scene.remove(o));
}

// ==========================================
// 4. WORK OUT THE SHADOWS
// The ray from the light through the top of a stick lands on the plane at
// (stick position) x h / (h - stick height), measured from the point under the light.
// ==========================================
const lightSlider = document.getElementById('light-slider');
const lightValue = document.getElementById('light-value');

function updateShadows() {
    const h = parseFloat(lightSlider.value);
    const lightPos = new THREE.Vector3(0, h, 0);
    const underLight = new THREE.Vector3(0, 0, 0);

    light.position.copy(lightPos);
    lightValue.textContent = h.toFixed(1);
    setLine(plumbLine, lightPos, underLight);
    shadowOrigin.position.copy(underLight);

    sticks.forEach(s => {
        const stickFoot = new THREE.Vector3(s.group.position.x, 0, s.group.position.z);
        const tipPos = stickFoot.clone().multiplyScalar(h / (h - s.height));

        // Shadow strip runs from the stick's foot to the shadow's tip
        s.shadow.scale.x = tipPos.distanceTo(stickFoot);
        s.shadow.position.copy(stickFoot).add(tipPos).multiplyScalar(0.5);
        s.shadow.position.y = 0.006;
        s.shadow.rotation.y = -Math.atan2(tipPos.z - stickFoot.z, tipPos.x - stickFoot.x);

        setLine(s.rayLine, lightPos, tipPos);
        setLine(s.directionLine, underLight, tipPos);
        setLightPlane(s.lightPlane, h, stickFoot.x / stickFoot.length(), stickFoot.z / stickFoot.length());
        s.shadowTip.position.copy(tipPos);
    });
}

// ==========================================
// 5. PLACE THE STICKS
// Each stick gets a new spot and height, clear of the point under the light and of the other sticks
// ==========================================
const rand = (min, max) => min + Math.random() * (max - min);
const MIN_GAP = 0.9; // between sticks

function placeStick(stick, others) {
    stick.height = rand(1, 1.5);
    stick.pole.scale.y = stick.height;
    stick.pole.position.y = stick.height / 2;
    stick.tip.position.y = stick.height;

    for (let tries = 0; tries < 100; tries++) {
        const angle = rand(0, Math.PI * 2);
        const distance = rand(1.2, 2.5);
        stick.group.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
        if (others.every(o => o.group.position.distanceTo(stick.group.position) >= MIN_GAP)) break;
    }
}

function generate() {
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
    const stick = createStick();
    placeStick(stick, sticks);
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
    lightPlane: document.getElementById('light-plane-toggle')
};
function applyToggles() {
    shadowOrigin.visible = toggles.origin.checked;
    plumbLine.visible = toggles.plumb.checked;
    sticks.forEach(s => {
        s.rayLine.visible = toggles.ray.checked;
        s.directionLine.visible = toggles.direction.checked;
        s.shadowTip.visible = toggles.direction.checked;
        s.lightPlane.visible = toggles.lightPlane.checked;
    });
}
Object.values(toggles).forEach(box => box.addEventListener('change', applyToggles));

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
