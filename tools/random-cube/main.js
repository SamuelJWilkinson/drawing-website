// 1. Setup the Shared Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('#222222');

// ==========================================
// RENDERER 1: THE VIEWER PERSPECTIVE (LEFT)
// ==========================================
// Updated aspect ratio to match the new 820x500 canvas
const cameraPerspective = new THREE.PerspectiveCamera(45, 820 / 500, 0.1, 1000); 
cameraPerspective.position.z = 5;

const rendererPerspective = new THREE.WebGLRenderer({ antialias: true });
// Updated renderer size
rendererPerspective.setSize(820, 500); 
document.getElementById('perspective-container').appendChild(rendererPerspective.domElement);

// ==========================================
// RENDERER 2: THE TOP PLAN VIEW (RIGHT)
// ==========================================
// Increased viewSize from 2.5 to 4 to capture a larger area
const viewSize = 4; 
const cameraTop = new THREE.OrthographicCamera(-viewSize, viewSize, viewSize, -viewSize, 0.1, 100);

// Move the camera to z = 2.5 (halfway between the cube at 0 and the eye at 5)
cameraTop.position.set(0, 10, 2.5); 

// Tell the camera to look straight down at that new halfway point
cameraTop.lookAt(0, 0, 2.5);        

const rendererTop = new THREE.WebGLRenderer({ antialias: true });
rendererTop.setSize(400, 400);
document.getElementById('top-container').appendChild(rendererTop.domElement);

// ==========================================
// RENDERER 3: THE META 3D VIEW (RIGHT)
// ==========================================
const cameraMeta = new THREE.PerspectiveCamera(45, 400 / 400, 0.1, 1000);

// Position it "over the right shoulder" of the Station Point
// SP is at (0, 0, 5). We will put this camera to the right (x=8), up (y=6), and further back (z=10).
cameraMeta.position.set(12, 4, 12); 

// Tell it to look at the Picture Plane
cameraMeta.lookAt(0, 0, 2.5);

const rendererMeta = new THREE.WebGLRenderer({ antialias: true });
rendererMeta.setSize(400, 400);
document.getElementById('meta-container').appendChild(rendererMeta.domElement);

// ==========================================
// THE CONE OF VISION
// ==========================================

// Helper function to create a cone that originates from a specific point
// Helper function to create a cone that originates from a specific point
function createConeOfVision(angleInDegrees, colorHex) {
    const coneLength = 15;
    const angleInRadians = (angleInDegrees / 2) * (Math.PI / 180);
    const coneRadius = coneLength * Math.tan(angleInRadians);

    const coneGeo = new THREE.ConeGeometry(coneRadius, coneLength, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ 
        color: colorHex, 
        transparent: true, 
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    
    // FIX 1: Rotate forward 90 degrees (positive Math.PI / 2) so it points down the -Z axis
    coneMesh.rotation.x = Math.PI / 2;
    
    const coneGroup = new THREE.Group();
    
    // FIX 2: Because the cone is drawn from its center, we must push it forward 
    // by half its length so the very TIP sits exactly at the Group's origin (0,0,0).
    // In Three.js, "forward" towards the scene is negative Z.
    coneMesh.position.z = -coneLength / 2; 
    
    coneGroup.add(coneMesh);
    
    const coneEdges = new THREE.EdgesGeometry(coneGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 1, transparent: true, opacity: 0.5 });
    const coneLines = new THREE.LineSegments(coneEdges, edgeMat);
    coneMesh.add(coneLines);

    return coneGroup;
}

// Create the 60 degree cone (Green) and 90 degree cone (Red)
const cone60 = createConeOfVision(60, 0x00ffaa);
const cone90 = createConeOfVision(90, 0xff4444);

// Position both cones at the starting Station Point (Z=5)
cone60.position.z = 5;
cone90.position.z = 5;

// Hide them by default
cone60.visible = false;
cone90.visible = false;

scene.add(cone60);
scene.add(cone90);

// ==========================================
// SCENE GEOMETRY (THE CUBE)
// ==========================================
const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);

// Create an array of 6 distinct colors for the 6 faces
// (Right, Left, Top, Bottom, Front, Back)
const faceColors = [
    0xff4444, // Red
    0x44ff44, // Green
    0x4444ff, // Blue
    0xffff44, // Yellow
    0x44ffff, // Cyan
    0xff44ff  // Magenta
];

// Map those colors to 6 separate basic materials
const materials = faceColors.map(color => new THREE.MeshBasicMaterial({ 
    color: color,
    transparent: true,
    opacity: 0.9 // Slight transparency helps when overlapping forms
}));

