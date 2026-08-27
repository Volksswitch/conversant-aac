// American English spelling, enforced (Ken, August 11 2026).
//
// The convention has been recorded in CLAUDE.md since June 14 2026 and was being broken
// in eight documents, four spoken-help entries and the release notes -- including
// "colour" written into both User Manuals on the day Ken asked about it, and "practise"
// in help text the app READS ALOUD. The rule was never unclear; nothing checked it, so
// British spellings arrived one word at a time and nobody re-read the old ones.
//
// WHAT IS SCANNED: text a user reads or hears, and only that.
//   - CHANGELOG.md      -- becomes the in-app "What's new" notes
//   - settings-help.json -- the app speaks these
//   - app/index.html    -- on-screen text, and the attributes a screen reader speaks
//   - app/js/*.js       -- STRING LITERALS only
//
// ⚠ CODE COMMENTS ARE DELIBERATELY OUT OF SCOPE, the same split as the plain-language
// rule: their reader is the next developer, not a user. That is why the JS scan pulls
// string literals rather than reading whole files -- a comment saying "blue-grey" is
// fine and must not fail the build.
//
// ⚠ NOT SCANNED: the .docx in Documents/. They are git-ignored OneDrive artifacts, so a
// test cannot depend on them being present. Sweep those by hand during "sync docs".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// British spellings, listed EXPLICITLY rather than by pattern.
//
// A generic rule cannot work here and the near-misses are the reason: `\w+ise` would
// condemn advertise, exercise, surprise, compromise, supervise, promise and devise,
// which are -ise on both sides of the Atlantic; a doubled-consonant rule would condemn
// controlled and compelled, which double in American English too. So each entry is a
// word we mean, with its American form for the failure message.
//
// Stems, not whole words -- `grey` alone misses "greyed" and "greying", `colour` misses
// "recolour". That is exactly how two slipped through the first manual sweep.
// ⚠ THE LISTS THEMSELVES LIVE IN writing-conventions.json AT THE PROJECT ROOT, because
// the .docx checker (scripts/doc-tests/check-docs.py, run by "check docs") enforces the
// same conventions and a second copy would drift. Drift in precisely this kind of list
// is a failure this project has already paid for. The reasoning above still governs what
// may go IN the lists; this file only reads them.
const CONVENTIONS = JSON.parse(readFileSync(join(root, 'writing-conventions.json'), 'utf8'));
const BRITISH = CONVENTIONS.britishSpellings;
const BRITISH_WORDS = CONVENTIONS.britishVocabulary;
const PROPER_NOUNS = CONVENTIONS.properNounExemptions.map((r) => new RegExp(r.source, r.flags));

// ⚠ THE INFLECTION THAT NEEDS ITS OWN ALTERNATIVE: a stem ending in -e DROPS it before
// -ing and -ed, so "practise" + "ing" is "practising", not "practiseing". Matching the
// bare stem plus a suffix misses exactly that form -- and "practising" was one of the
// two words the first hand sweep let through, for the same reason.
const ALL = BRITISH.concat(BRITISH_WORDS);
const AMERICAN = new Map(ALL);
const alternatives = ALL.flatMap(([brit]) =>
    brit.endsWith('e') ? [`${brit}(?:s|d)?`, `${brit.slice(0, -1)}(?:ing|ed|es)`]
                       : [`${brit}(?:s|es|d|ed|ing|ful|ly)?`]);
const rx = new RegExp(`\\b(?:${alternatives.join('|')})\\b`, 'gi');

/** The American form of a matched word, keeping whatever ending it was found with. */
function americanFor(word) {
    const w = word.toLowerCase();
    for (const [brit, amer] of ALL) {
        if (w === brit) return amer;
        if (w.startsWith(brit)) return amer + w.slice(brit.length);          // colour + s
        const dropped = brit.slice(0, -1);
        if (brit.endsWith('e') && w.startsWith(dropped)) {                    // practis + ing
            return amer.replace(/e$/, '') + w.slice(dropped.length);
        }
    }
    return '(American form)';
}

function findBritish(text, where) {
    let t = text;
    for (const p of PROPER_NOUNS) t = t.replace(p, '');
    return [...t.matchAll(rx)].map((m) => `${where}: "${m[0]}" -> "${americanFor(m[0])}"`);
}

// --- pulling the user-visible text out of each kind of file --------------------------

/** String literals only, so comments (a developer audience) are never scanned. */
function stringLiterals(src) {
    // Strip comments first: a URL or an apostrophe inside one would otherwise be read
    // as the start of a literal and swallow the rest of the file.
    const code = src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    const out = [];
    for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
        out.push(m[1] ?? m[2] ?? m[3] ?? '');
    }
    return out.join('\n');
}

/** On-screen text plus the attributes a screen reader speaks. */
function htmlText(src) {
    const noComments = src.replace(/<!--[\s\S]*?-->/g, ' ');
    const attrs = [...noComments.matchAll(/\b(?:aria-label|title|placeholder|alt|value)="([^"]*)"/g)]
        .map((m) => m[1]);
    const text = noComments
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
    return [text, ...attrs].join('\n');
}

