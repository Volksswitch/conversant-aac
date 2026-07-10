/* Tier 1 — worldview profile block + privacy model (app/js/worldview.js).
 *
 * The load-bearing behavior is the three-level privacy model that governs what
 * reaches the LLM (Ken, June 19 2026): Shareable (value sent, freely usable),
 * Private (value sent, "don't volunteer"), Declined (NO value, phrase-around only).
 * Registry is fetched from the real app/data/worldview-questions.json off disk.
 */
import { resetLocalStorage, mockFetchFromDisk } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as wv from '../app/js/worldview.js';

let shareableKey;   // a field whose default privacy is not 'private'

beforeEach(async () => {
    resetLocalStorage();
    mockFetchFromDisk();
    await wv.loadRegistry();
    await wv.load();          // fresh empty profile from the (cleared) cache
    // Find a field the registry defaults to shareable.
    shareableKey = null;
    for (const mod of wv.getRegistry().modules) {
        for (const f of mod.fields) {
            if ((f.defaultPrivacy || 'shareable') !== 'private') { shareableKey = f.key; break; }
        }
        if (shareableKey) break;
    }
    assert.ok(shareableKey, 'the registry has at least one shareable field');
});

test('an empty profile injects no profile block', () => {
    assert.equal(wv.buildBlock(), '');
});

test('SHAREABLE: an answered field is listed as a usable fact', async () => {
    await wv.setField(shareableKey, 'ZEBRAVALUE');
    const block = wv.buildBlock();
    assert.match(block, /What you know about them/);
    assert.match(block, /ZEBRAVALUE/);
    assert.doesNotMatch(block, /do not volunteer/i);
});

test('PRIVATE: the value IS sent but flagged do-not-volunteer', async () => {
    await wv.setField(shareableKey, 'ZEBRAVALUE');
    await wv.setPrivacy(shareableKey, 'private');
    const block = wv.buildBlock();
    assert.match(block, /ZEBRAVALUE/, 'private value is still sent for context');
    assert.match(block, /do not volunteer them spontaneously/i);
});

test('DECLINED: no value is sent, only a phrase-around instruction', async () => {
    await wv.setField(shareableKey, 'ZEBRAVALUE');
    await wv.declineField(shareableKey);
    const block = wv.buildBlock();
    assert.doesNotMatch(block, /ZEBRAVALUE/, 'declined value must NOT reach the model');
    assert.match(block, /chose not to share/i);
});

test('decline is reversible without data loss (value withheld while declined, restored on undo)', async () => {
    await wv.setField(shareableKey, 'ZEBRAVALUE');
    await wv.declineField(shareableKey);
    assert.equal(wv.getField(shareableKey), null, 'getField withholds a declined value');
    assert.ok(wv.hasStashedAnswer(shareableKey), 'the prior answer is stashed');
    await wv.undeclineField(shareableKey);
    assert.equal(wv.getField(shareableKey), 'ZEBRAVALUE', 'undo brings the answer back');
});

test('gaps: recordGaps logs only genuine open gaps; answering clears them', async () => {
    await wv.clearGaps();
    await wv.recordGaps(['fav_food', shareableKey], 'what do you like to eat?');
    // The already-answerable key should not be logged as a gap once answered.
    await wv.setField(shareableKey, 'pizza');
    await wv.recordGaps([shareableKey], 'x');
    const gaps = wv.listGaps().map((g) => g.key);
    assert.ok(gaps.includes('fav_food'), 'the real gap is recorded');
    assert.ok(!gaps.includes(shareableKey), 'an answered field is not an open gap');
});
