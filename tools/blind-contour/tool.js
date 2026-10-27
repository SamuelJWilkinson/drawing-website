// ==========================================
// BLIND CONTOUR
// Shows a reference image from the Metropolitan Museum's open-access collection,
// plus a countdown timer. You draw on paper; nothing is drawn on screen.
// subjects.json lists hand-picked Met object IDs per category.
// ==========================================
const MET_OBJECT_URL = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/';
const ALL = 'all';

const subjects = await fetch('subjects.json').then(r => r.json());

const image = document.getElementById('reference-image');
const message = document.getElementById('reference-message');
const caption = document.getElementById('reference-caption');
const categoryButtons = document.getElementById('category-buttons');
const nextBtn = document.getElementById('next-btn');
const timerButtons = [...document.querySelectorAll('#timer-buttons button')];
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const hideCountdownToggle = document.getElementById('hide-countdown-toggle');

// ==========================================
// IMAGES
// Fetch one random artwork from the chosen category and preload its picture,
// so "Next Image" is instant.
// ==========================================
let category = ALL;
let currentId = null;
let nextArtwork = null; // preloaded, ready to show
let loadToken = 0;      // changes when the category changes, so old loads are ignored

function pickId() {
    const ids = category === ALL ? Object.values(subjects).flat() : subjects[category];
    let id;
    do { id = ids[Math.floor(Math.random() * ids.length)]; } while (id === currentId && ids.length > 1);
    return id;
}

async function loadArtwork(id) {
    const data = await fetch(MET_OBJECT_URL + id).then(r => r.json());
    if (!data.isPublicDomain || !data.primaryImageSmall) throw new Error('No usable image for ' + id);
    await new Promise((resolve, reject) => {
        const preload = new Image();
        preload.onload = resolve;
        preload.onerror = reject;
        preload.src = data.primaryImageSmall;
    });
    return { id, data };
}

// Try a few random picks in case one fails
async function loadRandomArtwork() {
    for (let attempt = 0; attempt < 3; attempt++) {
        try { return await loadArtwork(pickId()); } catch (error) { /* try another */ }
    }
    return null;
}

function preloadNext() {
    const token = loadToken;
    nextArtwork = null;
    loadRandomArtwork().then(artwork => { if (token === loadToken) nextArtwork = artwork; });
}

function showArtwork({ id, data }) {
    currentId = id;
    image.src = data.primaryImageSmall;
    image.classList.add('visible');
    message.textContent = '';
    caption.textContent = '';
    const artist = data.artistDisplayName ? ', ' + data.artistDisplayName : '';
    caption.append(`${data.title}${artist}, ${data.objectDate}. The Metropolitan Museum of Art, Open Access. `);
    const link = document.createElement('a');
    link.href = data.objectURL;
    link.target = '_blank';
    link.textContent = 'View at the Met';
    caption.append(link);
}

function showProblem() {
    image.classList.remove('visible');
    caption.textContent = '';
    message.textContent = "Couldn't load an image. Check your internet connection and press Next Image.";
}

async function showNextImage() {
    resetTimer();
    nextBtn.disabled = true;
    if (!nextArtwork) {
        image.classList.remove('visible');
        message.textContent = 'Loading…';
    }
    const artwork = nextArtwork || await loadRandomArtwork();
    nextBtn.disabled = false;
    if (artwork) {
        showArtwork(artwork);
        preloadNext();
    } else {
        showProblem();
    }
}

function chooseCategory(name) {
    category = name;
    loadToken++;
    nextArtwork = null;
    [...categoryButtons.children].forEach(button => button.classList.toggle('active', button.dataset.category === name));
    showNextImage();
}

[ALL, ...Object.keys(subjects)].forEach(name => {
    const button = document.createElement('button');
    button.dataset.category = name;
    button.textContent = name === ALL ? 'Surprise me' : name;
    button.addEventListener('click', () => chooseCategory(name));
    categoryButtons.appendChild(button);
});
nextBtn.addEventListener('click', showNextImage);

// ==========================================
// TIMER
// Counts down from the chosen length. A soft chime sounds at zero, so you never
// need to look at the screen.
// ==========================================
let chosenSeconds = 180;
let secondsLeft = chosenSeconds;
let endTime = null; // set while running
let tick = null;
let audio = null;

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    return minutes + ':' + String(seconds % 60).padStart(2, '0');
}

function updateDisplay() {
    const hidden = hideCountdownToggle.checked;
    timerDisplay.textContent = hidden ? '•••' : formatTime(secondsLeft);
    document.title = (!hidden && endTime ? formatTime(secondsLeft) + ' | ' : '') + 'Blind Contour | Drawing Tools';
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
    tick = setInterval(() => {
        secondsLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        if (secondsLeft === 0) {
            stopTicking();
            startBtn.textContent = 'Start';
            timerDisplay.classList.add('finished');
            chime();
        }
        updateDisplay();
    }, 250);
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
hideCountdownToggle.addEventListener('change', updateDisplay);

// ==========================================
// START
// ==========================================
chooseLength(chosenSeconds);
chooseCategory(ALL);
