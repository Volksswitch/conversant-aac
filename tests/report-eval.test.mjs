/* Tests for the problem-report evaluator.
 *
 * The fixture is SYNTHETIC on purpose. A real tester's report carries their own
 * words, their device, their settings and their usage pattern, and none of that
 * belongs in a public repository — so the fixture is written to exercise every
 * check rather than copied from anything that arrived.
 *
 * ⚠ THE MOST IMPORTANT TESTS HERE ARE THE TOLERANCE ONES. A report shows up
 * exactly when something has gone wrong for someone, often from a build we no
 * longer have; a parser that throws on a truncated or older file is useless at
 * the only moment it matters. So empty, partial and garbage input all have to
 * come back with whatever they do contain and no exception.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseReport, parseEvents, parseSystemInfo } from '../scripts/report-eval/parse.mjs';
import { analyze, summarizeEvents } from '../scripts/report-eval/analyze.mjs';
import { renderAnalysis, renderIndex } from '../scripts/report-eval/render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixtures', 'problem-report-sample.txt');
const text = await readFile(FIXTURE, 'utf8');

const titles = (a) => a.findings.map(f => f.title);
const has = (a, fragment) => titles(a).some(t => t.includes(fragment));
const find = (a, fragment) => a.findings.find(f => f.title.includes(fragment));

test('parses the header, the note and the usage figures', () => {
    const r = parseReport(text, { filename: 'sample.txt' });
    assert.equal(r.appVersion, '0.7.8');
    assert.equal(r.build, 'abc1234');
    assert.equal(r.note, 'The cards changed while I was reaching for one.');
    assert.equal(r.usage.conversations, 12);
    assert.equal(r.usage.practice, 2);
    assert.equal(r.usage.activeDays, 4);
    assert.equal(r.usage.spanDays, 30);
    assert.equal(r.usage.userTurns, 145);
    assert.equal(r.usage.fromCard, 100);
    assert.equal(r.usage.errors, 3);
    assert.equal(r.usage.decideMedianS, 6);
});

test('parses the week table without capping the counts', () => {
    const r = parseReport(text);
    assert.equal(r.weeks.length, 4);
    assert.equal(r.weeks[0].conversations, 10);
    assert.equal(r.weeks[1].fromCardPercent, null);   // the em-dash column
});

test('parses the count blocks and the recognizer breakdown', () => {
    const r = parseReport(text);
    assert.equal(r.usage.sourceCounts['(not recorded)'], 130);
    assert.equal(r.usage.sourceCounts.card, 12);
    assert.equal(r.usage.slotCounts.INITIATIVE, 6);
    assert.equal(r.usage.byRecognizer.browser.turns, 20);
    assert.equal(r.usage.byRecognizer.browser.medianS, 18);
});

test('system info keeps nested leaves apart from top-level ones', () => {
    const r = parseReport(text);
    // ⚠ THE REGRESSION THIS GUARDS: DISPLAY holds several `w:` leaves, so a flat
    // map returns the first one for every lookup and the window-size check silently
    // compares a number with itself.
    assert.equal(r.system['layoutViewport.w'], 900);
    assert.equal(r.system['screen.w'], 1440);
    assert.equal(r.system.silenceThreshold, 1.5);
    assert.equal(r.system.standalone, false);
    assert.equal(r.system.iosShell, null);
});

test('parses events with their numeric fields', () => {
    const evs = parseEvents('10:00:12.001  palette_shown  kind=ai cards=4 words=40');
    assert.equal(evs.length, 1);
    assert.equal(evs[0].name, 'palette_shown');
    assert.equal(evs[0].fields.cards, 4);
    assert.equal(evs[0].fields.kind, 'ai');
});

test('counts a set of suggestions as replaced only when nothing was tapped first', () => {
    const evs = parseEvents([
        '10:00:00.000  palette_shown',
        '10:00:05.000  palette_refreshed',      // replaced, 5s
        '10:00:09.000  card_selected  index=0',  // acted on
        '10:00:20.000  palette_shown',
        '10:00:31.000  palette_refreshed',      // replaced, 11s
    ].join('\n'));
    const g = summarizeEvents(evs);
    assert.equal(g.palettesShown, 4);
    assert.equal(g.replacedBeforeAnyTap, 2);
    assert.equal(g.actedOn, 1);
    assert.deepEqual(g.lives, [5, 11]);
    assert.equal(g.medianLife, 8);
});

test('flags suggestions being replaced mid-choice, with the arithmetic', () => {
    const a = analyze(parseReport(text));
    const f = find(a, 'replaced while the tester was still choosing');
    assert.ok(f, 'the churn finding should fire');
    assert.equal(f.severity, 'high');
    assert.ok(f.evidence.join(' ').includes('%'), 'it must show the share, not just a count');
});

test('flags a trace that ends with nothing chosen', () => {
    const a = analyze(parseReport(text));
    assert.ok(has(a, 'stretch with nothing chosen'));
});

test('flags the report figures that would mislead a reader', () => {
    const a = analyze(parseReport(text));
    assert.ok(has(a, 'errors section is empty'), 'summary says 3 errors, section says none');
    assert.ok(has(a, 'No transcripts'));
    assert.ok(has(a, 'extrapolation from very few days'));
    assert.ok(has(a, 'not measuring a wait'));
    assert.ok(has(a, 'count different things'));
    assert.ok(has(a, 'percentages are of a much smaller number'));
});

test('the "per week" warning offers the honest figure alongside the reported one', () => {
    const a = analyze(parseReport(text));
    const f = find(a, 'extrapolation from very few days');
    const ev = f.evidence.join(' ');
    assert.ok(ev.includes('21'), 'quotes what the report claimed');
    assert.ok(ev.includes('2.8'), '12 conversations over 30 days is 2.8 a week');
});

test('reports the echo pattern as ABSENT rather than staying silent', () => {
    // ⚠ A check that finds nothing must say so. Silence here reads as "no problem",
    // and this is the class of complaint the trace structurally cannot settle.
    const a = analyze(parseReport(text));
    assert.ok(has(a, 'NOT visible here'));
});

test('flags a raised silence period as context for everyone else', () => {
    const a = analyze(parseReport(text));
    const f = find(a, 'already slowed the app down');
    assert.ok(f);
    assert.ok(f.evidence.join(' ').includes('0.5'), 'names the shipped default');
});

test('flags a small window against the screen it is on', () => {
    const a = analyze(parseReport(text));
    const f = find(a, 'small window');
    assert.ok(f);
    assert.ok(f.evidence.join(' ').includes('900'));
    assert.ok(f.evidence.join(' ').includes('1440'));
});

test('says the build is old when it does not match the tree', () => {
    const a = analyze(parseReport(text), { currentVersion: '0.7.10' });
    assert.ok(has(a, 'older build'));
    const b = analyze(parseReport(text), { currentVersion: '0.7.8' });
    assert.ok(!has(b, 'older build'), 'and stays quiet when it matches');
});

test('always states what the report cannot show', () => {
    const a = analyze(parseReport(text));
    assert.ok(a.notVisible.length >= 1);
    assert.ok(a.notVisible.join(' ').includes('no words'));
});

test('empty, partial and garbage input parse without throwing', () => {
    for (const bad of ['', '   ', 'not a report at all', 'CONVERSANT AAC — PROBLEM REPORT\nVersion: broken']) {
        const r = parseReport(bad);
        assert.equal(typeof r, 'object');
        assert.deepEqual(r.events, []);
        const a = analyze(r);
        assert.ok(Array.isArray(a.findings));
        assert.ok(a.notVisible.length, 'and still says what it cannot show');
        assert.equal(typeof renderAnalysis(a), 'string');
    }
});

test('a report with no trace says so instead of reporting clean', () => {
    const trimmed = text.split('════════ WHAT HAPPENED JUST BEFORE')[0];
    const a = analyze(parseReport(trimmed));
    assert.equal(a.report.sections.events, false);
    assert.ok(a.notVisible.join(' ').includes('no event trace'));
    assert.ok(!has(a, 'replaced while the tester was still choosing'),
        'and must not claim a behavioral finding it has no data for');
});

test('the rendered output names no code identifiers', () => {
    const out = renderAnalysis(analyze(parseReport(text), { currentVersion: '0.7.10' }));
    // Ken does not read code, so the whole value of the tool is that its output is
    // readable without it. Event and field names leaking through would undo that.
    for (const jargon of ['palette_shown', 'palette_refreshed', 'card_selected',
        'generation_superseded', 'checkpoint ', 'sinceMs', 'decideMs', 'selectedIndex',
        'buildProblemReport', '.mjs', 'null', 'undefined']) {
        assert.ok(!out.includes(jargon), `output should not contain "${jargon}"`);
    }
});

test('the rendered output leads with the tester and ends with the blind spot', () => {
    const out = renderAnalysis(analyze(parseReport(text)));
    assert.ok(out.indexOf('WHAT THE TESTER SAID') < out.indexOf('WHAT THE APP DID'));
    assert.ok(out.indexOf('WHAT THE APP DID') < out.indexOf('NOT TO TRUST'));
    assert.ok(out.indexOf('NOT TO TRUST') < out.indexOf('CANNOT SHOW'));
    assert.ok(out.includes('The cards changed while I was reaching for one.'));
});

test('the index appears only when there is more than one report', () => {
    const a = analyze(parseReport(text));
    assert.equal(renderIndex([a]), '');
    const two = renderIndex([a, a]);
    assert.ok(two.includes('2 REPORTS'));
});
