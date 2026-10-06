/* CR-302. The small database that remembers the data folder is opened once and shared,
 * not once per look-up (every open connection stayed open for the life of the page). */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
// A folder picker is present, so the folder path - the one that uses the database - is taken.
globalThis.window = { dispatchEvent() { return true; }, showDirectoryPicker() {} };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });

let opens = 0;
globalThis.indexedDB = {
    open() {
        opens++;
        const req = {};
        setTimeout(() => {
            req.result = {
                transaction() {
                    return {
                        objectStore() {
                            return {
                                get() {
                                    const r = {};
                                    setTimeout(() => { r.result = undefined; r.onsuccess && r.onsuccess(); }, 0);
                                    return r;
                                },
                            };
                        },
                    };
                },
            };
            req.onsuccess && req.onsuccess();
        }, 0);
        return req;
    },
};

const storage = await import('../app/js/storage.js');

test('the folder look-up database is opened once and shared', async () => {
    await storage.hasRememberedFolder();
    await storage.hasRememberedFolder();
    await storage.hasRememberedFolder();
    assert.equal(opens, 1);
});
