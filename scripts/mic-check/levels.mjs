/*
 * Loudness figures for a recording, measured the way the app measures its microphone.
 *
 * WHY THIS EXISTS (Ken, November 14 2026). A beta tester's iPad delivers almost no
 * sound to the app: with his wife talking beside it, 421 of 440 readings stayed at
 * room level. The app's own numbers cannot say whether that is his microphone (or
 * its case), the iPad's call processing, or the browser. A plain recording made with
 * the iPad's own Voice Memos app, with Conversant not involved at all, separates the
 * first from the other two, but only if it is measured rather than listened to.
 *
 * So this uses the SAME measure as app/js/mic-check.js and app/js/vad.js: the audio
 * is cut into pieces of 4096 samples at 48,000 a second (about 12 a second), and each
 * piece's level is its RMS. The bands are the ones on the `levels:` line of a problem
 * report, so a recording and a report can be read side by side.
 *
 * The scales are NOT identical: Voice Memos and the browser set their own volume, so
 * a level of 0.05 here is not the same loudness as 0.05 in a report. Compare a
 * tester's recording with a reference recording made the same way on a device known
 * to work, not with the report.
 *
 * Pure: no files, no ffmpeg. measure-recording.mjs does the reading.
 */

export const SAMPLE_RATE = 48000;
export const FRAME_SAMPLES = 4096;                  // app/js/stt-deepgram.js
export const LEVEL_BANDS = [0.001, 0.002, 0.004, 0.008, 0.016, 0.032, 0.064];   // app/js/mic-check.js

// The app's speech bar: 4 times the room, never under 0.004, never over 0.020 (vad.js).
export const BAR_OVER_ROOM = 4;
export const BAR_MIN = 0.004;
export const BAR_MAX = 0.020;

export function rms(samples, from = 0, to = samples.length) {
    const n = to - from;
    if (n <= 0) return 0;
    let sum = 0;
    for (let i = from; i < to; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / n);
}

/** One level per whole piece of `frameSamples`; a short piece at the end is dropped. */
export function frameLevels(samples, frameSamples = FRAME_SAMPLES) {
    const out = [];
    for (let i = 0; i + frameSamples <= samples.length; i += frameSamples) {
        out.push(rms(samples, i, i + frameSamples));
    }
    return out;
}

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
    return sorted[i];
}

export function bandOf(level) {
    const i = LEVEL_BANDS.findIndex((b) => level < b);
    return i < 0 ? LEVEL_BANDS.length : i;
}

export function bandLabel(i) {
    if (i === 0) return `under ${LEVEL_BANDS[0]}`;
    if (i === LEVEL_BANDS.length) return `${LEVEL_BANDS[i - 1]} and up`;
    return `${LEVEL_BANDS[i - 1]}-${LEVEL_BANDS[i]}`;
}

/**
 * Everything worth saying about one channel of sound.
 *   room    - the level of the quietest tenth of the recording
 *   bar     - where the app would start treating sound as speech in that room
 *   speech  - the typical level of the pieces above 4 times the room (null if none)
 */
export function summarize(samples, { sampleRate = SAMPLE_RATE, frameSamples = FRAME_SAMPLES } = {}) {
    const levels = frameLevels(samples, frameSamples);
    const sorted = [...levels].sort((a, b) => a - b);
    const room = percentile(sorted, 0.10);
    const loudest = sorted.length ? sorted[sorted.length - 1] : 0;
    const bar = Math.min(BAR_MAX, Math.max(BAR_MIN, room * BAR_OVER_ROOM));

    const bands = new Array(LEVEL_BANDS.length + 1).fill(0);
    for (const l of levels) bands[bandOf(l)]++;

    // "Speech" is judged against the room alone, with no fixed bar, because the
    // recording's volume scale is not the app's. A dead microphone has almost none.
    const aboveRoom = sorted.filter((l) => room > 0 ? l >= room * BAR_OVER_ROOM : l > 0);
    const speech = aboveRoom.length ? percentile(aboveRoom, 0.5) : null;
    const overBar = levels.filter((l) => l >= bar).length;

    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
        const a = Math.abs(samples[i]);
        if (a > peak) peak = a;
    }

    // Loudest band reached in each second, so a "close, then far away" script can be
    // read off in order.
    const perSecond = [];
    const framesPerSecond = sampleRate / frameSamples;
    for (let s = 0; s * framesPerSecond < levels.length; s++) {
        const a = Math.floor(s * framesPerSecond);
        const b = Math.min(levels.length, Math.floor((s + 1) * framesPerSecond));
        let max = 0;
        for (let i = a; i < b; i++) if (levels[i] > max) max = levels[i];
        perSecond.push(max);
    }

    return {
        frames: levels.length,
        seconds: samples.length / sampleRate,
        loudest,
        room,
        bar,
        speech,
        speechOverRoom: speech !== null && room > 0 ? speech / room : null,
        shareAboveRoom: levels.length ? aboveRoom.length / levels.length : 0,
        shareOverBar: levels.length ? overBar / levels.length : 0,
        bands,
        peak,
        clipped: peak >= 0.999,
        perSecond,
    };
}

export function toDb(ratio) {
    return ratio > 0 ? 20 * Math.log10(ratio) : -Infinity;
}

/** Splits interleaved samples (L R L R ...) into one array per channel, plus their average. */
export function splitChannels(interleaved, channels) {
    const n = Math.floor(interleaved.length / channels);
    const each = Array.from({ length: channels }, () => new Float32Array(n));
    const mix = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) {
            const v = interleaved[i * channels + c];
            each[c][i] = v;
            sum += v;
        }
        mix[i] = sum / channels;
    }
    return { each, mix };
}
