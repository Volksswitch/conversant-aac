import * as tts from './tts.js';
import * as storage from './storage.js';

let fillers = [];
let timer = null;
let active = false;
let lastSpoken = -1;

async function loadFillers() {
    if (fillers.length > 0) return;
    const response = await fetch('data/placeholders.json');
    fillers = await response.json();
}

function pickRandom() {
    if (fillers.length <= 1) return 0;
    let index;
    do {
        index = Math.floor(Math.random() * fillers.length);
    } while (index === lastSpoken);
    return index;
}

export async function start() {
    stop();
    await loadFillers();
    active = true;
    const { initialDelay } = storage.loadPlaceholderSettings();
    timer = setTimeout(speakAndScheduleNext, initialDelay * 1000);
}

export function stop() {
    active = false;
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    tts.cancel();
}

async function speakAndScheduleNext() {
    if (!active) return;
    lastSpoken = pickRandom();
    await tts.speak(fillers[lastSpoken]);

    if (!active) return;
    const { subsequentDelay } = storage.loadPlaceholderSettings();
    timer = setTimeout(speakAndScheduleNext, subsequentDelay * 1000);
}
