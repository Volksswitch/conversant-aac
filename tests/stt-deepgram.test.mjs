/* Tier 1 — the Deepgram hearing source (app/js/stt-deepgram.js).
 *
 * CR-006. Listening restarts at the start of nearly every partner turn, so a new
 * socket is opening at exactly the moment the partner starts talking. Audio sent
 * while the socket was still connecting was silently dropped, along with the
 * pre-roll that exists to protect the opening syllables. These tests hold the socket
 * in CONNECTING, feed it speech, and check nothing is lost when it opens.
 */
import './env.mjs';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

class FakeWS {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    constructor() { this.readyState = FakeWS.CONNECTING; this.sent = []; FakeWS.last = this; }
    send(b) { this.sent.push(b); }
    close() { this.readyState = FakeWS.CLOSED; }
}
globalThis.WebSocket = FakeWS;

let processor = null;
class FakeAudioContext {
    constructor() { this.state = 'running'; this.sampleRate = 48000; this.destination = {}; }
    async resume() {}
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() { processor = { connect: (n) => n, disconnect() {} }; return processor; }
    createGain() { return { gain: { value: 1 }, connect: (n) => n }; }
    close() {}
}
globalThis.window = globalThis.window || {};
globalThis.window.AudioContext = FakeAudioContext;
Object.defineProperty(globalThis, 'navigator', {
    value: { ...(globalThis.navigator || {}), mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
    configurable: true, writable: true,
});

const { createSource } = await import('../app/js/stt-deepgram.js');

let source = null;
afterEach(() => { if (source) source.stop(); source = null; });   // the KeepAlive timer must not hang the run

function speak(n) {
    for (let i = 0; i < n; i++) {
        processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.1) } });
    }
}

test('speech that starts while the socket is connecting is sent once it opens', async () => {
    source = createSource({ getKey: () => 'k', onText() {}, onStatus() {}, onBilled() {} });
    assert.equal(await source.start(), true);
    const ws = FakeWS.last;
    speak(8);
    assert.equal(ws.sent.length, 0, 'nothing can be sent before the socket is open');
    ws.readyState = FakeWS.OPEN;
    ws.onopen();
    assert.equal(ws.sent.length, 8, 'every frame heard during the handshake is sent, none dropped');
    speak(2);
    assert.equal(ws.sent.length, 10, 'and later frames follow them, in order');
});

test('a socket that fails while connecting does not replay its audio later', async () => {
    source = createSource({ getKey: () => 'k', onText() {}, onStatus() {}, onBilled() {} });
    await source.start();
    const ws = FakeWS.last;
    speak(4);
    ws.onerror();
    ws.readyState = FakeWS.OPEN;
    ws.onopen();
    assert.equal(ws.sent.filter((b) => typeof b !== 'string').length, 0, 'the held audio was dropped with the error');
});

// CR-019. Each start resets the running total of audio billed, and the app stores
// only the increase it sees. Without a reset report, the next session's first figure
// read as a decrease and that whole burst went uncounted.
test('every start reports that the billed total restarted at zero', async () => {
    const billed = [];
    source = createSource({ getKey: () => 'k', onText() {}, onStatus() {}, onBilled: (s) => billed.push(s) });
    await source.start();
    source.stop();
    await source.start();
    assert.equal(billed.filter((s) => s === 0).length, 2, 'one zero per start');
});
