/* Express Panel bands — the sizing arithmetic and the fill order (August 23 2026).
 *
 * The panel used to be one ordered list of items mapped 1:1 onto the cells of the
 * chosen keyboard layout. It is now three BANDS of cells, each with its own rule about
 * when its contents change. This module is the pure part: given the layout, the band
 * sizes and the user's lists, it says which band every cell belongs to and what goes
 * in it. No DOM, no storage — ui.js still receives one ordered list, so the renderer
 * did not have to learn about bands to place a button.
 *
 * THE ORDER IS ALWAYS, CONTEXT, FLEX, and it is by which band must not move:
 *   ALWAYS   the words that never change, first so nothing above can shift them
 *   CONTEXT  the buttons that never SPEAK — partner, place, feeling, and whatever the
 *            partner has just put on the table
 *   FLEX     phrases suited to the partner and place currently selected
 *
 * SIZING (Ken, August 23 2026). The user sets CONTEXT and FLEX; ALWAYS takes the
 * remainder. That way an untouched panel — no Flex band, a small Context band — is
 * almost exactly the panel that shipped before bands existed. Always has NO floor:
 * zero is legitimate, because a panel given over entirely to steering the AI is an
 * important panel, and the phrases are not lost in any case (see the overflow rule).
 *
 * ⚠ THE OVERFLOW RULE, AND THE DIRECTION MATTERS — I had it backwards once and Ken
 * caught it. An Always phrase with no room in its own band queues at the very END of
 * the Flex band, behind everything the partner and the place supplied. It takes only
 * genuinely spare positions. It can NEVER displace a situational phrase. So growing
 * the Context band shortens Always from its bottom, and the surplus shows up only
 * where the situational lists left room — or not at all, which the editor says.
 *
 * THE CONTEXT BAND'S FLOOR OF FOUR IS UNCONDITIONAL, including for a user who has
 * defined no context buttons at all. If the band could collapse when empty, a menu
 * arriving would have to conjure four positions out of nowhere and the panel would
 * change shape in the middle of a conversation. That is the one thing that must never
 * happen, so four reserved outlines is the price. (This reverses the July 2026 "choice
 * buttons get no standing reservation" decision, which was right when those cells had
 * no resting job and wrong once they hold the partner, place and feeling buttons.)
 */

import { panelRoles } from './keyboard-layouts.js';

export const BAND = { ALWAYS: 'always', CONTEXT: 'context', FLEX: 'flex' };

/** The most alternatives a partner's menu will ever put on the table. */
export const CONTEXT_FLOOR = 4;

/** A band is measured either in whole rows or in a count of buttons (user setting). */
export const SHAPE = { ROWS: 'rows', COUNTS: 'counts' };

// The shipped Context band is SIX, not the floor of four: the starting set has six
// feelings in it, and a default that cannot show its own defaults would greet a new
// user with two buttons already overflowing. Flex starts at none, so an untouched
// panel is the Always phrases plus the feelings and nothing else to explain.
export const DEFAULT_SIZES = { shape: SHAPE.COUNTS, context: 6, flex: 0 };

/** The key naming one situational list. Anyone + Anyplace IS the general list. */
export const ANYONE = 'anyone';
export const ANYPLACE = 'anyplace';
export function flexKey(partnerId, placeId) {
    return `${partnerId || ANYONE}|${placeId || ANYPLACE}`;
}
export function parseFlexKey(key) {
    const [partnerId, placeId] = String(key || '').split('|');
    return { partnerId: partnerId || ANYONE, placeId: placeId || ANYPLACE };
}

/**
 * How many cells the layout offers the panel, and how they are grouped into rows.
 * Only 'position' cells count: the compose key and the inert spacers are neither
 * sized nor banded, which is why the arithmetic never needs a "minus one".
 */
export function positionPlan(layoutRows) {
    const roles = panelRoles(layoutRows);
    const perRow = roles.map((row) => (row || []).filter((c) => c.role === 'position').length);
    return { perRow, total: perRow.reduce((n, k) => n + k, 0) };
}

/**
 * Which band each panel position belongs to, in reading order.
 *
 * Under COUNTS a band is a number of buttons, so a boundary can fall part-way along a
 * row and one row can show two bands. Under ROWS a band is a whole number of rows, so
 * the edge is straight but the size available is whatever that layout's rows happen to
 * hold — 2 on one layout and 13 on another. Which of the two reads better is a matter
 * of taste, so it is a setting rather than a decision.
 */
