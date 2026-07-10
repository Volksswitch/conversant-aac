/* Tier 1 — Express Panel item data (app/js/express-items.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ITEMS, CATEGORIES, ensureIds, makeId } from '../app/js/express-items.js';

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
