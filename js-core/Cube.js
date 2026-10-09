import { scene, cameraPerspective } from './PerspectiveEngine.js';
import { onCameraMoved } from './Apparatus.js';

// ==========================================
// SHARED CUBE HELPERS
// Cube meshes, vanishing-line overlays and the common toggles
// ==========================================

export const FACE_COLORS = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0x44ffff, 0xff44ff];

// A cube with one colour per face and white edges, added to the scene
export function createFaceColouredCube(size, { colors = FACE_COLORS, opacity = 0.9 } = {}) {
    const geo = new THREE.BoxGeometry(size, size, size);
    const mats = colors.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity }));
    const cube = new THREE.Mesh(geo, mats);
    cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff })));
    cube.userData.size = size;
    scene.add(cube);
    return cube;
}

// Wireframe mode = hide the faces, keep the white edges
export function setWireframe(cubes, on) {
    cubes.forEach(c => c.material.forEach(mat => mat.visible = !on));
}

// ==========================================
// VANISHING LINES
// Extends each of a cube's 12 edges far past the cube, away from the eye.
// Edges are coloured by axis: x = red, y = green, z = blue.
// ==========================================
const AXIS_COLORS = [0xff4444, 0x44ff44, 0x4444ff];

export function createVanishingLines({ opacity = 0.6, backExtent = 1.5 } = {}) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    const cubes = [];
    const edges = []; // { line, cube, localStart, localEnd }

    function addCube(cube) {
        const s = cube.userData.size / 2;
        cubes.push(cube);
        for (let axis = 0; axis < 3; axis++) {
            const [a, b] = [(axis + 1) % 3, (axis + 2) % 3];
            for (const sa of [s, -s]) {
                for (const sb of [s, -s]) {
                    const localStart = new THREE.Vector3(); localStart.setComponent(axis, s);  localStart.setComponent(a, sa); localStart.setComponent(b, sb);
                    const localEnd = localStart.clone().setComponent(axis, -s);
                    const geo = new THREE.BufferGeometry();
                    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
                    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: AXIS_COLORS[axis], transparent: true, opacity }));
                    edges.push({ line, cube, localStart, localEnd });
                    group.add(line);
                }
            }
        }
    }

    // Call after cubes move or rotate (also runs automatically when the eye moves)
    function update() {
        cubes.forEach(c => c.updateMatrixWorld(true));
        edges.forEach(({ line, cube, localStart, localEnd }) => {
            const startPoint = localStart.clone().applyMatrix4(cube.matrixWorld);
            const endPoint = localEnd.clone().applyMatrix4(cube.matrixWorld);
            const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
            const centerOfEdge = startPoint.clone().add(endPoint).multiplyScalar(0.5);
            const vectorFromCamera = centerOfEdge.clone().sub(cameraPerspective.position);

            // Always extend away from the eye
            if (direction.dot(vectorFromCamera) < 0) direction.negate();

            const lineStart = centerOfEdge.clone().addScaledVector(direction, -backExtent);
            const lineEnd = centerOfEdge.clone().addScaledVector(direction, 100);

            const linePos = line.geometry.attributes.position;
            linePos.setXYZ(0, lineStart.x, lineStart.y, lineStart.z);
            linePos.setXYZ(1, lineEnd.x, lineEnd.y, lineEnd.z);
            linePos.needsUpdate = true;
        });
    }

    onCameraMoved(update);
    return { group, addCube, update };
}

// Wires #wireframe-toggle and #vanishing-lines-toggle (the apparatus toggles are wired in Apparatus.js)
export function wireCubeToggles(cubes, vanishingLines) {
    document.getElementById('wireframe-toggle').addEventListener('change', e => setWireframe(cubes, e.target.checked));
    document.getElementById('vanishing-lines-toggle').addEventListener('change', e => vanishingLines.group.visible = e.target.checked);
}
