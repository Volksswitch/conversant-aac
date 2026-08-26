import * as tts from './tts.js';
import * as storage from './storage.js';
import * as phrasePools from './placeholder-phrases.js';

/* Floor-holding placeholders — role-differentiated by position (Ken, June 18
 * 2026).
 *
 * Timing model (Ken, August 7 2026): placeholders are gated by PARTNER SILENCE
 * and terminated by USER SPEECH. They have nothing to do with the AI round-trip.
 * arm() is called at the silence checkpoint and schedules the first placeholder
 * initialDelay seconds later; the partner resuming aborts the ladder, a selection
 * cancels it, and the user speaking anything stops it.
 *
 * That is what this always intended, but not what it did between June 28 and
 * August 7 2026: arm() only recorded a timestamp and start() — reached only after
 * the classification returned, about 4 seconds — was what scheduled the speech,
 * waiting `initialDelay` MINUS the elapsed time. So the first placeholder actually
 * landed at max(initialDelay, round-trip), and with the old 4s default those were
 * the same moment, which hid it. The AI dependency existed for one reason: the
 * pool was split into question-flavored and neutral phrases, and you cannot know
 * which to use until the partner's action is classified. Making every phrase
 * partner-statement independent removes the question, and with it the gate.
 *
 * Why role-differentiated: a small flat pool makes two sequential placeholders sound
 * stupid — "That's interesting." right after "Hmm, interesting." even when they
 * aren't the identical string (semantic clustering). The fix is structural: the
 * first and any later placeholder do DIFFERENT jobs, so a long window progresses
 * naturally instead of echoing:
 *   - acknowledgment  ("I'm thinking about that.")    — "I heard you, I'm on it"
 *   - thinking        ("Still thinking it through.")  — "still working on it"
 * The first placeholder is drawn from `acknowledgment`, every later one from
 * `thinking`. Combined with a CAP (Settings "Maximum placeholders per turn",
 * default 2) you hear at most one acknowledgment + one thinking placeholder — never
 * two same-category placeholders back to back. After the cap we go quiet; silence
 * after "I'm thinking about that… still thinking it through" reads fine, and the
 * user still has the manual "Hold on" button.
 *
 * Two standing constraints on the phrases themselves, both load-bearing:
 *   1. PARTNER-STATEMENT INDEPENDENT — each must read correctly after a question,
 *      a statement, an assessment or a greeting, because nothing knows which it
 *      was. This is what decouples the ladder from the AI.
 *   2. Declarative and first-person — never imperative, never directed at the
 *      partner ("Let me think", "Give me a second", "One moment") — flat built-in
 *      voices make those read as curt or annoyed.
 * The pools are USER-EDITABLE (Settings -> Placeholders) and live in
 * placeholder-phrases.js, which owns the file and the defaults. They are read at
 * the moment of speaking, so an edit lands on the next phrase. start()/stop() keep
 * the signature app.js calls.
 */

let timer = null;
let active = false;
let count = 0;               // placeholders spoken this window (for role + cap)
let lastIndex = { acknowledgment: -1, thinking: -1 };
let armTime = 0;             // when the partner stopped (initial-delay clock origin)
let armed = false;           // arm() was called and start() hasn't consumed it
// A gate the app sets so a placeholder never speaks OVER the user's own statement
// (a spoken command / response / Express phrase). Pressing a speaking button must
// abort placeholders instantly (Ken, July 2026) — this is the hard backstop even
// if a stray scheduled placeholder fires while the user's TTS is playing.
let userSpeaking = () => false;
export function setUserSpeakingGate(fn) { userSpeaking = typeof fn === 'function' ? fn : () => false; }

// Told when a placeholder is actually about to be spoken, with its position in the
// ladder. Reporting only — the app uses it to count how often the floor-holding
// phrases are heard, which is otherwise invisible and is the number behind "do
// partners tire of them". Deliberately a notification and not a gate: nothing it
// does may change whether the phrase is said.
let onSpoken = () => {};
export function setOnSpoken(fn) { onSpoken = typeof fn === 'function' ? fn : () => {}; }

// Read the user's pools, dropping blank entries.
//
// Blanks are kept by the model because the editor needs an empty row to type into;
// they must be dropped HERE, at the point of speaking, or a half-finished edit
// becomes a moment of silence exactly where a floor-holder was expected. If the
// user has emptied a pool outright, fall back to the other one rather than going
// quiet — an acknowledgment in place of a "still thinking" reads fine, whereas
// nothing at all is the failure this whole ladder exists to prevent.
function readPools() {
    const p = phrasePools.getPools();
    const clean = (list) => list.map((s) => String(s || '').trim()).filter(Boolean);
    const acknowledgment = clean(p.acknowledgment);
    const thinking = clean(p.thinking);
    if (!acknowledgment.length && !thinking.length) return null;
    return {
        acknowledgment: acknowledgment.length ? acknowledgment : thinking.slice(),
        thinking: thinking.length ? thinking : acknowledgment.slice(),
    };
}