// Apply the array of materials to the cube
const cube = new THREE.Mesh(geometry, materials);

const edges = new THREE.EdgesGeometry(geometry);
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
const cubeEdges = new THREE.LineSegments(edges, lineMaterial);
cube.add(cubeEdges); 

scene.add(cube);

// ==========================================
// THE PERSPECTIVE APPARATUS (STATION POINT)
// ==========================================

// 1. Create the Station Point (The Eye)
const spGeometry = new THREE.SphereGeometry(0.15, 16, 16);
const spMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); // Bright orange
const stationPointMarker = new THREE.Mesh(spGeometry, spMaterial);

// Place the marker EXACTLY where the perspective camera is located
stationPointMarker.position.copy(cameraPerspective.position);
scene.add(stationPointMarker);

// 2. Create the Line of Sight (Center of Vision)
// This is a dashed line shooting straight out from the Eye to the origin (0,0,0)
const losPoints = [];
losPoints.push(cameraPerspective.position); // Start at the eye
losPoints.push(new THREE.Vector3(0, 0, 0)); // End at the center of the world

const losGeometry = new THREE.BufferGeometry().setFromPoints(losPoints);
const losMaterial = new THREE.LineDashedMaterial({ 
    color: 0xffaa00, 
    linewidth: 1, 
    scale: 1, 
    dashSize: 0.2, 
    gapSize: 0.1 
});

const lineOfSight = new THREE.Line(losGeometry, losMaterial);
// Required for dashed lines to render correctly in Three.js
lineOfSight.computeLineDistances(); 
scene.add(lineOfSight);

// 3. Create the Picture Plane (The Glass)
// We make it 6 units wide, 4 units high, and 0.02 units thick.
const ppGeometry = new THREE.BoxGeometry(6, 4, 0.02);
const ppMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x88ccff, 
    transparent: true, 
    opacity: 0.3 
});
const picturePlane = new THREE.Mesh(ppGeometry, ppMaterial);

// Add a bright blue outline so its top edge is clearly visible from above
const ppEdges = new THREE.EdgesGeometry(ppGeometry);
const ppLineMaterial = new THREE.LineBasicMaterial({ color: 0x44aaff, linewidth: 2 });
const picturePlaneEdges = new THREE.LineSegments(ppEdges, ppLineMaterial);
picturePlane.add(picturePlaneEdges);

const ppDistanceSlider = document.getElementById('pp-slider');
picturePlane.position.set(0, 0, parseFloat(ppDistanceSlider.value));

scene.add(picturePlane);

// 4. Create the Horizon Line
// We make a line that stretches extremely far left and right (from -100 to 100)
const hlPoints = [];
hlPoints.push(new THREE.Vector3(-100, 0, 0)); 
hlPoints.push(new THREE.Vector3(100, 0, 0));

const hlGeometry = new THREE.BufferGeometry().setFromPoints(hlPoints);
const hlMaterial = new THREE.LineBasicMaterial({ 
    color: 0xffffff, // White
    transparent: true,
    opacity: 0.5     // Semi-transparent so it's not distracting
});
const horizonLine = new THREE.Line(hlGeometry, hlMaterial);

// The horizon line must sit at the exact Y-height of the camera
horizonLine.position.y = cameraPerspective.position.y;
scene.add(horizonLine);

// ==========================================
// VANISHING LINES (CONSTRUCTION LINES)
// ==========================================
const vanishingLinesGroup = new THREE.Group();
scene.add(vanishingLinesGroup);
vanishingLinesGroup.visible = false; // Hidden by default

const edgeLines = [];

// The cube is 1.5 units wide, so its corners are at +/- 0.75 from its center
const s = 0.75; 

