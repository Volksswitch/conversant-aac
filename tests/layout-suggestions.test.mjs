/* Tier 1 - suggested starting layouts (app/js/layout-suggestions.js), Ken, October 8
 * 2026. The app starts with the suggestion for its screen at first launch, and one
 * Settings button applies it again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenKind, suggestionFor, applyToSettings, SUGGESTIONS } from '../app/js/layout-suggestions.js';
import { LAYOUTS } from '../app/js/keyboard-layouts.js';

test('screens are sorted into phone or tablet, upright or sideways', () => {
    assert.equal(screenKind(412, 915), 'phone-upright');
    assert.equal(screenKind(915, 412), 'phone-sideways');
    assert.equal(screenKind(820, 1180), 'tablet-upright');
    assert.equal(screenKind(1180, 820), 'tablet-sideways');
    assert.equal(screenKind(1368, 912), 'tablet-sideways');
    assert.equal(screenKind(744, 1133), 'tablet-upright');   // iPad mini is a tablet
});

test('the layouts Ken chose', () => {
    // Upright: Alphabet 5 x 7. Sideways, keyboard at the side: Alphabet 4 x 9.
    // Sideways, keyboard at the bottom: QWERTY. A sideways tablet starts at the bottom.
    assert.equal(SUGGESTIONS['phone-upright'].bottom.layout, 'S1');
    assert.equal(SUGGESTIONS['tablet-upright'].bottom.layout, 'S1');
    assert.equal(SUGGESTIONS['tablet-sideways'].keyboardDock, 'bottom');
    assert.equal(SUGGESTIONS['tablet-sideways'].bottom.layout, 'B11');
    assert.equal(SUGGESTIONS['tablet-sideways'].side.layout, 'S2');
    assert.equal(SUGGESTIONS['phone-sideways'].keyboardDock, 'side');
    assert.equal(SUGGESTIONS['phone-sideways'].side.layout, 'S2');
    for (const s of Object.values(SUGGESTIONS)) {
        for (const d of ['bottom', 'side']) assert.ok(LAYOUTS[s[d].layout], s.label + ' ' + d);
    }
});

test('a sideways tablet is what the app always did', () => {
    const s = applyToSettings({}, suggestionFor(1368, 912));
    assert.equal(s.keyboardDock, 'bottom');
    assert.equal(s.bottomLayout, 'B11');
    assert.equal(s.optionsArrangement.bottom, 'row');
    assert.deepEqual(s.convLayout.bottom, { command: 0.10, response: 0.30, dock: 0.30 });
});

// Ken, October 8 2026: he accepted the suggestion on a sideways tablet, moved the
// keyboard to the side, and got the old side layout with the options in a row.
test('moving the keyboard to the side finds the side suggestion waiting', () => {
    const s = applyToSettings({ sideLayout: 'S1', convLayout: { side: { response: 0.6 } } },
        suggestionFor(1368, 912));
    assert.equal(s.sideLayout, 'S2');
    assert.equal(s.optionsArrangement.side, 'grid', 'two by two, New 4 beside');
    assert.deepEqual(s.convLayout.side, { command: 0.10, response: 0.50, dock: 0.30 });
});

test('applying a suggestion leaves other settings alone', () => {
    const before = { convLayout: { side: { dock: 0.5 } }, voiceURI: 'x' };
    const s = applyToSettings(before, suggestionFor(412, 915));
    assert.equal(s.keyboardDock, 'bottom');
    assert.equal(s.bottomLayout, 'S1');
    assert.equal(s.optionsArrangement.bottom, 'grid-below');
    assert.equal(s.voiceURI, 'x');
    assert.equal(s.layoutSuggestion, 'phone-upright');
    assert.deepEqual(before.convLayout, { side: { dock: 0.5 } }, 'input not changed');
});

test('every suggestion leaves the transcript some room', () => {
    for (const s of Object.values(SUGGESTIONS)) {
        for (const d of ['bottom', 'side']) {
            const c = s[d].convLayout;
            const used = c.command + c.response + (d === 'side' ? 0 : c.dock);
            assert.ok(used <= 0.85, `${s.label} ${d}: ${used}`);
        }
    }
});
