/*
 * vad.js — decides when captured audio is worth sending to a paid transcription
 * service. Pure logic, no Web Audio: it takes a loudness level and a timestamp and
 * answers "should the upstream be open right now?".
 *
 * WHY THIS EXISTS — it is the difference between an affordable feature and an
 * unaffordable one. Deepgram bills per second of audio submitted, and this app
 * holds the microphone open for the whole conversation (auto-resume restarts it
 * after every exchange). Streaming that continuously means paying for every silent
 * minute of a visit: an hour of conversation costs the full hourly rate even if the
 * partner spoke for twelve minutes of it. Sending only the speech brings the bill
 * down to roughly what was actually said.
 *
 * The built-in browser recognizer needs none of this — it is free, so there is
 * nothing to save and no reason to risk clipping. This runs only for a paid
 * backend.
 *
 * THREE PROPERTIES THAT MATTER, and why each is here:
 *
 *   Hysteresis. One threshold would chatter: a voice hovering at the boundary
 *     would open and close the upstream many times a second, and every close/open
 *     risks losing a word at the seam. Speech must be LOUDER than `openLevel` to
 *     open the gate and QUIETER than `closeLevel` to shut it, with a gap between.
 *
 *   Hang time. Natural speech has gaps inside it — between words, and the beat
 *     before "…um". Closing on the first quiet frame would chop an utterance into
 *     fragments and hand the transcriber less context than it needs. The gate stays
 *     open for `hangMs` after the level drops.
 *
 *   Pre-roll. The gate can only open AFTER speech has already started, so the
 *     first syllable is always in the past. The caller keeps a short rolling buffer
 *     of recent audio and flushes it when the gate opens; `preRollMs` says how much
 *     to keep. Without it every utterance loses its opening consonant, which is
 *     exactly the part a transcriber needs to get the first word right.
 */

// Defaults are a starting point to be tuned on the device against a real room —
// the right numbers depend on the microphone and the ambient noise, and no amount
// of reasoning substitutes for listening to what gets clipped.
export const DEFAULTS = {
    openLevel: 0.020,    // RMS (0–1) above which we call it speech
    closeLevel: 0.012,   // …and below which we call it silence (hysteresis gap)
    hangMs: 900,         // keep sending this long after the level drops
    // ⚠ 1200, not the original 400 (Ken, on an Android tablet, August 31 2026: "it
    // still loses about the first second of speech from the partner"). The gate can
    // only open once the level has actually risen, so a speaker who starts quietly is
    // already part-way into a word by then; the pre-roll is what covers that lag, and
    // 400ms did not.
    //
    // Raising THIS rather than lowering openLevel is deliberate. Pre-roll only ever
    // sends audio that is already in the buffer AND only when the gate genuinely
    // opened - so it cannot make the gate fire on a door closing. Lowering the
    // threshold would, and every false open is billed audio plus a chance of the
    // partner's turn being renewed by a noise.
    //
    // What it costs: about 0.8s more audio per utterance. Deepgram bills per second
    // submitted, so at a hundred utterances an hour that is roughly a minute more per
    // hour - against losing the first word of every sentence, which is the thing the
    // whole product exists to avoid.
    preRollMs: 1200,     // audio kept before the gate opened, flushed on open

    // THE SPEECH LEVEL FOLLOWS THE ROOM (Ken, November 13 2026, from a beta tester's
    // iPad). His microphone reached the app about ten times quieter than Voice Memos
    // records it: the loudest moment of a conversation was 0.008, so a fixed 0.020
    // never opened and nothing was ever sent. The gate now watches how loud the room
    // is while nobody is speaking (`floor`, a low percentile of recent quiet frames)
    // and treats sound `floorRatio` times louder than that as speech.
    //   - openLevel above is the CEILING, not replaced: a noisy room keeps today's
    //     bar. Raising it there could cut off a partner who speaks over the noise,
    //     which is the worse failure.
    //   - minOpenLevel is the floor of the bar, so a dead-silent input (a test, or a
    //     noise-gated microphone reading zero) cannot open on the faintest click.
    //   - The room is only measured while the gate is SHUT. Measuring during speech
    //     would raise the bar under a speaker until the gate closed in mid-sentence.
    //   - Until a second of quiet has been heard, the fixed openLevel applies.
    // What it costs: in a quiet room with an ordinary microphone the bar is lower than
    // before, so a cough or a door is more likely to open the gate and be billed.
    adaptive: true,
    floorRatio: 4,
    minOpenLevel: 0.004,
    floorPercentile: 0.2,
    floorWindowMs: 6000,
    floorMinMs: 1000,
};

