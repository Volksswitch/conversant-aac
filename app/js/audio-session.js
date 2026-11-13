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

/*
 * What to ask for when a paid service opens the microphone: the device's own call
 * processing (echo cancellation, noise suppression, automatic volume) ON, on every
 * device, the iPad included.
 *
 * ⚠ IT WAS OFF ON AN iPAD FROM 0.15.3 TO 0.15.8, AND THAT MADE THE MICROPHONE ABOUT 50
 * TIMES QUIETER (turned back on for 0.15.9, Ken, November 13 2026). It was turned off
 * because the iPad's call mode made the app's own voice sound like a phone call while
 * the microphone was open, and because a beta tester's iPad heard him about thirty
 * times more quietly than Voice Memos, which uses none of this processing. What it
 * did instead: on an iPad, echoCancellation:false takes the automatic volume with it
 * (one switch for all three), so Ken's voice fell from 0.26 to 0.005, and Kenny's wife,
 * a couple of feet away, from 0.008 to under 0.0005. That is below the speech gate's
 * lowest bar (vad.js, 0.004), so nothing was sent and nothing was heard (Kenny's
 * 0.15.8 problem report). Voice Memos' loudness cannot be reached this way.
 *
 * The phone-call sound no longer needs this: since 0.15.6 stt.js closes the paid
 * microphone on an iPad whenever the app speaks (pauseForSpeech), and the voice was
 * clear the moment listening stopped. Do not turn processing off again to make the
 * input louder. If an iPad is still too quiet with it on, a gain the app applies
 * before the speech gate is the lever (TODO.md, "Kenny's quiet iPad microphone").
 */
export function micProcessing() {
    return { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
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
 * ⚠ NO "LOUDER WHILE LISTENING" BOOST ANY MORE (removed by Ken, November 13 2026).
 * From 0.15.4 to 0.15.8 every paid voice on an iPad played five times louder, through
 * a limiter, while paid listening was on. It was sized for call processing OFF, when a
 * phrase played with the microphone open came out clear but quiet. Call processing is
 * on again (see micProcessing), and with it on such a phrase is at normal volume, so
 * the boost only made the rare ones too loud. Since 0.15.6 the microphone is closed
 * while the app speaks, so a phrase almost never plays with it open anyway. The voices
 * play straight to the speakers again, as they do on every other device.
 */

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
    const s = session();
    if (!s) return;
    try { if (s.type !== 'play-and-record') s.type = 'play-and-record'; } catch { /* leave it */ }
}

/*
 * ONE AUDIO CONTEXT FOR LISTENING, WOKEN BY A TAP (Ken's iPad, 0.15.7, November 13 2026).
 *
 * Each paid service used to make a new audio context every time it started listening,
 * AFTER the microphone opened. On an iPad a new context starts asleep and only wakes
 * inside a tap - and by then there was no tap left: the listening tone plays first and
 * the microphone opens half a second later, and automatic listening starts with no tap
 * at all. The wake-up then never finished: the iPad showed its microphone icon, the
 * Listen button stayed dark, and nothing was heard, every time.
 *
 * So there is ONE context for listening, made and woken during a real tap (Start, and
 * every Listen tap, call unlockCapture), and kept for the life of the page. A context
 * that is already awake needs no tap to be used again.
 */
let captureCtx = null;
let captureCtor = null;   // which constructor made it; it never changes outside tests

export function captureContext() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!captureCtx || captureCtx.state === 'closed' || captureCtor !== Ctor) {
        captureCtx = new Ctor();
        captureCtor = Ctor;
    }
    return captureCtx;
}

/** Call from inside a real tap: makes the listening context and wakes it. */
export function unlockCapture() {
    try {
        const c = captureContext();
        if (c.state !== 'running') c.resume().catch(() => {});
    } catch { /* no audio here; starting will report it */ }
}

/*
 * Wake a context, with a time limit. resume() on an iPad can wait forever rather than
 * fail when there is no tap, and a wait that never ends left listening stuck for the
 * rest of the session. Returns whether it is awake.
 */
export async function wake(ctx, ms = 1500) {
    if (!ctx) return false;
    if (ctx.state === 'running') return true;
    let timer;
    await Promise.race([
        Promise.resolve().then(() => ctx.resume()).catch(() => {}),
        new Promise((r) => { timer = setTimeout(r, ms); }),
    ]);
    clearTimeout(timer);
    return ctx.state === 'running';
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
