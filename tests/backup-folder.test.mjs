/* Tier 2 — a REAL backup written into a REAL folder, and read back out.
 *
 * ⚠ THE FOLDER IS NOT THE OBSTACLE IT USED TO BE CALLED. The File System Access picker
 * needs a native dialog nobody can drive, but that is not the only way storage.js gets
 * a root: with no picker present it adopts the browser's own private filesystem, which
 * needs no gesture. So saveBackup / listBackups / readBackup and the whole profile path
 * run for real here, and what is asserted is the bytes that landed — not a helper's
 * return value.
 *
 * ⚠ WHAT THIS CANNOT REACH, stated rather than glossed: `hasVisibleDataFolder()` is
 * false on this path by construction, and that flag is what app.js branches on to
 * choose folder-or-download. The no-folder side was exercised in the browser; the
 * folder side of that one `if` is the link no automated check here runs.
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
        // getFile() on whatever entries() hands it and skips anything that throws, so a
        // stub here makes every backup silently invisible.
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
    value: { storage: { getDirectory: async () => root },
             userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    configurable: true, writable: true,
});
globalThis.screen = { width: 1920, height: 1080 };
globalThis.indexedDB = undefined;

const storage = await import('../app/js/storage.js');
const dt = await import('../app/js/data-transfer.js');

async function backupsDir() { return root.getDirectoryHandle('backups'); }
async function settingsDir() { return root.getDirectoryHandle('settings'); }

test('a backup lands in the folder and carries no key', async () => {
    assert.equal(await storage.restoreDataFolder(), true);
    localStorage.setItem('aac_settings', JSON.stringify({
        voiceURI: 'Daniel', keyboardDock: 'side', appMarginPos: 30,
        apiKey: 'sk-ant-SECRET', deepgramKey: 'DG-SECRET',
    }));
    localStorage.setItem('aac_places', JSON.stringify({ places: [{ id: 'p1', name: 'Starbucks' }] }));

    const { path } = await dt.savePackageToFolder('9.9.9');
    assert.ok(path);

    const dir = await backupsDir();
    const names = [...dir._files.keys()];
    assert.equal(names.length, 1, 'one file, not two');
    assert.ok(names[0].startsWith('conversant-backup-'), names[0]);
    for (const [, rec] of dir._files) {
        for (const secret of ['sk-ant-SECRET', 'DG-SECRET', 'apiKey', 'deepgramKey']) {
            assert.ok(!rec.data.includes(secret), `the file on disk contains ${secret}`);
        }
    }
});

test('the folder list shows it, and it restores through the real reader', async () => {
    const all = await storage.listBackups();
    assert.equal(all.length, 1);
    const pkg = dt.parsePackage(await storage.readBackup(all[0].name));
    assert.ok(pkg.data['places.json'], 'the content came back');
    assert.equal(pkg.settings.keyboardDock, 'side', 'and so did the settings');
    assert.equal(pkg.device.os, 'desktop', 'stamped with where it came from');
});

test('a backup under ANY older name still lists and still restores', async () => {
    // Every prefix this app has ever written. An import is judged by the `kind` inside
    // the file, never by its name, so none of these may disappear from the list that
    // restores them.
    for (const name of ['conversant-data-2026-09-09-1000.json',
                        'conversant-backup-2026-07-30-1432.json',
                        'a file I renamed myself.json']) {
        await storage.saveBackup(name, JSON.stringify(await dt.buildPackage('old')));
    }
    const names = (await storage.listBackups()).map((b) => b.name);
    for (const n of ['conversant-data-2026-09-09-1000.json', 'a file I renamed myself.json']) {
        assert.ok(names.includes(n), `${n} vanished from the list`);
    }
    assert.ok(dt.parsePackage(await storage.readBackup('a file I renamed myself.json')).data);
});

/* ── Profiles ride along, and a collision renames ─────────────────────────── */

