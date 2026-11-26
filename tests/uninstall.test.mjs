/* "Delete everything on this device" (Ken, November 22 2026) - uninstall.js.
 *
 * What is checked here: that everything the browser keeps for the app goes; that in a
 * data folder the user can see, only what the app made goes and the user's own files
 * stay, even inside folders that share the app's folder names; that nothing can be
 * written afterwards; that something put back while the delete runs is caught by the
 * second look; that a copy of the app waiting in another window is noticed; and that
 * the list of the app's files keeps up with what the app actually writes.
 *
 * What is NOT checked here: the two red cards, the backup, and the page shown at the
 * end, which live in app.js and are driven in a real browser by
 * scripts/uninstall/browser-check.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import * as un from '../app/js/uninstall.js';
import { LOCK_NAME } from '../app/js/single-instance.js';

/* ── A folder that behaves like the browser's ───────────────────────────────── */

function domError(name) {
    const e = new Error(name);
    e.name = name;
    return e;
}

function file(name, text = '') {
    return { kind: 'file', name, async getFile() { return { text: async () => text }; } };
}

function dir(name = '') {
    const kids = new Map();
    const handle = {
        kind: 'directory', name, _kids: kids,
        async getDirectoryHandle(n, { create = false } = {}) {
            const k = kids.get(n);
            if (k) { if (k.kind !== 'directory') throw domError('TypeMismatchError'); return k; }
            if (!create) throw domError('NotFoundError');
            const d = dir(n);
            kids.set(n, d);
            return d;
        },
        async getFileHandle(n, { create = false } = {}) {
            const k = kids.get(n);
            if (k) { if (k.kind !== 'file') throw domError('TypeMismatchError'); return k; }
            if (!create) throw domError('NotFoundError');
            const f = file(n);
            kids.set(n, f);
            return f;
        },
        // As the browser does: a folder with anything in it goes only when asked to go
        // with its contents.
        async removeEntry(n, { recursive = false } = {}) {
            const k = kids.get(n);
            if (!k) throw domError('NotFoundError');
            if (k.kind === 'directory' && k._kids.size && !recursive) throw domError('InvalidModificationError');
            kids.delete(n);
        },
        async *entries() { for (const [n, k] of [...kids]) yield [n, k]; },
        add(n, text = '') { kids.set(n, file(n, text)); return handle; },
        sub(n) { const d = dir(n); kids.set(n, d); return d; },
        names() { return [...kids.keys()].sort(); },
    };
    return handle;
}

/* ── What the browser keeps, standing in for the real thing ─────────────────── */

function makeEnv({ databases = ['aac-db', 'conversant-voice-audio'], listable = true, workers = 1 } = {}) {
    class Storage {
        constructor() { this._m = new Map(); }
        get length() { return this._m.size; }
        getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }
        setItem(k, v) { this._m.set(k, String(v)); }
        removeItem(k) { this._m.delete(k); }
        clear() { this._m.clear(); }
    }
    class IDBFactory {
        constructor() { this._dbs = new Set(databases); }
        open(name) { this._dbs.add(name); return {}; }
        deleteDatabase(name) {
            const req = {};
            setTimeout(() => { this._dbs.delete(name); if (req.onsuccess) req.onsuccess(); }, 0);
            return req;
        }
    }
    if (listable) IDBFactory.prototype.databases = async function () { return [...this._dbs].map((name) => ({ name, version: 1 })); };

    const localStorage = new Storage();
    localStorage.setItem('aac_settings', '{"apiKey":"sk-ant-test"}');
    localStorage.setItem('aac_worldview', '{}');
    const sessionStorage = new Storage();
    sessionStorage.setItem('anything', '1');
    const cacheKeys = new Set(['aac-shell-aac-v0.15.17-abc']);
    const regs = Array.from({ length: workers }, () => ({
        gone: false,
        async unregister() { this.gone = true; return true; },
    }));
    const opfs = dir('opfs');
    opfs.add('worldview.json', '{}');
    opfs.sub('conversations').add('2026-11-21T17-05-40.json', '{}');
    return {
        Storage, IDBFactory, localStorage, sessionStorage,
        indexedDB: new IDBFactory(),
        caches: { keys: async () => [...cacheKeys], delete: async (k) => cacheKeys.delete(k), _keys: cacheKeys },
        navigator: {
            serviceWorker: { getRegistrations: async () => regs.filter((r) => !r.gone) },
            storage: { getDirectory: async () => opfs },
        },
        _regs: regs, _opfs: opfs,
    };
}

const quick = { settleMs: 0, dbWaitMs: 50 };

/* ── Everything the browser keeps ───────────────────────────────────────────── */

