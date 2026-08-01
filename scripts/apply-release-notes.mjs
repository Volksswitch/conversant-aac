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
// Bullets are every "- …" line under a heading; markdown emphasis (**bold**, `code`,
// *italic*) is stripped to plain text since the panel renders with textContent.
// Italic-only placeholders (_Nothing yet._) are skipped.
//
// PLATFORM SCOPING (Ken, Aug 1 2026). A "###" subheading under a version scopes the
// bullets beneath it to one platform, so a change that only affects one kind of device
// is not announced to everyone:
//
//   ### On an iPad                        → those bullets go to iPad users only
//   ### On a computer                     → ... to Windows / Chromebook / Mac only
//   ### Everyone  (or no subheading)      → both
//
// Matching is loose on purpose — anything mentioning "ipad" scopes to iPad, anything
// mentioning "computer", "windows", "chromebook" or "mac" scopes to the computer side —
// so the heading can be phrased naturally in the changelog a human reads.
//
// UNTAGGED DEFAULTS TO EVERYONE (Ken's call). Forgetting to tag a bullet means it is
// shown too widely, never that it is silently withheld: the failure mode is noise, not
// silence. Emitted shape, chosen so the common case stays exactly as it was:
//   "0.6.1": [ "a note everyone sees", { "for": "ipad", "note": "..." } ]

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

// Which platform a "###" subheading scopes its bullets to. Deliberately loose, so the
// heading can be written the way a reader wants to see it. Anything unrecognized (or no
// subheading at all) means everyone.
function scopeOf(headingText) {
  const h = headingText.toLowerCase();
  if (/\bipad\b/.test(h)) return 'ipad';
  if (/\bcomputers?\b|\bwindows\b|\bchromebook\b|\bmacs?\b|\blaptop\b/.test(h)) return 'computer';
  return 'all';
}

// A note is a bare string when it is for everyone (unchanged from before scoping
// existed) and an object only when it is actually scoped, so the file stays readable.
const asNote = (text, scope) => (scope === 'all' ? text : { for: scope, note: text });
const textOf = (n) => (typeof n === 'string' ? n : n.note);
const setText = (n, t) => { if (typeof n === 'string') return t; n.note = t; return n; };

const notes = {};                 // { versionString: [note, …] }
let key = null;                   // current version key, or null to ignore
let lastArr = null;               // array we're appending bullets to (for wrapping)
let scope = 'all';                // current "###" platform scope

for (const raw of readFileSync(changelogPath, 'utf8').split('\n')) {
  const line = raw.replace(/\s+$/, '');
  let m;
  if ((m = line.match(/^##\s+Version\s+([\d.]+)/i))) {
    key = m[1]; notes[key] = notes[key] || []; lastArr = notes[key]; scope = 'all'; continue;
  }
  if (/^##\s+Unreleased\b/i.test(line)) {
    key = APP_VERSION; notes[key] = notes[key] || []; lastArr = notes[key]; scope = 'all'; continue;
  }
  if (/^##\s+/.test(line)) { key = null; lastArr = null; scope = 'all'; continue; }  // other H2 → ignore
  if ((m = line.match(/^###\s+(.*)$/))) { scope = scopeOf(m[1]); continue; }         // platform scope
  if (key == null) continue;

  const bullet = line.match(/^\s*-\s+(.*)$/);
  if (bullet) {
    const text = clean(bullet[1]);
    if (text && !/^_.*_$/.test(text)) { lastArr.push(asNote(text, scope)); lastArr.__skip = false; }
    else lastArr.__skip = true;                                        // remember placeholder so wraps don't attach
  } else if (line.trim() && lastArr && lastArr.length && !lastArr.__skip) {
    const i = lastArr.length - 1;                                      // wrapped continuation
    lastArr[i] = setText(lastArr[i], textOf(lastArr[i]) + ' ' + clean(line));
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
