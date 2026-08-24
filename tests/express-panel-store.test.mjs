/* ONE CHECK THAT CROSSES EVERY LAYER (the standing rule, Ken, August 23 2026).
 *
 * The band work touches four layers — the stored file, the model that reads it, the
 * arithmetic that lays it out, and the renderer that draws it. Each of the pure tests
 * in express-bands.test.mjs FABRICATES the model it is handed, which is exactly the
 * pattern that let the number button ship in 0.7.14 announced and doing nothing. So
 * this one starts at real bytes on real storage and ends at the composed panel,
 * taking each layer's output as the next one's input.
 *
 * The renderer is the one link this cannot reach — it needs a DOM — so it is covered
 * in the browser instead, and named here so the gap is visible rather than implied.
 *
 * Uses the same trick as storage-transcript.test.mjs: with no directory picker
 * present, storage.js adopts the browser's own private filesystem, which needs no
 * user gesture. See that file's header for why the folder was never the obstacle.
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
                async getFile() { return { size: rec.data.length, text: async () => rec.data }; },
                async createWritable({ keepExistingData = false } = {}) {
                    let buf = keepExistingData ? rec.data : '';
                    let pos = buf.length;
                    return {
                        async write(chunk) { buf = buf.slice(0, pos) + chunk; pos = buf.length; },
                        async seek(p) { pos = p; },
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
        _files: files,
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
const panel = await import('../app/js/express-panel.js');
const bands = await import('../app/js/express-bands.js');
const items = await import('../app/js/express-items.js');

await storage.restoreDataFolder();

const GRID = [Array(4).fill('x'), Array(4).fill('x'), Array(4).fill('x')];  // 12 positions

async function writePanelFile(obj) {
    await storage.writeFile('express-panel.json', JSON.stringify(obj));
}
/** Let the background disk write finish. */
const settle = () => new Promise((r) => setTimeout(r, 0));

async function readPanelFile() {
    return JSON.parse(await storage.readFile('express-panel.json'));
}

test('a version-1 panel on disk is replaced once by the shipped set', async () => {
    // Exactly what a tester upgrading from 0.7.x has: the old flat list.
    await writePanelFile({ version: 1, items: [{ type: 'phrase', text: 'my old phrase' }] });
    store.clear();                       // no cache to fall back on

    const loaded = await panel.load();
    assert.equal(loaded.version, 2);
    assert.equal(loaded.always.length, items.ALWAYS_DEFAULTS.length,
        'the shipped Always set, not the old list');
    assert.equal(loaded.context.length, items.CONTEXT_DEFAULTS.length);
    assert.ok(!JSON.stringify(loaded).includes('my old phrase'),
        'the version-1 content is discarded, which is the announced behavior');
});

test('the whole chain runs: bytes on disk to the cells of the panel', async () => {
    // A model written the way the editor writes one, with a phrase in a situational
    // list and more Always phrases than its band can hold.
    await writePanelFile({
        version: 2,
        sizes: { shape: 'counts', context: 4, flex: 4 },
        always: [
            { id: 'w1', type: 'phrase', text: 'Yes' },
            { id: 'w2', type: 'phrase', text: 'No' },
            { id: 'w3', type: 'phrase', text: 'Help' },
            { id: 'w4', type: 'phrase', text: 'Wait' },
            { id: 'w5', type: 'phrase', text: 'Surplus one' },
            { id: 'w6', type: 'phrase', text: 'Surplus two' },
        ],
        context: [
            { id: 'c1', type: 'feeling', text: 'Tired' },
            { id: 'c2', type: 'partner', name: 'Mom' },
        ],
        flex: { 'mom|anyplace': [{ id: 'f1', type: 'phrase', text: 'How is your shoulder?' }] },
    });
    store.clear();

    // Layer 1 -> 2: the file becomes the model.
    const model = await panel.load();
    // Layer 2 -> 3: the model becomes a laid-out panel.
    const composed = bands.composePanel(GRID, panel.getModel(), { partnerId: 'mom' });

    assert.deepEqual(composed.counts, { always: 4, context: 4, flex: 4 });

    const text = composed.items.map((x) => (x ? (x.text || x.name) : null));
    assert.deepEqual(text.slice(0, 4), ['Yes', 'No', 'Help', 'Wait'],
        'the Always band, in the order it was written');
    assert.deepEqual(text.slice(4, 8), ['Mom', 'Tired', null, null],
        'the Context band, sorted into partners then feelings, with the floor reserved');
    assert.deepEqual(text.slice(8), ['How is your shoulder?', 'Surplus one', 'Surplus two', null],
        'the partner phrase first; the Always surplus behind it, never in front');

    // And the model really came from the file rather than from a default.
    assert.equal(model.flex['mom|anyplace'][0].text, 'How is your shoulder?');
});

test('an edit is written back as version 2 and survives a reload', async () => {
    const m = panel.getModel();
    m.always.push({ id: 'new', type: 'phrase', text: 'Something I wrote', speak: 'Suhm-thing' });
    panel.setModel(m);
    // The disk write is deliberately fire-and-forget so the UI never blocks on it
    // (see express-panel.js writeDisk), so give it a turn before reading it back.
    await settle();

    const onDisk = await readPanelFile();
    assert.equal(onDisk.version, 2);
    const written = onDisk.always.find((x) => x.text === 'Something I wrote');
    assert.ok(written, 'the phrase reached the file');
    assert.equal(written.speak, 'Suhm-thing', 'and so did how it should be said');
    assert.equal(written.origin, 'added', 'stamped as the user\'s own, not ours');

    store.clear();
    const again = await panel.load();
    assert.ok(again.always.some((x) => x.text === 'Something I wrote'));
});

test('resetting the Always band restores the shipped set and nothing else', () => {
    const before = panel.getModel();
    before.context.push({ id: 'mine', type: 'feeling', text: 'Restless' });
    panel.setModel(before);

    panel.resetBand('always');
    const after = panel.getModel();
    assert.equal(after.always.length, items.ALWAYS_DEFAULTS.length);
    assert.ok(!after.always.some((x) => x.text === 'Something I wrote'),
        'a reset is not an undo - the phrase the user wrote is gone, as the warning says');
    assert.ok(after.context.some((x) => x.text === 'Restless'),
        'and the other bands are untouched');
});

test('deleting a situation removes only that list', () => {
    const m = panel.getModel();
    m.flex['mom|anyplace'] = [{ id: 'x1', type: 'phrase', text: 'keep me' }];
    m.flex['anyone|anyplace'] = [{ id: 'x2', type: 'phrase', text: 'general' }];
    panel.setModel(m);

    panel.removeFlexList('mom|anyplace');
    const after = panel.getModel();
    assert.deepEqual(Object.keys(after.flex), ['anyone|anyplace']);
});