// We define the 12 edges locally. 
// Format: [Start Point, End Point, Hex Color]
// Red = X-axis (Width), Green = Y-axis (Height), Blue = Z-axis (Depth)
const localEdges = [
    // Group 1: X-Axis / Width (RED)
    [new THREE.Vector3(s, s, s), new THREE.Vector3(-s, s, s), 0xff4444],
    [new THREE.Vector3(s, -s, s), new THREE.Vector3(-s, -s, s), 0xff4444],
    [new THREE.Vector3(s, s, -s), new THREE.Vector3(-s, s, -s), 0xff4444],
    [new THREE.Vector3(s, -s, -s), new THREE.Vector3(-s, -s, -s), 0xff4444],
    
    // Group 2: Y-Axis / Height (GREEN)
    [new THREE.Vector3(s, s, s), new THREE.Vector3(s, -s, s), 0x44ff44],
    [new THREE.Vector3(-s, s, s), new THREE.Vector3(-s, -s, s), 0x44ff44],
    [new THREE.Vector3(s, s, -s), new THREE.Vector3(s, -s, -s), 0x44ff44],
    [new THREE.Vector3(-s, s, -s), new THREE.Vector3(-s, -s, -s), 0x44ff44],
    
    // Group 3: Z-Axis / Depth (BLUE)
    [new THREE.Vector3(s, s, s), new THREE.Vector3(s, s, -s), 0x4444ff],
    [new THREE.Vector3(-s, s, s), new THREE.Vector3(-s, s, -s), 0x4444ff],
    [new THREE.Vector3(s, -s, s), new THREE.Vector3(s, -s, -s), 0x4444ff],
    [new THREE.Vector3(-s, -s, s), new THREE.Vector3(-s, -s, -s), 0x4444ff]
];

// Create the 12 lines using our predefined colors
localEdges.forEach((edgeData) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    
    const mat = new THREE.LineBasicMaterial({ 
        color: edgeData[2], 
        transparent: true, 
        opacity: 0.6 // Slightly brighter so the colors pop
    });
    
    const line = new THREE.Line(geo, mat);
    
    // We store the local points inside the line object so we can reference them later
    line.userData = { localStart: edgeData[0], localEnd: edgeData[1] };
    
    edgeLines.push(line);
    vanishingLinesGroup.add(line);
});

// This function calculates where the long lines should be drawn
function updateVanishingLines() {
    // Force Three.js to calculate the cube's exact rotation/position this frame
    cube.updateMatrixWorld(true);

    edgeLines.forEach(line => {
        // 1. Convert the local corners into current world space coordinates
        const startPoint = line.userData.localStart.clone().applyMatrix4(cube.matrixWorld);
        const endPoint = line.userData.localEnd.clone().applyMatrix4(cube.matrixWorld);
        
        // 2. Find the mathematical direction of this specific edge
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
        
        // 3. Find the center of the edge, and the direction from the camera to that center
        const centerOfEdge = startPoint.clone().add(endPoint).multiplyScalar(0.5);
        const vectorFromCamera = centerOfEdge.clone().sub(cameraPerspective.position);
        
        // 4. THE MAGIC: If the line's direction points TOWARDS the camera (diverging),
        // we use a Dot Product to detect it, and multiply it by -1 to flip it around (converging).
        if (direction.dot(vectorFromCamera) < 0) {
            direction.negate();
        }
        
        // 5. Draw the line! Pull it backwards just a tiny bit (-1.5) to cover the 
        // cube's physical edge, then shoot it massively forward (100) to the vanishing point.
        const lineStart = centerOfEdge.clone().addScaledVector(direction, -1.5); 
        const lineEnd = centerOfEdge.clone().addScaledVector(direction, 100);
        
        const linePos = line.geometry.attributes.position;
        linePos.setXYZ(0, lineStart.x, lineStart.y, lineStart.z);
        linePos.setXYZ(1, lineEnd.x, lineEnd.y, lineEnd.z);
        linePos.needsUpdate = true;
    });
}

// ==========================================
// CONTROLS & ANIMATION
// ==========================================
function randomizeCube() {
    // 1. Check which perspective mode is currently selected
    const mode3pt = document.getElementById('mode-3pt').checked;
    const mode2pt = document.getElementById('mode-2pt').checked;
    const mode1pt = document.getElementById('mode-1pt').checked;

    if (mode3pt) {
        // 3-Point: Full random rotation on all axes
        cube.rotation.x = Math.random() * Math.PI * 2;
        cube.rotation.y = Math.random() * Math.PI * 2;
        cube.rotation.z = Math.random() * Math.PI * 2;
    } 
    else if (mode2pt) {
        // 2-Point: Pitch (x) and Roll (z) are locked to 0 (flat on ground)
        // Yaw (y) is randomized to spin it
        cube.rotation.x = 0;
        cube.rotation.y = Math.random() * Math.PI * 2;
        cube.rotation.z = 0;
    } 
    else if (mode1pt) {
        // 1-Point: Pitch (x) and Roll (z) are locked to 0. 
        // Yaw (y) is locked to 0, ensuring a flat face points straight at the camera.
        // We randomize the POSITION slightly instead so it isn't dead center
        cube.rotation.set(0, 0, 0); 
        
        // Randomly shift the cube slightly left/right and up/down
        cube.position.x = (Math.random() - 0.5) * 3; // Shift between -1.5 and 1.5
        cube.position.y = (Math.random() - 0.5) * 3;
    }

    // Ensure 2pt and 3pt modes keep the cube in the center
    if (!mode1pt) {
        cube.position.set(0, 0, 0);
    }

    updateVanishingLines();
}

