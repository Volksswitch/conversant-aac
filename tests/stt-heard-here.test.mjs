/* Tier 1 — the device's own listening heard words, so the warning lifts (Ken, November 26 2026).
 *
 * Drives the REAL chain: the fake recognizer that stt.js creates delivers a settled
 * result, stt.js tells platform.js, and platform.js stops reporting the listening as
 * unreliable. The pieces are tested on their own in platform.test.mjs; this file is the
 * one check that runs the link between them, on an iPhone Home Screen app.
 *
 * Its own file because platform.js reads the browser description when it is first
 * loaded, so the iPhone has to be in place before anything imports it.
 */
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
const nav = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1',
    maxTouchPoints: 5,
    standalone: true,
};
Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
globalThis.window = { navigator: nav, matchMedia: () => ({ matches: true }) };

const { recognitions } = await import('./env.mjs');
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const platform = await import('../app/js/platform.js');
const stt = await import('../app/js/stt.js');

test('a settled result from the built-in recognizer lifts the Home Screen warning', () => {
    assert.equal(platform.speechRecognitionSupport().usable, false, 'warned before anything is heard');
    stt.setSilenceThreshold(10);
    stt.init({ onResult: () => {}, onSilence: () => {}, onStatus: () => {}, onPartnerSpeech: () => {} });
    const rec = recognitions[recognitions.length - 1];
    stt.startListening();
    rec.emitInterim('I just went');
    assert.equal(platform.speechRecognitionSupport().usable, false, 'words still being heard do not count yet');
    rec.emitFinal('I just went to the bookstore');
    const s = platform.speechRecognitionSupport();
    assert.equal(s.usable, true);
    assert.match(s.heardHere, /^\d{4}-\d{2}-\d{2}$/);
    stt.stopListening();
});
