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
    // Android says "Android" and means it - no trickery needed, unlike the Apple side.
    androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    androidPhone: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    // Chrome OS is a DESKTOP and must not be caught by the Android test.
    chromeOS: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
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

test('Windows Edge: usable and continuous, and it still guards backgrounding', async () => {
    const p = await loadPlatform({ ua: UA.windowsEdge });
    assert.equal(p.isIOS(), false);
    const s = p.speechRecognitionSupport();
    assert.equal(s.usable, true);
    assert.deepEqual(p.speechConfig(), { continuous: true, restartDelayMs: 0, guardVisibility: true });
});

test('the visibility guard is on EVERYWHERE - it is not an iOS special case', async () => {
    // It was iOS-only because iOS was the only platform where backgrounding was known
    // to stop recognition. Measured on Android August 31 2026: it does there too, and
    // the recognizer came back 'not-allowed', so the app tore listening down and the
    // user had to press Listen again mid-conversation. Made universal rather than
    // given an Android branch - that REMOVES a fork, and it means a platform nobody
    // has tested yet defaults to the safe answer instead of the one now known to be
    // wrong on two of the three we have tried.
    for (const [name, opts] of [
        ['Windows Edge', { ua: UA.windowsEdge }],
        ['a real Mac', { ua: UA.mac, touch: false }],
        ['iPadOS Safari', { ua: UA.iosSafari, touch: true }],
    ]) {
        const p = await loadPlatform(opts);
        assert.equal(p.speechConfig().guardVisibility, true, name + ' must guard backgrounding');
    }
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


/* ── Android: a supported platform, and the paid transcription is required ────────
 *
 * Ken, August 31 2026, measured on his own phone and tablet. Until then Android
 * matched no test here and fell through to the desktop answers, so every bug report
 * from one said "desktop" and said nothing about the device.
 */

test('Android is recognized, on a phone and on a tablet', async () => {
    for (const [name, ua] of [['tablet', UA.androidTablet], ['phone', UA.androidPhone]]) {
        const p = await loadPlatform({ ua, touch: true });
        assert.equal(p.isAndroid(), true, name + ' must be recognized as Android');
        assert.equal(p.isIOS(), false, name + ' is not an Apple device');
        assert.match(p.describe(), /Android/, 'a bug report must name the device');
    }
});

test('Android needs the paid transcription - but the control stays live', async () => {
    const p = await loadPlatform({ ua: UA.androidTablet, touch: true });
    const s = p.speechRecognitionSupport();
    assert.equal(s.usable, false, 'the built-in recognizer is not the supported path here');
    // The warn-don't-block rule (July 30 2026). Unlike an installed iPad, Android's
    // built-in recognizer genuinely works - poorly - so a user evaluating the app
    // before paying for a second service must still be able to try it.
    assert.equal(s.apiPresent, true, 'the button must stay live');
    assert.match(s.remedy, /Deepgram/, 'it has to say WHICH service, not just "a paid one"');
    assert.match(s.reason + s.remedy, /Settings/, 'and where to put the key');
});

test('Chrome OS is a desktop, not Android', async () => {
    // "Linux" appears in both user agents; only Android says "Android". A looser test
    // would quietly hand every Chromebook the Android verdict, telling those users
    // they must pay for transcription they do not need.
    const p = await loadPlatform({ ua: UA.chromeOS });
    assert.equal(p.isAndroid(), false);
    assert.equal(p.speechRecognitionSupport().usable, true, 'a Chromebook is a fully supported free path');
    assert.match(p.describe(), /desktop/);
});

test('an iPad is never mistaken for Android', async () => {
    for (const ua of [UA.iosSafari, UA.iosChrome, UA.iosEdge]) {
        const p = await loadPlatform({ ua, touch: true });
        assert.equal(p.isAndroid(), false);
    }
});

/* ── The Android default for hearing the other person ──────────────────────────
 *
 * Checked here rather than in a storage test because the whole decision is a
 * platform one, and because the dangerous case is not the happy path.
 */
test('Android defaults to the paid transcription ONLY when a key is set', async () => {
    // A localStorage just for this test: this file deliberately builds its own minimal
    // globals per case rather than using the shared harness, so that the navigator each
    // case sees is exactly the one it declared.
    const load = async (ua, settings) => {
        const store = new Map([['aac_settings', JSON.stringify(settings)]]);
        globalThis.localStorage = {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
            removeItem: (k) => store.delete(k),
        };
        Object.defineProperty(globalThis, 'navigator',
            { value: { userAgent: ua, maxTouchPoints: 5 }, configurable: true, writable: true });
        globalThis.window = { navigator: globalThis.navigator, matchMedia: () => ({ matches: false }) };
        const s = await import('../app/js/storage.js?b=' + Math.random());
        return s.loadSttProvider();
    };
    assert.equal(await load(UA.androidTablet, { deepgramKey: 'dg-key' }), 'deepgram',
        'with a key, Android should use the path it is required to use');
    // ⚠ THE CASE THAT MATTERS. An empty key CONSTRUCTS a paid source fine and then
    // fails at start with 'no-key', which is treated as fatal - so defaulting without
    // a key would leave an Android user unable to listen at all, which is far worse
    // than the imperfect built-in recognizer they have today.
    assert.equal(await load(UA.androidTablet, {}), 'builtin',
        'with no key, Android must keep the recognizer that actually works');
    assert.equal(await load(UA.androidTablet, { deepgramKey: '   ' }), 'builtin',
        'whitespace is not a key');
    // A stored choice is still the user's and always wins.
    assert.equal(await load(UA.androidTablet, { sttProvider: 'builtin', deepgramKey: 'dg-key' }), 'builtin',
        'an explicit choice outranks the platform default');
    // ⚠ NO WINDOWS CASE HERE, and the reason is a real constraint rather than an
    // omission: storage.js imports platform.js WITHOUT a cache-buster, so one platform
    // instance serves this whole file and it captured whichever user agent was set on
    // the first storage import. That is exactly right in a browser - a user agent does
    // not change mid-session - and it means a single process cannot answer for two
    // platforms. The computer side is covered by isAndroid() being false there.
});
