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
import { readFile } from 'node:fs/promises';
import { summarize, formatSummary, summarizePersonalization, cleanupSamples, formatCleanupSamples } from '../app/js/usage-summary.js';

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

/* ── The five untrustworthy figures (Ken, August 21 2026) ─────────────────────
 *
 * Reading one real tester's report turned up five numbers that were wrong or
 * unreadable, four of them the same defect wearing different clothes: a figure
 * computed over a smaller slice of history than the heading above it, with nothing
 * on the page saying so. These lock the fixes in. Left unguarded they would rot
 * silently, because every one of them fails by reading plausibly.
 */

test('the extrapolated "per week" line is gone from the page', () => {
    // It scaled a few days of use up to a whole week and flattered the tester who was
    // drifting away, on the first question the beta exists to answer.
    const s = summarize([conv('a', [partner('2026-08-01T10:00:00Z'), user('2026-08-01T10:00:03Z')])]);
    const text = formatSummary(s);
    assert.ok(!/Per week/.test(text), 'the extrapolation must not be printed');
    assert.match(text, /WEEK BY WEEK/, 'the honest version of the same thing stays');
});

test('a wait recorded as near-zero is discarded, not averaged in', () => {
    const s = summarize([conv('a', [
        // Written before July 2026: both halves saved at the same moment, so the
        // interval between them is an artifact rather than a wait.
        partner('2026-06-01T10:00:00Z'), user('2026-06-01T10:00:00.050Z'),
        partner('2026-06-01T10:01:00Z'), user('2026-06-01T10:01:00.100Z'),
        // Recorded properly.
        partner('2026-08-01T10:00:00Z'), user('2026-08-01T10:00:22Z'),
    ])]);
    assert.equal(s.respondSamples, 1, 'only the honest one is measured');
    assert.equal(s.respondMsMedian, 22000);
    assert.equal(s.respondDiscarded, 2);
    // A large discard count is itself the finding, so it has to reach the page.
    assert.match(formatSummary(s), /Older records skipped\s+2/);
});

test('the wait excludes by time, never by where the reply came from', () => {
    // The other person waits whether the reply was chosen, typed, or tapped - and
    // typing is the slowest of the three. Narrowing to card turns would silently
    // change the number from "how long did they wait" to "how long did we take".
    const s = summarize([conv('a', [
        partner('2026-08-01T10:00:00Z'),
        user('2026-08-01T10:00:30Z', { selectedIndex: -1, source: 'composed' }),
    ])]);
    assert.equal(s.respondSamples, 1, 'a composed reply is still a wait');
    assert.equal(s.respondMsMedian, 30000);
});

test('the two splits print the number of turns they actually cover', () => {
    const s = summarize([conv('a', [
        user('2026-08-01T10:00:00Z', { selectedIndex: 0, source: 'card', selectedSlot: 'PREFERRED' }),
        user('2026-08-01T10:01:00Z', { selectedIndex: -1, source: 'composed' }),
        user('2026-08-01T10:02:00Z'),        // older log: neither source nor slot
        user('2026-08-01T10:03:00Z'),        // older log
    ])]);
    assert.equal(s.userTurns, 4);
    assert.equal(s.sourcesRecorded, 2);
    assert.equal(s.slotsRecorded, 1);
    const text = formatSummary(s);
    // Printed bare, these read as contradicting the total above them. One real
    // report showed 172 against 17 with nothing to say which was wrong. Neither was.
    assert.match(text, /Where the words came from \(of 2 recent turns\)/);
    assert.match(text, /Which kind of reply \(of 1 recent turns\)/);
});

test('the error count says which period it covers', () => {
    // The weekly report carries a DIFFERENT error count - only those since the last
    // report - and the two get read as the same number.
    const s = summarize([conv('a', [partner('2026-08-01T10:00:00Z'), err('2026-08-01T10:00:01Z', 'generate')])]);
    assert.match(formatSummary(s), /Errors since you began\s+1/);
});

/* ── Is the tidy-up earning its round trip? (Ken, August 26 2026) ──────────────
 *
 * Every committed exchange makes a SECOND AI request to rewrite what the recognizer
 * heard. Ken's question was how many of those do more than adjust capitalization and
 * punctuation, because only those needed an AI at all.
 */

const heard = (iso, raw, cleanedText, extra = {}) => ({
    timestamp: at(iso), role: 'partner', rawTranscript: raw, cleanedTranscript: cleanedText, ...extra,
});

test('tidy-up: the three buckets are told apart', () => {
    const s = summarize([conv('a', [
        heard('2026-08-20T10:00:00Z', 'Hello.', 'Hello.'),                       // none
        heard('2026-08-20T10:01:00Z', 'hello there', 'Hello there.'),            // punctuation
        heard('2026-08-20T10:02:00Z', 'i sore him yesterday', 'I saw him yesterday.'), // words
    ])]);
    assert.deepEqual(
        { compared: s.cleanup.compared, none: s.cleanup.none, punctuation: s.cleanup.punctuation, words: s.cleanup.words },
        { compared: 3, none: 1, punctuation: 1, words: 1 });
});

