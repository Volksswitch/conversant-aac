/* THE EXPRESS PANEL AND THE ON-SCREEN KEYBOARD MUST OCCUPY THE SAME CELLS.
 *
 * This is the invariant the whole keyguard story rests on (UI Layout Rule 9): one
 * sheet of plastic has to sit over the phrases at rest AND over the keys during "In
 * my own words", so every hole must line up with a cell on both surfaces. Same
 * rectangle, same rows, same cell edges.
 *
 * ⚠ WHY THIS NEEDS A BROWSER, AND WHY IT IS WORTH THE ONLY BROWSER TEST IN THE
 * SUITE. Congruence is not held anywhere in particular. It is held by FIVE things
 * that must agree, and four of them are written out twice:
 *
 *   1. the rows, cells and spans          - from one shared layout definition (good)
 *   2. the rectangle                      - the panel IS inside the dock; the keyboard
 *                                           fixes itself to the screen edges and
 *                                           re-derives the dock's size. Two mechanisms,
 *                                           one answer, by arithmetic
 *   3. the half-gap surround + safe area  - a rule on each surface
 *   4. the gap between rows, and cells    - two rules on each surface
 *   5. each cell's flex weight from span  - set in ui.js AND in keyboard.js
 *
 * Change one of a pair and miss the other and every hole on that surface moves. On
 * screen BOTH still look perfectly normal, because each surface is internally
 * consistent - you find out when the plastic is on the device, which is after it has
 * been cut. No arrangement of source-reading assertions catches that; only measuring
 * the two surfaces in the same dock does.
 *
 * ⚠ THE MECHANISM BEHIND THE DIVERGENCE THIS FOUND (September 2026), because a
 * failure here is otherwise very hard to read. Both surfaces lay a row out with
 * `flex: <span> 1 0` on every cell, which looks like it must give both the same
 * boxes. It does not. With a flex-basis of zero the free space is shared out across
 * the cells' CONTENT, and each cell's own border and padding are then added on top -
 * and the two surfaces are decorated very differently: an Express Panel button
 * carries a 5px band, a 1px border and ~0.4rem of side padding (about 17.7px in
 * total), a keyboard key carries a 1px border (2px).
 *
 * Where every cell in a row has the SAME span that cancels out exactly, so the rows
 * agree to the pixel. Where a row has cells of MIXED span - which is every row
 * holding the space bar, and therefore the compose key - it does not: the wide cell
 * is decorated once while the narrow ones are decorated several times over, so the
 * same weights produce different boxes on the two surfaces.
 *
 * The fix is to stop the cell's own decoration taking part in the sharing-out - lay
 * the rows out as a grid of equal columns with cells spanning them, or move the
 * border and padding onto an inner element so every flex item is decorated
 * identically. Whichever is chosen, this test is what says it worked.
 *
 * Skips (rather than fails) where a browser cannot be launched, so `npm test` still
 * runs unattended - the same arrangement as the live API tier.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYOUTS } from '../app/js/keyboard-layouts.js';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

// Cells are laid out by the same flex arithmetic on both surfaces, so they should
// agree exactly. Half a pixel of tolerance covers sub-pixel rounding and nothing
// else: a real divergence is a whole gap or a whole padding, which is pixels.
const TOLERANCE = 0.5;

let server, port, browser, page, skip = false;

before(async () => {
    let puppeteer;
    try {
        puppeteer = (await import('puppeteer')).default;
    } catch {
        skip = 'puppeteer is not installed - dock congruence not measured';
        return;
    }

    server = createServer((req, res) => {
        const path = decodeURIComponent(String(req.url).split('?')[0]);
        const file = join(APP, path === '/' ? 'index.html' : path.replace(/^\/+/, ''));
        if (!file.startsWith(APP) || !existsSync(file) || !statSync(file).isFile()) {
            res.writeHead(404); res.end(); return;
        }
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(readFileSync(file));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;

    try {
        browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        page = await browser.newPage();
        // A Surface in landscape - the primary target, and big enough that no layout
        // is up against a floor, which would hide a divergence by clamping both sides.
        await page.setViewport({ width: 1280, height: 800 });
    } catch (e) {
        skip = 'could not launch a browser (' + e.message.split('\n')[0] + ') - dock congruence not measured';
        if (server) server.close();
    }
});

after(async () => {
    if (browser) await browser.close();
    if (server) server.close();
});

/**
 * Load the app with one dock + layout in force and return both surfaces' cell
 * rectangles, measured in the same dock.
 *
 * ⚠ THE PANEL IS MEASURED FIRST AND THE KEYBOARD SECOND, because the keyboard
 * covers the panel when it is up - that is the whole point of them sharing a
 * rectangle, and it means they cannot both be on screen to be compared at once.
 */
