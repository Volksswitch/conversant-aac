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

/* ── How well did it hear them? (Ken, August 27 2026) ──────────────────────────
 *
 * The tidy-up pass was removed; the suggestions request now names the words it
 * suspects were misheard, and those are recorded on the turn. This is a rough read on
 * recognition quality, readable per person and per place.
 */

const heard = (iso, raw, extra = {}) => ({
    timestamp: at(iso), role: 'partner', rawTranscript: raw, cleanedTranscript: raw, ...extra,
});

test('hearing: turns carrying a doubted word are counted, as turns and as words', () => {
    const s = summarize([conv('a', [
        heard('2026-08-27T10:00:00Z', 'i can make it on saturday', { uncertain: ['can'] }),
        heard('2026-08-27T10:01:00Z', 'that sounds good to me', { uncertain: [] }),
        heard('2026-08-27T10:02:00Z', 'see you at four', { uncertain: [] }),
        heard('2026-08-27T10:03:00Z', 'ill bring the tuesday papers', { uncertain: ['tuesday'] }),
    ])]);
    assert.equal(s.hearing.turns, 4);
    assert.equal(s.hearing.flagged, 2);
    assert.equal(s.hearing.flaggedWords, 2);
    assert.equal(s.hearing.words, 6 + 5 + 4 + 5);
    assert.match(formatSummary(s), /With a doubtful word    2  \(50%\)/);
});

test('hearing: a turn recorded before this existed is not counted as clean', () => {
    // ⚠ Silently treating a turn with no field as "nothing doubted" would report a
    // whole history of older conversations as perfectly heard.
    const s = summarize([conv('a', [
        heard('2026-08-27T10:00:00Z', 'no field here'),
        heard('2026-08-27T10:01:00Z', 'this one has one', { uncertain: [] }),
    ])]);
    assert.equal(s.hearing.recorded, 1);
    assert.equal(s.hearing.turns, 1);
});

test('hearing: read per person and per place, worst first', () => {
    const withWho = (iso, raw, who, where, unc) =>
        heard(iso, raw, { uncertain: unc, partner: { label: who }, place: { label: where } });
    const s = summarize([conv('a', [
        withWho('2026-08-27T10:00:00Z', 'one two three', 'Mom', 'The cafe', ['two']),
        withWho('2026-08-27T10:01:00Z', 'four five six', 'Mom', 'The cafe', ['five']),
        withWho('2026-08-27T10:02:00Z', 'seven eight nine', 'Mom', 'The cafe', ['eight']),
        withWho('2026-08-27T10:03:00Z', 'ten eleven twelve', 'Devon', 'Home', []),
        withWho('2026-08-27T10:04:00Z', 'a b c', 'Devon', 'Home', []),
        withWho('2026-08-27T10:05:00Z', 'd e f', 'Devon', 'Home', []),
    ])]);
    assert.equal(s.hearingByPartner.Mom.flagged, 3);
    assert.equal(s.hearingByPartner.Devon.flagged, 0);
    assert.equal(s.hearingByPlace['The cafe'].flagged, 3);
    const text = formatSummary(s);
    assert.match(text, /By who they were with:/);
    assert.match(text, /Where they were:/);
    // Worst first — the point of the breakdown is to find the setting going badly.
    assert.ok(text.indexOf('The cafe') < text.indexOf('Home'), 'the worse place is listed first');
});

test('hearing: a setting with too few turns is left out rather than shown at 100%', () => {
    const s = summarize([conv('a', [
        heard('2026-08-27T10:00:00Z', 'one bad turn', { uncertain: ['bad'], partner: { label: 'Stranger' } }),
    ])]);
    assert.equal(s.hearingByPartner.Stranger.turns, 1, 'still counted in the data');
    // Scoped to the hearing breakdown: the name legitimately appears elsewhere in the
    // summary, under the people section.
    assert.ok(!/By who they were with:/.test(formatSummary(s)),
        'the breakdown is omitted entirely — 1 of 1 reads as 100% and says nothing');
});

test('hearing: the report says out loud that it is a floor', () => {
    const s = summarize([conv('a', [heard('2026-08-27T10:00:00Z', 'hello there', { uncertain: [] })])]);
    // ⚠ The measure is blind to any mishearing that leaves an ordinary sentence, which
    // is the class that matters most. Printed as an absolute it would be believed.
    assert.match(formatSummary(s), /Treat this as a floor/);
});

test('⚠ the summary carries COUNTS ONLY — no doubted word can ride the weekly report', () => {
    // A doubted word IS a word the partner said, and summarize()'s whole return value
    // is sent verbatim in the weekly report.
    const s = summarize([conv('a', [
        heard('2026-08-27T10:00:00Z', 'zarquon frobnitz reticulated', { uncertain: ['frobnitz'] }),
        user('2026-08-27T10:00:05Z', { selectedText: 'plugh xyzzy' }),
    ])]);
    const dumped = JSON.stringify(s).toLowerCase();
    for (const w of ['zarquon', 'frobnitz', 'reticulated', 'plugh', 'xyzzy']) {
        assert.ok(!dumped.includes(w), `"${w}" must not appear in the summary`);
    }
});
