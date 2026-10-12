import { onCameraMoved } from './Apparatus.js';
import { viewSize, toPixels, edgeVisible } from './CubeScreen.js';

// ==========================================
// EDGE INSPECTOR
// Compare how long cube edges look in the Drawing View (foreshortened, on-screen lengths).
// Click one visible edge as the reference, then click another: it is labelled with its length
// as a multiple of the reference, and a ruler beside it shows one reference-length laid along it.
// "Show all ratios" labels every visible edge against the reference.
// Drawn as a 2D SVG layer on top of the Drawing View (so it never shows in the other views).
// ==========================================

const SVG_NS = 'http://www.w3.org/2000/svg';
const PICK_DISTANCE = 10;  // px: how close a click must be to an edge
const RULER_OFFSET = 12;   // px: the ruler sits this far to the side of the edge
const MIN_LENGTH = 1;      // px: edges squashed shorter than this get no ratio

function svgElement(tag, className) {
    const el = document.createElementNS(SVG_NS, tag);
    el.setAttribute('class', className);
    return el;
}

const hide = (...els) => els.forEach(el => el.style.display = 'none');

function setLine(el, p, q) {
    el.setAttribute('x1', p.x); el.setAttribute('y1', p.y); el.setAttribute('x2', q.x); el.setAttribute('y2', q.y);
    el.style.display = '';
}

// Distance from a point to a line segment
function distanceToSegment(pt, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((pt.x - p.x) * dx + (pt.y - p.y) * dy) / lengthSquared));
    return Math.hypot(pt.x - (p.x + t * dx), pt.y - (p.y + t * dy));
}

