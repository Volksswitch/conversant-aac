/* Tier 1 — keyboard layout data (app/js/keyboard-layouts.js).
 *
 * The load-bearing invariant is Spatial Stability: one static keyguard overlays
 * BOTH the letters page and the symbols page, so buildSymbolsPage() must produce a
 * page geometrically congruent with the letters layout it was built from — same
 * rows, same per-cell spans, non-letter cells (space/shift/backspace/enter/blank/
 * pred) left exactly in place; only letter cells become symbols and the 123 key
 * becomes ABC.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUTS, buildSymbolsPage, SIDE_LAYOUTS, BOTTOM_LAYOUTS } from '../app/js/keyboard-layouts.js';

test('every layout has a name, a dock, and rows', () => {
    for (const [id, layout] of Object.entries(LAYOUTS)) {
        assert.ok(layout.name, `${id} has a name`);
        assert.ok(['side', 'bottom'].includes(layout.dock), `${id} docks side|bottom`);
        assert.ok(Array.isArray(layout.rows) && layout.rows.length, `${id} has rows`);
    }
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
                    // space / shift / backspace / enter / blank / pred are untouched.
                    assert.deepEqual(out, cell, `${id} r${r}c${c}: non-letter cell unchanged`);
                }
            });
        });
    }
});

test('the Settings menu lists split cleanly into side and bottom layouts', () => {
    assert.ok(SIDE_LAYOUTS.length >= 1 && BOTTOM_LAYOUTS.length >= 1);
    assert.ok(SIDE_LAYOUTS.every((l) => LAYOUTS[l.id].dock === 'side'));
    assert.ok(BOTTOM_LAYOUTS.every((l) => LAYOUTS[l.id].dock === 'bottom'));
    // Every menu entry names a real layout.
    for (const l of [...SIDE_LAYOUTS, ...BOTTOM_LAYOUTS]) {
        assert.equal(l.name, LAYOUTS[l.id].name);
    }
});
