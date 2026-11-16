import { scene, cameraPerspective, cameraTop, cameraMeta } from '../../js-core/PerspectiveEngine.js';
import { aimStationPoint, horizonLine } from '../../js-core/Apparatus.js';
import { createVanishingLines } from '../../js-core/Cube.js';
import { startRenderLoop } from '../../js-core/RenderLoop.js';
import { createShadowStage, makeLine, setLine, setupDrawingZoom } from '../../js-core/ShadowTools.js';

// ==========================================
// 1. THE SCENE AND THE VIEWS
// The sun is infinitely far away, so in the Drawing View it can't sit at a real spot in the scene.
// Instead the parts that belong to the drawing (the sun, the shadow origin and the lines to them) sit
// 300 units out from the eye, in the right direction, where they land exactly on the vanishing points.
// The Top and Meta views can't show those, so they get their own nearby sun and parallel rays instead.
// ==========================================
const STAGE_SIZE = 16;
const FAR = 300;            // how far out the Drawing View's sun and shadow origin sit
const NEAR = 18;            // how far from the middle the Top / Meta views' sun sits
const DRAWING_ONLY = 1;     // layer: drawn by the Drawing View only
const OVERVIEW_ONLY = 2;    // layer: drawn by the Top and Meta views only

const { ground, light: overviewSun } = createShadowStage(STAGE_SIZE);

// The eye swings in an arc around the middle of the scene, always looking at it.
// At 0° it looks straight ahead (level), so the horizon runs across the middle of the Drawing View.
const LOOK_AT = new THREE.Vector3(0, 3, 0);
const EYE_DISTANCE = 11;
const EYE = new THREE.Vector3();
const pitchSlider = document.getElementById('pitch-slider');
const pitchValue = document.getElementById('pitch-value');
function aimEye() {
    const pitch = parseFloat(pitchSlider.value) * Math.PI / 180;
    EYE.set(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(EYE_DISTANCE).add(LOOK_AT);
    aimStationPoint(EYE, LOOK_AT);
    pitchValue.textContent = pitchSlider.value;
}
aimEye();
cameraPerspective.zoom = 0.4; // wide, so the sun stays in the picture
cameraPerspective.updateProjectionMatrix();
setupDrawingZoom();
cameraPerspective.layers.enable(DRAWING_ONLY);

// Top plan view: far away at the top of the picture, the eye at the bottom
const half = STAGE_SIZE / 2 + 1;
cameraTop.left = -half; cameraTop.right = half; cameraTop.top = half; cameraTop.bottom = -half;
cameraTop.position.set(0, 40, 0);
cameraTop.up.set(0, 0, -1);
cameraTop.lookAt(0, 0, 0);
cameraTop.updateProjectionMatrix();
cameraTop.layers.enable(OVERVIEW_ONLY);

cameraMeta.position.set(26, 15, 28);
cameraMeta.layers.enable(OVERVIEW_ONLY);

// Puts an object on one view's layer. onTop objects show through the ground and sticks, like pencil lines drawn over a picture.
function onLayer(object, layer, onTop) {
    object.layers.set(layer);
    if (onTop) { object.material.depthTest = false; object.renderOrder = 10; }
    return object;
}
function makeBall(radius, color) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 16), new THREE.MeshBasicMaterial({ color }));
    scene.add(ball);
    return ball;
}
function makeSoftLine(color) {
    const line = makeLine(color, false);
    line.material.transparent = true;
    line.material.opacity = 0.55;
    return line;
}

// ==========================================
// 2. THE SUN AND ITS SHADOW ORIGIN
// Drawing View: the sun is a ball (a see-through "ghost" when it is behind you), the shadow origin is a dot
// on the horizon, and a line joins them.
// Top / Meta views: a ball for the sun, and an arrow along the ground pointing at the shadow origin.
// ==========================================
const SUN_YELLOW = 0xffee66, SHADOW_BLUE = 0x44ddff;

const drawingSun = onLayer(makeBall(14, SUN_YELLOW), DRAWING_ONLY, true);
const shadowOrigin = onLayer(makeBall(5, 0xffffff), DRAWING_ONLY, true);
const sunToOrigin = onLayer(makeLine(0xffffff, true), DRAWING_ONLY, true);

