/* Tier 1 — My Places: arbitrary facts, privacy, and the "I'm here" block
 * (app/js/places.js).
 *
 * The point of the feature is situational awareness WITHOUT GPS, so the load-bearing
 * behavior is buildHereBlock: when the user taps where they are, the model must be
 * told the setting AND the facts recorded about it. The privacy intent is the same
 * three-level model applied to people.
 */
import { resetLocalStorage } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as places from '../app/js/places.js';

beforeEach(async () => { resetLocalStorage(); await places.load(); });

test('no places injects no block', () => {
    assert.equal(places.buildBlock(), '');
});

test('a place is listed with its arbitrary facts', async () => {
    await places.addPlace({
        name: 'Starbucks',
        facts: [{ key: 'Location', value: '123 Main Street' }, { key: 'favorite drink', value: 'mocha latte' }]
    });
    const block = places.buildBlock();
    assert.match(block, /Places I go/);
    assert.match(block, /Starbucks/);
    assert.match(block, /Location: 123 Main Street/);
    assert.match(block, /favorite drink: mocha latte/);
    assert.doesNotMatch(block, /do not bring them up/i, 'a non-private place needs no restraint note');
});

test('a private place IS sent for context but flagged do-not-volunteer', async () => {
    await places.addPlace({ name: 'Dr. Smith\'s office', facts: [{ key: 'Why', value: 'physical therapy' }], isPrivate: true });
    const block = places.buildBlock();
    assert.match(block, /Dr\. Smith's office/, 'the private place is still sent for context');
    assert.match(block, /do not bring them up unprompted/i);
});

// "Do not raise it unprompted" is only a followable instruction if the model is told
// what DOES count as a prompt. The rule previously ended "only include them if the
// user's chosen response requires it", which named nothing real — at the moment the
// model writes the options there is no chosen response (Ken, August 3 2026). Both
// real triggers must stay named, in the block and in the here-line.
test('the private rule names the two things that DO unlock it', async () => {
    await places.addPlace({ name: 'The clinic', isPrivate: true });
    const block = places.buildBlock();
    assert.match(block, /partner has asked/i, 'the partner asking is a prompt');
    assert.match(block, /typed guidance/i, 'the user steering via Reframe is a prompt');
    assert.doesNotMatch(block, /chosen response requires/i, 'names a mechanism that does not exist');
});

test('blank fact rows are dropped, but a key with no value is kept', async () => {
    // A blank row is an editor artifact, not data. A key with no value is a fact the
    // user has started recording and must not be silently discarded.
    await places.addPlace({
        name: 'Gym',
        facts: [{ key: '', value: '' }, { key: '', value: 'orphan' }, { key: 'Locker', value: '' }]
    });
    const p = places.listPlaces()[0];
    assert.deepEqual(p.facts, [{ key: 'Locker', value: '' }]);
});

test('facts keep the order the user put them in', async () => {
    await places.addPlace({
        name: 'Library',
        facts: [{ key: 'C', value: '3' }, { key: 'A', value: '1' }, { key: 'B', value: '2' }]
    });
    assert.deepEqual(places.listPlaces()[0].facts.map((f) => f.key), ['C', 'A', 'B']);
});

test('duplicate fact keys both survive — facts are a list, not a map', async () => {
    await places.addPlace({
        name: 'Cafe',
        facts: [{ key: 'Order', value: 'tea' }, { key: 'Order', value: 'scone' }]
    });
    assert.equal(places.listPlaces()[0].facts.length, 2);
});

test('buildHereBlock names the place and repeats its facts', () => {
    return (async () => {
        const id = await places.addPlace({ name: 'Starbucks', facts: [{ key: 'favorite drink', value: 'mocha latte' }] });
        const here = places.buildHereBlock(id);
        assert.match(here, /at Starbucks right now/);
        assert.match(here, /mocha latte/, 'the current place\'s facts must be in front of the model');
    })();
});

// The place button is situational awareness (a stand-in for GPS), never a way to
// frame the topic. But the setting must still INFORM the suggestions — at a comic
// shop, comics are a plausible thing to be talking about, and a block that merely
// forbade the place would throw that away. Both halves have to be stated (Ken,
// August 5 2026: "the purpose of the place should inform the suggestions but it
// shouldn't become the topic of discussion").
test('buildHereBlock says the setting INFORMS the suggestions', async () => {
    const id = await places.addPlace({ name: 'Pulp Comics' });
    const here = places.buildHereBlock(id);
    assert.match(here, /SHOULD inform your suggestions/i,
        'the setting must be licensed to shape the options, not merely fenced off');
    assert.match(here, /what someone would plausibly say standing here/i);
});

test('buildHereBlock still refuses the place as the subject', async () => {
    const id = await places.addPlace({ name: 'Pulp Comics' });
    const here = places.buildHereBlock(id);
    assert.match(here, /must not do is become the topic on its own/i);
    assert.match(here, /comes from what the partner actually said/i,
        'must say where the topic DOES come from, not only where it does not');
});

// The facts are ambient knowledge, not material to work in, and a fact that is
// true of BEING here ("When: Saturdays") is common ground everyone present can
// see — narrating it back produces Ken's example, "what did you find here last
// Saturday?", asked while standing in the shop.
test('buildHereBlock says the facts are for understanding, not for saying', async () => {
    const id = await places.addPlace({ name: 'Pulp Comics', facts: [{ key: 'owner', value: 'Ramon' }] });
    const here = places.buildHereBlock(id);
    assert.match(here, /Ramon/, 'the facts themselves must still reach the model');
    assert.match(here, /for UNDERSTANDING the situation, not for saying/i);
    assert.match(here, /already obvious to everyone present/i,
        'must name why describing being here is wrong, not just forbid it');
});

// Saying the same place twice under two framings both doubles its salience and
// contradicts itself: the standing list describes places the user GOES.
test('buildBlock omits the place the user is standing in', async () => {
    const here = await places.addPlace({ name: 'Pulp Comics', facts: [{ key: 'owner', value: 'Ramon' }] });
    await places.addPlace({ name: 'The YMCA' });
    assert.match(places.buildBlock(), /Pulp Comics/, 'listed normally when the user is elsewhere');
    const away = places.buildBlock(here);
    assert.doesNotMatch(away, /Pulp Comics/);
    assert.match(away, /The YMCA/, 'the other places must survive the exclusion');
});

test('excluding the only place yields an empty block, not a dangling heading', async () => {
    const only = await places.addPlace({ name: 'Pulp Comics' });
    assert.equal(places.buildBlock(only), '');
});

test('buildHereBlock on a private place carries the do-not-name restraint', async () => {
    const id = await places.addPlace({ name: 'The clinic', isPrivate: true });
    const here = places.buildHereBlock(id);
    assert.match(here, /Do not name The clinic on your own initiative/i);
    assert.match(here, /partner asks|typed guidance/i, 'the restraint must say what lifts it');
});

test('buildHereBlock for a deleted or unknown place is empty, not a broken sentence', async () => {
    const id = await places.addPlace({ name: 'Gone' });
    await places.removePlace(id);
    assert.equal(places.buildHereBlock(id), '');
    assert.equal(places.buildHereBlock('nope'), '');
});

test('an unnamed place is not injected — it cannot be referred to', async () => {
    await places.addPlace({ name: '   ', facts: [{ key: 'a', value: 'b' }] });
    assert.equal(places.buildBlock(), '');
});

test('CRUD: add, update, remove reflect in count and listing', async () => {
    const id = await places.addPlace({ name: 'Park' });
    assert.equal(places.count(), 1);
    await places.updatePlace(id, { name: 'Riverside Park', facts: [{ key: 'Who', value: 'my brother' }] });
    const p = places.getPlace(id);
    assert.equal(p.name, 'Riverside Park');
    assert.deepEqual(p.facts, [{ key: 'Who', value: 'my brother' }]);
    await places.removePlace(id);
    assert.equal(places.count(), 0);
    assert.equal(places.getPlace(id), null);
});

test('listPlaces returns copies — the editor mutates them freely', async () => {
    await places.addPlace({ name: 'Home', facts: [{ key: 'k', value: 'v' }] });
    const copy = places.listPlaces()[0];
    copy.name = 'CLOBBERED';
    copy.facts[0].value = 'CLOBBERED';
    assert.equal(places.listPlaces()[0].name, 'Home');
    assert.equal(places.listPlaces()[0].facts[0].value, 'v');
});

test('resetAll clears every place', async () => {
    await places.addPlace({ name: 'One' });
    await places.addPlace({ name: 'Two' });
    await places.resetAll();
    assert.equal(places.count(), 0);
    assert.equal(places.buildBlock(), '');
});

// --- pronunciation (Ken, August 8 2026) --------------------------------------
// Place names are exactly what a synthesiser mangles — local, foreign, or a coined
// brand. Same rule as a person's name: speak-time only, never to the model.

test('a place carries a respelling that round-trips and can be cleared', async () => {
    const id = await places.addPlace({ name: 'Volksswitch', pronunciation: 'Folks-switch' });
    assert.equal(places.getPlace(id).pronunciation, 'Folks-switch');
    await places.updatePlace(id, { pronunciation: '' });
    assert.equal(places.getPlace(id).pronunciation, '');
    assert.equal(places.getPlace(id).name, 'Volksswitch', 'clearing it must not touch the name');
});

test('⚠ THE RESPELLING NEVER REACHES THE MODEL, in either block', async () => {
    const id = await places.addPlace({
        name: 'Volksswitch', pronunciation: 'Folks-switch',
        facts: [{ key: 'Location', value: '123 Main Street' }],
    });
    for (const [what, block] of [['buildBlock', places.buildBlock()], ['buildHereBlock', places.buildHereBlock(id)]]) {
        assert.match(block, /Volksswitch/, `${what} still sends the real name`);
        assert.doesNotMatch(block, /Folks-switch/, `${what} must not send the respelling`);
    }
});
