#!/usr/bin/env node
// apply-release-notes.mjs — regenerate the bundled RELEASE_NOTES block in
// app/js/whats-new.js from CHANGELOG.md. Trigger phrase: "apply release notes".
//
// CHANGELOG.md is the single source of truth for user-facing notes. The app shows
// a "What's new" notice after it silently auto-updates, and those notes are BUNDLED
// in app/js/whats-new.js (not fetched) so the notice works offline / on locked-down
// networks. This script parses CHANGELOG.md and injects a `const RELEASE_NOTES = {…}`
// object (keyed by version string) between the @@RELEASE_NOTES_START@@ / _END@@ markers.
//
// Mapping:
//   "## Version X.Y.Z"              → key "X.Y.Z"   (a shipped release)
//   "## Unreleased (next release)"  → key APP_VERSION (so a dev build can preview
//                                                      the pending notes)
// Bullets are every "- …" line under a heading (### subheads are flattened);
// markdown emphasis (**bold**, `code`, *italic*) is stripped to plain text since the
// modal renders with textContent. Italic-only placeholders (_Nothing yet._) are skipped.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));   // project root
const appJsPath = join(root, 'app', 'js', 'app.js');
const targetPath = join(root, 'app', 'js', 'whats-new.js');
const changelogPath = join(root, 'CHANGELOG.md');

const appJs = readFileSync(appJsPath, 'utf8');
const verMatch = appJs.match(/const\s+APP_VERSION\s*=\s*['"]([\d.]+)['"]/);
if (!verMatch) {
  console.error('ERROR: APP_VERSION not found in app/js/app.js');
  process.exit(1);
}
const APP_VERSION = verMatch[1];

const START = '// @@RELEASE_NOTES_START@@';
const END = '// @@RELEASE_NOTES_END@@';
const target = readFileSync(targetPath, 'utf8');
if (!target.includes(START) || !target.includes(END)) {
  console.error(`ERROR: RELEASE_NOTES markers not found in app/js/whats-new.js (${START} / ${END})`);
  process.exit(1);
}

// ---- parse CHANGELOG.md -------------------------------------------------------
// Strip markdown emphasis to plain text (the modal renders with textContent).
const clean = (s) => s
  .replace(/\*\*(.*?)\*\*/g, '$1')     // **bold**
  .replace(/\*(.*?)\*/g, '$1')         // *italic*
  .replace(/`/g, '')                   // `code`
  .trim();

const notes = {};                 // { versionString: [bullet, …] }
let key = null;                   // current version key, or null to ignore
let lastArr = null;               // array we're appending bullets to (for wrapping)

for (const raw of readFileSync(changelogPath, 'utf8').split('\n')) {
  const line = raw.replace(/\s+$/, '');
  let m;
  if ((m = line.match(/^##\s+Version\s+([\d.]+)/i))) {
    key = m[1]; notes[key] = notes[key] || []; lastArr = notes[key]; continue;
  }
  if (/^##\s+Unreleased\b/i.test(line)) {
    key = APP_VERSION; notes[key] = notes[key] || []; lastArr = notes[key]; continue;
  }
  if (/^##\s+/.test(line)) { key = null; lastArr = null; continue; }   // some other H2 → ignore
  if (/^###\s+/.test(line)) continue;                                  // subheader → keep current key
  if (key == null) continue;

  const bullet = line.match(/^\s*-\s+(.*)$/);
  if (bullet) {
    const text = clean(bullet[1]);
    if (text && !/^_.*_$/.test(text)) { lastArr.push(text); lastArr.__skip = false; }
    else lastArr.__skip = true;                                        // remember placeholder so wraps don't attach
  } else if (line.trim() && lastArr && lastArr.length && !lastArr.__skip) {
    lastArr[lastArr.length - 1] += ' ' + clean(line);                  // wrapped continuation of previous bullet
  }
}

// Drop empty version keys (heading with only a placeholder / no bullets).
for (const k of Object.keys(notes)) {
  delete notes[k].__skip;
  if (!notes[k].length) delete notes[k];
}

// ---- inject -------------------------------------------------------------------
const body = `const RELEASE_NOTES = ${JSON.stringify(notes, null, 2)};`;
const block = `${START}\n${body}\n${END}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const re = new RegExp(`${esc(START)}[\\s\\S]*?${esc(END)}`);
writeFileSync(targetPath, target.replace(re, block));

const keys = Object.keys(notes).sort((a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
  }
  return 0;
});
console.log(`Wrote RELEASE_NOTES to app/js/whats-new.js — ${keys.length} version(s): ${keys.join(', ')}`);
console.log(`(APP_VERSION=${APP_VERSION}; "## Unreleased" mapped to ${APP_VERSION} if it had bullets.)`);