// Generated files are skipped: they are built from the sources above, so scanning them
// only reports the same word twice and points at a file nobody should edit.
const GENERATED = new Set(['whats-new.js', 'settings-help.js']);

test('the release notes are in American English', () => {
    const hits = findBritish(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), 'CHANGELOG.md');
    assert.deepEqual(hits, [], `\n${hits.join('\n')}\n`);
});

test('the spoken Settings help is in American English', () => {
    // The app SAYS these out loud, so a British spelling here is heard, not just read.
    const hits = findBritish(readFileSync(join(root, 'settings-help.json'), 'utf8'), 'settings-help.json');
    assert.deepEqual(hits, [], `\n${hits.join('\n')}\n`);
});

test('the app\'s on-screen text is in American English', () => {
    const html = readFileSync(join(root, 'app', 'index.html'), 'utf8');
    let hits = findBritish(htmlText(html), 'app/index.html');

    const dir = join(root, 'app', 'js');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.js') && !GENERATED.has(n))) {
        hits = hits.concat(
            findBritish(stringLiterals(readFileSync(join(dir, f), 'utf8')), `app/js/${f}`));
    }
    assert.deepEqual(hits, [],
        `\nBritish spellings in text the user sees. Code comments are exempt; these are strings.\n${hits.join('\n')}\n`);
});

// ⚠ THE SCOPE ABOVE WAS TOO NARROW AND IT SHOWED (Ken, August 23 2026, finding
// "colour" eight times in a prototype and a figure source written an hour earlier).
// The scan covered the app and the changelog, so every OTHER thing a person reads —
// the documents' own source, the images inside them, and a prototype about to be
// emailed to a team of therapists — had nothing checking it at all. The rule was never
// unclear; it was unenforced everywhere except the app.
//
// SAME SPLIT AS ABOVE: text a reader sees, never developer comments. For the .js
// generators the prose lives in string literals, which is what stringLiterals() pulls.
// For the .html sources the prose is the markup, so comments, <style> and <script> are
// stripped first — a CSS variable named --blue-grey must not fail the build.

/** Visible prose from an HTML file: no comments, no stylesheet, no script. */
function visibleHtml(src) {
    return htmlText(src
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' '));
}

function scanDir(dir, rel) {
    let hits = [];
    let names;
    try { names = readdirSync(dir); } catch { return hits; }
    for (const f of names) {
        const src = () => readFileSync(join(dir, f), 'utf8');
        if (f.endsWith('.js') || f.endsWith('.mjs')) {
            hits = hits.concat(findBritish(stringLiterals(src()), `${rel}/${f}`));
        } else if (f.endsWith('.html')) {
            hits = hits.concat(findBritish(visibleHtml(src()), `${rel}/${f}`));
        }
    }
    return hits;
}

test('the documents\' own source is in American English', () => {
    // These generators ARE the documents: their string literals become the prose, and
    // the .html beside them is captured to the images embedded in them. Nothing else
    // checks either, and the .docx themselves cannot be checked (git-ignored).
    const hits = scanDir(join(root, 'scripts', 'doc-generators'), 'scripts/doc-generators');
    assert.deepEqual(hits, [],
        `\nBritish spellings in document source. Comments are exempt; these are strings and markup.\n${hits.join('\n')}\n`);
});

test('the prototypes are in American English', () => {
    // A prototype is shown to people outside the project, which makes it MORE exposed
    // than the app, not less.
    const hits = scanDir(join(root, 'prototypes'), 'prototypes');
    assert.deepEqual(hits, [], `\n${hits.join('\n')}\n`);
});

// --- the detector itself -------------------------------------------------------------

test('the detector catches the words that actually slipped through', () => {
    // Every one of these was live in the repo on August 11 2026.
    const real = 'its colour, greyed out, a favourite shop, the judgement, maximise the window, '
        + 'practise a conversation, cancelled, recognises, practising, recolour it, catalogue';
    const hits = findBritish(real, 'x').join(' ');
    for (const w of ['colour', 'greyed', 'favourite', 'judgement', 'maximise', 'practise',
                     'cancelled', 'recognises', 'practising', 'recolour', 'catalogue']) {
        assert.ok(hits.includes(`"${w}"`), `missed ${w}`);
    }
});

test('the detector leaves American words, and proper nouns, alone', () => {
    // "dialogue" is the trap: it means a conversation and is correct here. The -ise
    // words below are -ise in American English too, which is why the list is explicit
    // rather than a pattern.
    const fine = 'a natural dialogue, advertise, exercise, surprise, compromise, supervise, '
        + 'promise, devise, franchise, revise, controlled, compelled, patrolled, '
        + 'the color, gray, practice, center, license to speak, '
        + 'CALL Centre, University of Edinburgh';
    assert.deepEqual(findBritish(fine, 'x'), []);
});
