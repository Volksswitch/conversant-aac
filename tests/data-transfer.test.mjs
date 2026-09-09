/*
 * data-transfer.test.mjs — ONE backup, filtered at import.
 *
 * ⚠ THESE DRIVE THE REAL CHAIN, not a fabricated package (the standing cross-layer
 * rule). Every case builds its package with the SHIPPED buildPackage against the
 * SHIPPED storage module, then feeds that output to the shipped parse/filter/apply.
 * Handing the filter a hand-written object would prove nothing about what an export
 * actually contains, which is the whole claim.
 *
 * WHAT IS BEING GUARDED (Ken, September 9 2026): a backup carries everything, it never
 * carries a key, and on a different device the handful of device-bound settings are
 * held back AND REPORTED. Each of those fails silently if it breaks — the app works
 * perfectly either way, and the damage shows up on the far device or in an inbox.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
};
// No showDirectoryPicker and no storage.getDirectory: no data folder at all, which is
// the path these assertions want. platform.js reads navigator.userAgent at import.
globalThis.window = {};
Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    configurable: true, writable: true,
});
globalThis.screen = { width: 1920, height: 1080 };

const storage = await import('../app/js/storage.js');
const dt = await import('../app/js/data-transfer.js');
const platform = await import('../app/js/platform.js');

const EVERY_KEY = ['apiKey', 'deepgramKey', 'azureKey', 'openaiKey', 'googleKey', 'elevenlabsKey'];

// Seeds all four device-bound settings, so every case exercises the filter.
function seed() {
    store.clear();
    const settings = {
        voiceURI: 'Daniel', keyboardDock: 'side', buttonGapPos: 70, silenceThreshold: 0.5,
        keyboardMode: 'onscreen', sttProvider: 'browser', fullscreen: true, appMarginPos: 30,
    };
    for (const k of EVERY_KEY) settings[k] = 'secret-' + k;
    localStorage.setItem('aac_settings', JSON.stringify(settings));
    localStorage.setItem('aac_worldview', JSON.stringify({
        fields: { name: { state: 'answered', value: 'Sam' }, age: { state: 'declined' } },
    }));
    localStorage.setItem('aac_places', JSON.stringify({ places: [{ id: 'p1', name: 'Starbucks' }] }));
}

const HERE = { os: 'desktop', shell: 'tab', screen: '1920x1080' };
const OTHER_OS = { os: 'ios', shell: 'app', screen: '1920x1080' };
const OTHER_SCREEN = { os: 'desktop', shell: 'tab', screen: '820x1180' };

test('one backup carries the content AND the settings AND the profiles', async () => {
    seed();
    const pkg = await dt.buildPackage('9.9.9');
    assert.equal(pkg.kind, dt.PACKAGE_KIND);
    assert.equal(pkg.packageVersion, 3);
    assert.ok(pkg.data['worldview.json'], 'the About Me answers travel');
    assert.ok(pkg.data['places.json'], 'places travel');
    assert.equal(pkg.settings.keyboardDock, 'side', 'settings travel too now');
    assert.ok(Array.isArray(pkg.profiles));
    // The signature is in the HEADER, not inside settings - it is a fact about the
    // file, and inside the bundle it would become a travelling setting.
    assert.equal(pkg.device.os, 'desktop');
    assert.equal(pkg.device.screen, '1920x1080');
    assert.equal(pkg.settings.device, undefined);
});

test('a backup never contains a key, however the settings were stored', async () => {
    seed();
    const text = JSON.stringify(await dt.buildPackage('9.9.9'));
    for (const k of EVERY_KEY) {
        assert.ok(!text.includes(k), `export names ${k}`);
        assert.ok(!text.includes('secret-' + k), `export leaks the ${k} value`);
    }
});

test('same device: everything applies and nothing is held back', async () => {
    seed();
    const pkg = dt.parsePackage(JSON.stringify(await dt.buildPackage('9.9.9')));
    const { settings, heldBack } = dt.settingsForThisDevice(pkg, HERE);
    assert.deepEqual(heldBack, []);
    assert.equal(settings.appMarginPos, 30);
    assert.equal(settings.keyboardMode, 'onscreen');
    assert.equal(settings.fullscreen, true);
});

test('different OS: the OS-bound settings stay behind, and are named', async () => {
    seed();
    const pkg = dt.parsePackage(JSON.stringify(await dt.buildPackage('9.9.9')));
    const { settings, heldBack } = dt.settingsForThisDevice(pkg, OTHER_OS);

    assert.deepEqual(heldBack.map((h) => h.key).sort(),
                     ['fullscreen', 'keyboardMode', 'sttProvider']);
    assert.ok(heldBack.every((h) => h.why === 'os' && h.label));
    for (const k of ['fullscreen', 'keyboardMode', 'sttProvider']) {
        assert.equal(settings[k], undefined, `${k} must not cross an OS boundary`);
    }
    // The screen matches, so the keyguard value DOES come across.
    assert.equal(settings.appMarginPos, 30);
    // And everything operational is untouched - which is the point of the redesign.
    assert.equal(settings.voiceURI, 'Daniel');
    assert.equal(settings.keyboardDock, 'side');
    assert.equal(settings.silenceThreshold, 0.5);
});

test('different screen: only the keyguard value stays behind', async () => {
    seed();
    const pkg = dt.parsePackage(JSON.stringify(await dt.buildPackage('9.9.9')));
    const { settings, heldBack } = dt.settingsForThisDevice(pkg, OTHER_SCREEN);

    assert.deepEqual(heldBack.map((h) => h.key), ['appMarginPos']);
    assert.equal(heldBack[0].why, 'screen');
    assert.equal(settings.appMarginPos, undefined);
    // Same OS, so these cross.
    assert.equal(settings.keyboardMode, 'onscreen');
    assert.equal(settings.sttProvider, 'browser');
});

test('an unknown origin is treated as different on BOTH axes', async () => {
    seed();
    const pkg = dt.parsePackage(JSON.stringify(await dt.buildPackage('9.9.9')));
    delete pkg.device;      // a file from before the signature existed
    const { settings, heldBack } = dt.settingsForThisDevice(pkg, HERE);
    assert.equal(heldBack.length, 4, 'unknown is not the same as equal');
    for (const k of ['fullscreen', 'keyboardMode', 'sttProvider', 'appMarginPos']) {
        assert.equal(settings[k], undefined);
    }
});

test('THE CONTENT ALWAYS TRAVELS WHOLE, whatever the device', async () => {
    seed();
    const pkg = dt.parsePackage(JSON.stringify(await dt.buildPackage('9.9.9')));
    pkg.device = OTHER_OS;                      // as foreign as it gets
    store.clear();
    localStorage.setItem('aac_settings', '{}');
    await dt.applyPackage(pkg);
    // Ken's phrasing called data "a subset of settings"; About Me and places are not
    // settings at all, and the filter must never reach them.
    assert.ok(localStorage.getItem('aac_worldview').includes('Sam'));
    assert.ok(localStorage.getItem('aac_places').includes('Starbucks'));
});

test('applying reports what came in and what did not', async () => {
    seed();
    const pkg = dt.parsePackage(JSON.stringify(await dt.buildPackage('9.9.9')));
    pkg.device = OTHER_SCREEN;
    const done = await dt.applyPackage(pkg);
    assert.equal(done.heldBack.length, 1);
    assert.equal(done.heldBack[0].label, 'screen edge margin');
    assert.ok(done.settings > 0);
    // The real keys on this device are untouched by any of it.
    assert.equal(JSON.parse(localStorage.getItem('aac_settings')).apiKey, 'secret-apiKey');
});

test('a hand-pasted key in a backup still cannot install one', async () => {
    seed();
    const pkg = dt.parsePackage(JSON.stringify(await dt.buildPackage('9.9.9')));
    pkg.settings.apiKey = 'sk-ant-INJECTED';
    pkg.settings.elevenlabsKey = 'INJECTED';
    await dt.applyPackage(pkg);
    const live = JSON.parse(localStorage.getItem('aac_settings'));
    assert.equal(live.apiKey, 'secret-apiKey');
    assert.equal(live.elevenlabsKey, 'secret-elevenlabsKey');
});

/* ── Every file the app has ever written still imports ───────────────────────── */

