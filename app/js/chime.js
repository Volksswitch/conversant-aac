// Start-of-listening chime — a short synthesized tone played on the transition
// INTO microphone capture, so a communication partner (who faces the user, not
// the screen) gets an audible cue that listening has begun. This is the reliable
// partner-reachable half of the recording-indicator work (Ken, July 18 2026):
// the tablet screen faces the user, so an on-screen indicator only reaches the
// partner on a glance — sound is omnidirectional.
//
// Design constraints:
//   - Synthesized via Web Audio (no audio file) so it works offline / on
//     locked-down networks, like the rest of the app.
//   - NOT continuous — it fires once per capture start (the false→true transition
//     in ui.setListenButtonState), never on the recognizer's mid-session restarts.
//   - User-toggleable (Settings → Conversation), default on. The enabled flag is
//     pushed in from app.js (chime.setEnabled) so this module needs no storage
//     dependency.
//   - Never blocks or throws into the capture path: any audio failure is swallowed.

import * as audioClock from './audio-clock.js';

let enabled = true;
let ctx = null;
// For the clock check (audio-clock.js); busy while the two notes are sounding.
let toneBusyUntil = 0;
audioClock.register('tone', () => ctx, { inUse: () => Date.now() < toneBusyUntil });
// A context closed because its clock stopped is replaced on next use.
const toneContext = (AudioCtx) => (ctx && ctx.state !== 'closed' ? ctx : (ctx = new AudioCtx()));

// Once-per-conversation mode, driven by the "resume listening automatically"
// setting (Ken, July 27 2026). With auto-resume ON the mic restarts after every
// single exchange, so chiming each time turns a disclosure into a metronome — the
// partner has already been told. Listening is effectively continuous for the whole
// conversation, so the cue belongs at the START of it and nowhere else. With
// auto-resume OFF each start is a deliberate, discrete listening episode, so every
// one still chimes.
let oncePerConversation = false;
let playedThisConversation = false;

export function setEnabled(on) { enabled = !!on; }
export function isEnabled() { return enabled; }
export function setOncePerConversation(on) { oncePerConversation = !!on; }

/*
 * ⚠ WITH A PAID HEARING SERVICE ON AN iPHONE OR iPAD, THE TONE PLAYS WHEN LISTENING IS
 * ACTUALLY ON (Ken, November 23 2026: "the chime conveys the sense that the system is
 * ready but it hasn't started getting ready. By sounding the chime only when the system
 * is ready to record, that may address the sense that the system is too slow and forces
 * the communication partner to repeat themselves").
 *
 * From November 8 the tone played at the Listen tap and the microphone was asked for
 * 550 ms later (playBeforeListening, below). So the tone told the other person to go
 * ahead while the iPad was still switching to recording and opening the microphone, and
 * their first words were lost (Ken's 0.15.24 report: "1, 2, 3, 4" came back "234").
 *
 * With a paid service the app captures the sound itself, through one listening audio
 * context (audio-session.js) that is running whenever the microphone is. So the tone now
 * plays on THAT context, when the app is told it is listening - the moment the Listen
 * button lights - and the microphone no longer waits for it.
 *
 * ⚠ WHY ON THE LISTENING AUDIO AND NOT THE TONE'S OWN: the tone's own context is what
 * the November 8 iPhone held back while the microphone was on, letting it out over the
 * user's next reply. Whether the listening audio avoids that is NOT yet measured on a
 * device - try it on the iPad, and if the tone comes out late, put paid hearing back on
 * the tone-first order. The device's own listening (an iPad in Safari) keeps tone-first:
 * the app has no listening audio of its own there to play the tone through.
 */
export function playsBeforeMicrophone({ ios, paidHearing } = {}) {
    return !!ios && !paidHearing;
}

// Where the tone plays: a function that returns an audio context to play it on instead
// of the tone's own (the listening audio, see above), or null. Set by app.js, which knows
// the device and the hearing service; this module stays free of both.
let contextFor = null;
export function setContextProvider(fn) { contextFor = typeof fn === 'function' ? fn : null; }

/** For tests only: forget the tone's own audio, so the next tone makes it again. */
export function _resetAudioForTest() { ctx = null; }

// Called when a conversation starts or ends, so the next one chimes again.
export function resetConversation() { playedThisConversation = false; handledAtOpen = false; }

