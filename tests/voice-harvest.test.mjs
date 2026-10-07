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

// The length measure compares a pick with options OF ITS OWN KIND (October 6 2026).
const slotCard = (chosen, slot) => ({ role: 'user', source: 'card', selectedText: chosen, selectedIndex: 0, selectedSlot: slot, allOptions: [chosen, 'x'] });
const MEDIANS = { PREFERRED: 6, DISPREFERRED: 12, INITIATIVE: 10, REPAIR: 3 };

test('length lean compares a pick with the typical length of its own kind of reply', () => {
    // Best guesses shorter than the usual best guess, every time.
    const turns = Array.from({ length: 8 }, () => slotCard('Sure, sounds good.', 'PREFERRED'));
    const lean = measureLengthLean(turns, { ...OPTS, slotMedians: MEDIANS });
    assert.equal(lean.lean, 'shorter');
    assert.equal(lean.shorter, 8);
    assert.equal(lean.longer, 0);
});

test('picking long KINDS of reply is not a preference for long replies', () => {
    // The old measure read this user as "fuller": a decline and a change of direction
    // are long by design. Each pick here is ordinary for its own kind.
    const turns = [];
    for (let i = 0; i < 4; i++) turns.push(slotCard('I would love to, but I have plans that night.', 'DISPREFERRED'));
    for (let i = 0; i < 4; i++) turns.push(slotCard('How about we try that new place instead?', 'INITIATIVE'));
    const lean = measureLengthLean(turns, { ...OPTS, slotMedians: { DISPREFERRED: 10, INITIATIVE: 8 } });
    assert.notEqual(lean.lean, 'shorter');
    // 10 words against a median of 10, and 8 against 8: level, so no lean at all.
    assert.equal(lean.lean, 'neither');
});

test('picks from the fixed openers, goodbyes and choices do not count', () => {
    const turns = Array.from({ length: 8 }, () => slotCard('Bye!', 'CLOSING'))
        .concat(Array.from({ length: 8 }, () => slotCard('Mild.', 'CHOICE')));
    assert.equal(measureLengthLean(turns, { ...OPTS, slotMedians: MEDIANS }), null);
});

test('a lean is withheld below the evidence threshold — three taps is not a finding', () => {
    const turns = Array.from({ length: 3 }, () => slotCard('Sure.', 'PREFERRED'));
    assert.equal(measureLengthLean(turns, { ...OPTS, slotMedians: MEDIANS }), null);
});

test('mixed picking reports "neither" rather than inventing a lean', () => {
    const short = slotCard('Sure.', 'PREFERRED');
    const long = slotCard('Yes, that works really well for me, thank you.', 'PREFERRED');
    const turns = [short, long, short, long, short, long, short, long];
    assert.equal(measureLengthLean(turns, { ...OPTS, slotMedians: MEDIANS }).lean, 'neither');
});

test('with no typical lengths to compare against, there is no lean', () => {
    const turns = Array.from({ length: 8 }, () => slotCard('Sure.', 'PREFERRED'));
    assert.equal(measureLengthLean(turns, OPTS), null);
});

