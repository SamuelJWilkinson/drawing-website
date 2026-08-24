import { scene, cameraPerspective } from './PerspectiveEngine.js';

// ==========================================
// THE PERSPECTIVE APPARATUS
// ==========================================

// 1. The Eye (Station Point)
const spGeometry = new THREE.SphereGeometry(0.15, 16, 16);
export const stationPointMarker = new THREE.Mesh(spGeometry, new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
stationPointMarker.position.copy(cameraPerspective.position);
scene.add(stationPointMarker);

// 2. Line of Sight
const losPoints = [cameraPerspective.position, new THREE.Vector3(0, 0, 0)];
export const lineOfSight = new THREE.Line(new THREE.BufferGeometry().setFromPoints(losPoints), new THREE.LineDashedMaterial({ color: 0xffaa00, dashSize: 0.2, gapSize: 0.1 }));
lineOfSight.computeLineDistances(); 
scene.add(lineOfSight);

// 3. Picture Plane (The Glass)
export const picturePlane = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 0.02), new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 }));
const ppEdges = new THREE.LineSegments(new THREE.EdgesGeometry(picturePlane.geometry), new THREE.LineBasicMaterial({ color: 0x44aaff, linewidth: 2 }));
picturePlane.add(ppEdges);
picturePlane.position.set(0, 0, 2.5);
scene.add(picturePlane);

// 4. Horizon Line
export const horizonLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-100, 0, 0), new THREE.Vector3(100, 0, 0)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
horizonLine.position.y = cameraPerspective.position.y;
horizonLine.visible = false;
scene.add(horizonLine);

// 5. Cones of Vision
function createCone(angle, color) {
    const len = 15;
    const radius = len * Math.tan((angle / 2) * (Math.PI / 180));
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, len, 32, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = -len / 2; 
    const group = new THREE.Group();
    group.add(mesh);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })));
    return group;
}
export const cone60 = createCone(60, 0x00ffaa);
export const cone90 = createCone(90, 0xff4444);
cone60.position.z = 5; cone90.position.z = 5;
cone60.visible = false; cone90.visible = false;
scene.add(cone60, cone90);

// ==========================================
// APPARATUS UI CONTROLS
// (We check if the buttons exist first, making this safe to use on any tool)
// ==========================================

const hlToggle = document.getElementById('horizon-toggle');
if (hlToggle) hlToggle.addEventListener('change', e => horizonLine.visible = e.target.checked);

const c60Toggle = document.getElementById('cov-60-toggle');
if (c60Toggle) c60Toggle.addEventListener('change', e => cone60.visible = e.target.checked);

const c90Toggle = document.getElementById('cov-90-toggle');
if (c90Toggle) c90Toggle.addEventListener('change', e => cone90.visible = e.target.checked);

const ppSlider = document.getElementById('pp-slider');
if (ppSlider) {
    ppSlider.addEventListener('input', e => {
        const newZ = parseFloat(e.target.value);
        picturePlane.position.z = newZ;
        const dist = cameraPerspective.position.z - newZ;
        if (dist > 0.1) {
            cameraPerspective.zoom = dist / 2.5;
            cameraPerspective.updateProjectionMatrix(); 
        }
    });
}

const spSlider = document.getElementById('sp-slider');
if (spSlider) {
    spSlider.addEventListener('input', e => {
        const newZ = parseFloat(e.target.value);
        cameraPerspective.position.z = newZ;
        stationPointMarker.position.z = newZ;
        lineOfSight.geometry.attributes.position.array[2] = newZ;
        lineOfSight.geometry.attributes.position.needsUpdate = true;
        lineOfSight.computeLineDistances();
        cone60.position.z = newZ; cone90.position.z = newZ;
        
        const dist = newZ - picturePlane.position.z;
        if (dist > 0.1) {
            cameraPerspective.zoom = dist / 2.5;
            cameraPerspective.updateProjectionMatrix();
        }
    });
}