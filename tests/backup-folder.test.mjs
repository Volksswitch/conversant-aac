/* Tier 2 — REAL backups written into a REAL folder, both kinds, in one place.
 *
 * WHY THIS EXISTS (Ken, September 9 2026): *"Shouldn't we be consistent with where
 * backups are stored? It seems to me that all backups should be written to the data
 * folder with the exception of those installations where one cannot create a data
 * folder."* Both kinds now go to <data folder>/backups/, so the thing that has to
 * hold is that TWO kinds sharing ONE folder still come back to the right list and
 * restore as themselves.
 *
 * ⚠ THE FOLDER IS NOT THE OBSTACLE IT USED TO BE CALLED. The File System Access
 * picker needs a native dialog nobody can drive, but that is not the only way
 * storage.js gets a root: with no picker present it adopts the browser's own private
 * filesystem, which needs no gesture. So saveBackup / listBackups / readBackup all
 * run for real here, and what is asserted is the bytes that landed — not a helper's
 * return value.
 *
 * ⚠ WHAT THIS CANNOT REACH, stated rather than glossed: `hasVisibleDataFolder()` is
 * false on this path by construction (device storage is not a folder the user can
 * see), and that flag is what app.js branches on to choose folder-or-download. The
 * branch itself was exercised in the browser on the no-folder side; the folder side
 * of that ONE `if` is the link no automated check here runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/* ── A directory handle that behaves like the browser's ───────────────────── */

function makeDir(name = '') {
    const files = new Map();
    const dirs = new Map();
    return {
        kind: 'directory', name,
        async getDirectoryHandle(n, opts = {}) {
            if (!dirs.has(n)) {
                if (!opts.create) throw new Error('NotFoundError');
                dirs.set(n, makeDir(n));
            }
            return dirs.get(n);
        },
        async getFileHandle(n, opts = {}) {
            if (!files.has(n)) {
                if (!opts.create) throw new Error('NotFoundError');
                files.set(n, { name: n, data: '' });
            }
            const rec = files.get(n);
            return {
                kind: 'file', name: n,
                async getFile() {
                    return { size: rec.data.length, lastModified: rec.at || 0, text: async () => rec.data };
                },
                async createWritable({ keepExistingData = false } = {}) {
                    let buf = keepExistingData ? rec.data : '';
                    let pos = buf.length;
                    return {
                        async write(chunk) { buf = buf.slice(0, pos) + chunk; pos = buf.length; },
                        async seek(p) { pos = p; },
                        async close() { rec.data = buf; rec.at = Date.now(); },
                    };
                },
            };
        },
        async removeEntry(n) { files.delete(n); dirs.delete(n); },
        // ⚠ Yields a REAL file handle, not a { kind, name } stub. listBackups() calls
        // getFile() on whatever entries() hands it and skips anything that throws, so
        // a stub here makes every backup silently invisible and the test passes for
        // the wrong reason — or, as it did, fails with an empty list and no clue why.
        async *entries() {
            for (const [k] of files) yield [k, await this.getFileHandle(k)];
            for (const [k, v] of dirs) yield [k, v];
        },
        _files: files, _dirs: dirs,
    };
}

const root = makeDir('root');
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
globalThis.window = { dispatchEvent() { return true; } };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
Object.defineProperty(globalThis, 'navigator', {
    value: { storage: { getDirectory: async () => root } },
    configurable: true, writable: true,
});
globalThis.indexedDB = undefined;

const storage = await import('../app/js/storage.js');
const dt = await import('../app/js/data-transfer.js');

async function backupsDir() { return root.getDirectoryHandle('backups'); }

test('both kinds of backup land in the SAME folder', async () => {
    assert.equal(await storage.restoreDataFolder(), true);
    localStorage.setItem('aac_settings', JSON.stringify({
        voiceURI: 'Daniel', keyboardDock: 'side', apiKey: 'sk-ant-SECRET', deepgramKey: 'DG-SECRET',
    }));
    localStorage.setItem('aac_places', JSON.stringify({ places: [{ id: 'p1', name: 'Starbucks' }] }));

    const data = await dt.savePackageToFolder('9.9.9');
    const settings = await dt.saveSettingsPackageToFolder('9.9.9');

    const dir = await backupsDir();
    const names = [...dir._files.keys()];
    assert.equal(names.length, 2, 'one folder, both files');
    assert.ok(names.some((n) => n.startsWith('conversant-data-')), names.join());
    assert.ok(names.some((n) => n.startsWith('conversant-settings-')), names.join());
    assert.ok(data.path && settings.path);
});

