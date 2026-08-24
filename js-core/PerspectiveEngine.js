// ==========================================
// THE PERSPECTIVE ENGINE
// Sets up the shared scene and the three cameras/renderers
// ==========================================

export const scene = new THREE.Scene();
scene.background = new THREE.Color('#222222');

// 1. Drawing View (Left)
export const cameraPerspective = new THREE.PerspectiveCamera(45, 820 / 500, 0.1, 1000); 
cameraPerspective.position.z = 5;
export const rendererPerspective = new THREE.WebGLRenderer({ antialias: true });
rendererPerspective.setSize(820, 500); 
document.getElementById('perspective-container').appendChild(rendererPerspective.domElement);

// 2. Top Plan View (Right)
export const cameraTop = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
cameraTop.position.set(0, 10, 2.5); 
cameraTop.lookAt(0, 0, 2.5);        
export const rendererTop = new THREE.WebGLRenderer({ antialias: true });
rendererTop.setSize(400, 400);
document.getElementById('top-container').appendChild(rendererTop.domElement);

// 3. Meta 3D View (Right)
export const cameraMeta = new THREE.PerspectiveCamera(45, 400 / 400, 0.1, 1000);
cameraMeta.position.set(12, 4, 12); 
cameraMeta.lookAt(0, 0, 2.5);
export const rendererMeta = new THREE.WebGLRenderer({ antialias: true });
rendererMeta.setSize(400, 400);
document.getElementById('meta-container').appendChild(rendererMeta.domElement);