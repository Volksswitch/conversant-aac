/* Shared fakes for tests that drive the REAL listening code (stt.js, the three paid
 * hearing sources, audio-session.js, vad.js, mic-check.js) with a fake microphone,
 * fake audio and a fake service connection.
 *
 * Moved here from tests/pending/2026-11-13-ipad-listening/harness.mjs, where it was
 * written to prove the problems found in the November 13 2026 iPad listening changes.
 * Not a test file itself (no .test.mjs), so `npm test` only loads it through the tests
 * that import it.
 *
 * Import it FIRST in a test file: it installs the browser globals the app modules
 * expect, as tests/env.mjs does.
 */
import * as env from './env.mjs';

export { env };

// ---- fake socket (Deepgram) ----------------------------------------------------
export class FakeWS {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    static all = [];
    constructor() { this.readyState = FakeWS.CONNECTING; this.sent = []; FakeWS.last = this; FakeWS.all.push(this); }
    send(b) { this.sent.push(b); }
    close() { this.readyState = FakeWS.CLOSED; }
    open() { this.readyState = FakeWS.OPEN; if (this.onopen) this.onopen(); }
    audioFrames() { return this.sent.filter((b) => typeof b !== 'string').length; }
}
globalThis.WebSocket = FakeWS;

// ---- fake audio contexts -------------------------------------------------------
// `audioCtl.hangResume` makes resume() never finish and keeps the context asleep,
// which is what an iPad does when it will not wake audio outside a tap. `gains`
// collects every silent gain a source makes, so a test can see whether it was
// disconnected again.
export const audioCtl = { hangResume: false, made: 0, gains: [] };
export let processor = null;
export function makeAudioContextClass() {
    return class FakeAudioContext {
        constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = {}; this.currentTime = 0; audioCtl.made++; }
        resume() {
            if (audioCtl.hangResume) return new Promise(() => {});
            this.state = 'running';
            return Promise.resolve();
        }
        createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
        createScriptProcessor() { processor = { connect: (n) => n, disconnect() {} }; return processor; }
        createGain() {
            const g = { gain: { value: 1 }, connected: false, connect(n) { this.connected = true; return n; }, disconnect() { this.connected = false; } };
            audioCtl.gains.push(g);
            return g;
        }
        close() { this.state = 'closed'; }
    };
}
globalThis.window = globalThis.window || {};
globalThis.window.AudioContext = makeAudioContextClass();

// ---- fake navigator: microphone and the iPad audio-session setting -------------
export const mic = {
    calls: [],                 // one entry per getUserMedia call: { type: audioSession type at the call }
    plan: [],                  // queued behaviours for the next calls: 'ok' | 'invalid-state' | 'not-allowed' | {kind, delayMs}
    open: 0,                   // streams handed out and not yet stopped
};
export const audioSessionFake = { type: 'auto', state: 'active' };
function fakeStream() {
    mic.open++;
    let stopped = false;
    const track = { label: 'iPad Microphone', muted: false, getSettings: () => ({}), stop() { if (!stopped) { stopped = true; mic.open--; } } };
    return { getTracks: () => [track], getAudioTracks: () => [track] };
}
async function getUserMedia() {
    mic.calls.push({ type: audioSessionFake.type });
    const step = mic.plan.length ? mic.plan.shift() : 'ok';
    const delay = typeof step === 'object' && step.delayMs ? step.delayMs : 0;
    const kind = typeof step === 'object' ? (step.kind || 'ok') : step;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (kind === 'invalid-state') { const e = new Error('AudioSession category is not compatible with audio capture'); e.name = 'InvalidStateError'; throw e; }
    if (kind === 'not-allowed') { const e = new Error('The request is not allowed'); e.name = 'NotAllowedError'; throw e; }
    return fakeStream();
}
Object.defineProperty(globalThis, 'navigator', {
    value: { ...(globalThis.navigator || {}), mediaDevices: { getUserMedia }, audioSession: audioSessionFake },
    configurable: true, writable: true,
});

export const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

// What app.js's handleSttStatus does with a status, reduced to the button.
export function appButton() {
    const seen = [];
    const state = { lit: false, seen };
    state.onStatus = (s) => {
        seen.push(s);
        if (s === 'stopped' || s === 'idle' || s === 'error') state.lit = false;
        else if (s === 'listening') state.lit = true;
    };
    return state;
}

let n = 0;
/** A fresh copy of stt.js, so no test inherits another's listening state. */
export async function freshStt() {
    return import(`../app/js/stt.js?listening=${++n}`);
}

/*
 * The listening code as it runs on an iPad: closes the microphone for the app's own
 * speech (stt.js) and sets the iPad's audio mode (audio-session.js). Both read the
 * device once, when platform.js loads, so tests say it here. Undo with offIpad().
 */
export async function onIpad(stt) {
    const audioSession = await import('../app/js/audio-session.js');
    stt._setIpadCheckForTest(() => true);
    audioSession._setIosCheckForTest(() => true);
}
export async function offIpad(stt) {
    const audioSession = await import('../app/js/audio-session.js');
    stt._setIpadCheckForTest(() => false);
    audioSession._setIosCheckForTest(() => false);
}

// One frame of microphone audio at a given loudness, through whichever source is live.
export function frame(level) {
    processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(level) } });
}
