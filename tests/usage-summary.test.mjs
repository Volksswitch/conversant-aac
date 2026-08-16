/* Tier 1 — the usage aggregator (app/js/usage-summary.js).
 *
 * Pure module, no DOM and no storage, so it imports directly with no env shim.
 * Covers the three beta questions it exists to answer, plus the tolerance that
 * matters most: these files are written incrementally during live conversations,
 * so a crash mid-flush leaves a partial one, and a summary that throws on a bad
 * record fails exactly when something has gone wrong and you want to look.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, formatSummary, summarizePersonalization } from '../app/js/usage-summary.js';

const at = (iso) => new Date(iso).toISOString();
const partner = (iso, extra = {}) => ({ timestamp: at(iso), role: 'partner', rawTranscript: 'hello', cleanedTranscript: 'Hello.', ...extra });
const user = (iso, extra = {}) => ({ timestamp: at(iso), role: 'user', selectedText: 'Hi.', selectedIndex: 0, allOptions: ['Hi.'], ...extra });
const err = (iso, context) => ({ timestamp: at(iso), role: 'error', context, message: 'boom' });
const conv = (id, exchanges) => ({ id, data: { id, started: exchanges[0] && exchanges[0].timestamp, exchanges } });

test('no logs yields an empty summary and a plain explanation', () => {
    const s = summarize([]);
    assert.equal(s.conversations, 0);
    assert.match(formatSummary(s), /No saved conversations yet/);
    // The likeliest reason a real tester sees nothing is that they never chose a
    // data folder, so the empty state has to say so rather than look like a bug.
    assert.match(formatSummary(s), /data folder/);
});

test('Q1 adoption: conversations, active days and turns', () => {
    const s = summarize([
        conv('a', [partner('2026-08-01T10:00:00Z'), user('2026-08-01T10:00:03Z')]),
        conv('b', [partner('2026-08-01T15:00:00Z'), user('2026-08-01T15:00:04Z')]),
        conv('c', [partner('2026-08-05T09:00:00Z'), user('2026-08-05T09:00:02Z')]),
    ]);
    assert.equal(s.conversations, 3);
    assert.equal(s.activeDays, 2, 'two of the three were the same day');
    assert.equal(s.turns, 6);
    assert.equal(s.userTurns, 3);
    assert.equal(s.partnerTurns, 3);
    assert.equal(s.medianTurnsPerConversation, 2);
});

test('Q2 sufficiency: a card selection and a composed turn are told apart', () => {
    const s = summarize([conv('a', [
        partner('2026-08-01T10:00:00Z'),
        user('2026-08-01T10:00:02Z', { selectedIndex: 0 }),                       // from a card
        partner('2026-08-01T10:00:10Z'),
        user('2026-08-01T10:00:20Z', { selectedIndex: -1, allOptions: [] }),      // typed / fixed phrase
    ])]);
    assert.equal(s.fromCard, 1);
    assert.equal(s.composed, 1);
    assert.equal(s.fromCardPercent, 50);
});

// Position cannot be read back as a category, because the palette's composition
// varies by turn — so the slot is recorded explicitly (app.js, Aug 7 2026). Logs
// written before that have no slot, and must be reported over the subset that does
// rather than silently mixed in.
test('category distribution counts only turns that recorded a slot', () => {
    const s = summarize([conv('a', [
        user('2026-08-01T10:00:00Z', { selectedSlot: 'PREFERRED' }),
        user('2026-08-01T10:01:00Z', { selectedSlot: 'PREFERRED' }),
        user('2026-08-01T10:02:00Z', { selectedSlot: 'REPAIR' }),
        user('2026-08-01T10:03:00Z'),                                  // an older log
    ])]);
    assert.equal(s.slotsRecorded, 3);
    assert.deepEqual(s.slotCounts, { PREFERRED: 2, REPAIR: 1 });
    assert.equal(s.userTurns, 4, 'the older turn still counts as a turn');
});

test('Q3 responsiveness: measured partner-to-user, ignoring user-after-user', () => {
    const s = summarize([conv('a', [
        partner('2026-08-01T10:00:00Z'),
        user('2026-08-01T10:00:03Z'),          // 3s — counted
        user('2026-08-01T10:00:30Z'),          // user holding the floor — NOT a response gap
        partner('2026-08-01T10:01:00Z'),
        user('2026-08-01T10:01:07Z'),          // 7s — counted, and over 4s
    ])]);
    assert.equal(s.respondSamples, 2);
    assert.equal(s.respondMsMedian, 5000);
    assert.equal(s.respondOver4s, 1);
});

test('someone walking away mid-conversation is not a response time', () => {
    const s = summarize([conv('a', [
        partner('2026-08-01T10:00:00Z'),
        user('2026-08-01T11:30:00Z'),          // 90 minutes — excluded, it would wreck the median
    ])]);
    assert.equal(s.respondSamples, 0);
    assert.equal(s.respondMsMedian, null);
});

test('errors are counted, grouped by context, and attributed to conversations', () => {
    const s = summarize([
        conv('a', [partner('2026-08-01T10:00:00Z'), err('2026-08-01T10:00:01Z', 'generate'), err('2026-08-01T10:00:05Z', 'generate')]),
        conv('b', [partner('2026-08-02T10:00:00Z'), err('2026-08-02T10:00:01Z', 'cleanup')]),
        conv('c', [partner('2026-08-03T10:00:00Z'), user('2026-08-03T10:00:02Z')]),
    ]);
    assert.equal(s.errors, 3);
    assert.equal(s.conversationsWithErrors, 2);
    assert.deepEqual(s.errorContexts, { generate: 2, cleanup: 1 });
    // An error entry is not a turn — it must not inflate the conversation length.
    assert.equal(s.turns, 4);
});

test('practice conversations are counted separately, not dropped', () => {
    const s = summarize([
        conv('a', [partner('2026-08-01T10:00:00Z', { partner: { id: null, label: 'Practice: At the doctor' } })]),
        conv('b', [partner('2026-08-02T10:00:00Z', { partner: { id: 'p1', label: 'Mom' } })]),
    ]);
    assert.equal(s.conversations, 2);
    assert.equal(s.practiceConversations, 1, 'rehearsal is engagement, but is not real use');
});

test('a conversation started with nothing said is visible, not invisible', () => {
    // The clearest early-quit signal there is: they opened it and said nothing.
    const s = summarize([conv('a', [])]);
    assert.equal(s.conversations, 1);
    assert.equal(s.emptyConversations, 1);
});

// The load-bearing one. A partial or corrupt log must degrade the summary, never
// break it — it runs when things have already gone wrong.
test('malformed logs are survived rather than thrown on', () => {
    const s = summarize([
        null,
        { id: 'x' },                                        // no data
        { id: 'y', data: {} },                              // no exchanges
        { id: 'z', data: { exchanges: 'not an array' } },
        { id: 'w', data: { exchanges: [null, { role: 'user' }, { timestamp: 'nonsense', role: 'partner' }] } },
        conv('ok', [partner('2026-08-01T10:00:00Z'), user('2026-08-01T10:00:02Z')]),
    ]);
    assert.equal(s.conversations, 2, 'only the two records with an exchanges array count');
    assert.equal(s.userTurns, 2, 'the role:user entry with no timestamp still counts as a turn');
    assert.ok(formatSummary(s).length > 0);
});

test('formatSummary names the question each number answers', () => {
    const text = formatSummary(summarize([conv('a', [partner('2026-08-01T10:00:00Z'), user('2026-08-01T10:00:02Z')])]));
    for (const heading of ['HOW MUCH IT IS BEING USED', 'HOW OFTEN A SUGGESTION FITTED', 'HOW LONG THE OTHER PERSON WAITED', 'PROBLEMS']) {
        assert.ok(text.includes(heading), `missing section: ${heading}`);
    }
});

/* ── Added August 16 2026: the trajectory, and the eight aggregations ─────────
 * Every field these cover was already being written into the conversation files
 * and read by nothing, so they test whether the READING is right — there is no new
 * capture behind any of them. */

