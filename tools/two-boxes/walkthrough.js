import { cameraPerspective } from '../../js-core/PerspectiveEngine.js';

// ==========================================
// STEP-BY-STEP WALKTHROUGH
// Draws the approximate construction for the current view on a flat layer above
// the Drawing View, one step at a time. The view is frozen while it runs.
// ==========================================

const W = 820, H = 500;          // size of the Drawing View
const ZOOM_OUT = 0.2;            // "Zoom out" shows your page at a fifth of its size
const COL = { horizon: '#ffffff', vp3: '#44ff44', A: '#ffaa44', B: '#44ccff', check: '#ff66ff', page: '#888888' };

let ctx;
let usedLabels = []; // labels already on the overlay: { text, x, y }

// ==========================================
// 1. FROM 3D TO THE PAGE
// ==========================================
function toPage(point) {
    const p = point.clone().project(cameraPerspective);
    return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H };
}

// Where all lines running in this direction meet on the page (null if they stay parallel)
function vanishingPoint(dir) {
    const d = dir.clone().transformDirection(cameraPerspective.matrixWorldInverse);
    if (Math.abs(d.z) < 1e-3) return null;
    if (d.z > 0) d.negate(); // the camera looks along -z: use the end of the line that runs away from you
    const m = cameraPerspective.projectionMatrix.elements;
    const x = m[0] * d.x / -d.z, y = m[5] * d.y / -d.z;
    return { x: (x + 1) / 2 * W, y: (1 - y) / 2 * H };
}

// ==========================================
// 2. THE BOXES, AS SEEN FROM THE EYE
// ==========================================
function describeBox(box, name, colour) {
    box.updateMatrixWorld(true);
    const eye = cameraPerspective.position;
    const corner = (x, y, z) => new THREE.Vector3(x / 2, y / 2, z / 2).applyMatrix4(box.matrixWorld);
    const axis = i => new THREE.Vector3().setComponent(i, 1).applyQuaternion(box.quaternion);

    // A face can be seen if the eye is on its outer side
    const faceSeen = (i, sign) => {
        const centre = [0, 0, 0]; centre[i] = sign;
        return axis(i).multiplyScalar(sign).dot(eye.clone().sub(corner(...centre))) > 0;
    };

    // The 12 edges: each runs along one axis (0 = x, 1 = up, 2 = z) with fixed signs on the other two
    const edges = [];
    for (let i = 0; i < 3; i++) {
        const [a, b] = [(i + 1) % 3, (i + 2) % 3];
        for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
            const s = [0, 0, 0]; s[a] = sa; s[b] = sb;
            const start = [...s]; start[i] = -1;
            const end = [...s]; end[i] = 1;
            edges.push({
                axis: i,
                kind: i === 1 ? 'vertical' : (s[1] < 0 ? 'bottom' : 'top'),
                start: corner(...start), end: corner(...end),
                hidden: !faceSeen(a, sa) && !faceSeen(b, sb),
            });
        }
    }

    // The bottom corner nearest the eye
    let near = null;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const c = corner(sx, -1, sz);
        if (!near || c.distanceTo(eye) < near.distanceTo(eye)) near = c;
    }

    // Its two vanishing points, named left and right by where they land on the page
    const vps = [0, 2].map(i => ({ axis: i, point: vanishingPoint(axis(i)) }));
    vps.sort((p, q) => (p.point ? p.point.x : Infinity) - (q.point ? q.point.x : Infinity));
    vps[0].label = `${name}-left`; vps[1].label = `${name}-right`;

    return { name, colour, edges, near, height: box.scale.y, vpFor: i => vps.find(v => v.axis === i).point, vps };
}

function sceneInfo(boxes) {
    cameraPerspective.updateMatrixWorld();
    return {
        pitch: parseFloat(document.getElementById('pitch-slider').value),
        cv: { x: W / 2, y: H / 2 },
        horizonY: vanishingPoint(new THREE.Vector3(0, 0, -1)).y, // the point on the horizon straight ahead
        vp3: vanishingPoint(new THREE.Vector3(0, -1, 0)),
        A: describeBox(boxes[0], 'A', COL.A),
        B: describeBox(boxes[1], 'B', COL.B),
    };
}

