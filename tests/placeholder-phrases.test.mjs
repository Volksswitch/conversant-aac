/* Tier 1 — the user-owned placeholder pools (app/js/placeholder-phrases.js), and the
 * one path that crosses from the editor's storage to the words actually spoken.
 *
 * THE LAST TEST IS THE POINT OF THE FILE. Everything above it exercises one layer at
 * a time — the model on its own, the ladder on its own — and three of those passing
 * would still leave the feature dead if the model and the ladder disagreed about
 * where the phrases live. The end-to-end case saves through the model exactly as the
 * editor does and then listens to what comes out of the speaker.
 */
import { resetLocalStorage, resetSpoken, spokenTexts } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../app/js/placeholder-phrases.js';
import * as placeholders from '../app/js/placeholders.js';
import * as storage from '../app/js/storage.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
    placeholders.stop();
    placeholders.setUserSpeakingGate(() => false);
    resetLocalStorage();
    resetSpoken();
});

test('an untouched profile gets the default pools', () => {
    const p = model.getPools();
    assert.deepEqual(p.acknowledgment, model.DEFAULTS.acknowledgment);
    assert.deepEqual(p.thinking, model.DEFAULTS.thinking);
});

test('an edit persists and comes back', () => {
    model.setPools({ acknowledgment: ['Let me see what I think.'], thinking: ['Still on it.'] });
    assert.deepEqual(model.getPools().acknowledgment, ['Let me see what I think.']);
    assert.deepEqual(model.getPools().thinking, ['Still on it.']);
});

// The editor needs a blank row to type into, so the model must keep one. Dropping it
// is placeholders.js's job, at the moment of speaking — see the last test.
test('a blank row survives being saved', () => {
    model.setPools({ acknowledgment: ['One thing.', ''], thinking: ['Still on it.'] });
    assert.deepEqual(model.getPools().acknowledgment, ['One thing.', '']);
});

// The additive-merge rule: a release that adds a default shows it to existing users,
// and never resurrects one they deleted.
test('a phrase the user deleted does not come back on the next load', async () => {
    await model.load();                                   // watermarks the shipped set
    const kept = model.getPools().acknowledgment.slice(1);
    model.setPools({ acknowledgment: kept, thinking: model.getPools().thinking });
    await model.load();
    assert.deepEqual(model.getPools().acknowledgment, kept, 'the deleted default stays deleted');
});

test('a default the user has never been offered is appended', async () => {
    // A stored set that predates one of the shipped defaults: it is absent from both
    // the list and the watermark, which is exactly what "new in this release" looks like.
    const seeded = model.DEFAULTS.acknowledgment.slice(0, 2);
    localStorage.setItem('aac_placeholders', JSON.stringify({
        acknowledgment: seeded,
        thinking: model.DEFAULTS.thinking,
        seeded: { acknowledgment: seeded, thinking: model.DEFAULTS.thinking },
    }));
    await model.load();
    const after = model.getPools().acknowledgment;
    assert.deepEqual(after.slice(0, 2), seeded, 'their own list is left where it was');
    assert.deepEqual(after, model.DEFAULTS.acknowledgment, 'the new ones are appended at the end');
});

// The shape the bundled data/placeholders.json had between July 8 and August 7 2026.
// Only `general` survives: those were the phrases that read correctly after any kind
// of turn, and taking the question-flavored ones would put "Good question." back on a
// turn that was not one.
test('the legacy question/general shape keeps only the general phrases', () => {
    localStorage.setItem('aac_placeholders', JSON.stringify({
        acknowledgment: { question: ['Good question.'], general: ['One moment.'] },
        thinking: ['Still on it.'],
    }));
    // getPools() reads the cache when the model has not been loaded.
    const fresh = JSON.parse(localStorage.getItem('aac_placeholders'));
    assert.ok(fresh.acknowledgment.question, 'fixture really is the legacy shape');
    model.setPools(fresh);
    assert.deepEqual(model.getPools().acknowledgment, ['One moment.']);
});

// ⚠ THE CROSS-LAYER CHECK. Saves through the model the way the editor does, then lets
// the real ladder run and asserts the user's own words are what gets said. Without
// this, a model that stored perfectly and a ladder that spoke perfectly could still be
// reading two different places and nothing would fail.
test('a phrase saved in the editor is what the ladder speaks', async () => {
    model.setPools({ acknowledgment: ['Right, let me work that out.'], thinking: ['Nearly there.'] });
    storage.savePlaceholderSettings(0.02, 0.02, 2);
    placeholders.arm();
    await sleep(220);
    assert.deepEqual(spokenTexts, ['Right, let me work that out.', 'Nearly there.']);
});

// Blanks are kept by the model and must be dropped here, or a half-finished edit
// becomes silence exactly where a floor-holder was expected.
test('a blank row is never spoken as a silent placeholder', async () => {
    model.setPools({ acknowledgment: ['', '   ', 'The only real one.'], thinking: ['Nearly there.'] });
    storage.savePlaceholderSettings(0.02, 5, 1);
    placeholders.arm();
    await sleep(80);
    assert.deepEqual(spokenTexts, ['The only real one.']);
});
