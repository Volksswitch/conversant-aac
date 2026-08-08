/* Tier 1 — relationship graph block + privacy (app/js/relationships.js).
 *
 * Same three-tier privacy intent as worldview, applied to people: a non-private
 * person is described freely; a private person's details ARE sent but flagged
 * "don't bring them up unprompted"; a person not added is simply absent.
 */
import { resetLocalStorage } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as rel from '../app/js/relationships.js';

beforeEach(async () => { resetLocalStorage(); await rel.load(); });

test('an empty graph injects no block', () => {
    assert.equal(rel.buildBlock(), '');
});

test('a non-private person is described in the plain "People in my life" list', async () => {
    await rel.addPerson({ name: 'Tyler', relationship: 'friend', about: 'we play chess' });
    const block = rel.buildBlock();
    assert.match(block, /People in my life/);
    assert.match(block, /Tyler/);
    assert.match(block, /friend/);
    assert.doesNotMatch(block, /do not bring them up/i, 'a non-private person needs no restraint note');
});

test('a private person IS sent for context but flagged do-not-volunteer', async () => {
    await rel.addPerson({ name: 'Dr. Smith', relationship: 'doctor', isPrivate: true });
    const block = rel.buildBlock();
    assert.match(block, /Dr\. Smith/, 'the private person is still sent for context');
    assert.match(block, /do not bring them up unprompted/i);
});

// "Unprompted" is only followable if the model is told what counts as a prompt. The
// rule used to end "only include them if the user's chosen response requires it",
// which names nothing that exists at authoring time (Ken, August 3 2026).
test('the private rule names the two things that DO unlock it', async () => {
    await rel.addPerson({ name: 'Dr. Smith', relationship: 'doctor', isPrivate: true });
    const block = rel.buildBlock();
    assert.match(block, /partner has asked/i, 'the partner asking is a prompt');
    assert.match(block, /typed guidance/i, 'the user steering via Reframe is a prompt');
    assert.doesNotMatch(block, /chosen response requires/i, 'names a mechanism that does not exist');
});

test('nicknames trigger the "address by preferred term" instruction', async () => {
    await rel.addPerson({ name: 'Mary', relationship: 'mother', nickname: 'mom' });
    const block = rel.buildBlock();
    assert.match(block, /mom/);
    assert.match(block, /preferred term of address|name shown in quotes/i);
});

test('CRUD: add, update, remove reflect in count and listing', async () => {
    await rel.addPerson({ name: 'Sam', relationship: 'friend' });
    assert.equal(rel.count(), 1);
    const id = rel.listPeople()[0].id;
    await rel.updatePerson(id, { about: 'from college' });
    assert.match(rel.listPeople().find((x) => x.id === id).about, /college/);
    await rel.removePerson(id);
    assert.equal(rel.count(), 0);
});

// --- per-partner profile (Phase 3, the me->person edge's attrs) --------------

test('an untouched person contributes no partner block', async () => {
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    assert.equal(rel.buildPartnerBlock(id), '',
        'a person nobody has edited must exert zero influence and cost zero tokens');
});

test('neutral register dimensions are not stored and emit nothing', async () => {
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { register: { formality: 'relaxed', length: '', warmth: undefined } });
    assert.deepEqual(rel.getPartnerProfile(id).register, { formality: 'relaxed' },
        'only the dimensions the user actually set are stored');
});

test('register, goal and note reach the partner block, stated assertively', async () => {
    const id = await rel.addPerson({ name: 'Mary', nickname: 'Mum', relationship: 'mother' });
    await rel.setPartnerProfile(id, {
        register: { formality: 'relaxed', warmth: 'warmer' },
        goal: { id: 'connect' },
        note: 'She worries, so I keep it light.'
    });
    const block = rel.buildPartnerBlock(id);
    assert.match(block, /Mum/);
    assert.match(block, /more relaxed and informal/);
    assert.match(block, /warmer and more openly affectionate/);
    assert.match(block, /Stay connected and catch up/);
    assert.match(block, /She worries, so I keep it light\./);
    // "Take them at their word" (Ken): the user's own note outranks our menu.
    assert.match(block, /overrides the general guidance/i);
});

