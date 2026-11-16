import { scene, cameraPerspective, cameraTop, cameraMeta, rendererPerspective, onDrawingResize } from './PerspectiveEngine.js';
import { aimStationPoint } from './Apparatus.js';

// ==========================================
// SHARED SHADOW-TOOL HELPERS
// The plane, the light, the construction lines and the view used by the Shadows tools
// ==========================================

export const PLANE_SIZE = 12;

// The flat plane with its grid, and the light (a bright ball; the tool moves it up and down)
// (size is optional: a tool that needs a bigger plane can pass its own)
export function createShadowStage(size = PLANE_SIZE) {
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ color: 0x3a3f47 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.01; // just under the grid and shadows, so they don't flicker
    scene.add(plane);

    const ground = new THREE.GridHelper(size, size, 0x888888, 0x555555);
    scene.add(ground);

    const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffee66 }));
    scene.add(light);

    return { ground, light };
}

// A line you can re-aim with setLine(line, from, to)
export function makeLine(color, dashed) {
    const material = dashed
        ? new THREE.LineDashedMaterial({ color, dashSize: 0.2, gapSize: 0.1 })
        : new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), material);
    line.frustumCulled = false;
    scene.add(line);
    return line;
}
export function setLine(line, a, b) {
    line.geometry.setFromPoints([a, b]);
    if (line.material.isLineDashedMaterial) line.computeLineDistances();
}

// A light plane: the upright rectangle that holds the light ray and the shadow direction.
// It stands on the true ground plane, rises to the height of the light, and reaches
// from the line under the light out to the edge of the plane.
function makeUprightRectangle(fillColor, fillOpacity, lineColor, { seeThrough = false } = {}) {
    const group = new THREE.Group();
    // A 1 x 1 square with its corner at the origin, stretched to size by the group's scale
    const square = new THREE.PlaneGeometry(1, 1);
    square.translate(0.5, 0.5, 0);
    const fill = new THREE.Mesh(square, new THREE.MeshBasicMaterial({
        color: fillColor, transparent: true, opacity: fillOpacity, side: THREE.DoubleSide, depthWrite: false, depthTest: !seeThrough
    }));
    const outline = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints([[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => new THREE.Vector3(x, y, 0))),
        new THREE.LineBasicMaterial({ color: lineColor, depthTest: !seeThrough })
    );
    if (seeThrough) { fill.renderOrder = 10; outline.renderOrder = 11; }
    group.add(fill, outline);
    group.frustumCulled = false;
    scene.add(group);
    return group;
}

// Stand a rectangle on the plane, from distance d1 to d2 along the direction (rx, rz) from the point under the light
function placeUprightRectangle(group, d1, d2, y, height, rx, rz) {
    group.scale.set(Math.max(d2 - d1, 0.001), Math.max(height, 0.001), 1);
    group.position.set(rx * d1, y, rz * d1);
    group.rotation.y = -Math.atan2(rz, rx);
}

export function makeLightPlane() {
    return makeUprightRectangle(0xffee66, 0.18, 0xffee66);
}
// lightHeight: how high the light is; (rx, rz): the direction the shadow runs in
export function setLightPlane(group, lightHeight, rx, rz) {
    const edge = PLANE_SIZE / 2 / Math.max(Math.abs(rx), Math.abs(rz)); // where the plane's edge is in this direction
    placeUprightRectangle(group, 0, edge, 0, lightHeight, rx, rz);
}

// A cut face: the slice a light plane takes out of a block, shown in orange and seen through the block.
export function makeCutFace() {
    return makeUprightRectangle(0xff8844, 0.55, 0xffffff, { seeThrough: true });
}
// Works out where the light plane (running along (rx, rz) from the point under the light) slices through the block
// and puts the cut face there. Sets group.userData.hit to say whether it does; block = { x, z, half, height }.
export function setCutFace(group, block, rx, rz) {
    let enter = 0, leave = Infinity;
    [[block.x, rx], [block.z, rz]].forEach(([centre, r]) => {
        if (Math.abs(r) < 1e-6) {
            if (Math.abs(centre) > block.half) leave = -Infinity; // runs alongside the block, never through it
        } else {
            const t1 = (centre - block.half) / r, t2 = (centre + block.half) / r;
            enter = Math.max(enter, Math.min(t1, t2));
            leave = Math.min(leave, Math.max(t1, t2));
        }
    });
    group.userData.hit = leave - enter > 0.001;
    if (group.userData.hit) placeUprightRectangle(group, enter, leave, 0, block.height, rx, rz);
}

