/* The weekly read, in prose.
 *
 * (!) SCRUBBED BY CONSTRUCTION, NOT BY FILTERING. Nothing here ever reads the fields
 * carrying a communication partner's name or a place name. Those people are third
 * parties who never agreed to anything and cannot be asked, so their names have no
 * business in a document that gets pasted into a message or read over a shoulder.
 * Counts of them are fine and are what is printed. The rule is kept by never touching
 * the field rather than by stripping it afterwards, because a strip is one forgotten
 * line away from failing quietly.
 *
 * Tester names ARE printed - the whole point is knowing who to talk to - so this
 * output is confidential in exactly the way the Sheet is.
 *
 * (!) IT ENDS IN QUESTIONS, NOT CONCLUSIONS. With five people these numbers rank
 * things and raise questions; only talking to somebody tells you why. A read that
 * ends in a verdict has overrun its evidence.
 */
import { tally, addTallies, ratios, groupBy, dimensionsOf, spread,
         silentTesters, retentionGrid, errorRollup } from './aggregate.mjs';

const pct = (r) => (r === null || r === undefined ? '--' : `${Math.round(r * 100)}%`);
const s1 = (ms) => (ms === null || ms === undefined ? '--' : `${(ms / 1000).toFixed(1)}s`);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const day = (iso) => (iso ? String(iso).slice(0, 10) : '--');

function section(L, title) { L.push(''); L.push(title); L.push('-'.repeat(title.length)); }

export function render({ testers, excluded, unnamed, problems, broken, asOf = Date.now() }) {
    const L = [];
    L.push('CONVERSANT AAC - BETA REPORT READING');
    L.push(`Generated ${new Date(asOf).toISOString().slice(0, 16).replace('T', ' ')}`);
    L.push(`${testers.length} tester(s) counted`
        + (excluded.length ? `, ${excluded.length} of your own or the therapists' device(s) set aside` : '')
        + (unnamed.length ? `, ${unnamed.length} report source(s) with no name` : ''));

    /* ---- who to talk to ---- */
    section(L, 'WHO TO REACH OUT TO');
    const quiet = silentTesters(testers, asOf);
    if (!quiet.length) L.push('  Everyone has reported within the last fortnight.');
    for (const q of quiet) {
        L.push(`  ${pad(q.name, 18)} last heard from ${day(q.lastSentAt)}`
            + (q.quietDays === null ? '  (no date on their reports)' : `, ${q.quietDays} days ago`));
    }
    if (unnamed.length) {
        L.push('');
        L.push('  Reports arriving with no name filled in - worth chasing, because a report');
        L.push('  with no name cannot be counted as anybody:');
        for (const u of unnamed) L.push(`    device ${pad(u.install, 14)} ${u.reports} report(s), last ${day(u.lastSentAt)}`);
    }
    if (broken.length) L.push(`  ${broken.length} row(s) could not be read at all.`);

    /* ---- the three questions, pooled ---- */
    const totals = addTallies(testers.map(tally));
    const r = ratios(totals);
    section(L, 'ACROSS EVERYONE');
    L.push(`  Real conversations      ${totals.conversations}   (plus ${totals.practice} practice)`);
    L.push(`  Things said             ${totals.userTurns}`);
    L.push('');
    L.push(`  A suggestion was good enough    ${pct(r.sufficiency)}  (${totals.fromCard} of ${totals.userTurns})`);
    L.push(`  Replies that took over 4s       ${pct(r.overFour)}  (${totals.respondOver4s} of ${totals.respondSamples})`);
    L.push(`  Suggestions shown then ignored  ${pct(r.abandoned)}  (${totals.palettesAbandoned} of ${totals.palettesShown})`);
    L.push(`  Asked for different suggestions ${(r.regeneratesPerTurn ?? 0).toFixed(2)} times per reply`);
    L.push(`  Opened the app and started      ${pct(r.startedPerOpen)}  (${totals.conversationsStarted} of ${totals.appOpens} opens)`);
    L.push('');
    L.push('  These five combine honestly across people because each is a count divided');
    L.push('  by a count. Typical waits do not - see the last section.');
    if (totals.rateLimited) L.push(`  (!) The AI refused ${totals.rateLimited} request(s) for being asked too often.`);
    if (totals.voiceFellBack) L.push(`  (!) The paid voice dropped to the device voice ${totals.voiceFellBack} time(s).`);

    perTester(L, testers);
    byConfiguration(L, testers);
    retention(L, testers);
    errorsBlock(L, testers);
    problemsBlock(L, problems || []);
    limits(L, testers);
    questions(L, testers, totals, r);
    L.push('');
    return L.join("\n");
}

