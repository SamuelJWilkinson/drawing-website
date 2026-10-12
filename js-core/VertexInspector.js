import { onCameraMoved } from './Apparatus.js';
import { viewSize, toPixels, faceVisible, edgeVisible } from './CubeScreen.js';

// ==========================================
// VERTEX INSPECTOR
// Click a visible cube corner in the Drawing View: a crosshair (true horizontal + true
// vertical) runs through it to the edges of the view, and every visible edge leaving
// that corner shows its angle from the nearest crosshair arm.
// Drawn as a 2D SVG layer on top of the Drawing View (so it never shows in the other views).
// ==========================================

const SVG_NS = 'http://www.w3.org/2000/svg';
const PICK_DISTANCE = 14;  // px: how close a click must be to a corner
const ARC_RADIUS = 40;
const MIN_EDGE_LENGTH = 6; // px: edges squashed shorter than this get no angle

function svgElement(tag, className) {
    const el = document.createElementNS(SVG_NS, tag);
    el.setAttribute('class', className);
    return el;
}

const hide = (...els) => els.forEach(el => el.style.display = 'none');

export function createVertexInspector(cubes) {
    const container = document.getElementById('perspective-container');
    const { width, height } = viewSize();

    // The overlay: crosshair, corner markers, and (up to 3 edges per corner) edge line, arc, label
    const svg = svgElement('svg', 'vertex-inspector');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const crossH = svgElement('line', 'crosshair');
    const crossV = svgElement('line', 'crosshair');
    const hoverDot = svgElement('circle', 'vertex-hover');
    const selectedDot = svgElement('circle', 'vertex-selected');
    svg.append(crossH, crossV);
    const slots = [0, 1, 2].map(() => ({ line: svgElement('line', 'vertex-edge'), arc: svgElement('path', 'vertex-arc'), label: svgElement('text', 'vertex-label') }));
    slots.forEach(({ line, arc, label }) => svg.append(line, arc, label));
    svg.append(hoverDot, selectedDot);
    container.appendChild(svg);

    // The 8 corners of each cube (local position + signs on each axis)
    const vertices = [];
    cubes.forEach(cube => {
        const s = cube.userData.size / 2;
        for (const x of [s, -s]) for (const y of [s, -s]) for (const z of [s, -s]) {
            vertices.push({ cube, local: new THREE.Vector3(x, y, z) });
        }
    });

    let enabled = false;
    let hovered = null;
    let selected = null;
    let screenVertices = []; // current pixel positions of the visible corners

    function drawSelection(item) {
        const p = item.pos;
        const point = (el, x, y) => { el.setAttribute('cx', x); el.setAttribute('cy', y); el.style.display = ''; };
        const line = (el, x1, y1, x2, y2) => { el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2); el.style.display = ''; };

        // Crosshair to the edges of the view
        line(crossH, 0, p.y, width, p.y);
        line(crossV, p.x, 0, p.x, height);
        point(selectedDot, p.x, p.y);

        // One angle per visible edge leaving this corner
        const directions = [0, 1, 2].filter(axis => edgeVisible(item.vertex, axis)).map(axis => {
            const otherEnd = item.vertex.local.clone().setComponent(axis, -item.vertex.local.getComponent(axis));
            const q = toPixels(otherEnd, item.vertex.cube);
            return { dx: q.x - p.x, dy: q.y - p.y, end: q };
        });

        slots.forEach((slot, i) => {
            const d = directions[i];
            if (!d || Math.hypot(d.dx, d.dy) < MIN_EDGE_LENGTH) { hide(slot.line, slot.arc, slot.label); return; }

            const length = Math.hypot(d.dx, d.dy);
            const edgeDir = { x: d.dx / length, y: d.dy / length };
            // Nearest crosshair arm: sideways if the edge is flatter than 45°, else up/down
            const useHorizontal = Math.abs(edgeDir.x) >= Math.abs(edgeDir.y);
            const armDir = useHorizontal ? { x: Math.sign(edgeDir.x), y: 0 } : { x: 0, y: Math.sign(edgeDir.y) };
            const angle = Math.acos(Math.min(1, Math.abs(useHorizontal ? edgeDir.x : edgeDir.y))) * 180 / Math.PI;

            line(slot.line, p.x, p.y, d.end.x, d.end.y);

            if (angle > 0.5) {
                const from = { x: p.x + armDir.x * ARC_RADIUS, y: p.y + armDir.y * ARC_RADIUS };
                const to = { x: p.x + edgeDir.x * ARC_RADIUS, y: p.y + edgeDir.y * ARC_RADIUS };
                const sweep = armDir.x * edgeDir.y - armDir.y * edgeDir.x > 0 ? 1 : 0;
                slot.arc.setAttribute('d', `M ${from.x} ${from.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 ${sweep} ${to.x} ${to.y}`);
                slot.arc.style.display = '';
            } else {
                slot.arc.style.display = 'none';
            }

            // Label just outside the arc, along the middle of the angle
            const mid = { x: armDir.x + edgeDir.x, y: armDir.y + edgeDir.y };
            const midLength = Math.hypot(mid.x, mid.y) || 1;
            slot.label.setAttribute('x', Math.max(8, Math.min(width - 8, p.x + (mid.x / midLength) * (ARC_RADIUS + 8))));
            slot.label.setAttribute('y', Math.max(16, Math.min(height - 8, p.y + (mid.y / midLength) * (ARC_RADIUS + 8) + 5)));
            slot.label.setAttribute('text-anchor', mid.x >= 0 ? 'start' : 'end');
            slot.label.textContent = `${angle.toFixed(1)}°`;
            slot.label.style.display = '';
        });
    }

    function hideSelection() {
        hide(crossH, crossV, selectedDot);
        slots.forEach(({ line, arc, label }) => hide(line, arc, label));
    }

    // Redraw everything (call after cubes move or rotate; also runs when the eye moves)
    function update() {
        cubes.forEach(c => c.updateMatrixWorld(true));
        screenVertices = enabled
            ? vertices.filter(v => [0, 1, 2].some(axis => faceVisible(v, axis))).map(vertex => ({ vertex, pos: toPixels(vertex.local, vertex.cube) }))
            : [];

        const hoveredItem = screenVertices.find(item => item.vertex === hovered);
        if (hoveredItem && hoveredItem.vertex !== selected) {
            hoverDot.setAttribute('cx', hoveredItem.pos.x); hoverDot.setAttribute('cy', hoveredItem.pos.y); hoverDot.style.display = '';
        } else {
            hoverDot.style.display = 'none';
        }

        const selectedItem = screenVertices.find(item => item.vertex === selected);
        if (selectedItem) drawSelection(selectedItem);
        else { selected = null; hideSelection(); }
    }

    function vertexAt(event) {
        const rect = svg.getBoundingClientRect();
        const point = { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
        let best = null, bestDistance = PICK_DISTANCE;
        screenVertices.forEach(item => {
            const d = Math.hypot(point.x - item.pos.x, point.y - item.pos.y);
            if (d < bestDistance) { best = item.vertex; bestDistance = d; }
        });
        return best;
    }

    svg.addEventListener('pointermove', e => {
        hovered = vertexAt(e);
        svg.classList.toggle('over-vertex', hovered !== null);
        update();
    });
    svg.addEventListener('pointerleave', () => { hovered = null; svg.classList.remove('over-vertex'); update(); });
    svg.addEventListener('click', e => { selected = vertexAt(e); update(); });

    // Escape clears; Left/Right arrows step through the visible corners
    document.addEventListener('keydown', e => {
        if (!enabled) return;
        if (e.key === 'Escape') { selected = null; update(); }
        if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && screenVertices.length > 0) {
            const index = screenVertices.findIndex(item => item.vertex === selected);
            const step = e.key === 'ArrowRight' ? 1 : -1;
            selected = screenVertices[(index + step + screenVertices.length) % screenVertices.length].vertex;
            update();
            e.preventDefault();
        }
    });

    function setEnabled(on) {
        enabled = on;
        svg.classList.toggle('active', on);
        if (!on) { hovered = null; selected = null; }
        update();
    }

    function clear() { selected = null; update(); }

    onCameraMoved(update);
    hideSelection();
    hide(hoverDot);
    return { setEnabled, clear, update };
}

// Wires #vertex-inspect-toggle
export function wireVertexInspectToggle(inspector) {
    document.getElementById('vertex-inspect-toggle').addEventListener('change', e => inspector.setEnabled(e.target.checked));
}
