import { cameraPerspective, rendererPerspective } from './PerspectiveEngine.js';

// ==========================================
// CUBE ON SCREEN
// Shared by the inspectors that draw on top of the Drawing View:
// where a cube point lands in pixels, and which faces / edges face the eye.
// A "vertex" here is { cube, local } where local is the corner's position in the cube's own space.
// ==========================================

// Size of the Drawing View in CSS pixels
export function viewSize() {
    const ratio = rendererPerspective.getPixelRatio();
    return { width: rendererPerspective.domElement.width / ratio, height: rendererPerspective.domElement.height / ratio };
}

// A point in a cube's own space -> pixel position in the Drawing View
export function toPixels(localPoint, cube) {
    const { width, height } = viewSize();
    const p = localPoint.clone().applyMatrix4(cube.matrixWorld).project(cameraPerspective);
    return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height };
}

// Does the face on this axis (at the corner's sign) face the eye?
export function faceVisible(vertex, axis) {
    const { cube, local } = vertex;
    const sign = Math.sign(local.getComponent(axis));
    const faceCentre = new THREE.Vector3().setComponent(axis, sign * cube.userData.size / 2).applyMatrix4(cube.matrixWorld);
    const normal = new THREE.Vector3().setComponent(axis, sign).transformDirection(cube.matrixWorld);
    return normal.dot(cameraPerspective.position.clone().sub(faceCentre)) > 0;
}

// The edge along `axis` borders the faces on the other two axes
export function edgeVisible(vertex, axis) {
    return [0, 1, 2].some(a => a !== axis && faceVisible(vertex, a));
}
