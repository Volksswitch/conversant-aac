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
const { VERDICT } = await import('../app/js/sound-check-items.js');

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
    assert.match(block, /written themselves, during their conversations or when looking back over one/);
    // Not "in real conversations": some were written in review, and the AI was told
    // review answers came from real conversations (October 6 2026).
    assert.doesNotMatch(block, /in real conversations/);
    // The plan's caution that typed length reflects effort reaches the prompt.
    assert.match(block, /length may partly reflect that effort/);
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
    voice.setHarvest({ version: 2, exemplars: [], lengthLean: { lean: 'shorter', shorter: 9, longer: 2, level: 1, total: 12 }, counts: {} });
    const block = voice.buildBlock([]);
    assert.match(block, /picks wordings shorter than is typical for that kind of reply/);
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
    assert.match(block, /asked for the same thing more than once/);
    assert.match(block, /asked 2 times/);
    // A style request reaches the AI in the app's own words, not the user's.
    assert.match(block, /Keep responses short\. \(asked 2 times\)/);
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

/*
 * Levity exemplars are listed SEPARATELY from the rest, because the two need
 * opposite instructions (August 8 2026). A bland exemplar reused verbatim is fine —
 * the user picked it because it is what they would say, and nobody notices "Good,
 * thanks." twice. A distinctive brush-off reused is a verbal tic, and the same joke
 * on every unanswerable question stops sounding like a person by the third outing.
 */
test('a levity choice is listed apart from the bland ones, and forbidden as a script', async () => {
    voice.recordAnswer('economy-weekend', VERDICT.CHOSE, 'Good, thanks.');
    voice.recordAnswer('levity-dontknow', VERDICT.CHOSE, 'Not a clue. That one left my head a long time ago.');
    const block = voice.buildBlock();

    // The bland one keeps the original framing; the levity one gets its own.
    assert.match(block, /Examples of how this user prefers to reply/);
    assert.match(block, /This is how they take the edge off/);
    assert.match(block, /NEVER reply with one of them/);
    assert.match(block, /verbal tic/);

    // And they must not be mixed: the levity line belongs under the second heading.
    const split = block.indexOf('This is how they take the edge off');
    assert.ok(block.indexOf('Good, thanks.') < split, 'bland exemplar stays in the first list');
    assert.ok(block.indexOf('left my head a long time ago') > split, 'levity exemplar moves to the second');
});

// Selections are behavior, and behavior is the stronger evidence — but an explicit
// refusal elsewhere in the profile still wins. Stated here so the two blocks agree.
test('choosing the lighter option counts as permission, and says what overrides it', async () => {
    voice.recordAnswer('levity-late', VERDICT.CHOSE, "It's fine. I was starting to plan my escape, though.");
    const block = voice.buildBlock();
    assert.match(block, /IS this user telling you a lighter reply suits them/);
    assert.match(block, /do not want joking suggestions, which overrides this outright/);
});

