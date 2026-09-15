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
 *   FLEX     what the partner and place currently selected imply - the goals the
 *            user has for this relationship first, then phrases suited to them
 *
 * SIZING (Ken, August 23 2026). The user sets CONTEXT and FLEX; ALWAYS takes the
 * remainder. That way an untouched panel — no Flex band, a small Context band — is
 * almost exactly the panel that shipped before bands existed. Always has NO floor:
 * zero is legitimate, because a panel given over entirely to steering the AI is an
 * important panel, and the phrases are not lost in any case (see the overflow rule).
 *
 * OVERFLOW IS A "More" BUTTON IN THE BAND ITSELF (Ken, September 14 2026). This
 * REPLACES the August 23 rule that queued surplus Always phrases at the end of the
 * Flex band. A band holding more entries than it has positions gives its LAST position
 * to More; tapping it shows the band's next entries, the button never moves, and on the
 * last set it reads Close. Every entry in a band of two or more positions is therefore
 * reachable, and an Always phrase never appears outside the Always band.
 *
 * A setting decides what More replaces: only that band's positions, or every position
 * on the panel except the compose key. Either way nothing about the GRID changes, so
 * no keyguard hole moves - only what sits behind the holes.
 *
 * A SWITCHED-ON BUTTON ALWAYS SHOWS (Ken): a lit partner, place, feeling or goal is
 * moved to the front of its band, and returns to its own place in the user's order
 * when switched off. Otherwise a lit button could sit on a later page, still steering
 * the AI with nothing on screen saying so.
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

