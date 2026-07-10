/* Tier 1 — local word prediction (app/js/prediction.js).
 * Prefix completion over the bundled dictionary + personalized learning, fully
 * offline. Dictionary is fetched from the real app/data/words.json.
 */
import { resetLocalStorage, mockFetchFromDisk } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as prediction from '../app/js/prediction.js';

beforeEach(async () => {
    resetLocalStorage();
    mockFetchFromDisk();
    await prediction.load();
});

test('predict completes a prefix from the dictionary, lowercase, up to the limit', () => {
    const out = prediction.predict('th', 3);
    assert.ok(out.length > 0 && out.length <= 3);
    assert.ok(out.every((w) => w.startsWith('th')), 'all start with the prefix');
    assert.ok(out.every((w) => w === w.toLowerCase()), 'lowercase');
    assert.ok(!out.includes('th'), 'the bare prefix itself is excluded');
});

test('an empty prefix yields nothing', () => {
    assert.deepEqual(prediction.predict('', 3), []);
});

test('learned words are boosted ahead of the dictionary', () => {
    // Teach a distinctive word many times; it should surface first for its prefix.
    for (let i = 0; i < 5; i++) prediction.learn('thunderbolt');
    const out = prediction.predict('thu', 3);
    assert.equal(out[0], 'thunderbolt', 'the personalized word ranks first');
});

test('learning ignores sub-2-char tokens and strips non-letters', () => {
    prediction.learn('a');            // too short — ignored
    prediction.learn('hi!!!');        // → "hi"
    const out = prediction.predict('h', 5);
    assert.ok(out.includes('hi'));
    assert.ok(!out.includes('a'));
});
