/* Tier 1 - fill-ins in fixed phrases, and the user's own name spoken correctly
 * (Ken, October 9 2026).
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fillIn, greetingFor, FILL_INS } from '../app/js/fill-ins.js';
import { buildLexicon, substitute } from '../app/js/pronunciation.js';
import * as engine from '../app/js/engine.js';

test('their name fills in, and the phrase still reads without it', () => {
    assert.equal(fillIn('Thank you, {name}.', { name: 'Mom' }), 'Thank you, Mom.');
    assert.equal(fillIn('Thank you, {name}.'), 'Thank you.');
    assert.equal(fillIn('Hi {name}, got a minute?'), 'Hi, got a minute?');
    assert.equal(fillIn('See you, {name}!', { name: 'A$1' }), 'See you, A$1!');
});

test('the greeting follows the clock', () => {
    assert.equal(greetingFor(new Date(2026, 9, 9, 9)), 'Good morning');
    assert.equal(greetingFor(new Date(2026, 9, 9, 13)), 'Good afternoon');
    assert.equal(greetingFor(new Date(2026, 9, 9, 18)), 'Good evening');
    assert.equal(fillIn('{greeting}, {name}!', { name: 'Ramon', now: new Date(2026, 9, 9, 9) }), 'Good morning, Ramon!');
    assert.equal(fillIn('{greeting}, {name}!', { now: new Date(2026, 9, 9, 19) }), 'Good evening!');
});

test('only two fill-ins: the user\'s own name was dropped (it never changes)', () => {
    assert.deepEqual(FILL_INS.map((f) => f.token), ['{name}', '{greeting}']);
});

test('goodbyes and wrap-ups are filled in when shown, like the openers', () => {
    engine.setFillInProvider(() => ({ name: 'Devon' }));
    try {
        engine.setConversationPhrases({ closings: ['Bye, {name}!'], windDowns: ['{greeting} was fun, {name}.'] });
        const bye = engine.showClosings().palette.map((m) => m.text);
        assert.ok(bye.includes('Bye, Devon!'), bye.join(' | '));
        const wd = engine.windDown().palette.map((m) => m.text);
        assert.ok(wd.every((t) => !t.includes('{')), wd.join(' | '));
    } finally { engine.setFillInProvider(() => ({ name: '' })); engine.reset(); }
});

test('the user\'s own name gets its "How to say it" spelling everywhere', () => {
    const lex = buildLexicon([], [], { name: 'Siobhan', pronunciation: 'Shiv-awn' });
    assert.equal(substitute("Hi, I'm Siobhan.", lex), "Hi, I'm Shiv-awn.");
});

test('how the user\'s name is said is kept out of what the AI is told', () => {
    const reg = JSON.parse(readFileSync(new URL('../app/data/worldview-questions.json', import.meta.url), 'utf8'));
    const f = reg.modules.flatMap((m) => m.fields).find((x) => x.key === 'name_pronunciation');
    assert.equal(f && f.directive, 'speakOnly');
    const wv = readFileSync(new URL('../app/js/worldview.js', import.meta.url), 'utf8');
    assert.match(wv, /if \(f\.directive === 'speakOnly'\) continue;/);
});

test('Express phrases and the Commands phrases are filled in where they are said', () => {
    const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
    assert.match(app, /speakAsUserTurn\(fillText\(phrase\.text\), fillText\(phrase\.speak \|\| phrase\.text\)/);
    assert.match(app, /fillText\(controlPhrases\.pickPhrase\('pardon'\)\)/);
    assert.match(app, /engine\.setFillInProvider\(fillInValues\)/);
    for (const f of ['control-phrases-editor.js', 'express-editor.js']) {
        const src = readFileSync(new URL(`../app/js/${f}`, import.meta.url), 'utf8');
        assert.match(src, /buildInsertRow\(/, f);
    }
});
