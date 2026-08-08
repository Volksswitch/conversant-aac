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
    // "Do not volunteer" is only followable if the model is told what DOES ask for it.
    // The rule used to end "only include them if the user selects a response that
    // does" — nothing that exists when the options are written (Ken, August 3 2026).
    assert.match(block, /partner has asked/i, 'the partner asking is a prompt');
    assert.match(block, /typed guidance/i, 'the user steering via Reframe is a prompt');
    assert.doesNotMatch(block, /selects a response that does/i, 'names a mechanism that does not exist');
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

// --- directive fields (August 7 2026) ----------------------------------------
// Some answers are instructions, not facts. "Topics I would rather not be asked
// about" listed as `- Topic to avoid: X` is only information, and leaves the model
// to infer what to do with it. That is too thin for what the persona audit called
// the single highest-value missing field.

test('a directive field becomes a RULE, not another listed fact', async () => {
    await wv.setField('topics_avoid', ['what happened to me']);
    const block = wv.buildBlock();
    assert.match(block, /Never raise any of it on your own initiative/);
    assert.doesNotMatch(block, /- [^\n]*Topic to avoid/i, 'must not also appear as a fact line');
});

test('the avoid rule is not an absolute ban — the user may still raise it themselves', async () => {
    await wv.setField('topics_avoid', ['my health']);
    const block = wv.buildBlock();
    // A card that refused to discuss the user's own life would be its own failure.
    assert.match(block, /If the user steers you to it themselves, follow them/);
    // And the partner may raise it regardless — the app controls only its own output.
    assert.match(block, /lets the user move the conversation on/);
});

test('a seek field is offered as INITIATIVE ground', async () => {
    await wv.setField('topics_welcome', ['films', 'music']);
    assert.match(wv.buildBlock(), /always enjoys talking about: films, music/);
});

test('directive fields alone still produce a block (they are not facts)', async () => {
    await wv.setField('topics_avoid', ['my health']);
    assert.notEqual(wv.buildBlock(), '', 'a profile of only directives must not come out empty');
});

// --- Tier B: personality + values (Phase 4) ---------------------------------

test('a trait answer at either end becomes a description, not a scale point', async () => {
    await wv.loadRegistry();
    await wv.setField('b1_extra_1', 'Very much like me');
    const block = wv.buildBlock();
    assert.match(block, /How this person describes themselves/);
    assert.match(block, /sociable, and comfortable around people/);
    assert.doesNotMatch(block, /Very much like me/,
        'the raw scale point must never reach the prompt');
});

test('the low end of the scale gives the low description', async () => {
    await wv.loadRegistry();
    await wv.setField('b1_extra_1', 'Not like me at all');
    assert.match(wv.buildBlock(), /happier with quiet and their own company/);
});

// Neutral producing nothing is what keeps a half-answered module cheap, and is
// the same rule the per-partner register follows.
test('the middle of the scale contributes nothing', async () => {
    await wv.loadRegistry();
    await wv.setField('b1_extra_1', 'Somewhat like me');
    assert.doesNotMatch(wv.buildBlock(), /How this person describes themselves/);
});

test('trait descriptions are aggregated into one statement, not one line each', async () => {
    await wv.loadRegistry();
    await wv.setField('b1_extra_1', 'Very much like me');
    await wv.setField('b1_consc_1', 'Very much like me');
    await wv.setField('b4_benev', 'Mostly like me');
    const block = wv.buildBlock();
    const hits = block.split('\n').filter((l) => /describes themselves/.test(l));
    assert.equal(hits.length, 1, 'exactly one aggregated line');
    assert.match(block, /sociable.*someone who likes a plan.*puts the people close to them first/s);
});

// A personality description is not something anyone says out loud about
// themselves, so this guard is stronger than the one on ordinary facts.
test('the trait block forbids stating or quoting it back', async () => {
    await wv.loadRegistry();
    await wv.setField('b4_power', 'Not like me at all');
    const block = wv.buildBlock();
    assert.match(block, /not a fact about their life and not a topic/i);
    assert.match(block, /never have them describe their own character/i);
});

// If the registry's option strings ever drift from the scale worldview.js
// recognises, EVERY trait answer silently becomes neutral and the whole module
// stops working with no error anywhere. Same class of failure as the settings-help
// drift guard.
test('every trait field uses the canonical Likert scale', async () => {
    const reg = await wv.loadRegistry();
    const CANON = ['Very much like me', 'Mostly like me', 'Somewhat like me', 'Not much like me', 'Not like me at all'];
    let checked = 0;
    for (const mod of reg.modules) {
        for (const f of mod.fields) {
            if (!f.trait) continue;
            checked++;
            assert.deepEqual(f.options, CANON, `${f.key} has drifted from the canonical scale`);
            assert.ok(f.trait.high && f.trait.low, `${f.key} needs both a high and a low description`);
        }
    }
    assert.ok(checked >= 20, `expected the Tier B bank, found ${checked} trait fields`);
});

// The descriptions are joined into "How this person describes themselves: A; B."
// so a capitalised or full-stopped clause would read wrongly mid-sentence.
test('trait descriptions are fragments that survive being joined', async () => {
    const reg = await wv.loadRegistry();
    for (const mod of reg.modules) {
        for (const f of mod.fields) {
            if (!f.trait) continue;
            for (const end of ['high', 'low']) {
                assert.doesNotMatch(f.trait[end], /^[A-Z]/, `${f.key}.${end} should not be capitalised`);
                assert.doesNotMatch(f.trait[end], /\.$/, `${f.key}.${end} should not end with a full stop`);
            }
        }
    }
});