overviewSun.layers.set(OVERVIEW_ONLY);
overviewSun.scale.setScalar(3);
const originArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.03, 0), 9, 0xffffff, 0.8, 0.4);
originArrow.line.layers.set(OVERVIEW_ONLY);
originArrow.cone.layers.set(OVERVIEW_ONLY);
scene.add(originArrow);

// ==========================================
// 3. THE STICKS
// A stick is a pole with a ball on top (the point whose shadow you trace), plus its shadow and its construction lines.
// ==========================================
const STICK_RADIUS = 0.06;
const MAX_STICKS = 5;
const sticks = [];

function createStick() {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(STICK_RADIUS, STICK_RADIUS, 1, 12), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    const top = new THREE.Mesh(new THREE.SphereGeometry(STICK_RADIUS * 1.8, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff6644 }));
    group.add(pole, top);
    scene.add(group);

    const shadow = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, STICK_RADIUS * 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    scene.add(shadow);

    const stick = {
        group, pole, top, shadow, height: 2,
        ray: makeLine(SUN_YELLOW, false),                               // the ray itself, from the top of the stick down to the shadow's tip
        rayDrawing: onLayer(makeSoftLine(SUN_YELLOW), DRAWING_ONLY, true),  // carried on to the sun (Drawing View)
        rayOverview: onLayer(makeLine(SUN_YELLOW, false), OVERVIEW_ONLY),   // carried on up to the sun (Top / Meta views)
        lineDrawing: onLayer(makeSoftLine(SHADOW_BLUE), DRAWING_ONLY, true), // from the stick's foot to the shadow origin (Drawing View)
        lineOverview: onLayer(makeLine(SHADOW_BLUE, true), OVERVIEW_ONLY),   // the same line along the ground (Top / Meta views)
        tipMarker: makeBall(0.1, SHADOW_BLUE)                           // where the shadow ends
    };
    return stick;
}

function removeStick(stick) {
    [stick.group, stick.shadow, stick.ray, stick.rayDrawing, stick.rayOverview, stick.lineDrawing, stick.lineOverview, stick.tipMarker].forEach(o => scene.remove(o));
}

// ==========================================
// 4. WORK OUT THE SUN AND THE SHADOWS
// positive: the sun is in front of you, above the horizon, so its rays come towards you.
// negative: the sun is behind you; its rays run away from you, so they meet below the horizon (the "ghost" sun).
// "forward" is the way along the ground towards the shadow origin on the horizon.
// A stick of height h casts a shadow h / tan(sun height) long, along that line: towards you when positive, away when negative.
// ==========================================
let positive = true;
const sunSlider = document.getElementById('sun-slider');
const sunValue = document.getElementById('sun-value');
const sideSlider = document.getElementById('side-slider');
const sideValue = document.getElementById('side-value');
const modeNote = document.getElementById('mode-note');

const MODE_NOTES = {
    positive: 'The sun is in front of you, above the horizon. Its shadow origin is on the horizon straight below it. Shadows come towards you, out of the shadow origin.',
    negative: 'The sun is behind you, so you cannot see it. Its ghost sits below the horizon, and the shadow origin is on the horizon straight above the ghost. Shadows run away from you, into the shadow origin.'
};