test('a backup carries every saved profile and which was current', async () => {
    localStorage.setItem('aac_settings', JSON.stringify({ keyboardDock: 'side', voiceURI: 'Daniel' }));
    await storage.saveSettingsProfile('Ken Surface');
    storage.applyPortableSettings({ keyboardDock: 'bottom', voiceURI: 'Karen' });
    await storage.saveSettingsProfile('Ken iPad');
    storage.saveActiveSettingsProfile('Ken iPad');

    const pkg = await dt.buildPackage('9.9.9');
    assert.deepEqual(pkg.profiles.map((p) => p.name).sort(), ['Ken Surface', 'Ken iPad'].sort());
    assert.equal(pkg.activeProfile, 'Ken iPad');
    // Each profile carries its OWN settings, not a copy of the live ones.
    assert.equal(pkg.profiles.find((p) => p.name === 'Ken Surface').settings.voiceURI, 'Daniel');
});

test('importing puts the profiles back and marks the right one current', async () => {
    const pkg = await dt.buildPackage('9.9.9');
    for (const n of await storage.listSettingsProfiles()) await storage.deleteSettingsProfile(n);
    storage.applyPortableSettings({ keyboardDock: 'side', voiceURI: 'Zarvox' });
    storage.saveActiveSettingsProfile('');

    const done = await dt.applyPackage(dt.parsePackage(JSON.stringify(pkg)));
    assert.deepEqual((await storage.listSettingsProfiles()).sort(), ['Ken Surface', 'Ken iPad'].sort());
    assert.equal(storage.loadActiveSettingsProfile(), 'Ken iPad');
    assert.equal(done.activeProfile, 'Ken iPad');
    assert.equal(storage.getPortableSettings().voiceURI, 'Karen', 'the live settings came back too');

    // A restored profile still loads by name, so it is a real profile and not just a
    // file that happens to sit in the folder.
    await storage.applySettingsProfile('Ken Surface');
    assert.equal(storage.getPortableSettings().voiceURI, 'Daniel');
});

test('a name collision renames the incoming profile and replaces nothing', async () => {
    for (const n of await storage.listSettingsProfiles()) await storage.deleteSettingsProfile(n);
    storage.applyPortableSettings({ keyboardDock: 'side', voiceURI: 'MINE' });
    await storage.saveSettingsProfile('Ken iPad');
    await storage.saveSettingsProfile('Only Here');

    const incoming = {
        kind: dt.PACKAGE_KIND, packageVersion: 3, appVersion: 'x',
        exportedAt: new Date().toISOString(), data: {},
        device: { os: 'desktop', shell: 'tab', screen: '1920x1080' },
        settings: { voiceURI: 'THEIRS' },
        profiles: [
            { name: 'Ken iPad', settings: { voiceURI: 'THEIRS' } },
            { name: 'Brand New', settings: { voiceURI: 'NEW' } },
        ],
        activeProfile: 'Ken iPad',
    };
    const done = await dt.applyPackage(dt.parsePackage(JSON.stringify(incoming)));

    assert.deepEqual((await storage.listSettingsProfiles()).sort(),
                     ['Brand New', 'Ken iPad', 'Ken iPad (2)', 'Only Here'].sort());
    await storage.applySettingsProfile('Ken iPad');
    assert.equal(storage.getPortableSettings().voiceURI, 'MINE', 'mine is untouched');
    await storage.applySettingsProfile('Ken iPad (2)');
    assert.equal(storage.getPortableSettings().voiceURI, 'THEIRS');

    assert.deepEqual(done.renamed, [{ requested: 'Ken iPad', written: 'Ken iPad (2)' }]);
    // ⚠ THE MARKER FOLLOWS THE RENAME. Pointing at the requested name would point the
    // picker at THIS device's profile of that name - a different configuration that
    // happens to share a title, which is what renaming exists to avoid.
    assert.equal(done.activeProfile, 'Ken iPad (2)');
});

