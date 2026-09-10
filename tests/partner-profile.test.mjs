/* Tier 1 — per-partner register content (app/js/partner-profile.js).
 *
 * The dimension and goal lists behind "how I talk with this person". The load-
 * bearing property is that NEUTRAL PRODUCES NOTHING: a person the user never
 * edited must contribute no prompt text at all, or the feature starts quietly
 * shaping responses for everyone in the graph.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    REGISTER_DIMENSIONS, RELATIONSHIP_GOALS,
    registerClauses, goalText, goalTexts, goalLabel, isEmptyProfile
} from '../app/js/partner-profile.js';

test('an empty or neutral register yields no clauses', () => {
    assert.deepEqual(registerClauses(null), []);
    assert.deepEqual(registerClauses({}), []);
    assert.deepEqual(registerClauses({ formality: '', warmth: undefined }), []);
});

test('each dimension yields its own clause at either end', () => {
    for (const dim of REGISTER_DIMENSIONS) {
        assert.deepEqual(registerClauses({ [dim.key]: dim.low.value }), [dim.low.clause],
            `${dim.key} low`);
        assert.deepEqual(registerClauses({ [dim.key]: dim.high.value }), [dim.high.clause],
            `${dim.key} high`);
    }
});

test('an unknown value is ignored rather than guessed at', () => {
    assert.deepEqual(registerClauses({ formality: 'sideways' }), []);
});

test('clauses come back in the declared dimension order, not object order', () => {
    const out = registerClauses({ humor: 'playful', formality: 'relaxed' });
    assert.equal(out.length, 2);
    assert.match(out[0], /relaxed/, 'formality is declared first, so it leads');
});

// Every clause is a fragment completing "this user is ...", so one that started
// with a capital or ended with a full stop would read wrongly once joined.
test('clauses are sentence fragments that can be joined', () => {
    for (const dim of REGISTER_DIMENSIONS) {
        for (const end of [dim.low, dim.high]) {
            assert.doesNotMatch(end.clause, /^[A-Z]/, `${dim.key}: clause should not start capitalised`);
            assert.doesNotMatch(end.clause, /\.$/, `${dim.key}: clause should not end with a full stop`);
        }
    }
});

test('dimension keys and goal ids are unique', () => {
    const keys = REGISTER_DIMENSIONS.map((d) => d.key);
    assert.equal(new Set(keys).size, keys.length);
    const ids = RELATIONSHIP_GOALS.map((g) => g.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('goalText resolves a menu id and passes free text through', () => {
    assert.equal(goalText({ id: 'connect' }), 'Stay connected and catch up');
    assert.equal(goalText({ id: '', text: 'Stop arguing about the car' }), 'Stop arguing about the car');
    assert.equal(goalText(null), '');
    assert.equal(goalText({ id: 'nonexistent' }), '');
});

test('isEmptyProfile is true only when nothing would reach the prompt', () => {
    assert.equal(isEmptyProfile(null), true);
    assert.equal(isEmptyProfile({ register: {}, goals: [], note: '', openers: [] }), true);
    assert.equal(isEmptyProfile({ register: { formality: 'relaxed' } }), false);
    assert.equal(isEmptyProfile({ goals: [{ id: 'connect' }] }), false);
    assert.equal(isEmptyProfile({ note: 'keep it light' }), false);
    assert.equal(isEmptyProfile({ openers: ['Hi Mum'] }), false);
    assert.equal(isEmptyProfile({ note: '   ' }), true, 'whitespace is not content');
});


test('goalTexts keeps the user order, drops nothing real and nothing twice', () => {
    assert.deepEqual(goalTexts([{ id: 'repair' }, { id: 'upbeat' }]),
        ['Repair things between us', 'Be upbeat with them']);
    // A stale id from an older release resolves to nothing and must not leave a gap.
    assert.deepEqual(goalTexts([{ id: 'gone' }, { id: 'connect' }]),
        ['Stay connected and catch up']);
    assert.deepEqual(goalTexts([{ id: 'connect' }, { id: 'connect' }]),
        ['Stay connected and catch up']);
    assert.deepEqual(goalTexts([]), []);
    // The legacy single-goal shape, so no caller has to know which release wrote it.
    assert.deepEqual(goalTexts({ id: 'help' }), ['Ask for help']);
    assert.deepEqual(goalTexts(null), []);
});

test('every goal has a short -ing label for a button face', () => {
    // The face is a REMINDER, not a quotation - nothing is spoken - so it can be
    // short, and it must be, because a side-dock cell is about nine characters wide.
    for (const g of RELATIONSHIP_GOALS) {
        assert.ok(g.label, `${g.id} has no label`);
        assert.ok(g.label.length <= 16, `${g.id}'s label is too long for a cell: ${g.label}`);
        // -ing form, so a goal cannot read as something to say out loud in a band
        // where most buttons speak. "Their people" is the one deliberate exception:
        // there is no natural gerund for supporting someone's other relationships.
        if (g.id !== 'their_people') {
            assert.match(g.label, /ing\b/, `${g.id}'s label is not in the -ing form: ${g.label}`);
        }
    }
});

test('goalLabel falls back to the full wording for a typed goal', () => {
    // A typed goal has no label until the user gives it one, and their own words
    // truncated beat an empty button.
    assert.equal(goalLabel({ id: 'repair' }), 'Making peace');
    assert.equal(goalLabel({ id: '', text: 'Stop arguing about the car' }),
        'Stop arguing about the car');
    assert.equal(goalLabel(null), '');
});