// ==========================================
// 3. DRAWING ON THE OVERLAY
// ==========================================
const onPage = p => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;

function line(p, q, colour, { width = 1, dash = [], alpha = 1 } = {}) {
    ctx.save();
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.restore();
}

// A faint guide line through an edge to its vanishing point (or on and on, if the lines stay parallel)
function guide(edge, vp, colour, opts = { alpha: 0.45 }) {
    const p = toPage(edge.start), q = toPage(edge.end);
    if (vp) {
        const far = Math.hypot(p.x - vp.x, p.y - vp.y) > Math.hypot(q.x - vp.x, q.y - vp.y) ? p : q;
        line(far, vp, colour, opts);
    } else {
        const dx = q.x - p.x, dy = q.y - p.y, k = 3000 / Math.hypot(dx, dy);
        line({ x: p.x - dx * k, y: p.y - dy * k }, { x: p.x + dx * k, y: p.y + dy * k }, colour, opts);
    }
}

// Box edges: solid if you can see them, dashed if they're round the back
function drawEdges(box, kind) {
    box.edges.filter(e => e.kind === kind).forEach(e =>
        line(toPage(e.start), toPage(e.end), box.colour, e.hidden ? { width: 1.5, dash: [5, 5], alpha: 0.6 } : { width: 2.5 }));
}

