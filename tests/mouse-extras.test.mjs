// The right mouse button's menu and the wheel press are cancelled everywhere except in a
// text box (app/js/mouse-extras.js, Ken, November 22 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTextBox, shouldCancel } from '../app/js/mouse-extras.js';

const el = (tagName, attrs = {}, parentElement = null, isContentEditable = false) =>
    ({ nodeType: 1, tagName, parentElement, isContentEditable, getAttribute: (k) => attrs[k] ?? null });

test('text boxes are recognized; buttons, checkboxes and plain areas are not', () => {
    assert.equal(isTextBox(el('TEXTAREA')), true);
    assert.equal(isTextBox(el('INPUT', { type: 'text' })), true);
    assert.equal(isTextBox(el('INPUT')), true);                       // no type means text
    assert.equal(isTextBox(el('INPUT', { type: 'checkbox' })), false);
    assert.equal(isTextBox(el('INPUT', { type: 'range' })), false);
    assert.equal(isTextBox(el('BUTTON')), false);
    assert.equal(isTextBox(el('SPAN', {}, el('DIV', {}, null, true))), true);   // inside an editable area
    assert.equal(isTextBox(el('DIV')), false);
    assert.equal(isTextBox(null), false);
});

test('the right button menu and the wheel press are cancelled outside text boxes only', () => {
    const button = el('BUTTON'), box = el('TEXTAREA');
    assert.equal(shouldCancel('contextmenu', 2, button), true);
    assert.equal(shouldCancel('mousedown', 1, button), true);
    assert.equal(shouldCancel('auxclick', 1, button), true);
    assert.equal(shouldCancel('contextmenu', 2, box), false);
    assert.equal(shouldCancel('mousedown', 1, box), false);
    // An ordinary left click is never touched.
    assert.equal(shouldCancel('mousedown', 0, button), false);
});
