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
