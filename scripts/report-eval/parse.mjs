/* Parse a Conversant AAC problem report into structured data.
 *
 * The input is the plain-text file `diagnostics.buildProblemReport` produces —
 * the thing a tester sends from Settings > Troubleshooting, or that arrives in
 * the Sheet's `problems` tab. It is written to be READ by a person, so this
 * parser is deliberately tolerant: every field is optional, an unrecognized line
 * is skipped rather than fatal, and a truncated or hand-edited report still
 * yields whatever it does contain.
 *
 * ⚠ THE PARSER MUST NEVER THROW ON A MALFORMED REPORT. A report arrives exactly
 * when something has already gone wrong for a tester, often from a build we no
 * longer have, and a tool that refuses to read it is useless at the only moment
 * it is needed. Anything unreadable becomes a null, and `analyze` decides what a
 * missing field means.
 *
 * ⚠ IT ALSO MUST NOT ASSUME THE CURRENT REPORT FORMAT. Reports outlive releases:
 * a six-week beta will produce files from several versions, and a section that
 * moves or gains a line must degrade to a null rather than shifting every field
 * after it. Hence line-anchored regexes rather than positional parsing.
 */

const num = (s) => (s == null || s === '' || s === '—' ? null : Number(s));

/* Pull one `key   value` style line out of a section. */
function line(text, re) {
    const m = text.match(re);
    return m ? m : null;
}

function section(text, name, next) {
    // Sections are fenced by ═ banners, except the first two, which are headings.
    const i = text.indexOf(name);
    if (i === -1) return '';
    const rest = text.slice(i + name.length);
    if (!next) return rest;
    const j = rest.indexOf(next);
    return j === -1 ? rest : rest.slice(0, j);
}

/* `  label   value` pairs under an indented list heading, e.g.
 *     Where the words came from:
 *       card                 17
 */
function countBlock(text, heading) {
    const out = {};
    const i = text.indexOf(heading);
    if (i === -1) return out;
    for (const l of text.slice(i + heading.length).split('\n').slice(1)) {
        const m = l.match(/^\s{4,}(\S.*?)\s{2,}(\d+)\b/);
        if (!m) break;                 // the block ends at the first non-matching line
        out[m[1].trim()] = Number(m[2]);
    }
    return out;
}

export function parseEvents(text) {
    const out = [];
    for (const l of text.split('\n')) {
        const m = l.match(/^\s*(\d\d):(\d\d):(\d\d)\.(\d{1,3})\s+(\S+)\s*(.*)$/);
        if (!m) continue;
        const [, h, mi, s, ms, name, rest] = m;
        const fields = {};
        for (const f of rest.trim().matchAll(/(\w+)=(\S+)/g)) {
            const v = Number(f[2]);
            fields[f[1]] = Number.isNaN(v) ? f[2] : v;
        }
        // `reason=own words` and friends carry a space, so keep the raw tail too.
        out.push({
            t: Number(h) * 3600 + Number(mi) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000,
            clock: `${h}:${mi}:${s}`,
            name, fields, raw: rest.trim(),
        });
    }
    return out;
}

/* The SYSTEM INFORMATION block is an indented tree:
 *
 *   DISPLAY
 *     layoutViewport:
 *       w: 1037
 *     devicePixelRatio: 2
 *
 * Leaves are stored under BOTH their bare name and their dotted path. The bare
 * name is what almost every lookup wants (`silenceThreshold`), and the dotted path
 * is what disambiguates the several `w:` and `h:` under DISPLAY - which a flat map
 * would silently collapse into whichever came first. First write wins for the bare
 * name, so a nested duplicate cannot overwrite a top-level setting.
 */
export function parseSystemInfo(text) {
    const out = {};
    const stack = [];                       // [{ indent, key }]
    for (const l of text.split('\n')) {
        const m = l.match(/^(\s+)([A-Za-z][\w ]*):\s*(.*)$/);
        if (!m) continue;
        const indent = m[1].length;
        const key = m[2].trim();
        const raw = m[3].trim();
        while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
        if (raw === '') { stack.push({ indent, key }); continue; }   // a parent node
        const val = raw === 'true' ? true : raw === 'false' ? false
            : raw === 'null' ? null
            : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
        const path = [...stack.map(s => s.key), key].join('.');
        out[path] = val;
        if (out[key] === undefined) out[key] = val;
    }
    return out;
}