test('the retention curve is bucketed from the tester\'s own first day', () => {
    const s = summarize([
        conv('a', [partner('2026-08-01T10:00:00Z'), user('2026-08-01T10:00:03Z')]),
        conv('b', [partner('2026-08-03T10:00:00Z'), user('2026-08-03T10:00:03Z')]),
        // Week 3 — nothing at all in week 2.
        conv('c', [partner('2026-08-16T10:00:00Z'), user('2026-08-16T10:00:03Z')]),
    ]);
    assert.equal(s.weeks.length, 3);
    assert.equal(s.weeks[0].week, 1);
    assert.equal(s.weeks[0].conversations, 2);
    // THE EMPTY WEEK IS THE POINT. A tester quietly stopping IS a gap, so dropping
    // empty rows would close it up and hide the very thing being looked for.
    assert.equal(s.weeks[1].conversations, 0);
    assert.equal(s.weeks[2].conversations, 1);
});

test('a falling week shows in the curve where the cumulative figure hides it', () => {
    const many = [];
    for (let i = 1; i <= 5; i++) {
        many.push(conv(`w1-${i}`, [partner(`2026-08-0${i}T10:00:00Z`), user(`2026-08-0${i}T10:00:03Z`)]));
    }
    many.push(conv('w3', [partner('2026-08-16T10:00:00Z'), user('2026-08-16T10:00:03Z')]));
    const s = summarize(many);
    assert.ok(s.weeks[0].conversations > s.weeks[2].conversations, 'the drop is visible');
    // The cumulative figure stays healthy across the same data, which is exactly why
    // the curve had to be computed here rather than inferred at the far end.
    assert.ok(s.conversationsPerActiveWeek >= 1);
});