test('neither file on disk contains a key', async () => {
    const dir = await backupsDir();
    for (const [name, rec] of dir._files) {
        for (const secret of ['sk-ant-SECRET', 'DG-SECRET', 'apiKey', 'deepgramKey']) {
            assert.ok(!rec.data.includes(secret), `${name} contains ${secret}`);
        }
    }
});

test('the two lists split the one folder, and each restores its own', async () => {
    const all = await storage.listBackups();
    assert.equal(all.length, 2);

    const dataList = all.filter((b) => dt.isDataBackupName(b.name));
    const settingsList = all.filter((b) => dt.isSettingsBackupName(b.name));
    assert.equal(dataList.length, 1);
    assert.equal(settingsList.length, 1);

    // Read each back through the real reader and put it through the real parser —
    // the whole point being that a file taken from the shared folder is still
    // recognisable as what it is.
    const dataText = await storage.readBackup(dataList[0].name);
    const settingsText = await storage.readBackup(settingsList[0].name);

    const dataPkg = dt.parsePackage(dataText);
    assert.ok(dataPkg.data['places.json'], 'the data came back');

    const settingsPkg = dt.parseSettingsPackage(settingsText);
    assert.equal(settingsPkg.settings.keyboardDock, 'side');

    // And each importer still refuses the other, even coming off the same folder.
    assert.throws(() => dt.parseSettingsPackage(dataText), /data backup, not a settings file/);
    assert.throws(() => dt.parsePackage(settingsText), /not a Conversant data backup/);
});

test('restoring the settings file from the folder puts the settings back', async () => {
    const all = await storage.listBackups();
    const name = all.find((b) => dt.isSettingsBackupName(b.name)).name;

    storage.applyPortableSettings({ keyboardDock: 'bottom', voiceURI: 'Zarvox' });
    assert.equal(storage.getPortableSettings().keyboardDock, 'bottom');

    dt.applySettingsPackage(dt.parseSettingsPackage(await storage.readBackup(name)));
    assert.equal(storage.getPortableSettings().keyboardDock, 'side');
    assert.equal(storage.getPortableSettings().voiceURI, 'Daniel');

    // The keys were never in the file and are still on the device.
    const live = JSON.parse(localStorage.getItem('aac_settings'));
    assert.equal(live.apiKey, 'sk-ant-SECRET');
    assert.equal(live.deepgramKey, 'DG-SECRET');
});

test('an OLD backup in the folder is still listed and still restores', async () => {
    // Exactly what a file made before September 9 2026 looks like: the old name.
    const dir = await backupsDir();
    const old = JSON.stringify(await dt.buildPackage('old'));
    await storage.saveBackup('conversant-backup-2026-07-30-1432.json', old);

    const all = await storage.listBackups();
    const dataList = all.filter((b) => dt.isDataBackupName(b.name));
    assert.ok(dataList.some((b) => b.name.startsWith('conversant-backup-')),
              'the old name must not vanish from the list that restores it');
    assert.ok(!all.filter((b) => dt.isSettingsBackupName(b.name))
                  .some((b) => b.name.startsWith('conversant-backup-')));

    const text = await storage.readBackup('conversant-backup-2026-07-30-1432.json');
    assert.ok(dt.parsePackage(text).data['places.json']);
    assert.ok(dir._files.size >= 3);
});

/* ── Profiles ride along in a settings backup (Ken, September 9 2026) ─────── */