// Play the "now listening" cue: two short ascending notes — friendly and
// unmistakable, distinct from the app's TTS. Called on capture start.
// Returns whether the cue was ALLOWED to sound (the policy decision), so the
// gating is testable without a speaker — the audio itself is best-effort and its
// failure is deliberately invisible.
export function playListenChime() {
    if (!enabled) return false;
    if (oncePerConversation && playedThisConversation) return false;
    // The once-per-conversation latch is set only when the tone actually sounds (or
    // when the device has no audio at all). Set first, an iPad whose audio was not yet
    // ready stayed silent and then skipped the tone for the rest of the conversation,
    // so the other person never heard it (CR-273).
    try {
        // The listening audio when app.js says to play on it (see setContextProvider). A
        // provider that fails falls back to the tone's own audio rather than to silence.
        let target = null;
        try { target = contextFor ? contextFor() : null; } catch { target = null; }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!target && !AudioCtx) { playedThisConversation = true; return true; }   // policy allowed it; no audio here
        if (!target) toneContext(AudioCtx);
        const out = target || ctx;
        // NEVER schedule into a context that isn't running. WebKit starts a context
        // suspended unless it was created during a user gesture, and this call is
        // NOT one: it comes from the recognizer's async 'start' event, which fires
        // after the microphone permission round-trip, long past the tap. Notes
        // scheduled onto a suspended context are not dropped — they are queued and
        // sound the moment the context resumes, which on WebKit is the user's NEXT
        // gesture. That is how the listening chime came out of the "End
        // conversation" button on an iPad (Ken, July 30 2026). Ask for a resume so
        // the next chime works, but stay silent now rather than firing a tone
        // attached to an unrelated button press. unlock() below is what normally
        // makes the context running before any of this.
        if (out.state !== 'running') {
            out.resume().catch(() => { /* needs a gesture — unlock() supplies one */ });
            return true;
        }
        const t = out.currentTime;
        playNote(out, t,        660, 0.20);  // E5
        playNote(out, t + 0.17, 880, 0.26);  // A5
        toneBusyUntil = Date.now() + 700;
        playedThisConversation = true;
        lastSounded = true;
    } catch { /* audio unavailable — silent, never blocks capture */ }
    return true;
}

// ⚠ ON AN iPHONE OR iPAD USING ITS OWN LISTENING, THE TONE FINISHES BEFORE THE
// MICROPHONE OPENS (Ken's iPhone, November 8 2026). Played the moment listening began,
// the tone was held back by the device while the microphone had the sound, and came out
// when the microphone closed - which is the instant the user taps a response option, so
// it played over the first words of every reply. So there the app plays the tone at the
// Listen tap and opens the microphone CHIME_MS later. Since November 23 2026 a paid
// hearing service does not use this: it plays the tone on the listening audio once
// listening is on (see playsBeforeMicrophone above). Everywhere else nothing changes:
// the tone still plays when listening begins.
export const CHIME_MS = 550;   // the two notes end at about 0.45 s, plus a margin
let lastSounded = false;
let handledAtOpen = false;

/** Play the tone now, before the microphone opens. Returns how long to wait before
 *  opening it: CHIME_MS if the tone sounded, 0 if it did not (turned off, already
 *  played this conversation, or no audio). Either way the start of capture that
 *  follows does not play it a second time. */
export function playBeforeListening() {
    handledAtOpen = true;
    lastSounded = false;
    playListenChime();
    return lastSounded ? CHIME_MS : 0;
}

/** Capture has just started (the Listen button lit). Plays the tone unless it was
 *  already played before the microphone opened. Returns whether it was allowed. */
export function onCaptureStarted() {
    if (handledAtOpen) { handledAtOpen = false; return false; }
    return playListenChime();
}

// Bring the audio context up while a real user gesture is in hand, so the chime
// can sound later from the recognizer's async start event (see above). Called
// from the Start button and the Listen button — both genuine taps. Safe and
// cheap to call repeatedly; a no-op once the context is running.
export function unlock() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        toneContext(AudioCtx);
        if (ctx.state !== 'running') ctx.resume().catch(() => { /* best-effort */ });
    } catch { /* audio unavailable */ }
}

// Peak level of each note (0–1 full scale). Deliberately loud: this is a
// partner-awareness cue that must be clearly audible across a room over ambient
// noise, on a small tablet speaker that isn't at full volume. The two notes
// barely overlap, so per-note peak near this stays below clipping. Bump this if
// it's still too quiet in the field.
const PEAK = 0.7;

function playNote(audio, start, freq, dur) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    // Triangle carries better than a pure sine through small tablet speakers
    // (a little more harmonic content) while staying a soft, pleasant tone.
    osc.type = 'triangle';
    osc.frequency.value = freq;
    // Quick attack → short hold near peak → exponential release. The hold makes
    // the note read louder than a fast blip of the same peak (perceived loudness
    // tracks duration-at-level), without a click.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(PEAK, start + 0.02);
    gain.gain.setValueAtTime(PEAK, start + Math.max(0.03, dur - 0.07));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
}
