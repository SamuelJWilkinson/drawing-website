// ==========================================
// TIMED SKETCH
// Shows a large, high-quality picture and a border around it that runs out as the
// time does. You draw on paper.
// Pictures are found as you need them: a random search from the chosen subject below,
// then a random result from it. Living things and landscapes are photos from
// Wikimedia Commons' "Featured pictures" (the best photos there, chosen by vote);
// objects come from the Metropolitan Museum's open-access collection.
// ==========================================
const MET = 'https://collectionapi.metmuseum.org/public/collection/';
const COMMONS = 'https://commons.wikimedia.org/w/api.php?';
const ALL = 'all';
const LARGE_PICTURE_WAIT = 15000; // ms; a very big picture that takes longer is swapped for a smaller one

// ==========================================
// SUBJECTS
// Each subject is one or more searches.
// Wikimedia Commons: { commons: the search }. deepcat: also looks in all the smaller
//   groups inside a category; incategory: only the category itself.
// The Met: { q: the words searched for, department: which part of the museum
//   (1 American Wing, 4 Arms and Armor, 8 Costume Institute, 12 European Sculpture and
//   Decorative Arts), title: a result is only used if its title has one of these words }.
// ==========================================
const SUBJECTS = {
    'Animals': [
        { commons: 'deepcat:"Featured pictures of mammals" -incategory:"Featured pictures of mammals (bones and fossils)"' },
        { commons: 'deepcat:"Featured pictures of reptiles"' }
    ],
    'Birds': [
        { commons: 'deepcat:"Featured pictures of birds"' }
    ],
    'Flowers and plants': [
        { commons: 'deepcat:"Featured pictures of plants"' },
        { commons: 'incategory:"Featured pictures of flowers"' }
    ],
    'Landscapes': [
        { commons: 'incategory:"Featured pictures of landscapes"' }
    ],
    'Objects': [
        { q: 'teapot', department: 12, title: /\b(teapot)/i },
        { q: 'chair', department: 1, title: /\b(chair)/i },
        { q: 'vase', department: 12, title: /\b(vase)/i },
        { q: 'pitcher', department: 1, title: /\b(pitcher|jug|ewer)/i },
        { q: 'clock', department: 12, title: /\b(clock)/i },
        { q: 'helmet', department: 4, title: /\b(helmet|armet|burgonet)/i },
        { q: 'shoes', department: 8, title: /\b(shoe|boot|slipper)/i }
    ]
};

const frame = document.getElementById('timed-frame');
const image = document.getElementById('reference-image');
const borderLine = document.getElementById('time-border-line');
const message = document.getElementById('reference-message');
const caption = document.getElementById('reference-caption');
const categoryButtons = document.getElementById('category-buttons');
const nextBtn = document.getElementById('next-btn');
const timerButtons = [...document.querySelectorAll('#timer-buttons button')];
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const showCountdownToggle = document.getElementById('show-countdown-toggle');
const panZoom = document.getElementById('pan-zoom');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const crosshair = document.getElementById('crosshair');
const crosshairToggle = document.getElementById('crosshair-toggle');

// ==========================================
// IMAGES
// Find a random picture for the chosen subject and preload it, so "Next Image" is instant.
// Every source gives back the same kind of picture:
// { large, small (in case the large one fails), about, credit, link, linkText }
// ==========================================
let category = ALL;
let nextPicture = null; // preloaded, ready to show
let loadToken = 0;      // changes when the category changes, so old loads are ignored
const pools = new Map(); // search -> results not shown yet

const random = items => items[Math.floor(Math.random() * items.length)];
const getJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

// Asking too often gets you blocked for a while (the Met is strict), so results are kept
// and reused, and there is a short pause between tries.
const PAUSE = 1000; // ms
const pause = () => new Promise(resolve => setTimeout(resolve, PAUSE));

// ----- The Met: a search gives object IDs; each object is then looked up
async function metResults(search) {
    const params = new URLSearchParams({ q: search.q, departmentId: search.department, hasImages: 'true', limit: 100 });
    return (await getJson(MET + 'v1.1/search?' + params)).objectIDs || []; // its 100 best matches, asked once
}

