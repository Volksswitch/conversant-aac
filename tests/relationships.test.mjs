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
import { goalItems } from '../app/js/partner-profile.js';
import { composePanel } from '../app/js/express-bands.js';

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
        goals: [{ id: 'connect' }],
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
    await rel.setPartnerProfile(id, { goals: [{ id: 'repair' }] });
    const block = rel.buildPartnerBlock(id);
    assert.match(block, /topic to raise/i, 'the purpose is stated before the content');
    assert.match(block, /never mention it/i, 'and again on the goal itself');
});

test('several goals reach the prompt IN ORDER, named as importance', async () => {
    // With no primary-versus-constraint kind (Ken, September 10 2026) the user's order
    // is the ONLY thing saying one goal matters more than another, so an unordered
    // hand-off would make the ordering they were asked to do purely cosmetic.
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, {
        goals: [{ id: 'repair' }, { id: 'upbeat' }, { id: '', text: 'Stop arguing about the car' }]
    });
    const block = rel.buildPartnerBlock(id);
    const at = (t) => block.indexOf(t);
    assert.ok(at('Repair things between us') < at('Be upbeat with them'),
        'the first goal comes first');
    assert.ok(at('Be upbeat with them') < at('Stop arguing about the car'),
        'and a typed goal keeps its place in the order');
    assert.match(block, /most important first/i, 'the order is NAMED as importance');
    assert.match(block, /\(1\) Repair things between us/, 'and is numbered, not just sequenced');
    // The guard has to survive the plural, which is the whole risk of this change: a
    // goal is a reason to choose warmer wording and a catastrophe read as a subject.
    assert.match(block, /topic to raise/i);
    assert.match(block, /never mention any of them/i);
});

test('one goal still reads as one goal, not as a list of one', async () => {
    // A numbered list of a single item reads as a fragment of something larger and
    // invites the model to wonder what the other goals were.
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { goals: [{ id: 'connect' }] });
    const block = rel.buildPartnerBlock(id);
    assert.match(block, /is: Stay connected and catch up\./);
    assert.ok(!block.includes('(1)'), 'no numbering for a single goal');
    assert.match(block, /never mention it/i, 'and the singular guard');
});

test('a profile written by an older release keeps its goal', async () => {
    // Migrated ON READ, not on a save: doing it on write would mean the goal silently
    // vanished from the prompt until the next time the user happened to open the form.
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    const graph = JSON.parse(localStorage.getItem('aac_relationships'));
    const edge = graph.edges.find((e) => e.from === 'me' && e.to === id);
    edge.attrs = { goal: { id: 'repair' } };          // the shape 0.10.18 and earlier wrote
    localStorage.setItem('aac_relationships', JSON.stringify(graph));
    await rel.load();
    assert.deepEqual(rel.getPartnerProfile(id).goals, [{ id: 'repair' }]);
    assert.match(rel.buildPartnerBlock(id), /Repair things between us/);
});

test('the legacy single goal is dropped once the list is authoritative', async () => {
    // Leaving both keys would let a stale value outlive the goal that replaced it.
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    const graph = JSON.parse(localStorage.getItem('aac_relationships'));
    const edge = graph.edges.find((e) => e.from === 'me' && e.to === id);
    edge.attrs = { goal: { id: 'repair' } };
    localStorage.setItem('aac_relationships', JSON.stringify(graph));
    await rel.load();
    await rel.setPartnerProfile(id, { goals: [{ id: 'connect' }] });
    const after = JSON.parse(localStorage.getItem('aac_relationships'));
    const e2 = after.edges.find((x) => x.from === 'me' && x.to === id);
    assert.equal(e2.attrs.goal, undefined, 'the old key is gone');
    assert.deepEqual(e2.attrs.goals, [{ id: 'connect' }]);
});

test('the same goal twice is stored once', async () => {
    // Two copies would spend prompt space saying one thing two ways.
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, {
        goals: [{ id: 'connect' }, { id: 'connect' },
                { id: '', text: 'Stop arguing' }, { id: '', text: '  stop ARGUING  ' }]
    });
    assert.deepEqual(rel.getPartnerProfile(id).goals,
        [{ id: 'connect' }, { id: '', text: 'Stop arguing' }]);
});

