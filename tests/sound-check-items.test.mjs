/* Tier 1 — the Sound Check item bank (app/js/sound-check-items.js).
 *
 * These enforce the authoring rules stated at the top of that file. They matter more
 * than most data tests because a broken rule does not throw: the module still renders,
 * the user still taps, and the answers are quietly about something other than voice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_CHECK_ITEMS, DIMENSIONS, getItem } from '../app/js/sound-check-items.js';

test('every item is structurally complete', () => {
    for (const it of SOUND_CHECK_ITEMS) {
        assert.ok(it.id, 'has an id');
        assert.ok(DIMENSIONS[it.dimension], `${it.id}: known dimension "${it.dimension}"`);
        assert.ok(it.partner && it.partner.trim(), `${it.id}: has a partner turn`);
        assert.ok(it.stipulate && /^Suppose /.test(it.stipulate), `${it.id}: stipulates its content`);
        assert.equal(it.candidates.length, 3, `${it.id}: exactly three candidates`);
        for (const c of it.candidates) assert.ok(c && c.trim(), `${it.id}: no empty candidate`);
    }
});

test('item ids are unique — answers are stored against them', () => {
    const ids = SOUND_CHECK_ITEMS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('every dimension the bank declares is actually probed', () => {
    const used = new Set(SOUND_CHECK_ITEMS.map((i) => i.dimension));
    for (const d of Object.keys(DIMENSIONS)) assert.ok(used.has(d), `nothing probes "${d}"`);
});

test('RULE 3: no candidate names a person, place, job, hobby or health detail', () => {
    // The chosen sentence goes into the prompt. A specific there reads as
    // autobiography and violates the anti-fabrication rule; it also invites the user
    // to answer on "is that true of me" instead of on wording.
    const BANNED = [
        // proper names and places
        /\b(?:Mum|Mom|Dad|Mother|Father|brother|sister|wife|husband|son|daughter|cousin|aunt|uncle|grandma|grandad)\b/i,
        /\b(?:London|Chicago|Starbucks|Tesco|Walmart|Amazon)\b/i,
        // pastimes and interests
        /\b(?:football|soccer|golf|guitar|piano|fishing|knitting|comics|gaming|Netflix|church)\b/i,
        // work and study
        /\b(?:my (?:job|boss|office|shift|class|school|teacher))\b/i,
        // health and disability
        /\b(?:doctor|nurse|hospital|clinic|therapy|medication|wheelchair|appointment|pain|symptoms)\b/i,
    ];
    for (const it of SOUND_CHECK_ITEMS) {
        for (const text of [it.stipulate, it.partner, ...it.candidates]) {
            for (const re of BANNED) {
                assert.ok(!re.test(text), `${it.id}: "${text}" matches banned pattern ${re}`);
            }
        }
    }
});

test('RULE 4: every candidate is speakable — no texting shorthand or symbols', () => {
    // A synthesizer has to say these out loud. "I fw it" reads fine on a card and is
    // unsayable, which is the 0.6.5 finding this guards against.
    const UNSPEAKABLE = [
        /\b(?:fw|lol|omg|idk|imo|btw|tbh|rn|ur|u|r|thx|pls)\b/i,
        /[#@*_~<>{}\[\]|\\/]/,
        /\d+/,                       // digits are read inconsistently across voices
    ];
    for (const it of SOUND_CHECK_ITEMS) {
        for (const c of it.candidates) {
            for (const re of UNSPEAKABLE) {
                assert.ok(!re.test(c), `${it.id}: "${c}" matches unspeakable pattern ${re}`);
            }
        }
    }
});

test('RULE 2 proxy: candidates within an item are genuinely different wordings', () => {
    for (const it of SOUND_CHECK_ITEMS) {
        const set = new Set(it.candidates.map((c) => c.toLowerCase().trim()));
        assert.equal(set.size, 3, `${it.id}: candidates must not repeat`);
        // If two candidates are the same LENGTH to within a couple of characters and
        // share every word, they are probably not varying anything.
        const words = it.candidates.map((c) => new Set(c.toLowerCase().replace(/[^a-z' ]/g, '').split(/\s+/)));
        for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
            const same = [...words[a]].filter((w) => words[b].has(w)).length;
            const union = new Set([...words[a], ...words[b]]).size;
            assert.ok(same / union < 1, `${it.id}: candidates ${a} and ${b} use identical vocabulary`);
        }
    }
});

test('position bias is controlled — the leading end alternates across items', () => {
    // Fixed order per item is deliberate (predictability), so the guard against
    // "always tap the first one" is that the first one is not always the same end.
    const leads = SOUND_CHECK_ITEMS.map((i) => i.leads);
    assert.ok(leads.every(Boolean), 'every item declares which end leads');
    for (const dim of Object.keys(DIMENSIONS)) {
        const inDim = SOUND_CHECK_ITEMS.filter((i) => i.dimension === dim);
        if (inDim.length < 2) continue;
        assert.ok(new Set(inDim.map((i) => i.leads)).size > 1,
            `every "${dim}" item leads with the same end — first-position taps would all agree`);
    }
});

test('getItem finds by id and returns null for an unknown one', () => {
    assert.equal(getItem('economy-weekend').dimension, 'economy');
    assert.equal(getItem('nope'), null);
});