async function measure(dockSide, layoutId, sidePosition = 'right') {
    await page.evaluateOnNewDocument((settings) => {
        localStorage.setItem('aac_settings', JSON.stringify(settings));
    }, {
        keyboardMode: 'onscreen',
        keyboardDock: dockSide,
        sideDockPosition: sidePosition,
        [dockSide === 'side' ? 'sideLayout' : 'bottomLayout']: layoutId,
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });
    // The panel is rendered during start-up; give the module graph a beat to settle.
    await new Promise((r) => setTimeout(r, 400));

    const rects = (sel) => page.evaluate((selector) => {
        const rows = [...document.querySelectorAll(selector)];
        return rows.map((row) => [...row.children].map((c) => {
            const r = c.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
        }));
    }, sel);

    const panel = await rects('#epGrid .ep-row');

    // `main.disabled` blocks pointer events until Start completes, and Start needs
    // more of the app than a geometry check should depend on. Lifting the class is
    // the same shortcut scripts/capture-color-schemes.mjs takes, and it changes no
    // geometry - it only re-enables tapping.
    await page.evaluate(() => document.querySelector('main')?.classList.remove('disabled'));
    // Open the keyboard the way a user does: "In my own words" on the panel focuses
    // the composer, and the composer is what summons it.
    await page.click('#epGrid .ep-imow');
    await new Promise((r) => setTimeout(r, 400));

    const shown = await page.evaluate(() =>
        !document.getElementById('appKeyboard')?.classList.contains('hidden'));
    const keyboard = await rects('#appKeyboard .kbd-row');
    return { panel, keyboard, shown };
}

function compare(t, label, panel, keyboard) {
    // A vacuous pass is the failure this guard exists for: two empty surfaces agree
    // perfectly, and would report congruence for a panel that never rendered.
    assert.ok(panel.length > 0, `${label}: the Express Panel rendered no rows`);
    assert.ok(keyboard.length > 0, `${label}: the keyboard rendered no rows`);
    assert.equal(keyboard.length, panel.length,
        `${label}: ${panel.length} panel rows vs ${keyboard.length} keyboard rows`);

    let cells = 0;
    let worst = null;
    for (let r = 0; r < panel.length; r++) {
        assert.equal(keyboard[r].length, panel[r].length,
            `${label}: row ${r + 1} has ${panel[r].length} panel cells vs ${keyboard[r].length} keys`);
        for (let c = 0; c < panel[r].length; c++) {
            const p = panel[r][c];
            const k = keyboard[r][c];
            for (const side of ['x', 'y', 'w', 'h']) {
                const off = Math.abs(p[side] - k[side]);
                if (!worst || off > worst.off) worst = { off, side, r, c, p: p[side], k: k[side] };
            }
            cells++;
        }
    }
    // Report the WORST divergence rather than the first one found: the first is
    // wherever the loop happens to reach, and what a keyguard actually cares about
    // is the largest miss anywhere on the sheet.
    assert.ok(worst.off <= TOLERANCE,
        `${label}: worst divergence is ${worst.off.toFixed(2)}px in ${worst.side}, at row ${worst.r + 1} `
        + `cell ${worst.c + 1} (panel ${worst.p.toFixed(2)}, keyboard ${worst.k.toFixed(2)}). `
        + 'A keyguard hole cut for one surface would miss the other. '
        + 'If this row has cells of MIXED span, see the note at the head of this file.');
    t.diagnostic(`${label}: ${cells} cells in ${panel.length} rows agree `
        + `(worst ${worst.off.toFixed(3)}px, tolerance ${TOLERANCE}px)`);
}