/* One block per tester. Never an average of them: with five people a percentage is
 * one person changing their mind, so they are read side by side as case files. */
function perTester(L, testers) {
    section(L, 'EACH TESTER');
    L.push(`  ${pad('Who', 16)}${rpad('Convs', 6)}${rpad('Days', 6)}${rpad('Said', 6)}${rpad('Fitted', 8)}${rpad('Over 4s', 9)}  Setup`);
    for (const t of testers) {
        const c = tally(t), rr = ratios(c), d = dimensionsOf(t);
        L.push(`  ${pad(t.name, 16)}${rpad(c.conversations, 6)}${rpad(c.activeDays, 6)}${rpad(c.userTurns, 6)}`
            + `${rpad(pct(rr.sufficiency), 8)}${rpad(pct(rr.overFour), 9)}  ${d.platform}, ${d.hearing} hearing`);
    }
    L.push('');
    L.push('  Fitted = how often one of the suggestions was good enough to say.');
}

/* THE POOLING THAT IS ACTUALLY VALID. A question about a configuration is a question
 * about turns, and five people produce thousands of turns. Groups with very little in
 * them are still printed rather than hidden, because a configuration nobody is using
 * is itself worth knowing. */
function byConfiguration(L, testers) {
    section(L, 'BY SETUP');
    L.push('  Pooled across turns, not across people - a setup question is answered by');
    L.push('  the turns it produced, and there are thousands of those.');
    const dims = [
        ['Device', t => dimensionsOf(t).platform],
        ['What hears them', t => dimensionsOf(t).hearing],
        ['What speaks for them', t => dimensionsOf(t).voice],
        ['App version', t => dimensionsOf(t).version],
    ];
    for (const [label, keyFn] of dims) {
        const groups = groupBy(testers, keyFn);
        if (groups.length < 2 && groups[0] && groups[0].key === 'unknown') continue;
        L.push('');
        L.push(`  ${label}`);
        for (const g of groups) {
            L.push(`    ${pad(g.key, 20)}${rpad(g.totals.testers + ' tester(s)', 13)}`
                + `${rpad(g.totals.userTurns + ' said', 12)}`
                + `${rpad('fitted ' + pct(g.ratios.sufficiency), 14)}`
                + `${rpad('over 4s ' + pct(g.ratios.overFour), 14)}`);
        }
    }
}

/* The curve. One row per tester, weeks counted from their own first day so that
 * "week 4" means the same thing whenever they were recruited. */
function retention(L, testers) {
    const grid = retentionGrid(testers);
    if (!grid.weeks) return;
    section(L, 'WEEK BY WEEK');
    L.push('  Real conversations each week, counted from each tester\'s own first day.');
    L.push('  A blank week is the finding - it is what quietly stopping looks like.');
    L.push('');
    let head = '  ' + pad('Who', 16);
    for (let i = 1; i <= grid.weeks; i++) head += rpad('w' + i, 5);
    L.push(head);
    for (const row of grid.rows) {
        let line = '  ' + pad(row.name, 16);
        for (let i = 1; i <= grid.weeks; i++) {
            const w = row.weeks.find(x => x.week === i);
            line += rpad(w ? (w.conversations || '.') : '', 5);
        }
        L.push(line);
    }
}

/* Grouped by what went wrong, not by who hit it - which is what separates a fault in
 * the app from one tester's poor connection. */
function errorsBlock(L, testers) {
    section(L, 'ERRORS');
    const groups = errorRollup(testers);
    if (!groups.length) { L.push('  None reported.'); return; }
    for (const g of groups) {
        L.push(`  ${pad(g.context, 20)} ${rpad(g.count, 5)}  last ${day(g.newest)}`
            + `  ${g.testers.length} tester(s): ${g.testers.join(', ')}`);
        for (const s of g.samples) L.push(`      ${String(s).slice(0, 100)}`);
    }
    L.push('');
    const shared = groups.filter(g => g.testers.length > 1);
    if (shared.length) {
        L.push('  Hitting more than one tester, so more likely the app than a setup:');
        for (const g of shared) L.push(`    ${g.context}`);
    } else {
        L.push('  Nothing is hitting more than one tester, which points at individual');
        L.push('  setups or connections rather than at the app.');
    }
}

