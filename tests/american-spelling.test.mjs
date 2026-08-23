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
const BRITISH = [
    // -our
    ['colour', 'color'], ['recolour', 'recolor'], ['favourite', 'favorite'],
    ['favour', 'favor'], ['behaviour', 'behavior'], ['neighbour', 'neighbor'],
    ['honour', 'honor'], ['humour', 'humor'], ['labour', 'labor'],
    ['flavour', 'flavor'], ['rumour', 'rumor'], ['endeavour', 'endeavor'],
    ['saviour', 'savior'], ['harbour', 'harbor'], ['odour', 'odor'],
    // -ise / -isation (only the ones that are genuinely British)
    ['organise', 'organize'], ['organisation', 'organization'],
    ['recognise', 'recognize'], ['personalise', 'personalize'],
    ['personalisation', 'personalization'], ['customise', 'customize'],
    ['prioritise', 'prioritize'], ['summarise', 'summarize'],
    ['apologise', 'apologize'], ['realise', 'realize'], ['emphasise', 'emphasize'],
    ['maximise', 'maximize'], ['minimise', 'minimize'], ['initialise', 'initialize'],
    ['utilise', 'utilize'], ['analyse', 'analyze'], ['paralyse', 'paralyze'],
    // -re
    ['centre', 'center'], ['metre', 'meter'], ['litre', 'liter'],
    ['theatre', 'theater'], ['fibre', 'fiber'], ['calibre', 'caliber'],
    // -ce nouns / -se verbs
    ['licence', 'license'], ['defence', 'defense'], ['offence', 'offense'],
    ['pretence', 'pretense'], ['practise', 'practice'],
    // doubled consonants American does not double
    ['cancelled', 'canceled'], ['cancelling', 'canceling'],
    ['travelled', 'traveled'], ['travelling', 'traveling'],
    ['labelled', 'labeled'], ['labelling', 'labeling'],
    ['modelled', 'modeled'], ['modelling', 'modeling'],
    ['fuelled', 'fueled'], ['signalled', 'signaled'], ['totalled', 'totaled'],
    // single consonants American doubles, and other odds
    ['fulfil', 'fulfill'], ['enrol', 'enroll'], ['instalment', 'installment'],
    ['skilful', 'skillful'], ['wilful', 'willful'],
    ['judgement', 'judgment'], ['grey', 'gray'], ['programme', 'program'],
    ['catalogue', 'catalog'], ['analogue', 'analog'], ['plough', 'plow'],
    ['mould', 'mold'], ['storey', 'story'], ['tyre', 'tire'], ['kerb', 'curb'],
    ['draught', 'draft'], ['cheque', 'check'], ['aluminium', 'aluminum'],
    ['sulphur', 'sulfur'], ['whilst', 'while'], ['learnt', 'learned'],
    ['spelt', 'spelled'], ['amongst', 'among'],
];

// BRITISH VOCABULARY, which is a different failure from British SPELLING and was
// missed for months because the words above are all misspellings (Ken, August 22 2026:
// "Mum" and "the surgery" had both reached a design document). A correctly spelled word
// can still be the wrong word.
//
// ⚠ THIS LIST IS SHORT ON PURPOSE, AND CANNOT BE MADE LONG. Most British vocabulary is
// also perfectly good American vocabulary with a different meaning, so a keen list
// produces false failures instead of catching anything: SURGERY is an operation,
// TABLETS are iPads, a TORCH burns, a BOOT is footwear, PANTS are trousers, a FLAT is
// level, a LIFT is a ride, a CHEMIST does chemistry, a BISCUIT comes with gravy. Every
// one of those is a real word here. Only words that are wrong in EVERY American reading
// belong below — which means the test catches "Mum" and can never catch "the surgery".
// That half is a job for a person reading the sentence, which is why the rule in
// CLAUDE.md carries the judgment and this list only carries the easy cases.
const BRITISH_WORDS = [
    ['mum', 'mom'], ['mummy', 'mommy'], ['lorry', 'truck'], ['petrol', 'gas'],
    ['nappy', 'diaper'], ['pram', 'stroller'], ['pushchair', 'stroller'],
    ['fortnight', 'two weeks'], ['maths', 'math'], ['aeroplane', 'airplane'],
    ['motorway', 'highway'], ['car park', 'parking lot'], ['postcode', 'zip code'],
    ['dustbin', 'trash can'], ['aubergine', 'eggplant'], ['courgette', 'zucchini'],
    ['anticlockwise', 'counterclockwise'], ['telly', 'TV'], ['bloke', 'guy'],
    ['chuffed', 'pleased'], ['knackered', 'exhausted'], ['whinge', 'complain'],
    ['nought', 'zero'], ['jumble sale', 'rummage sale'], ['holidaymaker', 'vacationer'],
];

// ⚠ WORDS THAT LOOK BRITISH AND ARE NOT. Both of these were "corrected" on the first
// manual pass before someone read the sentence:
//   dialogue  -- meaning a conversation, this IS American English; only the UI-box
//                sense is "dialog". It is absent from the list above on purpose.
//   Centre    -- correct inside a proper noun. "CALL Centre, University of Edinburgh"
//                is a cited institution; Americanizing it makes the citation false.
const PROPER_NOUNS = [/CALL Centre/g];

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