async function metPicture(id, search) {
    const object = await getJson(MET + 'v1/objects/' + id);
    if (!object.isPublicDomain || !object.primaryImage) throw new Error('No usable picture');
    if (search.title && !search.title.test(object.title)) throw new Error('Off subject');
    return {
        large: object.primaryImage,
        small: object.primaryImageSmall,
        about: [object.title, object.artistDisplayName, object.objectDate].filter(Boolean).join(', '),
        credit: 'The Metropolitan Museum of Art, Open Access.',
        link: object.objectURL,
        linkText: 'View at the Met'
    };
}

// ----- Wikimedia Commons: one request gives 20 pictures with their sizes and credits
const LARGE_WIDTH = 1920, SMALL_WIDTH = 960; // sizes Commons keeps ready
const commonsTotals = new Map(); // search -> how many results it has

async function commonsResults(search) {
    if (!commonsTotals.has(search)) {
        const count = new URLSearchParams({ action: 'query', list: 'search', srsearch: search.commons, srnamespace: 6, srlimit: 1, format: 'json', origin: '*' });
        commonsTotals.set(search, (await getJson(COMMONS + count)).query.searchinfo.totalhits);
    }
    const offset = Math.floor(Math.random() * Math.max(1, commonsTotals.get(search) - 20)); // 20 results from a random place
    const params = new URLSearchParams({
        action: 'query', generator: 'search', gsrsearch: search.commons, gsrnamespace: 6, gsrlimit: 20, gsroffset: offset,
        prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: LARGE_WIDTH,
        iiextmetadatafilter: 'Artist|LicenseShortName|ObjectName', format: 'json', origin: '*'
    });
    return Object.values((await getJson(COMMONS + params)).query?.pages || {});
}

// The credit comes as a bit of web page; keep only its words
const plainText = html => new DOMParser().parseFromString(html || '', 'text/html').body.textContent.trim();

function commonsPicture(page) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) throw new Error('No picture');
    const shape = info.width / info.height;
    if (shape > 2.2 || shape < 0.45) throw new Error('Too long and thin to draw'); // e.g. panoramas
    const meta = info.extmetadata || {};
    const name = plainText(meta.ObjectName?.value) || page.title.replace(/^File:/, '').replace(/\.\w+$/, '');
    const artist = plainText(meta.Artist?.value);
    const licence = meta.LicenseShortName?.value;
    return {
        large: info.thumburl,
        small: info.thumburl.replace(`/${LARGE_WIDTH}px-`, `/${SMALL_WIDTH}px-`),
        about: name,
        credit: ['Photo' + (artist ? ' by ' + artist : ''), licence, 'Wikimedia Commons.'].filter(Boolean).join(', '),
        link: info.descriptionurl,
        linkText: 'View on Commons'
    };
}

// ----- Both
// One result from the search that has not been shown yet. A Commons search fetches
// another random 20 when it runs out; a Met search is only asked once.
async function nextResult(search) {
    let pool = pools.get(search);
    if (!pool || (!pool.length && search.commons)) {
        pool = search.commons ? await commonsResults(search) : await metResults(search);
        pools.set(search, pool);
    }
    if (!pool.length) throw new Error('Nothing left');
    return pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; // taken out, so it is not shown twice
}

// Resolves with the url once the picture has loaded; gives up after `wait` ms
function preloadPicture(url, wait) {
    return new Promise((resolve, reject) => {
        const preload = new Image();
        const timer = setTimeout(() => { preload.src = ''; reject(new Error('too slow')); }, wait);
        preload.onload = () => { clearTimeout(timer); resolve(url); };
        preload.onerror = () => { clearTimeout(timer); reject(new Error('failed')); };
        preload.src = url;
    });
}

async function loadPicture() {
    const search = random(category === ALL ? Object.values(SUBJECTS).flat() : SUBJECTS[category]);
    const result = await nextResult(search);
    const picture = search.commons ? commonsPicture(result) : await metPicture(result, search);
    try { picture.url = await preloadPicture(picture.large, LARGE_PICTURE_WAIT); }
    catch (error) { picture.url = await preloadPicture(picture.small, LARGE_PICTURE_WAIT); }
    return picture;
}

// Some results are left out (not public domain, off subject, too thin), so try several
async function loadRandomPicture() {
    for (let attempt = 0; attempt < 8; attempt++) {
        try { return await loadPicture(); } catch (error) { await pause(); }
    }
    return null;
}

