/*
 * mic-check.js - did any SOUND reach the app while a paid service was listening?
 *
 * WHY IT EXISTS (Ken, November 12 2026). The first beta problem report from an iPad
 * said "the microphone isn't working", and the report could not say why. Seven
 * listening sessions, no errors, and not one second of audio sent to the service -
 * which fits two very different faults:
 *
 *   NO SOUND AT ALL   - the iPad's audio never started (it can be left "suspended",
 *                       and nothing reports it), or the input is a device that is
 *                       muted or not the one the user thinks.
 *   SOUND, TOO QUIET  - frames arrived but never rose above the voice gate's
 *                       threshold (vad.js), so nothing was treated as speech.
 *
 * Those need opposite fixes, and the old report could not tell them apart. This
 * records just enough to: whether the audio system was running at each start,
 * whether any sound arrived, how loud the loudest moment was against the gate's
 * threshold, how often speech was detected, and what KIND of input was in use.
 *
 * Used by every paid hearing service (Deepgram, Azure, and the REST services), which
 * all capture the microphone the same way. The browser's own recognizer does its own
 * capture and exposes no levels, so it reports nothing here.
 *
 * Counts and levels only - never sound, never words. The input device's NAME is not
 * kept either: a headset or hearing aid is often named after its owner ("Kenny's
 * AirPods"), and this goes out in the weekly report. It is reduced to a kind.
 */

import { DEFAULTS as GATE } from './vad.js';

const stats = {
    starts: 0,
    notRunning: {},        // audio system state at start, when it was not "running"
    runsWithNoSound: 0,    // finished runs in which not one frame of audio arrived
    frames: 0,
    loudest: 0,
    speechSpans: 0,        // times the voice gate opened
    connected: 0,          // service connections that opened (streaming services)
    mutedAtStart: 0,
    inputs: {},            // kind of input device -> count of starts
    stuck: {},             // starts that could not finish, by where they stopped
    levels: new Array(8).fill(0),   // frames by loudness band (LEVEL_BANDS)
    gate: null,            // the voice gate's latest { floor, open }
    settings: null,        // what the device applied to the microphone, at the last start
};
// Loudness bands for the report. Each band doubles; speech from a normal microphone
// at conversation distance sits in the top three, a quiet room in the bottom two.
// Added November 13 2026, after one iPad's loudest moment was 0.008: a band count
// tells "quiet speech" (a cluster in the middle) from "no speech" (only the bottom).
const LEVEL_BANDS = [0.001, 0.002, 0.004, 0.008, 0.016, 0.032, 0.064];
let runFrames = null;      // frames in the current run; null when not listening

/** Kind of input from the device's name, without keeping the name. */
export function inputKind(label) {
    const l = String(label || '').toLowerCase();
    if (!l) return 'unnamed';
    if (/airpod|bluetooth|headset|hands-?free|hearing|beats|bose|jbl|sony|speaker|earbud|buds/.test(l)) {
        return 'Bluetooth or headset';
    }
    if (/usb|external|line in|interface/.test(l)) return 'plugged-in';
    if (/ipad|iphone|built-?in|internal|default|microphone array|front|back|bottom|top/.test(l)) {
        return 'built-in';
    }
    return 'other';
}

function closeRun() {
    if (runFrames === 0) stats.runsWithNoSound++;
    runFrames = null;
}

