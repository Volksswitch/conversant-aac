/* Reading an exported copy of the beta reports Sheet.
 *
 * INPUT is a CSV export of one tab (File > Download > Comma-separated values, which
 * exports whichever tab is showing). The `reports` tab is the one that matters: its
 * last column carries the whole report exactly as it arrived, so everything the app
 * has ever sent is in there whether or not somebody added a column for it.
 *
 * (!) READ THE RAW COLUMN, NOT THE FLAT ONES. The flat columns exist for eyeballing
 * in the Sheet; they are written by the receiving script, their headers are only ever
 * written when the tab is first created, and adding one means redeploying that script
 * through a procedure with a documented trap that fails silently. The raw column needs
 * none of that: a number added to the app's summary appears in it the following week
 * with nothing changed at the far end. So the flat columns can drift and nothing here
 * breaks.
 *
 * (!) EVERY REPORT CARRIES THE TESTER'S WHOLE HISTORY, re-counted from scratch. So
 * reports must never be added together - a tester with six reports has not had six
 * times as many conversations. For everything cumulative the NEWEST report from a
 * device is the only one that counts. Errors are the exception, handled below.
 */

/* A CSV reader that survives the raw column, which is JSON full of commas, quotes and
 * newlines. Nothing clever - quoted fields, doubled quotes, embedded newlines. */
export function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false, i = 0;
    const s = String(text || '').replace(/^\uFEFF/, '');
    while (i < s.length) {
        const c = s[i];
        if (quoted) {
            if (c === '"') {
                if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
                quoted = false; i++; continue;
            }
            field += c; i++; continue;
        }
        if (c === '"') { quoted = true; i++; continue; }
        if (c === ',') { row.push(field); field = ''; i++; continue; }
        if (c === '\r') { i++; continue; }
        if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
        field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r[0] || '').trim() !== '');
}

/* Whose numbers are not tester numbers.
 *
 * Ken, August 21 2026: "All my devices are prefaced with Ken. You can ignore them and
 * the SLPs as well." His own device carries months of records written before
 * conversations were saved the way they are now, so leaving it in would pull every
 * pooled figure toward a history no tester has. The speech therapists are evaluating
 * the app rather than living with it, which is a different question from the one these
 * numbers answer.
 *
 * (!) AN EXCLUDED REPORT IS NAMED, NEVER SILENTLY DROPPED. Ken also said the
 * therapists may not be filling in their name at all, so an unnamed report is more
 * likely to be one of theirs than a tester's - but it might not be, and a report
 * quietly binned is a tester who appears to have stopped. They are listed so he can
 * chase the name.
 */
export const EXCLUDE_PREFIXES = ['ken'];
export const EXCLUDE_NAMES = [];   // add a therapist's name here once it is known

export function classifyTester(name) {
    const n = String(name || '').trim();
    if (!n || n === '(not set)') return 'unnamed';
    const low = n.toLowerCase();
    if (EXCLUDE_PREFIXES.some(p => low.startsWith(p))) return 'excluded';
    if (EXCLUDE_NAMES.some(x => low === x.toLowerCase())) return 'excluded';
    return 'tester';
}

function versionParts(v) {
    return String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
}
export function versionAtLeast(v, floor) {
    const a = versionParts(v), b = versionParts(floor);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] || 0, y = b[i] || 0;
        if (x !== y) return x > y;
    }
    return true;
}

/* Pull the reports out of the rows. The payload column is found by looking for it
 * rather than by position, because a Sheet gets columns reordered by hand. */
export function readReports(rows) {
    const reports = [], problems = [], broken = [];
    for (const row of rows) {
        const raw = row.find(cell => {
            const t = String(cell || '').trim();
            return t.startsWith('{') && t.includes('"sentAt"');
        });
        if (!raw) continue;                       // header row, or a row with no payload
        let p;
        try { p = JSON.parse(raw); } catch { broken.push(row[0] || '?'); continue; }
        p.receivedAt = row[0] || '';
        (p.kind === 'problem' ? problems : reports).push(p);
    }
    return { reports, problems, broken };
}

/* One record per DEVICE, built from its reports.
 *
 * Keyed on the device code rather than the name, for the same reason the receiving
 * script is: a name typed late or corrected must not start a second history. The name
 * shown is the most recent one that was actually filled in.
 */
export function byInstall(reports) {
    const map = new Map();
    for (const p of reports) {
        const key = p.installId || p.testerName || '?';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(p);
    }
    const out = [];
    for (const [install, list] of map) {
        list.sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt)));
        const latest = list[list.length - 1];
        const named = [...list].reverse().find(p => p.testerName && p.testerName !== '(not set)');
        const withInfo = [...list].reverse().find(p => p.systemInfo);
        out.push({
            install,
            name: (named && named.testerName) || '(not set)',
            kind: classifyTester(named && named.testerName),
            reports: list.length,
            firstSentAt: list[0].sentAt,
            lastSentAt: latest.sentAt,
            appVersion: latest.appVersion,
            build: latest.build,
            usage: latest.usage || null,
            weeks: latest.weeks || [],
            events: latest.events || null,
            personalization: latest.personalization || null,
            systemInfo: (withInfo && withInfo.systemInfo) || null,
            errors: gatherErrors(list),
        });
    }
    return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/* Errors are the one thing that must be gathered across ALL of a device's reports,
 * because since 0.7.11 each report carries only what is new since the last one.
 *
 * (!) AND THE ONE THING THAT WOULD BE DOUBLE COUNTED IF THAT WERE ASSUMED. Before
 * 0.7.11 a report carried every error ever recorded, and the first report after a
 * tester upgrades still carries the whole backlog - so simply concatenating counts the
 * same error several times and reports a tester as having far more trouble than they
 * do. Deduplicating on when-and-what makes both eras safe to merge, and it costs
 * nothing, so it is done regardless of version.
 */
export function gatherErrors(list) {
    const seen = new Map();
    for (const p of list) {
        for (const e of p.errors || []) {
            const key = [e.ts || '', e.context || '', e.message || ''].join('|');
            if (!seen.has(key)) seen.set(key, { ...e, appVersion: p.appVersion });
        }
    }
    return [...seen.values()].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}