export function bandPlan(layoutRows, sizes = {}) {
    const { perRow, total } = positionPlan(layoutRows);
    const shape = sizes.shape === SHAPE.ROWS ? SHAPE.ROWS : SHAPE.COUNTS;
    const bands = new Array(total);

    let ctxN;
    let flexN;
    if (shape === SHAPE.ROWS) {
        // ⚠ A ROW WITH NO BUTTON POSITIONS IS NOT A ROW FOR THIS PURPOSE (Ken, August 23
        // 2026). Side Layouts 2 and 8 end in a row holding ONLY the compose key, and
        // counting it meant a two-row Context band spent one of its rows on nothing:
        // Ken asked for two rows, watched one row appear, and was told two buttons did
        // not fit. The user is counting rows of BUTTONS, because that is what a row of
        // the panel looks like, so the arithmetic has to count the same thing.
        const filled = perRow.map((count, r) => ({ count, r })).filter((x) => x.count > 0);
        const nRows = filled.length;
        let ctxRows = clamp(sizes.contextRows ?? 1, 0, nRows);
        const flexRows = clamp(sizes.flexRows ?? 0, 0, nRows - ctxRows);
        let alwaysRows = nRows - ctxRows - flexRows;

        // ⚠ IN ROWS MODE THE FLOOR IS MADE UP BY WHOLE ROWS, NOT BY BORROWING CELLS.
        // Borrowing produced a row that was half Always and half Context - a ragged
        // edge in the one mode the user chose FOR its straight edge, which defeats the
        // point of the setting. On Side Layout 1 a one-row Context band is 2 cells, so
        // it takes the row above and becomes 7; on Side Layout 8 it is already 4 and
        // nothing moves. Rows come from ALWAYS above, never from Flex below.
        const ctxPositions = () => filled.slice(alwaysRows, alwaysRows + ctxRows)
            .reduce((n, x) => n + x.count, 0);
        while (ctxPositions() < Math.min(CONTEXT_FLOOR, total) && alwaysRows > 0) {
            alwaysRows--;
            ctxRows++;
        }
        // Which band each row belongs to, keyed by its place among the rows that
        // actually hold buttons. An empty row is skipped rather than banded: it has no
        // positions to give anyone, so it can neither be claimed nor spent.
        const bandOfRow = new Map();
        filled.forEach((x, k) => {
            bandOfRow.set(x.r, k < alwaysRows ? BAND.ALWAYS
                : k < alwaysRows + ctxRows ? BAND.CONTEXT : BAND.FLEX);
        });
        let i = 0;
        perRow.forEach((count, r) => {
            const band = bandOfRow.get(r);
            for (let k = 0; k < count; k++) bands[i++] = band;
        });
        ctxN = bands.filter((b) => b === BAND.CONTEXT).length;
        flexN = bands.filter((b) => b === BAND.FLEX).length;
        // Whole rows have already made up the floor above, so nothing is borrowed here.
        // ⚠ THE FLOOR OF FOUR APPLIES IN ROWS MODE TOO, and it has to be enforced here
        // rather than on the row count, because A ROW IS NOT A FIXED QUANTITY. "One row"
        // is 13 positions on one layout, 2 on another - and on Side Layouts 2 and 8 the
        // last row holds NO button positions at all, so a one-row Context band there
        // came out EMPTY. Ken hit exactly that: six feelings, none of them showing, the
        // editor reporting all six as not fitting.
        //
        // The band takes the cells it needs from the band ABOVE it, never from Flex
        // below, which would let a menu push out a situational phrase.
        //
        // ⚠ AND IT IS COMPUTED FROM THE BOUNDARY, NOT BY FINDING AN EXISTING CONTEXT
        // CELL. A first version walked back from bands.indexOf(CONTEXT), which is -1
        // when the band is empty - so the one case that most needed rescuing was the one
        // case it silently skipped.
        const want = Math.min(CONTEXT_FLOOR, total);
        if (ctxN < want) {
            const firstFlex = bands.indexOf(BAND.FLEX);
            const firstCtx = bands.indexOf(BAND.CONTEXT);
            let edge = firstCtx >= 0 ? firstCtx : (firstFlex >= 0 ? firstFlex : total);
            while (ctxN < want && edge > 0 && bands[edge - 1] === BAND.ALWAYS) {
                bands[--edge] = BAND.CONTEXT;
                ctxN++;
            }
        }
    } else {
        // The floor applies to what is RESERVED, not to what the user has filled.
        ctxN = clamp(Math.max(sizes.context ?? CONTEXT_FLOOR, CONTEXT_FLOOR), 0, total);
        flexN = clamp(sizes.flex ?? 0, 0, total - ctxN);
        const alwaysN = total - ctxN - flexN;
        for (let i = 0; i < total; i++) {
            bands[i] = i < alwaysN ? BAND.ALWAYS
                : i < alwaysN + ctxN ? BAND.CONTEXT : BAND.FLEX;
        }
    }

    const alwaysN = total - ctxN - flexN;
    return { bands, total, alwaysN, contextN: ctxN, flexN, shape };
}