for (const [id, def] of Object.entries(LAYOUTS)) {
    test(`${def.dock} dock, ${id}: the Express Panel and the keyboard occupy the same cells`,
        { timeout: 30000 }, async (t) => {
            if (skip) { t.skip(skip); return; }
            const { panel, keyboard, shown } = await measure(def.dock, id);
            assert.ok(shown, `${id}: the keyboard never appeared, so nothing was compared`);
            compare(t, id, panel, keyboard);
        });
}

// The side dock can sit on either hand, and the two are positioned by different CSS
// rules (`left:` vs `right:`), so a fault could live in one and not the other.
test('side dock on the LEFT: the Express Panel and the keyboard occupy the same cells',
    { timeout: 30000 }, async (t) => {
        if (skip) { t.skip(skip); return; }
        const { panel, keyboard, shown } = await measure('side', 'S2', 'left');
        assert.ok(shown, 'the keyboard never appeared, so nothing was compared');
        compare(t, 'S2 (left)', panel, keyboard);
    });

// The gap and the screen edge margin feed BOTH surfaces, through rules written out
// once per surface - so a non-default value is where a divergence would show first.
// The defaults are zero-ish, which is exactly the value at which a missing gap and a
// present one look identical.
test('with a wide gap and a screen edge margin, the two surfaces still agree',
    { timeout: 30000 }, async (t) => {
        if (skip) { t.skip(skip); return; }
        await page.evaluateOnNewDocument(() => {
            localStorage.setItem('aac_settings', JSON.stringify({
                keyboardMode: 'onscreen', keyboardDock: 'bottom', bottomLayout: 'B10',
                buttonGapPos: 80, minGapPos: 60, appMarginPos: 55, dockSepPos: 40,
            }));
        });
        await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 400));
        const rects = (sel) => page.evaluate((selector) => [...document.querySelectorAll(selector)]
            .map((row) => [...row.children].map((c) => {
                const r = c.getBoundingClientRect();
                return { x: r.x, y: r.y, w: r.width, h: r.height };
            })), sel);
        const panel = await rects('#epGrid .ep-row');
        await page.evaluate(() => document.querySelector('main')?.classList.remove('disabled'));
        await page.click('#epGrid .ep-imow');
        await new Promise((r) => setTimeout(r, 400));
        const keyboard = await rects('#appKeyboard .kbd-row');
        // The settings must actually have taken effect, or this is the default case
        // wearing a different name.
        const gap = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--grid-gap'));
        assert.ok(parseFloat(gap) > 1, `expected a wide gap to be in force, got "${gap}"`);
        compare(t, 'B10 with wide gap + margin', panel, keyboard);
    });

// A label too long for its button must be TRIMMED far enough to leave room for a
// terminating ellipsis - it must never be cut off, and it must never change the size
// of the button (Ken, September 2026). The button half is the grid above; this is
// the label half.
//
// ⚠ WHAT GOES WRONG IS SILENT AND LOOKS DELIBERATE. A line clamp puts its ellipsis
// at the end of the last line it ALLOWS, so a clamp of three in a box two lines tall
// puts the ellipsis on a line nobody can see: the phrase simply stops mid-word, and
// on screen that reads as a short phrase rather than as a truncated one. The clamp
// therefore has to match the box, and this is what says it does.
const LABEL_CASES = [
    ['bottom dock, default', { keyboardMode: 'onscreen', keyboardDock: 'bottom', bottomLayout: 'B10' }],
    ['side dock, default', { keyboardMode: 'onscreen', keyboardDock: 'side', sideLayout: 'S2' }],
    ['side dock, narrow cells', { keyboardMode: 'onscreen', keyboardDock: 'side', sideLayout: 'S6' }],
    ['big text in a tight dock', { keyboardMode: 'onscreen', keyboardDock: 'side', sideLayout: 'S2',
        buttonGapPos: 80, minGapPos: 60, appMarginPos: 55, expressFontScale: 1.6 }],
];

