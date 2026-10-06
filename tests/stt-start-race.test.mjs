/* The paid listening services while the microphone is still being opened (CR-083).
 *
 * start() waits for the microphone with nothing yet running. A stop() in that window
 * used to do nothing, so capture came up after the user had turned it off; a second
 * start() opened a second microphone and sent every frame twice. Each test holds the
 * microphone request open, acts, then lets it arrive.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSource as deepgram } from '../app/js/stt-deepgram.js';
import { createSource as azure } from '../app/js/stt-azure.js';
import { createSource as rest } from '../app/js/stt-rest.js';
import { STT_PROVIDERS } from '../app/js/speech-catalog.js';

function world() {
    const w = { asked: 0, stopped: 0, release: null };
    const ctx = {
        state: 'running', sampleRate: 48000,
        resume: async () => {}, close: async () => {},
        createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
        createScriptProcessor: () => ({ connect: (n) => n, disconnect() {} }),
        createGain: () => ({ gain: {}, connect: (n) => n }),
        destination: {},
    };
    globalThis.window.AudioContext = function () { return ctx; };
    globalThis.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
    Object.defineProperty(globalThis, 'navigator', {
        value: { mediaDevices: { getUserMedia: () => {
            w.asked++;
            return new Promise((r) => { w.release = () => r({ getTracks: () => [{ stop: () => w.stopped++ }] }); });
        } } },
        configurable: true,
    });
    return w;
}

const makers = {
    deepgram: (onStatus) => deepgram({ getKey: () => 'k', onText() {}, onStatus, onBilled() {} }),
    azure: (onStatus) => azure({ getKey: () => 'k', getRegion: () => 'eastus', onText() {}, onStatus, onBilled() {} }),
    rest: (onStatus) => rest({ provider: STT_PROVIDERS.openai, getKey: () => 'k', getModel: () => 'm',
        onText() {}, onStatus, onBilled() {} }),
};

for (const [name, make] of Object.entries(makers)) {
    test(`${name}: a stop while the microphone is opening is honored`, async () => {
        const w = world();
        const statuses = [];
        const src = make((s) => statuses.push(s));
        const started = src.start();
        src.stop();
        w.release();
        await started;
        assert.equal(w.stopped, 1, 'the microphone that arrived late was closed');
        assert.ok(!statuses.includes('listening'), 'it never claimed to be listening');
    });

    test(`${name}: a second start while the microphone is opening opens no second one`, async () => {
        const w = world();
        const src = make(() => {});
        const a = src.start();
        const b = src.start();
        w.release();
        await Promise.all([a, b]);
        assert.equal(w.asked, 1);
        src.stop();
    });
}
