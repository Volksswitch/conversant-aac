/* Choosing the practice partner's paid voice on "Auto" (CR-093). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickOtherVoice } from '../app/js/speech-catalog.js';

const ids = (...a) => a.map((id) => ({ id }));

test('a Google voice in the same language is preferred to the first in the list', () => {
    const list = ids('af-ZA-Standard-A', 'en-US-Neural2-F', 'en-US-Neural2-D');
    assert.equal(pickOtherVoice(list, 'en-US-Neural2-F'), 'en-US-Neural2-D');
});

test('a British user keeps a British partner where one exists', () => {
    const list = ids('en-US-Neural2-D', 'en-GB-Neural2-B', 'en-GB-Neural2-A');
    assert.equal(pickOtherVoice(list, 'en-GB-Neural2-A'), 'en-GB-Neural2-B');
});

test('with no other voice in the language, any other voice beats the user\'s own', () => {
    assert.equal(pickOtherVoice(ids('fr-FR-A', 'en-US-A'), 'en-US-A'), 'fr-FR-A');
});

test('voices with no language in the id are all acceptable', () => {
    assert.equal(pickOtherVoice(ids('alloy', 'nova'), 'alloy'), 'nova');
});

test('the user\'s own voice comes back only when there is no other', () => {
    assert.equal(pickOtherVoice(ids('alloy'), 'alloy'), 'alloy');
    assert.equal(pickOtherVoice([], 'alloy'), 'alloy');
});
