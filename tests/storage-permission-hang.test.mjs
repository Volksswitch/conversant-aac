/* Tier 2 — a remembered folder the browser never answers about must not stop Start.
 *
 * WHY THIS EXISTS (Ken, November 24 2026). After Chrome updated itself to version 158,
 * the installed app on his PC sat on the Start screen with Start and the launch-screen
 * report link both dead. Measured in his own Chrome: queryPermission and
 * requestPermission on the remembered folder never settled - no answer, no error, no
 * permission box - while the folder opened instantly in Windows. Start waited on that
 * answer with no limit, and the report link asked the same question first.
 *
 * This drives the real storage.js on the folder-picker path with a stored handle that
 * behaves exactly like that, and checks that Start's steps and the report's give up.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
globalThis.window = { dispatchEvent() { return true; }, showDirectoryPicker: async () => { throw new Error('not in a test'); } };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });

// The stored folder: every permission question hangs, as in Chrome 158 on Ken's PC.
const never = () => new Promise(() => {});
const stuckHandle = {
    kind: 'directory', name: 'my AI-driven AAC app',
    queryPermission: never,
    requestPermission: never,
};

// Just enough IndexedDB to hand that folder back, answering at once.
function later(fn) { setTimeout(fn, 0); }
globalThis.indexedDB = {
    open() {
        const req = {};
        const db = {
            transaction() {
                return {
                    objectStore() {
                        return {
                            get(key) {
                                const r = {};
                                later(() => { r.result = key === 'dataFolder' ? stuckHandle : undefined; r.onsuccess && r.onsuccess(); });
                                return r;
                            },
                        };
                    },
                };
            },
        };
        later(() => { req.result = db; req.onsuccess && req.onsuccess(); });
        return req;
    },
};

const storage = await import('../app/js/storage.js');

// The limit in storage.js is 3 s; this leaves room on a slow machine.
const WITHIN_MS = 5500;
async function settlesWithin(promise, ms) {
    let t;
    const limit = new Promise((resolve) => { t = setTimeout(() => resolve('HUNG'), ms); });
    try { return await Promise.race([promise.then((v) => ({ v }), (e) => ({ e })), limit]); }
    finally { clearTimeout(t); }
}

test('Start\'s tap request plus the reconnect: neither waits forever', async () => {
    // The folder is looked up at page load, long before anyone can tap Start.
    await new Promise((r) => setTimeout(r, 50));
    // What handleStart does: ask from the tap (never awaited), then reconnect.
    storage.requestFolderPermissionNow();
    assert.equal(storage.isAwaitingPermission(), true, 'while the question is fresh, Start may wait for it');
    const r = await settlesWithin(storage.restoreDataFolder(), WITHIN_MS);
    assert.notEqual(r, 'HUNG', 'restoreDataFolder waited forever on the permission question');
    assert.equal(r.v, false, 'the folder is treated as not available this session');
    assert.equal(storage.hasDataFolder(), false);
    // This is what had held Start's deadline open forever.
    assert.equal(storage.isAwaitingPermission(), false, 'Start must stop waiting once the browser has not answered');
});

test('the folder is still remembered, so the reconnect card can offer a way out', async () => {
    const r = await settlesWithin(storage.hasRememberedFolder(), WITHIN_MS);
    assert.notEqual(r, 'HUNG');
    assert.equal(r.v, true, 'the handle is kept - forgetting is a one-way loss');
});

test('the launch-screen report link does not wait forever', async () => {
    const r = await settlesWithin(storage.folderReadableWithoutPrompt(), WITHIN_MS);
    assert.notEqual(r, 'HUNG', 'the report link would look dead');
    assert.equal(r.v, false, 'the report goes out without the folder');
});

test('the switch-access warning check does not wait forever', async () => {
    const r = await settlesWithin(storage.folderWillAsk(), WITHIN_MS);
    assert.notEqual(r, 'HUNG');
    assert.equal(r.v, false);
});

test('a problem report can say what happened', () => {
    assert.match(storage.folderReconnectTrace(), /query-no-answer/);
});
