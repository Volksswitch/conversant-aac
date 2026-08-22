/* Tier 1 — Express Panel item data (app/js/express-items.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ITEMS, CATEGORIES, ensureIds, makeId,
         ORIGIN, isUserAuthored, ensureOrigin, markEdits,
         newEmptyItem, isEmptyItem, chipStartIndex } from '../app/js/express-items.js';

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

// --- undefined cells (Ken, August 8 2026) ------------------------------------
// An empty item holds a grid POSITION and carries no words. Both halves matter:
// without it a cell past the end of the list cannot be addressed at all, and if it
// counted as the user's it would inflate every measure of what they have written.

test('an empty slot is identifiable and carries no words', () => {
    const it = newEmptyItem();
    assert.ok(it.id);
    assert.equal(it.type, 'empty');
    assert.ok(isEmptyItem(it));
    assert.equal(it.text, undefined);
    assert.equal(it.name, undefined);
});

test('an empty slot is NOT counted as the user\'s — it says nothing about them', () => {
    assert.equal(isUserAuthored(newEmptyItem()), false);
    // ...and survives a save, which re-stamps provenance by diffing.
    const prev = [{ id: 'd0', type: 'phrase', text: 'Yes', cat: 'affirm', origin: ORIGIN.DEFAULT }];
    const out = markEdits([...prev, newEmptyItem()], prev);
    assert.equal(isUserAuthored(out[1]), false, 'padding cells are not authorship');
});

test('MIGRATION: an empty slot with no origin field is not credited to the user', () => {
    // The text test would read its missing text as "not one of ours" and hand it over.
    const [it] = ensureOrigin([{ id: 'e1', type: 'empty' }]);
    assert.equal(it.origin, ORIGIN.DEFAULT);
    assert.equal(isUserAuthored(it), false);
});

test('DEFINING an empty slot in place makes it the user\'s, at the same position', () => {
    // What the editor does when the user picks a type for a tapped cell: replace the
    // placeholder where it stands. The position is the whole point of tap-to-define.
    const prev = [{ id: 'd0', type: 'phrase', text: 'Yes', cat: 'affirm', origin: ORIGIN.DEFAULT },
                  { id: 'e1', type: 'empty', origin: ORIGIN.DEFAULT },
                  { id: 'e2', type: 'empty', origin: ORIGIN.DEFAULT }];
    const next = prev.map((x, i) => (i === 1 ? { id: makeId(), type: 'phrase', text: 'Righto', cat: 'social' } : { ...x }));
    const out = markEdits(next, prev);
    assert.equal(out[1].text, 'Righto', 'landed in the tapped cell, not appended');
    assert.ok(isUserAuthored(out[1]));
    assert.ok(isEmptyItem(out[2]), 'the slot after it is still open');
});

// --- where the partner's offered alternatives sit ----------------------------
// The behavior these guard replaced one that broke spatial stability across the
// WHOLE panel for a single turn: chips used to take the FIRST cells, so every
// phrase shifted by however many alternatives were on offer.

test('CHIPS TAKE THE LAST CELLS, so no phrase ever moves', () => {
    const cells = 33;
    for (const n of [1, 2, 3, 4]) {
        const start = chipStartIndex(cells, n);
        assert.equal(start, cells - n, `${n} chips start ${n} from the end`);
        // Every cell before the start still draws the item whose ordinal it is —
        // which is the whole property: an item's cell does not depend on the chips.
        for (let i = 0; i < start; i++) assert.ok(i < start, 'item cell, unmoved');
    }
});

test('with NO chips on offer the panel is exactly what it was', () => {
    // No ordinal can reach the start, so every cell draws its own item.
    const cells = 33;
    assert.equal(chipStartIndex(cells, 0), cells);
});

test('more alternatives than cells does not push a chip off the front', () => {
    // The surplus simply does not render; the response cards carry the full set.
    assert.equal(chipStartIndex(2, 4), 0);
});

test('a nonsense count cannot produce a negative start', () => {
    // A negative start would make every cell a chip cell and blank the panel.
    for (const [c, n] of [[undefined, 3], [10, -2], [null, null], ['x', 'y']]) {
        assert.ok(chipStartIndex(c, n) >= 0);
    }
});
