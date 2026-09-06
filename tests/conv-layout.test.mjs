/* The rules behind the draggable borders on the conversation screen.
 *
 * These are the checks the prototype earned. Dragging borders looks trivial and is
 * not: three separate faults turned up while working the rule out, and every one of
 * them reads on screen as the app misbehaving on its own rather than as a bug -
 *
 *   - a pane SHRINKING while the user pulls to make it bigger, because the layout was
 *     rescued after the fact and the rescue could not tell which way the drag was going
 *   - a pane springing back out to a size it had been refused, several drags later
 *   - a border moving while a DIFFERENT one is being dragged
 *
 * None of them is visible in a single drag; they need a sequence. So the important
 * test here is the long one at the bottom, which drags every border to every extreme
 * in a shuffled order and asserts the rule after each one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../app/js/conv-layout.js';

// A Surface in landscape, the primary target.
const ctxBottom = { dock: 'bottom', width: 1280, height: 800, rem: 16, cards: 4, gap: 0 };
const ctxSide = { ...ctxBottom, dock: 'side' };

const fresh = (ctx) => ({ ...L.DEFAULTS[ctx.dock] });

test('the defaults reproduce the layout the app drew before borders could be dragged', () => {
    const b = L.solve(fresh(ctxBottom), ctxBottom);
    assert.equal(round(b.dock), 0.30, 'a bottom keyboard was 30% of the height');
    assert.equal(round(b.command), 0.10, 'the command bar was 10%');
    assert.equal(round(b.response), 0.30, 'the response panel was 30%');
    assert.equal(round(b.transcript), 0.30, 'leaving 30% for the transcript');

    const s = L.solve(fresh(ctxSide), ctxSide);
    assert.equal(round(s.dock), 0.30, 'a side keyboard was 30% of the width');
    assert.equal(round(s.command), 0.10);
    assert.equal(round(s.response), 0.60);
    assert.equal(round(s.transcript), 0.30, 'and the column beside it split 30/10/60');
});
const round = (n) => Math.round(n * 100) / 100;

for (const ctx of [ctxBottom, ctxSide]) {
    test(`${ctx.dock} keyboard: a border resizes the region below it and nothing else below moves`, () => {
        for (const border of L.borders(ctx.dock)) {
            const before = L.solve(fresh(ctx), ctx);
            // Drag it a tenth of the screen towards the top / the near edge, which
            // makes the region below it bigger.
            const at = borderPosition(border.id, before, ctx);
            const next = L.setRegion(fresh(ctx), border.resizes,
                L.valueForDrag(border.id, at - 0.10, before, ctx), ctx);
            const after = L.solve(next, ctx);

            assert.ok(after[border.resizes] > before[border.resizes] + 0.05,
                `${border.id}: dragging towards the top should GROW ${border.resizes}`);
            for (const other of ['command', 'response', 'dock']) {
                if (other === border.resizes) continue;
                assert.equal(round(after[other]), round(before[other]),
                    `${border.id}: ${other} must not move - only the region below the border and the transcript may`);
            }
        }
    });

    test(`${ctx.dock} keyboard: a drag stops at the limit rather than being corrected afterwards`, () => {
        for (const border of L.borders(ctx.dock)) {
            let layout = fresh(ctx);
            // Drag far past every limit, in the direction that GROWS the region.
            for (let i = 0; i < 6; i++) {
                const solved = L.solve(layout, ctx);
                const at = borderPosition(border.id, solved, ctx);
                layout = L.setRegion(layout, border.resizes,
                    L.valueForDrag(border.id, at - 0.5, solved, ctx), ctx);
            }
            const solved = L.solve(layout, ctx);
            assert.ok(solved.transcript >= L.limits(ctx).floorT - 1e-9,
                `${border.id}: the transcript was pushed under its floor - the drag did not stop`);
            for (const k of ['command', 'response', 'dock']) {
                assert.ok(solved[k] >= L.limits(ctx)[k].lo - 1e-9 && solved[k] <= L.limits(ctx)[k].hi + 1e-9,
                    `${border.id}: ${k} ended up outside its own limits`);
            }
        }
    });
}

// Where a border currently sits, as a fraction of the screen.
function borderPosition(id, solved, ctx) {
    switch (id) {
        case 'transcriptCommand': return solved.transcript;
        case 'commandResponse': return solved.transcript + solved.command;
        case 'responseDock': return solved.transcript + solved.command + solved.response;
        case 'dockMain': return 1 - solved.dock;
        default: throw new Error('unknown border ' + id);
    }
}

test('THE SEQUENCE TEST: every border, every extreme, shuffled - the rule holds after each', () => {
    // The three faults this guards against are all invisible in a single drag. Each
    // needs a sequence: a limit reached, then a different border moved, then back.
    const problems = [];
    for (const ctx of [ctxBottom, ctxSide]) {
        for (const cards of [4, 8]) {
            const c = { ...ctx, cards };
            let layout = fresh(c);
            const list = L.borders(c.dock);
            const amounts = [-0.5, -0.25, -0.1, -0.03, 0.03, 0.1, 0.25, 0.5];
            for (let round2 = 0; round2 < 4; round2++) {
                for (let i = 0; i < list.length; i++) {
                    for (let j = 0; j < amounts.length; j++) {
                        const border = list[i];
                        const delta = amounts[(j + i + round2) % amounts.length];
                        const before = L.solve(layout, c);
                        const at = borderPosition(border.id, before, c);
                        const next = L.setRegion(layout, border.resizes,
                            L.valueForDrag(border.id, at + delta, before, c), c);
                        const after = L.solve(next, c);

                        // Only the region below the border, and the transcript, may move.
                        for (const other of ['command', 'response', 'dock']) {
                            if (other === border.resizes) continue;
                            if (round(after[other]) !== round(before[other])) {
                                problems.push(`${c.dock}/${cards} ${border.id}: ${other} moved`);
                            }
                        }
                        // It must never move the WRONG WAY - a pane shrinking while the
                        // user drags to enlarge it is the fault that started all this.
                        const moved = after[border.resizes] - before[border.resizes];
                        if (delta < -1e-9 && moved < -1e-9) {
                            problems.push(`${c.dock}/${cards} ${border.id}: shrank while being dragged bigger`);
                        }
                        if (delta > 1e-9 && moved > 1e-9) {
                            problems.push(`${c.dock}/${cards} ${border.id}: grew while being dragged smaller`);
                        }
                        // And the layout must stay valid at every step.
                        const lim = L.limits(c);
                        if (after.transcript < lim.floorT - 1e-9) {
                            problems.push(`${c.dock}/${cards} ${border.id}: transcript under its floor`);
                        }
                        layout = next;
                    }
                }
            }
        }
    }
    assert.deepEqual(problems.slice(0, 5), [], `${problems.length} rule violations across the sequence`);
});

test('a region trimmed at a limit does not spring back out later', () => {
    // The stored layout is what a later drag budgets against, so a value that was
    // refused must not still be sitting there waiting to reappear.
    const ctx = ctxBottom;
    let layout = fresh(ctx);
    // Grow the command bar until the transcript is on its floor.
    for (let i = 0; i < 5; i++) {
        const solved = L.solve(layout, ctx);
        layout = L.setRegion(layout, 'command',
            L.valueForDrag('transcriptCommand', solved.transcript - 0.5, solved, ctx), ctx);
    }
    const pinned = L.solve(layout, ctx);
    // Now move a DIFFERENT border, twice, and the command bar must stay put.
    for (const delta of [0.1, -0.1]) {
        const solved = L.solve(layout, ctx);
        const at = solved.transcript + solved.command + solved.response;
        layout = L.setRegion(layout, 'dock',
            L.valueForDrag('responseDock', at + delta, solved, ctx), ctx);
        assert.equal(round(L.solve(layout, ctx).command), round(pinned.command),
            'the command bar sprang back to a size it had been refused');
    }
});

test('normalize only bites when something OTHER than a drag changed the sums', () => {
    const ctx = { ...ctxBottom, cards: 4 };
    const layout = fresh(ctx);
    assert.deepEqual(L.normalize(layout, ctx), { ...layout },
        'a legal layout must pass through untouched - normalize is not a rebalancer');

    // Eight cards raise the response panel's floor. A layout that was legal with four
    // can be illegal with eight, and that is exactly what normalize is for.
    const tight = { command: 0.4, response: 0.05, dock: 0.5 };
    const fixed = L.normalize(tight, { ...ctx, cards: 8 });
    const solved = L.solve(fixed, { ...ctx, cards: 8 });
    assert.ok(solved.transcript >= L.limits({ ...ctx, cards: 8 }).floorT - 1e-9,
        'normalize left the transcript under its floor');
    assert.ok(solved.response >= L.limits({ ...ctx, cards: 8 }).response.lo - 1e-9,
        'normalize left the response panel under the floor eight cards need');
});

test('a side keyboard is measured on its own axis, so widening it moves no heights', () => {
    const before = L.solve(fresh(ctxSide), ctxSide);
    const next = L.setRegion(fresh(ctxSide), 'dock', 0.5, ctxSide);
    const after = L.solve(next, ctxSide);
    assert.ok(after.dock > before.dock, 'the keyboard should have widened');
    for (const k of ['transcript', 'command', 'response']) {
        assert.equal(round(after[k]), round(before[k]),
            `${k} changed height when only the keyboard's WIDTH was dragged`);
    }
});

test('the keyboard can never take so much width that the command bar stops being buttons', () => {
    // Nine buttons, and the budget used to be written for eight - which is why the
    // command bar could be crushed to 22px at the largest button size.
    const lim = L.limits(ctxSide);
    const widest = L.solve(L.setRegion(fresh(ctxSide), 'dock', 1, ctxSide), ctxSide);
    const mainPx = (1 - widest.dock) * ctxSide.width;
    assert.ok(mainPx >= 9 * L.MIN_BTN_REM * ctxSide.rem - 1,
        `the command bar was left ${Math.round(mainPx)}px for nine buttons, which needs `
        + `${9 * L.MIN_BTN_REM * ctxSide.rem}px`);
    assert.ok(widest.dock <= lim.dock.hi + 1e-9);
});
