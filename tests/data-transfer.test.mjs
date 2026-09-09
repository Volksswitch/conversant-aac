/*
 * data-transfer.test.mjs — the two export files, and the wall between them.
 *
 * ⚠ THESE DRIVE THE REAL CHAIN, not a fabricated package (the standing cross-layer
 * rule). Every case below builds its package with the SHIPPED buildPackage /
 * buildSettingsPackage against the SHIPPED storage module, then feeds that output
 * to the shipped parse/apply. Handing summarize() a hand-written object would have
 * proved nothing about what an export actually contains, which is the whole claim.
 *
 * WHAT IS BEING GUARDED (Ken, September 9 2026): a data export must not carry
 * settings, and NEITHER file may ever carry a key. Both failures are silent — the
 * app works perfectly either way and the damage is only visible on the device the
 * file is carried to, or in whatever inbox it passes through.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// storage.js reaches for these at import time.
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
};
// No showDirectoryPicker and no storage.getDirectory: the module then has no data
// folder at all, which is the no-folder path every assertion here wants.
globalThis.window = {};
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });

const storage = await import('../app/js/storage.js');
const dt = await import('../app/js/data-transfer.js');

const EVERY_KEY = ['apiKey', 'deepgramKey', 'azureKey', 'openaiKey', 'googleKey', 'elevenlabsKey'];

function seed() {
    store.clear();
    // Real, current setting keys. NOT buttonSizePos: it was retired in 0.10.3 and
    // saveSettings migrates it into buttonGapPos, so a test using it would be
    // asserting against a value the app deliberately rewrites.
    const settings = { voiceURI: 'Daniel', keyboardDock: 'side', buttonGapPos: 70, silenceThreshold: 0.5 };
    for (const k of EVERY_KEY) settings[k] = 'secret-' + k;
    localStorage.setItem('aac_settings', JSON.stringify(settings));
    localStorage.setItem('aac_worldview', JSON.stringify({
        fields: { name: { state: 'answered', value: 'Sam' }, age: { state: 'declined' } },
    }));
    localStorage.setItem('aac_places', JSON.stringify({ places: [{ id: 'p1', name: 'Starbucks' }] }));
}

test('a data export carries the data and NOT the settings', async () => {
    seed();
    const pkg = await dt.buildPackage('9.9.9');
    assert.equal(pkg.kind, dt.PACKAGE_KIND);
    assert.ok(pkg.data['worldview.json'], 'the About Me answers travel');
    assert.ok(pkg.data['places.json'], 'places travel');
    assert.equal(pkg.settings, undefined, 'no settings block at all');
    // The layout values specifically: these are the ones that make a data import
    // onto a differently-shaped device actively worse.
    const text = JSON.stringify(pkg);
    for (const k of ['keyboardDock', 'buttonGapPos', 'voiceURI']) {
        assert.ok(!text.includes(k), `a data export must not mention ${k}`);
    }
});

test('NEITHER file can carry a key, however the settings were stored', async () => {
    seed();
    const data = JSON.stringify(await dt.buildPackage('9.9.9'));
    const settings = JSON.stringify(dt.buildSettingsPackage('9.9.9'));
    for (const k of EVERY_KEY) {
        assert.ok(!data.includes(k), `data export names ${k}`);
        assert.ok(!data.includes('secret-' + k), `data export leaks the ${k} value`);
        assert.ok(!settings.includes(k), `settings export names ${k}`);
        assert.ok(!settings.includes('secret-' + k), `settings export leaks the ${k} value`);
    }
});

test('a settings export round-trips the real settings and restores them', async () => {
    seed();
    const pkg = dt.buildSettingsPackage('9.9.9');
    assert.equal(pkg.kind, dt.SETTINGS_KIND);
    assert.equal(pkg.settings.keyboardDock, 'side');
    assert.equal(pkg.settings.buttonGapPos, 70);

    // Change them, then put the file back through the shipped parser and applier.
    storage.applyPortableSettings({ keyboardDock: 'bottom', buttonGapPos: 10 });
    assert.equal(storage.getPortableSettings().keyboardDock, 'bottom');

    const reparsed = dt.parseSettingsPackage(JSON.stringify(pkg));
    dt.applySettingsPackage(reparsed);
    assert.equal(storage.getPortableSettings().keyboardDock, 'side', 'the setting came back');
    assert.equal(storage.getPortableSettings().buttonGapPos, 70);
});

test('a settings file cannot install a key even if one is pasted into it', () => {
    seed();
    const pkg = dt.buildSettingsPackage('9.9.9');
    // Somebody hand-edits the file, or an older/hostile file arrives with keys in it.
    pkg.settings.apiKey = 'sk-ant-injected';
    pkg.settings.deepgramKey = 'injected';
    dt.applySettingsPackage(dt.parseSettingsPackage(JSON.stringify(pkg)));
    const live = JSON.parse(localStorage.getItem('aac_settings'));
    assert.equal(live.apiKey, 'secret-apiKey', 'the real key is untouched');
    assert.equal(live.deegramKey, undefined);
    assert.equal(live.deepgramKey, 'secret-deepgramKey');
});

test('importing DATA never touches settings, not even from an old file that has them', async () => {
    seed();
    const pkg = await dt.buildPackage('9.9.9');
    // A version-1 package, which is what every backup made before September 9 2026
    // looks like: it carries a settings block.
    pkg.packageVersion = 1;
    pkg.settings = { keyboardDock: 'bottom', buttonGapPos: 5 };

    const parsed = dt.parsePackage(JSON.stringify(pkg));
    await dt.applyPackage(parsed);
    assert.equal(storage.getPortableSettings().keyboardDock, 'side', 'the old settings were ignored');
    assert.equal(storage.getPortableSettings().buttonGapPos, 70);

    // And it SAYS so rather than dropping them silently - the user is looking at
    // this list when they decide whether to import.
    const said = dt.summarize(parsed).join('\n');
    assert.match(said, /NOT restored/, 'the summary admits the settings are ignored');
});

test('each importer refuses the other one\'s file, and says which it got', async () => {
    seed();
    const dataFile = JSON.stringify(await dt.buildPackage('9.9.9'));
    const settingsFile = JSON.stringify(dt.buildSettingsPackage('9.9.9'));

    assert.throws(() => dt.parseSettingsPackage(dataFile), /data backup, not a settings file/);
    assert.throws(() => dt.parsePackage(settingsFile), /not a Conversant backup/);
});

test('a newer file is refused rather than half-read', () => {
    seed();
    const pkg = dt.buildSettingsPackage('9.9.9');
    pkg.packageVersion = dt.SETTINGS_VERSION + 1;
    assert.throws(() => dt.parseSettingsPackage(JSON.stringify(pkg)), /newer version/);
});

test('the two files are named differently enough to tell apart in a folder', () => {
    const when = new Date(2026, 8, 9, 14, 32);
    assert.equal(dt.suggestedFilename(when), 'conversant-backup-2026-09-09-1432.json');
    assert.equal(dt.suggestedSettingsFilename(when), 'conversant-settings-2026-09-09-1432.json');
});
