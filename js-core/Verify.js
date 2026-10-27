import { toPixels, faceVisible, edgeVisible } from './CubeScreen.js';

// ==========================================
// VERIFY MY DRAWING
// 1. Camera: hold your paper up and capture one photo.
// 2. Mark: click where each corner of your drawn cube is, in the order shown on the little guide.
// 3. Result: the true cube is moved / resized / turned to fit your corners as closely as possible
//    (so only real perspective mistakes show), then drawn over your photo with a line from each
//    of your corners to where it should have been.
// Works on one cube. The photo never leaves the browser.
// ==========================================

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_CORNERS = 3; // fewest clicked corners that still give a fit

function svgElement(tag, className, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    if (className) el.setAttribute('class', className);
    Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
    return el;
}

function htmlElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
}

// ==========================================
// THE FIT
// Best move + resize + turn (nothing else) that carries the true corners onto your corners.
// Treats each point as a complex number, so the whole fit is one multiplication.
// Returns a function that maps a true point to where it lands on your photo.
// ==========================================
function fitToDrawing(truePoints, yourPoints) {
    const mean = pts => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
    const trueMid = mean(truePoints);
    const yourMid = mean(yourPoints);
    let re = 0, im = 0, size = 0;
    truePoints.forEach((p, i) => {
        const a = { x: p.x - trueMid.x, y: p.y - trueMid.y };
        const b = { x: yourPoints[i].x - yourMid.x, y: yourPoints[i].y - yourMid.y };
        re += b.x * a.x + b.y * a.y;
        im += b.y * a.x - b.x * a.y;
        size += a.x * a.x + a.y * a.y;
    });
    const m = { re: re / size, im: im / size };
    const map = p => {
        const a = { x: p.x - trueMid.x, y: p.y - trueMid.y };
        return { x: yourMid.x + m.re * a.x - m.im * a.y, y: yourMid.y + m.re * a.y + m.im * a.x };
    };
    map.scale = Math.hypot(m.re, m.im);
    return map;
}

