/*
 * audio-session.js - tell an iPad what kind of sound the app is making.
 *
 * WHY IT EXISTS (Ken, measured on his iPad, November 13 2026). With a paid hearing
 * service, the app's voice played at full volume while the microphone was on, then
 * dropped to very quiet the moment the microphone was turned off - mid-word, when a
 * tap interrupted a holding phrase - and stayed quiet for every response and Express
 * phrase until Listen was pressed again. The Settings voice Test was loud before the
 * microphone had ever been used. One volume control moved both, so this is not a
 * separate "call" volume the user could set once.
 *
 * Best explanation, NOT proven: once a page has used the microphone, Safari leaves
 * its audio in a mode meant for calls after the microphone closes. Safari lets a page
 * say what kind of audio it is making (navigator.audioSession, Safari 16.4+), so the
 * app says "playback" whenever paid listening stops and "play-and-record" before the
 * microphone opens (see forListening for why not "auto").
 *
 * Scope, deliberately narrow:
 *   - Paid hearing only (stt.js calls this around an external source). The iPad's own
 *     recognizer in a Safari tab was never reported quiet, and it restarts itself
 *     constantly; changing the audio type under it is a risk with no evidence behind it.
 *   - A browser without navigator.audioSession (every Chromium browser) does nothing,
 *     so Windows, Chromebook, Mac and Android are unchanged.
 *   - Never throws: a diagnostic or a volume fix must not break listening.
 */

import * as platform from './platform.js';

/*
 * What to ask for when a paid service opens the microphone.
 *
 * ON AN iPAD, NO CALL PROCESSING (Ken, November 13 2026). With echo cancellation the
 * iPad puts the whole app into its call mode while listening, and call mode changes
 * what the app SAYS as well as what it hears: a holding phrase that started while the
 * microphone was on sounded like a phone call, then clear the moment listening
 * stopped - "almost two different voices". A beta tester's iPad also heard him about
 * thirty times more quietly than Voice Memos does, and Voice Memos uses none of this
 * processing. All three are switched off together because on an iPad they are one
 * piece of processing, and asking for any one of them may bring the call mode back.
 *
 * What it costs: the microphone hears the app's own voice more strongly while a
 * holding phrase plays. stt.js already ignores words that match what the app just
 * said, and does not count sound as the partner speaking while the app is talking;
 * those two now do more of the work, and the paid service is sent (and bills for)
 * those few seconds.
 *
 * Everywhere else the request is what it always was.
 */
export function micProcessing(ipad = (() => { try { return platform.isIOS(); } catch { return false; } })()) {
    return ipad
        ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
}

/*
 * Why the microphone would not open, for the error log and the problem report.
 *
 * Every paid service used to report any failure here as "not-allowed", which reads
 * as "permission refused" whatever actually happened. On Ken's iPad (0.15.5,
 * November 13 2026) the first Listen after launch failed that way and the second, a
 * few seconds later, opened normally - which a refused permission would not do. The
 * browser says which kind of failure it was; this keeps it.
 *
 * A refused permission keeps the old word, so nothing that reads it changes.
 */
export function micFailure(err) {
    const name = (err && err.name) || 'Error';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'not-allowed';
    const msg = String((err && err.message) || '').replace(/\s+/g, ' ').slice(0, 120);
    return `microphone failed (${name}${msg ? `: ${msg}` : ''})`;
}

function session() {
    try {
        const s = typeof navigator !== 'undefined' ? navigator.audioSession : null;
        return s && 'type' in s ? s : null;
    } catch { return null; }
}

/*
 * LOUDER WHILE AN iPAD IS LISTENING (Ken, November 13 2026). With call processing off
 * (micProcessing above) the holding phrases spoken while the microphone is open came
 * out clear but quiet - the iPad turns playback down while it records, and the app
 * cannot ask it not to. What the app CAN set is its own volume, so on an iPad every
 * paid voice plays through a boost while paid listening is on, and through nothing
 * extra the moment it stops (the iPad's own volume comes back then).
 *
 * The limiter is what makes boosting safe. The voices are already loud, so a plain
 * boost would clip on every loud syllable and crackle; the limiter holds the peaks
 * just under full scale instead. It is in the chain whenever the chain exists, but
 * at normal volume it has almost nothing to do.
 *
 * Off an iPad there is no chain at all: output() returns the speakers directly, so
 * nothing about any other device changes.
 */
