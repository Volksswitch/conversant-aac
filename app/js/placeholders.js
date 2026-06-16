import * as tts from './tts.js';
import * as storage from './storage.js';

/* Filler ladder (Conversation-Engine-Design.docx §6), timed by the user's
 * Settings (Ken, June 16 2026 — the §6 fixed-constant timings started the first
 * filler too soon and re-filled too soon):
 *   Rung 1  Acknowledgment token ("Hmm.", "Ah.", "Good question.") — the FIRST
 *           placeholder. Spoken so it lands the user's "Initial Placeholder
 *           Statement Delay" seconds after the partner FINISHES speaking. Since
 *           the silence checkpoint that triggers this already consumed the
 *           silence-period seconds of that wait, rung 1 waits the remainder
 *           (initialDelay − silencePeriod), floored at a small minimum.
 *   Rung 2+ Projection filler ("Give me a second.", "Still thinking…") from
 *           placeholders.json, re-filled every "Subsequent Placeholder Statement
 *           Delay" seconds while the user chooses, never the same phrase twice
 *           in a row.
 *
 * start()/stop() keep the same signature the app already calls. The whole
 * ladder is torn down the moment a response is selected or the partner repeats.
 */

// Rung 1 — short acknowledgment tokens. Inline (no fetch) so no round-trip
// delays the first placeholder.
const ACK_TOKENS = [
    'Hmm.', 'Ah.', 'Good question.', 'Right.', 'Okay.', 'Let me think.',
    'Oh.', 'Mm.', 'I see.', 'Well…',
];

// Floor for the rung-1 delay when the initial-delay setting is at/below the
// silence period, so the first filler never fires effectively instantly.
const MIN_RUNG1_DELAY = 500; // ms after the silence checkpoint

let fillers = [];           // rung 2/3 projection pool (from JSON)
let timer = null;
let active = false;
let lastAck = -1;
let lastFiller = -1;

async function loadFillers() {
    if (fillers.length > 0) return;
    const response = await fetch('data/placeholders.json');
    fillers = await response.json();
}

function pick(list, last) {
    if (list.length <= 1) return 0;
    let index;
    do {
        index = Math.floor(Math.random() * list.length);
    } while (index === last);
    return index;
}

export async function start() {
    stop();
    active = true;
    // Kick off the projection pool load in parallel; rung 1 doesn't wait on it.
    loadFillers().catch(() => { /* rung 1 still works without it */ });
    // First placeholder lands initialDelay seconds after the partner finished.
    // The silence checkpoint already consumed silencePeriod of that, so wait
    // the remainder here.
    const { initialDelay } = storage.loadPlaceholderSettings(); // seconds
    const silencePeriod = storage.loadSilenceThreshold();        // seconds
    const rung1Delay = Math.max(MIN_RUNG1_DELAY, (initialDelay - silencePeriod) * 1000);
    timer = setTimeout(rung1, rung1Delay);
}

export function stop() {
    active = false;
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    tts.cancel();
}

// Rung 1 — the first placeholder: a short acknowledgment token, no LLM. The
// next placeholder follows one subsequentDelay later.
async function rung1() {
    if (!active) return;
    lastAck = pick(ACK_TOKENS, lastAck);
    await tts.speak(ACK_TOKENS[lastAck]);
    if (!active) return;
    scheduleRefill();
}

// Rung 2+ — projection filler re-filled every subsequentDelay while the user
// chooses a response.
async function refill() {
    if (!active) return;
    await speakFiller();
    if (!active) return;
    scheduleRefill();
}

function scheduleRefill() {
    const { subsequentDelay } = storage.loadPlaceholderSettings();
    timer = setTimeout(refill, subsequentDelay * 1000);
}

async function speakFiller() {
    if (fillers.length === 0) {
        try { await loadFillers(); } catch { return; }
    }
    if (fillers.length === 0) return;
    lastFiller = pick(fillers, lastFiller);
    await tts.speak(fillers[lastFiller]);
}
