import { findInk, findLines } from './LineFinder.js';

// ==========================================
// 1. PAGE PARTS
// ==========================================
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_SIDE = 900;  // photos are shrunk so the longest side is this many px (keeps the search quick)
const MAX_LINES = 14;  // a cube has 9 visible edges (12 with hidden ones), plus a few spare

const stage = document.getElementById('stage');
const video = document.getElementById('camera-video');
const photoCanvas = document.getElementById('photo-canvas');
const inkCanvas = document.getElementById('ink-canvas');
const outlineLayer = document.getElementById('outline-layer');
const photoInput = document.getElementById('photo-input');
const cameraBtn = document.getElementById('camera-btn');
const captureBtn = document.getElementById('capture-btn');
const outlinesToggle = document.getElementById('outlines-toggle');
const inkToggle = document.getElementById('ink-toggle');
const sensitivitySlider = document.getElementById('sensitivity-slider');
const minLengthSlider = document.getElementById('min-length-slider');
const status = document.getElementById('status');

let stream = null;
let photo = null; // the shrunken photo's pixels, once one is loaded

// ==========================================
// 2. FINDING AND SHOWING THE LINES
// ==========================================
function analyse() {
    if (!photo) return;
    const { width, height } = photo;
    const ink = findInk(photo, Number(sensitivitySlider.value));
    const lines = findLines(ink, width, height, { minLength: Number(minLengthSlider.value), maxLines: MAX_LINES });

    // What counts as pen: painted orange over the photo
    const paint = inkCanvas.getContext('2d').createImageData(width, height);
    for (let i = 0; i < ink.length; i++) {
        if (ink[i]) { paint.data[i * 4] = 255; paint.data[i * 4 + 1] = 153; paint.data[i * 4 + 3] = 255; }
    }
    inkCanvas.getContext('2d').putImageData(paint, 0, 0);

    // The found lines
    outlineLayer.replaceChildren();
    outlineLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    lines.forEach(l => {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', 'outline-line');
        line.setAttribute('x1', l.x1); line.setAttribute('y1', l.y1);
        line.setAttribute('x2', l.x2); line.setAttribute('y2', l.y2);
        outlineLayer.append(line);
    });
    status.textContent = lines.length === 0
        ? 'No lines found. Try a higher pen sensitivity or a shorter minimum line.'
        : `Found ${lines.length} line${lines.length === 1 ? '' : 's'}. A cube shows 9 edges (up to 12 if you draw the hidden ones).`;
}

function showToggles() {
    outlineLayer.classList.toggle('hidden', !outlinesToggle.checked);
    inkCanvas.classList.toggle('hidden', !inkToggle.checked);
}

// ==========================================
// 3. GETTING A PHOTO IN
// From a file, or from the camera
// ==========================================
function loadPhoto(source, sourceWidth, sourceHeight) {
    const scale = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight));
    const width = Math.round(sourceWidth * scale), height = Math.round(sourceHeight * scale);
    photoCanvas.width = inkCanvas.width = width;
    photoCanvas.height = inkCanvas.height = height;
    const context = photoCanvas.getContext('2d');
    context.drawImage(source, 0, 0, width, height);
    photo = context.getImageData(0, 0, width, height);
    photoCanvas.classList.remove('hidden');
    showToggles();
    analyse();
}

photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    stopCamera();
    const image = new Image();
    image.onload = () => { loadPhoto(image, image.naturalWidth, image.naturalHeight); URL.revokeObjectURL(image.src); };
    image.onerror = () => { status.textContent = 'That file could not be read as a picture.'; };
    image.src = URL.createObjectURL(file);
    photoInput.value = ''; // so choosing the same file again still counts
});
document.getElementById('choose-btn').addEventListener('click', () => photoInput.click());

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = 'This browser cannot reach the camera here. Open the site from http://localhost and try again.';
        return;
    }
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } });
    } catch (err) {
        status.textContent = err.name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow the camera for this page in your browser, then try again.'
            : 'No camera could be started. Check that one is connected and not in use by another app.';
        return;
    }
    video.srcObject = stream;
    video.classList.add('visible');
    outlineLayer.classList.add('hidden');
    inkCanvas.classList.add('hidden');
    photoCanvas.classList.add('hidden');
    captureBtn.classList.remove('hidden');
    status.textContent = 'Hold your paper up so the cube fills the picture, as flat-on as you can, then capture.';
}

function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    video.srcObject = null;
    video.classList.remove('visible');
    captureBtn.classList.add('hidden');
}

cameraBtn.addEventListener('click', () => { stopCamera(); startCamera(); });
captureBtn.addEventListener('click', () => {
    if (!video.videoWidth) return;
    loadPhoto(video, video.videoWidth, video.videoHeight);
    stopCamera();
});

// ==========================================
// 4. CONTROLS
// ==========================================
outlinesToggle.addEventListener('change', showToggles);
inkToggle.addEventListener('change', showToggles);
sensitivitySlider.addEventListener('change', analyse);
minLengthSlider.addEventListener('change', analyse);
showToggles();