for (const [label, settings] of LABEL_CASES) {
    test(`${label}: every phrase is trimmed to the lines that fit, never cut off`,
        { timeout: 30000 }, async (t) => {
            if (skip) { t.skip(skip); return; }
            await page.evaluateOnNewDocument((s) => {
                localStorage.setItem('aac_settings', JSON.stringify(s));
            }, settings);
            await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });
            await new Promise((r) => setTimeout(r, 400));

            const bad = await page.evaluate(() => {
                const out = [];
                document.querySelectorAll('#epGrid .ep-btn').forEach((btn) => {
                    const t2 = btn.querySelector('.ep-text');
                    if (!t2) return;
                    const ts = getComputedStyle(t2);
                    const bs = getComputedStyle(btn);
                    const line = parseFloat(ts.lineHeight) || parseFloat(ts.fontSize) * 1.12;
                    // The room the BUTTON has, not the height the clamped text has
                    // taken - asking the text is circular (see ui.fitPanelText).
                    const room = btn.clientHeight
                        - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom);
                    const fits = Math.max(1, Math.floor(room / line + 0.01));
                    const clamp = parseInt(ts.webkitLineClamp, 10);
                    if (clamp !== fits) {
                        out.push({ text: t2.textContent.trim().slice(0, 30), clamp, fits });
                    }
                });
                return out;
            });
            const n = await page.evaluate(() => document.querySelectorAll('#epGrid .ep-btn').length);
            assert.ok(n > 0, `${label}: no panel buttons rendered, so nothing was checked`);
            assert.equal(bad.length, 0,
                `${label}: ${bad.length} label(s) drawn on a different number of lines than fit `
                + `- these are cut off with no ellipsis: ${JSON.stringify(bad.slice(0, 4))}`);
            t.diagnostic(`${label}: all ${n} labels fit their button`);
        });
}

// The same rule on the other two surfaces that are handed text they may not have
// room for: a response card and a worded Command Bar face.
//
// ⚠ THE OPENERS ARE THE WAY IN, and it matters that they are a REAL path rather than
// cards poked into the page: "Start conversation" draws the user's own opening
// phrases onto the actual response cards with no AI involved, so the whole chain
// runs - the phrases the user wrote, the card builder, the layout, the fitting.
// Long openers because a user may well write one, and a short one proves nothing.
//
// ⚠ WHAT IS NOT COVERED, AND IT IS THE HALF NEEDING THE AI: the model's short label
// under a response. No static palette carries one - an opener, a wind-down and a
// goodbye are all their own label - so it cannot be driven from here. It is handled
// by the same code, and that is an argument, not a measurement.
const LONG_OPENERS = [
    'I was wondering whether you might have a few minutes to talk about the thing we discussed last week',
    'Hi {name}, could I ask you something?',
    'There is something I have been meaning to bring up with you when we next had a quiet moment',
    'Can we talk?',
];

// Each case carries its own screen, because how narrow a Command Bar button gets
// depends on the screen as much as on the settings - and the case that squeezes a
// face until a single word will not fit is a different one from the case that
// squeezes a response card until its wording will not.
const IPAD_MINI = { width: 1133, height: 744 };   // the smallest screen supported
const IPAD = { width: 1180, height: 763 };
const TEXT_CASES = [
    ['default', {}, IPAD_MINI],
    ['eight cards, large response text',
        { responseFontScale: 2, responsesPerCategory: 2 }, IPAD_MINI],
    ['the tightest configuration there is',
        { keyboardDock: 'side', sideLayout: 'S6', responseFontScale: 2,
          responsesPerCategory: 2, buttonSizePos: 95 }, IPAD_MINI],
    // ⚠ THE CASE THAT SQUEEZES A COMMAND FACE SIDEWAYS. A wide side dock leaves the
    // Command Bar about 35px per button, which is narrower than the word "Listen" -
    // the one failure a downward clamp cannot reach. Keep this case: without it the
    // sideways half of the rule is unguarded, which was true when it was first
    // written.
    ['side dock, large text, big buttons',
        { keyboardDock: 'side', sideLayout: 'S2', responseFontScale: 1.8,
          buttonSizePos: 90 }, IPAD],
];