test('a version-1 backup imports its data, and its settings are declared not applied', async () => {
    seed();
    const pkg = await dt.buildPackage('old');
    pkg.packageVersion = 1;
    pkg.settings = { keyboardDock: 'bottom', voiceURI: 'Zarvox' };
    delete pkg.device;

    const parsed = dt.parsePackage(JSON.stringify(pkg));
    assert.equal(parsed.settings, undefined, 'moved aside rather than applied');
    assert.equal(Object.keys(parsed.legacySettings).length, 2);

    const done = await dt.applyPackage(parsed);
    assert.equal(done.legacySettings, 2, 'so the caller can SAY so');
    assert.equal(storage.getPortableSettings().keyboardDock, 'side', 'not applied');
});

test('a version-2 (data-only) backup still imports', async () => {
    seed();
    const pkg = await dt.buildPackage('x');
    pkg.packageVersion = 2;
    delete pkg.settings;
    delete pkg.device;
    const done = await dt.applyPackage(dt.parsePackage(JSON.stringify(pkg)));
    assert.ok(done.files.length, 'the content came across');
    assert.equal(done.settings, 0);
});

test('the settings-only file that existed for one day still imports', async () => {
    seed();
    const settingsOnly = {
        kind: dt.SETTINGS_KIND, packageVersion: 2, appVersion: 'x',
        exportedAt: new Date().toISOString(),
        settings: { keyboardDock: 'bottom', voiceURI: 'Karen' },
        profiles: [], activeProfile: '',
        device: HERE,
    };
    const parsed = dt.parsePackage(JSON.stringify(settingsOnly));
    assert.deepEqual(parsed.data, {}, 'normalized so downstream sees one shape');
    await dt.applyPackage(parsed);
    assert.equal(storage.getPortableSettings().keyboardDock, 'bottom');
});

