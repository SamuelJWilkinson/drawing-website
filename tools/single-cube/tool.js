// Import our shared engine and apparatus!
import { scene, cameraPerspective, cameraTop, cameraMeta, rendererPerspective, rendererTop, rendererMeta } from '../../js-core/PerspectiveEngine.js';
import { stationPointMarker, lineOfSight, picturePlane, horizonLine, cone60, cone90 } from '../../js-core/Apparatus.js';

// ==========================================
// 1. THE CUBE
// ==========================================
const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const faceColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0x44ffff, 0xff44ff];
const materials = faceColors.map(color => new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 }));
const cube = new THREE.Mesh(geometry, materials);
cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })));
scene.add(cube);

// ==========================================
// 2. VANISHING LINES
// ==========================================
const vanishingLinesGroup = new THREE.Group();
scene.add(vanishingLinesGroup);
vanishingLinesGroup.visible = false; 

const edgeLines = [];
const s = 0.75; 
const localEdges = [
    [new THREE.Vector3(s, s, s), new THREE.Vector3(-s, s, s), 0xff4444],
    [new THREE.Vector3(s, -s, s), new THREE.Vector3(-s, -s, s), 0xff4444],
    [new THREE.Vector3(s, s, -s), new THREE.Vector3(-s, s, -s), 0xff4444],
    [new THREE.Vector3(s, -s, -s), new THREE.Vector3(-s, -s, -s), 0xff4444],
    [new THREE.Vector3(s, s, s), new THREE.Vector3(s, -s, s), 0x44ff44],
    [new THREE.Vector3(-s, s, s), new THREE.Vector3(-s, -s, s), 0x44ff44],
    [new THREE.Vector3(s, s, -s), new THREE.Vector3(s, -s, -s), 0x44ff44],
    [new THREE.Vector3(-s, s, -s), new THREE.Vector3(-s, -s, -s), 0x44ff44],
    [new THREE.Vector3(s, s, s), new THREE.Vector3(s, s, -s), 0x4444ff],
    [new THREE.Vector3(-s, s, s), new THREE.Vector3(-s, s, -s), 0x4444ff],
    [new THREE.Vector3(s, -s, s), new THREE.Vector3(s, -s, -s), 0x4444ff],
    [new THREE.Vector3(-s, -s, s), new THREE.Vector3(-s, -s, -s), 0x4444ff]
];

localEdges.forEach((edgeData) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: edgeData[2], transparent: true, opacity: 0.6 }));
    line.userData = { localStart: edgeData[0], localEnd: edgeData[1] };
    edgeLines.push(line);
    vanishingLinesGroup.add(line);
});

function updateVanishingLines() {
    cube.updateMatrixWorld(true);
    edgeLines.forEach(line => {
        const startPoint = line.userData.localStart.clone().applyMatrix4(cube.matrixWorld);
        const endPoint = line.userData.localEnd.clone().applyMatrix4(cube.matrixWorld);
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
        const centerOfEdge = startPoint.clone().add(endPoint).multiplyScalar(0.5);
        const vectorFromCamera = centerOfEdge.clone().sub(cameraPerspective.position);
        
        if (direction.dot(vectorFromCamera) < 0) direction.negate();
        
        const lineStart = centerOfEdge.clone().addScaledVector(direction, -1.5); 
        const lineEnd = centerOfEdge.clone().addScaledVector(direction, 100);
        
        const linePos = line.geometry.attributes.position;
        linePos.setXYZ(0, lineStart.x, lineStart.y, lineStart.z);
        linePos.setXYZ(1, lineEnd.x, lineEnd.y, lineEnd.z);
        linePos.needsUpdate = true;
    });
}

// ==========================================
// 3. CUBE UI CONTROLS
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
    updateVanishingLines();
}

document.addEventListener('DOMContentLoaded', randomizeCube);
document.getElementById('generate-btn').addEventListener('click', randomizeCube);
document.querySelectorAll('input[name="perspective-mode"]').forEach(radio => radio.addEventListener('change', randomizeCube));

document.getElementById('wireframe-toggle').addEventListener('change', (e) => {
    cube.material.forEach(mat => mat.visible = !e.target.checked);
});
document.getElementById('vanishing-lines-toggle').addEventListener('change', (e) => {
    vanishingLinesGroup.visible = e.target.checked;
});

// ==========================================
// 4. ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    cameraMeta.lookAt(picturePlane.position);
    
    // Hide apparatus for drawing view
    stationPointMarker.visible = false;
    lineOfSight.visible = false;
    picturePlane.visible = false;
    rendererPerspective.render(scene, cameraPerspective);
    
    // Show apparatus for diagram views
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