/** A paid service has the microphone and its audio system: call once per start. */
export function noteStart({ stream, audioCtx } = {}) {
    closeRun();
    stats.starts++;
    runFrames = 0;
    const state = audioCtx && audioCtx.state;
    if (state && state !== 'running') stats.notRunning[state] = (stats.notRunning[state] || 0) + 1;
    try {
        const track = stream && stream.getAudioTracks && stream.getAudioTracks()[0];
        if (track) {
            const kind = inputKind(track.label);
            stats.inputs[kind] = (stats.inputs[kind] || 0) + 1;
            if (track.muted) stats.mutedAtStart++;
            // Whether the device actually applied echo cancellation, noise filtering
            // and automatic volume: an app ASKS for them, and the device decides.
            // These are the processing Voice Memos does without, so they are the
            // first suspect when the app hears far less than Voice Memos does.
            const st = track.getSettings ? track.getSettings() : {};
            const on = (v) => (v === true ? 'on' : v === false ? 'off' : '?');
            stats.settings = `echoCancellation=${on(st.echoCancellation)} ` +
                `noiseSuppression=${on(st.noiseSuppression)} autoGainControl=${on(st.autoGainControl)} ` +
                `micRate=${st.sampleRate || '?'} audioRate=${(audioCtx && audioCtx.sampleRate) || '?'}`;
        }
    } catch { /* a diagnostic must never break capture */ }
}

/** One frame of audio arrived, at this loudness (RMS, 0-1), with the gate's current levels. */
export function noteFrame(level, gate) {
    if (runFrames !== null) runFrames++;
    stats.frames++;
    if (level > stats.loudest) stats.loudest = level;
    let band = LEVEL_BANDS.findIndex((b) => level < b);
    if (band < 0) band = LEVEL_BANDS.length;
    stats.levels[band]++;
    if (gate) stats.gate = gate;
}

function levelBands() {
    const parts = [];
    stats.levels.forEach((n, i) => {
        if (!n) return;
        const lo = i === 0 ? null : LEVEL_BANDS[i - 1];
        const hi = LEVEL_BANDS[i];
        const name = lo === null ? `under ${hi}` : hi === undefined ? `over ${lo}` : `${lo}-${hi}`;
        parts.push(`${name}:${n}`);
    });
    return parts.join(' ') || 'none';
}

export function noteSpeech() { stats.speechSpans++; }
/** A start that could not finish (Ken's iPad, 0.15.7: the audio never woke). */
export function noteStuck(where) { stats.stuck[where] = (stats.stuck[where] || 0) + 1; }
export function noteConnected() { stats.connected++; }
export function noteStop() { closeRun(); }

/** One line for the problem report. */
export function summary() {
    const stuck = Object.entries(stats.stuck).map(([k, n]) => `${k} x${n}`).join(', ');
    if (!stats.starts) return stuck ? `no paid listening started; stuck: ${stuck}` : 'no paid listening this session';
    const noSound = stats.runsWithNoSound + (runFrames === 0 ? 1 : 0);
    const notRunning = Object.entries(stats.notRunning).map(([k, n]) => `${k}x${n}`).join(',') || 'none';
    const inputs = Object.entries(stats.inputs).map(([k, n]) => `${k}x${n}`).join(',') || 'unknown';
    const bar = stats.gate ? stats.gate.open : GATE.openLevel;
    const room = stats.gate && stats.gate.floor !== null && stats.gate.floor !== undefined
        ? stats.gate.floor.toFixed(4) : 'not measured';
    return `starts=${stats.starts} audioNotRunningAtStart=${notRunning} ` +
           `startsWithNoSound=${noSound} frames=${stats.frames} ` +
           `loudest=${stats.loudest.toFixed(3)} (speech starts at ${bar.toFixed(3)}) ` +
           `quietRoom=${room} ` +
           `speechDetected=${stats.speechSpans} connected=${stats.connected} ` +
           `mutedAtStart=${stats.mutedAtStart} input=${inputs}
` +
           `    levels: ${levelBands()}
` +
           `    settings: ${stats.settings || 'unknown'}` +
           (stuck ? `\n    stuck: ${stuck}` : '');
}

/** For tests only. */
export function _reset() {
    Object.assign(stats, { starts: 0, notRunning: {}, runsWithNoSound: 0, frames: 0, loudest: 0,
        speechSpans: 0, connected: 0, mutedAtStart: 0, inputs: {}, stuck: {},
        levels: new Array(8).fill(0), gate: null, settings: null });
    runFrames = null;
}