// Pick from a list, avoiding the immediately-previous phrase for that key.
function pick(list, key) {
    if (!list || !list.length) return null;
    if (list.length === 1) { lastIndex[key] = 0; return list[0]; }
    let index;
    do {
        index = Math.floor(Math.random() * list.length);
    } while (index === lastIndex[key]);
    lastIndex[key] = index;
    return list[index];
}

// Called at the silence checkpoint (partner stopped). SCHEDULES the first
// placeholder here, initialDelay after the pause, using the neutral acknowledgment.
//
// It no longer waits for the AI's classification (Ken, August 7 2026), because
// waiting made the setting inert: start() is only reached once the round-trip
// returns — about 4 seconds — so the old `initialDelay - elapsed` remainder was
// already <= 0 and the first placeholder fired on arrival no matter what the user
// had set. Lowering the default from 4s to 2s would have changed nothing. Firing
// on the timer is the only way a 2s setting produces a 2s placeholder when the AI
// takes 4s, which is the whole point of a floor-holder.
//
// Speaking without knowing the turn type is safe because every acknowledgment
// phrase is partner-statement independent (see placeholder-phrases.js). The one turn that
// warrants no placeholder at all — a repair-initiator ("What?") — is only
// identifiable from the classification, so on a slow round-trip one acknowledgment
// can precede the re-speak; app.js stops the ladder as soon as it knows. A mild
// redundancy on one turn type, against silence for the whole round-trip on every
// other one.
export function arm() {
    if (timer) { clearTimeout(timer); timer = null; }
    armed = true;
    armTime = Date.now();
    count = 0;
    lastIndex = { acknowledgment: -1, thinking: -1 };
    const { initialDelay, maxPlaceholders } = storage.loadPlaceholderSettings();
    // 0 = the user wants no placeholders at all (they read as artificial).
    if (maxPlaceholders === 0) { active = false; return; }
    active = true;
    timer = setTimeout(speakNext, Math.max(0, initialDelay * 1000));
}

// Called once the classification is back and the turn warrants placeholders.
// Normally a NO-OP that just consumes the armed flag: arm() has already scheduled
// (and may already have spoken) the first placeholder, and since every phrase is
// partner-statement independent there is nothing about the turn type left to
// decide. It stays because app.js's contract is arm-then-start-or-stop, and
// because the defensive path below still has to work if start() is ever reached
// without a preceding arm().
export async function start() {
    const { initialDelay, maxPlaceholders } = storage.loadPlaceholderSettings();
    // 0 = the user wants no placeholders at all (they read as artificial).
    if (maxPlaceholders === 0) { stop(); return; }
    if (active) { armed = false; return; }   // arm() is already driving the ladder
    // Defensive: start() without a preceding arm(). Measure the remainder from the
    // pause if we have one, else from now.
    if (timer) { clearTimeout(timer); timer = null; }
    const base = armed ? armTime : Date.now();
    armed = false;
    active = true;
    count = 0;
    lastIndex = { acknowledgment: -1, thinking: -1 };
    timer = setTimeout(speakNext, Math.max(0, initialDelay * 1000 - (Date.now() - base)));
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
    // Read the pools at the moment of speaking rather than caching them at arm().
    // They are user-editable now, so an edit made in Settings takes effect on the
    // very next phrase instead of at the next reload.
    const pools = readPools();
    if (!active || !pools) return;
    // Never speak over the user's own statement (a spoken button). If one is
    // playing right now, try again after the normal interval rather than barging
    // in and cancelling it. No await between here and tts.speak below, so this one
    // check holds until we actually speak.
    if (userSpeaking()) { scheduleNext(); return; }
    // Role by position: the first placeholder acknowledges, later ones say
    // "still thinking". Both pools are partner-statement independent, so neither
    // needs to know what kind of turn this was.
    const phrase = count === 0
        ? pick(pools.acknowledgment, 'acknowledgment')
        : pick(pools.thinking, 'thinking');
    count++;
    if (phrase) {
        try { onSpoken({ n: count }); } catch { /* reporting must never stop the phrase */ }
        await tts.speak(phrase);
    }
    if (!active) return;
    // Cap: stop after maxPlaceholders placeholders. -1 = no limit (0 = none is
    // handled in arm(), which never schedules a first placeholder).
    const { maxPlaceholders } = storage.loadPlaceholderSettings();
    if (maxPlaceholders >= 1 && count >= maxPlaceholders) return;
    scheduleNext();
}

function scheduleNext() {
    const { subsequentDelay } = storage.loadPlaceholderSettings();
    timer = setTimeout(speakNext, subsequentDelay * 1000);
}
