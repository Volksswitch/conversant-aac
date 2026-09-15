/* The Express Panel band arithmetic and fill order.
 *
 * The rules under test are all ones that were got WRONG at least once while the design
 * was being settled, which is why each has its own case here rather than being covered
 * incidentally:
 *   - the user sets Context and Flex; ALWAYS is the remainder
 *   - the Context floor of four applies even when the user has filled nothing
 *   - a band with more entries than positions gives its last position to More, which
 *     pages the band in place; nothing spills into another band (September 14 2026)
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

// --- THE MORE BUTTON (Ken, September 14 2026) --------------------------------------
// Replaces the old rule that queued surplus Always phrases at the end of the Flex band.

// Array.from, not .map: a position with nothing in it is a HOLE, which .map skips.
const texts = (c, from, to) => Array.from(c.items.slice(from, to), (x) => x && (x.label || x.text));
const alwaysModel = (n) => ({
    sizes: { shape: 'counts', context: 4, flex: 4 },
    always: phrases(...Array.from({ length: n }, (_, i) => 'a' + (i + 1))),
    context: [],
    flex: { [bands.flexKey(bands.ANYONE, bands.ANYPLACE)]: phrases('g1') },
});

test('Always phrases NEVER spill into the Flex band any more', () => {
    const c = bands.composePanel(GRID, alwaysModel(6), {});
    assert.deepEqual(texts(c, 8, 12), ['g1', undefined, undefined, undefined]);
    assert.equal(c.fromAlwaysSurplus, undefined, 'the old surplus count is gone');
});

test('a band that fits exactly has no More button', () => {
    const c = bands.composePanel(GRID, alwaysModel(4), {});
    assert.deepEqual(c.more, []);
    assert.deepEqual(texts(c, 0, 4), ['a1', 'a2', 'a3', 'a4']);
});

test('one entry too many puts More in the band\'s LAST position', () => {
    const c = bands.composePanel(GRID, alwaysModel(5), {});
    assert.deepEqual(c.more, [{ index: 3, band: 'always', page: 0, label: 'More' }]);
    assert.deepEqual(texts(c, 0, 4), ['a1', 'a2', 'a3', undefined]);
    assert.equal(c.firstPage.always, 3);
    assert.equal(c.behindMore.always, 2);
    assert.equal(c.unreachable.always, 0, 'nothing is unreachable any more');
});

test('More pages the band in place, and reads Close on the last set', () => {
    const model = alwaysModel(8);   // 3 per page: a1-a3, a4-a6, a7-a8
    const p1 = bands.composePanel(GRID, model, { paging: { band: 'always', page: 1 } });
    assert.deepEqual(texts(p1, 0, 3), ['a4', 'a5', 'a6']);
    assert.equal(p1.more[0].label, 'More');
    assert.equal(p1.more[0].index, 3, 'the button never moves');
    const p2 = bands.composePanel(GRID, model, { paging: { band: 'always', page: 2 } });
    assert.deepEqual(texts(p2, 0, 3), ['a7', 'a8', undefined]);
    assert.equal(p2.more[0].label, 'Close');
    assert.deepEqual(texts(p2, 8, 9), ['g1'], 'the other bands are untouched');
});

test('a page past the end is clamped to the last one', () => {
    const c = bands.composePanel(GRID, alwaysModel(8), { paging: { band: 'always', page: 9 } });
    assert.deepEqual(c.paging, { band: 'always', page: 2, last: 2 });
});

test('the whole-panel scope fills every position but More with the band\'s extras', () => {
    const model = alwaysModel(20);   // page 0 shows 3; later pages show 11 (12 minus More)
    const c = bands.composePanel(GRID, model, { paging: { band: 'always', page: 1, scope: 'panel' } });
    assert.deepEqual(texts(c, 0, 3), ['a4', 'a5', 'a6']);
    assert.equal(c.items[3], undefined, 'the More position itself holds no entry');
    assert.deepEqual(texts(c, 4, 12), ['a7', 'a8', 'a9', 'a10', 'a11', 'a12', 'a13', 'a14']);
    assert.ok(c.bands.every((b) => b === 'always'), 'the extras keep their own band color');
    assert.deepEqual(c.more.map((m) => [m.index, m.label]), [[3, 'More']]);
    const last = bands.composePanel(GRID, model, { paging: { band: 'always', page: 2, scope: 'panel' } });
    assert.deepEqual(texts(last, 0, 3), ['a15', 'a16', 'a17']);
    assert.equal(last.more[0].label, 'Close');
});

test('a switched-on button moves to the front and goes back when switched off', () => {
    const feelings = ['Happy', 'Sad', 'Tired', 'Calm', 'Bored', 'Proud']
        .map((t) => ({ id: t, type: 'feeling', text: t }));
    const model = { sizes: { shape: 'counts', context: 4, flex: 0 }, always: [], context: feelings, flex: {} };
    const on = bands.composePanel(GRID, model, { litIds: ['Proud'] });
    assert.deepEqual(texts(on, 8, 11), ['Proud', 'Happy', 'Sad']);
    const off = bands.composePanel(GRID, model, { litIds: [] });
    assert.deepEqual(texts(off, 8, 11), ['Happy', 'Sad', 'Tired']);
});

test('growing the Context band never moves an Always button that is still showing', () => {
    const model = (context) => ({
        sizes: { shape: 'counts', context, flex: 0 },
        always: phrases('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'),
        context: [], flex: {},
    });
    const small = bands.composePanel(GRID, model(4), {});
    const big = bands.composePanel(GRID, model(6), {});
    // The band ends sooner; the buttons that remain are exactly where they were. (With
    // Context 6 the Always band is six positions for eight phrases, so the sixth is More.)
    assert.deepEqual(small.items.slice(0, 5).map((x) => x.text), big.items.slice(0, 5).map((x) => x.text));
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

// A row is not a fixed quantity - "one row" is 13 positions on one layout and 2 on
// another - so a one-row band can land below the floor of four. It is made up by taking
// the WHOLE row above, not by borrowing cells from it: borrowing left a row that was
// half Always and half Context, a ragged edge in the one mode the user chose for its
// straight edge (Ken, August 23 2026).
test('a one-row Context band below the floor takes the whole row above', () => {
    const narrow = [Array(10).fill('x'), Array(10).fill('x'), Array(2).fill('x')];
    const plan = bands.bandPlan(narrow, { shape: 'rows', contextRows: 1, flexRows: 0 });
    assert.equal(plan.contextN, 12, 'the 2-wide row plus the 10-wide row above it');
    assert.equal(plan.flexN, 0, 'rows come from Always above, never from Flex below');
    assert.equal(plan.alwaysN, 10);
    // And the edge stays straight: no row holds two bands.
    let i = 0;
    for (const row of [10, 10, 2]) {
        const kinds = new Set();
        for (let k = 0; k < row; k++) kinds.add(plan.bands[i++]);
        assert.equal(kinds.size, 1, 'every row belongs to exactly one band');
    }
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
    assert.deepEqual(Array.from(composed.items.slice(27), (x) => x && x.text),
        ['c1', 'c2', 'c3', 'c4', undefined], 'the first four show, and More takes the fifth');
    assert.equal(composed.behindMore.context, 2, 'the rest are behind More, not lost');
    assert.equal(composed.unreachable.context, 0);
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
    const shown = composed.bands.flatMap((b, i) => (b === 'context' ? [composed.items[i] && composed.items[i].text] : []));
    assert.deepEqual(shown, ['Happy', 'Sad', 'Stressed', undefined],
        'three show rather than none, and More takes the fourth');
    assert.equal(composed.behindMore.context, 3);
});

test('the rescued cells come from Always, never from Flex', () => {
    const s8 = [5, 5, 5, 5, 5, 3, 4, 0].map((n) => Array.from({ length: n }, () => 'x'));
    const plan = bands.bandPlan(s8, { shape: 'rows', contextRows: 1, flexRows: 1 });
    // Seven rows hold buttons. Flex takes the last of them (4 wide), Context the one
    // above (3 wide) - under the floor, so it takes the whole 5-wide row above as well.
    assert.equal(plan.flexN, 4, 'Flex gets a row of BUTTONS, not the compose-only row');
    assert.equal(plan.contextN, 8, '3 + 5, made up by a whole row');
    assert.equal(plan.alwaysN, 20, 'and the row came from here, never from Flex');
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

// ⚠ THE HARD RULE, ASSERTED ACROSS EVERY REAL LAYOUT (Ken, August 23 2026): there must
// always be room for four offered choices, and they land in the Context band. A one-row
// band on a narrow bottom row cannot provide that, so the band takes a second row. This
// walks all 21 shipped layouts rather than a sample, because the failure is per-layout
// and a sample is exactly how Side Layout 8 got missed.
test('every shipped layout gives the Context band at least four slots at one row', async () => {
    const { LAYOUTS, panelRoles } = await import('../app/js/keyboard-layouts.js');
    const short = [];
    for (const [id, def] of Object.entries(LAYOUTS)) {
        const plan = bands.bandPlan(def.rows, { shape: 'rows', contextRows: 1, flexRows: 0 });
        if (plan.contextN < bands.CONTEXT_FLOOR) short.push(`${id} (${plan.contextN})`);
        // And no row may hold two bands: the straight edge is why rows mode exists.
        const perRow = panelRoles(def.rows).map((r) => r.filter((c) => c.role === 'position').length);
        let i = 0;
        for (const n of perRow) {
            const kinds = new Set();
            for (let k = 0; k < n; k++) kinds.add(plan.bands[i++]);
            assert.ok(kinds.size <= 1, `${id}: a row holds ${kinds.size} bands`);
        }
    }
    assert.deepEqual(short, [], 'layouts whose Context band cannot hold a four-way menu');
});

test('the reserved choice cells are the LAST four of the Context band, and only four', () => {
    const wide = [Array(5).fill('x'), Array(5).fill('x'), Array(7).fill('x')];
    const c = bands.composePanel(wide, {
        sizes: { shape: 'rows', contextRows: 1, flexRows: 0 }, always: [], context: [], flex: {},
    }, {});
    assert.equal(c.counts.context, 7);
    // Seven empty Context cells, but only four are spoken for. The other three are
    // genuinely free and must keep looking free rather than claiming to be reserved.
    assert.deepEqual(c.choiceSlots, [13, 14, 15, 16]);
});

test('a Context band smaller than four reserves what it has, without inventing cells', () => {
    // Cannot normally happen - the floor prevents it - but composePanel must not
    // fabricate slot numbers if it ever does.
    const tiny = [Array(4).fill('x'), Array(2).fill('x')];
    const c = bands.composePanel(tiny, {
        sizes: { shape: 'counts', context: 2, flex: 0 }, always: [], context: [], flex: {},
    }, {});
    assert.ok(c.choiceSlots.length <= c.counts.context);
});

// ⚠ NOT ABOUT BANDS, BUT IT BIT HERE: sections.js remembers open state by POSITION
// within a NAMED SCOPE, so two containers sharing a scope name silently share their
// sections' open state. The Express tab and the band editor both used "express", so
// the tab's second section and the editor's second section were the same key - and
// re-rendering the editor (which changing the unit of measure does) handed one's state
// to the other. The guard is that the two names differ.
test('the band editor registers its sections under its own scope name', async () => {
    const src = await import('node:fs').then((fs) => fs.promises.readFile('app/js/express-editor.js', 'utf8'));
    const call = src.match(/makeCollapsible\(container,\s*'([^']+)'\)/);
    assert.ok(call, 'the editor still hands its sections to sections.js');
    assert.notEqual(call[1], 'express',
        'must not collide with the Express tab panel, whose scope is its data-tab name');
});

// --- the reserved cells ARE the cells used (Ken, August 26 2026) -------------
// ⚠ THE CROSS-LAYER CHECK. Every other case here fabricates its own input, and the
// bug this guards lived precisely in the join: composePanel reserved the last cells
// of the CONTEXT band while the renderer placed the partner's alternatives on the
// last cells of the WHOLE PANEL. Both halves were individually correct and agreed
// only while the Flex band was empty — the shipped default, which is why it looked
// right for as long as it did. So this test takes composePanel's real output and
// feeds it to the real placement function, rather than asserting about either alone.
test('a real composed panel places choice buttons only on the cells it reserved', async () => {
    const { choiceCells } = await import('../app/js/express-items.js');
    const layout = rows(8, 8, 8, 8);          // 32 positions
    const model = {
        sizes: { shape: bands.SHAPE.COUNTS, context: 6, flex: 8 },   // a NON-EMPTY Flex band
        always: [], context: [], flex: {},
    };
    const panel = bands.composePanel(layout, model, {});
    const contextCells = panel.bands
        .map((b, i) => (b === bands.BAND.CONTEXT ? i : -1)).filter((i) => i >= 0);

    for (const n of [1, 2, 3, 4]) {
        const cells = choiceCells(panel.choiceSlots, n);
        assert.equal(cells.length, n, `${n} alternatives get ${n} cells`);
        for (const cell of cells) {
            assert.ok(contextCells.includes(cell),
                `cell ${cell} must be in the Context band, not ${panel.bands[cell]}`);
        }
    }
    // And the reservation the user can SEE is the reservation that gets used.
    assert.deepEqual(choiceCells(panel.choiceSlots, 4), panel.choiceSlots);
});

// --- GOAL BUTTONS (Ken, September 10 2026) ----------------------------------------
// Goals take the LEADING Flex positions. They are Flex rather than Context because
// the band is decided by how the content is DETERMINED - which goals exist depends on
// which partner was chosen - and not by whether the button speaks, which is the
// reading Ken had to correct once already.

const goals = (...faces) => faces.map((f) => ({ type: 'goal', id: f, label: f, text: f + ' fully' }));

test('goals lead the Flex band, ahead of every situational phrase', () => {
    const c = bands.composePanel(GRID, {
        sizes: { shape: 'counts', context: 4, flex: 4 },
        always: [], context: [],
        flex: { [bands.flexKey('mom', null)]: phrases('Mom one', 'Mom two') },
    }, { partnerId: 'mom', goals: goals('Making peace', 'Being upbeat') });
    const flexCells = c.items.slice(8);
    assert.deepEqual(flexCells.map((x) => x && x.label || x && x.text),
        ['Making peace', 'Being upbeat', 'Mom one', 'Mom two']);
    assert.deepEqual(c.bands.slice(8), ['flex', 'flex', 'flex', 'flex']);
});

test('a goal outranks a situational phrase for the first page', () => {
    // A goal that does not fit cannot steer anything; a phrase that does not fit can
    // still be typed. So when the band is short, the goal is the one that stays up front.
    const c = bands.composePanel(GRID, {
        sizes: { shape: 'counts', context: 4, flex: 2 },
        always: [], context: [],
        flex: { [bands.flexKey('mom', null)]: phrases('Mom one', 'Mom two') },
    }, { partnerId: 'mom', goals: goals('Making peace') });
    assert.deepEqual(Array.from(c.items.slice(10), (x) => x && (x.label || x.text)), ['Making peace', undefined]);
    assert.equal(c.more[0].index, 11);
});

test('a goal that will not fit is REPORTED, not silently dropped', () => {
    // The shipped default is no Flex band at all, so this is the ordinary state for
    // anybody who has not sized one - which is deliberate (Ken: leave it as is, no
    // auto-growing), and is exactly why the editor has to say so.
    const c = bands.composePanel(GRID, {
        sizes: { shape: 'counts', context: 4, flex: 0 }, always: [], context: [], flex: {},
    }, { goals: goals('Making peace', 'Being upbeat') });
    assert.equal(c.counts.flex, 0);
    assert.equal(c.unreachable.goals, 2);
    assert.ok(!c.items.some((x) => x && x.type === 'goal'), 'and none of them is drawn');
});

test('a switched-on goal moves to the front of the goals', () => {
    const c = bands.composePanel(GRID, {
        sizes: { shape: 'counts', context: 4, flex: 3 },
        always: [], context: [],
        flex: { [bands.flexKey(null, null)]: phrases('General') },
    }, { goals: goals('Making peace', 'Being upbeat'), litIds: ['Being upbeat'] });
    assert.deepEqual(c.items.slice(9).map((x) => x && (x.label || x.text)),
        ['Being upbeat', 'Making peace', 'General']);
});

test('no goals changes nothing about the Flex band', () => {
    const model = {
        sizes: { shape: 'counts', context: 4, flex: 2 },
        always: [], context: [],
        flex: { [bands.flexKey(null, null)]: phrases('One', 'Two') },
    };
    const without = bands.composePanel(GRID, model, {});
    const empty = bands.composePanel(GRID, model, { goals: [] });
    assert.deepEqual(without.items.slice(10).map((x) => x.text), ['One', 'Two']);
    assert.deepEqual(empty.items.slice(10).map((x) => x.text), ['One', 'Two']);
    assert.equal(empty.unreachable.goals, 0);
});
