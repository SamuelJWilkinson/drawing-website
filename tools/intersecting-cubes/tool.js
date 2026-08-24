import { scene, cameraPerspective, cameraTop, cameraMeta, rendererPerspective, rendererTop, rendererMeta } from '../../js-core/PerspectiveEngine.js';
import { stationPointMarker, lineOfSight, picturePlane, horizonLine, cone60, cone90 } from '../../js-core/Apparatus.js';

// ==========================================
// 1. THE CUBES
// ==========================================
// Let's make Cube 1 "Warm" colors and Cube 2 "Cool" colors so they are distinct
const warmColors = [0xff4444, 0xff8844, 0xffcc44, 0xff4488, 0xffaa44, 0xff6666];
const coolColors = [0x4444ff, 0x44aaff, 0x44ffff, 0x8844ff, 0x44ffaa, 0x6666ff];

function createCube(size, colorArray) {
    const geo = new THREE.BoxGeometry(size, size, size);
    const mats = colorArray.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }));
    const cube = new THREE.Mesh(geo, mats);
    cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })));
    scene.add(cube);
    return cube;
}

const cube1 = createCube(1.5, warmColors); // Main block
const cube2 = createCube(1.0, coolColors); // Smaller intersecting block
const cubes = [cube1, cube2]; // Array to easily loop through them

// ==========================================
// 2. VANISHING LINES (For BOTH cubes)
// ==========================================
const vanishingLinesGroup = new THREE.Group();
scene.add(vanishingLinesGroup);
vanishingLinesGroup.visible = false; 

const edgeLines = [];

// Helper function to attach 12 lines to a specific cube
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
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: edgeData[2], transparent: true, opacity: 0.6 }));
        // Save which cube this line belongs to, plus its local coordinates
        line.userData = { parentCube: targetCube, localStart: edgeData[0], localEnd: edgeData[1] };
        edgeLines.push(line);
        vanishingLinesGroup.add(line);
    });
}

attachLinesToCube(cube1, 1.5);
attachLinesToCube(cube2, 1.0);

function updateVanishingLines() {
    cube1.updateMatrixWorld(true);
    cube2.updateMatrixWorld(true);
    
    edgeLines.forEach(line => {
        const c = line.userData.parentCube;
        const startPoint = line.userData.localStart.clone().applyMatrix4(c.matrixWorld);
        const endPoint = line.userData.localEnd.clone().applyMatrix4(c.matrixWorld);
        
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
// 3. UI CONTROLS
// ==========================================
function randomizeCubes() {
    const mode3pt = document.getElementById('mode-3pt').checked;
    const mode2pt = document.getElementById('mode-2pt').checked;
    const mode1pt = document.getElementById('mode-1pt').checked;

    cubes.forEach((c, index) => {
        if (mode3pt) {
            c.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
        } else if (mode2pt) {
            c.rotation.set(0, Math.random() * Math.PI * 2, 0);
        } else if (mode1pt) {
            c.rotation.set(0, 0, 0); 
        }
        
        // Positioning: Keep cube1 near center, make cube2 overlap it
        if (index === 0) {
            c.position.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0);
        } else {
            // Offset cube2 slightly from cube1 to guarantee an intersection
            c.position.set(
                cube1.position.x + (Math.random() - 0.5) * 1.5,
                cube1.position.y + (Math.random() - 0.5) * 1.5,
                cube1.position.z + (Math.random() - 0.5) * 1.5
            );
        }
    });

    updateVanishingLines();
}

document.addEventListener('DOMContentLoaded', randomizeCubes);
document.getElementById('generate-btn').addEventListener('click', randomizeCubes);
document.querySelectorAll('input[name="perspective-mode"]').forEach(r => r.addEventListener('change', randomizeCubes));

document.getElementById('wireframe-toggle').addEventListener('change', (e) => {
    cubes.forEach(c => c.material.forEach(mat => mat.visible = !e.target.checked));
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