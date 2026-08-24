/* The Express Panel band arithmetic and fill order.
 *
 * The rules under test are all ones that were got WRONG at least once while the design
 * was being settled, which is why each has its own case here rather than being covered
 * incidentally:
 *   - the user sets Context and Flex; ALWAYS is the remainder
 *   - the Context floor of four applies even when the user has filled nothing
 *   - an Always phrase with no room queues LAST in the Flex band and can never
 *     displace a situational phrase (I had this backwards; Ken caught it)
 *   - the four situational lists fill most-specific-first, and a phrase in two of
 *     them is shown once
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as bands from '../app/js/express-bands.js';

// A deliberately plain grid: three rows of four, no compose key, no spacers, so the
// arithmetic is readable. panelRoles treats a bare string as one position.
const rows = (...counts) => counts.map((n) => Array.from({ length: n }, () => 'x'));
const GRID = rows(4, 4, 4);      // 12 positions

const phrases = (...texts) => texts.map((t, i) => ({ id: 'p' + i + t, type: 'phrase', text: t }));

test('the user sets Context and Flex; Always takes the remainder', () => {
    const plan = bands.bandPlan(GRID, { shape: 'counts', context: 4, flex: 2 });
    assert.equal(plan.total, 12);
    assert.equal(plan.contextN, 4);
    assert.equal(plan.flexN, 2);
    assert.equal(plan.alwaysN, 6, 'Always is what is left over, never a number the user typed');
    assert.equal(plan.bands[0], 'always');
    assert.equal(plan.bands[6], 'context');
    assert.equal(plan.bands[10], 'flex');
});

test('Always can go to zero, and that is a legitimate panel', () => {
    // A panel given over entirely to steering the AI is an important panel (Ken).
    const plan = bands.bandPlan(GRID, { shape: 'counts', context: 8, flex: 4 });
    assert.equal(plan.alwaysN, 0);
    assert.equal(plan.bands.filter((b) => b === 'always').length, 0);
});

test('the Context floor of four holds even when nothing is in it', () => {
    // If the band could collapse when empty, a menu arriving would have to conjure
    // four positions and the panel would change shape mid-conversation.
    const plan = bands.bandPlan(GRID, { shape: 'counts', context: 0, flex: 0 });
    assert.equal(plan.contextN, bands.CONTEXT_FLOOR);
    const composed = bands.composePanel(GRID, {
        sizes: { shape: 'counts', context: 0, flex: 0 }, always: [], context: [], flex: {},
    }, {});
    assert.equal(composed.counts.context, 4);
    assert.deepEqual(composed.items.slice(8), [undefined, undefined, undefined, undefined],
        'reserved, and drawn as outlines - never blank forever');
});

test('whole rows keep a straight edge; the same setting means different sizes', () => {
    const ragged = [['x', 'x', 'x'], ['x', 'x', 'x', 'x', 'x'], ['x', 'x']];
    const plan = bands.bandPlan(ragged, { shape: 'rows', contextRows: 1, flexRows: 1 });
    // Row 0 is Always (3), row 1 is Context (5), row 2 is Flex (2). A one-row Context
    // band is 5 here and would be 2 on the row below - which is the whole argument.
    assert.deepEqual(plan.bands.slice(0, 3), ['always', 'always', 'always']);
    assert.equal(plan.contextN, 5);
    assert.equal(plan.flexN, 2);
});

test('the four situational lists fill most specific first', () => {
    const flex = {
        [bands.flexKey('mom', 'home')]: phrases('pair'),
        [bands.flexKey('mom', bands.ANYPLACE)]: phrases('partner'),
        [bands.flexKey(bands.ANYONE, 'home')]: phrases('place'),
        [bands.flexKey(bands.ANYONE, bands.ANYPLACE)]: phrases('general'),
    };
    const got = bands.flexFill(flex, 'mom', 'home', 10).map((x) => x.text);
    assert.deepEqual(got, ['pair', 'partner', 'place', 'general']);
});

test('a phrase in two lists is shown once', () => {
    const flex = {
        [bands.flexKey('mom', bands.ANYPLACE)]: phrases('Thanks'),
        [bands.flexKey(bands.ANYONE, bands.ANYPLACE)]: phrases('Thanks', 'Bye'),
    };
    const got = bands.flexFill(flex, 'mom', null, 10).map((x) => x.text);
    assert.deepEqual(got, ['Thanks', 'Bye'], 'not two positions on a panel short of them');
});

test('with no partner and no place the general list is what fills the band', () => {
    const flex = {
        [bands.flexKey('mom', bands.ANYPLACE)]: phrases('Mom only'),
        [bands.flexKey(bands.ANYONE, bands.ANYPLACE)]: phrases('Anyone'),
    };
    assert.deepEqual(bands.flexFill(flex, null, null, 10).map((x) => x.text), ['Anyone']);
});

// ⚠ THE ONE I GOT BACKWARDS. Ken: "Those displaced always phrases can flow into the
// Flex region but only at the end and only if there's space. They don't displace
// situational ones."
test('Always overflow takes only spare room at the END of the Flex band', () => {
    const model = {
        sizes: { shape: 'counts', context: 4, flex: 4 },
        always: phrases('a1', 'a2', 'a3', 'a4', 'a5', 'a6'),   // 6 into a band of 4
        context: [],
        flex: { [bands.flexKey(bands.ANYONE, bands.ANYPLACE)]: phrases('g1') },
    };
    const c = bands.composePanel(GRID, model, {});
    assert.equal(c.counts.always, 4, 'Context 4 + Flex 4 leaves 4');
    const flexCells = c.items.slice(8).map((x) => x && x.text);
    assert.deepEqual(flexCells, ['g1', 'a5', 'a6', undefined],
        'the situational phrase keeps the front; the surplus queues behind it');
    assert.equal(c.fromAlwaysSurplus, 2);
});

test('a full Flex band leaves the Always surplus nowhere to go, and says so', () => {
    const model = {
        sizes: { shape: 'counts', context: 4, flex: 4 },
        always: phrases('a1', 'a2', 'a3', 'a4', 'a5', 'a6'),
        context: [],
        flex: { [bands.flexKey(bands.ANYONE, bands.ANYPLACE)]: phrases('g1', 'g2', 'g3', 'g4') },
    };
    const c = bands.composePanel(GRID, model, {});
    assert.deepEqual(c.items.slice(8).map((x) => x.text), ['g1', 'g2', 'g3', 'g4'],
        'a situational phrase is NEVER displaced by an Always phrase');
    assert.equal(c.unreachable.always, 2, 'and the editor is told, rather than hiding it');
    assert.equal(c.fromAlwaysSurplus, 0);
});

test('growing the Context band never moves an Always button that is still showing', () => {
    const model = (context) => ({
        sizes: { shape: 'counts', context, flex: 0 },
        always: phrases('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'),
        context: [], flex: {},
    });
    const small = bands.composePanel(GRID, model(4), {});
    const big = bands.composePanel(GRID, model(6), {});
    // The band ends sooner; the buttons that remain are exactly where they were.
    assert.deepEqual(small.items.slice(0, 6).map((x) => x.text), big.items.slice(0, 6).map((x) => x.text));
    assert.equal(big.counts.always, 6);
});

test('the Context band keeps its three kinds in their runs, always in the same order', () => {
    const mixed = [
        { id: '1', type: 'feeling', text: 'Tired' },
        { id: '2', type: 'place', name: 'Home' },
        { id: '3', type: 'partner', name: 'Mom' },
        { id: '4', type: 'feeling', text: 'Happy' },
    ];
    assert.deepEqual(bands.sortContext(mixed).map((x) => x.type),
        ['partner', 'place', 'feeling', 'feeling']);
    // Stable within a run: the user's own order survives.
    assert.deepEqual(bands.sortContext(mixed).filter((x) => x.type === 'feeling').map((x) => x.text),
        ['Tired', 'Happy']);
});

test('a situation key round-trips, and a missing half means Anyone or Anyplace', () => {
    assert.equal(bands.flexKey('mom', 'home'), 'mom|home');
    assert.equal(bands.flexKey(null, null), 'anyone|anyplace');
    assert.deepEqual(bands.parseFlexKey('mom|home'), { partnerId: 'mom', placeId: 'home' });
    assert.deepEqual(bands.parseFlexKey(''), { partnerId: 'anyone', placeId: 'anyplace' });
});

test('a one-row Context band still gets four positions on a narrow row', () => {
    // A row is not a fixed quantity - "one row" is 13 positions on one layout and 2 on
    // another - so the floor cannot be expressed as a row count. Bottom Layout 2 ends
    // in a row of 2, which is the case that would otherwise lose one of the partner's
    // own alternatives.
    const narrow = [Array(10).fill('x'), Array(10).fill('x'), Array(2).fill('x')];
    const plan = bands.bandPlan(narrow, { shape: 'rows', contextRows: 1, flexRows: 0 });
    assert.equal(plan.contextN, bands.CONTEXT_FLOOR);
    assert.equal(plan.flexN, 0, 'the extra cells come from Always above, never from Flex');
    assert.equal(plan.alwaysN, 22 - bands.CONTEXT_FLOOR);
});

test('a wide row keeps every position the row gives it', () => {
    const wide = [Array(9).fill('x'), Array(9).fill('x'), Array(9).fill('x'), Array(5).fill('x')];
    const plan = bands.bandPlan(wide, { shape: 'rows', contextRows: 1, flexRows: 0 });
    assert.equal(plan.contextN, 5, 'five-wide row, five context cells - not clamped to the floor');
    const composed = bands.composePanel(wide, {
        sizes: { shape: 'rows', contextRows: 1, flexRows: 0 },
        always: [], context: phrases('c1', 'c2', 'c3', 'c4', 'c5', 'c6').map((p) => ({ ...p, type: 'feeling' })),
        flex: {},
    }, {});
    assert.deepEqual(composed.items.slice(27).map((x) => x && x.text),
        ['c1', 'c2', 'c3', 'c4', 'c5'], 'the first five show');
    assert.equal(composed.unreachable.context, 1, 'and the sixth is reported, not silently dropped');
});

// ⚠ KEN'S CASE, August 23 2026, from a real session: Side Layout 8 with the Context
// band set to one row. That layout's LAST row holds no button positions at all, so the
// band came out empty and all six feelings were reported as not fitting. The rescue has
// to be computed from the band BOUNDARY - looking for an existing context cell to grow
// from finds nothing precisely when the band is empty, which is the case that needs it.
test('a one-row band landing on a row with no positions is still given four', () => {
    const s8 = [5, 5, 5, 5, 5, 3, 4, 0].map((n) => Array.from({ length: n }, () => 'x'));
    const plan = bands.bandPlan(s8, { shape: 'rows', contextRows: 1, flexRows: 0 });
    assert.equal(plan.total, 32);
    assert.equal(plan.contextN, bands.CONTEXT_FLOOR, 'not zero');
    assert.equal(plan.flexN, 0);
    assert.equal(plan.alwaysN, 28);

    const feelings = ['Happy', 'Sad', 'Stressed', 'Curious', 'Tired', 'Excited']
        .map((t, i) => ({ id: 'f' + i, type: 'feeling', text: t }));
    const composed = bands.composePanel(s8, {
        sizes: { shape: 'rows', contextRows: 1, flexRows: 0 },
        always: [], context: feelings, flex: {},
    }, {});
    const shown = composed.items.filter((x, i) => composed.bands[i] === 'context').map((x) => x && x.text);
    assert.deepEqual(shown, ['Happy', 'Sad', 'Stressed', 'Curious'],
        'the first four show rather than none');
    assert.equal(composed.unreachable.context, 2);
});

test('the rescued cells come from Always, never from Flex', () => {
    const s8 = [5, 5, 5, 5, 5, 3, 4, 0].map((n) => Array.from({ length: n }, () => 'x'));
    const plan = bands.bandPlan(s8, { shape: 'rows', contextRows: 1, flexRows: 1 });
    // Seven rows hold buttons. Flex takes the last of them (4 wide), Context the one
    // above (3 wide) - which is under the floor, so it borrows one cell from Always.
    assert.equal(plan.flexN, 4, 'Flex gets a row of BUTTONS, not the compose-only row');
    assert.equal(plan.contextN, 4, 'grown to the floor');
    assert.equal(plan.alwaysN, 24, 'and the cell came from here, never from Flex');
});

// ⚠ KEN'S SECOND REPORT ON THE SAME LAYOUT: he asked for TWO rows of Context and got
// one row of buttons plus the compose-only row, so four buttons appeared and two were
// reported as not fitting. A row with no button positions is not a row the user can
// see, so it must not be counted as one - they are counting rows of BUTTONS.
test('a row with no buttons is not counted as one of the rows asked for', () => {
    const s8 = [5, 5, 5, 5, 5, 3, 4, 0].map((n) => Array.from({ length: n }, () => 'x'));
    const one = bands.bandPlan(s8, { shape: 'rows', contextRows: 1, flexRows: 0 });
    assert.equal(one.contextN, 4, 'one row = the 4-wide row, not the empty one');

    const two = bands.bandPlan(s8, { shape: 'rows', contextRows: 2, flexRows: 0 });
    assert.equal(two.contextN, 7, 'two rows = 4 + 3, which is what Ken expected to see');
    assert.equal(two.alwaysN, 25, 'and Always is pushed up by exactly that much');
    assert.equal(two.flexN, 0);

    // The compose-only row belongs to no band, because it has nothing to give one.
    assert.equal(two.bands.length, 32);
    assert.equal(two.bands.filter(Boolean).length, 32);
});