test('a second collision counts on to (3), parentheses and all', async () => {
    const incoming = {
        kind: dt.PACKAGE_KIND, packageVersion: 3, appVersion: 'x',
        exportedAt: new Date().toISOString(), data: {}, settings: {},
        device: { os: 'desktop', shell: 'tab', screen: '1920x1080' },
        profiles: [{ name: 'Ken iPad', settings: { voiceURI: 'THIRD' } }],
        activeProfile: 'Ken iPad',
    };
    const done = await dt.applyPackage(dt.parsePackage(JSON.stringify(incoming)));
    assert.deepEqual(done.renamed, [{ requested: 'Ken iPad', written: 'Ken iPad (3)' }]);
    // The name sanitizer used to strip parentheses, which would have made this
    // "Ken iPad 3" - a name that reads as one the user chose.
    assert.ok((await storage.listSettingsProfiles()).includes('Ken iPad (3)'));
});

test('two profiles sharing a name inside ONE file still separate', async () => {
    for (const n of await storage.listSettingsProfiles()) await storage.deleteSettingsProfile(n);
    const incoming = {
        kind: dt.PACKAGE_KIND, packageVersion: 3, appVersion: 'x',
        exportedAt: new Date().toISOString(), data: {}, settings: {},
        device: { os: 'desktop', shell: 'tab', screen: '1920x1080' },
        profiles: [{ name: 'Twin', settings: { voiceURI: 'A' } },
                   { name: 'Twin', settings: { voiceURI: 'B' } }],
        activeProfile: '',
    };
    await dt.applyPackage(dt.parsePackage(JSON.stringify(incoming)));
    assert.deepEqual((await storage.listSettingsProfiles()).sort(), ['Twin', 'Twin (2)']);
    await storage.applySettingsProfile('Twin');
    assert.equal(storage.getPortableSettings().voiceURI, 'A');
    await storage.applySettingsProfile('Twin (2)');
    assert.equal(storage.getPortableSettings().voiceURI, 'B');
});

test('a profile in the file cannot smuggle in a key', async () => {
    localStorage.setItem('aac_settings', JSON.stringify({
        ...JSON.parse(localStorage.getItem('aac_settings')), apiKey: 'sk-ant-REAL',
    }));
    const incoming = {
        kind: dt.PACKAGE_KIND, packageVersion: 3, appVersion: 'x',
        exportedAt: new Date().toISOString(), data: {}, settings: {},
        device: { os: 'desktop', shell: 'tab', screen: '1920x1080' },
        profiles: [{ name: 'Sneaky', settings: { apiKey: 'sk-ant-INJECTED', elevenlabsKey: 'INJECTED' } }],
        activeProfile: '',
    };
    await dt.applyPackage(dt.parsePackage(JSON.stringify(incoming)));
    assert.equal(JSON.parse(localStorage.getItem('aac_settings')).apiKey, 'sk-ant-REAL');

    const dir = await settingsDir();
    for (const [, rec] of dir._files) {
        assert.ok(!rec.data.includes('sk-ant-INJECTED'));
        assert.ok(!rec.data.includes('INJECTED'));
    }
});

test('unsaved changes to the current profile are detectable before an export', async () => {
    for (const n of await storage.listSettingsProfiles()) await storage.deleteSettingsProfile(n);
    storage.applyPortableSettings({ keyboardDock: 'side', voiceURI: 'Daniel' });
    await storage.saveSettingsProfile('Desk');
    storage.saveActiveSettingsProfile('Desk');
    assert.deepEqual(await storage.activeProfileUnsaved(), { name: 'Desk', differs: false });

    storage.applyPortableSettings({ ...storage.getPortableSettings(), voiceURI: 'Moira' });
    assert.deepEqual(await storage.activeProfileUnsaved(), { name: 'Desk', differs: true });

    await storage.saveSettingsProfile('Desk');
    assert.deepEqual(await storage.activeProfileUnsaved(), { name: 'Desk', differs: false });

    storage.saveActiveSettingsProfile('');
    assert.deepEqual(await storage.activeProfileUnsaved(), { name: '', differs: false });
});
