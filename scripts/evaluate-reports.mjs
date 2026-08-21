#!/usr/bin/env node
/* Read tester problem reports and say what is in them.
 *
 *   node scripts/evaluate-reports.mjs                 # find them automatically
 *   node scripts/evaluate-reports.mjs <file|folder>   # or point it at one
 *   node scripts/evaluate-reports.mjs --out report.txt
 *
 * Ken's trigger phrase is "evaluate reports" — he does not run commands by hand,
 * so the no-argument form has to do something sensible on its own.
 *
 * ⚠ PATHS ARE DERIVED, NEVER HARDCODED. Two machines share one OneDrive copy of
 * this project, so a literal C:\\Users\\<name> path works on one of them and fails
 * silently on the other.
 */

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReport } from './report-eval/parse.mjs';
import { analyze } from './report-eval/analyze.mjs';
import { renderAnalysis, renderIndex } from './report-eval/render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MATCH = /^conversant-problem-report-.*\.txt$/i;

/* Where a report plausibly lands: saved from the app, or an email attachment the
 * reader dropped somewhere obvious. Anything that does not exist is skipped. */
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

async function filesIn(dir) {
    const out = [];
    for (const name of await readdir(dir)) {
        if (MATCH.test(name)) out.push(path.join(dir, name));
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
        if (st.isDirectory()) out.push(...await filesIn(a));
        else out.push(a);
    }
    return [...new Set(out)];
}

/* The version currently in the tree, so a report from an older build can say so.
 * Read rather than imported: app.js pulls in the whole app, and this is a script. */
async function currentVersion() {
    try {
        const src = await readFile(path.join(REPO, 'app', 'js', 'app.js'), 'utf8');
        const m = src.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
        return m ? m[1] : null;
    } catch { return null; }
}

async function main() {
    const argv = process.argv.slice(2);
    let outPath = null;
    const args = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--out') outPath = argv[++i];
        else args.push(argv[i]);
    }

    const files = await resolveInputs(args);
    if (!files.length) {
        console.log('No reports found.\n');
        console.log('Looked in:');
        for (const d of defaultSearchDirs()) console.log(`  ${d}`);
        console.log('\nSave the report a tester sent into one of those, or pass the file:');
        console.log('  node scripts/evaluate-reports.mjs "path/to/report.txt"');
        return;
    }

    const version = await currentVersion();
    const analyses = [];
    for (const f of files) {
        let text = '';
        try { text = await readFile(f, 'utf8'); }
        catch (e) { console.error(`Could not read ${f}: ${e.message}`); continue; }
        // A report is evidence about a failure; refusing to read a damaged one is
        // the least useful thing this tool could do, so a bad file costs its own
        // entry and nothing else.
        try {
            const parsed = parseReport(text, { filename: path.basename(f) });
            analyses.push(analyze(parsed, { currentVersion: version }));
        } catch (e) {
            console.error(`Could not make sense of ${path.basename(f)}: ${e.message}`);
        }
    }
    if (!analyses.length) return;

    // Newest first: the report that arrived last is the one being asked about.
    analyses.sort((a, b) => String(b.report.generated || '').localeCompare(String(a.report.generated || '')));

    const text = renderIndex(analyses) + analyses.map(renderAnalysis).join('\n');
    if (outPath) {
        await writeFile(outPath, text, 'utf8');
        console.log(`Wrote ${outPath} (${analyses.length} report(s)).`);
    } else {
        console.log(text);
    }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
