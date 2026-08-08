/* Tier 1 — the pronunciation lexicon (app/js/pronunciation.js).
 *
 * Only the pure halves are exercised here: buildLexicon and substitute. `apply`
 * reads the live people and places, which belongs to the browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLexicon, substitute } from '../app/js/pronunciation.js';

const person = (o) => ({ name: '', nickname: '', pronunciation: '', nicknamePronunciation: '', ...o });
const place = (o) => ({ name: '', pronunciation: '', ...o });

test('nothing is collected until the user actually sets a respelling', () => {
    // The blast radius is kept small by this alone: a name is only ever rewritten
    // because someone decided the voice was getting it wrong.
    assert.deepEqual(buildLexicon([person({ name: 'Siobhan' })], [place({ name: 'Starbucks' })]), []);
});

test('a respelling identical to the name is not an entry', () => {
    assert.deepEqual(buildLexicon([person({ name: 'Ann', pronunciation: 'Ann' })], []), []);
});

test('name and nickname are separate entries — the nickname is spoken more often', () => {
    const lex = buildLexicon([person({
        name: 'Siobhan', pronunciation: 'Shiv-awn',
        nickname: 'J.J.', nicknamePronunciation: 'Jay Jay',
    })], []);
    assert.deepEqual(lex.map((e) => [e.from, e.to]).sort(),
        [['J.J.', 'Jay Jay'], ['Siobhan', 'Shiv-awn']]);
});

test('places contribute too', () => {
    const lex = buildLexicon([], [place({ name: 'Volksswitch', pronunciation: 'Folks-switch' })]);
    assert.deepEqual(lex, [{ from: 'Volksswitch', to: 'Folks-switch' }]);
});

test('LONGEST FIRST — a short name must not claim part of a longer one', () => {
    // Regex alternation takes the first branch that matches, so ordering is what
    // stops "Ann" eating the start of "Annabel" and making the longer entry dead.
    const lex = buildLexicon([
        person({ name: 'Ann', pronunciation: 'Anne' }),
        person({ name: 'Annabel', pronunciation: 'Anna-bell' }),
    ], []);
    assert.equal(lex[0].from, 'Annabel');
    assert.equal(substitute('Annabel and Ann arrived.', lex), 'Anna-bell and Anne arrived.');
});

test('substitution is WHOLE-WORD — a name is never found inside another word', () => {
    const lex = [{ from: 'Ann', to: 'Anne' }];
    assert.equal(substitute('I planned a banner for Ann.', lex), 'I planned a banner for Anne.');
});

test('substitution is CASE-SENSITIVE — the defence against a name that is also a word', () => {
    const lex = [{ from: 'Bill', to: 'Beel' }];
    assert.equal(substitute('Bill said to pay the bill.', lex), 'Beel said to pay the bill.');
});

test('a name with punctuation in it still matches', () => {
    const lex = [{ from: 'J.J.', to: 'Jay Jay' }];
    assert.equal(substitute('I saw J.J. today.', lex), 'I saw Jay Jay today.');
});

test('ONE PASS — a respelling containing another name is not rewritten again', () => {
    // "Folks-switch" contains nothing here, but a respelling that happened to include
    // a second name must be left alone; a second pass would mangle it.
    const lex = buildLexicon([person({ name: 'Ann', pronunciation: 'Anne' })],
                             [place({ name: 'Home', pronunciation: 'Ann Street' })]);
    assert.equal(substitute('Ann is at Home.', lex), 'Anne is at Ann Street.');
});

test('text with nothing to change is returned untouched, and an empty lexicon is a no-op', () => {
    assert.equal(substitute('How was your weekend?', [{ from: 'Ann', to: 'Anne' }]), 'How was your weekend?');
    assert.equal(substitute('Anything at all', []), 'Anything at all');
    assert.equal(substitute('', [{ from: 'Ann', to: 'Anne' }]), '');
});

test('regex metacharacters in a name are literal, not a pattern', () => {
    // A name is user input. Unescaped, something like "A+B" would either throw or
    // match the wrong thing, and the failure would surface as the app losing its voice.
    const lex = [{ from: 'A+B', to: 'Ay plus Bee' }];
    assert.equal(substitute('The A+B group met.', lex), 'The Ay plus Bee group met.');
});
