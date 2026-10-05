import { scene, cameraPerspective, cameraTop, cameraMeta, rendererPerspective, rendererTop, rendererMeta } from '../../js-core/PerspectiveEngine.js';
import { stationPointMarker, lineOfSight, picturePlane, horizonLine, cone60, cone90 } from '../../js-core/Apparatus.js';

// Move the initial camera back slightly so the whole grid fits in view
cameraPerspective.position.z = 7;
stationPointMarker.position.z = 7;

// ==========================================
// 1. GENERATE THE 3x3 CUBE GRID
// ==========================================
const cubes = [];
const vanishingLinesGroup = new THREE.Group();
scene.add(vanishingLinesGroup);
vanishingLinesGroup.visible = false; 
const edgeLines = [];

const faceColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0x44ffff, 0xff44ff];
const materials = faceColors.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 }));

// Helper to attach vanishing lines to each cube
function attachLinesToCube(targetCube, size) {
    const s = size / 2; 
    const localEdges = [
        [new THREE.Vector3(s, s, s), new THREE.Vector3(-s, s, s), 0xff4444], [new THREE.Vector3(s, -s, s), new THREE.Vector3(-s, -s, s), 0xff4444],
        [new THREE.Vector3(s, s, -s), new THREE.Vector3(-s, s, -s), 0xff4444], [new THREE.Vector3(s, -s, -s), new THREE.Vector3(-s, -s, -s), 0xff4444],
        [new THREE.Vector3(s, s, s), new THREE.Vector3(s, -s, s), 0x44ff44], [new THREE.Vector3(-s, s, s), new THREE.Vector3(-s, -s, s), 0x44ff44],
        [new THREE.Vector3(s, s, -s), new THREE.Vector3(s, -s, -s), 0x44ff44], [new THREE.Vector3(-s, s, -s), new THREE.Vector3(-s, -s, -s), 0x44ff44],
        [new THREE.Vector3(s, s, s), new THREE.Vector3(s, s, -s), 0x4444ff], [new THREE.Vector3(-s, s, s), new THREE.Vector3(-s, s, -s), 0x4444ff],
        [new THREE.Vector3(s, -s, s), new THREE.Vector3(s, -s, -s), 0x4444ff], [new THREE.Vector3(-s, -s, s), new THREE.Vector3(-s, -s, -s), 0x4444ff]
    ];

    localEdges.forEach((edgeData) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: edgeData[2], transparent: true, opacity: 0.3 })); // Lower opacity for density
        line.userData = { parentCube: targetCube, localStart: edgeData[0], localEnd: edgeData[1] };
        edgeLines.push(line);
        vanishingLinesGroup.add(line);
    });
}

// Create 9 cubes in a 3x3 grid
const spacing = 2.5; // Distance between cubes
for (let i = 0; i < 9; i++) {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
    cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })));
    
    // Math to arrange them in a 3x3 grid centered around (0,0,0)
    const col = i % 3;
    const row = Math.floor(i / 3);
    cube.position.set((col - 1) * spacing, 0, (row - 1) * spacing);
    
    cubes.push(cube);
    scene.add(cube);
    attachLinesToCube(cube, 1);
}

// ==========================================
// 2. APPLY ANGLES & VANISHING LINES
// ==========================================
function updateVanishingLines() {
    cubes.forEach(c => c.updateMatrixWorld(true));
    edgeLines.forEach(line => {
        const c = line.userData.parentCube;
        const startPoint = line.userData.localStart.clone().applyMatrix4(c.matrixWorld);
        const endPoint = line.userData.localEnd.clone().applyMatrix4(c.matrixWorld);
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
        const centerOfEdge = startPoint.clone().add(endPoint).multiplyScalar(0.5);
        const vectorFromCamera = centerOfEdge.clone().sub(cameraPerspective.position);
        
        if (direction.dot(vectorFromCamera) < 0) direction.negate();
        
        const lineStart = centerOfEdge.clone().addScaledVector(direction, -1); 
        const lineEnd = centerOfEdge.clone().addScaledVector(direction, 100);
        
        const linePos = line.geometry.attributes.position;
        linePos.setXYZ(0, lineStart.x, lineStart.y, lineStart.z);
        linePos.setXYZ(1, lineEnd.x, lineEnd.y, lineEnd.z);
        linePos.needsUpdate = true;
    });
}

function applyAngles() {
    const is3pt = document.getElementById('mode-3pt').checked;
    
    // Common drafting angles in degrees
    const angles2pt = [10, 20, 30, 40, 45, 50, 60, 70, 80];
    
    cubes.forEach((c, i) => {
        if (is3pt) {
            // Apply standard Y rotation, but also add a forward pitch
            const yRot = THREE.MathUtils.degToRad(angles2pt[i]);
            const xRot = THREE.MathUtils.degToRad(25); // Tilt forward 25 degrees
            c.rotation.set(xRot, yRot, 0);
        } else {
            // Standard 2-point perspective rotation on the Y axis
            const yRot = THREE.MathUtils.degToRad(angles2pt[i]);
            c.rotation.set(0, yRot, 0);
        }
    });
    updateVanishingLines();
}

// ==========================================
// 3. UI WIRING
// ==========================================
document.addEventListener('DOMContentLoaded', applyAngles);
document.querySelectorAll('input[name="perspective-mode"]').forEach(r => r.addEventListener('change', applyAngles));

document.getElementById('wireframe-toggle').addEventListener('change', (e) => {
    cubes.forEach(c => c.material.forEach(mat => mat.visible = !e.target.checked));
});
document.getElementById('vanishing-lines-toggle').addEventListener('change', e => vanishingLinesGroup.visible = e.target.checked);

// ==========================================
// 4. ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    cameraMeta.lookAt(picturePlane.position);
    
    stationPointMarker.visible = false;
    lineOfSight.visible = false;
    picturePlane.visible = false;
    rendererPerspective.render(scene, cameraPerspective);
    
    stationPointMarker.visible = true;
    lineOfSight.visible = true;
    picturePlane.visible = true;
    
    const hlState = horizonLine.visible; 
    const vlState = vanishingLinesGroup.visible; 
    horizonLine.visible = false;         
    vanishingLinesGroup.visible = false;         
    
    rendererTop.render(scene, cameraTop);
    rendererMeta.render(scene, cameraMeta); 
    
    horizonLine.visible = hlState;       
    vanishingLinesGroup.visible = vlState;       
}
animate();