// A labelled dot. Points off the page get an arrow at the edge pointing their way.
// `below` writes the label under the dot, so two boxes' labels don't land on top of each other.
function marker(p, colour, label, below = false) {
    if (!p) return;
    const inside = onPage(p);
    const m = 20;
    const q = { x: Math.min(Math.max(p.x, m), W - m), y: Math.min(Math.max(p.y, m + 30), H - m) };
    ctx.save();
    ctx.fillStyle = colour; ctx.strokeStyle = colour; ctx.font = 'bold 13px sans-serif';
    if (inside) {
        ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.fill();
    } else {
        const angle = Math.atan2(p.y - q.y, p.x - q.x);
        ctx.translate(q.x, q.y); ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.textAlign = q.x > W / 2 ? 'right' : 'left';
    const text = inside ? label : `${label} (off page)`;
    const x = q.x + (q.x > W / 2 ? -12 : 12);
    let y = below || q.y < 70 ? q.y + 20 : q.y - 10; // near the top, always below so the view's title doesn't cover it

    // Same label again: write over it. Another label in the way: move down a line.
    const same = usedLabels.find(u => u.text === text);
    if (same) y = same.y;
    else while (usedLabels.some(u => Math.abs(u.x - x) < 100 && Math.abs(u.y - y) < 15)) y += 16;
    if (!same) usedLabels.push({ text, x, y });

    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawHorizon(S, width = 1.5) {
    line({ x: 0, y: S.horizonY }, { x: W, y: S.horizonY }, COL.horizon, { width });
    marker({ x: 40, y: S.horizonY }, COL.horizon, 'Horizon');
}

// How the drawn size of your page shows up when zoomed out
function drawPageFrame() {
    const w = W * ZOOM_OUT, h = H * ZOOM_OUT;
    ctx.save();
    ctx.strokeStyle = COL.page; ctx.setLineDash([4, 4]);
    ctx.strokeRect((W - w) / 2, (H - h) / 2, w, h);
    ctx.fillStyle = COL.page; ctx.font = '12px sans-serif';
    ctx.fillText('your page', (W - w) / 2, (H - h) / 2 - 6);
    ctx.restore();
}

function describeRatio(r) {
    if (Math.abs(r - 1) < 0.08) return 'about the same height as A';
    return r > 1 ? `about ${r.toFixed(1)} times as tall as A` : `about ${r.toFixed(1)} of A's height`;
}

// ==========================================
// 4. THE STEPS
// Each step adds to the drawing of the steps before it (except the last).
// ==========================================
const zoomHint = ' Tick "Zoom out" below to see it.';

function boxSteps(key, warmOrCool, first) {
    return [
        {
            title: `Box ${key}: the footprint`,
            text: S => `Find the ${warmOrCool} box's nearest bottom corner (the dot) and draw its bottom edges. ` +
                (first ? 'They run to two vanishing points on the horizon. '
                       : 'Box B is turned differently, so it has its own two vanishing points, but on the same horizon. ') +
                'The side facing you more squarely has its vanishing point further away. Edges round the back are dashed.' +
                (S[key].vps.some(v => v.point && !onPage(v.point)) ? zoomHint : ''),
            draw: S => {
                const box = S[key];
                box.edges.filter(e => e.kind === 'bottom').forEach(e => guide(e, box.vpFor(e.axis), box.colour));
                drawEdges(box, 'bottom');
                marker(toPage(box.near), box.colour, '');
                box.vps.forEach(v => marker(v.point, box.colour, v.label, box.name === 'B'));
            },
        },
        {
            title: `Box ${key}: the vertical edges`,
            text: S => (S.vp3
                ? `Draw the vertical edges up from each corner, leaning in toward VP3${first ? '' : ' (the same VP3 as box A: every vertical edge in the scene shares it)'}. `
                : 'Draw the vertical edges straight up from each corner. ') +
                'Judge the height by eye against the width of the box.',
            draw: S => {
                const box = S[key];
                box.edges.filter(e => e.kind === 'vertical').forEach(e => guide(e, S.vp3, COL.vp3, { alpha: 0.3 }));
                drawEdges(box, 'vertical');
            },
        },
        {
            title: `Box ${key}: the top`,
            text: () => 'Close the top. Each top edge runs to the same vanishing point as the bottom edge under it. If one doesn\'t, a corner is the wrong height.',
            draw: S => {
                const box = S[key];
                box.edges.filter(e => e.kind === 'top').forEach(e => guide(e, box.vpFor(e.axis), box.colour));
                drawEdges(box, 'top');
            },
        },
    ];
}

const STEPS = [
    {
        title: 'The horizon',
        text: S => (S.pitch === 0
            ? 'You\'re looking straight ahead, so the horizon runs through the centre of the page (the cross marks where you\'re looking).'
            : `You're looking down ${S.pitch}°, so the horizon sits above the centre of the page (the cross marks where you're looking). The further you look down, the higher it goes.`) +
            (S.horizonY < 0 ? ' At this angle it\'s above the top of your page.' + zoomHint : ''),
        draw: S => {
            drawHorizon(S);
            line({ x: S.cv.x - 8, y: S.cv.y }, { x: S.cv.x + 8, y: S.cv.y }, COL.horizon);
            line({ x: S.cv.x, y: S.cv.y - 8 }, { x: S.cv.x, y: S.cv.y + 8 }, COL.horizon);
        },
    },
    {
        title: 'The third vanishing point (VP3)',
        text: S => S.vp3
            ? 'Because you\'re looking down, vertical edges lean in toward a third vanishing point below, straight under the centre of the page. If it\'s off your paper, just remember which way verticals lean: the further from the centre, the more they lean.' +
              (onPage(S.vp3) ? '' : zoomHint)
            : 'You\'re looking straight ahead, so vertical edges stay vertical and parallel: there\'s no third vanishing point. Draw them with a set square.',
        draw: S => {
            if (!S.vp3) return;
            line(S.cv, S.vp3, COL.vp3, { dash: [6, 6], alpha: 0.6 });
            marker(S.vp3, COL.vp3, 'VP3');
        },
    },
    ...boxSteps('A', 'warm', true),
    ...boxSteps('B', 'cool', false),
    {
        title: 'Check: both boxes sit on the ground',
        text: () => 'Extend the bottom edges of each box. Both pairs must meet on the horizon. If a pair meets above or below it, that box\'s base is tilted and the box will look like it\'s floating or sinking.',
        draw: S => {
            drawHorizon(S, 3);
            [S.A, S.B].forEach(box => {
                box.edges.filter(e => e.kind === 'bottom').forEach(e => guide(e, box.vpFor(e.axis), COL.check, { width: 1.5, alpha: 0.8 }));
                box.vps.forEach(v => marker(v.point, COL.check, v.label, box.name === 'B'));
            });
        },
    },
    {
        title: 'Compare the heights with a ground line',
        text: S => 'Draw a line on the ground from A\'s nearest bottom corner to B\'s, and carry it on to the horizon (X). From the top of that corner on A, draw a line to X too. ' +
            `Where it crosses B's corner edge is A's height, moved over to B. Here box B is ${describeRatio(S.B.height / S.A.height)}.`,
        draw: S => {
            const a = S.A.near, b = S.B.near;
            const up = h => new THREE.Vector3(0, h, 0);
            const aTop = a.clone().add(up(S.A.height)), bAtAHeight = b.clone().add(up(S.A.height));
            const x = vanishingPoint(b.clone().sub(a));
            const opts = { width: 1.5, alpha: 0.9 };
            if (x) {
                // Start each line from whichever box is further from X, so it runs through both
                const fromFar = (p, q) => Math.hypot(p.x - x.x, p.y - x.y) > Math.hypot(q.x - x.x, q.y - x.y) ? p : q;
                line(fromFar(toPage(a), toPage(b)), x, COL.check, opts);
                line(fromFar(toPage(aTop), toPage(bAtAHeight)), x, COL.check, opts);
                marker(x, COL.check, 'X');
            } else {
                line(toPage(a), toPage(b), COL.check, opts);
                line(toPage(aTop), toPage(bAtAHeight), COL.check, opts);
            }
            line(toPage(b), toPage(bAtAHeight), COL.check, { dash: [4, 4] });
            marker(toPage(bAtAHeight), COL.check, 'A\'s height');
        },
    },
    {
        title: 'Compare with the real boxes',
        alone: true,
        text: () => 'Here\'s your construction over the real boxes. Look for where your own drawing drifted from it.',
        draw: S => {
            drawHorizon(S);
            [S.A, S.B].forEach(box => {
                ['bottom', 'vertical', 'top'].forEach(kind => drawEdges(box, kind));
                box.vps.forEach(v => marker(v.point, box.colour, v.label, box.name === 'B'));
            });
            marker(S.vp3, COL.vp3, 'VP3');
        },
    },
];

// ==========================================
// 5. SIDEBAR CONTROLS
// ==========================================
export function setupWalkthrough(boxes) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.className = 'step-overlay hidden';
    document.getElementById('perspective-container').prepend(canvas); // before the title, so the title stays on top
    ctx = canvas.getContext('2d');

    const startBtn = document.getElementById('walk-start-btn');
    const panel = document.getElementById('walk-panel');
    const backBtn = document.getElementById('walk-back-btn');
    const nextBtn = document.getElementById('walk-next-btn');
    const zoomToggle = document.getElementById('walk-zoom-toggle');
    const frozen = [document.getElementById('generate-btn'), document.getElementById('pitch-slider')];
    let current = 0, normalZoom = 1;

    function render() {
        const step = STEPS[current];
        const S = sceneInfo(boxes);
        ctx.clearRect(0, 0, W, H);
        usedLabels = [];
        if (!step.alone) {
            ctx.fillStyle = '#222222'; // the scene's background: hides the real boxes until the last step
            ctx.fillRect(0, 0, W, H);
            STEPS.slice(0, current + 1).forEach(s => s.draw(S));
        } else {
            step.draw(S);
        }
        if (zoomToggle.checked) drawPageFrame();

        document.getElementById('walk-count').textContent = `Step ${current + 1} of ${STEPS.length}`;
        document.getElementById('walk-title').textContent = step.title;
        document.getElementById('walk-text').textContent = step.text(S);
        backBtn.disabled = current === 0;
        nextBtn.disabled = current === STEPS.length - 1;
    }

    function setZoom() {
        cameraPerspective.zoom = normalZoom * (zoomToggle.checked ? ZOOM_OUT : 1);
        cameraPerspective.updateProjectionMatrix();
    }

    function start() {
        normalZoom = cameraPerspective.zoom;
        current = 0;
        frozen.forEach(el => el.disabled = true);
        startBtn.classList.add('hidden');
        panel.classList.remove('hidden');
        canvas.classList.remove('hidden');
        render();
    }

    function exit() {
        zoomToggle.checked = false;
        setZoom();
        frozen.forEach(el => el.disabled = false);
        startBtn.classList.remove('hidden');
        panel.classList.add('hidden');
        canvas.classList.add('hidden');
    }

    startBtn.addEventListener('click', start);
    document.getElementById('walk-exit-btn').addEventListener('click', exit);
    backBtn.addEventListener('click', () => { current--; render(); });
    nextBtn.addEventListener('click', () => { current++; render(); });
    zoomToggle.addEventListener('change', () => { setZoom(); render(); });
}