test('where the words came from is split three ways, not two', () => {
    const s = summarize([conv('a', [
        user('2026-08-01T10:00:00Z', { selectedIndex: 0, source: 'card' }),
        user('2026-08-01T10:01:00Z', { selectedIndex: -1, source: 'composed' }),
        user('2026-08-01T10:02:00Z', { selectedIndex: -1, source: 'express' }),
        user('2026-08-01T10:03:00Z', { selectedIndex: -1, source: 'control' }),
    ])]);
    // The card-vs-not split calls three different behaviors one thing: typing a
    // sentence is the user's own prose, an Express button is their idiom, and a
    // control phrase is OURS and no evidence of their voice at all.
    assert.equal(s.composed, 3);
    assert.equal(s.sourceCounts.composed, 1);
    assert.equal(s.sourceCounts.express, 1);
    assert.equal(s.sourceCounts.control, 1);
});

test('a partner seen in more than one conversation counts as returning', () => {
    const mum = { id: 'p1', label: 'Mum' };
    const s = summarize([
        conv('a', [partner('2026-08-01T10:00:00Z', { partner: mum }), user('2026-08-01T10:00:03Z', { partner: mum })]),
        conv('b', [partner('2026-08-03T10:00:00Z', { partner: mum }), user('2026-08-03T10:00:03Z', { partner: mum })]),
        conv('c', [partner('2026-08-04T10:00:00Z', { partner: { id: 'p2', label: 'Sam' } })]),
    ]);
    assert.equal(s.partners.length, 2);
    assert.equal(s.returningPartners, 1, 'Mum came back; Sam did not');
    assert.equal(s.partners.find(p => p.label === 'Mum').conversations, 2);
});

