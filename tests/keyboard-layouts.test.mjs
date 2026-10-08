/* Tier 1 — keyboard layout data (app/js/keyboard-layouts.js).
 *
 * The load-bearing invariant is Spatial Stability: one static keyguard overlays
 * BOTH the letters page and the symbols page, so buildSymbolsPage() must produce a
 * page geometrically congruent with the letters layout it was built from — same
 * rows, same per-cell spans, non-letter cells (space/shift/backspace/enter/blank/
 * blank) left exactly in place; only letter cells become symbols and the 123 key
 * becomes ABC.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, buildSymbolsPage, LAYOUT_LIST, LAYOUT_ALIASES, resolveLayoutId,
         layoutShape, panelRoles, panelPositionCount } from '../app/js/keyboard-layouts.js';

test('every layout has rows and a name that describes its grid', () => {
    for (const [id, layout] of Object.entries(LAYOUTS)) {
        assert.ok(Array.isArray(layout.rows) && layout.rows.length, `${id} has rows`);
        const { across, down } = layoutShape(layout.rows);
        assert.ok(layout.name.includes(`${across} × ${down}`), `${id}: "${layout.name}" names ${across} × ${down}`);
        assert.ok(layout.name.endsWith(`${panelPositionCount(layout.rows)} buttons`), `${id}: button count in name`);
    }
});

// Ken, October 8 2026: the fourteen distinct shapes in the Layout Review plus Side
// Layout 7, which differs only in letter order.
test('fifteen layouts, all offered in one list, narrowest first', () => {
    assert.equal(Object.keys(LAYOUTS).length, 15);
    assert.deepEqual(new Set(LAYOUT_LIST.map((l) => l.id)), new Set(Object.keys(LAYOUTS)));
    const across = LAYOUT_LIST.map((l) => layoutShape(LAYOUTS[l.id].rows).across);
    assert.deepEqual(across, [...across].sort((a, b) => a - b));
    for (const l of LAYOUT_LIST) assert.equal(l.name, LAYOUTS[l.id].name);
});

// A removed layout must land on one of the SAME SHAPE, or the user's Express Panel
// and keyguard change under them. These are the shapes the removed layouts had.
test('a removed layout resolves to a kept layout of the same shape', () => {
    const was = { B5: '9 × 4', B6: '9 × 4', B10: '9 × 4', B7: '10 × 4', S4: '6 × 6', S5: '5 × 7', S9: '5 × 7' };
    assert.deepEqual(Object.keys(LAYOUT_ALIASES).sort(), Object.keys(was).sort());
    for (const [old, shape] of Object.entries(was)) {
        const kept = resolveLayoutId(old, null);
        assert.ok(LAYOUTS[kept], `${old} resolves to a real layout`);
        const { across, down } = layoutShape(LAYOUTS[kept].rows);
        assert.equal(`${across} × ${down}`, shape, `${old} -> ${kept}`);
    }
    assert.equal(resolveLayoutId('S1', 'B11'), 'S1');
    assert.equal(resolveLayoutId(undefined, 'B11'), 'B11');
    assert.equal(resolveLayoutId('nonsense', 'B11'), 'B11');
});

test('buildSymbolsPage is geometrically congruent with every letters layout', () => {
    for (const [id, layout] of Object.entries(LAYOUTS)) {
        const sym = buildSymbolsPage(layout.rows);
        assert.equal(sym.length, layout.rows.length, `${id}: same row count`);
        layout.rows.forEach((row, r) => {
            assert.equal(sym[r].length, row.length, `${id} row ${r}: same cell count`);
            row.forEach((cell, c) => {
                const out = sym[r][c];
                assert.equal(out.span, cell.span, `${id} r${r}c${c}: span preserved`);
                if (cell.kind === 'char') {
                    // A letter cell becomes a symbol char OR a blank (pool exhausted),
                    // never moves and never changes span.
                    assert.ok(out.kind === 'char' || out.kind === 'blank', `${id} r${r}c${c}: char→symbol|blank`);
                } else if (cell.kind === 'action' && cell.action === 'page') {
                    assert.equal(out.label, 'ABC', `${id} r${r}c${c}: 123 becomes ABC`);
                } else {
                    // space / shift / backspace / enter / blank are untouched.
                    assert.deepEqual(out, cell, `${id} r${r}c${c}: non-letter cell unchanged`);
                }
            });
        });
    }
});


// No layout may carry a word-prediction cell (Ken, August 23 2026). Prediction is an
// inline ghost inside the compose box; it has never been a key on the panel or the
// keyboard, and the cell type that advertised it was defined and never used. Nothing
// downstream handles that kind any more, so a layout that reintroduced one would draw
// it as a live button.
test('no layout contains a prediction cell', () => {
    for (const [id, def] of Object.entries(LAYOUTS)) {
        for (const row of def.rows) {
            for (const cell of row) {
                assert.notEqual(cell.kind, 'pred', `${id} (${def.name}) has a prediction cell`);
            }
        }
    }
});

// The panel's reading of a layout, which is not the keyboard's reading of it.
test('exactly one compose button per layout, however many space keys it has', () => {
    for (const [id, def] of Object.entries(LAYOUTS)) {
        const roles = panelRoles(def.rows).flat();
        const compose = roles.filter((c) => c.role === 'compose').length;
        const spaces = def.rows.flat().filter((c) => c.kind === 'space').length;
        assert.equal(compose, 1, `${id} (${def.name}) draws ${compose} compose buttons`);
        if (spaces > 1) {
            // Bottom Layout 8 is the split keyboard: one space key per thumb. The
            // second is a panel position, not a second "In my own words".
            assert.equal(roles.filter((c) => c.role === 'position').length,
                panelPositionCount(def.rows));
        }
    }
});

test('the split keyboard gains a position rather than a duplicate button', () => {
    // Every other layout offers 32; B8 offers 33 because its second space key is a
    // place a phrase can go. Before August 23 2026 it was a second compose button.
    assert.equal(panelPositionCount(LAYOUTS.B8.rows), 33);
    assert.equal(panelPositionCount(LAYOUTS.B1.rows), 32);
});

test('a layout with no space key still has no compose button, and does not crash', () => {
    const roles = panelRoles([[{ kind: 'char', span: 1 }, { kind: 'blank', span: 1 }]]);
    assert.deepEqual(roles[0].map((c) => c.role), ['position', 'gap']);
});

// CR-044. Every layout but Side Layout 10 has a page key. S10 is the known exception
// (its symbols are unreachable until Ken decides whether to change its key layout -
// see TODO.md); the keyboard never opens it on the symbols page.
test('only Side Layout 10 lacks a page key', async () => {
    const { LAYOUTS } = await import('../app/js/keyboard-layouts.js');
    const without = Object.entries(LAYOUTS)
        .filter(([, l]) => !(l.rows || []).some((row) => row.some((c) => c && c.action === 'page')))
        .map(([id]) => id);
    assert.deepEqual(without, ['S10']);
});
