/* Source material for question sessions (app/js/source-material.js), through the REAL
 * storage layer writing to a directory that behaves like the browser's private
 * filesystem (the same arrangement as storage-transcript.test.mjs). Asserts what lands
 * on disk, not only what the functions return.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

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
                async getFile() { return { size: rec.data.length, text: async () => rec.data, _data: rec.data }; },
                async createWritable() {
                    let buf = '';
                    return {
                        async write(chunk) { buf += typeof chunk === 'string' ? chunk : (chunk && typeof chunk._data === 'string' ? chunk._data : `<blob ${chunk.size}>`); },
                        async close() { rec.data = buf; },
                    };
                },
            };
        },
        async removeEntry(n) { files.delete(n); dirs.delete(n); },
        async *entries() {
            for (const [k] of files) yield [k, { kind: 'file', name: k }];
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
const src = await import('../app/js/source-material.js');

const files = async () => {
    const dir = await root.getDirectoryHandle('documents');
    return [...dir._files.keys()].sort();
};
const fileText = async (name) => (await root.getDirectoryHandle('documents'))._files.get(name)?.data;

test('without a data folder, adding a document says why it cannot', async () => {
    await assert.rejects(src.addSource({ title: 'Paper', text: 'Words.' }), /Choose a data folder first/);
});

test('the sources folder is made when the data folder connects', async () => {
    assert.equal(await storage.restoreDataFolder(), true);
    assert.ok(root._dirs.has('documents'));
});

let paperId;
test('adding a PDF keeps its text and the original, named after the title', async () => {
    const e = await src.addSource({ title: 'ATOB article: 2024!', text: 'Line one.  \r\n\r\n\r\n\r\nLine two.',
        original: { blob: { size: 1234 }, ext: 'pdf' } });
    paperId = e.id;
    assert.equal(e.base, 'ATOB article 2024');
    assert.equal(e.kind, 'pdf');
    assert.equal(e.words, 4);
    assert.deepEqual(await files(), ['ATOB article 2024.pdf', 'ATOB article 2024.txt', 'index.json']);
    assert.equal(await fileText('ATOB article 2024.txt'), 'Line one.\n\nLine two.');
});

test('two documents with the same title get different files', async () => {
    const e = await src.addSource({ title: 'ATOB article 2024', text: 'Pasted copy.' });
    assert.equal(e.base, 'ATOB article 2024 (2)');
    assert.equal(e.kind, 'paste');
    assert.equal((await src.listSources()).length, 2);
    await src.removeSource(e.id);
});

test('a document too long is refused rather than cut', async () => {
    const long = 'word '.repeat(src.MAX_SOURCE_CHARS / 4);
    await assert.rejects(src.addSource({ title: 'Huge', text: long }), /too long/);
    await assert.rejects(src.addSource({ title: 'Empty', text: '   ' }), /no text/);
    assert.equal((await src.listSources()).length, 1);
});

test('replacing keeps the id, so everything pointing at it gets the new version', async () => {
    const e = await src.replaceSource(paperId, { text: 'The newer version.' });
    assert.equal(e.id, paperId);
    const [doc] = await src.readSources([paperId]);
    assert.equal(doc.text, 'The newer version.');
    assert.equal(doc.name, 'ATOB article: 2024!');
    // Pasted text replaced the PDF, so the PDF that no longer matches is gone.
    assert.deepEqual(await files(), ['ATOB article 2024.txt', 'index.json']);
});

test('reading skips a document that is no longer there', async () => {
    const docs = await src.readSources(['src-gone', paperId]);
    assert.deepEqual(docs.map((d) => d.id), [paperId]);
});

test('adds made at the same moment do not lose each other', async () => {
    const [a, b] = await Promise.all([
        src.addSource({ title: 'Overview', text: 'One.' }),
        src.addSource({ title: 'Slides', text: 'Two.' }),
    ]);
    const ids = (await src.listSources()).map((e) => e.id);
    assert.ok(ids.includes(a.id) && ids.includes(b.id));
});

test('a backup carries the index and the text, not the originals, and restores them', async () => {
    await src.addSource({ title: 'With PDF', text: 'Pdf text.', original: { blob: { size: 9 }, ext: 'pdf' } });
    const pkg = await src.exportSources();
    assert.ok(pkg.index.length >= 4);
    assert.ok(pkg.texts.every((t) => !/blob/.test(t.text)));
    // Restore onto an empty folder: every document comes back under its own id.
    for (const e of await src.listSources()) await src.removeSource(e.id);
    assert.deepEqual(await files(), ['index.json']);
    const n = await src.importSources(pkg);
    assert.equal(n, pkg.index.length);
    const after = await src.listSources();
    assert.deepEqual(after.map((e) => e.id).sort(), pkg.index.map((e) => e.id).sort());
    assert.ok(after.every((e) => e.original === null), 'no PDF came with the backup');
});

test('a restore refuses a file name the app could not have written', async () => {
    const before = (await src.listSources()).length;
    const n = await src.importSources({
        index: [{ id: 'src-evil', title: 'x', base: '../../settings/evil' }],
        texts: [{ id: 'src-evil', text: 'nope' }],
    });
    assert.equal(n, 0);
    assert.equal((await src.listSources()).length, before);
    assert.equal(src.isSafeBase('Fine name (2)'), true);
    assert.equal(src.isSafeBase('../x'), false);
});

// November 26 2026. The folder was renamed "sources" -> "documents". An older folder's
// files are copied across, checked, then deleted; a file already in "documents" is never
// overwritten, and the two lists of documents are merged.
test('an older "sources" folder is moved into "documents", losing nothing', async () => {
    for (const e of await src.listSources()) await src.removeSource(e.id);
    const docs = await root.getDirectoryHandle('documents');
    const write = async (dir, name, text) => {
        const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await w.write(text); await w.close();
    };
    // Another device, already updated, added "Paper B" to the new folder.
    await write(docs, 'Paper B.txt', 'B from the new folder');
    await write(docs, 'index.json', JSON.stringify({ version: 1, documents: [{ id: 'b', title: 'Paper B', base: 'Paper B' }] }));
    // This device's old folder holds "Paper A", and an older copy of "Paper B".
    const old = await root.getDirectoryHandle('sources', { create: true });
    await write(old, 'Paper A.txt', 'A from the old folder');
    await write(old, 'Paper B.txt', 'B from the old folder');
    await write(old, 'index.json', JSON.stringify({ version: 1, documents: [
        { id: 'a', title: 'Paper A', base: 'Paper A' }, { id: 'b', title: 'Paper B', base: 'Paper B' }] }));

    const r = await storage.moveOldDocumentsFolder();
    assert.equal(await fileText('Paper A.txt'), 'A from the old folder');
    assert.equal(await fileText('Paper B.txt'), 'B from the new folder', 'never overwritten');
    assert.deepEqual((await src.listSources()).map((e) => e.id).sort(), ['a', 'b']);
    assert.equal(r.kept, 1, 'the older Paper B is left where it was');
    assert.ok(root._dirs.has('sources'), 'the old folder stays while it still holds a file');
    assert.deepEqual([...old._files.keys()], ['Paper B.txt']);

    old._files.delete('Paper B.txt');
    await storage.moveOldDocumentsFolder();
    assert.ok(!root._dirs.has('sources'), 'an empty old folder is removed');
});
