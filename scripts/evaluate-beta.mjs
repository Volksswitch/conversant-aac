#!/usr/bin/env node
/* Read the beta reports Sheet and say what is in it.
 *
 *   node scripts/evaluate-beta.mjs                  # find the exports automatically
 *   node scripts/evaluate-beta.mjs <file|folder>    # or point it at them
 *   node scripts/evaluate-beta.mjs --out beta.txt
 *
 * Ken's trigger phrase is "evaluate beta". He does not run commands by hand, so the
 * no-argument form has to do something sensible on its own.
 *
 * HOW THE DATA GETS HERE. In the Sheet, open the `reports` tab and choose
 * File > Download > Comma-separated values; do the same on the `problems` tab if
 * there is anything on it. Both land in Downloads and both are found from there with
 * no argument. That export is the only manual step in the whole loop, and it is
 * deliberate: the alternative was putting the judgement of what these numbers mean
 * inside the Sheet's own script editor, where it could not be reviewed or tested and
 * would drift away from the app it describes.
 *
 * (!) PATHS ARE DERIVED, NEVER HARDCODED. Two machines share one OneDrive copy of
 * this project, so a literal C:\Users\<name> path works on one of them and fails
 * silently on the other.
 *
 * (!) THE OUTPUT NAMES TESTERS, so it is as confidential as the Sheet. It does not
 * name their conversation partners or the places they go - see the note in render.
 */

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, readReports, byInstall } from './beta-eval/load.mjs';
import { render } from './beta-eval/render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
// Google names an export "<Spreadsheet> - <tab>.csv". Matching loosely on the sheet
// name rather than exactly on the tab keeps working if either gets renamed.
const MATCH = /\.csv$/i;
const LIKELY = /conversant|beta|report|problem|week/i;

function defaultSearchDirs() {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const od = process.env.OneDrive || process.env.ONEDRIVE || '';
    return [
        path.join(REPO, 'Reports'),
        home && path.join(home, 'Desktop'),
        home && path.join(home, 'Downloads'),
        od && path.join(od, 'Desktop'),
        od && path.join(od, 'Downloads'),
    ].filter(p => p && existsSync(p));
}

async function filesIn(dir, loose = false) {
    const out = [];
    for (const name of await readdir(dir)) {
        if (MATCH.test(name) && (loose || LIKELY.test(name))) out.push(path.join(dir, name));
    }
    return out;
}

async function resolveInputs(args) {
    if (!args.length) {
        const found = [];
        for (const d of defaultSearchDirs()) found.push(...await filesIn(d));
        return [...new Set(found)];
    }
    const out = [];
    for (const a of args) {
        if (!existsSync(a)) { console.error(`Not found, skipped: ${a}`); continue; }
        const st = await stat(a);
        if (st.isDirectory()) out.push(...await filesIn(a, true));
        else out.push(a);
    }
    return [...new Set(out)];
}

async function main() {
    const argv = process.argv.slice(2);
    const outAt = argv.indexOf('--out');
    const outPath = outAt >= 0 ? argv[outAt + 1] : null;
    // (!) The filter must only run when --out is actually present. Without the guard,
    // outAt is -1, so `i !== outAt + 1` drops argument ZERO - the file being asked
    // for - and the tool reports finding nothing while looking straight at it.
    const rest = outAt >= 0 ? argv.filter((a, i) => i !== outAt && i !== outAt + 1) : argv;
    const inputs = await resolveInputs(rest);

    if (!inputs.length) {
        console.error('No exported Sheet found.\n');
        console.error('In the beta reports Sheet, open the `reports` tab and choose');
        console.error('File > Download > Comma-separated values. Do the same for the');
        console.error('`problems` tab if it has anything on it. Then run this again.');
        process.exit(1);
    }

    const allReports = [], allProblems = [], broken = [], unread = [];
    for (const file of inputs) {
        const text = await readFile(file, 'utf8');
        const { reports, problems, broken: bad, skipped } = readReports(parseCsv(text));
        // (!) SAY SO WHEN A FILE GIVES UP NOTHING. A tab this tool cannot read used to
        // pass through in silence, and the report then stated the opposite of the
        // truth - "No problem reports" with four of them in the file. A count that
        // cannot be turned into anything is now named, with the file it came from.
        const empty = !reports.length && !problems.length && !bad.length;
        if (skipped || empty) unread.push({ file: path.basename(file), skipped, empty });
        // The same tab exported twice, or a tab that is not this Sheet, both land
        // here harmlessly: a duplicate report is deduplicated by device below, and a
        // file with no payload column contributes nothing.
        allReports.push(...reports);
        allProblems.push(...problems);
        broken.push(...bad);
    }
    for (const u of unread) {
        // One line per file: "nothing readable" already covers "some rows skipped".
        if (u.empty) console.error(`Nothing readable in ${u.file} - is it an export of this Sheet?`);
        else console.error(`${u.skipped} row(s) in ${u.file} could not be read and are NOT in what follows.`);
    }
    if (unread.length) console.error('');
    if (!allReports.length && !allProblems.length) {
        console.error(`Read ${inputs.length} file(s) but found no reports in them.`);
        console.error('The export needs to include the last column, which carries the');
        console.error('report itself; a copied selection of the visible columns will not do.');
        process.exit(1);
    }

    const devices = byInstall(allReports);
    const testers = devices.filter(d => d.kind === 'tester');
    const excluded = devices.filter(d => d.kind === 'excluded');
    const unnamed = devices.filter(d => d.kind === 'unnamed');

    const text = render({ testers, excluded, unnamed, problems: allProblems, broken });
    if (outPath) { await writeFile(outPath, text, 'utf8'); console.log(`Written to ${outPath}`); }
    else console.log(text);
}

main().catch(err => { console.error(err); process.exit(1); });
