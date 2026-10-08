/* The response options arrangement is kept per keyboard position (Ken, October 8 2026).
 *
 * He accepted the suggested layout on a sideways tablet (keyboard at the bottom, options
 * in a row), moved the keyboard to the side, and the options stayed in a row. The layout
 * and the screen proportions were already kept per position; the arrangement was the one
 * setting that was not, so the side position inherited the bottom one's choice.
 */
import './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../app/js/storage.js';
import { resetLocalStorage } from './env.mjs';
import { suggestionFor, applyToSettings } from '../app/js/layout-suggestions.js';

const put = (o) => globalThis.localStorage.setItem('aac_settings', JSON.stringify(o));

beforeEach(() => resetLocalStorage());

test('never set: the old rule, two by two beside a side keyboard, a row otherwise', () => {
    assert.equal(storage.loadOptionsArrangement('side'), 'grid');
    assert.equal(storage.loadOptionsArrangement('bottom'), 'row');
});

test('an older single value still applies to both positions', () => {
    put({ optionsArrangement: 'grid-below' });
    assert.equal(storage.loadOptionsArrangement('side'), 'grid-below');
    assert.equal(storage.loadOptionsArrangement('bottom'), 'grid-below');
});

test('changing it for one position leaves the other alone', () => {
    put({ optionsArrangement: 'grid-below', keyboardDock: 'bottom' });
    storage.saveOptionsArrangement('row', 'bottom');
    assert.equal(storage.loadOptionsArrangement('bottom'), 'row');
    assert.equal(storage.loadOptionsArrangement('side'), 'grid-below');
});

test('the suggestion, then a move to the side, gives the side arrangement', () => {
    storage.applyLayoutSuggestion(suggestionFor(1368, 912), applyToSettings);
    assert.equal(storage.loadOptionsArrangement('bottom'), 'row');
    storage.saveKeyboardDock('side');
    assert.equal(storage.loadOptionsArrangement(), 'grid');
    assert.equal(storage.loadSideLayout(), 'S2');
});