// CR-070. A sentence the user typed can carry one of their catchphrases, and an
// exemplar is sent under "follow their phrasing" - so the catchphrase is taken out
// before it reaches the model, and a sentence left too short to carry a style is
// dropped. Only the user's OWN phrases are redacted.
test('a harvested sentence reaches the prompt without the user catchphrases', async () => {
    await reset();
    voice.setHarvest({
        exemplars: ["Let's go! I'll meet you at the game Saturday.", "That's clutch, nice one", 'Thank you so much for coming today.'],
        lengthLean: null, counts: {},
    });
    const block = voice.buildBlock(["Let's go!", "That's clutch"]);
    assert.match(block, /"I'll meet you at the game Saturday\."/);
    assert.doesNotMatch(block, /"Let's go! I'll/, 'the catchphrase is gone from the exemplar');
    assert.doesNotMatch(block, /"nice one"/i, 'a sentence left under four words is dropped');
    assert.match(block, /"Thank you so much for coming today\."/, 'words not in the user list are untouched');
});

// CR-052. The flat reply on a levity item is not permission to be light.
test('choosing the flat reply on every levity item grants no joke permission', async () => {
    await reset();
    const { SOUND_CHECK_ITEMS } = await import('../app/js/sound-check-items.js');
    for (const it of SOUND_CHECK_ITEMS.filter((i) => i.dimension === 'levity')) {
        const flat = it.leads === 'light' ? it.candidates.at(-1) : it.candidates[0];
        voice.recordAnswer(it.id, 'chose', flat);
    }
    const block = voice.buildBlock([]);
    assert.doesNotMatch(block, /picked the lighter one/);
    assert.match(block, /"No, I don't know that one\."/, 'the flat reply is an ordinary example');
});

// CR-053. Every answer reaches the prompt, the initiating items included.
test('answering the whole bank in order puts every initiating answer in the prompt', async () => {
    await reset();
    const { SOUND_CHECK_ITEMS } = await import('../app/js/sound-check-items.js');
    for (const it of SOUND_CHECK_ITEMS) voice.recordAnswer(it.id, 'chose', it.candidates[0]);
    const block = voice.buildBlock([]);
    for (const it of SOUND_CHECK_ITEMS.filter((i) => i.id.startsWith('initiate-'))) {
        assert.ok(block.includes(it.candidates[0]), `${it.id} is missing`);
    }
});

// CR-163. A removed correction stays removed when a later wording of it is shown.
test('a removed correction does not come back under another wording', async () => {
    await reset();
    voice.recordSteer('Keep it short'); voice.recordSteer('Keep it short');
    voice.recordSteer('keep it short!'); voice.recordSteer('keep it short!');
    voice.dismissExemplar(voice.repeatedSteers()[0].text);
    for (let i = 0; i < 200; i++) voice.recordSteer('other ' + i);   // the first wording ages out
    voice.recordSteer('keep it short!'); voice.recordSteer('keep it short!');
    assert.equal(voice.repeatedSteers().filter((g) => /keep it short/i.test(g.text)).length, 0);
});

// CR-191. Reworded candidates: an answer stored under the old wording is carried onto
// the new one, so the card stays highlighted and the AI gets the American wording.
test('a Sound Check answer stored under old British wording loads as the new wording', async () => {
    await reset();
    localStorage.setItem('aac_voice', JSON.stringify({
        soundCheck: {
            'affect-coffee': { verdict: VERDICT.CHOSE, choice: 'Oh, lovely. Thanks.', at: '2026-09-01T00:00:00Z' },
            'formality-sit': { verdict: VERDICT.CHOSE, choice: 'Yeah, thanks.', at: '2026-09-01T00:00:00Z' },
        },
    }));
    await voice.load();
    assert.equal(voice.getAnswer('affect-coffee').choice, 'Oh, great. Thanks.');
    assert.equal(voice.getAnswer('formality-sit').choice, 'Yeah, thanks.', 'unchanged wording is untouched');
    assert.doesNotMatch(voice.buildBlock([]), /lovely/);
});

test('every reworded candidate maps onto a candidate that exists', async () => {
    const { RENAMED_CANDIDATES, SOUND_CHECK_ITEMS } = await import('../app/js/sound-check-items.js');
    const all = new Set(SOUND_CHECK_ITEMS.flatMap((it) => it.candidates));
    for (const [oldText, newText] of Object.entries(RENAMED_CANDIDATES)) {
        assert.ok(all.has(newText), newText);
        assert.ok(!all.has(oldText), oldText);
    }
});

// --- October 6 2026: the fixes from "Conversant AAC Sounds Like Me Evaluation" -----

test('two wordings of one style request count as one request', async () => {
    await reset();
    voice.recordSteer('shorter');
    voice.recordSteer('keep it to five words');
    const rep = voice.repeatedSteers();
    assert.equal(rep.length, 1);
    assert.equal(rep[0].meaning, 'shorter');
    assert.equal(rep[0].count, 2);
    assert.deepEqual(rep[0].texts.sort(), ['keep it to five words', 'shorter']);
    const block = voice.buildBlock([]);
    assert.match(block, /Keep responses short\. \(asked 2 times\)/);
    // A style steer can carry content too, so the user's own wording is not sent.
    assert.doesNotMatch(block, /five words/);
});

test('a request about content still needs the same wording twice', async () => {
    await reset();
    voice.recordSteer('say I already have plans');
    voice.recordSteer('say I have plans already');
    assert.deepEqual(voice.repeatedSteers(), []);
});

test('a style request mixed with content is treated as content, not as a style rule', async () => {
    // Reading it as a style request would turn a one-off about this turn into a
    // standing instruction; the cautious reading costs nothing that was not lost before.
    await reset();
    voice.recordSteer("shorter, and say I'm tired");
    voice.recordSteer('Shorter and more casual. talk like a 17 year old');
    assert.deepEqual(voice.steerMeanings("shorter, and say I'm tired"), []);
    assert.deepEqual(voice.repeatedSteers(), [], 'the two are different requests');
});

test('negated forms are read first, so "less formal" is casual and not formal', () => {
    assert.deepEqual(voice.steerMeanings('less formal please'), ['casual']);
    assert.deepEqual(voice.steerMeanings('too polite'), ['blunter']);
    assert.deepEqual(voice.steerMeanings('no jokes'), ['serious']);
    // Narrow on purpose: these are about the turn, not the style.
    assert.deepEqual(voice.steerMeanings('it was warm out'), []);
    assert.deepEqual(voice.steerMeanings("say I'll stay longer"), []);
});

test('opposite requests cannot both stand; the newer one wins', async () => {
    await reset();
    voice.setHarvest({ exemplars: [], lengthLean: null, counts: {}, steers: [
        { text: 'shorter', at: '2026-01-01T00:00:00Z' },
        { text: 'be brief', at: '2026-01-02T00:00:00Z' },
        { text: 'make it longer', at: '2026-02-01T00:00:00Z' },
        { text: 'more detail', at: '2026-02-02T00:00:00Z' },
    ] });
    const rep = voice.repeatedSteers();
    assert.deepEqual(rep.map((r) => r.meaning), ['longer']);
});

test('a steer typed in review counts toward a repeat', async () => {
    await reset();
    voice.setHarvest({ exemplars: [], lengthLean: null, counts: {}, steers: [
        { text: 'Be blunter.', at: '2026-10-01T00:00:00Z', personId: 'p1', label: 'Mom', fromReview: true },
    ] });
    voice.recordSteer('be blunter');
    assert.equal(voice.repeatedSteers()[0].count, 2);
});

test('removing a repeated request removes it under every wording', async () => {
    await reset();
    voice.recordSteer('shorter');
    voice.recordSteer('keep it brief');
    voice.dismissSteer(voice.repeatedSteers()[0].key);
    voice.recordSteer('fewer words');
    assert.deepEqual(voice.repeatedSteers(), []);
});

test('a kept instruction for everyone reaches the prompt; one kept for a person does not', async () => {
    await reset();
    voice.keepSteer('Use short sentences.');
    voice.keepSteer('Call her Mama.', { personId: 'p1', label: 'Mom' });
    const block = voice.buildBlock([]);
    assert.match(block, /asked you to keep/);
    assert.match(block, /"Use short sentences\."/);
    assert.doesNotMatch(block, /Mama/, 'that one belongs to the situation block, sent only with Mom');
    assert.deepEqual(voice.keptFor('p1').map((k) => k.text), ['Call her Mama.']);
    assert.deepEqual(voice.keptFor(null).map((k) => k.text), ['Use short sentences.']);
    voice.unkeepSteer('Use short sentences.', null);
    assert.doesNotMatch(voice.buildBlock([]), /Use short sentences/);
});

test('keeping the same instruction twice for the same person stores it once', async () => {
    await reset();
    voice.keepSteer('Keep it light.', { personId: 'p1', label: 'Mom' });
    voice.keepSteer('keep it light', { personId: 'p1', label: 'Mom' });
    voice.keepSteer('Keep it light.');
    assert.equal(voice.keptSteers().length, 2, 'once for Mom and once for everyone');
});

test('the recent list offers typed instructions, newest first, minus kept and removed ones', async () => {
    await reset();
    voice.setHarvest({ exemplars: [], lengthLean: null, counts: {}, steers: [
        { text: 'mention the bus', at: '2026-10-05T00:00:00Z', personId: 'p2', label: 'Devon', fromReview: true },
    ] });
    voice.recordSteer('ask about her day', { personId: 'p1', label: 'Mom' });
    voice.recordSteer('kept one');
    voice.recordSteer('removed one');
    voice.keepSteer('kept one');
    voice.dismissSteer('removed one');
    const recent = voice.recentSteers();
    assert.deepEqual(recent.map((r) => r.text), ['ask about her day', 'mention the bus']);
    assert.equal(recent[0].personId, 'p1');
    assert.equal(recent[0].label, 'Mom');
});

test('a steer records who the user was talking to', async () => {
    await reset();
    voice.recordSteer('slower', { personId: 'p1', label: 'Mom' });
    const stored = JSON.parse(localStorage.getItem('aac_voice'));
    assert.equal(stored.steers[0].personId, 'p1');
    assert.equal(stored.steers[0].label, 'Mom');
});

test('removing an example lets the next one take its place', async () => {
    await reset();
    const pool = Array.from({ length: 14 }, (_, i) => `Sentence number ${i + 1} that I typed.`);
    voice.setHarvest({ exemplars: pool, lengthLean: null, counts: {} });
    assert.equal(voice.exemplarsShown().length, 12);
    assert.ok(!voice.exemplarsShown().includes(pool[12]));
    voice.dismissExemplar(pool[0]);
    assert.equal(voice.exemplarsShown().length, 12);
    assert.ok(voice.exemplarsShown().includes(pool[12]), 'the thirteenth moves up');
    assert.match(voice.buildBlock([]), /Sentence number 13 that I typed\./);
});

test('short replies reach the prompt, without the user catchphrases', async () => {
    await reset();
    voice.setHarvest({ exemplars: [], shortReplies: ['Nah, all good.', "Let's go!"], lengthLean: null, counts: {} });
    const block = voice.buildBlock(["Let's go!"]);
    assert.match(block, /Short replies this user has typed themselves: "Nah, all good\."/);
    const shortLine = block.split(/\r?\n/).find((l) => l.startsWith('Short replies'));
    assert.doesNotMatch(shortLine, /Let's go/, 'a catchphrase that is the whole reply is gone');
    voice.dismissExemplar('Nah, all good.');
    assert.doesNotMatch(voice.buildBlock([]), /Nah, all good/);
});

// Length from How I Sound, and how it is reconciled with the live measure.
async function answerBrevity(pick) {
    const { SOUND_CHECK_ITEMS } = await import('../app/js/sound-check-items.js');
    const words = (t) => (t.match(/[A-Za-z0-9']+/g) || []).length;
    for (const it of SOUND_CHECK_ITEMS.filter((i) => i.dimension === 'economy')) {
        const counts = it.candidates.map(words);
        const target = pick === 'short' ? Math.min(...counts) : Math.max(...counts);
        voice.recordAnswer(it.id, 'chose', it.candidates[counts.indexOf(target)]);
    }
}

test('How I Sound brevity answers produce a length instruction of their own', async () => {
    await reset();
    await answerBrevity('short');
    assert.match(voice.buildBlock([]), /picked the shortest in \d of \d questions about length\. Keep responses brief/);
});

test('when live picks and How I Sound disagree about length, only How I Sound is sent', async () => {
    await reset();
    await answerBrevity('short');
    voice.setHarvest({ version: 2, exemplars: [], lengthLean: { lean: 'longer', shorter: 2, longer: 9, level: 1, total: 12 }, counts: {} });
    const block = voice.buildBlock([]);
    assert.match(block, /picked the shortest in/);
    assert.doesNotMatch(block, /fuller than is typical/);
    assert.doesNotMatch(block, /Do not clip/);
});

test('when they agree, the live measure is sent with its count', async () => {
    await reset();
    await answerBrevity('short');
    voice.setHarvest({ version: 2, exemplars: [], lengthLean: { lean: 'shorter', shorter: 9, longer: 2, level: 1, total: 12 }, counts: {} });
    const block = voice.buildBlock([]);
    assert.match(block, /9 of 11 decided/);
    assert.doesNotMatch(block, /questions about length/);
});

test('the user own sentences are told to outrank the How I Sound picks', async () => {
    await reset();
    voice.recordAnswer('economy-queue', 'chose', "That's fine.");
    voice.setHarvest({ exemplars: ['I will be there at six, save me a seat.'], lengthLean: null, counts: {} });
    const block = voice.buildBlock([]);
    assert.doesNotMatch(block, /single most important guide/, 'only one part may claim to come first');
    assert.match(block, /Where this user's own sentences appear further down, those come first/);
    assert.match(block, /where it differs from the picked examples above, follow it/);
});

// The app.js half cannot be loaded by a test, so it is checked at source level.
// Comments are stripped first: a comment naming the fix would otherwise satisfy the
// check while the code itself was broken.
import { readFileSync } from 'node:fs';
function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n');
}

test('app.js keeps practice steers out and records who each steer was typed to', () => {
    const app = stripComments(readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8'));
    const at = app.indexOf('voiceProfile.recordSteer(');
    assert.ok(at > 0, 'the steer is still recorded');
    const before = app.slice(Math.max(0, at - 200), at);
    assert.match(before, /!practiceMode/, 'a practice steer must not be saved');
    assert.match(app.slice(at, at + 300), /personId/, 'the partner is saved with it');
});

test('app.js sends a person\'s kept instructions only in the situation block', () => {
    const app = stripComments(readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8'));
    const start = app.indexOf('function buildSituationBlock()');
    const body = app.slice(start, app.indexOf('\n}\n', start));
    assert.match(body, /voiceProfile\.instructionsFor\(activePartner\.personId\)/);
});

test('a request that is already standing is not offered again in the recent list', async () => {
    await reset();
    voice.recordSteer('shorter');
    voice.recordSteer('keep it brief');
    voice.recordSteer('mention the game');
    assert.deepEqual(voice.recentSteers().map((r) => r.text), ['mention the game']);
});

test('the user sentences are not compared with picked examples that are not there', async () => {
    await reset();
    voice.setHarvest({ exemplars: ['I will be there at six, save me a seat.'], lengthLean: null, counts: {} });
    assert.doesNotMatch(voice.buildBlock([]), /picked examples above/);
});


// --- October 6 2026: what the code review of the fixes found -----------------------

test('a negated style word is read the right way round, or not at all', () => {
    assert.deepEqual(voice.steerMeanings("don't make a joke"), ['serious']);
    assert.deepEqual(voice.steerMeanings('don’t be funny'), ['serious'], 'a curly apostrophe too');
    assert.deepEqual(voice.steerMeanings('not casual'), ['formal']);
    assert.deepEqual(voice.steerMeanings("that's too informal"), ['formal']);
    assert.deepEqual(voice.steerMeanings("don't be blunt"), ['warmer']);
    assert.deepEqual(voice.steerMeanings('less brief'), ['longer']);
    assert.deepEqual(voice.steerMeanings('no need to be blunter'), [], 'unknown negation: not read');
});

test('a content steer that happens to contain a style word is not a style request', () => {
    for (const t of ['say it would be nice to see her', 'it would be kind of fun', "tell him I'm relaxed about it",
        "say we're getting to the point of deciding", 'mention it was a brief visit', 'say more about the trip']) {
        assert.deepEqual(voice.steerMeanings(t), [], t);
    }
});

test('asking for "too informal" after "more formal" never produces a casual instruction', async () => {
    await reset();
    voice.recordSteer('more formal'); voice.recordSteer('be more formal');
    voice.recordSteer("that's too informal"); voice.recordSteer('too informal');
    const block = voice.buildBlock([]);
    assert.doesNotMatch(block, /casual/i);
    assert.match(block, /Keep the wording more formal\. \(asked 4 times\)/);
});

test('a request made only with one person stands only for that person', async () => {
    await reset();
    voice.recordSteer('ask about her garden', { personId: 'p1', label: 'Mom' });
    voice.recordSteer('ask about her garden', { personId: 'p1', label: 'Mom' });
    const rep = voice.repeatedSteers();
    assert.equal(rep[0].personId, 'p1');
    assert.doesNotMatch(voice.buildBlock([]), /garden/, 'not in the block every partner gets');
    assert.deepEqual(voice.instructionsFor('p1'), ['"ask about her garden"']);
    assert.deepEqual(voice.instructionsFor('p2'), []);
    // Asked with a second person as well, it becomes everyone's.
    voice.recordSteer('ask about her garden', { personId: 'p2', label: 'Aunt Rosa' });
    assert.match(voice.buildBlock([]), /garden/);
    assert.deepEqual(voice.instructionsFor('p1'), []);
});

test('instructionsFor carries what was kept for that person and their own style requests', async () => {
    await reset();
    voice.keepSteer('Call her Mama.', { personId: 'p1', label: 'Mom' });
    voice.recordSteer('shorter', { personId: 'p1', label: 'Mom' });
    voice.recordSteer('keep it brief', { personId: 'p1', label: 'Mom' });
    assert.deepEqual(voice.instructionsFor('p1'), ['"Call her Mama."', 'Keep responses short.']);
    assert.doesNotMatch(voice.buildBlock([]), /Keep responses short/);
});

test('turning down an offer to keep does not stop the request from becoming standing', async () => {
    await reset();
    voice.recordSteer('shorter');
    voice.hideSteer('shorter', null);
    assert.deepEqual(voice.recentSteers(), []);
    voice.recordSteer('keep it brief');
    assert.equal(voice.repeatedSteers()[0].meaning, 'shorter');
});

test('a removed request and a removed kept instruction are not offered for keeping again', async () => {
    await reset();
    voice.recordSteer('shorter'); voice.recordSteer('keep it brief');
    voice.dismissSteer(voice.repeatedSteers()[0].key);
    assert.deepEqual(voice.recentSteers(), [], 'its wordings do not come back as offers');
    voice.recordSteer('mention the bus');
    voice.keepSteer('mention the bus');
    voice.unkeepSteer('mention the bus', null);
    assert.deepEqual(voice.recentSteers(), []);
});

test('the losing half of an opposite pair is not offered for keeping', async () => {
    await reset();
    voice.setHarvest({ version: 2, exemplars: [], lengthLean: null, counts: {}, steers: [
        { text: 'shorter', at: '2026-01-01T00:00:00Z' }, { text: 'be brief', at: '2026-01-02T00:00:00Z' },
        { text: 'make it longer', at: '2026-02-01T00:00:00Z' }, { text: 'more detail', at: '2026-02-02T00:00:00Z' },
    ] });
    assert.deepEqual(voice.recentSteers(), []);
});

test('a length reading stored by an older version is not used', async () => {
    await reset();
    voice.setHarvest({ exemplars: [], lengthLean: { lean: 'longer', shorter: 2, longer: 9, level: 1, total: 12 }, counts: {} });
    assert.equal(voice.lengthInstruction(), null);
    assert.equal(voice.buildBlock([]), '');
});

test('lengthInstruction says which source the length line came from', async () => {
    await reset();
    await answerBrevity('short');
    assert.equal(voice.lengthInstruction().source, 'soundcheck');
    voice.setHarvest({ version: 2, exemplars: [], lengthLean: { lean: 'shorter', shorter: 9, longer: 2, level: 1, total: 12 }, counts: {} });
    assert.equal(voice.lengthInstruction().source, 'live');
});

test('the sentences listed for About Me are exactly the ones the AI is given', async () => {
    await reset();
    // The first is emptied by the catchphrase rule; the thirteenth must take its place
    // in both the list and the prompt.
    const pool = ["Let's go!", ...Array.from({ length: 13 }, (_, i) => `Sentence number ${i + 1} that I typed.`)];
    voice.setHarvest({ version: 2, exemplars: pool, lengthLean: null, counts: {} });
    const sent = voice.exemplarsSent(["Let's go!"]);
    assert.equal(sent.length, 12);
    assert.ok(!sent.some((e) => /Let's go/.test(e.sent)));
    const block = voice.buildBlock(["Let's go!"]);
    for (const e of sent) assert.ok(block.includes(`"${e.sent}"`), e.sent);
    assert.ok(sent.some((e) => e.sent === 'Sentence number 12 that I typed.'));
});

test('several length signals come with a line saying which comes first', async () => {
    await reset();
    await answerBrevity('short');
    voice.setHarvest({ version: 2, exemplars: ['I will be there at six, save me a seat.'], lengthLean: null, counts: {} });
    assert.match(voice.buildBlock([]), /On length: an instruction this user asked for comes first/);
});

test('keeping many instructions never quietly drops an earlier one', async () => {
    await reset();
    for (let i = 0; i < 30; i++) voice.keepSteer(`instruction number ${i}`);
    assert.equal(voice.keptSteers().length, 30);
});