test('the typical lengths come from the sets offered, kind by kind', async () => {
    const { slotMedians } = await import('../app/js/voice-harvest.js');
    const offer = (n) => ({ role: 'offer', options: [
        { slot: 'PREFERRED', text: 'one two three four' },
        { slot: 'REPAIR', text: 'one two' },
        { slot: 'OPENER', text: 'one two three four five six seven eight' },
    ] });
    const log = { exchanges: Array.from({ length: 8 }, offer) };
    assert.deepEqual(slotMedians([log]), { PREFERRED: 4, REPAIR: 2 }, 'openers are not a kind of reply');
    assert.deepEqual(slotMedians([{ exchanges: [offer()] }]), {}, 'too few examples of a kind to trust');
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

// --- Conversation Review rewrites reach the voice (Ken, October 3 and 6 2026) ------
//
// The review half is written by the REAL review model, not by hand, so these tests
// cross the link between "the user rewrote a turn in review" and what the AI is given.
// Since October 6 2026 a rewrite is the only review answer.
import * as reviewModel from '../app/js/review-model.js';
import { reviewContributions, REVIEW_LESSONS, reviewedTurns } from '../app/js/voice-harvest.js';
import { readFileSync } from 'node:fs';

function reviewedConversation({ person = null } = {}) {
    const opts = (texts) => texts.map((t, i) => ({ slot: ['PREFERRED', 'DISPREFERRED', 'INITIATIVE', 'REPAIR'][i], text: t }));
    const setA = ['It was great, thanks for asking.', 'Not bad.', 'Busy! How was yours?', 'My weekend?'];
    const setB = ['Sure, sounds good to me.', 'Maybe another time.', 'Sure, what time works?', 'Lunch when?'];
    const ex = [
        { timestamp: '2026-10-01T10:00:00.000Z', role: 'partner', rawTranscript: 'How was your weekend?' },
        { timestamp: '2026-10-01T10:00:02.000Z', role: 'offer', options: opts(setA), outcome: 'card', selectedIndex: 0, partnerAction: 'QUESTION' },
        { timestamp: '2026-10-01T10:00:05.000Z', role: 'user', source: 'card', selectedText: setA[0], selectedIndex: 0, allOptions: setA },
        { timestamp: '2026-10-01T10:01:00.000Z', role: 'partner', rawTranscript: 'Want to get lunch Friday?' },
        { timestamp: '2026-10-01T10:01:02.000Z', role: 'offer', options: opts(setB), outcome: 'card', selectedIndex: 0, partnerAction: 'INVITATION' },
        { timestamp: '2026-10-01T10:01:05.000Z', role: 'user', source: 'card', selectedText: setB[0], selectedIndex: 0, allOptions: setB },
    ];
    if (person) for (const e of ex) if (e.role === 'user') e.partner = person;
    return { exchanges: ex };
}

test('REVIEW: a rewrite with nobody named becomes one of the user’s own sentences', () => {
    const data = reviewedConversation();
    const [first] = reviewModel.buildTurns(data);
    const review = reviewModel.setRewrite(reviewModel.emptyReview('c1'), first, 'Honestly it was pretty quiet, I mostly slept.');
    const out = harvest([{ id: 'c1', data, review }], OPTS);
    assert.deepEqual(out.exemplars, ['Honestly it was pretty quiet, I mostly slept.']);
    assert.deepEqual(out.pairs, []);
    assert.equal(out.counts.reviewed, 1);
});

test('REVIEW: a rewrite with a known person is kept for that person, not shared with everyone', () => {
    const data = reviewedConversation({ person: { id: 'p-devon', label: 'Devon' } });
    const [, second] = reviewModel.buildTurns(data);
    const review = reviewModel.setRewrite(reviewModel.emptyReview('c1'), second, 'Nah, comic shop first. After that I am down.');
    const out = harvest([{ id: 'c1', data, review }], OPTS);
    assert.deepEqual(out.exemplars, [], 'a sentence written for Devon does not shape how the user talks to everyone');
    assert.equal(out.pairs.length, 1);
    const p = out.pairs[0];
    assert.equal(p.personId, 'p-devon');
    assert.equal(p.person, 'Devon');
    assert.equal(p.action, 'INVITATION', 'what the other person was doing comes from the saved set of options');
    assert.equal(p.partnerText, 'Want to get lunch Friday?');
    assert.equal(p.text, 'Nah, comic shop first. After that I am down.');
});

test('REVIEW: a rewrite replaces the live choice, it does not add to it', () => {
    const data = reviewedConversation();
    const [first] = reviewModel.buildTurns(data);
    const review = reviewModel.setRewrite(reviewModel.emptyReview('c1'), first, 'Pretty quiet, I slept a lot.');
    const out = harvest([{ id: 'c1', data, review }], OPTS);
    assert.equal(out.counts.userTurns, 1);
});

test('REVIEW: writing back what was said at the time, or nothing, records nothing', () => {
    const [first] = reviewModel.buildTurns(reviewedConversation());
    let r = reviewModel.setRewrite(reviewModel.emptyReview('c1'), first, 'It was great, thanks for asking.');
    assert.equal(reviewModel.touchedCount(r), 0);
    r = reviewModel.setRewrite(r, first, 'Quiet one.');
    assert.equal(reviewModel.touchedCount(r), 1);
    r = reviewModel.setRewrite(r, first, '   ');
    assert.equal(reviewModel.touchedCount(r), 0);
});

test('REVIEW: a short rewrite is kept as a short reply, not dropped', () => {
    const data = reviewedConversation();
    const [first] = reviewModel.buildTurns(data);
    const review = reviewModel.setRewrite(reviewModel.emptyReview('c1'), first, 'Pretty quiet.');
    const c = reviewContributions(data, review);
    assert.deepEqual(c.exemplars, []);
    assert.deepEqual(c.shortReplies, ['Pretty quiet.']);
});

test('REVIEW: a conversation with no review harvests exactly as before', () => {
    const data = reviewedConversation();
    assert.deepEqual(harvest([{ id: 'c1', data }], OPTS), harvest([data], OPTS));
});

test('REVIEW: an older review file keeps only the answers that were the user’s own words', () => {
    // Typed sentences and reworded response options become rewrites; a closer option,
    // an Express button, New 4, the marks and steers changed nothing measurable and are
    // dropped (October 6 2026).
    const data = reviewedConversation();
    const [first, second] = reviewModel.buildTurns(data);
    const old = { turns: {
        [first.key]: { answer: { kind: 'card', index: 2, text: 'Busy, but good. How was yours?', rewritten: true }, reframers: [{ kind: 'feeling', id: 'f', label: 'Tired' }] },
        [second.key]: { answer: { kind: 'phrase', itemId: 'x', text: 'Sure' }, steer: 'warmer' },
    } };
    const r = reviewModel.normalizeReview(old, 'c1');
    assert.deepEqual(Object.keys(r.turns), [first.key]);
    assert.equal(r.turns[first.key].answer.kind, 'rewrite');
    const out = harvest([{ id: 'c1', data, review: old }], OPTS);
    assert.deepEqual(out.exemplars, ['Busy, but good. How was yours?']);
    assert.deepEqual(out.steers, [], 'a steer typed in old review is no longer read');
    const typed = reviewModel.normalizeReview({ turns: { [first.key]: { answer: { kind: 'typed', text: 'Mostly slept.' } } } }, 'c1');
    assert.equal(typed.turns[first.key].answer.text, 'Mostly slept.');
});

test('REVIEW: each person keeps their own newest rewrites, at most twelve', () => {
    const convos = [];
    for (let i = 0; i < 15; i++) {
        const data = reviewedConversation({ person: { id: 'p-mom', label: 'Mom' } });
        for (const e of data.exchanges) e.timestamp = e.timestamp.replace('2026-10-01', `2026-09-${String(10 + i).padStart(2, '0')}`);
        const [first] = reviewModel.buildTurns(data);
        convos.push({ id: `c${i}`, data, review: reviewModel.setRewrite(reviewModel.emptyReview(`c${i}`), first, `Rewrite number ${i} for Mom.`) });
    }
    const out = harvest(convos, OPTS);
    assert.equal(out.pairs.length, 12);
    assert.equal(out.pairs[0].text, 'Rewrite number 14 for Mom.', 'newest first');
});

test('REVIEW: removing the lesson leaves a rewrite with no effect at all', () => {
    const data = reviewedConversation();
    const [first] = reviewModel.buildTurns(data);
    const review = reviewModel.setRewrite(reviewModel.emptyReview('c1'), first, 'Friday works, see you at noon.');
    const out = reviewedTurns(data, review, {});
    assert.equal(out.replaced.size, 0);
    assert.deepEqual(out.turns, []);
    assert.deepEqual(out.pairs, []);
});

test('REVIEW: every kind of review answer has a lesson, so none is ignored by accident', () => {
    // The kinds are read out of the review model's own source, so a kind added there
    // is checked here without anyone remembering to list it.
    const src = readFileSync(new URL('../app/js/review-model.js', import.meta.url), 'utf8');
    const kinds = new Set();
    for (const m of src.matchAll(/kind:\s*([^,\n}]+)/g)) {
        for (const q of m[1].matchAll(/'(\w+)'/g)) kinds.add(q[1]);
    }
    assert.deepEqual([...kinds].sort(), ['rewrite'], 'found the answer kinds in review-model.js');
    for (const k of kinds) assert.ok(REVIEW_LESSONS[k], `no lesson for review answer "${k}"`);
});

test('redactCatchphrases removes the user phrase and nothing else (CR-070)', async () => {
    const { redactCatchphrases } = await import('../app/js/voice-harvest.js');
    assert.equal(redactCatchphrases("Let's go! I'll meet you Saturday.", ["Let's go!"]), "I'll meet you Saturday.");
    assert.equal(redactCatchphrases('LETS GO team', ["Let's go"]), 'LETS GO team', 'whole phrase only');
    assert.equal(redactCatchphrases("I said let's go, honestly", ["Let's go!"]), 'I said honestly');
    assert.equal(redactCatchphrases('Thank you so much', ['Yes']), 'Thank you so much');
    assert.equal(redactCatchphrases('Going (home) now', ['(home)']), 'Going now', 'regex characters are escaped');
});

// --- October 6 2026: the fixes from "Conversant AAC Sounds Like Me Evaluation" -----
import { interleave, collectShortReplies } from '../app/js/voice-harvest.js';

const stamped = (turn, label, id = null) => ({ ...turn, partner: { id, label } });

test('a practice conversation is not read at all', () => {
    const practice = { exchanges: [stamped(composed('Can I get a large coffee, please?'), 'Practice: Coffee shop')] };
    const real = { exchanges: [composed('See you at the game on Saturday.')] };
    const out = harvest([practice, real], OPTS);
    assert.deepEqual(out.exemplars, ['See you at the game on Saturday.']);
    assert.equal(out.counts.practiceSkipped, 1);
});

test('review answers and live sentences share the places instead of review taking them all', () => {
    const review = Array.from({ length: 10 }, (_, i) => `Review sentence number ${i}.`);
    const live = Array.from({ length: 10 }, (_, i) => `Live sentence number ${i}.`);
    const out = interleave(review, live, 12);
    assert.equal(out.length, 12);
    assert.equal(out.filter((t) => t.startsWith('Live')).length, 6);
    assert.equal(out[0], review[0], 'a review answer leads each pair');
    assert.deepEqual(interleave(['Only one here.'], live, 4), ['Only one here.', live[0], live[1], live[2]],
        'when one list runs out the other fills the rest');
});

test('the harvest keeps more sentences than it shows, so a removed one is replaced', () => {
    const turns = Array.from({ length: 20 }, (_, i) => composed(`A sentence I typed, number ${i}.`));
    const out = harvest([{ exchanges: turns }], OPTS);
    assert.equal(out.exemplars.length, 20);
});

test('short replies the user typed are kept, newest first', () => {
    const turns = [composed('Nah.'), composed('Sure thing.'), composed('This one is long enough to count.')];
    assert.deepEqual(collectShortReplies(turns, OPTS), ['Sure thing.', 'Nah.']);
    assert.deepEqual(harvest([{ exchanges: turns }], OPTS).shortReplies, ['Sure thing.', 'Nah.']);
});



test('the length lean in a real harvest uses the offered sets of real conversations only', () => {
    // Eight offers give PREFERRED a typical length of 6 words; the user's best-guess
    // picks are 2 words, so the lean is shorter. Practice offers would be ignored.
    const offers = Array.from({ length: 8 }, () => ({ role: 'offer', options: [
        { slot: 'PREFERRED', text: 'Yes, that would be really great.' },
        { slot: 'DISPREFERRED', text: 'I wish I could, but I am busy then.' },
    ] }));
    const picks = Array.from({ length: 8 }, () => slotCard('Sure thing.', 'PREFERRED'));
    const out = harvest([{ exchanges: [...offers, ...picks] }], OPTS);
    assert.equal(out.lengthLean.lean, 'shorter');
});



test('the harvest says which version wrote it', () => {
    assert.equal(harvest([], OPTS).version, 2);
});