export function parseReport(text, { filename = null } = {}) {
    const r = {
        filename,
        appVersion: null, build: null, generated: null,
        note: null,
        usage: {},
        weeks: [],
        errorSectionSaysNone: null,
        transcriptBlocks: 0,
        events: [],
        system: {},
        sections: { usage: false, errors: false, events: false, system: false },
    };
    if (typeof text !== 'string' || !text.trim()) return r;

    let m = line(text, /^Version:\s*(\S+)\s*\(build\s*([^)]+)\)/m);
    if (m) { r.appVersion = m[1]; r.build = m[2].trim(); }
    m = line(text, /^Generated:\s*(\S+)/m);
    if (m) r.generated = m[1];

    // The tester's own words — indented two spaces under the heading, and the only
    // part of the report nothing else can supply.
    const noteBlock = section(text, "WHAT HAPPENED (in the tester's words)", '═');
    if (noteBlock) {
        const lines = noteBlock.split('\n').filter(l => /^\s{2,}\S/.test(l)).map(l => l.trim());
        const joined = lines.join(' ').trim();
        r.note = joined && joined !== '(nothing written)' ? joined : null;
    }

    const usage = section(text, 'USAGE SUMMARY ════════', '════════ ERRORS');
    r.sections.usage = usage.trim().length > 0;
    const u = r.usage;
    m = line(usage, /^\s*Conversations\s+(\d+)(?:\s+\((\d+) of them practice\))?/m);
    if (m) { u.conversations = num(m[1]); u.practice = num(m[2]) ?? 0; }
    m = line(usage, /^\s*Days used\s+(\d+)(?:\s+over\s+(\d+) days)?/m);
    if (m) { u.activeDays = num(m[1]); u.spanDays = num(m[2]); }
    m = line(usage, /^\s*Days since last use\s+(\d+)/m);
    if (m) u.daysSinceLastUse = num(m[1]);
    m = line(usage, /^\s*Per week \(days used\)\s+([\d.]+)/m);
    if (m) u.perActiveWeek = num(m[1]);
    m = line(usage, /^\s*Typical length\s+(\d+) turns/m);
    if (m) u.medianTurns = num(m[1]);
    m = line(usage, /^\s*Things you said\s+(\d+)/m);
    if (m) u.userTurns = num(m[1]);
    m = line(usage, /^\s*Chosen from a card\s+(\d+)\s+\((\d+)%\)/m);
    if (m) { u.fromCard = num(m[1]); u.fromCardPercent = num(m[2]); }
    m = line(usage, /^\s*Typed or a fixed phrase\s+(\d+)/m);
    if (m) u.composed = num(m[1]);
    m = line(usage, /^\s*Typical wait\s+([\d.]+)s/m);
    if (m) u.respondMedianS = num(m[1]);
    m = line(usage, /^\s*Waits over 4 seconds\s+(\d+) of (\d+)/m);
    if (m) { u.waitsOver4 = num(m[1]); u.respondSamples = num(m[2]); }
    m = line(usage, /^\s*Reading and choosing\s+([\d.]+)s typical, over (\d+) turns/m);
    if (m) { u.decideMedianS = num(m[1]); u.decideSamples = num(m[2]); }
    m = line(usage, /^\s*What there was to read\s+(\d+) cards, about (\d+) words/m);
    if (m) { u.cardsPerPalette = num(m[1]); u.wordsPerCard = num(m[2]); }
    m = line(usage, /^\s*Errors recorded\s+(\d+), in (\d+) conversation/m);
    if (m) { u.errors = num(m[1]); u.errorConversations = num(m[2]); }
    m = line(usage, /^\s*About Me answered\s+(\d+) of (\d+)\s+\((\d+)%\)/m);
    if (m) { u.aboutMeAnswered = num(m[1]); u.aboutMeTotal = num(m[2]); u.aboutMePercent = num(m[3]); }
    m = line(usage, /^\s*Express buttons yours\s+(\d+) of (\d+)/m);
    if (m) { u.expressEdited = num(m[1]); u.expressTotal = num(m[2]); }
    m = line(usage, /^\s*People \/ places\s+(\d+) \/ (\d+)/m);
    if (m) { u.people = num(m[1]); u.places = num(m[2]); }

    u.sourceCounts = countBlock(usage, 'Where the words came from:');
    u.slotCounts = countBlock(usage, 'Which kind of reply:');

    // "  browser   20 turns, typical wait 22.0s"
    u.byRecognizer = {};
    const rec = usage.indexOf('By what heard them:');
    if (rec !== -1) {
        for (const l of usage.slice(rec).split('\n').slice(1)) {
            const mm = l.match(/^\s{4,}(\S.*?)\s{2,}(\d+) turns, typical wait ([\d.]+)s/);
            if (!mm) break;
            u.byRecognizer[mm[1].trim()] = { turns: Number(mm[2]), medianS: Number(mm[3]) };
        }
    }

    // The week-by-week table: the retention curve, and the one thing a running
    // total can never show.
    const wk = usage.indexOf('WEEK BY WEEK');
    if (wk !== -1) {
        for (const l of usage.slice(wk).split('\n').slice(2)) {
            const mm = l.match(/^\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+%|—)/);
            if (!mm) { if (r.weeks.length) break; else continue; }
            r.weeks.push({
                week: Number(mm[1]), activeDays: Number(mm[2]),
                conversations: Number(mm[3]), userTurns: Number(mm[4]),
                fromCardPercent: mm[5] === '—' ? null : Number(mm[5].replace('%', '')),
            });
        }
    }

    const errs = section(text, 'ERRORS AND TRANSCRIPTS ════════', '════════ WHAT HAPPENED');
    r.sections.errors = errs.trim().length > 0;
    r.errorSectionSaysNone = /\(no errors recorded\)/.test(errs);
    r.transcriptBlocks = (errs.match(/^Transcript/gm) || []).length;

    const evText = section(text, 'WHAT HAPPENED JUST BEFORE (no words) ════════', '════════ SYSTEM');
    r.sections.events = evText.trim().length > 0 && !/\(nothing recorded\)/.test(evText);
    r.events = parseEvents(evText);

    const sys = section(text, 'SYSTEM INFORMATION ════════', null);
    r.sections.system = sys.trim().length > 0;
    r.system = parseSystemInfo(sys);

    return r;
}