/* What the tester wrote in their own words. The only place in this document where
 * anybody says anything, and by far the most informative part of it. */
function problemsBlock(L, problems) {
    section(L, 'WHAT TESTERS WROTE');
    if (!problems.length) { L.push('  No problem reports.'); return; }
    for (const p of problems) {
        L.push(`  ${day(p.sentAt)}  ${p.testerName || '(no name)'}  (version ${p.appVersion || '?'})`);
        const note = String(p.note || '').trim();
        L.push(note ? note.split('\n').map(l => '      ' + l).join('\n') : '      (nothing written)');
        L.push('');
    }
    L.push('  The full text of each came with it and is in the problems tab.');
}

/* WHAT NOT TO BELIEVE, and what no amount of reading can settle.
 *
 * This section is not an apology for the tool. A number with no warning label is
 * reasoned from; a number with one is checked. And a check that finds nothing must
 * never be printed as "no problem" - the trace carries counts and no words, on
 * purpose, so the commonest complaint of all, that the app misheard or suggested the
 * wrong thing, is not decidable from any of this. */
function limits(L, testers) {
    section(L, 'WHAT NOT TO READ TOO HARD');
    const stale = testers.filter(t => !/^0\.7\.(1[1-9]|[2-9]\d)/.test(String(t.appVersion || '')));
    if (stale.length) {
        L.push('  Still on an older build, so their figures are the older kind and some of');
        L.push('  what they report may already be fixed:');
        for (const t of stale) L.push(`    ${pad(t.name, 16)} version ${t.appVersion || '?'}`);
        L.push('');
    }
    const discarded = testers.filter(t => (t.usage || {}).respondDiscarded > 0);
    if (discarded.length) {
        L.push('  Some of their saved conversations predate the app being able to time a');
        L.push('  wait at all; those turns are skipped rather than averaged in:');
        for (const t of discarded) L.push(`    ${pad(t.name, 16)} ${t.usage.respondDiscarded} turn(s) skipped`);
        L.push('');
    }
    const waits = spread(testers, t => (t.usage || {}).respondMsMedian);
    if (waits) {
        L.push(`  Typical waits run from ${s1(waits.low)} to ${s1(waits.high)} across ${waits.n} tester(s).`);
        L.push('  That is a range and nothing more: each tester reports their own middle');
        L.push('  value, and middles cannot be combined into a middle. The pooled figure to');
        L.push('  read is the share of replies over four seconds, further up.');
        L.push('');
    }
    L.push('  And the structural one: what the app records carries counts and timings and');
    L.push('  no words, deliberately. So "it misheard me" and "the suggestions were wrong"');
    L.push('  cannot be confirmed or ruled out from any of this. When one of those comes');
    L.push('  up, ask the tester to send one saved conversation.');
}

/* Ends in questions because that is what this evidence supports. */
function questions(L, testers, totals, r) {
    section(L, 'WORTH ASKING');
    const qs = [];
    const quiet = silentTesters(testers, Date.now());
    for (const q of quiet) qs.push(`${q.name}: nothing heard for ${q.quietDays ?? '?'} days - still using it?`);
    if (r.abandoned !== null && r.abandoned > 0.3) {
        qs.push(`Suggestions are being shown and ignored ${pct(r.abandoned)} of the time. Ask two testers what they were reading when they gave up on a set.`);
    }
    if (r.overFour !== null && r.overFour > 0.5) {
        qs.push(`More than half of replies take over four seconds. Ask whether partners are noticing the pause, or whether the holding phrases cover it.`);
    }
    if (r.sufficiency !== null && r.sufficiency < 0.4) {
        qs.push(`Suggestions are good enough less than half the time. Split it: is it the same tester every time, and is their About Me filled in?`);
    }
    for (const t of testers) {
        const p = t.personalization || {};
        const c = tally(t);
        if (c.conversations > 5 && (p.worldviewPercent ?? 0) < 20) {
            qs.push(`${t.name} is using it but has barely filled in About Me. That splits a poor result into an onboarding problem or a suggestion problem - worth knowing which.`);
        }
    }
    if (!qs.length) qs.push('Nothing in the numbers is asking for a conversation this week.');
    qs.forEach((q, i) => L.push(`  ${i + 1}. ${q}`));
}