test('deletes everything the browser keeps for the app', async () => {
    const env = makeEnv({ databases: ['aac-db', 'conversant-voice-audio', 'added-later'] });
    const r = await un.deleteEverything({ env, ...quick });
    assert.deepEqual(r, { folderFailed: [], left: [] });
    assert.equal(env.localStorage.length, 0, 'settings and keys');
    assert.equal(env.sessionStorage.length, 0);
    assert.deepEqual(await env.indexedDB.databases(), [], 'every database, including one nobody listed');
    assert.deepEqual(await env.caches.keys(), [], 'the offline copy');
    assert.ok(env._regs.every((reg) => reg.gone), 'the service worker');
    assert.deepEqual(env._opfs.names(), [], 'the private storage, where an iPad keeps everything');
    assert.deepEqual(await un.whatIsLeft(env), []);
});

test('the steps are reported in order, so the busy card can say what is happening', async () => {
    const steps = [];
    await un.deleteEverything({ env: makeEnv(), folder: dir('Data'), onStep: (s) => steps.push(s), ...quick });
    assert.deepEqual(steps, ['folder', 'browser', 'checking']);
});

test('where the browser cannot list its databases, the app’s own are still deleted', async () => {
    const env = makeEnv({ databases: ['aac-db', 'conversant-voice-audio', 'not-ours'], listable: false });
    await un.deleteEverything({ env, ...quick });
    assert.deepEqual([...env.indexedDB._dbs], ['not-ours']);
});

test('a database that will not delete is reported, not hidden', async () => {
    const env = makeEnv();
    const real = env.indexedDB.deleteDatabase.bind(env.indexedDB);
    // Held open somewhere, so the delete waits and never finishes.
    env.indexedDB.deleteDatabase = (name) => (name === 'conversant-voice-audio' ? {} : real(name));
    const r = await un.deleteEverything({ env, ...quick });
    assert.deepEqual(r.left, [{ what: 'database', name: 'conversant-voice-audio' }]);
    assert.equal(env.localStorage.length, 0, 'the rest still went');
});

test('nothing can be written once the delete has started', async () => {
    const env = makeEnv();
    await un.deleteEverything({ env, ...quick });
    env.localStorage.setItem('aac_settings', '{"put":"back"}');
    env.sessionStorage.setItem('x', 'y');
    assert.equal(env.localStorage.length, 0);
    assert.equal(env.sessionStorage.length, 0);
    assert.throws(() => env.indexedDB.open('conversant-voice-audio'));
    assert.deepEqual(await env.indexedDB.databases(), []);
});

test('something put back while the delete runs is caught by the second look', async () => {
    const env = makeEnv();
    const r = await un.deleteEverything({
        env, ...quick,
        // The service worker saving a fresh copy of a file just after the caches went.
        onStep: (s) => { if (s === 'checking') env.caches._keys.add('aac-shell-again'); },
    });
    assert.deepEqual(r.left, []);
    assert.deepEqual(await env.caches.keys(), []);
});

/* ── The data folder the user can see ───────────────────────────────────────── */

function userFolder() {
    const f = dir('Documents');
    for (const n of un.APP_FILES) f.add(n, '{}');
    f.add('metrics-2026-11.log');
    // The panel names one sound; the other files in "audio" are the user's own.
    f.add('express-panel.json', JSON.stringify({ items: [{ type: 'sound', audio: { file: 'snd-1-mhx2k3b0.mp3' } }] }));
    f.add('My taxes.xlsx').add('settings.json').add('notes.log');
    f.sub('conversations').add('2026-11-21T17-05-40.json').add('2026-11-21T17-05-40.review.json').add('2026-11-21T17-05-40-2.json');
    f.sub('backups').add('conversant-backup-2026-11-21-1705.json').add('conversant-before-import-2026-11-20-0900.json').add('taxes 2025.json');
    f.sub('settings').add('Ken - Laptop.json');
    f.sub('audio').add('snd-1-mhx2k3b0.mp3').add('song.mp3').add('Grandma singing.mp3');
    f.sub('sources')
        .add('index.json', JSON.stringify({ version: 1, documents: [{ id: 'd1', base: 'ATOB paper' }] }))
        .add('ATOB paper.txt').add('ATOB paper.pdf').add('My thesis.pdf');
    f.sub('Photos').add('beach.jpg');
    return f;
}

test('in a data folder the user can see, only what the app made is deleted', async () => {
    const f = userFolder();
    const failed = await un.deleteAppFilesFromFolder(f, { env: {} });
    assert.deepEqual(failed, []);
    // conversations and settings held only the app's files, so they went; the other
    // three held something of the user's, so they stay with only that in them.
    assert.deepEqual(f.names(), ['My taxes.xlsx', 'Photos', 'audio', 'backups', 'notes.log', 'settings.json', 'sources']);
    assert.deepEqual((await f.getDirectoryHandle('backups')).names(), ['taxes 2025.json']);
    assert.deepEqual((await f.getDirectoryHandle('audio')).names(), ['Grandma singing.mp3', 'song.mp3']);
    assert.deepEqual((await f.getDirectoryHandle('sources')).names(), ['My thesis.pdf']);
    assert.deepEqual((await f.getDirectoryHandle('Photos')).names(), ['beach.jpg']);
});