// Sets up the three views and the "Looking down" slider (#pitch-slider, #pitch-value).
// The eye swings in an arc around `lookAt`, always looking at it.
export function setupShadowView({ eyeDistance, lookAt, zoom }) {
    // Top plan view: centred on the plane, wide enough to hold all of it
    const half = PLANE_SIZE / 2 + 1;
    cameraTop.left = -half; cameraTop.right = half; cameraTop.top = half; cameraTop.bottom = -half;
    cameraTop.position.set(0, 10, 0);
    cameraTop.lookAt(0, 0, 0);
    cameraTop.updateProjectionMatrix();

    // Zoom the drawing view, and pull the Meta 3D view back so it holds the whole plane
    cameraPerspective.zoom = zoom;
    cameraPerspective.updateProjectionMatrix();
    cameraMeta.position.set(18, 12, 18);

    const pitchSlider = document.getElementById('pitch-slider');
    const pitchValue = document.getElementById('pitch-value');
    function applyPitch() {
        const pitch = parseFloat(pitchSlider.value) * Math.PI / 180;
        const eye = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(eyeDistance).add(lookAt);
        aimStationPoint(eye, lookAt);
        pitchValue.textContent = pitchSlider.value;
    }
    pitchSlider.addEventListener('input', applyPitch);
    applyPitch();
}

// Zooms the Drawing View without losing the whole-scene view (#zoom-slider, #zoom-value, #zoom-reset-btn).
// Scroll over the drawing to zoom in at the pointer, drag it to move around. 1x shows the whole scene.
// Call after setupShadowView, which sets the starting zoom.
export function setupDrawingZoom() {
    const canvas = rendererPerspective.domElement;
    const size = rendererPerspective.getSize(new THREE.Vector2()); // kept up to date by onDrawingResize below
    const baseZoom = cameraPerspective.zoom; // the zoom that shows the whole scene
    const slider = document.getElementById('zoom-slider');
    const value = document.getElementById('zoom-value');
    const offset = { x: 0, y: 0 }; // how far the picture is shifted, in screen pixels
    canvas.classList.add('pannable');

    function apply() {
        const magnification = parseFloat(slider.value);
        // Never move past the edge of the (magnified) scene
        const maxX = (magnification - 1) * size.x / 2, maxY = (magnification - 1) * size.y / 2;
        offset.x = Math.max(-maxX, Math.min(maxX, offset.x));
        offset.y = Math.max(-maxY, Math.min(maxY, offset.y));
        cameraPerspective.zoom = baseZoom * magnification;
        cameraPerspective.setViewOffset(size.x, size.y, offset.x, offset.y, size.x, size.y);
        value.textContent = magnification.toFixed(1);
    }

    // Change the magnification, keeping the spot at (cx, cy) (pixels from the middle of the picture) where it is
    function zoomTo(newMagnification, cx, cy) {
        const old = parseFloat(slider.value);
        newMagnification = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), newMagnification));
        offset.x = (cx + offset.x) * newMagnification / old - cx;
        offset.y = (cy + offset.y) * newMagnification / old - cy;
        slider.value = newMagnification;
        apply();
    }

    // Pixels from the middle of the picture, in the picture's own units
    function pointer(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: (e.clientX - rect.left - rect.width / 2) * size.x / rect.width, y: (e.clientY - rect.top - rect.height / 2) * size.y / rect.height };
    }

    slider.addEventListener('input', () => zoomTo(parseFloat(slider.value), 0, 0));
    document.getElementById('zoom-reset-btn').addEventListener('click', () => { offset.x = 0; offset.y = 0; zoomTo(1, 0, 0); });

    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const p = pointer(e);
        zoomTo(parseFloat(slider.value) * Math.exp(-e.deltaY * 0.002), p.x, p.y);
    }, { passive: false });

    let dragging = null;
    canvas.addEventListener('pointerdown', e => { dragging = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        offset.x -= (e.clientX - dragging.x) * size.x / rect.width;
        offset.y -= (e.clientY - dragging.y) * size.y / rect.height;
        dragging = { x: e.clientX, y: e.clientY };
        apply();
    });
    canvas.addEventListener('pointerup', () => dragging = null);

    // The Drawing View changed size: measure again and put the picture back in range
    onDrawingResize((width, height) => { size.set(width, height); apply(); });
    apply();
}
