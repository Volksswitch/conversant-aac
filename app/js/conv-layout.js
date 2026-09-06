/* The conversation screen's four regions, and the rules for dragging the borders
 * between them.
 *
 * THE RULE (Ken, September 2026): a border resizes the region DIRECTLY BELOW it.
 * Everything further down keeps exactly the size it had; anything between the
 * transcript and the border slides without changing size; the transcript at the top
 * is what gives or takes. The keyboard's own border is the same rule seen sideways -
 * it trades the keyboard against the column beside it.
 *
 * ⚠ THE ONE THING THIS MODULE EXISTS TO GET RIGHT: A DRAG IS STOPPED ON THE WAY IN,
 * NEVER CORRECTED AFTERWARDS. An after-the-fact rescue cannot know which way the
 * finger was going, so it claws space back out of the very region being dragged and
 * the pane SHRINKS while the user pulls to make it bigger. Two more faults came from
 * the same root and are worth naming, because each looks like the app misbehaving on
 * its own: a region trimmed at a limit springing back out several drags later, and a
 * border moving while a different one is being dragged.
 *
 * So: setRegion() refuses to go past the limits, solve() is PURE and merely reports,
 * and normalize() exists only for the things that are not drags - a different screen,
 * or eight response cards instead of four, either of which can raise a floor under a
 * layout that was legal a moment ago.
 *
 * The stored layout is FRACTIONS of the screen, not pixels, so it survives a change of
 * screen and travels with a settings profile onto a different device.
 */

// The floors, in rem, matching the app's own.
export const FLOOR_TRANSCRIPT_REM = 3.0;   // about two lines
export const MIN_BTN_REM = 2.0;            // the smallest still-recognizable button
export const DOCK_CAP_H = 0.72;            // of the height, for a bottom keyboard
export const DOCK_CAP_W = 0.70;            // of the width, for a side keyboard

/* The shipped layout, as fractions. All-defaults reproduces exactly what the app drew
 * before the borders could be dragged: a bottom keyboard was 30% tall with a 10%
 * command bar and a 30% response panel; a side keyboard was 30% wide with the column
 * beside it split 30 / 10 / 60. */
export const DEFAULTS = {
    bottom: { command: 0.10, response: 0.30, dock: 0.30 },
    side: { command: 0.10, response: 0.60, dock: 0.30 },
};

/**
 * How short the response panel may get - which is not one number, because it depends
 * on how many ROWS of cards it has to hold. A bottom keyboard lays four cards out in
 * a line and a side keyboard stacks them two by two; eight-card mode doubles both. A
 * flat floor was too generous for one row and much too mean for four.
 */
export function responseFloorPx(ctx) {
    const rows = ctx.dock === 'side' ? (ctx.cards === 8 ? 4 : 2) : (ctx.cards === 8 ? 2 : 1);
    return rows * MIN_BTN_REM * ctx.rem + (rows + 1) * (ctx.gap || 0);
}

/**
 * Every region's floor and cap, as FRACTIONS, in one place - so the drag stop, the
 * normalizer and the solver cannot disagree about them.
 *
 * `dock` is measured on whichever axis it can grow along: height for a keyboard along
 * the bottom, width for one down the side. Everything else is a height either way.
 */
