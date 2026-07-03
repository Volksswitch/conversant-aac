import * as tts from './tts.js';
import * as storage from './storage.js';

/* Floor-holding placeholders — role-differentiated by position (Ken, June 18
 * 2026).
 *
 * Timing model (Ken, June 28 2026): the initial-delay clock starts when the
 * partner STOPS speaking (the silence checkpoint), not when the AI's options
 * arrive. arm() is called at the checkpoint to start that clock; start() is
 * called once the classification comes back AND the partner's action warrants a
 * placeholder (a question — the gating lives in app.js). start() then plays the first
 * placeholder as soon as the armed initial delay has elapsed — which may be
 * immediately if the AI round-trip was slow, so a long generation no longer
 * leaves dead air. A quick selection cancels everything via stop(). Holding the
 * utterance until classification keeps placeholders off statements/closings.
 *
 * Why role-differentiated: a small flat pool makes two sequential placeholders sound
 * stupid — "That's interesting." right after "Hmm, interesting." even when they
 * aren't the identical string (semantic clustering). The fix is structural: the
 * first and any later placeholder do DIFFERENT jobs, so a long window progresses
 * naturally instead of echoing:
 *   - acknowledgment  ("Good question.", "Let me see.")  — "I heard you, I'm on it"
 *   - thinking        ("Still thinking it through.")     — "still working on it"
 * The first placeholder is drawn from `acknowledgment`, every later one from
 * `thinking`. Combined with a CAP (Settings "Maximum placeholders per turn",
 * default 2) you hear at most one acknowledgment + one thinking placeholder — never
 * two same-category placeholders back to back. After the cap we go quiet; silence
 * after "Good question… still thinking it through" reads fine, and the user
 * still has the manual "Hold on" button.
 *
 * Phrases must stay neutral/reflective, never imperative or directed at the
 * partner ("Let me think", "Give me a second", "Hold on") — flat built-in voices
 * make those read as curt. The pools live in data/placeholders.json (a
 * { acknowledgment:[], thinking:[] } object) and will become user-editable
 * later. start()/stop() keep the signature app.js calls.
 */

// Inline fallback if data/placeholders.json fails to load.
const FALLBACK_POOLS = {
    acknowledgment: [
        'Good question.',
        "That's a good question.",
        "That's a fair question.",
        'Let me see.',
    ],
    thinking: [
        'Still thinking it through.',
        "I'm working out what I want to say.",
        'Putting my thoughts together.',
        'Still mulling that over.',
    ],
};

let pools = null;            // { acknowledgment:[], thinking:[] }
let timer = null;
let active = false;
let count = 0;               // placeholders spoken this window (for role + cap)
let lastIndex = { acknowledgment: -1, thinking: -1 };
let armTime = 0;             // when the partner stopped (initial-delay clock origin)
let armed = false;           // arm() was called and start() hasn't consumed it

// Accept the role-keyed object shape; tolerate a legacy flat array by using it
// for both roles so an old file still works.
function normalizePools(data) {
    if (Array.isArray(data) && data.length) {
        return { acknowledgment: data.slice(), thinking: data.slice() };
    }
    if (data && typeof data === 'object') {
        const ack = Array.isArray(data.acknowledgment) ? data.acknowledgment : [];
        const think = Array.isArray(data.thinking) ? data.thinking : [];
        if (ack.length || think.length) {
            return {
                acknowledgment: ack.length ? ack : think,
                thinking: think.length ? think : ack,
            };
        }
    }
    return null;
}

async function loadPools() {
    if (pools) return;
    try {
        const data = await fetch('data/placeholders.json').then(r => r.json());
        pools = normalizePools(data);
    } catch { /* fall back below */ }
    if (!pools) pools = { acknowledgment: FALLBACK_POOLS.acknowledgment.slice(),
                          thinking: FALLBACK_POOLS.thinking.slice() };
}

// Pick from a role's list, avoiding the immediately-previous phrase in that role.
function pickFrom(role) {
    const list = (pools[role] && pools[role].length) ? pools[role]
               : (pools.thinking && pools.thinking.length) ? pools.thinking
               : pools.acknowledgment || [];
    if (!list.length) return null;
    if (list.length === 1) { lastIndex[role] = 0; return list[0]; }
    let index;
    do {
        index = Math.floor(Math.random() * list.length);
    } while (index === lastIndex[role]);
    lastIndex[role] = index;
    return list[index];
}

// Called at the silence checkpoint (partner stopped). Starts the initial-delay
// clock and resets per-window state, but speaks nothing yet — start() decides
// whether this window warrants placeholders once the classification is known.
export function arm() {
    if (timer) { clearTimeout(timer); timer = null; }
    active = false;
    armed = true;
    armTime = Date.now();
    count = 0;
    lastIndex = { acknowledgment: -1, thinking: -1 };
    loadPools().catch(() => { /* fallback handled in loadPools */ });
}

export async function start() {
    if (timer) { clearTimeout(timer); timer = null; }
    const { initialDelay, maxPlaceholders } = storage.loadPlaceholderSettings();
    // 0 = the user wants no placeholders at all (they read as artificial).
    if (maxPlaceholders === 0) { active = false; armed = false; return; }
    active = true;
    count = 0;
    lastIndex = { acknowledgment: -1, thinking: -1 };
    loadPools().catch(() => { /* fallback handled in loadPools */ });
    // The clock started at the partner's pause (arm()); if start() is reached
    // without an arm (defensive), measure from now. The first placeholder waits only
    // the remainder of initialDelay — so a slow AI round-trip that already ate
    // the delay plays the first placeholder immediately instead of leaving silence.
    const base = armed ? armTime : Date.now();
    armed = false;
    const firstDelay = Math.max(0, initialDelay * 1000 - (Date.now() - base));
    timer = setTimeout(speakNext, firstDelay);
}

export function stop() {
    active = false;
    armed = false;
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    tts.cancel();
}

async function speakNext() {
    if (!active) return;
    if (!pools) {
        try { await loadPools(); } catch { /* ignore */ }
    }
    if (!active || !pools) return;
    // Role by position: first placeholder acknowledges, later ones say "still thinking".
    const role = count === 0 ? 'acknowledgment' : 'thinking';
    const phrase = pickFrom(role);
    count++;
    if (phrase) await tts.speak(phrase);
    if (!active) return;
    // Cap: stop after maxPlaceholders placeholders. -1 = no limit (0 = none is
    // handled in start(), which never schedules a first placeholder).
    const { maxPlaceholders } = storage.loadPlaceholderSettings();
    if (maxPlaceholders >= 1 && count >= maxPlaceholders) return;
    scheduleNext();
}

function scheduleNext() {
    const { subsequentDelay } = storage.loadPlaceholderSettings();
    timer = setTimeout(speakNext, subsequentDelay * 1000);
}
