// Shared fakes for the proofs in this folder (bug hunt of the November 13 2026 iPad
// listening changes, 0.15.2 to 0.15.8). Drives the REAL app modules (stt.js, the three
// paid hearing sources, audio-session.js, vad.js, mic-check.js) with a fake microphone,
// fake audio and a fake service connection. See FINDINGS.md.

const ROOT = new URL('../../../', import.meta.url);   // the project folder, wherever it is
export const url = (rel) => new URL(rel, ROOT).href;

export const env = await import(url('tests/env.mjs'));

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
// which is what an iPad does when it will not wake audio outside a tap.
export const audioCtl = { hangResume: false, made: 0 };
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
        createGain() { return { gain: { value: 1 }, connect: (n) => n, disconnect() {} }; }
        close() { this.state = 'closed'; }
    };
}
globalThis.window = globalThis.window || {};
globalThis.window.AudioContext = makeAudioContextClass();

// ---- fake navigator: microphone and the iPad audio-session setting -------------
export const mic = {
    calls: [],                 // one entry per getUserMedia call: { type: audioSession type at the call }
    plan: [],                  // queued behaviours for the next calls: 'ok' | 'invalid-state' | 'not-allowed' | {delayMs}
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
export async function freshStt() {
    return import(url('app/js/stt.js') + `?hunt=${++n}`);
}

// One frame of microphone audio at a given loudness, through whichever source is live.
export function frame(level) {
    processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(level) } });
}
