/* Tier 1 — platform capability verdicts (app/js/platform.js).
 *
 * These facts were MEASURED on an iPad 10th generation (iPadOS 26, Safari 26.6)
 * on July 30 2026, and the module encodes them as user-agent rules because the
 * behavior is NOT feature-detectable: the API is present and starts happily in
 * every environment where it then delivers nothing. That makes the rules
 * themselves the thing worth testing — get them backwards and the app disables
 * itself in the one browser that works.
 *
 * The trap this file exists to guard: iPadOS SAFARI requests desktop sites and its
 * user-agent says "Macintosh" with no "iPad" in it, while Chrome and Edge on the
 * same device DO say "iPad". A naive /iPad/ test therefore misses the browser that
 * works and matches the two that don't — exactly inverted.
 *
 * Note this file does NOT import env.mjs: platform.js reads `navigator` and
 * `window` at module scope, so each case installs its own globals and re-imports
 * the module with a cache-busting query.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Real user-agent strings, as measured on the device.
const UA = {
    // iPadOS Safari: claims to be a Mac, says nothing about iPad.
    iosSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15',
    iosChrome: 'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1',
    iosEdge: 'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/140.0 Mobile/15E148 Safari/605.1.15',
    // A real Mac — same "Macintosh" token as iPadOS Safari, but no touch points.
    mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
};

let caseId = 0;

// Install a browser environment and load a FRESH copy of platform.js against it.
async function loadPlatform({ ua, touch = false, standalone = false, speech = true }) {
    const navigator = { userAgent: ua, maxTouchPoints: touch ? 5 : 0 };
    if (standalone) navigator.standalone = true;
    // navigator is a configurable accessor on globalThis in Node, so it must be
    // redefined rather than assigned.
    Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true, writable: true });
    globalThis.window = {
        navigator,
        matchMedia: () => ({ matches: standalone }),
    };
    if (speech) globalThis.window.webkitSpeechRecognition = class {};
    return import(`../app/js/platform.js?case=${++caseId}`);
}

test('iPadOS Safari in a tab: the one environment that works', async () => {
    const p = await loadPlatform({ ua: UA.iosSafari, touch: true });
    assert.equal(p.isIOS(), true, 'must recognize iPadOS Safari despite the "Macintosh" UA');
    assert.equal(p.iosBrowserShell(), null, 'Safari proper, not a wrapper');
    const s = p.speechRecognitionSupport();
    assert.equal(s.usable, true);
    assert.equal(s.apiPresent, true);
    assert.equal(s.reason, '');
});

test('a real Mac is not mistaken for an iPad', async () => {
    const p = await loadPlatform({ ua: UA.mac, touch: false });
    assert.equal(p.isIOS(), false, 'a Mac never reports multiple touch points');
    assert.equal(p.speechRecognitionSupport().usable, true);
    assert.equal(p.speechConfig().continuous, true, 'desktop keeps continuous mode');
});

test('Windows Edge: usable, continuous, no visibility guard', async () => {
    const p = await loadPlatform({ ua: UA.windowsEdge });
    assert.equal(p.isIOS(), false);
    const s = p.speechRecognitionSupport();
    assert.equal(s.usable, true);
    assert.deepEqual(p.speechConfig(), { continuous: true, restartDelayMs: 0, guardVisibility: false });
});

test('iPad Home Screen app: warned, but the recognizer is still there to try', async () => {
    const p = await loadPlatform({ ua: UA.iosSafari, touch: true, standalone: true });
    assert.equal(p.isStandalone(), true);
    const s = p.speechRecognitionSupport();
    assert.equal(s.usable, false, 'measured: starts and delivers nothing');
    // The load-bearing half of the July 30 2026 decision: apiPresent stays TRUE, so
    // the app warns and lets the user try instead of disabling the button.
    assert.equal(s.apiPresent, true);
    assert.match(s.reason, /may not work/, 'phrased as a caution, not a verdict');
    assert.match(s.remedy, /Try it/);
});

for (const [name, ua] of [['Chrome', UA.iosChrome], ['Edge', UA.iosEdge]]) {
    test(`${name} on iPad: warned by name, recognizer still present`, async () => {
        const p = await loadPlatform({ ua, touch: true });
        assert.equal(p.isIOS(), true);
        assert.equal(p.iosBrowserShell(), name);
        const s = p.speechRecognitionSupport();
        assert.equal(s.usable, false);
        assert.equal(s.apiPresent, true);
        assert.match(s.reason, new RegExp(name), 'names the browser the user is actually in');
    });
}

test('no recognizer at all: the one case that is a dead end', async () => {
    const p = await loadPlatform({ ua: UA.mac, speech: false });
    const s = p.speechRecognitionSupport();
    assert.equal(s.usable, false);
    assert.equal(s.apiPresent, false, 'nothing to try — this is what disables the button');
    assert.match(s.remedy, /Edge or Google Chrome/);
});

test('no recognizer on an iPad points at Safari, not at Edge/Chrome', async () => {
    const p = await loadPlatform({ ua: UA.iosChrome, touch: true, speech: false });
    assert.match(p.speechRecognitionSupport().remedy, /Safari/);
});

test('iOS recognition is tuned non-continuous, with a restart beat and a visibility guard', async () => {
    const p = await loadPlatform({ ua: UA.iosSafari, touch: true });
    // Measured: continuous took 4,274ms to a first result vs 1,851ms without, and
    // this app exists to beat the ~4s awkward-silence threshold.
    assert.deepEqual(p.speechConfig(), { continuous: false, restartDelayMs: 200, guardVisibility: true });
});

test('describe() distinguishes "unreliable here" from "no recognition at all"', async () => {
    const standalone = await loadPlatform({ ua: UA.iosSafari, touch: true, standalone: true });
    const d1 = standalone.describe();
    assert.match(d1, /Home Screen app/);
    assert.match(d1, /unreliable here/);

    const none = await loadPlatform({ ua: UA.windowsEdge, speech: false });
    assert.match(none.describe(), /no speech recognition/);

    const ok = await loadPlatform({ ua: UA.windowsEdge });
    assert.match(ok.describe(), /listening available/);
});