function updateShadows() {
    const sign = positive ? 1 : -1;
    const height = parseFloat(sunSlider.value) * Math.PI / 180;
    const side = parseFloat(sideSlider.value) * Math.PI / 180;
    sunValue.textContent = sunSlider.value;
    sideValue.textContent = sideSlider.value;
    modeNote.textContent = MODE_NOTES[positive ? 'positive' : 'negative'];

    const forward = new THREE.Vector3(Math.sin(side), 0, -Math.cos(side));
    const towardSun = forward.clone().multiplyScalar(sign * Math.cos(height)).add(new THREE.Vector3(0, Math.sin(height), 0));

    // Drawing View: the sun (or its ghost) and the shadow origin, as points on the vanishing points
    const sunPoint = EYE.clone().addScaledVector(towardSun, FAR * sign);
    const originPoint = EYE.clone().addScaledVector(forward, FAR);
    drawingSun.position.copy(sunPoint);
    drawingSun.material.wireframe = !positive;
    shadowOrigin.position.copy(originPoint);
    setLine(sunToOrigin, sunPoint, originPoint);

    // Top / Meta views: the sun nearby, and an arrow along the ground to the shadow origin
    overviewSun.position.copy(towardSun).multiplyScalar(NEAR);
    originArrow.setDirection(forward);

    sticks.forEach(s => {
        const foot = new THREE.Vector3(s.group.position.x, 0, s.group.position.z);
        const top = new THREE.Vector3(foot.x, s.height, foot.z);
        const tip = foot.clone().addScaledVector(forward, -sign * s.height / Math.tan(height));

        // The shadow strip runs from the stick's foot to the shadow's tip
        s.shadow.scale.x = tip.distanceTo(foot);
        s.shadow.position.copy(foot).add(tip).multiplyScalar(0.5);
        s.shadow.position.y = 0.006;
        s.shadow.rotation.y = -Math.atan2(tip.z - foot.z, tip.x - foot.x);
        s.tipMarker.position.copy(tip);

        setLine(s.ray, tip, top);
        // Drawing View: tip, top and sun lie on one line; tip, foot and shadow origin lie on another
        setLine(s.rayDrawing, positive ? top : tip, sunPoint);
        setLine(s.lineDrawing, positive ? tip : foot, originPoint);
        // Top / Meta views: carry the ray up to a flat wall of rays facing the sun, and the shadow line along the ground
        setLine(s.rayOverview, top, top.clone().addScaledVector(towardSun, NEAR - top.dot(towardSun)));
        const alongGround = forward.clone().multiplyScalar(10);
        const groundFoot = new THREE.Vector3(foot.x, 0.03, foot.z);
        setLine(s.lineOverview, groundFoot.clone().sub(alongGround), groundFoot.clone().add(alongGround));
    });
}

// ==========================================
// 5. PLACE THE STICKS
// Each stick gets a new spot and height, clear of the other sticks
// ==========================================
const rand = (min, max) => min + Math.random() * (max - min);
const MIN_GAP = 1.6;

function placeStick(stick, others) {
    stick.height = rand(1.5, 2.5);
    stick.pole.scale.y = stick.height;
    stick.pole.position.y = stick.height / 2;
    stick.top.position.y = stick.height;

    for (let tries = 0; tries < 100; tries++) {
        stick.group.position.set(rand(-4.5, 4.5), 0, rand(-2, 2));
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

// Positive / negative sun
const modeButtons = { positive: document.getElementById('mode-positive'), negative: document.getElementById('mode-negative') };
function setMode(isPositive) {
    positive = isPositive;
    modeButtons.positive.classList.toggle('active', positive);
    modeButtons.negative.classList.toggle('active', !positive);
    updateShadows();
}
modeButtons.positive.addEventListener('click', () => setMode(true));
modeButtons.negative.addEventListener('click', () => setMode(false));

// Each construction toggle shows or hides its parts
const toggles = {
    origin: document.getElementById('origin-toggle'),
    ray: document.getElementById('ray-toggle'),
    direction: document.getElementById('direction-toggle'),
    shadow: document.getElementById('shadow-toggle')
};
function applyToggles() {
    shadowOrigin.visible = sunToOrigin.visible = originArrow.visible = toggles.origin.checked;
    sticks.forEach(s => {
        s.ray.visible = s.rayDrawing.visible = s.rayOverview.visible = toggles.ray.checked;
        s.lineDrawing.visible = s.lineOverview.visible = s.tipMarker.visible = toggles.direction.checked;
        s.shadow.visible = toggles.shadow.checked;
    });
}
Object.values(toggles).forEach(box => box.addEventListener('change', applyToggles));

addStick();
addStick();
addStick();
document.getElementById('generate-btn').addEventListener('click', generate);
addBtn.addEventListener('click', addStick);
removeBtn.addEventListener('click', () => {
    removeStick(sticks.pop());
    updateStickButtons();
});
sunSlider.addEventListener('input', updateShadows);
sideSlider.addEventListener('input', updateShadows);
pitchSlider.addEventListener('input', () => { aimEye(); updateShadows(); }); // the sun and shadow origin are placed relative to the eye
document.getElementById('ground-toggle').addEventListener('change', e => ground.visible = e.target.checked);
horizonLine.visible = document.getElementById('horizon-toggle').checked; // starts on

// ==========================================
// 7. LOOP
// ==========================================
startRenderLoop(createVanishingLines().group);