export function createVerifier(cube) {
    const size = cube.userData.size / 2;
    const corners = [];  // all 8: { local, visible }
    for (const x of [size, -size]) for (const y of [size, -size]) for (const z of [size, -size]) {
        const local = new THREE.Vector3(x, y, z);
        corners.push({ local, visible: false, pos: null }); // visible + pos are filled in by open()
    }
    const edges = [];    // 12: { from, to, axis, visible }
    corners.forEach(c => {
        [0, 1, 2].forEach(axis => {
            if (c.local.getComponent(axis) < 0) return; // each edge once, from its + end
            const other = corners.find(o => o.local.equals(c.local.clone().setComponent(axis, -c.local.getComponent(axis))));
            edges.push({ from: c, to: other, axis, visible: false });
        });
    });

    // ------------------------------------------
    // The panel
    // ------------------------------------------
    const modal = htmlElement('div', 'verify-modal');
    const panel = htmlElement('div', 'verify-panel');
    const title = htmlElement('h2', '', 'Verify my drawing');
    const closeBtn = htmlElement('button', 'verify-close', '✕');
    const header = htmlElement('div', 'verify-header');
    header.append(title, closeBtn);
    const hint = htmlElement('p', 'verify-hint');

    const body = htmlElement('div', 'verify-body');
    const photoBox = htmlElement('div', 'verify-photo');
    const video = htmlElement('video');
    video.autoplay = true; video.playsInline = true; video.muted = true;
    const canvas = htmlElement('canvas');
    const marks = svgElement('svg', 'verify-marks');
    photoBox.append(video, canvas, marks);
    const guide = svgElement('svg', 'verify-guide');
    body.append(photoBox, guide);

    const actions = htmlElement('div', 'verify-actions');
    const captureBtn = htmlElement('button', '', 'Capture photo');
    const undoBtn = htmlElement('button', '', 'Undo last corner');
    const showBtn = htmlElement('button', '', 'Show result');
    const remarkBtn = htmlElement('button', '', 'Mark corners again');
    const retakeBtn = htmlElement('button', '', 'Retake photo');
    actions.append(captureBtn, undoBtn, showBtn, remarkBtn, retakeBtn);

    panel.append(header, hint, body, actions);
    modal.append(panel);
    document.body.appendChild(modal);

    // ------------------------------------------
    // State
    // ------------------------------------------
    let stream = null;
    let step = 'closed';   // 'camera' | 'mark' | 'result' | 'error'
    let order = [];        // visible corners, in the order you click them
    let clicks = [];       // your clicked points (photo pixels), same order
    let photo = { width: 1, height: 1 };

    function stopCamera() {
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        video.srcObject = null;
    }

    function show(...els) { [video, canvas, marks, guide, captureBtn, undoBtn, showBtn, remarkBtn, retakeBtn].forEach(el => el.style.display = els.includes(el) ? '' : 'none'); }

    // ------------------------------------------
    // Reference guide: the true cube with numbered corners, next one highlighted
    // ------------------------------------------
    function drawGuide() {
        guide.replaceChildren();
        const all = corners.map(c => c.pos);
        const minX = Math.min(...all.map(p => p.x)), maxX = Math.max(...all.map(p => p.x));
        const minY = Math.min(...all.map(p => p.y)), maxY = Math.max(...all.map(p => p.y));
        const pad = 30, box = 220;
        const k = (box - 2 * pad) / Math.max(maxX - minX, maxY - minY, 1);
        const at = p => ({ x: pad + (p.x - minX) * k + ((box - 2 * pad) - (maxX - minX) * k) / 2, y: pad + (p.y - minY) * k + ((box - 2 * pad) - (maxY - minY) * k) / 2 });
        guide.setAttribute('viewBox', `0 0 ${box} ${box}`);
        edges.forEach(e => {
            const a = at(e.from.pos), b = at(e.to.pos);
            guide.append(svgElement('line', e.visible ? 'guide-edge' : 'guide-edge guide-hidden', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
        });
        order.forEach((c, i) => {
            const p = at(c.pos);
            const state = step !== 'mark' || i < clicks.length ? 'guide-done' : i === clicks.length ? 'guide-next' : 'guide-todo';
            guide.append(svgElement('circle', `guide-dot ${state}`, { cx: p.x, cy: p.y, r: 11 }));
            const label = svgElement('text', 'guide-number', { x: p.x, y: p.y + 4 });
            label.textContent = i + 1;
            guide.append(label);
        });
    }

    // ------------------------------------------
    // Drawing on the photo
    // ------------------------------------------
    function drawMarks() {
        marks.replaceChildren();
        marks.setAttribute('viewBox', `0 0 ${photo.width} ${photo.height}`);

        if (step === 'result') {
            const fit = fitToDrawing(order.slice(0, clicks.length).map(c => c.pos), clicks);
            // The true cube, fitted to your drawing
            edges.forEach(e => {
                const a = fit(e.from.pos), b = fit(e.to.pos);
                marks.append(svgElement('line', e.visible ? 'mark-true' : 'mark-true mark-hidden', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
            });
            // Your corners, with a line to where each should have been
            let sumSquares = 0;
            clicks.forEach((q, i) => {
                const t = fit(order[i].pos);
                sumSquares += (q.x - t.x) ** 2 + (q.y - t.y) ** 2;
                marks.append(svgElement('line', 'mark-miss', { x1: q.x, y1: q.y, x2: t.x, y2: t.y }));
                marks.append(svgElement('circle', 'mark-dot', { cx: q.x, cy: q.y }));
            });
            const edgeLength = edges.reduce((s, e) => s + Math.hypot(e.from.pos.x - e.to.pos.x, e.from.pos.y - e.to.pos.y), 0) / edges.length * fit.scale;
            const miss = Math.sqrt(sumSquares / clicks.length) / edgeLength * 100;
            hint.textContent = `Green = the correct cube, fitted to your drawing. Orange lines show how far each of your corners is from where it should be. Average miss: ${miss.toFixed(1)}% of an edge length.`;
        } else {
            clicks.forEach((q, i) => {
                marks.append(svgElement('circle', 'mark-dot', { cx: q.x, cy: q.y }));
                const label = svgElement('text', 'mark-number', { x: q.x + 14, y: q.y - 10 });
                label.textContent = i + 1;
                marks.append(label);
            });
        }
    }

    // ------------------------------------------
    // Steps
    // ------------------------------------------
    function showError(message) {
        step = 'error';
        hint.textContent = message;
        show(retakeBtn);
        retakeBtn.textContent = 'Try again';
    }

    async function startCamera() {
        step = 'camera';
        retakeBtn.textContent = 'Retake photo';
        hint.textContent = 'Hold your paper up to the camera so the drawing fills the picture and is as flat-on as you can manage, then capture.';
        show(video, captureBtn);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showError('This browser cannot reach the camera here. Open the site from http://localhost and try again.');
            return;
        }
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
            if (step !== 'camera') { stopCamera(); return; } // closed while waiting for permission
            video.srcObject = stream;
        } catch (err) {
            showError(err.name === 'NotAllowedError'
                ? 'Camera permission was blocked. Allow the camera for this page in your browser, then try again.'
                : 'No camera could be started. Check that one is connected and not in use by another app.');
        }
    }

    function capture() {
        if (!video.videoWidth) return;
        photo = { width: video.videoWidth, height: video.videoHeight };
        canvas.width = photo.width; canvas.height = photo.height;
        canvas.getContext('2d').drawImage(video, 0, 0);
        stopCamera();
        startMarking();
    }

    function startMarking() {
        step = 'mark';
        clicks = [];
        hint.textContent = 'Click each corner of your drawn cube in the order numbered on the guide (highlighted = next).';
        show(canvas, marks, guide, undoBtn, retakeBtn);
        refresh();
    }

    function showResult() {
        if (clicks.length < MIN_CORNERS) return;
        step = 'result';
        show(canvas, marks, guide, remarkBtn, retakeBtn);
        refresh();
    }

    function refresh() {
        // "Show result" appears once enough corners are placed, before all of them are
        if (step === 'mark') show(canvas, marks, guide, undoBtn, retakeBtn, ...(clicks.length >= MIN_CORNERS ? [showBtn] : []));
        undoBtn.disabled = clicks.length === 0;
        drawMarks();
        drawGuide();
    }

    function open() {
        // Where each corner of the true cube sits in the Drawing View right now
        cube.updateMatrixWorld(true);
        corners.forEach(c => c.pos = toPixels(c.local, cube));
        corners.forEach(c => c.visible = [0, 1, 2].some(axis => faceVisible({ cube, local: c.local }, axis)));
        edges.forEach(e => e.visible = edgeVisible({ cube, local: e.from.local }, e.axis));
        // Number the visible corners going round the cube
        const visible = corners.filter(c => c.visible);
        const mid = { x: visible.reduce((s, c) => s + c.pos.x, 0) / visible.length, y: visible.reduce((s, c) => s + c.pos.y, 0) / visible.length };
        const angle = c => Math.atan2(c.pos.y - mid.y, c.pos.x - mid.x);
        order = visible.sort((a, b) => angle(a) - angle(b));
        modal.classList.add('open');
        startCamera();
    }

    function close() {
        stopCamera();
        step = 'closed';
        modal.classList.remove('open');
    }

    // ------------------------------------------
    // Events
    // ------------------------------------------
    marks.addEventListener('click', e => {
        if (step !== 'mark') return;
        const rect = marks.getBoundingClientRect();
        clicks.push({ x: (e.clientX - rect.left) * photo.width / rect.width, y: (e.clientY - rect.top) * photo.height / rect.height });
        if (clicks.length === order.length) showResult(); else refresh();
    });
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && step !== 'closed') close(); });
    captureBtn.addEventListener('click', capture);
    undoBtn.addEventListener('click', () => { clicks.pop(); refresh(); });
    showBtn.addEventListener('click', showResult);
    remarkBtn.addEventListener('click', startMarking);
    retakeBtn.addEventListener('click', () => { stopCamera(); startCamera(); });

    return { open, close };
}

// Wires #verify-btn
export function wireVerifyButton(verifier) {
    document.getElementById('verify-btn').addEventListener('click', verifier.open);
}
