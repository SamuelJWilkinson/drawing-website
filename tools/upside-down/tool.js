// ==========================================
// UPSIDE DOWN
// Shows a line drawing upside down, plus a countdown timer. You copy it on paper.
// The pictures are already rotated 180° inside their files (see pipeline/), so the
// upside-down view never depends on CSS. Reveal adds a CSS rotation to turn one upright.
// manifest.json lists the drawings. reveal.json (credits) is only loaded at Reveal.
// Ratings and skips are saved in this browser and decide how often each drawing appears.
// ==========================================
const STORAGE_KEY = 'upside-down-ratings';
const RECENT = 5; // a drawing is not repeated within this many
const RATING_WEIGHT = { 1: 0.02, 2: 0.3, 3: 1, 4: 2, 5: 3 }; // unrated drawings count as 1
const SKIP_WEIGHT = 0.3; // each skip makes a drawing this much less likely

const manifest = await fetch('manifest.json').then(r => r.json()).catch(() => ({ drawings: [] }));
const drawings = manifest.drawings || [];

const image = document.getElementById('reference-image');
const message = document.getElementById('reference-message');
const caption = document.getElementById('reference-caption');
const referenceArea = document.getElementById('reference-area');
const skipBtn = document.getElementById('skip-btn');
const nextBtn = document.getElementById('next-btn');
const revealBtn = document.getElementById('reveal-btn');
const ratingPanel = document.getElementById('rating-panel');
const ratingButtons = [...document.querySelectorAll('#rating-buttons button')];
const libraryNote = document.getElementById('library-note');
const timerButtons = [...document.querySelectorAll('#timer-buttons button')];
const timerDisplay = document.getElementById('timer-display');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const hideCountdownToggle = document.getElementById('hide-countdown-toggle');

// ==========================================
// NO DOWNLOADS
// The drawing can't be right-clicked, dragged or selected, so it can't be opened in a new tab.
// ==========================================
['contextmenu', 'dragstart', 'selectstart'].forEach(name => referenceArea.addEventListener(name, event => event.preventDefault()));

// ==========================================
// RATINGS
// ratings[id] = { rating: 1-5 (0 if unrated), skips: number }
// ==========================================
let ratings = {};
try { ratings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (error) { /* start empty */ }

function saveRatings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings)); } catch (error) { /* still works this visit */ }
}

function entryFor(id) {
    ratings[id] = ratings[id] || { rating: 0, skips: 0 };
    return ratings[id];
}

function weightOf(id) {
    const entry = ratings[id] || { rating: 0, skips: 0 };
    const base = entry.rating ? RATING_WEIGHT[entry.rating] : 1;
    return base * Math.pow(SKIP_WEIGHT, entry.skips);
}

function updateLibraryNote() {
    const rare = drawings.filter(d => weightOf(d.id) < 0.1).length;
    libraryNote.textContent = drawings.length
        ? `${drawings.length} drawings` + (rare ? `, ${rare} rarely shown` : '') + '.'
        : '';
}

// ==========================================
// CHOOSING A DRAWING
// Random, but liked drawings come up more and skipped or low-rated ones less.
// ==========================================
let current = null;
let revealed = false;
let recent = [];     // ids shown lately
let revealData = null; // credits, loaded the first time you press Reveal

// How many recent drawings to avoid: at most half the library, so ratings still decide in a small one
function recentWindow() {
    return Math.max(1, Math.min(RECENT, Math.floor(drawings.length / 2) - 1));
}

function pickDrawing() {
    let pool = drawings.filter(d => !recent.includes(d.id));
    if (pool.length === 0) pool = drawings.filter(d => d !== current);
    if (pool.length === 0) pool = drawings;
    const total = pool.reduce((sum, d) => sum + weightOf(d.id), 0);
    let point = Math.random() * total;
    for (const drawing of pool) {
        point -= weightOf(drawing.id);
        if (point <= 0) return drawing;
    }
    return pool[pool.length - 1];
}

// ==========================================
// SHOWING THE DRAWING
// The picture only becomes visible once it has loaded. The title and credit stay empty until Reveal.
// ==========================================
function showDrawing(drawing) {
    current = drawing;
    revealed = false;
    recent = [...recent, drawing.id].slice(-recentWindow());
    image.classList.remove('visible', 'revealed');
    image.alt = '';
    caption.textContent = '';
    ratingPanel.hidden = true;
    ratingButtons.forEach(button => button.classList.remove('active'));
    revealBtn.disabled = false;
    skipBtn.disabled = false;
    message.textContent = 'Loading…';
    image.onload = () => {
        image.classList.add('visible');
        message.textContent = '';
    };
    image.onerror = () => { // a file that won't load counts as a skip, so it fades away
        entryFor(drawing.id).skips += 1;
        saveRatings();
        showNextDrawing();
    };
    image.src = drawing.file;
}

function showNextDrawing() {
    resetTimer();
    updateLibraryNote();
    if (drawings.length === 0) {
        message.textContent = 'No drawings yet. Run the "Collect drawings" workflow on GitHub, then merge its pull request.';
        revealBtn.disabled = true;
        skipBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }
    showDrawing(pickDrawing());
}

function skipCurrent() {
    if (!current) return;
    entryFor(current.id).skips += 1;
    saveRatings();
    showNextDrawing();
}

// Reveal: turn it upright and show the credit
async function reveal() {
    if (!current || revealed) return;
    revealed = true;
    stopTicking();
    startBtn.textContent = 'Start';
    updateDisplay();
    image.classList.add('revealed');
    revealBtn.disabled = true;
    skipBtn.disabled = true;
    ratingPanel.hidden = false;
    const shown = current;
    revealData = revealData || await fetch('reveal.json').then(r => r.json()).catch(() => ({}));
    const info = revealData[shown.id];
    if (info && current === shown && info.creditUrl) {
        const link = document.createElement('a');
        link.href = info.creditUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = info.credit;
        caption.append(link);
    } else if (info && current === shown) {
        caption.textContent = info.credit; // no link for this one
    }
}

function rate(rating) {
    if (!current || !revealed) return;
    entryFor(current.id).rating = rating;
    saveRatings();
    ratingButtons.forEach(button => button.classList.toggle('active', Number(button.dataset.rating) === rating));
    updateLibraryNote();
}

skipBtn.addEventListener('click', skipCurrent);
nextBtn.addEventListener('click', showNextDrawing);
revealBtn.addEventListener('click', reveal);
ratingButtons.forEach(button => button.addEventListener('click', () => rate(Number(button.dataset.rating))));

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
    return minutes + ':' + String(seconds % 60).padStart(2, '0');
}

function updateDisplay() {
    const hidden = hideCountdownToggle.checked;
    timerDisplay.textContent = hidden ? '•••' : formatTime(secondsLeft);
    document.title = (!hidden && endTime ? formatTime(secondsLeft) + ' | ' : '') + 'Upside Down | Drawing Tools';
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
showNextDrawing();
