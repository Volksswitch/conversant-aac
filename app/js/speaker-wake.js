/* Wake a sleeping Bluetooth speaker before the first word (Ken, October 11 2026).
 *
 * Ken's report from the iPad: "Using a bluetooth speaker the first tenth or so of a
 * second of my speech gets lost." A Bluetooth speaker goes quiet when nothing has
 * played for a few seconds and takes a moment to wake, so the opening of the next
 * sound is lost. This is NOT the September 2 2026 dropped-first-word fault: that one
 * was the browser's AudioContext asleep, and the paid voices already wake it before
 * playing. Here the context is awake and the SPEAKER is not.
 *
 * The fix: when the app starts to speak after a quiet spell, play a faint hiss at once
 * (far below anything audible) and hold the real speech back WARM_MS. For a sentence
 * that still has to be fetched, the fetch takes longer than that, so the speech is not
 * delayed at all - the hiss simply fills a wait that already existed. For a phrase kept
 * on the device, which could play instantly, it costs WARM_MS, and only after a quiet
 * spell.
 *
 * ⚠ THE HISS IS NOT DIGITAL SILENCE ON PURPOSE. Many speakers keep their amplifier
 * muted until the signal rises above a threshold, and pure zeros never cross it.
 * NOISE_LEVEL is about -60 dB, inaudible in a room.
 *
 * ⚠ THE HISS IS NOT COUNTED AS SPEAKING. The backends' isSpeaking() reads their own
 * set of playback nodes, and the echo guard and placeholders depend on it; the hiss is
 * kept out of that set so it changes nothing they decide.
 *
 * Used by tts-deepgram.js, tts-azure.js and tts-rest.js. The device's own voice goes
 * through speechSynthesis, which owns its audio, so this cannot reach it.
 */

// Ken, October 11 2026, after trying 2 s / 0.2 s on the iPad with his speaker: better,
// not perfect. Raised to 0.4 s and triggered after 1 s of quiet.
export const IDLE_MS = 1000;      // quiet this long and the speaker may have gone to sleep
export const WARM_MS = 400;       // how long it is given to wake
const HOLD_S = 3;                 // length of the hiss; covers a slow fetch
const NOISE_LEVEL = 0.001;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Per audio context: how many real sounds are playing, when the last one ended, and
// the hiss node if one is running.
const state = new WeakMap();
function stateFor(c) {
    let s = state.get(c);
    if (!s) { s = { playing: 0, quietSince: -Infinity, node: null }; state.set(c, s); }
    return s;
}

/**
 * Call when the app is about to speak. Returns the context time at which the real
 * audio may start: now if the speaker has been busy recently, WARM_MS from now after a
 * quiet spell (and the hiss is started). Never throws; on any failure it returns the
 * current time, so the speech goes out exactly as it did before this existed.
 */
export function wakeSpeaker(c) {
    let t = 0;
    try { t = c.currentTime || 0; } catch { return 0; }
    try {
        const s = stateFor(c);
        if (s.playing > 0 || now() - s.quietSince < IDLE_MS) return t;
        if (!s.node) {
            const rate = c.sampleRate || 48000;
            const buffer = c.createBuffer(1, Math.round(HOLD_S * rate), rate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * NOISE_LEVEL;
            const node = c.createBufferSource();
            node.buffer = buffer;
            node.connect(c.destination);
            node.onended = () => { if (s.node === node) s.node = null; };
            node.start();
            s.node = node;
        }
        return t + WARM_MS / 1000;
    } catch {
        return t;
    }
}

/** A real sound started. */
export function soundStarted(c) {
    try { stateFor(c).playing++; } catch { /* never let this break playback */ }
}

/** A real sound ended. */
export function soundEnded(c) {
    try {
        const s = stateFor(c);
        s.playing = Math.max(0, s.playing - 1);
        if (s.playing === 0) s.quietSince = now();
    } catch { /* never let this break playback */ }
}

/**
 * Stop the hiss (on cancel). Counts as the end of a sound: something was playing, so
 * the speaker is awake and the next speech soon after needs no warm-up.
 */
export function stopWake(c) {
    try {
        const s = stateFor(c);
        if (s.node) { try { s.node.stop(); } catch { /* already stopped */ } s.node = null; }
        s.playing = 0;
        s.quietSince = now();
    } catch { /* nothing to stop */ }
}
