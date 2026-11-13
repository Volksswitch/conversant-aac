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
};
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
        }
    } catch { /* a diagnostic must never break capture */ }
}

/** One frame of audio arrived, at this loudness (RMS, 0-1). */
export function noteFrame(level) {
    if (runFrames !== null) runFrames++;
    stats.frames++;
    if (level > stats.loudest) stats.loudest = level;
}

export function noteSpeech() { stats.speechSpans++; }
export function noteConnected() { stats.connected++; }
export function noteStop() { closeRun(); }

/** One line for the problem report. */
export function summary() {
    if (!stats.starts) return 'no paid listening this session';
    const noSound = stats.runsWithNoSound + (runFrames === 0 ? 1 : 0);
    const notRunning = Object.entries(stats.notRunning).map(([k, n]) => `${k}x${n}`).join(',') || 'none';
    const inputs = Object.entries(stats.inputs).map(([k, n]) => `${k}x${n}`).join(',') || 'unknown';
    return `starts=${stats.starts} audioNotRunningAtStart=${notRunning} ` +
           `startsWithNoSound=${noSound} frames=${stats.frames} ` +
           `loudest=${stats.loudest.toFixed(3)} (speech starts at ${GATE.openLevel.toFixed(3)}) ` +
           `speechDetected=${stats.speechSpans} connected=${stats.connected} ` +
           `mutedAtStart=${stats.mutedAtStart} input=${inputs}`;
}

/** For tests only. */
export function _reset() {
    Object.assign(stats, { starts: 0, notRunning: {}, runsWithNoSound: 0, frames: 0, loudest: 0,
        speechSpans: 0, connected: 0, mutedAtStart: 0, inputs: {} });
    runFrames = null;
}