for (const [label, extra, viewport] of TEXT_CASES) {
    test(`${label}: response cards and command faces are trimmed, never cut off`,
        { timeout: 30000 }, async (t) => {
            if (skip) { t.skip(skip); return; }
            await page.evaluateOnNewDocument(({ openers, settings }) => {
                localStorage.setItem('aac_settings', JSON.stringify(settings));
                localStorage.setItem('aac_control_phrases', JSON.stringify({ openers }));
            }, {
                openers: LONG_OPENERS,
                settings: Object.assign({
                    keyboardMode: 'onscreen', keyboardDock: 'bottom', bottomLayout: 'B10',
                    commandLabels: 'words',
                }, extra),
            });
            await page.setViewport(viewport);
            await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });
            await new Promise((r) => setTimeout(r, 500));
            await page.evaluate(() => document.querySelector('main')?.classList.remove('disabled'));
            await page.click('#initiateBtn');
            await new Promise((r) => setTimeout(r, 500));

            const found = await page.evaluate(() => {
                // ⚠ "scrollHeight > clientHeight" is TRUE of every correctly trimmed
                // box - a clamp is visual, the words are still there underneath. The
                // question is whether the clamp matches the lines that fit: if it does
                // not, the ellipsis is drawn on a line nobody can see and the text just
                // stops.
                const bad = [];
                const check = (el, what) => {
                    const cs = getComputedStyle(el);
                    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.15;
                    const room = el.clientHeight;
                    if (!(room > 0) || !(line > 0)) return;
                    const fits = Math.max(1, Math.floor(room / line + 0.01));
                    const clamp = parseInt(cs.webkitLineClamp, 10);
                    if (el.scrollHeight > room + 0.5 && clamp !== fits) {
                        bad.push({ what, text: el.textContent.trim().slice(0, 30), clamp, fits });
                    }
                    // Sideways is the other way to lose words, and no downward clamp
                    // reaches it - a single word too wide for its button.
                    if (el.scrollWidth > el.clientWidth + 0.5) {
                        bad.push({ what, text: el.textContent.trim().slice(0, 30),
                                   wide: el.scrollWidth, room: el.clientWidth });
                    }
                };
                document.querySelectorAll('#responseOptions .response-text')
                    .forEach((el) => check(el, 'response'));
                document.querySelectorAll('#listenControls > button.cmd-worded')
                    .forEach((el) => check(el, 'command face'));
                return {
                    bad,
                    cards: document.querySelectorAll('#responseOptions .response-text').length,
                    faces: document.querySelectorAll('#listenControls > button.cmd-worded').length,
                };
            });
            assert.ok(found.cards > 0, `${label}: no response cards drawn, so nothing was checked`);
            assert.ok(found.faces > 0, `${label}: no worded faces drawn, so nothing was checked`);
            assert.equal(found.bad.length, 0,
                `${label}: ${found.bad.length} piece(s) of text lose words with no ellipsis: `
                + JSON.stringify(found.bad.slice(0, 4)));
            t.diagnostic(`${label}: ${found.cards} cards and ${found.faces} faces all fit`);
        });
}

// --- Dragging the borders ----------------------------------------------------
// The arithmetic is covered by tests/conv-layout.test.mjs, which needs no browser.
// What only a browser can answer is whether the app WIRES it correctly: whether a
// pointer landing on a border is claimed, whether the region below it actually
// moves, and - the two that matter most - whether an unlocked screen is laid out
// identically to a locked one, and whether a locked border lets a tap through.

