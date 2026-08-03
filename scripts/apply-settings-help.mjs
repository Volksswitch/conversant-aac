#!/usr/bin/env node
// apply-settings-help.mjs — regenerate the bundled HELP block in
// app/js/settings-help.js from settings-help.json. Trigger phrase: "apply settings help".
//
// settings-help.json lives at the project ROOT and is deliberately never deployed:
// it is static for a release, the user never edits it, and there is nothing to gain
// from shipping, copying or backing it up (Ken, August 2 2026). This script embeds it
// into the app instead — the same arrangement CHANGELOG.md → whats-new.js already
// uses, which keeps the spoken help working offline with no fetch at runtime.
//
// Run it after ANY edit to settings-help.json. tests/settings-help.test.mjs compares
// the embedded object against the root file and fails when they differ, so forgetting
// this step is a loud test failure rather than a quiet shipment of stale words.
//
// Keys mirror how a tap is resolved in the panel:
//   tabs        → the tab's data-tab value
//   controls    → the element's id
//   radioGroups → the radio group's name attribute
//   sections    → a data-help attribute on a .setting-group whose heading covers
//                 several controls
// `_readme` is documentation for whoever edits the JSON and is stripped here.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, 'settings-help.json');
const targetPath = join(root, 'app', 'js', 'settings-help.js');

const START = '// @@SETTINGS_HELP_START@@';
const END = '// @@SETTINGS_HELP_END@@';

let source;
try {
    source = JSON.parse(readFileSync(sourcePath, 'utf8'));
} catch (err) {
    console.error(`ERROR: could not read settings-help.json — ${err.message}`);
    process.exit(1);
}

const BUCKETS = ['tabs', 'controls', 'radioGroups', 'sections'];
const out = {};
let entries = 0;
for (const bucket of BUCKETS) {
    const map = source[bucket];
    if (map == null) { out[bucket] = {}; continue; }
    if (typeof map !== 'object' || Array.isArray(map)) {
        console.error(`ERROR: "${bucket}" must be an object of key → phrase`);
        process.exit(1);
    }
    const clean = {};
    for (const [k, v] of Object.entries(map)) {
        if (typeof v !== 'string' || !v.trim()) {
            console.error(`ERROR: ${bucket}.${k} is not a non-empty string`);
            process.exit(1);
        }
        clean[k] = v.trim();
        entries++;
    }
    out[bucket] = clean;
}

// Anything outside the four buckets is either the _readme or a typo. A typo here
// would silently produce help that never plays, so name it rather than ignore it.
for (const key of Object.keys(source)) {
    if (key === '_readme' || BUCKETS.includes(key)) continue;
    console.error(`ERROR: unknown top-level key "${key}" — expected one of ${BUCKETS.join(', ')}`);
    process.exit(1);
}

const target = readFileSync(targetPath, 'utf8');
if (!target.includes(START) || !target.includes(END)) {
    console.error(`ERROR: markers not found in app/js/settings-help.js (${START} / ${END})`);
    process.exit(1);
}

const block = `${START}\nconst HELP = ${JSON.stringify(out, null, 2)};\n${END}`;
const next = target.replace(
    new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    () => block,   // function form: a literal $& in the help text must not be re-expanded
);
writeFileSync(targetPath, next, 'utf8');

const counts = BUCKETS.map(b => `${b} ${Object.keys(out[b]).length}`).join(', ');
console.log(`Wrote HELP to app/js/settings-help.js — ${entries} phrases (${counts}).`);