// The August 5 2026 lesson, applied to a second kind of context: a fact with no
// stated purpose reads to a model as material to work into the conversation. A
// standing goal is the dangerous case -- "repair things between us" must steer
// wording, never become the subject.
test('the partner block says it shapes wording and is not a topic', async () => {
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { goal: { id: 'repair' } });
    const block = rel.buildPartnerBlock(id);
    assert.match(block, /topic to raise/i, 'the purpose is stated before the content');
    assert.match(block, /never mention it/i, 'and again on the goal itself');
});

test('a free-text goal is carried as written', async () => {
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { goal: { id: '', text: 'Stop arguing about the car' } });
    assert.match(rel.buildPartnerBlock(id), /Stop arguing about the car/);
});

// The profile lives on the edge, and updatePerson used to DELETE the edge when the
// relationship was cleared -- which would have destroyed the profile silently while
// the user believed they had only blanked a dropdown.
test('clearing the relationship keeps a profile that lives on the edge', async () => {
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { note: 'keep it light' });
    await rel.updatePerson(id, { relationship: '' });
    assert.equal(rel.getPartnerProfile(id).note, 'keep it light');
    assert.equal(rel.getPerson(id).relationship, '', 'and the relationship really is cleared');
});

test('clearing the relationship still drops an edge carrying nothing', async () => {
    const id = await rel.addPerson({ name: 'Bob', relationship: 'friend' });
    await rel.updatePerson(id, { relationship: '' });
    assert.equal(rel.getPerson(id).relationship, '');
});

test('a person with no relationship type can still be given a profile', async () => {
    const id = await rel.addPerson({ name: 'Sam' });   // no relationship -> no edge yet
    await rel.setPartnerProfile(id, { note: 'we go way back' });
    assert.equal(rel.getPartnerProfile(id).note, 'we go way back');
});

test('per-person phrases round-trip and blanks are dropped', async () => {
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { openers: ['Hi Mum, got a minute?', '  ', ''] });
    assert.deepEqual(rel.partnerPhrases(id).openers, ['Hi Mum, got a minute?']);
});

test('removing a person takes their profile with them', async () => {
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { note: 'keep it light' });
    await rel.removePerson(id);
    assert.equal(rel.buildPartnerBlock(id), '');
});

// --- pronunciation (Ken, August 8 2026) --------------------------------------
// A respelling for a name the voice says wrong. It reaches the synthesiser and
// NOTHING else — above all not the model, which would write it into responses and
// put the respelling on screen in place of the person's name.

test('a name and a nickname each carry their own respelling, and both round-trip', async () => {
    const id = await rel.addPerson({
        name: 'Siobhan', relationship: 'friend',
        nickname: 'J.J.',
        pronunciation: 'Shiv-awn', nicknamePronunciation: 'Jay Jay',
    });
    const p = rel.getPerson(id);
    assert.equal(p.pronunciation, 'Shiv-awn');
    assert.equal(p.nicknamePronunciation, 'Jay Jay');
});

test('a respelling can be edited and cleared without disturbing the name', async () => {
    const id = await rel.addPerson({ name: 'Siobhan', pronunciation: 'Shiv-awn' });
    await rel.updatePerson(id, { pronunciation: '' });
    assert.equal(rel.getPerson(id).pronunciation, '');
    assert.equal(rel.getPerson(id).name, 'Siobhan', 'clearing the respelling must not touch the name');
});

test('⚠ THE RESPELLING NEVER REACHES THE MODEL', async () => {
    await rel.addPerson({
        name: 'Siobhan', relationship: 'friend',
        nickname: 'J.J.', pronunciation: 'Shiv-awn', nicknamePronunciation: 'Jay Jay',
    });
    const block = rel.buildBlock();
    assert.match(block, /Siobhan/, 'the real name is still sent');
    assert.doesNotMatch(block, /Shiv-awn/, 'the respelling must not be sent — the model would write it into responses');
    assert.doesNotMatch(block, /Jay Jay/, 'nor the nickname respelling');
});

test('a person with no respelling is unchanged in every way', async () => {
    await rel.addPerson({ name: 'Tyler', relationship: 'friend' });
    const p = rel.listPeople()[0];
    assert.equal(p.pronunciation, '');
    assert.equal(p.nicknamePronunciation, '');
});