async function conv(settings) {
    await page.evaluateOnNewDocument((s) => {
        localStorage.setItem('aac_settings', JSON.stringify(s));
    }, Object.assign({ keyboardMode: 'onscreen', keyboardDock: 'bottom', bottomLayout: 'B10',
                       sideLayout: 'S2' }, settings));
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => document.querySelector('main')?.classList.remove('disabled'));
}

const regionRects = () => page.evaluate(() => {
    const R = (s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { t: Math.round(b.top), h: Math.round(b.height),
                 l: Math.round(b.left), w: Math.round(b.width) };
    };
    return { transcript: R('#transcriptSection'), command: R('#listenControls'),
             response: R('#responsesSection'), dock: R('#dockArea') };
});

// A border sits at the TOP of the region it resizes; the side keyboard's own border
// is its inner edge.
async function borderPoint(resizes) {
    return page.evaluate((sel) => {
        const b = document.querySelector(sel).getBoundingClientRect();
        return document.body.classList.contains('conv-side') && sel === '#dockArea'
            ? { x: b.left, y: b.top + b.height / 2 }
            : { x: b.left + b.width / 2, y: b.top };
    }, resizes === 'command' ? '#listenControls'
        : resizes === 'response' ? '#responsesSection' : '#dockArea');
}

async function dragBorder(resizes, dx, dy) {
    const at = await borderPoint(resizes);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(at.x + dx * i / 8, at.y + dy * i / 8);
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 120));
}

test('unlocking the layout changes NOTHING about it', { timeout: 30000 }, async (t) => {
    if (skip) { t.skip(skip); return; }
    // ⚠ THE POINT OF THIS ONE: whatever says "you may drag here" must take no space.
    // Anything that did would change the layout the moment the mode was entered -
    // absurd for a mode whose whole job is judging that layout - and would move every
    // keyguard opening with it.
    await conv({});
    const locked = await regionRects();
    await conv({ layoutUnlocked: true });
    const unlocked = await regionRects();
    assert.deepEqual(unlocked, locked,
        'the regions moved when the layout was unlocked - the unlocked cue must be paint only');
    t.diagnostic('every region identical locked and unlocked');
});

test('a locked border lets a tap through to what is underneath', { timeout: 30000 }, async (t) => {
    if (skip) { t.skip(skip); return; }
    // A first version laid invisible strips over the borders. They sit above
    // everything, so they swallowed taps - and a strip over the keyboard's top edge
    // eats taps meant for the phrases along its first row.
    await conv({});
    const hit = await page.evaluate(() => {
        const b = document.querySelector('#dockArea').getBoundingClientRect();
        const el = document.elementFromPoint(b.left + b.width / 2, b.top + 1);
        return el ? String(el.className || el.tagName) : '(nothing)';
    });
    assert.ok(/ep-btn|kbd-key/.test(hit),
        `a tap on the keyboard's top edge hit "${hit}" instead of a button - something is covering the border`);
});

for (const dock of ['bottom', 'side']) {
    test(`${dock} keyboard: a border moves the region below it and nothing else`,
        { timeout: 40000 }, async (t) => {
            if (skip) { t.skip(skip); return; }
            const order = ['command', 'response', 'dock'];
            for (const resizes of order) {
                await conv({ keyboardDock: dock, layoutUnlocked: true });
                const before = await regionRects();
                // Towards the top / the near edge, which grows the region below.
                const sideways = dock === 'side' && resizes === 'dock';
                await dragBorder(resizes, sideways ? -70 : 0, sideways ? 0 : -70);
                const after = await regionRects();

                const axis = sideways ? 'w' : 'h';
                assert.equal(after[resizes][axis] - before[resizes][axis], 70,
                    `${dock}/${resizes}: dragging 70px should move it by exactly 70px`);
                if (sideways) {
                    // ⚠ THE SIDE KEYBOARD'S OWN BORDER IS A DIFFERENT RULE, and asserting
                    // the vertical one here was my mistake rather than the app's: it
                    // trades the keyboard against the column beside it, so all three
                    // regions in that column necessarily change WIDTH. What must hold is
                    // that it is a trade - the column gives up exactly what the keyboard
                    // gains - and that no HEIGHT moves at all.
                    assert.equal(before.command.w - after.command.w, 70,
                        'the column should have given up exactly what the keyboard gained');
                    for (const k of Object.keys(before)) {
                        assert.equal(after[k].h, before[k].h,
                            `${k} changed height when only the keyboard's WIDTH was dragged`);
                    }
                } else {
                    // Only the region below the border, and the transcript, may move.
                    for (const other of order) {
                        if (other === resizes) continue;
                        assert.equal(after[other][axis], before[other][axis],
                            `${dock}/${resizes}: ${other} moved as well - a border must only resize the region below it`);
                    }
                }
            }
            t.diagnostic(`${dock}: all three borders move only the region below them`);
        });
}