test('no goals means no goal sentence at all', async () => {
    // An untouched person must cost zero tokens and exert zero influence.
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { goals: [] });
    assert.equal(rel.buildPartnerBlock(id), '');
});

test("a typed goal's button label survives a save; a menu goal stores none", async () => {
    // The label is the short face its Express Panel button carries. The twelve menu
    // goals carry theirs in code so a later rewording reaches them; a typed goal has
    // nothing else to fall back on but its whole sentence.
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { goals: [
        { id: 'repair', label: 'ignore me' },
        { id: '', text: 'Stop arguing about the car', label: '  The car  ' },
    ] });
    const stored = JSON.parse(localStorage.getItem('aac_relationships'))
        .edges.find((e) => e.from === 'me' && e.to === id).attrs.goals;
    assert.deepEqual(stored, [
        { id: 'repair' },
        { id: '', text: 'Stop arguing about the car', label: 'The car' },
    ]);
    // And the label never reaches the AI: the prompt gets the goal, not its button.
    const block = rel.buildPartnerBlock(id);
    assert.match(block, /Stop arguing about the car/);
    assert.doesNotMatch(block, /The car\b(?! )/);
});

// ⚠ ONE CHECK THAT CROSSES EVERY LAYER (the standing rule). Each of the three pieces
// above proves its own link and none of them proves the feature: the panel would look
// finished with the goal buttons landing nowhere. This drives the real chain - a goal
// saved through the real writer, read back through the real reader, turned into
// buttons by the real builder, laid out by the real band arithmetic.
test('a goal recorded in About Me reaches the leading Flex cells of the real panel', async () => {
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { goals: [
        { id: 'repair' },
        { id: '', text: 'Stop arguing about the car', label: 'The car' },
    ] });

    const items = goalItems(rel.getPartnerProfile(id).goals);
    const grid = [['x', 'x', 'x', 'x'], ['x', 'x', 'x', 'x'], ['x', 'x', 'x', 'x']];
    const panel = composePanel(grid, {
        sizes: { shape: 'counts', context: 4, flex: 4 },
        always: [], context: [], flex: {},
    }, { partnerId: id, goals: items });

    const flexAt = panel.bands.indexOf('flex');
    assert.ok(flexAt >= 0, 'there is a Flex band to land in');
    assert.equal(panel.items[flexAt].type, 'goal');
    assert.equal(panel.items[flexAt].label, 'Making peace', 'the menu goal wears its own face');
    assert.equal(panel.items[flexAt].text, 'Repair things between us', 'and carries the wording');
    assert.equal(panel.items[flexAt + 1].label, 'The car', 'the typed goal wears the typed face');
    assert.equal(panel.unreachable.goals, 0);
});

test('a free-text goal is carried as written', async () => {
    const id = await rel.addPerson({ name: 'Mary', relationship: 'mother' });
    await rel.setPartnerProfile(id, { goals: [{ id: '', text: 'Stop arguing about the car' }] });
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

/* --- What to call somebody, answered in ONE place (Ken, August 25 2026) -----------
 * The Express Panel used to keep its own copy of "what you call them" and offer a box
 * to edit it, so About Me and the panel could disagree with nothing to say which was
 * right. The box is gone and every reader now asks here.
 */
test('displayName prefers what the user calls them, and falls back to the name', async () => {
    const withNick = await rel.addPerson({ name: 'Siobhan', nickname: 'Shiv' });
    const plain = await rel.addPerson({ name: 'Tim' });
    assert.equal(rel.displayName(withNick), 'Shiv');
    assert.equal(rel.displayName(plain), 'Tim');
});

test('renaming in About Me changes what every reader gets — no stored copy to go stale', async () => {
    const id = await rel.addPerson({ name: 'Mary', nickname: 'Mom' });
    assert.equal(rel.displayName(id), 'Mom');
    await rel.updatePerson(id, { nickname: 'Mother' });
    assert.equal(rel.displayName(id), 'Mother', 'the new word, with nothing to re-enter elsewhere');
});

// A panel button can outlive the person it names — an old free-typed one, or somebody
// removed from About Me. A stale word beats a blank button.
test('displayName falls back to the caller\'s own word for an unknown person', () => {
    assert.equal(rel.displayName(null, 'Coach'), 'Coach');
    assert.equal(rel.displayName('no-such-id', 'Coach'), 'Coach');
    assert.equal(rel.displayName('no-such-id'), '');
});