function clamp(n, lo, hi) {
    const v = Number.isFinite(+n) ? Math.round(+n) : lo;
    return Math.max(lo, Math.min(hi, v));
}

/**
 * The Flex band's contents, most specific list first.
 *
 * Four lists, ranked: this partner in this place, this partner anywhere, anyone in
 * this place, then the general set. All four are made by the same mechanism — the user
 * picks a partner and a place, each of which also offers Anyone and Anyplace — so a
 * combination is simply the case where neither is left on its default.
 *
 * A phrase listed in more than one of them is shown ONCE, at its best position;
 * otherwise a phrase sensibly put in both a partner's list and the general list would
 * occupy two positions on a panel that is already short of them.
 */
export function flexFill(flexLists, partnerId, placeId, room) {
    const out = [];
    const seen = new Set();
    const take = (key, source) => {
        for (const item of (flexLists && flexLists[key]) || []) {
            if (out.length >= room) return;
            const word = String(item && item.text || '').trim().toLowerCase();
            if (!word || seen.has(word)) continue;
            seen.add(word);
            out.push({ ...item, source });
        }
    };
    if (partnerId && placeId) take(flexKey(partnerId, placeId), 'pair');
    if (partnerId) take(flexKey(partnerId, ANYPLACE), 'partner');
    if (placeId) take(flexKey(ANYONE, placeId), 'place');
    take(flexKey(ANYONE, ANYPLACE), 'general');
    return out;
}

/**
 * Compose the whole panel: one ordered array the renderer can map onto cells, plus a
 * parallel array saying which band each cell is in (the renderer needs that only to
 * pick the background — a band's color is the one thing that says which band it is).
 *
 * A cell with nothing to put in it is `undefined`, which the renderer already draws as
 * the outline of a button. That is what makes the Context band's floor visible and
 * harmless: reserved, not blank-forever.
 */
export function composePanel(layoutRows, model = {}, situation = {}) {
    const plan = bandPlan(layoutRows, model.sizes || DEFAULT_SIZES);
    const always = (model.always || []).filter(Boolean);
    const context = (model.context || []).filter(Boolean);

    const alwaysShown = always.slice(0, plan.alwaysN);
    const alwaysSurplus = always.slice(plan.alwaysN);

    const flex = flexFill(model.flex || {}, situation.partnerId, situation.placeId, plan.flexN);
    // ...and only then, into whatever the situational lists did not claim.
    const spare = Math.max(0, plan.flexN - flex.length);
    const flexCells = flex.concat(alwaysSurplus.slice(0, spare));

    const items = new Array(plan.total);
    let a = 0; let c = 0; let f = 0;
    for (let i = 0; i < plan.total; i++) {
        if (plan.bands[i] === BAND.ALWAYS) items[i] = alwaysShown[a++];
        else if (plan.bands[i] === BAND.CONTEXT) items[i] = context[c++];
        else items[i] = flexCells[f++];
    }
    // WHICH CELLS THE PARTNER'S CHOICES WILL LAND ON: the last four of the Context band
    // (they take the far end - see the design). Reported so an EMPTY one can say what it
    // is for rather than looking like a cell somebody forgot to fill. Only the last four,
    // because only four are ever reserved; any other empty Context cell is genuinely
    // free and should keep looking free.
    const ctxIdx = [];
    for (let i = 0; i < plan.total; i++) if (plan.bands[i] === BAND.CONTEXT) ctxIdx.push(i);
    const choiceSlots = ctxIdx.slice(Math.max(0, ctxIdx.length - CONTEXT_FLOOR));

    return {
        items,
        bands: plan.bands,
        choiceSlots,
        counts: { always: plan.alwaysN, context: plan.contextN, flex: plan.flexN },
        // What did not fit anywhere. The editor says so rather than hiding it: the user
        // finds out when they add the phrase, not weeks later.
        unreachable: {
            always: Math.max(0, alwaysSurplus.length - spare),
            context: Math.max(0, context.length - plan.contextN),
        },
        fromAlwaysSurplus: Math.max(0, flexCells.length - flex.length),
    };
}

/**
 * The Context band's three kinds are kept in their runs and always in the same order:
 * partners, then places, then feelings. The user orders within a run and cannot
 * interleave them — worth the small loss of freedom because it is what lets somebody
 * find a partner button without reading the whole band, and because it makes the FAR
 * END predictable, which is where the partner's offered choices land.
 */
export const CONTEXT_ORDER = ['partner', 'place', 'feeling'];

export function sortContext(list) {
    return (list || []).filter(Boolean).slice().sort((x, y) => {
        const a = CONTEXT_ORDER.indexOf(x.type);
        const b = CONTEXT_ORDER.indexOf(y.type);
        if (a !== b) return (a < 0 ? 99 : a) - (b < 0 ? 99 : b);
        return 0; // stable: the user's own order within a run
    });
}