test('a settings backup carries every saved profile and which was current', async () => {
    // Two profiles, saved the way the app saves them, then one made current.
    localStorage.setItem('aac_settings', JSON.stringify({ keyboardDock: 'side', voiceURI: 'Daniel' }));
    await storage.saveSettingsProfile('Ken Surface');
    storage.applyPortableSettings({ keyboardDock: 'bottom', voiceURI: 'Karen' });
    await storage.saveSettingsProfile('Ken iPad');
    storage.saveActiveSettingsProfile('Ken iPad');

    const pkg = await dt.buildSettingsPackage('9.9.9');
    assert.deepEqual(pkg.profiles.map((p) => p.name).sort(), ['Ken Surface', 'Ken iPad'].sort());
    assert.equal(pkg.activeProfile, 'Ken iPad');
    // Each profile carries its OWN settings, not a copy of the live ones.
    const surface = pkg.profiles.find((p) => p.name === 'Ken Surface');
    assert.equal(surface.settings.keyboardDock, 'side');
    assert.equal(surface.settings.voiceURI, 'Daniel');

    // And the summary the user reads before importing says what is in it.
    const said = dt.summarizeSettings(pkg).join('\n');
    assert.match(said, /2 saved profiles/);
    assert.match(said, /"Ken iPad" will be the one in use/);
});

test('importing puts the profiles back and marks the right one current', async () => {
    const pkg = await dt.buildSettingsPackage('9.9.9');

    // Wipe the lot: different settings, different profiles, nothing current.
    for (const n of await storage.listSettingsProfiles()) await storage.deleteSettingsProfile(n);
    storage.applyPortableSettings({ keyboardDock: 'side', voiceURI: 'Zarvox' });
    storage.saveActiveSettingsProfile('');
    assert.deepEqual(await storage.listSettingsProfiles(), []);

    const done = await dt.applySettingsPackage(dt.parseSettingsPackage(JSON.stringify(pkg)));
    assert.deepEqual((await storage.listSettingsProfiles()).sort(), ['Ken Surface', 'Ken iPad'].sort());
    assert.equal(storage.loadActiveSettingsProfile(), 'Ken iPad');
    assert.equal(done.activeProfile, 'Ken iPad');

    // The settings IN EFFECT came back too, and they are the live ones from the
    // export rather than the active profile's - the same thing here, and the
    // distinction is asserted in the next test.
    assert.equal(storage.getPortableSettings().voiceURI, 'Karen');

    // A restored profile still loads by name, so it is a real profile and not just
    // a file that happens to sit in the folder.
    await storage.applySettingsProfile('Ken Surface');
    assert.equal(storage.getPortableSettings().voiceURI, 'Daniel');
});

test('an unsaved tweak survives the round trip rather than being reverted', async () => {
    // Load a profile, then change something WITHOUT saving it - the case where the
    // settings in effect and the active profile disagree.
    await storage.applySettingsProfile('Ken iPad');
    storage.saveActiveSettingsProfile('Ken iPad');
    const tweaked = { ...storage.getPortableSettings(), voiceURI: 'Moira' };
    storage.applyPortableSettings(tweaked);

    const pkg = await dt.buildSettingsPackage('9.9.9');
    storage.applyPortableSettings({ voiceURI: 'Zarvox' });
    await dt.applySettingsPackage(dt.parseSettingsPackage(JSON.stringify(pkg)));

    // The device comes back exactly as it was, tweak included, with the profile
    // still marked current - NOT reverted to what "Ken iPad" holds.
    assert.equal(storage.getPortableSettings().voiceURI, 'Moira');
    assert.equal(storage.loadActiveSettingsProfile(), 'Ken iPad');
});

test('a profile in the file cannot smuggle in a key', async () => {
    const pkg = await dt.buildSettingsPackage('9.9.9');
    localStorage.setItem('aac_settings', JSON.stringify({
        ...JSON.parse(localStorage.getItem('aac_settings')), apiKey: 'sk-ant-REAL',
    }));
    pkg.profiles[0].settings.apiKey = 'sk-ant-INJECTED';
    pkg.profiles[0].settings.elevenlabsKey = 'INJECTED';

    await dt.applySettingsPackage(dt.parseSettingsPackage(JSON.stringify(pkg)));
    assert.equal(JSON.parse(localStorage.getItem('aac_settings')).apiKey, 'sk-ant-REAL');

    // And the key is not sitting in the profile file on disk either.
    const dir = await root.getDirectoryHandle('settings');
    for (const [, rec] of dir._files) {
        assert.ok(!rec.data.includes('sk-ant-INJECTED'));
        assert.ok(!rec.data.includes('INJECTED'));
    }
});
