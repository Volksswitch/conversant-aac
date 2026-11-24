/* Tier 2 — a browser database that never answers must not stop the app starting.
 *
 * WHY THIS EXISTS (Ken, November 24 2026). The installed app on his PC sat on the Start
 * screen with Start AND the launch-screen report link both doing nothing, and nothing
 * on screen. Both read the remembered data folder out of the browser's database before
 * showing anything, and that database had no time limit: a request that never fires
 * success or error left them waiting for good. The same shape as the false storage
 * timeout and the dropped CSS rule - the screen looks fine and nothing reports it.
 *
 * This drives the real storage.js on the folder-picker path (Windows, Android) with an
 * indexedDB whose open request never answers, and checks every look-up Start and the
 * report make now gives up instead of waiting forever.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
// WITH showDirectoryPicker: the folder path is the one that reads the database.
globalThis.window = { dispatchEvent() { return true; }, showDirectoryPicker: async () => { throw new Error('not in a test'); } };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });

let opens = 0;
globalThis.indexedDB = {
    // A request whose handlers are attached and never called: no success, no error,
    // no blocked. That is what "stuck" looks like from inside the page.
    open() { opens++; return {}; },
};

const storage = await import('../app/js/storage.js');

// Measured against the limit in storage.js (4 s) with room to spare, not against a
// guess: a value close to it would make the test flaky on a slow machine.
const WITHIN_MS = 6500;

async function settlesWithin(promise, ms) {
    let t;
    const limit = new Promise((resolve) => { t = setTimeout(() => resolve('HUNG'), ms); });
    try { return await Promise.race([promise.then((v) => ({ v }), (e) => ({ e })), limit]); }
    finally { clearTimeout(t); }
}

test('Start\'s folder reconnect gives up on a database that never answers', async () => {
    const r = await settlesWithin(storage.restoreDataFolder(), WITHIN_MS);
    assert.notEqual(r, 'HUNG', 'restoreDataFolder waited forever on the database');
    assert.equal(r.v, false, 'with no answer, the app carries on as if no folder was remembered');
    assert.equal(storage.hasDataFolder(), false);
});

test('the start-up checks that follow it give up too', async () => {
    const remembered = await settlesWithin(storage.hasRememberedFolder(), WITHIN_MS);
    assert.notEqual(remembered, 'HUNG', 'hasRememberedFolder waited forever');
    assert.equal(remembered.v, false);
    const readable = await settlesWithin(storage.folderReadableWithoutPrompt(), WITHIN_MS);
    assert.notEqual(readable, 'HUNG', 'the launch-screen report would wait forever here');
    assert.equal(readable.v, false);
});

test('a timed-out open is retried, not reused', () => {
    // Each look-up above had to open the database again; reusing the stuck request
    // would make every later look-up wait out the whole limit for nothing.
    assert.ok(opens >= 2, `the database was opened ${opens} time(s)`);
});

test('the reconnect trace says the database is what failed', () => {
    assert.match(storage.folderReconnectTrace(), /idb-timeout/);
});