// THE SHIPPED PANEL IS MEASURED IN WHOLE ROWS, one row of Context and no Flex (Ken,
// September 2 2026). Rows because a straight edge is what makes three bands read as
// three bands on first sight; ONE row of Context because the band has a floor and
// cannot be turned off - a menu arriving has to have somewhere to land, and a band
// that could collapse would change the panel's shape mid-conversation. No Flex,
// because a new user has no partners and no places yet, so a Flex band would open
// empty and explain nothing.
//
// The COUNTS values are kept as the defaults for a user who switches to that mode.
// Context is SIX there, not the floor of four: the starting set has six feelings in
// it, and a default that cannot show its own defaults would greet a new user with two
// buttons already overflowing.
export const DEFAULT_SIZES = {
    shape: SHAPE.ROWS, contextRows: 1, flexRows: 0, context: 6, flex: 0,
};

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
    const context = litFirst((model.context || []).filter(Boolean), situation.litIds);

    // GOALS TAKE THE LEADING FLEX POSITIONS, ahead of every situational phrase (Ken,
    // September 10 2026).
    //
    // ⚠ THE BAND IS DECIDED BY HOW THE CONTENT IS DETERMINED, NOT BY WHETHER THE
    // BUTTON SPEAKS - which is the rule Ken had to correct once already. A goal
    // button says nothing when tapped, so the obvious reading is that it belongs
    // with the other non-speaking buttons in the Context band. It does not: the
    // Context band is where the user SUPPLIES the dimensions (who, where, how I
    // feel), and Flex is everything that is a FUNCTION of them. Which goals exist at
    // all depends on which partner was chosen, so they are Flex.
    //
    // FIRST WITHIN THE BAND because they are the most specific thing in it - they
    // belong to this one person - and because a goal not reachable is a goal that
    // cannot steer anything, where a phrase not reachable can still be typed.
    const allGoals = litFirst((situation.goals || []).filter(Boolean), situation.litIds);
    const flex = flexFill(model.flex || {}, situation.partnerId, situation.placeId, Infinity);
    const lists = {
        [BAND.ALWAYS]: always,
        [BAND.CONTEXT]: context,
        [BAND.FLEX]: allGoals.concat(flex),
    };

    const positions = { [BAND.ALWAYS]: [], [BAND.CONTEXT]: [], [BAND.FLEX]: [] };
    for (let i = 0; i < plan.total; i++) positions[plan.bands[i]].push(i);

    const items = new Array(plan.total);
    const bandsOut = plan.bands.slice();
    const more = [];
    const firstPage = {};
    const behindMore = {};
    const unreachableOf = {};
    const lastPageOf = {};

    // Which band is paged, and how far. Anything else about paging is clamped here so a
    // stale request (the band shrank, or its list got shorter) can never draw past the end.
    const req = situation.paging || null;
    const scope = req && req.scope === 'panel' ? 'panel' : 'band';

    for (const band of [BAND.ALWAYS, BAND.CONTEXT, BAND.FLEX]) {
        const P = positions[band];
        const L = lists[band];
        const n = P.length;
        // More needs a position to stand on AND at least one to show beside it, so a
        // band of one position cannot page: its extras are genuinely unreachable.
        if (L.length <= n || n < 2) {
            P.forEach((cell, k) => { items[cell] = L[k]; });
            firstPage[band] = Math.min(n, L.length);
            behindMore[band] = 0;
            unreachableOf[band] = Math.max(0, L.length - n);
            continue;
        }
        const per = n - 1;
        firstPage[band] = per;
        behindMore[band] = L.length - per;
        unreachableOf[band] = 0;
        const lastBandPage = Math.ceil(L.length / per) - 1;
        const lastPanelPage = Math.ceil((L.length - per) / Math.max(1, plan.total - 1));
        lastPageOf[band] = scope === 'panel' ? lastPanelPage : lastBandPage;
        let page = req && req.band === band ? Math.max(0, Math.round(+req.page || 0)) : 0;
        page = Math.min(page, lastPageOf[band]);
        const moreAt = P[n - 1];
        // The band's own positions: page 0 always, and every page under the band scope.
        const start = scope === 'band' ? page * per : 0;
        for (let k = 0; k < per; k++) items[P[k]] = L[start + k];
        more.push({ index: moreAt, band, page, label: page >= lastPageOf[band] ? 'Close' : 'More' });
    }

    // THE WHOLE-PANEL SCOPE: on a page past the first, every position except the tapped
    // More button shows this band's next entries, in reading order. The extras keep
    // their own band's color wherever they land, so they still say what they are; the
    // other bands' More buttons are covered for as long as this set is up.
    let paged = null;
    for (const m of more) if (m.page > 0) paged = m;
    if (paged && scope === 'panel') {
        const L = lists[paged.band];
        const per0 = positions[paged.band].length - 1;
        const perP = plan.total - 1;
        const offset = per0 + (paged.page - 1) * perP;
        let k = 0;
        for (let i = 0; i < plan.total; i++) {
            if (i === paged.index) continue;
            items[i] = L[offset + k++];
            bandsOut[i] = paged.band;
        }
        more.splice(0, more.length, paged);
    }

    // WHICH CELLS THE PARTNER'S CHOICES WILL LAND ON: the last four of the Context band
    // (they take the far end - see the design). Reported so an EMPTY one can say what it
    // is for rather than looking like a cell somebody forgot to fill. Only the last four,
    // because only four are ever reserved; any other empty Context cell is genuinely
    // free and should keep looking free.
    const ctxIdx = [];
    for (let i = 0; i < plan.total; i++) if (plan.bands[i] === BAND.CONTEXT) ctxIdx.push(i);
    const choiceSlots = ctxIdx.slice(Math.max(0, ctxIdx.length - CONTEXT_FLOOR));

    const goalsShownOrPaged = plan.flexN >= 2 ? allGoals.length : Math.min(allGoals.length, plan.flexN);
    return {
        items,
        bands: bandsOut,
        choiceSlots,
        counts: { always: plan.alwaysN, context: plan.contextN, flex: plan.flexN },
        // The More (or Close) buttons to draw, one per band that overflows - or only the
        // paged band's while the whole-panel scope has taken the panel over.
        more,
        // The page actually shown, after clamping, so the caller can keep its request
        // in step: { band, page, last } or null when nothing is paged.
        paging: paged ? { band: paged.band, page: paged.page, last: lastPageOf[paged.band] } : null,
        // How many entries each band shows before its More button, and how many sit
        // behind it. The editor draws its dividing line from the first.
        firstPage,
        behindMore,
        // What cannot be reached at all - only possible in a band too small for a More
        // button. The editor says so rather than hiding it.
        unreachable: {
            always: unreachableOf[BAND.ALWAYS],
            context: unreachableOf[BAND.CONTEXT],
            // A goal with no Flex position to stand on. Reported for the same reason
            // the other two are: the user finds out when they set the band size, not
            // weeks later when they wonder why a goal they recorded never appears.
            // NOTE the shipped default is NO Flex band at all, so this is the ordinary
            // state for anybody who has not sized one - which is deliberate (Ken,
            // September 10 2026: leave it as is, no auto-growing).
            goals: Math.max(0, allGoals.length - goalsShownOrPaged),
        },
    };
}

/**
 * Switched-on buttons first, everything else in the user's own order. Stable, so a
 * button switched off goes straight back to where it was in the priority.
 */
export function litFirst(list, litIds) {
    const lit = new Set((litIds || []).filter(Boolean));
    if (!lit.size) return list;
    return list.filter((x) => lit.has(x && x.id)).concat(list.filter((x) => !lit.has(x && x.id)));
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