// 5, about 14 dB. Ken heard 2.5 on his iPad in 0.15.4 and asked for twice as much
// (November 13 2026). At this level the limiter does real work on loud syllables.
export const LISTENING_BOOST = 5;
let listening = false;
const boosts = new Set();               // gain nodes of every chain made so far

function boostLevel() { return listening ? LISTENING_BOOST : 1; }

function applyBoost() {
    for (const g of boosts) {
        try {
            const c = g.context;
            if (!c || c.state === 'closed') { boosts.delete(g); continue; }
            // A short ramp, so the change is not a click.
            g.gain.setTargetAtTime(boostLevel(), c.currentTime, 0.02);
        } catch { boosts.delete(g); }
    }
}

const chains = new WeakMap();

/** Where a paid voice should send its sound. */
export function output(ctx, ipad = (() => { try { return platform.isIOS(); } catch { return false; } })()) {
    if (!ipad) return ctx.destination;
    let chain = chains.get(ctx);
    if (!chain) {
        try {
            const gain = ctx.createGain();
            gain.gain.value = boostLevel();
            const limiter = ctx.createDynamicsCompressor();
            limiter.threshold.value = -3;
            limiter.knee.value = 0;
            limiter.ratio.value = 20;
            limiter.attack.value = 0.002;
            limiter.release.value = 0.1;
            gain.connect(limiter);
            limiter.connect(ctx.destination);
            boosts.add(gain);
            chain = gain;
        } catch {
            chain = ctx.destination;      // never lose the voice over a volume tweak
        }
        chains.set(ctx, chain);
    }
    return chain;
}

/*
 * Before the microphone opens: say "play and record".
 *
 * ⚠ NOT "auto" (Ken's iPad, 0.15.6, November 13 2026). This used to hand the choice
 * back to Safari, and the first Listen after launch failed with "InvalidStateError:
 * AudioSession category is not compatible with audio capture" - Safari, left to
 * choose while the app's voice was ready to play, chose a playback-only mode and then
 * refused the microphone in it. Recording needs "play-and-record", so the app says so.
 */
export function forListening() {
    listening = true;
    applyBoost();
    const s = session();
    if (!s) return;
    try { if (s.type !== 'play-and-record') s.type = 'play-and-record'; } catch { /* leave it */ }
}

/*
 * Open the microphone for a paid service. Shared by all three, so the request and the
 * recovery below cannot drift between them.
 *
 * If an iPad still says its audio mode cannot record, set the mode again, give it a
 * moment and try once more: the refusal is about timing, and a second Listen a few
 * seconds later has always worked. Any other failure is passed straight back.
 */
export async function openMic(getUserMedia = (c) => navigator.mediaDevices.getUserMedia(c),
    wait = (ms) => new Promise((r) => setTimeout(r, ms))) {
    const constraints = { audio: micProcessing() };
    try {
        return await getUserMedia(constraints);
    } catch (err) {
        if (!err || err.name !== 'InvalidStateError') throw err;
        forListening();
        await wait(300);
        return getUserMedia(constraints);
    }
}

/** After paid listening stops: ordinary playback, so the voice is not left quiet. */
export function forSpeaking() {
    listening = false;
    applyBoost();
    const s = session();
    if (!s) return;
    try { if (s.type !== 'playback') s.type = 'playback'; } catch { /* leave it */ }
}

/** For the problem report: what the page last told Safari, or that it cannot. */
export function describe() {
    const s = session();
    if (!s) return 'not available here';
    try { return `${s.type}${s.state ? ` (${s.state})` : ''}`; } catch { return 'unreadable'; }
}
