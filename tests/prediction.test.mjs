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
    prediction.learn('hi!!!');        // twice: a word used once ranks after the dictionary (CR-151)
    const out = prediction.predict('h', 5);
    assert.ok(out.includes('hi'));
    assert.ok(!out.includes('a'));
});

test('a private conversation learns nothing, and learning resumes after it (CR-012)', () => {
    prediction.setLearning(false);
    prediction.learn('zebrafish');
    assert.ok(!prediction.predict('zebraf', 3).includes('zebrafish'), 'a word typed in private is not kept');
    prediction.setLearning(true);
    prediction.learn('zebrafish');
    assert.ok(prediction.predict('zebraf', 3).includes('zebrafish'), 'ordinary conversations still learn');
});

// CR-151. One typo does not beat the dictionary; repeated use does; the list is capped.
test('a word typed once comes after the dictionary, a word used often comes first', () => {
    prediction.learn('teh');
    assert.notEqual(prediction.predict('te', 1)[0], 'teh');
    prediction.learn('teh'); prediction.learn('teh');
    assert.equal(prediction.predict('te', 1)[0], 'teh');
});

test('a word with an accented letter is not stored as a fragment', () => {
    prediction.learn('José');
    assert.ok(!prediction.predict('jo', 10).includes('jos'));
});

test('the learned list stays capped', () => {
    for (let i = 0; i < 3000; i++) prediction.learn('zz' + i.toString(36) + 'q');
    const stored = JSON.parse(localStorage.getItem('aac_word_freq'));
    assert.ok(Object.keys(stored).length <= 2500, `${Object.keys(stored).length}`);
});

// October 25 2026: there was no way to clear learned words, including one planted by
// somebody else's backup with a huge count so it came first whenever its first letters
// were typed.
test('forgetting learned words clears them, keeps the dictionary, and starts learning again', () => {
    prediction.importFrequencies({ thunderbolt: 1000000 });
    assert.equal(prediction.predict('th', 1)[0], 'thunderbolt', 'the planted word comes first');
    assert.equal(prediction.learnedCount(), 1);

    prediction.clearLearned();
    assert.equal(prediction.learnedCount(), 0);
    assert.notEqual(prediction.predict('th', 1)[0], 'thunderbolt', 'it no longer comes first');
    assert.ok(prediction.predict('th', 3).length > 0, 'the dictionary still suggests words');
    assert.equal(localStorage.getItem('aac_word_freq'), null, 'nothing is left in storage');

    for (let i = 0; i < 3; i++) prediction.learn('thunderbolt');
    assert.equal(prediction.learnedCount(), 1, 'learning starts again from nothing');
});

// October 25 2026: names the app already holds are suggested from the start, and the
// user can see the list, add a word and remove one.
test('names from About Me are suggested at once, but not the ordinary words in them', () => {
    prediction.clearLearned();   // the learned list is kept in memory between tests
    prediction.setKnownWordsProvider(() => ['Siobhan', 'Pulp Comics', 'The Coffee Shop']);
    try {
        assert.equal(prediction.predict('sio', 1)[0], 'siobhan', 'a name comes first without being typed twice');
        assert.equal(prediction.predict('pul', 1)[0], 'pulp');
        // "the" and "coffee" are ordinary words; a place name must not push them ahead
        // of the dictionary's order for everything else the user types.
        const before = (() => { prediction.setKnownWordsProvider(() => []); return prediction.predict('th', 3); })();
        prediction.setKnownWordsProvider(() => ['Siobhan', 'Pulp Comics', 'The Coffee Shop']);
        assert.deepEqual(prediction.predict('th', 3), before);
        assert.equal(prediction.learnedCount(), 0, 'names are not copied into the learned list');
    } finally {
        prediction.setKnownWordsProvider(() => []);
    }
});

test('a name with a letter outside a-z is skipped whole, never stored as a fragment', () => {
    assert.deepEqual(prediction.wordsIn(['José Ramírez', "O'Brien", 'Dr. Patel']).sort(), ["o'brien", 'dr', 'patel'].sort());
});

test('the list can be seen, added to and removed from', () => {
    prediction.clearLearned();
    for (let i = 0; i < 3; i++) prediction.learn('thunderbolt');
    const r = prediction.addWords('Humira José');
    assert.deepEqual(r.added, ['humira']);
    assert.deepEqual(r.skipped, ['José'], 'a word that cannot be suggested is said back');
    assert.equal(prediction.predict('hum', 1)[0], 'humira', 'an added word is suggested first at once');
    assert.deepEqual(prediction.listLearned().map((w) => w.word), ['thunderbolt', 'humira']);
    assert.equal(prediction.removeWord('humira'), true);
    assert.deepEqual(prediction.listLearned().map((w) => w.word), ['thunderbolt']);
    assert.notEqual(prediction.predict('hum', 1)[0], 'humira');
});
