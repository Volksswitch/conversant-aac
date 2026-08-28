/* A Command Bar press while "In my own words" is open (Ken, August 27 2026).
 *
 * ⚠ THESE READ THE SOURCE, because app.js cannot be imported by a test - it reaches
 * for the document the moment it loads. The behavior is a wiring decision that lives
 * nowhere else, and the failure it guards is SILENT in the worst way: get it wrong and
 * the box simply stays up over the cards, or the button quietly needs pressing twice.
 * Nothing errors either way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
const LINES = src.split(String.fromCharCode(10));

// Every Command Bar control that must dismiss the box first, with the wiring call
// that registers it.
const DISMISSES = [
    ['Listen', 'ui.onListenClick'],
    ['Settings', 'ui.onSettingsClick'],
    ['Start conversation', 'ui.onInitiateClick'],
    ['Repeat what I said', 'ui.onSayAgainClick'],
    ['Ask them to repeat', 'ui.onPardonClick'],
    ['Wrap up', 'ui.onWindDownClick'],
    ['End conversation', 'ui.onEndConversationClick'],
];

// The two deliberate exemptions: both leave the box open with the typing intact.
const EXEMPT = [
    ['Hold on', 'ui.onHoldOnClick'],
    ["Don't save this conversation", 'ui.onPrivacyToggleClick'],
];

function wiringFor(call) {
    const needle = call + '(';
    const line = LINES.find(l => l.includes(needle) && !l.trimStart().startsWith('//'));
    assert.ok(line, `${call} is not wired at all`);
    return line.slice(line.indexOf(needle) + needle.length);
}

for (const [label, call] of DISMISSES) {
    test(`"${label}" dismisses the composer before it acts`, () => {
        assert.match(wiringFor(call), /^whileComposerClosed\(/,
            `${label} must be wired through whileComposerClosed, or a press while ` +
            `"In my own words" is open leaves the box over the Response Panel`);
    });
}

for (const [label, call] of EXEMPT) {
    test(`"${label}" leaves the composer alone`, () => {
        assert.doesNotMatch(wiringFor(call), /whileComposerClosed/,
            `${label} is a deliberate exemption - it must not close the box or the ` +
            `user loses what they were typing`);
    });
}

test('the wrapper cancels the box rather than speaking from it, and does not swallow the press', () => {
    const body = src.match(/function whileComposerClosed\(handler\) \{[\s\S]*?\n\}/);
    assert.ok(body, 'whileComposerClosed is missing');
    const text = body[0];
    // Cancel, never Speak: nothing typed may be said by a Command Bar press.
    assert.match(text, /handleCancelComposed\(\)/);
    assert.doesNotMatch(text, /handleSpeakComposed|handleReframe/);
    // The button still runs - otherwise every one of these is a dead first tap.
    assert.match(text, /return handler\(/);
});
