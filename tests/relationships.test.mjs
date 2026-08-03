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
