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

let enabled = true;
let ctx = null;

export function setEnabled(on) { enabled = !!on; }
export function isEnabled() { return enabled; }

// Play the "now listening" cue: two short ascending notes — friendly and
// unmistakable, distinct from the app's TTS. Called on capture start.
export function playListenChime() {
    if (!enabled) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        ctx = ctx || new AudioCtx();
        // The context may start suspended until a user gesture; capture always
        // starts from a tap (Start Listening) or after one earlier in the session,
        // so resuming here is allowed.
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime;
        playNote(t,        660, 0.20);  // E5
        playNote(t + 0.17, 880, 0.26);  // A5
    } catch { /* audio unavailable — silent, never blocks capture */ }
}

// Peak level of each note (0–1 full scale). Deliberately loud: this is a
// partner-awareness cue that must be clearly audible across a room over ambient
// noise, on a small tablet speaker that isn't at full volume. The two notes
// barely overlap, so per-note peak near this stays below clipping. Bump this if
// it's still too quiet in the field.
const PEAK = 0.7;

function playNote(start, freq, dur) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
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
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
}