test('the practice partner is never counted as a returning person', () => {
    const rehearsal = { id: null, label: 'Practice: At the doctor' };
    const s = summarize([
        conv('a', [partner('2026-08-01T10:00:00Z', { partner: rehearsal }), user('2026-08-01T10:00:03Z', { partner: rehearsal })]),
        conv('b', [partner('2026-08-02T10:00:00Z', { partner: rehearsal }), user('2026-08-02T10:00:03Z', { partner: rehearsal })]),
    ]);
    assert.equal(s.partners.length, 0);
    assert.equal(s.returningPartners, 0);
    assert.equal(s.practiceConversations, 2);
});

test('a silent voice fallback is countable — it changes the voice they speak in', () => {
    const s = summarize([conv('a', [
        user('2026-08-01T10:00:00Z', { tts: { provider: 'deepgram', voice: 'aura-2-thalia-en' } }),
        user('2026-08-01T10:01:00Z', { tts: { provider: 'browser', voice: 'Samantha', fellBack: true } }),
    ])]);
    assert.equal(s.voiceByProvider.deepgram, 1);
    assert.equal(s.voiceFellBack, 1, 'the one sentence that came out in the wrong voice');
});

test('every number can be read separately for each recognizer', () => {
    const s = summarize([conv('a', [
        partner('2026-08-01T10:00:00Z', { stt: 'browser' }),
        user('2026-08-01T10:00:02Z'),
        partner('2026-08-01T10:01:00Z', { stt: 'deepgram' }),
        user('2026-08-01T10:01:06Z'),
    ])]);
    assert.equal(s.byRecognizer.browser.partnerTurns, 1);
    assert.equal(s.byRecognizer.browser.respondMsMedian, 2000);
    assert.equal(s.byRecognizer.deepgram.respondMsMedian, 6000);
});

test('reading load is set against how much there was to read', () => {
    const s = summarize([conv('a', [
        partner('2026-08-01T10:00:00Z'),
        user('2026-08-01T10:00:05Z', {
            selectedIndex: 1, decideMs: 3200,
            allOptions: ['Yes, that sounds good.', 'I would rather not.', 'What about Friday?', 'Sorry, what?'],
        }),
    ])]);
    assert.equal(s.decideMsMedian, 3200);
    assert.equal(s.decideSamples, 1);
    assert.equal(s.cardsPerPaletteMedian, 4);
    assert.equal(s.optionWordsMedian, 4);
    // The wait holds the machine as well; the decide time does not. Both are reported
    // because the difference between them is the whole point of recording the second.
    assert.equal(s.respondMsMedian, 5000);
});

test('an absurd decide time is discarded rather than wrecking the median', () => {
    const s = summarize([conv('a', [
        user('2026-08-01T10:00:00Z', { selectedIndex: 0, decideMs: 4000 }),
        user('2026-08-01T11:00:00Z', { selectedIndex: 0, decideMs: 45 * 60 * 1000 }),
    ])]);
    assert.equal(s.decideSamples, 1, 'someone who walked away is not a reading time');
    assert.equal(s.decideMsMedian, 4000);
});

test('personalization counts only what the user made theirs', () => {
    const p = summarizePersonalization({
        worldviewAnswered: 12, worldviewTotal: 48,
        people: 3, places: 2, expressEdited: 5, expressTotal: 32,
        controlPhrasesEdited: 1, soundCheckAnswered: 8, settingsProfiles: 1,
    });
    assert.equal(p.worldviewPercent, 25);
    assert.equal(p.expressEdited, 5);
    // Nothing filled in is a valid state and must not divide by zero.
    assert.equal(summarizePersonalization({}).worldviewPercent, null);
});

test('formatSummary prints the curve, and holds up with nothing extra to show', () => {
    const s = summarize([conv('a', [partner('2026-08-01T10:00:00Z'), user('2026-08-01T10:00:03Z')])]);
    const text = formatSummary(s);
    assert.match(text, /WEEK BY WEEK/);
    assert.doesNotMatch(text, /undefined/);
    const withDepth = formatSummary(s, summarizePersonalization({ worldviewAnswered: 1, worldviewTotal: 4 }));
    assert.match(withDepth, /MADE IT YOURS/);
});
