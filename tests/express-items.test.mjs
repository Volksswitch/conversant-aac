/* Tier 1 — Express Panel item data (app/js/express-items.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ITEMS, CATEGORIES, ensureIds, makeId,
         ORIGIN, isUserAuthored, ensureOrigin, markEdits } from '../app/js/express-items.js';

test('every default item has a stable id, a type, and a known category/color', () => {
    for (const it of DEFAULT_ITEMS) {
        assert.ok(it.id, 'has an id');
        assert.ok(['phrase', 'feeling', 'partner'].includes(it.type), `known type: ${it.type}`);
        if (it.type === 'phrase') assert.ok(CATEGORIES[it.cat], `phrase has a known category: ${it.cat}`);
    }
});

test('default item ids are unique', () => {
    const ids = DEFAULT_ITEMS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('ensureIds assigns ids only to items missing one, preserving existing ids', () => {
    const withId = { id: 'keep-me', type: 'phrase', text: 'Yes', cat: 'affirm' };
    const noId = { type: 'phrase', text: 'No', cat: 'affirm' };
    const [a, b] = ensureIds([withId, noId]);
    assert.equal(a.id, 'keep-me');
    assert.ok(b.id, 'the id-less item got one');
    assert.notEqual(b.id, '');
});

test('makeId returns distinct ids', () => {
    assert.notEqual(makeId(), makeId());
});

// --- provenance (Ken, August 7 2026) -----------------------------------------
// Whose words are in a cell. Wrong here and the voice layer credits OUR default
// phrases to the user, which is the specific error the field exists to prevent.

test('every shipped default is marked as ours, not the user phrase set', () => {
    for (const it of DEFAULT_ITEMS) {
        assert.equal(it.origin, ORIGIN.DEFAULT, `${it.text} must be a default`);
        assert.equal(isUserAuthored(it), false);
    }
});

test('the panel ships HALF-populated, not full', () => {
    // Half of a ~32-cell layout. The exact number is a judgment call; that it is
    // materially less than the layout's capacity is the design (endowed progress).
    assert.ok(DEFAULT_ITEMS.length <= 18, `expected roughly half a layout, got ${DEFAULT_ITEMS.length}`);
    const texts = DEFAULT_ITEMS.map((i) => i.text);
    for (const keep of ['Yes', 'No', 'Okay', 'Please', 'Thank you', 'Sorry', 'Wait', 'Help', 'Hi', 'Bye'])
        assert.ok(texts.includes(keep), `plumbing kept: ${keep}`);
    for (const gone of ["That's funny", 'See you later', 'I think so', 'I agree'])
        assert.ok(!texts.includes(gone), `flavored item vacated: ${gone}`);
});

test('MIGRATION: a retired default is still recognized as ours, not credited to the user', () => {
    // The sixteen defaults removed on Aug 7 2026 are in legacy files with no origin
    // field. Matching only against the CURRENT defaults would mark them user-authored.
    const legacy = [{ id: 'd8', type: 'phrase', text: 'Yes please', cat: 'affirm' },
                    { id: 'd16', type: 'phrase', text: "That's funny", cat: 'cont' }];
    for (const it of ensureOrigin(legacy)) {
        assert.equal(it.origin, ORIGIN.DEFAULT, `${it.text} was ours`);
        assert.equal(isUserAuthored(it), false);
    }
});

test('MIGRATION: a legacy phrase we never shipped belongs to the user', () => {
    const [it] = ensureOrigin([{ id: 'x1', type: 'phrase', text: "Let's go!", cat: 'social' }]);
    assert.equal(it.origin, ORIGIN.EDITED);
    assert.ok(isUserAuthored(it));
});

test('MIGRATION: partners and places always belong to the user, whatever they are called', () => {
    const out = ensureOrigin([{ id: 'p1', type: 'partner', name: 'Yes' },   // adversarial name
                              { id: 'q1', type: 'place', name: 'Okay' }]);
    for (const it of out) assert.ok(isUserAuthored(it), `${it.type} is the user's`);
});

test('MIGRATION does not overwrite an origin that is already set', () => {
    const [it] = ensureOrigin([{ id: 'd0', type: 'phrase', text: 'Yes', cat: 'affirm', origin: ORIGIN.EDITED }]);
    assert.equal(it.origin, ORIGIN.EDITED);
});

test('editing a default flips it to the user, without touching its neighbors', () => {
    const prev = DEFAULT_ITEMS.map((x) => ({ ...x }));
    const next = prev.map((x) => (x.text === 'Okay' ? { ...x, text: 'Righto' } : { ...x }));
    const out = markEdits(next, prev);
    const changed = out.find((x) => x.text === 'Righto');
    assert.equal(changed.origin, ORIGIN.EDITED);
    assert.equal(out.find((x) => x.text === 'Yes').origin, ORIGIN.DEFAULT, 'untouched stays ours');
});

test('recoloring counts as a touch — the user chose that color', () => {
    const prev = [{ id: 'd0', type: 'phrase', text: 'Yes', cat: 'affirm', origin: ORIGIN.DEFAULT }];
    const out = markEdits([{ ...prev[0], cat: 'social' }], prev);
    assert.equal(out[0].origin, ORIGIN.EDITED);
});

test('a newly added item belongs to the user', () => {
    const prev = [{ id: 'd0', type: 'phrase', text: 'Yes', cat: 'affirm', origin: ORIGIN.DEFAULT }];
    const out = markEdits(ensureIds([...prev, { type: 'phrase', text: 'That is clutch', cat: 'social' }]), prev);
    assert.equal(out[1].origin, ORIGIN.ADDED);
    assert.ok(isUserAuthored(out[1]));
});

test('REORDERING is not an edit — position is not authorship', () => {
    const prev = DEFAULT_ITEMS.map((x) => ({ ...x }));
    const out = markEdits([...prev].reverse(), prev);
    assert.ok(out.every((x) => x.origin === ORIGIN.DEFAULT), 'moving our phrases does not make them theirs');
});
