/* Tier 2 — can the app actually save? (Ken, November 23 2026)
 *
 * An iPad mini on iPadOS 18.4 offered the browser's private storage but could not
 * write into a file. Every save left an EMPTY file, the next launch reported nine of
 * them as damaged and turned the conversation pane red, and Settings said "Your data
 * is safe on this device". These tests drive the real storage layer against a
 * stand-in for that storage, in both versions: one that can write and one that cannot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

function makeDir({ canWrite = true } = {}) {
    const files = new Map();
    const dirs = new Map();
    return {
        kind: 'directory', name: '',
        async getDirectoryHandle(n, opts = {}) {
            if (!dirs.has(n)) {
                if (!opts.create) throw new Error('NotFoundError');
                dirs.set(n, makeDir({ canWrite }));
            }
            return dirs.get(n);
        },
        async getFileHandle(n, opts = {}) {
            if (!files.has(n)) {
                if (!opts.create) throw new Error('NotFoundError');
                files.set(n, { data: '' });
            }
            const rec = files.get(n);
            const fh = { kind: 'file', name: n, async getFile() { return { text: async () => rec.data }; } };
            // iPadOS 18.4 Safari: the handle exists, the way of writing into it does not.
            if (canWrite) {
                fh.createWritable = async () => {
                    let buf = '';
                    return { async write(c) { buf += c; }, async close() { rec.data = buf; } };
                };
            }
            return fh;
        },
        async removeEntry(n) { files.delete(n); dirs.delete(n); },
        _files: files, _dirs: dirs,
    };
}

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
globalThis.window = { dispatchEvent() { return true; } };   // no folder picker: the iPad path
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
globalThis.indexedDB = undefined;

let caseId = 0;
async function loadWith(root) {
    Object.defineProperty(globalThis, 'navigator', {
        value: { storage: { getDirectory: async () => root } },
        configurable: true, writable: true,
    });
    return import(`../app/js/storage.js?case=${++caseId}`);
}

test('storage that cannot be written is not used, and leaves no empty files', async () => {
    const root = makeDir({ canWrite: false });
    const storage = await loadWith(root);
    assert.equal(await storage.restoreDataFolder(), false);
    assert.equal(storage.hasDataFolder(), false, 'no root, so nothing tries to save into it');
    const check = storage.lastSaveCheck();
    assert.equal(check.ok, false);
    assert.equal(check.reason, 'browser-cannot-write');
    assert.equal(root._files.size, 0, 'the check file is removed, and nothing else was made');
    assert.equal(root._dirs.size, 0, 'no data subfolders were made either');
    // A later save goes nowhere rather than leaving an empty file.
    await storage.writeFile('worldview.json', '{}');
    assert.equal(root._files.size, 0);
});

test('storage that can be written passes the check and keeps no test file', async () => {
    const root = makeDir({ canWrite: true });
    const storage = await loadWith(root);
    assert.equal(await storage.restoreDataFolder(), true);
    assert.equal(storage.lastSaveCheck().ok, true);
    assert.equal(root._files.has('.conversant-save-check'), false);
    await storage.writeFile('worldview.json', '{"a":1}');
    const text = await (await (await root.getFileHandle('worldview.json')).getFile()).text();
    assert.equal(text, '{"a":1}');
});

test('a write that fails is reported, with what went wrong', async () => {
    const root = makeDir({ canWrite: true });
    const storage = await loadWith(root);
    await storage.restoreDataFolder();
    const real = root.getFileHandle.bind(root);
    root.getFileHandle = async (n, o) => {
        const fh = await real(n, o);
        return { ...fh, createWritable: async () => { const e = new Error('The disk is full'); e.name = 'QuotaExceededError'; throw e; } };
    };
    const check = await storage.checkCanSave();
    assert.equal(check.ok, false);
    assert.equal(check.reason, 'write-failed');
    assert.match(check.detail, /QuotaExceededError: The disk is full/);
});