function preloadNext() {
    const token = loadToken;
    nextPicture = null;
    loadRandomPicture().then(loaded => { if (token === loadToken) nextPicture = loaded; });
}

function showPicture(picture) {
    image.src = picture.url;
    resetView();
    frame.classList.add('visible');
    message.textContent = '';
    caption.textContent = '';
    caption.append(`${picture.about}. ${picture.credit} `);
    const link = document.createElement('a');
    link.href = picture.link;
    link.target = '_blank';
    link.textContent = picture.linkText;
    caption.append(link);
}

function showProblem() {
    frame.classList.remove('visible');
    caption.textContent = '';
    message.textContent = "Couldn't load a picture. The picture library may be busy: wait a minute, check your internet connection, and press Next Image.";
}

async function showNextImage() {
    resetTimer();
    nextBtn.disabled = true;
    if (!nextPicture) {
        frame.classList.remove('visible');
        message.textContent = 'Loading…';
    }
    const loaded = nextPicture || await loadRandomPicture();
    nextBtn.disabled = false;
    if (loaded) {
        showPicture(loaded);
        preloadNext();
    } else {
        showProblem();
    }
}

function chooseCategory(name) {
    category = name;
    loadToken++;
    nextPicture = null;
    [...categoryButtons.children].forEach(button => button.classList.toggle('active', button.dataset.category === name));
    showNextImage();
}

[ALL, ...Object.keys(SUBJECTS)].forEach(name => {
    const button = document.createElement('button');
    button.dataset.category = name;
    button.textContent = name === ALL ? 'Surprise me' : name;
    button.addEventListener('click', () => chooseCategory(name));
    categoryButtons.appendChild(button);
});
nextBtn.addEventListener('click', showNextImage);

// ==========================================
// BORDER
// A thin line all the way round the picture. It starts at the top-left corner and
// runs clockwise; as time passes it shrinks back towards that corner.
// (pathLength="100" in the HTML lets us give the length as a percentage.)
// ==========================================
const LINE_WIDTH = 4;

// Fit the line to the frame whenever the picture changes size
function fitBorder() {
    const inset = LINE_WIDTH / 2;
    borderLine.setAttribute('x', inset);
    borderLine.setAttribute('y', inset);
    borderLine.setAttribute('width', Math.max(0, frame.clientWidth - LINE_WIDTH));
    borderLine.setAttribute('height', Math.max(0, frame.clientHeight - LINE_WIDTH));
}
new ResizeObserver(fitBorder).observe(frame);

// fraction: 1 = whole border, 0 = none
function setBorder(fraction) {
    borderLine.style.strokeDasharray = `${fraction * 100} 101`;
}

// ==========================================
// TIMER
// Counts down from the chosen length. A soft chime sounds at zero, so you never
// need to look at the screen.
// ==========================================
let chosenSeconds = 600;
let secondsLeft = chosenSeconds;
let endTime = null; // set while running
let tick = null;
let audio = null;

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    return minutes + ':' + String(Math.ceil(seconds % 60)).padStart(2, '0');
}

function updateDisplay() {
    const show = showCountdownToggle.checked;
    const left = Math.ceil(secondsLeft);
    timerDisplay.textContent = show ? formatTime(left) : (chosenSeconds / 60) + ' min';
    document.title = (show && endTime ? formatTime(left) + ' | ' : '') + 'Timed Sketch | Drawing Tools';
    setBorder(secondsLeft / chosenSeconds);
}

// Two gentle beeps (Web Audio, no sound file needed)
function chime() {
    if (!audio) return;
    [0, 0.5].forEach(delay => {
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();
        const start = audio.currentTime + delay;
        oscillator.frequency.value = 660;
        volume.gain.setValueAtTime(0.0001, start);
        volume.gain.exponentialRampToValueAtTime(0.25, start + 0.05);
        volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        oscillator.connect(volume).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.5);
    });
}

function stopTicking() {
    clearInterval(tick);
    tick = null;
    endTime = null;
}

function resetTimer() {
    stopTicking();
    secondsLeft = chosenSeconds;
    startBtn.textContent = 'Start';
    timerDisplay.classList.remove('finished');
    updateDisplay();
}