export function createGate(opts = {}) {
    const cfg = { ...DEFAULTS, ...opts };
    let open = false;
    let quietSince = null;      // when the level first dropped below closeLevel
    let openedAt = null;
    const quiet = [];           // [time, level] of recent frames heard while shut
    let floor = null;           // how loud the room is between speech; null = not yet known
    const closeShare = cfg.closeLevel / cfg.openLevel;

    function openLevel() {
        if (!cfg.adaptive || floor === null) return cfg.openLevel;
        return Math.min(cfg.openLevel, Math.max(cfg.minOpenLevel, floor * cfg.floorRatio));
    }

    function noteQuiet(level, now) {
        quiet.push([now, level]);
        while (quiet.length && now - quiet[0][0] > cfg.floorWindowMs) quiet.shift();
        if (quiet.length < 5 || now - quiet[0][0] < cfg.floorMinMs) return;
        const sorted = quiet.map((q) => q[1]).sort((a, b) => a - b);
        floor = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * cfg.floorPercentile))];
    }

    return {
        /*
         * Feed one measurement. `level` is RMS amplitude 0–1, `now` a millisecond
         * timestamp. Returns the transition so the caller can act on edges:
         *   'open'   — start sending (and flush the pre-roll buffer first)
         *   'close'  — stop sending
         *   null     — no change
         */
        push(level, now) {
            if (!open) {
                if (level >= openLevel()) {
                    open = true;
                    openedAt = now;
                    quietSince = null;
                    return 'open';
                }
                noteQuiet(level, now);
                return null;
            }
            // Open: only the quieter threshold can start the closing clock, and it
            // is reset by any frame back above it, so a gap between words does not
            // accumulate toward a close.
            if (level > openLevel() * closeShare) {
                quietSince = null;
                return null;
            }
            if (quietSince === null) quietSince = now;
            if (now - quietSince >= cfg.hangMs) {
                open = false;
                quietSince = null;
                openedAt = null;
                return 'close';
            }
            return null;
        },

        isOpen() { return open; },
        openedAt() { return openedAt; },
        preRollMs() { return cfg.preRollMs; },
        config() { return { ...cfg }; },
        /** What the gate is using right now: the room's quiet level and the bar for speech. */
        levels() { return { floor, open: openLevel() }; },

        // Force shut — used when listening stops, so a gate left open cannot keep
        // an upstream alive (and billing) after the user has finished.
        reset() {
            const was = open;
            open = false;
            quietSince = null;
            openedAt = null;
            return was ? 'close' : null;
        },
    };
}

/*
 * RMS of one frame of PCM samples, 0–1. Separated from the gate so the gate can be
 * tested without generating audio, and so an AnalyserNode's byte-domain data can be
 * converted by the caller if that is what it has.
 */
export function rms(samples) {
    if (!samples || samples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / samples.length);
}

/*
 * How much audio was actually sent, in seconds — what the bill is based on. The
 * caller accumulates open→close spans; this turns them into the figure a user
 * would recognize, so the cost of a conversation can be shown rather than guessed.
 */
export function billableSeconds(spans) {
    return (spans || []).reduce((total, s) => total + Math.max(0, (s.end - s.start) / 1000), 0);
}