test('a newer file is refused rather than half-read', async () => {
    seed();
    const pkg = await dt.buildPackage('x');
    pkg.packageVersion = dt.PACKAGE_VERSION + 1;
    assert.throws(() => dt.parsePackage(JSON.stringify(pkg)), /newer version/);
});

test('something that is not a Conversant backup is refused legibly', () => {
    assert.throws(() => dt.parsePackage('{"kind":"something-else"}'), /not a Conversant backup/);
    assert.throws(() => dt.parsePackage('not json at all'), /not readable as JSON/);
});

test('the backup is named for what it now is', () => {
    const when = new Date(2026, 8, 9, 14, 32);
    assert.equal(dt.suggestedFilename(when), 'conversant-backup-2026-09-09-1432.json');
});

test('the signature reads the DISPLAY, not the window', () => {
    // ⚠ THE WHOLE REASON IT READS `screen`: a viewport-based signature would report the
    // same machine as a different device between two exports an hour apart.
    const a = platform.deviceSignature();
    assert.equal(a.screen, '1920x1080');

    globalThis.screen = { width: 820, height: 1180 };
    assert.notEqual(platform.deviceSignature().screen, a.screen);
    globalThis.screen = { width: 1920, height: 1080 };

    // Unknown is never a match, in either direction.
    assert.equal(platform.compareDevice({ os: 'desktop', shell: 'tab', screen: '' }, HERE).sameScreen, false);
    assert.equal(platform.compareDevice(null, HERE).known, false);
    assert.equal(platform.compareDevice(HERE, HERE).sameOs, true);
    // The shell is part of the OS axis: an iPad tab and an iPad Home Screen app differ
    // in whether the free recognizer works at all.
    assert.equal(platform.compareDevice({ os: 'ios', shell: 'tab', screen: 'x' },
                                        { os: 'ios', shell: 'app', screen: 'x' }).sameOs, false);
});

test('a held-back setting KEEPS this device\'s value rather than resetting it', async () => {
    // ⚠ THE BUG THIS GUARDS, found by reading stored settings after a real cross-device
    // import in the browser: applyPortableSettings REPLACES the portable subset, so
    // simply omitting a held-back key DELETED it and fell back to the default. The
    // restart card said "left as they are here", which was then a plain untruth.
    seed();
    const pkg = dt.parsePackage(JSON.stringify(await dt.buildPackage('9.9.9')));
    // Different on BOTH axes, so all four are held back. (OTHER_OS shares this screen,
    // so the margin would legitimately travel there - the first draft of this test got
    // that wrong and the code was right.)
    pkg.device = { os: 'ios', shell: 'app', screen: '820x1180' };
    // Give this device its own distinct values for the device-bound settings.
    storage.applyPortableSettings({
        ...storage.getPortableSettings(),
        keyboardMode: 'physical', sttProvider: 'deepgram', fullscreen: false, appMarginPos: 5,
    });
    pkg.settings.keyboardMode = 'onscreen';
    pkg.settings.sttProvider = 'browser';
    pkg.settings.appMarginPos = 30;

    await dt.applyPackage(pkg);
    const now = storage.getPortableSettings();
    assert.equal(now.keyboardMode, 'physical', "this device's value survives");
    assert.equal(now.sttProvider, 'deepgram');
    assert.equal(now.fullscreen, false);
    assert.equal(now.appMarginPos, 5);
    // And what was allowed through really did come from the file.
    assert.equal(now.voiceURI, 'Daniel');
});
