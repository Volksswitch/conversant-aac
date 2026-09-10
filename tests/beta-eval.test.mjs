/* Tier 1 - reading the beta reports Sheet (scripts/beta-eval/).
 *
 * Pure modules, no network and no Sheet: they take exported text and give back
 * findings. The cases here are the ones that fail by producing a plausible number
 * rather than an error, which is the only kind worth a test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, readReports, byInstall, gatherErrors, classifyTester, versionAtLeast } from '../scripts/beta-eval/load.mjs';
import { tally, addTallies, ratios, groupBy, dimensionsOf, keyboardOf, generationMs, decideMs, spread,
         silentTesters, errorRollup } from '../scripts/beta-eval/aggregate.mjs';
import { render } from '../scripts/beta-eval/render.mjs';

const cell = (o) => '"' + JSON.stringify(o).replace(/"/g, '""') + '"';
const csvOf = (payloads) => 'received,sent,tester,raw\n'
    + payloads.map(p => `2026-08-20,${p.sentAt},${p.testerName || ''},${cell(p)}`).join('\n') + '\n';
const report = (o) => ({
    sentAt: '2026-08-10T00:00:00Z', testerName: 'Amy', installId: 'i1', appVersion: '0.7.12',
    usage: { conversations: 10, userTurns: 100, fromCard: 50, respondSamples: 90, respondOver4s: 40 },
    weeks: [], events: { totals: {} }, errors: [], ...o,
});

test('a report survives being carried through a spreadsheet cell', () => {
    // The payload column is JSON: commas, quotes and the odd newline, all of which a
    // naive split on commas would tear apart without complaining.
    const p = report({ note: 'he said "hello, there"\nand then stopped' });
    const { reports } = readReports(parseCsv(csvOf([p])));
    assert.equal(reports.length, 1);
    assert.equal(reports[0].note, 'he said "hello, there"\nand then stopped');
});

test('a problem report is kept apart from a weekly one', () => {
    const { reports, problems } = readReports(parseCsv(csvOf([
        report({}), report({ kind: 'problem', note: 'the cards keep changing' }),
    ])));
    assert.equal(reports.length, 1);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].note, 'the cards keep changing');
});

test('the problems tab is read, though it carries no payload column', () => {
    // (!) THE BUG THIS EXISTS FOR, and the reason the case above it did not catch it:
    // that one fabricates a JSON payload carrying kind:'problem', and the real problems
    // tab has no payload column at all - the receiving script writes it as flat text
    // (PROBLEM_HEADER in scripts/weekly-report-endpoint.gs). So every problem report
    // ever sent was dropped without a word, and the reading printed "No problem
    // reports" with four of them sitting in the file. This case uses the shape the
    // Sheet actually exports, which is the only shape that proves anything.
    const csv = [
        'received,sent,tester,install,version,build,what happened (their words),full report',
        '8/24/2026 7:06,2026-08-24T12:06:18Z,SLP3,i9,0.7.16,ac0ff75,'
            + '"Still adding placeholder phrases to the partner messages",'
            + '"CONVERSANT AAC - PROBLEM REPORT',
        'Version: 0.7.16"',
        '',
    ].join('\n');
    const { reports, problems, skipped } = readReports(parseCsv(csv));
    assert.equal(reports.length, 0);
    assert.equal(problems.length, 1);
    assert.equal(skipped, 0, 'a readable row must not be counted as lost');
    assert.equal(problems[0].testerName, 'SLP3');
    assert.equal(problems[0].appVersion, '0.7.16');
    assert.match(problems[0].note, /placeholder phrases/);
    // The renderer prints what the tester wrote, so it has to survive all the way there.
    const text = render({ testers: [], excluded: [], unnamed: [], problems, broken: [] });
    assert.match(text, /placeholder phrases/);
});

test('a row nothing can be made of is counted, never passed over in silence', () => {
    // The failure was not that a row was unreadable. It was that being unreadable
    // looked exactly the same as there being nothing to read.
    // The realistic shape of it: a reports-tab export that left out the last column,
    // which is the one carrying the report. Everything looks present and nothing is.
    const csv = 'received,sent,tester,version\n8/24/2026,2026-08-24T12:06:18Z,SLP3,0.7.16\n';
    const { reports, problems, skipped } = readReports(parseCsv(csv));
    assert.equal(reports.length, 0);
    assert.equal(problems.length, 0);
    assert.equal(skipped, 1);
});

test('the problems columns are found by name, so reordering them is safe', () => {
    const csv = 'received,sent,what happened (their words),tester,version\n'
        + '8/30/2026,2026-08-30T19:17:02Z,saw a pink background,(not set),0.8.5\n';
    const { problems, skipped } = readReports(parseCsv(csv));
    assert.equal(skipped, 0);
    assert.equal(problems[0].note, 'saw a pink background');
    assert.equal(problems[0].appVersion, '0.8.5');
});

test('several reports from one device are not added together', () => {
    // Every report re-counts the whole history, so a tester with three reports has
    // not had three times as many conversations. The newest one wins.
    const rows = [
        report({ sentAt: '2026-08-01T00:00:00Z', usage: { conversations: 4, userTurns: 40 } }),
        report({ sentAt: '2026-08-08T00:00:00Z', usage: { conversations: 9, userTurns: 90 } }),
        report({ sentAt: '2026-08-15T00:00:00Z', usage: { conversations: 13, userTurns: 130 } }),
    ];
    const [t] = byInstall(readReports(parseCsv(csvOf(rows))).reports);
    assert.equal(t.reports, 3);
    assert.equal(t.usage.conversations, 13, 'the newest report is the whole story');
    assert.equal(t.lastSentAt, '2026-08-15T00:00:00Z');
});

test('errors ARE gathered across reports, and the version boundary is not double counted', () => {
    // Since 0.7.11 a report carries only what is new. Before that it carried
    // everything, and the first report after upgrading still carries the backlog - so
    // concatenating reports counts the same error twice and reports a tester as
    // having far more trouble than they do.
    const e1 = { ts: '2026-08-01T10:00:00Z', context: 'generate', message: 'boom' };
    const e2 = { ts: '2026-08-05T10:00:00Z', context: 'cleanup', message: 'bang' };
    const gathered = gatherErrors([
        { appVersion: '0.7.10', errors: [e1] },
        { appVersion: '0.7.11', errors: [e1, e2] },   // the backlog arrives again
        { appVersion: '0.7.12', errors: [] },
    ]);
    assert.equal(gathered.length, 2);
    assert.deepEqual(gathered.map(e => e.context), ['generate', 'cleanup']);
});

test('your own devices and unnamed reports are set aside, not counted', () => {
    assert.equal(classifyTester('Ken Surface'), 'excluded');
    assert.equal(classifyTester('ken ipad'), 'excluded');
    assert.equal(classifyTester('Amy'), 'tester');
    // An unnamed report is its own case: probably a therapist, possibly a tester who
    // never typed their name, and silently binning it turns them into someone who
    // appears to have stopped.
    assert.equal(classifyTester('(not set)'), 'unnamed');
    assert.equal(classifyTester(''), 'unnamed');
});

test('the pooled figures are ratios of sums, which is what makes them poolable', () => {
    const a = { usage: { userTurns: 100, fromCard: 60, respondSamples: 80, respondOver4s: 20 }, events: { totals: {} } };
    const b = { usage: { userTurns: 300, fromCard: 60, respondSamples: 200, respondOver4s: 100 }, events: { totals: {} } };
    const r = ratios(addTallies([a, b].map(tally)));
    // 120 of 400, not the average of 60% and 20%. Averaging the two testers would
    // have said 40% and given the lighter user equal weight with the heavier one.
    assert.equal(Math.round(r.sufficiency * 100), 30);
    assert.equal(Math.round(r.overFour * 100), 43);
});

test('a setup is described from the system information, and unknown is a real answer', () => {
    const d = (info) => dimensionsOf({ systemInfo: info });
    assert.equal(d({ platform: { summary: 'iPadOS Safari', standalone: true }, speech: {} }).platform, 'iPad, installed');
    assert.equal(d({ platform: { summary: 'iPadOS Safari', standalone: false }, speech: {} }).platform, 'iPad, browser tab');
    assert.equal(d({ platform: { summary: 'Chromium on Windows' }, speech: {} }).platform, 'computer');
    // System information is only sent when it changes, so a device that has reported
    // for months can have none attached to its latest report.
    assert.equal(dimensionsOf({}).platform, 'unknown');
    assert.equal(dimensionsOf({}).hearing, 'unknown');
});

test('setups are pooled across turns, and each group says how many people it is', () => {
    const mk = (name, stt, turns, card) => ({
        name, usage: { userTurns: turns, fromCard: card }, events: { totals: {} },
        systemInfo: { platform: { summary: 'Chromium' }, speech: { sttProvider: stt } },
    });
    const groups = groupBy([mk('Amy', 'browser', 100, 50), mk('Bo', 'browser', 100, 70), mk('Cy', 'deepgram', 200, 40)],
        t => dimensionsOf(t).hearing);
    const browser = groups.find(g => g.key === 'browser');
    assert.equal(browser.totals.testers, 2);
    assert.equal(browser.totals.userTurns, 200);
    assert.equal(Math.round(browser.ratios.sufficiency * 100), 60);
});

test('a tester nobody has heard from is flagged, without guessing why', () => {
    const asOf = Date.parse('2026-08-21T00:00:00Z');
    const quiet = silentTesters([
        { name: 'Amy', install: 'i1', lastSentAt: '2026-08-19T00:00:00Z' },
        { name: 'Rosa', install: 'i2', lastSentAt: '2026-08-01T00:00:00Z' },
    ], asOf);
    assert.equal(quiet.length, 1);
    assert.equal(quiet[0].name, 'Rosa');
    assert.equal(quiet[0].quietDays, 20);
});

test('errors group by what went wrong, so a shared fault is separable from one setup', () => {
    const groups = errorRollup([
        { name: 'Amy', errors: [{ ts: '2026-08-01T00:00:00Z', context: 'generate', message: '429' }] },
        { name: 'Bo', errors: [{ ts: '2026-08-05T00:00:00Z', context: 'generate', message: '429' }] },
        { name: 'Cy', errors: [{ ts: '2026-08-03T00:00:00Z', context: 'deepgram-stt', message: 'socket' }] },
    ]);
    assert.equal(groups[0].context, 'generate', 'newest first');
    assert.equal(groups[0].testers.length, 2, 'two people, so more likely the app than a setup');
    assert.equal(groups.find(g => g.context === 'deepgram-stt').testers.length, 1);
});

const shell = (o) => ({
    name: 'Amy', install: 'i1', kind: 'tester', appVersion: '0.7.12',
    lastSentAt: new Date().toISOString(), reports: 1, weeks: [],
    events: { totals: {} }, errors: [], personalization: {}, systemInfo: null, ...o,
});

test('the reading never names a conversation partner or a place', () => {
    // Those people never agreed to anything and cannot be asked. The rule is kept by
    // never reading the field, so this guards the construction rather than a filter.
    const t = shell({
        usage: {
            conversations: 5, userTurns: 50, fromCard: 30, respondSamples: 40, respondOver4s: 10,
            partners: [{ label: 'Doctor Ferndale', conversations: 3, weeks: 2 }],
            influencers: { distinctPlaces: 2 },
        },
    });
    const text = render({ testers: [t], excluded: [], unnamed: [], problems: [], broken: [] });
    assert.ok(!text.includes('Doctor Ferndale'), 'a partner name must never reach the page');
    assert.match(text, /Amy/, 'the tester is named, because the point is knowing who to talk to');
});

test('the reading ends in questions rather than conclusions', () => {
    const t = shell({
        usage: { conversations: 5, userTurns: 50, fromCard: 30, respondSamples: 40, respondOver4s: 30 },
        events: { totals: { palette_shown: 100, palette_abandoned: 60 } },
    });
    const text = render({ testers: [t], excluded: [], unnamed: [], problems: [], broken: [] });
    assert.match(text, /WORTH ASKING/);
    assert.match(text, /shown and ignored/, 'the early warning that moves first');
    // And it must say out loud what none of this can settle.
    assert.match(text, /cannot be confirmed or ruled out/);
});

test('version comparison is by number, not by text', () => {
    assert.equal(versionAtLeast('0.7.12', '0.7.11'), true);
    assert.equal(versionAtLeast('0.7.9', '0.7.11'), false, '9 is not later than 11');
    assert.equal(versionAtLeast('0.8.0', '0.7.11'), true);
});

test('which keyboard they type on: an absent setting is physical, a missing block is unknown', () => {
    // The distinction is the whole subtlety. loadKeyboardMode returns physical for
    // anything that is not exactly 'onscreen', so a tester who never opened that
    // setting IS a physical-keyboard user - and that is most people. Counting them as
    // unknown would leave the question unanswered for the majority case.
    assert.equal(keyboardOf({ settings: {} }), 'physical');
    assert.equal(keyboardOf({ settings: { keyboardMode: 'physical' } }), 'physical');
    assert.equal(keyboardOf({ settings: { keyboardMode: 'onscreen' } }), 'on-screen');
    // Genuinely unknown: system information is only sent when it changes, so a device
    // can report for months with no settings block attached at all.
    assert.equal(keyboardOf(null), 'unknown');
    assert.equal(keyboardOf({}), 'unknown');
    assert.equal(dimensionsOf({}).keyboard, 'unknown');
});

test('the two halves of the wait are read out of the report, each from its own source', () => {
    const t = {
        usage: { decideMsMedian: 7800, decideSamples: 40 },
        events: { timings: { 'generation.ms': { n: 120, median: 4200, max: 9000 } }, totals: {} },
    };
    assert.equal(generationMs(t), 4200);
    assert.equal(decideMs(t), 7800);
    // Both were shipped in every report and read by nothing, so absent must read as
    // absent rather than as zero - a zero would print as an impossibly fast app.
    assert.equal(generationMs({ usage: {}, events: { totals: {} } }), null);
    assert.equal(decideMs({ usage: {}, events: { totals: {} } }), null);
    assert.equal(generationMs({}), null);
    assert.equal(decideMs({}), null);
});

test('the medians are ranged and the sample counts behind them are summed', () => {
    const mk = (gen, genN, dec, decN) => ({
        usage: { decideMsMedian: dec, decideSamples: decN },
        events: { timings: { 'generation.ms': { n: genN, median: gen } }, totals: {} },
    });
    const testers = [mk(3000, 100, 5000, 30), mk(6000, 50, 9000, 20)];
    const totals = addTallies(testers.map(tally));
    // Counts pool; medians do not, so they are reported as a range instead.
    assert.equal(totals.genSamples, 150);
    assert.equal(totals.decideSamples, 50);
    const gen = spread(testers, generationMs);
    assert.deepEqual([gen.low, gen.high, gen.n], [3000, 6000, 2]);
});

test('the wait section prints both halves and refuses to present them as a split', () => {
    const t = shell({
        usage: { conversations: 5, userTurns: 50, fromCard: 30, respondSamples: 40, respondOver4s: 10,
                 decideMsMedian: 7800, decideSamples: 40 },
        events: { timings: { 'generation.ms': { n: 120, median: 4200 } }, totals: {} },
    });
    const text = render({ testers: [t], excluded: [], unnamed: [], problems: [], broken: [] });
    assert.match(text, /WHERE THE WAIT GOES/);
    assert.match(text, /Asking the AI, to suggestions\s+4\.2s/);
    assert.match(text, /Reading them and choosing one\s+7\.8s/);
    assert.match(text, /120 request\(s\)/);
    assert.match(text, /40 turn\(s\)/);
    // The load-bearing warning: 4.2 + 7.8 is not the wait. The two sit on different
    // denominators, and a reader who adds them optimizes whichever half looks bigger.
    assert.match(text, /do not add up to the whole wait/);
    assert.match(text, /only for turns where a card was actually taken/);
    // And that the second figure cannot be split into reading versus choosing.
    assert.match(text, /nothing in between/);
});

test('nothing reported is said to be nothing reported, never a fast app', () => {
    const t = shell({ usage: { conversations: 5, userTurns: 50, fromCard: 30 }, events: { totals: {} } });
    const text = render({ testers: [t], excluded: [], unnamed: [], problems: [], broken: [] });
    assert.match(text, /not reported yet/);
    // Silence must not read as speed: an empty timing means nobody has reported one.
    assert.match(text, /not that the app/);
    assert.match(text, /is fast/);
});

test('the keyboard split appears as a setup, so it says how many people and how they fared', () => {
    const mk = (name, mode, turns, card) => ({
        name, usage: { userTurns: turns, fromCard: card }, events: { totals: {} },
        systemInfo: { platform: { summary: 'Chromium' }, speech: {}, settings: { keyboardMode: mode } },
    });
    const testers = [mk('Amy', 'onscreen', 100, 50), mk('Bo', 'physical', 100, 70), mk('Cy', 'physical', 200, 40)];
    const groups = groupBy(testers, t => dimensionsOf(t).keyboard);
    const onscreen = groups.find(g => g.key === 'on-screen');
    const physical = groups.find(g => g.key === 'physical');
    assert.equal(onscreen.totals.testers, 1);
    assert.equal(physical.totals.testers, 2);
    assert.equal(physical.totals.userTurns, 300);
    const text = render({ testers: testers.map(t => shell(t)), excluded: [], unnamed: [], problems: [], broken: [] });
    assert.match(text, /Keyboard they type on/);
    assert.match(text, /on-screen/);
});

test('the timing keys are the ones the app actually emits', () => {
    // metrics.tally buckets a duration under `<event>.<field>`, so the stat is
    // 'generation.ms' and not 'generation'. The obvious name reads as no data at all
    // and would have printed "not reported yet" for ever. Verified against a real
    // snapshot from the running app; pinned here so it cannot drift back.
    assert.equal(generationMs({ events: { timings: { 'generation.ms': { median: 4200 } } } }), 4200);
    assert.equal(generationMs({ events: { timings: { generation: { median: 4200 } } } }), null);
    // Reading and choosing prefers the conversation logs, so that it is measured over
    // the same turns as the four-second figure it sits beside.
    assert.equal(decideMs({ usage: { decideMsMedian: 5000 },
        events: { timings: { 'card_selected.decideMs': { median: 9000 } } } }), 5000);
    assert.equal(decideMs({ events: { timings: { 'card_selected.decideMs': { median: 9000 } } } }), 9000);
});

test('the "older build" caveat fires on an old version and not on a current one', () => {
    // It used to be a regex pinned to 0.7.x, so every version from 0.8 onward tripped
    // it and the caveat showed for everybody. A caveat that is always on is one people
    // learn to scroll past, which costs the reader the one time it matters.
    const mk = (v) => shell({ appVersion: v, usage: { conversations: 5, userTurns: 50, fromCard: 30 } });
    const of = (v) => render({ testers: [mk(v)], excluded: [], unnamed: [], problems: [], broken: [] });
    assert.ok(!of('0.10.18').includes('Still on an older build'), 'a current build is not stale');
    assert.ok(!of('0.8.0').includes('Still on an older build'), '0.8 is newer than 0.7.11, not older');
    assert.ok(of('0.7.10').includes('Still on an older build'), 'a genuinely older build is flagged');
    assert.ok(of('0.6.5').includes('Still on an older build'));
});