// Generate button listener
document.addEventListener('DOMContentLoaded', () => {
    randomizeCube();
});
document.getElementById('generate-btn').addEventListener('click', randomizeCube);

// Add event listeners to the radio buttons so they instantly apply their constraints when clicked
document.querySelectorAll('input[name="perspective-mode"]').forEach(radio => {
    radio.addEventListener('change', randomizeCube);
});

const wireframeToggle = document.getElementById('wireframe-toggle');
wireframeToggle.addEventListener('change', (event) => {
    const isSolidVisible = !event.target.checked;
    
    // Loop through all 6 face materials and hide/show them
    cube.material.forEach(mat => {
        mat.visible = isSolidVisible;
    });
});

document.getElementById('vanishing-lines-toggle').addEventListener('change', (e) => {
    vanishingLinesGroup.visible = e.target.checked;
});

const horizonToggle = document.getElementById('horizon-toggle');
// Set the line to invisible by default
horizonLine.visible = false; 

horizonToggle.addEventListener('change', (event) => {
    horizonLine.visible = event.target.checked;
});

document.getElementById('cov-60-toggle').addEventListener('change', (e) => {
    cone60.visible = e.target.checked;
});
document.getElementById('cov-90-toggle').addEventListener('change', (e) => {
    cone90.visible = e.target.checked;
});

ppDistanceSlider.addEventListener('input', (event) => {
    const newZ = parseFloat(event.target.value);
    picturePlane.position.z = newZ;
    
    // Calculate distance using the ACTUAL camera position, not a hardcoded 5
    const distanceToEye = cameraPerspective.position.z - newZ;
    
    // Prevent the math from breaking if the glass passes behind the eye
    if (distanceToEye > 0.1) {
        cameraPerspective.zoom = distanceToEye / 2.5;
        cameraPerspective.updateProjectionMatrix(); 
    }
});

// --- NEW STATION POINT SLIDER ---
const spDistanceSlider = document.getElementById('sp-slider');
spDistanceSlider.addEventListener('input', (event) => {
    const newSPZ = parseFloat(event.target.value);
    
    // 1. Move the actual Perspective Camera
    cameraPerspective.position.z = newSPZ;
    
    // 2. Move the orange marker in our diagnostic views
    stationPointMarker.position.z = newSPZ;
    
    // 3. Update the start-point of the dashed Line of Sight
    const positions = lineOfSight.geometry.attributes.position.array;
    positions[2] = newSPZ; // Update the Z coordinate of the first point
    lineOfSight.geometry.attributes.position.needsUpdate = true;
    lineOfSight.computeLineDistances(); // Recalculate dashes

    // NEW: Move the cones to follow the eye!
    cone60.position.z = newSPZ;
    cone90.position.z = newSPZ;
    
    // 4. Moving the eye also changes its distance to the glass!
    // We must recalculate the zoom to keep the scale accurate.
    const currentPPZ = picturePlane.position.z;
    const distanceToEye = newSPZ - currentPPZ;
    
    if (distanceToEye > 0.1) {
        cameraPerspective.zoom = distanceToEye / 2.5;
        cameraPerspective.updateProjectionMatrix();
    }
});

// The Animation Loop
function animate() {
    requestAnimationFrame(animate);
    cameraMeta.lookAt(picturePlane.position);
    
    // --- LAYER MANAGEMENT ---
    
    // 1. View 1 (Drawing): Hide Apparatus (But let Cones stay visible if checked!)
    stationPointMarker.visible = false;
    lineOfSight.visible = false;
    picturePlane.visible = false;

    rendererPerspective.render(scene, cameraPerspective);
    
    // 2. View 2 & 3 (Diagrams): Show Apparatus
    stationPointMarker.visible = true;
    lineOfSight.visible = true;
    picturePlane.visible = true;
    
    // Save the state of the lines, then hide them from the diagrams
    const hlState = horizonLine.visible; 
    const vlState = vanishingLinesGroup.visible; 
    horizonLine.visible = false;         
    vanishingLinesGroup.visible = false;         
    
    // Render the diagrams
    rendererTop.render(scene, cameraTop);
    rendererMeta.render(scene, cameraMeta); 
    
    // Restore the lines for the main drawing view on the next frame
    horizonLine.visible = hlState;       
    vanishingLinesGroup.visible = vlState;       
}
animate();