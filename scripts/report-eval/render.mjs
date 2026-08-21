/* Render an analysis as plain text for a person to read.
 *
 * ⚠ WRITE FOR A READER WHO DOES NOT READ CODE. No identifiers, no event names, no
 * field names — those are in the trace itself if anyone wants them. Every line here
 * says what happened to a person or what a number does or does not mean.
 *
 * ORDER IS THE ARGUMENT. The tester's own words come first, because they are the
 * only part nothing else can supply and the rest of the file is context for them.
 * Then what the app did, then which figures not to believe, then — last and never
 * omitted — what a report of this shape structurally cannot answer. Ending on the
 * blind spot is deliberate: the alternative is a page of confident findings that
 * reads as a complete account when the commonest class of complaint is invisible
 * to it.
 */

const BAR = '='.repeat(78);
const RULE = '-'.repeat(78);

function wrap(text, width = 74, indent = '    ') {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
        if (!cur.length) cur = w;
        else if ((cur + ' ' + w).length <= width) cur += ' ' + w;
        else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.map(l => indent + l).join('\n');
}

const LABEL = {
    high: '!! ',
    medium: ' ! ',
    note: '   ',
};

function renderFinding(f, n) {
    const out = [];
    out.push(`${LABEL[f.severity] || '   '}${n}. ${f.title}`);
    if (f.detail) out.push(wrap(f.detail));
    for (const e of f.evidence || []) out.push(`      - ${e}`);
    if (f.confidence && f.confidence !== 'measured') out.push(wrap(`(${f.confidence})`, 74, '      '));
    return out.join('\n');
}

export function renderAnalysis({ report, stats, findings, notVisible }) {
    const L = [];
    const r = report;
    L.push(BAR);
    L.push(`REPORT  ${r.filename || '(unnamed)'}`);
    const bits = [
        r.appVersion ? `version ${r.appVersion}${r.build ? ` (${r.build})` : ''}` : null,
        r.generated ? `sent ${r.generated.replace('T', ' ').replace(/\..*/, '')}` : null,
        r.system.summary || null,
    ].filter(Boolean);
    if (bits.length) L.push('        ' + bits.join('  |  '));
    L.push(BAR);
    L.push('');

    L.push('WHAT THE TESTER SAID');
    L.push(r.note ? wrap(r.note) : '    (they wrote nothing)');
    L.push('');

    if (r.sections.usage) {
        const u = r.usage;
        L.push('WHERE THEY ARE UP TO');
        const row = (k, v) => { if (v != null && v !== '') L.push(`    ${k.padEnd(28)}${v}`); };
        row('Conversations', u.conversations != null
            ? `${u.conversations}${u.practice ? ` (${u.practice} practice)` : ''}` : null);
        row('Days used', u.activeDays != null
            ? `${u.activeDays}${u.spanDays ? ` across ${u.spanDays} days` : ''}` : null);
        row('Days since last use', u.daysSinceLastUse);
        row('Said from a card', u.fromCardPercent != null ? `${u.fromCardPercent}%` : null);
        row('Reading and choosing', u.decideMedianS != null ? `${u.decideMedianS}s typically` : null);
        row('About Me filled in', u.aboutMePercent != null ? `${u.aboutMePercent}%` : null);
        row('Own phrases on the panel', u.expressEdited != null ? `${u.expressEdited} of ${u.expressTotal}` : null);
        row('Errors recorded', u.errors);
        if (r.weeks.length) {
            // Real counts, never capped: the whole value of the curve is seeing a
            // busy first week fall away, and squashing 15 down to 9 hides exactly
            // the drop it exists to show.
            const w = Math.max(2, ...r.weeks.map(x => String(x.conversations).length));
            const head = r.weeks.map(x => String(x.week).padStart(w)).join(' ');
            const curve = r.weeks.map(x => (x.conversations === 0 ? '.'.padStart(w) : String(x.conversations).padStart(w))).join(' ');
            L.push(`    ${'Week'.padEnd(28)}${head}`);
            L.push(`    ${'Conversations'.padEnd(28)}${curve}   (. = none)`);
        }
        L.push('');
    }

    if (r.sections.events) {
        L.push('WHAT THE TRACE COVERS');
        L.push(`    ${String(r.events.length).padStart(4)} recorded moments`
            + `, ${stats.palettesShown} sets of suggestions`
            + `, ${stats.selections} chosen`);
        L.push('');
    }

    const app = findings.filter(f => f.kind === 'app');
    const trust = findings.filter(f => f.kind === 'trust');
    const notes = findings.filter(f => f.kind === 'note');

    L.push(RULE);
    L.push('WHAT THE APP DID');
    L.push(RULE);
    if (!app.length) L.push('    Nothing stood out in what the trace can see.');
    app.forEach((f, i) => { L.push(renderFinding(f, i + 1)); L.push(''); });
    if (app.length) L.pop();
    L.push('');

    L.push(RULE);
    L.push('FIGURES IN THIS REPORT NOT TO TRUST');
    L.push(RULE);
    if (!trust.length) L.push('    Nothing flagged.');
    trust.forEach((f, i) => { L.push(renderFinding(f, i + 1)); L.push(''); });
    if (trust.length) L.pop();
    L.push('');

    if (notes.length) {
        L.push(RULE);
        L.push('WORTH KNOWING');
        L.push(RULE);
        notes.forEach((f, i) => { L.push(renderFinding(f, i + 1)); L.push(''); });
        L.pop();
        L.push('');
    }

    L.push(RULE);
    L.push('WHAT THIS REPORT CANNOT SHOW');
    L.push(RULE);
    for (const n of notVisible) { L.push(wrap(n, 74, '    ')); L.push(''); }
    if (notVisible.length) L.pop();
    L.push('');
    return L.join('\n');
}

/* A one-line-per-report index, for when several arrive at once. Deliberately shows
 * days-since-last-use next to the headline count: a tester who has stopped is the
 * one worth reading first, and that is invisible in a list ordered by filename. */
export function renderIndex(analyses) {
    if (analyses.length < 2) return '';
    const L = [BAR, `${analyses.length} REPORTS`, BAR];
    L.push('    version   quiet   high   note');
    for (const a of analyses) {
        const high = a.findings.filter(f => f.severity === 'high').length;
        const quiet = a.report.usage.daysSinceLastUse;
        L.push(`    ${String(a.report.appVersion || '?').padEnd(10)}`
            + `${String(quiet == null ? '?' : `${quiet}d`).padStart(5)}`
            + `${String(high).padStart(7)}   `
            + (a.report.note ? a.report.note.slice(0, 40) : '(no words)'));
    }
    L.push('');
    return L.join('\n');
}