export function limits(ctx) {
    const h = ctx.height;
    const btn = (MIN_BTN_REM * ctx.rem) / h;
    return {
        floorT: (FLOOR_TRANSCRIPT_REM * ctx.rem) / h,
        command: { lo: btn, hi: 0.4 },
        response: { lo: responseFloorPx(ctx) / h, hi: ctx.dock === 'side' ? 0.85 : 0.6 },
        dock: ctx.dock === 'side'
            // A side keyboard cannot take so much width that the command bar's nine
            // buttons stop being buttons.
            ? { lo: (5 * MIN_BTN_REM * ctx.rem) / ctx.width,
                hi: Math.min(DOCK_CAP_W,
                    1 - (9 * MIN_BTN_REM * ctx.rem + 10 * (ctx.gap || 0)) / ctx.width) }
            : { lo: (2 * MIN_BTN_REM * ctx.rem) / h, hi: DOCK_CAP_H },
    };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

/**
 * The four regions as fractions, plus which of them are against a limit. PURE - it
 * reports, it never rebalances. It is consulted while a drag is in flight, so writing
 * anything here would change the budget underneath the drag in progress.
 */
export function solve(layout, ctx) {
    const lim = limits(ctx);
    const command = clamp(num(layout.command, DEFAULTS[ctx.dock].command), lim.command.lo, lim.command.hi);
    const response = clamp(num(layout.response, DEFAULTS[ctx.dock].response), lim.response.lo, lim.response.hi);
    const dock = clamp(num(layout.dock, DEFAULTS[ctx.dock].dock), lim.dock.lo, lim.dock.hi);
    // A side keyboard takes WIDTH, so it is not part of the vertical budget.
    const transcript = ctx.dock === 'side'
        ? 1 - command - response
        : 1 - command - response - dock;

    const binding = [];
    const at = (v, l, name) => { if (v <= l.lo + 1e-9 || v >= l.hi - 1e-9) binding.push(name); };
    at(command, lim.command, 'command');
    at(response, lim.response, 'response');
    at(dock, lim.dock, 'dock');
    if (transcript <= lim.floorT + 1e-9) binding.push('transcript');

    return { transcript, command, response, dock, binding };
}

function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Resize ONE region, stopping where the transcript reaches its floor.
 *
 * The stop happens here, on the way in, for the reason at the head of this file.
 * Returns a NEW layout object; the caller decides whether to keep it.
 */
export function setRegion(layout, which, value, ctx) {
    const lim = limits(ctx);
    const next = { ...layout };
    // What the OTHER regions are already spending out of the same budget. The
    // keyboard is only in that budget when it is along the bottom.
    let others = 0;
    for (const k of ['command', 'response', 'dock']) {
        if (k === which) continue;
        if (k === 'dock' && ctx.dock === 'side') continue;
        others += num(layout[k], DEFAULTS[ctx.dock][k]);
    }
    const budgetCap = (which === 'dock' && ctx.dock === 'side')
        ? lim.dock.hi                       // its own axis - the vertical budget does not apply
        : Math.min(lim[which].hi, 1 - lim.floorT - others);
    next[which] = Math.max(lim[which].lo, Math.min(num(value, 0), budgetCap));
    return next;
}

/**
 * Force a stored layout back inside its limits. Needed only when something OTHER than
 * a drag changes the sums - a different screen, or eight cards instead of four, both
 * of which can raise a floor under a layout that was legal a moment ago. A drag has
 * already stopped itself, so this is a no-op there.
 *
 * Regions are trimmed furthest-from-the-last-touched first, so the thing the user set
 * most recently is the last thing taken from.
 */
export function normalize(layout, ctx) {
    const lim = limits(ctx);
    const next = { ...layout };
    for (const k of ['command', 'response', 'dock']) {
        next[k] = clamp(num(next[k], DEFAULTS[ctx.dock][k]), lim[k].lo, lim[k].hi);
    }
    if (ctx.dock === 'side') return next;   // the keyboard is on the other axis

    const order = ['dock', 'response', 'command'].filter((k) => k !== next.last);
    if (next.last && order.indexOf(next.last) < 0) order.push(next.last);
    for (const k of order) {
        const owe = lim.floorT - (1 - next.command - next.response - next.dock);
        if (owe <= 0) break;
        next[k] = Math.max(lim[k].lo, next[k] - owe);
    }
    return next;
}

/**
 * Which region a border resizes, and on which axis. The names are the app's own
 * region ids, so a caller never has to translate.
 *
 * ⚠ EVERY ONE OF THESE RESIZES THE REGION BELOW (or, for the keyboard's own border on
 * a side dock, the region beyond) - that is the rule, and the reason the list reads
 * so uniformly. A border that resized the region ABOVE it would be the one thing
 * users cannot predict.
 */
export function borders(dock) {
    return dock === 'side'
        ? [
            { id: 'transcriptCommand', axis: 'y', resizes: 'command' },
            { id: 'commandResponse', axis: 'y', resizes: 'response' },
            { id: 'dockMain', axis: 'x', resizes: 'dock' },
        ]
        : [
            { id: 'transcriptCommand', axis: 'y', resizes: 'command' },
            { id: 'commandResponse', axis: 'y', resizes: 'response' },
            { id: 'responseDock', axis: 'y', resizes: 'dock' },
        ];
}

/**
 * Where a border ends up when it is dragged to `fraction` of the screen.
 *
 * Each region keeps its own FAR edge, which is what makes everything below the border
 * stay put: the command bar's bottom edge is fixed by the response panel and the
 * keyboard below it, the response panel's by the keyboard, and the keyboard's by the
 * edge of the screen.
 */
export function valueForDrag(borderId, fraction, solved, ctx) {
    switch (borderId) {
        case 'transcriptCommand':
            return (solved.transcript + solved.command) - fraction;
        case 'commandResponse':
            return ctx.dock === 'side'
                ? 1 - fraction                       // the response panel runs to the foot
                : (1 - solved.dock) - fraction;      // ...or to the top of the keyboard
        case 'responseDock':
            return 1 - fraction;
        case 'dockMain':
            return 1 - fraction;                     // the keyboard runs to the far edge
        default:
            return null;
    }
}
