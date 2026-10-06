/* A full browser store (CR-094). saveSettings runs inside the AI reply, the paid voice,
 * the listening audio and every Settings change; a quota error thrown from it used to
 * discard a reply that had already arrived. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
let full = false;
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
        if (full) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
        store.set(k, String(v));
    },
    removeItem: (k) => store.delete(k),
};
globalThis.window = { dispatchEvent() { return true; } };
const storage = await import('../app/js/storage.js');

test('counters and the install id survive a full store', () => {
    full = true;
    const err = console.error; console.error = () => {};
    try {
        assert.doesNotThrow(() => storage.addUsageTokens({ input: 5, output: 1 }));
        assert.doesNotThrow(() => storage.addSttSeconds(1));
        assert.doesNotThrow(() => storage.addTtsCharacters(10));
        const id = storage.loadInstallId();
        assert.ok(id && typeof id === 'string');
    } finally { console.error = err; full = false; }
});

test('a throwing usage callback does not cost the reply', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../app/js/llm.js', import.meta.url), 'utf8');
    assert.match(src, /try \{ onUsageUpdate\(usage\); \} catch/);
});