test('tidy-up: adding an apostrophe is PUNCTUATION, not a change of wording', () => {
    // The commonest tidy-up there is. Splitting on the apostrophe would compare
    // "dont" against "don t" and file it under "the wording changed", which would
    // inflate the one bucket the whole measure exists to count.
    const s = summarize([conv('a', [heard('2026-08-20T10:00:00Z', 'i dont think so', "I don't think so.")])]);
    assert.equal(s.cleanup.punctuation, 1);
    assert.equal(s.cleanup.words, 0);
});

test('tidy-up: a turn still in progress is not compared', () => {
    // Written at the partner's first pause, with the cleaned line still empty. It is
    // not a tidy-up that did nothing; there is simply nothing to compare yet.
    const s = summarize([conv('a', [heard('2026-08-20T10:00:00Z', 'half a sentence', '')])]);
    assert.equal(s.cleanup.compared, 0);
});

test('tidy-up: a turn that was never sent is separated from one that changed nothing', () => {
    // ⚠ THE LOAD-BEARING DISTINCTION. An interruption, a pardon and ending the
    // conversation all record what was heard verbatim WITHOUT asking the AI, and
    // afterwards look identical to a call that ran and changed nothing. Counting them
    // together fills the "the call did nothing" bucket with calls never made.
    const s = summarize([conv('a', [
        heard('2026-08-20T10:00:00Z', 'Hello.', 'Hello.', { cleaned: true }),   // asked, no change
        heard('2026-08-20T10:01:00Z', 'wait I', 'wait I', { cleaned: false }),  // never asked
    ])]);
    assert.equal(s.cleanup.none, 2, 'both are unchanged');
    assert.equal(s.cleanup.calls, 1, 'only one of them cost anything');
    assert.equal(s.cleanup.callsRecorded, 2);
});

test('tidy-up: older records say so rather than being counted as unsent', () => {
    // Records written before August 27 2026 carry no flag. Reporting them as "not
    // sent" would be a guess in the flattering direction.
    const s = summarize([conv('a', [heard('2026-08-20T10:00:00Z', 'hello there', 'Hello there.')])]);
    assert.equal(s.cleanup.callsRecorded, 0);
    assert.match(formatSummary(s), /older records do not say which turns were sent/);
});

test('tidy-up: the summary names the base when the flag is present', () => {
    const s = summarize([conv('a', [heard('2026-08-20T10:00:00Z', 'hello there', 'Hello there.', { cleaned: true })])]);
    assert.match(formatSummary(s), /TIDYING UP WHAT WAS HEARD/);
    assert.match(formatSummary(s), /Actually sent to the AI 1 of 1 recent turns/);
});

test('⚠ the summary carries COUNTS ONLY — no wording can ride the weekly report', () => {
    // summarize()'s whole return value is sent verbatim in the weekly report, and the
    // one firm rule is that verbatim speech never leaves the device automatically.
    // The words below are deliberately distinctive so a leak anywhere in the object
    // is caught, however it got there.
    const s = summarize([conv('a', [
        heard('2026-08-20T10:00:00Z', 'zarquon frobnitz', 'Zarquon Frobnitz reticulated.', { cleaned: true }),
        user('2026-08-20T10:00:05Z', { selectedText: 'plugh xyzzy' }),
    ])]);
    const dumped = JSON.stringify(s);
    for (const word of ['zarquon', 'frobnitz', 'reticulated', 'plugh', 'xyzzy']) {
        assert.ok(!dumped.toLowerCase().includes(word), `"${word}" must not appear in the summary`);
    }
});

test('the before-and-after pairs are a SEPARATE call, newest first, and only the rewrites', () => {
    const samples = cleanupSamples([conv('a', [
        heard('2026-08-20T10:00:00Z', 'hello there', 'Hello there.'),                  // punctuation
        heard('2026-08-21T10:00:00Z', 'i sore him', 'I saw him.'),                     // words
        heard('2026-08-22T10:00:00Z', 'we went to the see side', 'We went to the seaside.'),
    ])]);
    assert.equal(samples.length, 2, 'only the turns where the wording changed');
    assert.match(samples[0].before, /see side/, 'newest first');
    assert.equal(samples[1].after, 'I saw him.');
});

test('the sample list is capped and survives a malformed file', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
        heard(`2026-08-${String(i + 1).padStart(2, '0')}T10:00:00Z`, 'i sore him', `I saw him ${i}.`));
    assert.equal(cleanupSamples([conv('a', many)], 5).length, 5);
    assert.deepEqual(cleanupSamples([{ id: 'bad', data: null }, null, { id: 'x', data: { exchanges: 'nope' } }]), []);
});

test('⚠ nothing in weekly-send may reach the sample pairs', async () => {
    // The counts are safe to send and the wordings are not, so the two are separate
    // functions. This asserts the separation still holds at the only place it could
    // be undone by accident: the module that builds the outgoing payload.
    const src = await readFile(new URL('../app/js/weekly-send.js', import.meta.url), 'utf8');
    assert.ok(!src.includes('cleanupSamples'),
        'weekly-send.js must never import or call cleanupSamples — it carries what people said');
});