export function createEdgeInspector(cubes) {
    const container = document.getElementById('perspective-container');
    const { width, height } = viewSize();

    // The overlay: hover / reference / target lines, a ruler, and ratio labels
    const svg = svgElement('svg', 'edge-inspector');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const hoverLine = svgElement('line', 'edge-hover');
    const referenceLine = svgElement('line', 'edge-reference');
    const targetLine = svgElement('line', 'edge-target');
    const ruler = svgElement('path', 'edge-ruler');
    const referenceLabel = svgElement('text', 'edge-label');
    const targetLabel = svgElement('text', 'edge-label edge-label-target');
    const otherLabels = Array.from({ length: 12 * cubes.length }, () => svgElement('text', 'edge-label edge-label-other'));
    svg.append(hoverLine, referenceLine, targetLine, ruler, referenceLabel, targetLabel, ...otherLabels);
    container.appendChild(svg);

    // The 12 edges of each cube: two local end points, plus a corner (for the visibility test)
    const edges = [];
    cubes.forEach(cube => {
        const s = cube.userData.size / 2;
        [0, 1, 2].forEach(axis => {
            for (const a of [s, -s]) for (const b of [s, -s]) {
                const start = new THREE.Vector3();
                const [other1, other2] = [0, 1, 2].filter(i => i !== axis);
                start.setComponent(other1, a).setComponent(other2, b).setComponent(axis, s);
                const end = start.clone().setComponent(axis, -s);
                edges.push({ cube, axis, start, end });
            }
        });
    });

    let enabled = false;
    let showAll = false;
    let hovered = null;
    let reference = null;
    let target = null;
    let screenEdges = []; // current pixel positions of the visible edges

    function placeLabel(el, x, y, text) {
        el.setAttribute('x', Math.max(30, Math.min(width - 30, x)));
        el.setAttribute('y', Math.max(16, Math.min(height - 8, y + 5)));
        el.textContent = text;
        el.style.display = '';
    }

    const ratioText = (item, referenceItem) => referenceItem.length < MIN_LENGTH ? '—' : `${(item.length / referenceItem.length).toFixed(2)} ×`;

    // A ruler beside the target edge: one reference-length, measured from the target's end nearer the reference
    function drawRuler(targetItem, referenceItem) {
        const mid = item => ({ x: (item.p.x + item.q.x) / 2, y: (item.p.y + item.q.y) / 2 });
        const m = mid(referenceItem);
        const nearIsP = Math.hypot(targetItem.p.x - m.x, targetItem.p.y - m.y) <= Math.hypot(targetItem.q.x - m.x, targetItem.q.y - m.y);
        const from = nearIsP ? targetItem.p : targetItem.q;
        const to = nearIsP ? targetItem.q : targetItem.p;
        if (targetItem.length < MIN_LENGTH) { hide(ruler); return null; }
        const dir = { x: (to.x - from.x) / targetItem.length, y: (to.y - from.y) / targetItem.length };
        const normal = { x: -dir.y, y: dir.x };
        const a = { x: from.x + normal.x * RULER_OFFSET, y: from.y + normal.y * RULER_OFFSET };
        const b = { x: a.x + dir.x * referenceItem.length, y: a.y + dir.y * referenceItem.length };
        const cap = (pt) => `M ${pt.x - normal.x * 5} ${pt.y - normal.y * 5} L ${pt.x + normal.x * 5} ${pt.y + normal.y * 5}`;
        ruler.setAttribute('d', `M ${a.x} ${a.y} L ${b.x} ${b.y} ${cap(a)} ${cap(b)}`);
        ruler.style.display = '';
        return normal;
    }

    function hideAll() {
        hide(hoverLine, referenceLine, targetLine, ruler, referenceLabel, targetLabel, ...otherLabels);
    }

    // Redraw everything (call after cubes move or rotate; also runs when the eye moves)
    function update() {
        cubes.forEach(c => c.updateMatrixWorld(true));
        screenEdges = enabled
            ? edges.filter(e => edgeVisible({ cube: e.cube, local: e.start }, e.axis)).map(edge => {
                const p = toPixels(edge.start, edge.cube), q = toPixels(edge.end, edge.cube);
                return { edge, p, q, length: Math.hypot(q.x - p.x, q.y - p.y) };
            })
            : [];
        const find = edge => screenEdges.find(item => item.edge === edge);

        // An edge that has turned out of sight can't stay selected
        if (!find(reference)) { reference = null; target = null; }
        if (!find(target)) target = null;

        hideAll();
        const hoveredItem = find(hovered);
        if (hoveredItem && hovered !== reference && hovered !== target) setLine(hoverLine, hoveredItem.p, hoveredItem.q);

        const referenceItem = find(reference);
        if (!referenceItem) return;
        setLine(referenceLine, referenceItem.p, referenceItem.q);
        placeLabel(referenceLabel, (referenceItem.p.x + referenceItem.q.x) / 2, (referenceItem.p.y + referenceItem.q.y) / 2 - 12, '1.00');

        const targetItem = find(target);
        if (targetItem) {
            setLine(targetLine, targetItem.p, targetItem.q);
            const normal = drawRuler(targetItem, referenceItem) || { x: 0, y: -1 };
            // Label on the side of the edge away from the ruler
            placeLabel(targetLabel, (targetItem.p.x + targetItem.q.x) / 2 - normal.x * 16, (targetItem.p.y + targetItem.q.y) / 2 - normal.y * 16, ratioText(targetItem, referenceItem));
        }

        if (showAll) {
            screenEdges.filter(item => item.edge !== reference && item.edge !== target).forEach((item, i) => {
                placeLabel(otherLabels[i], (item.p.x + item.q.x) / 2, (item.p.y + item.q.y) / 2, ratioText(item, referenceItem));
            });
        }
    }

    function edgeAt(event) {
        const rect = svg.getBoundingClientRect();
        const point = { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
        let best = null, bestDistance = PICK_DISTANCE;
        screenEdges.forEach(item => {
            const d = distanceToSegment(point, item.p, item.q);
            if (d < bestDistance) { best = item.edge; bestDistance = d; }
        });
        return best;
    }

    svg.addEventListener('pointermove', e => {
        hovered = edgeAt(e);
        svg.classList.toggle('over-edge', hovered !== null);
        update();
    });
    svg.addEventListener('pointerleave', () => { hovered = null; svg.classList.remove('over-edge'); update(); });
    svg.addEventListener('click', e => {
        const clicked = edgeAt(e);
        if (clicked === null || clicked === reference) { reference = null; target = null; } // empty space or the reference itself: start again
        else if (reference === null) reference = clicked;
        else target = clicked;
        update();
    });

    document.addEventListener('keydown', e => {
        if (enabled && e.key === 'Escape') { reference = null; target = null; update(); }
    });

    function setEnabled(on) {
        enabled = on;
        svg.classList.toggle('active', on);
        if (!on) { hovered = null; reference = null; target = null; }
        update();
    }

    function setShowAll(on) { showAll = on; update(); }

    function clear() { reference = null; target = null; update(); }

    onCameraMoved(update);
    hideAll();
    return { setEnabled, setShowAll, clear, update };
}

// Wires #edge-compare-toggle and #edge-ratios-toggle
export function wireEdgeInspectToggle(inspector) {
    document.getElementById('edge-compare-toggle').addEventListener('change', e => inspector.setEnabled(e.target.checked));
    document.getElementById('edge-ratios-toggle').addEventListener('change', e => inspector.setShowAll(e.target.checked));
}
