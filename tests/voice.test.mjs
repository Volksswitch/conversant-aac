/* Tier 1 — the voice model (app/js/voice.js).
 *
 * Sounds Like Me Phase 0. The assertions that matter most are about what the block
 * TELLS the model, not about storage round-trips: two specific misreadings are what
 * the wording exists to prevent, and both are silent if they regress.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './env.mjs';

const voice = await import('../app/js/voice.js');

function reset() {
    localStorage.removeItem('aac_voice');
    // Force the module to re-read from the (now empty) cache.
    return voice.resetAll();
}

test('an empty profile contributes NOTHING to the prompt', async () => {
    await reset();
    assert.equal(voice.buildBlock([]), '', 'no voice data must not add an empty heading');
});

test('endorsed exemplars reach the prompt as EXAMPLES, not as adjectives', async () => {
    await reset();
    voice.recordAnswer('weekend', 'chose', 'Good. You?');
    voice.recordAnswer('offer', 'chose', 'Nice - what came in?');
    const block = voice.buildBlock([]);
    assert.match(block, /"Good\. You\?"/);
    assert.match(block, /"Nice - what came in\?"/);
    // The instruction must point at the examples themselves.
    assert.match(block, /Match the length, directness, and level of formality/);
    // And must NOT have editorialized them into a style description.
    assert.doesNotMatch(block, /\b(informal|casual|terse|brief|chatty)\b/i,
        'the block describes nothing — the sentences are the instruction');
});

test('the two escapes record a NON-answer and contribute no exemplar', async () => {
    await reset();
    voice.recordAnswer('a', 'all-fine');
    voice.recordAnswer('b', 'none');
    assert.equal(voice.answeredCount(), 2, 'both are answers');
    assert.equal(voice.buildBlock([]), '', 'but neither is an example of how they talk');
});

test('CAUTION 1: Express phrases are marked as evidence of vocabulary, NOT of length', async () => {
    await reset();
    const block = voice.buildBlock(["Let's go!", "That's clutch"]);
    assert.match(block, /Let's go!/);
    // Button labels are short by construction. A model shown a list of them concludes
    // the user is terse — a bias that came from the widget, not the person.
    assert.match(block, /do NOT treat them as evidence that this user prefers short replies/i);
});

test('CAUTION 2: the model is told never to reproduce the user idiom it is shown', async () => {
    await reset();
    const block = voice.buildBlock(["Nah, I'm good"]);
    // Given a catchphrase list, models over-apply it, and idiolect used slightly
    // wrong reads as impersonation — worse than idiolect absent. The user says those
    // words themselves, by tapping the button.
    assert.match(block, /Do NOT put these exact phrases into responses/i);
});

test('negative constraints are stated as absolute', async () => {
    await reset();
    voice.setNever(['swearing', 'over-apologizing']);
    const block = voice.buildBlock([]);
    assert.match(block, /never says: swearing; over-apologizing/);
    assert.match(block, /without exception/i);
});

test('setNever drops blanks and trims, so an empty editor row cannot become a rule', async () => {
    await reset();
    voice.setNever(['  swearing  ', '', '   ', 'slang']);
    assert.deepEqual(voice.getNever(), ['swearing', 'slang']);
});

test('answers survive a round trip through the cache', async () => {
    await reset();
    voice.recordAnswer('x', 'chose', 'Sounds good.');
    const stored = JSON.parse(localStorage.getItem('aac_voice'));
    assert.equal(stored.soundCheck.x.choice, 'Sounds good.');
    assert.equal(stored.soundCheck.x.verdict, 'chose');
});

test('a malformed voice.json degrades to empty rather than throwing', async () => {
    localStorage.setItem('aac_voice', JSON.stringify({ soundCheck: 'not an object', never: 'nope' }));
    const p = await voice.load();
    assert.deepEqual(p.soundCheck, {});
    assert.deepEqual(p.never, []);
    assert.equal(voice.buildBlock([]), '');
});

test('clearing an answer removes its exemplar from the prompt', async () => {
    await reset();
    voice.recordAnswer('x', 'chose', 'Sounds good.');
    assert.match(voice.buildBlock([]), /Sounds good\./);
    voice.clearAnswer('x');
    assert.equal(voice.buildBlock([]), '');
});

// --- Phase 2: harvested prose vs Sound Check exemplars -----------------------
// Two exemplar sources in one block, needing OPPOSITE instructions. Getting this
// backwards is silent and lands on the anti-fabrication rule either way.

test('harvested prose is labelled as the user own past words, not as fabrications', async () => {
    await reset();
    voice.setHarvest({ exemplars: ['I have been looking forward to this all week.'], lengthLean: null, counts: {} });
    const block = voice.buildBlock([]);
    assert.match(block, /actually written themselves, in real conversations/);
    // The Sound Check line ("nothing they mention is a fact") would be FALSE here —
    // these are the user's real words about real things.
    assert.doesNotMatch(block, /fixed list of made-up replies/);
    // But a past utterance is not a current fact either.
    assert.match(block, /not current facts/);
});

test('a dismissed sentence leaves the prompt and does not come back on a re-harvest', async () => {
    await reset();
    voice.setHarvest({ exemplars: ['Keep this one in.', 'Take this one out.'], lengthLean: null, counts: {} });
    voice.dismissExemplar('Take this one out.');
    assert.deepEqual(voice.activeExemplars(), ['Keep this one in.']);
    assert.doesNotMatch(voice.buildBlock([]), /Take this one out/);
    // Re-running the harvest finds it again; the correction must still hold.
    voice.setHarvest({ exemplars: ['Keep this one in.', 'Take this one out.'], lengthLean: null, counts: {} });
    assert.deepEqual(voice.activeExemplars(), ['Keep this one in.']);
});

test('a measured length lean is stated with its evidence', async () => {
    await reset();
    voice.setHarvest({ exemplars: [], lengthLean: { lean: 'shorter', shorter: 9, longer: 2, level: 1, total: 12 }, counts: {} });
    const block = voice.buildBlock([]);
    assert.match(block, /picks the shorter one far more often/);
    assert.match(block, /9 of 11 decided/, 'the count is shown, not just the verdict');
});

test('a "neither" lean says nothing rather than inventing a preference', async () => {
    await reset();
    voice.setHarvest({ exemplars: [], lengthLean: { lean: 'neither', shorter: 5, longer: 5, level: 0, total: 10 }, counts: {} });
    assert.equal(voice.buildBlock([]), '');
});

// --- Reframe steers ----------------------------------------------------------
// The strongest signal in the file: not a preference the user reported, but one
// they were driven to state repeatedly because the app kept getting it wrong.

test('a steer typed ONCE is a one-off and never reaches the prompt', async () => {
    await reset();
    voice.recordSteer('keep it short');
    assert.deepEqual(voice.repeatedSteers(), []);
    assert.equal(voice.buildBlock([]), '');
});

test('a steer typed twice becomes a standing instruction, with its count', async () => {
    await reset();
    voice.recordSteer('keep it short');
    voice.recordSteer('Keep it short.');      // same instruction, different typing
    const rep = voice.repeatedSteers();
    assert.equal(rep.length, 1, 'punctuation and case must not split a repeat');
    assert.equal(rep[0].count, 2);
    const block = voice.buildBlock([]);
    assert.match(block, /typed the same correction more than once/);
    assert.match(block, /asked 2 times/);
});

test('different steers are not conflated into one', async () => {
    await reset();
    voice.recordSteer('keep it short');
    voice.recordSteer('keep it short');
    voice.recordSteer('be more direct');
    voice.recordSteer('be more direct');
    assert.equal(voice.repeatedSteers().length, 2);
});

test('most-repeated steers lead', async () => {
    await reset();
    for (let i = 0; i < 5; i++) voice.recordSteer('keep it short');
    voice.recordSteer('be warmer'); voice.recordSteer('be warmer');
    assert.equal(voice.repeatedSteers()[0].text, 'keep it short');
});

test('a dismissed steer stops being used', async () => {
    await reset();
    voice.recordSteer('keep it short'); voice.recordSteer('keep it short');
    voice.dismissExemplar('keep it short');
    assert.deepEqual(voice.repeatedSteers(), []);
    assert.equal(voice.buildBlock([]), '');
});

test('a blank steer is not recorded', async () => {
    await reset();
    voice.recordSteer('   ');
    voice.recordSteer('');
    assert.deepEqual(voice.repeatedSteers(0), []);
});
