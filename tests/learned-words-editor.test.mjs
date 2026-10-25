/* Tier 1 - which names the typing suggestions are given (October 25 2026).
 * The rule that matters is privacy: a suggestion is on screen while someone else may be
 * watching, so anything the user marked Private must never be offered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { namesForTyping } from '../app/js/learned-words-editor.js';

test('Private people, places and names are never offered as suggestions', () => {
    const out = namesForTyping({
        people: [
            { name: 'Siobhan', nickname: 'Shiv', private: false },
            { name: 'Dr. Secret', nickname: '', private: true },
        ],
        places: [{ name: 'Pulp Comics', private: false }, { name: 'Oncology clinic', private: true }],
        ownNames: [{ value: 'Marc', private: false }, { value: 'Marcus Delgado', private: true }, { value: null, private: false }],
        spokenWords: [{ word: 'Humira', say: 'hyoo-MEER-uh' }],
    });
    assert.deepEqual(out, ['Siobhan', 'Shiv', 'Pulp Comics', 'Marc', 'Humira']);
    assert.ok(!out.includes('hyoo-MEER-uh'), 'a respelling is never suggested');
});