test('a border cannot be dragged while a conversation is under way', { timeout: 30000 }, async (t) => {
    if (skip) { t.skip(skip); return; }
    // The predicate is the CONVERSATION, not the moment - a control that works at some
    // points within one and not others is less predictable than one simply unavailable
    // for the duration.
    await conv({ layoutUnlocked: true });
    const before = await regionRects();
    await page.click('#initiateBtn');          // "Start conversation" - no AI needed
    await new Promise((r) => setTimeout(r, 400));
    await dragBorder('dock', 0, -70);
    const during = await regionRects();
    assert.deepEqual(during, before, 'a border moved during a conversation');

    // ⚠ PRESSING "Start conversation" IS NOT YET A CONVERSATION - it shows the openers
    // and is a toggle you can cancel, so re-locking there would punish a mis-tap. The
    // conversation begins when something is actually SAID, so speak an opener.
    await page.evaluate(() => {
        const card = document.querySelector('#responseOptions .response-card');
        if (card) card.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // ⚠ AND IT STAYS LOCKED AFTERWARDS. Talking to somebody re-locks the layout:
    // unlocking is something you do to adjust the screen, not a state to leave the app
    // in, or the switch is still on tomorrow when nobody is thinking about it. So
    // ending the conversation does NOT hand the borders back - you unlock again.
    await page.click('#endConversationBtn');
    await new Promise((r) => setTimeout(r, 400));
    await dragBorder('dock', 0, -70);
    assert.deepEqual(await regionRects(), before,
        'the layout should still be locked after a conversation - starting one re-locks it');
    assert.equal(await page.evaluate(() =>
        JSON.parse(localStorage.getItem('aac_settings')).layoutUnlocked), false,
    'the switch should have turned itself off when the conversation started');

    // Unlocking again brings them back.
    await page.evaluate(async () => {
        const storage = await import('./js/storage.js');
        storage.saveLayoutUnlocked(true);
    });
});

// ⚠ WHY THIS TEST DOES NOT GO ON TO CHECK THAT UNLOCKING AGAIN WORKS. It cannot, in a
// headless browser, and the reason is a real latent bug rather than a quirk of the
// harness: speaking an opener sets a "the user is talking" flag that is cleared when
// the browser reports the utterance finished, and with no speech engine present that
// report never arrives - so the app believes it is still speaking forever, and every
// gate keyed on a conversation being in progress stays shut. On a real device the
// utterance ends and it clears. That every other test here drags successfully after
// unlocking is what covers the case.


test('Practice does NOT re-lock the layout - that is where the adjusting is done',
    { timeout: 40000 }, async (t) => {
        if (skip) { t.skip(skip); return; }
        await conv({ layoutUnlocked: true });
        await page.click('#settingsBtn');
        await new Promise((r) => setTimeout(r, 350));
        await page.evaluate(() => [...document.querySelectorAll('.settings-tab')]
            .find((x) => x.dataset.tab === 'practice').click());
        await new Promise((r) => setTimeout(r, 450));
        await page.evaluate(() => [...document.querySelectorAll('#practicePanel button')]
            .find((b) => /tour|buttons/i.test(b.textContent)).click());
        await new Promise((r) => setTimeout(r, 700));

        assert.ok(/^Practice:/.test(await page.evaluate(() =>
            document.getElementById('statusBar').textContent.trim())), 'not in Practice Mode');
        assert.equal(await page.evaluate(() =>
            JSON.parse(localStorage.getItem('aac_settings')).layoutUnlocked), true,
        'Practice re-locked the layout - re-locking after every rehearsal would make the '
        + 'one useful place to judge a layout cost a trip to Settings each time');
    });

test('PRACTICE MODE is not a conversation - the borders stay draggable there',
    { timeout: 40000 }, async (t) => {
        if (skip) { t.skip(skip); return; }
        // ⚠ THIS WAS WRONG THE FIRST TIME, and backwards rather than merely strict:
        // Practice Mode is the BEST place to judge a layout, not a place to be
        // protected from doing so. Realistic text in the transcript and on the cards,
        // nobody waiting, nothing at stake, no keyguard fitted - and a layout that
        // looks fine on an empty screen is the one that turns out wrong once three
        // turns of real speech are in it.
        await conv({ layoutUnlocked: true });
        const before = await regionRects();

        // In through the real door: Settings -> Practice, then the controls tour, which
        // is the one "scenario" that needs no API key.
        await page.click('#settingsBtn');
        await new Promise((r) => setTimeout(r, 350));
        await page.evaluate(() => [...document.querySelectorAll('.settings-tab')]
            .find((t) => t.dataset.tab === 'practice').click());
        await new Promise((r) => setTimeout(r, 450));
        const started = await page.evaluate(() => {
            const card = [...document.querySelectorAll('#practicePanel button')]
                .find((b) => /tour|buttons/i.test(b.textContent));
            if (!card) return [...document.querySelectorAll('#practicePanel button')]
                .map((b) => b.textContent.trim().slice(0, 30));
            card.click();
            return 'started';
        });
        assert.equal(started, 'started', `could not start the tour; offered: ${JSON.stringify(started)}`);
        await new Promise((r) => setTimeout(r, 700));

        // ⚠ PROVE WE ARE ACTUALLY IN PRACTICE MODE, or this test passes for the wrong
        // reason: outside a conversation the borders drag anyway, so a tour that failed
        // to start would look exactly like a pass. The status line is written by
        // startPractice and by nothing else, which makes it the reliable marker.
        const status = await page.evaluate(() => {
            const n = document.getElementById('statusBar');
            return n ? n.textContent.trim() : '(no status region)';
        });
        assert.ok(/^Practice:/.test(status),
            `not actually in Practice Mode - the status line reads "${status}"`);
        t.diagnostic('in practice: ' + status.slice(0, 60));

        // The whole point: a border still moves.
        await dragBorder('dock', 0, -70);
        const after = await regionRects();
        assert.equal(after.dock.h - before.dock.h, 70,
            'a border would not move in Practice Mode - it is a rehearsal, not a conversation');
    });

test('a dragged layout is remembered, and is stored as a share of the screen', { timeout: 30000 }, async (t) => {
    if (skip) { t.skip(skip); return; }
    await conv({ layoutUnlocked: true });
    await dragBorder('dock', 0, -70);
    const moved = await regionRects();
    const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('aac_settings')).convLayout);
    assert.ok(saved && saved.bottom && typeof saved.bottom.dock === 'number',
        'nothing was saved for the bottom keyboard');
    assert.ok(saved.bottom.dock > 0 && saved.bottom.dock < 1,
        `stored as ${saved.bottom.dock} - it must be a FRACTION of the screen, so it `
        + 'survives a different screen and travels with a settings profile');

    // Come back to it the way a returning user does.
    await conv({ layoutUnlocked: true, convLayout: saved });
    const again = await regionRects();
    assert.equal(again.dock.h, moved.dock.h, 'the layout was not the same on the next launch');
});