test('a folder that held only the app’s files is left empty', async () => {
    const f = dir('Conversant');
    for (const n of un.APP_FILES) f.add(n);
    f.sub('conversations').add('2026-11-21T17-05-40.json');
    f.sub('backups');
    await un.deleteAppFilesFromFolder(f, { env: {} });
    assert.deepEqual(f.names(), []);
});

test('the sounds the app keeps a copy of in the browser count too', async () => {
    const f = dir('Data');
    f.sub('audio').add('snd-2-mhx2k3c1.m4a').add('song.mp3');
    const env = { localStorage: { getItem: (k) => (k === 'aac_express_items' ? JSON.stringify({ always: [{ audio: { file: 'snd-2-mhx2k3c1.m4a' } }] }) : null) } };
    await un.deleteAppFilesFromFolder(f, { env });
    assert.deepEqual((await f.getDirectoryHandle('audio')).names(), ['song.mp3']);
});

test('a file that will not delete is reported, and the rest still go', async () => {
    const f = dir('Data').add('worldview.json').add('places.json');
    const real = f.removeEntry.bind(f);
    f.removeEntry = async (n, o) => { if (n === 'worldview.json') throw domError('NoModificationAllowedError'); return real(n, o); };
    assert.deepEqual(await un.deleteAppFilesFromFolder(f, { env: {} }), ['worldview.json']);
    assert.deepEqual(f.names(), ['worldview.json']);
});

test('the data folder is touched only when it is handed over', async () => {
    const env = makeEnv();
    const f = userFolder();
    const before = JSON.stringify(f.names());
    await un.deleteEverything({ env, ...quick });
    assert.equal(JSON.stringify(f.names()), before);
    await un.deleteEverything({ env: makeEnv(), folder: f, ...quick });
    assert.ok(!f.names().includes('worldview.json'));
});

/* ── Another copy of the app ────────────────────────────────────────────────── */

test('a copy waiting in another window is noticed', async () => {
    const env = (held, pending) => ({ navigator: { locks: { query: async () => ({ held, pending }) } } });
    assert.equal(await un.anotherCopyWaiting(env([{ name: LOCK_NAME }], [])), false, 'this copy alone');
    assert.equal(await un.anotherCopyWaiting(env([{ name: LOCK_NAME }], [{ name: LOCK_NAME }])), true);
    assert.equal(await un.anotherCopyWaiting(env([], [{ name: 'something-else' }])), false);
    assert.equal(await un.anotherCopyWaiting({ navigator: {} }), false, 'no locks: the app runs alone anyway');
});

/* ── The list of the app's files keeps up with the app ───────────────────────── */

const appDir = new URL('../app/js/', import.meta.url);
const source = (f) => readFileSync(new URL(f, appDir), 'utf8');

test('every file the app writes at the top of a data folder is one this deletes', () => {
    const written = new Set();
    for (const name of readdirSync(appDir).filter((f) => f.endsWith('.js'))) {
        const src = source(name);
        // A module's own data file, written through storage.writeFile.
        if (/\bwriteFile\(/.test(src)) {
            for (const m of src.matchAll(/const (?:[A-Z_]+_)?FILE = '([^']+)'/g)) written.add(m[1]);
        }
        // A name written directly.
        for (const m of src.matchAll(/(?:writeFile|dirHandle\.getFileHandle)\(\s*'([^']+)'/g)) written.add(m[1]);
    }
    // The nine files a backup carries.
    for (const m of source('data-transfer.js').matchAll(/\{\s*file:\s*'([^']+)'/g)) written.add(m[1]);
    assert.ok(written.size >= 11, `expected the app's files, found ${[...written].join(', ')}`);
    for (const name of written) assert.ok(un.isAppFile(name), `${name} is written to the data folder but would survive "Delete everything"`);
    // And the monthly usage log, whose name carries the month.
    assert.ok(/metrics-\$\{now\.toISOString\(\)\.slice\(0, 7\)\}\.log/.test(source('storage.js')));
    assert.ok(un.isAppFile('metrics-2026-11.log'));
});

test('the folders this deletes are the folders the app makes', () => {
    const st = source('storage.js');
    const names = Object.fromEntries([...st.matchAll(/const ([A-Z_]+_DIR) = '([^']+)'/g)].map((m) => [m[1], m[2]]));
    const listed = st.match(/const DATA_SUBFOLDERS = \[([^\]]+)\]/)[1].split(',').map((s) => names[s.trim()]);
    // Plus the documents folder's name before November 26 2026, which a device may still have.
    const old = st.match(/const OLD_SOURCES_DIR = '([^']+)'/)[1];
    assert.deepEqual([...listed, old].sort(), [...un.APP_FOLDERS].sort());
});

test('the app’s own databases close when asked, so a delete is not held up', () => {
    for (const f of ['storage.js', 'voice-store.js']) {
        assert.ok(/onversionchange\s*=\s*\(\)\s*=>\s*\{\s*try\s*\{\s*db\.close\(\)/.test(source(f)), `${f} closes its database when it is deleted`);
    }
    for (const m of source('voice-store.js').matchAll(/DB_NAME = '([^']+)'/g)) assert.equal(m[1], 'conversant-voice-audio');
});