function startTimer() {
    if (secondsLeft <= 0) resetTimer();
    audio = audio || new AudioContext(); // created on a click, as browsers require
    endTime = Date.now() + secondsLeft * 1000;
    startBtn.textContent = 'Pause';
    // Every half second, matching the border's 0.5 s transition, so it creeps smoothly
    tick = setInterval(() => {
        secondsLeft = Math.max(0, (endTime - Date.now()) / 1000);
        if (secondsLeft === 0) {
            stopTicking();
            startBtn.textContent = 'Start';
            timerDisplay.classList.add('finished');
            chime();
        }
        updateDisplay();
    }, 500);
}

function pauseTimer() {
    stopTicking();
    startBtn.textContent = 'Start';
    updateDisplay();
}

function chooseLength(seconds) {
    chosenSeconds = seconds;
    timerButtons.forEach(button => button.classList.toggle('active', Number(button.dataset.seconds) === seconds));
    resetTimer();
}

timerButtons.forEach(button => button.addEventListener('click', () => chooseLength(Number(button.dataset.seconds))));
startBtn.addEventListener('click', () => (endTime ? pauseTimer() : startTimer()));
resetBtn.addEventListener('click', resetTimer);
showCountdownToggle.addEventListener('change', updateDisplay);

// ==========================================
// MOVE AND ZOOM
// The frame is your canvas: it stays still, and the picture moves and zooms inside it,
// so you can choose how the subject sits on the page. The picture always fills the
// frame (no empty edges). Position is kept as a fraction of the frame's size, so it
// stays put when the window is resized.
// ==========================================
const MAX_ZOOM = 6;
const BUTTON_STEP = 1.25; // each Zoom in / Zoom out click
let zoom = 1, left = 0, top = 0; // left/top: where the picture's corner is, as a fraction of the frame (0 or less)

function applyView() {
    // keep the picture covering the whole frame
    zoom = Math.min(MAX_ZOOM, Math.max(1, zoom));
    left = Math.min(0, Math.max(1 - zoom, left));
    top = Math.min(0, Math.max(1 - zoom, top));
    const width = panZoom.clientWidth, height = panZoom.clientHeight;
    image.style.transform = `translate(${left * width}px, ${top * height}px) scale(${zoom})`;
}

function resetView() {
    zoom = 1; left = 0; top = 0;
    applyView();
}

// Zoom by `factor`, keeping the point (x, y) of the frame (fractions, 0 to 1) still
function zoomAt(factor, x, y) {
    const newZoom = Math.min(MAX_ZOOM, Math.max(1, zoom * factor));
    left = x - (x - left) * newZoom / zoom;
    top = y - (y - top) * newZoom / zoom;
    zoom = newZoom;
    applyView();
}

// Drag to move
let drag = null;
panZoom.addEventListener('pointerdown', event => {
    panZoom.setPointerCapture(event.pointerId);
    panZoom.classList.add('dragging');
    drag = { x: event.clientX, y: event.clientY, left, top };
});
panZoom.addEventListener('pointermove', event => {
    if (!drag) return;
    left = drag.left + (event.clientX - drag.x) / panZoom.clientWidth;
    top = drag.top + (event.clientY - drag.y) / panZoom.clientHeight;
    applyView();
});
const endDrag = () => { drag = null; panZoom.classList.remove('dragging'); };
panZoom.addEventListener('pointerup', endDrag);
panZoom.addEventListener('pointercancel', endDrag);

// Scroll wheel or trackpad pinch to zoom, towards the pointer
panZoom.addEventListener('wheel', event => {
    event.preventDefault();
    const box = panZoom.getBoundingClientRect();
    zoomAt(Math.exp(-event.deltaY * 0.002), (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
}, { passive: false });

zoomInBtn.addEventListener('click', () => zoomAt(BUTTON_STEP, 0.5, 0.5));
zoomOutBtn.addEventListener('click', () => zoomAt(1 / BUTTON_STEP, 0.5, 0.5));
resetViewBtn.addEventListener('click', resetView);
new ResizeObserver(applyView).observe(panZoom);

// ==========================================
// CROSSHAIR
// A thin cross through the middle of the frame, splitting it into quarters, to check
// proportions against the same quarters on your paper. It stays still when the picture moves. Off whenever the page opens.
// ==========================================
crosshairToggle.checked = false;
crosshairToggle.addEventListener('change', () => crosshair.classList.toggle('on', crosshairToggle.checked));

// ==========================================
// START
// ==========================================
chooseLength(chosenSeconds);
chooseCategory(ALL);
