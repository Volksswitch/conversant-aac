/* Tier 1 — the voice harvest (app/js/voice-harvest.js).
 *
 * The classification rules are the load-bearing part. Getting them wrong does not
 * throw: it quietly teaches the model that this person says OUR control phrases, or
 * feeds the model its own card wordings back as the user's prose. Both look like
 * personalization working.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTurn, collectExemplars, measureLengthLean, harvest }
    from '../app/js/voice-harvest.js';

const composed = (text) => ({ role: 'user', source: 'composed', selectedText: text, selectedIndex: -1, allOptions: [] });
const card = (chosen, offered) => ({ role: 'user', source: 'card', selectedText: chosen, selectedIndex: 0, allOptions: offered });
const legacy = (text) => ({ role: 'user', selectedText: text, selectedIndex: -1, allOptions: [] });

const OPTS = {
    controlPhrases: ['Let me think about that.', "Sorry, I didn't catch that. Could you say it again?"],
    expressPhrases: ['Yes', 'Thank you'],
};

test('classification uses the recorded source when there is one', () => {
    assert.equal(classifyTurn(composed('I had a really good time yesterday.'), OPTS), 'composed');
    assert.equal(classifyTurn(card('Good, thanks.', ['a', 'b']), OPTS), 'card');
    assert.equal(classifyTurn({ role: 'user', source: 'control', selectedText: 'x' }, OPTS), 'control');
});

test('LEGACY: one of OUR control phrases is never mistaken for the user prose', () => {
    // The specific disaster this prevents: harvesting "Let me think about that." as
    // an example of how this person talks is feeding our own words back to the model.
    assert.equal(classifyTurn(legacy('Let me think about that.'), OPTS), 'control');
    assert.equal(classifyTurn(legacy('let me think about that'), OPTS), 'control', 'match is normalized');
});

test('LEGACY: an Express button label is not prose either', () => {
    assert.equal(classifyTurn(legacy('Thank you'), OPTS), 'express');
});

test('LEGACY: anything else with no options is UNKNOWN, not composed', () => {
    // Guessing "composed" is the expensive error — it puts words in the user's mouth
    // in the prompt. Guessing "unknown" only loses some history.
    assert.equal(classifyTurn(legacy('Something I typed a while ago.'), OPTS), 'unknown');
});

test('only composed turns become exemplars', () => {
    const turns = [
        composed('I have been looking forward to this all week, actually.'),
        { role: 'user', source: 'control', selectedText: 'Let me think about that.', selectedIndex: -1 },
        card('Good, thanks.', ['Good, thanks.', 'It was good thank you very much']),
        legacy('Thank you'),
    ];
    assert.deepEqual(collectExemplars(turns, OPTS),
        ['I have been looking forward to this all week, actually.']);
});

test('exemplars are deduplicated and newest first', () => {
    const turns = [
        composed('The first thing I ever said here.'),
        composed('The second thing I said here.'),
        composed('The first thing I ever said here.'),
    ];
    const out = collectExemplars(turns, OPTS);
    assert.equal(out.length, 2);
    assert.equal(out[0], 'The first thing I ever said here.', 'newest occurrence leads');
});

test('a turn too short to carry a style is not an exemplar', () => {
    assert.deepEqual(collectExemplars([composed('Yes.'), composed('Okay then.')], OPTS), []);
});

test('length lean is measured against the MEDIAN of what was offered', () => {
    // Chosen is the shortest of three every time.
    const turns = Array.from({ length: 8 }, () =>
        card('Sure.', ['Sure.', 'Yes, that works for me.', 'Yes, that works well for me thank you.']));
    const lean = measureLengthLean(turns, OPTS);
    assert.equal(lean.lean, 'shorter');
    assert.equal(lean.shorter, 8);
    assert.equal(lean.longer, 0);
});

test('a lean is withheld below the evidence threshold — three taps is not a finding', () => {
    const turns = Array.from({ length: 3 }, () => card('Sure.', ['Sure.', 'Yes, that works for me.']));
    assert.equal(measureLengthLean(turns, OPTS), null);
});

test('mixed picking reports "neither" rather than inventing a lean', () => {
    const short = card('Sure.', ['Sure.', 'Yes, that works well for me thank you.']);
    const long = card('Yes, that works well for me thank you.', ['Sure.', 'Yes, that works well for me thank you.']);
    const turns = [short, long, short, long, short, long, short, long];
    assert.equal(measureLengthLean(turns, OPTS).lean, 'neither');
});

test('selections never contribute exemplars, however many there are', () => {
    // The self-imitation guard: a selected card is the MODEL's wording.
    const turns = Array.from({ length: 20 }, () =>
        card('That is excellent news, I have been looking forward to it.',
             ['That is excellent news, I have been looking forward to it.', 'Nice.']));
    assert.deepEqual(collectExemplars(turns, OPTS), []);
});

test('harvest accepts the { id, data } shape listConversationLogs returns', () => {
    const out = harvest([
        { id: '2026-01-01', data: { exchanges: [composed('A sentence I typed out myself here.')] } },
        { exchanges: [composed('Another one I typed myself here.')] },
    ], OPTS);
    assert.equal(out.exemplars.length, 2);
    assert.equal(out.counts.composed, 2);
});

test('a malformed or empty log does not throw', () => {
    const out = harvest([null, {}, { data: {} }, { data: { exchanges: null } }], OPTS);
    assert.deepEqual(out.exemplars, []);
    assert.equal(out.lengthLean, null);
});

// --- Conversation Review answers reach the voice (Ken, October 3 2026) ------------
//
// The review half is written by the REAL review model, not by hand, so these tests
// cross the link between "the user answered in review" and "the voice examples change".
import * as reviewModel from '../app/js/review-model.js';
import { reviewContributions } from '../app/js/voice-harvest.js';

function reviewedConversation() {
    const opts = (texts) => texts.map((t, i) => ({ slot: ['PREFERRED', 'DISPREFERRED', 'INITIATIVE', 'REPAIR'][i], text: t }));
    const setA = ['It was great, thanks for asking.', 'Not bad.', 'Busy! How was yours?', 'My weekend?'];
    const setB = ['Sure, sounds good to me.', 'Maybe another time.', 'Sure, what time works?', 'Lunch when?'];
    return {
        exchanges: [
            { timestamp: '2026-10-01T10:00:00.000Z', role: 'partner', rawTranscript: 'How was your weekend?' },
            { timestamp: '2026-10-01T10:00:02.000Z', role: 'offer', options: opts(setA), outcome: 'card', selectedIndex: 0 },
            { timestamp: '2026-10-01T10:00:05.000Z', role: 'user', source: 'card', selectedText: setA[0], selectedIndex: 0, allOptions: setA },
            { timestamp: '2026-10-01T10:01:00.000Z', role: 'partner', rawTranscript: 'Want to get lunch Friday?' },
            { timestamp: '2026-10-01T10:01:02.000Z', role: 'offer', options: opts(setB), outcome: 'card', selectedIndex: 0 },
            { timestamp: '2026-10-01T10:01:05.000Z', role: 'user', source: 'card', selectedText: setB[0], selectedIndex: 0, allOptions: setB },
        ],
    };
}

test('REVIEW: a sentence typed in review becomes a voice example', () => {
    const data = reviewedConversation();
    const [first] = reviewModel.buildTurns(data);
    const review = reviewModel.setTypedAnswer(reviewModel.emptyReview('c1'), first, 'Honestly it was pretty quiet, I mostly slept.');
    const out = harvest([{ id: 'c1', data, review }], OPTS);
    assert.deepEqual(out.exemplars, ['Honestly it was pretty quiet, I mostly slept.']);
    assert.equal(out.counts.reviewed, 1);
});

test('REVIEW: a reworded response option is the user’s words; an unchanged one is not', () => {
    const data = reviewedConversation();
    const [first, second] = reviewModel.buildTurns(data);
    let review = reviewModel.setCardAnswer(reviewModel.emptyReview('c1'), first, 2, 'Busy, but good. How was yours?');
    review = reviewModel.setCardAnswer(review, second, 1);
    const out = harvest([{ id: 'c1', data, review }], OPTS);
    assert.deepEqual(out.exemplars, ['Busy, but good. How was yours?']);
    assert.ok(!out.exemplars.includes('Maybe another time.'), 'the model’s words never become an example');
    const c = reviewContributions(data, review);
    assert.equal(c.choices, 1);
    assert.deepEqual(c.exemplars, ['Busy, but good. How was yours?']);
});

test('REVIEW: a review answer replaces the live choice, it does not add to it', () => {
    const data = reviewedConversation();
    const [first] = reviewModel.buildTurns(data);
    const review = reviewModel.setCardAnswer(reviewModel.emptyReview('c1'), first, 1);
    const out = harvest([{ id: 'c1', data, review }], OPTS);
    // Two live card turns, one of them overridden by the review: still two choices.
    assert.equal(out.counts.cards + out.counts.reviewed, 2);
    assert.equal(out.counts.userTurns, 1);
});

test('REVIEW: "a different set" withdraws the live choice and adds nothing', () => {
    const data = reviewedConversation();
    const [first] = reviewModel.buildTurns(data);
    const review = reviewModel.toggleMoreOptions(reviewModel.emptyReview('c1'), first);
    const out = harvest([{ id: 'c1', data, review }], OPTS);
    assert.equal(out.counts.userTurns, 1);
    assert.equal(out.counts.reviewed, 0);
});

test('REVIEW: words written in review come before words composed live', () => {
    const data = reviewedConversation();
    data.exchanges.push({ timestamp: '2026-10-01T10:02:00.000Z', role: 'user', source: 'composed', selectedText: 'I will bring the forms on Friday.' });
    const [first] = reviewModel.buildTurns(data);
    const review = reviewModel.setTypedAnswer(reviewModel.emptyReview('c1'), first, 'Quiet one, mostly caught up on sleep.');
    const out = harvest([{ id: 'c1', data, review }], OPTS);
    assert.equal(out.exemplars[0], 'Quiet one, mostly caught up on sleep.');
    assert.equal(out.exemplars.length, 2);
});

test('REVIEW: a short answer is reported as too short, not silently dropped', () => {
    const data = reviewedConversation();
    const [first] = reviewModel.buildTurns(data);
    const review = reviewModel.setTypedAnswer(reviewModel.emptyReview('c1'), first, 'Pretty quiet.');
    const c = reviewContributions(data, review);
    assert.deepEqual(c.exemplars, []);
    assert.deepEqual(c.tooShort, ['Pretty quiet.']);
});

test('REVIEW: a conversation with no review harvests exactly as before', () => {
    const data = reviewedConversation();
    assert.deepEqual(harvest([{ id: 'c1', data }], OPTS), harvest([data], OPTS));
});
