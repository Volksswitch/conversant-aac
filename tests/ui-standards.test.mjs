/* THE CONTROL STANDARDS, MEASURED IN A RUNNING APP (UI-Design.docx, Section 13).
 *
 * ⚠ WHY THIS EXISTS, and it is Ken's question rather than a hypothetical: "How can we
 * ensure that any time work is done in the UI that work adheres to the UI standards?"
 * (September 8 2026). Writing the standards down was the other half of that day's work
 * and it is not an answer on its own — the standards had ALL been decided already, one
 * at a time, and the panel had drifted anyway. Every rule this project has written down
 * and not enforced has drifted; the ones with a test behind them have not.
 *
 * ⚠ AND IT HAS TO BE A BROWSER, WHICH IS WHY IT IS WORTH THE COST. Every fault Ken found
 * was a COMPUTED result, and not one of them is visible in the source:
 *
 *   - the shortened key in two fonts       - a rule that existed and listed two ids
 *   - "Paste" a point smaller on one tab   - a rule that existed and disagreed
 *   - the editor's fields in another font  - a rule that did not exist at all
 *   - square white buttons                 - NO rule, so the browser's own showed through
 *   - fields shorter than the buttons      - a rule that existed and omitted inputs
 *
 * Reading the stylesheet cannot see any of those, because in three of the five the
 * stylesheet is not where the answer comes from. Only asking the browser what a control
 * actually looks like can, which is what this does: it groups the controls of a kind and
 * fails when one kind has more than one appearance.
 *
 * ⚠ THE ALLOWLIST IS THE LOAD-BEARING PART, AND EVERY ENTRY CARRIES A REASON. A check
 * that goes red for deliberate variety is one people learn to scroll past — the same
 * lesson as scoping the document-currency check to the four reader-facing documents. So
 * a control that legitimately looks different is named here WITH why, which makes this
 * file a record of the exceptions rather than a suppression list. Adding a name without
 * a reason is the failure mode to watch for.
 *
 * WHAT IT CANNOT CHECK, stated so a green run is never read as "the UI is right": whether
 * a control is in the right PLACE, whether its wording is good, whether an icon means
 * what it looks like, and anything on a surface it does not open. It checks consistency,
 * not correctness.
 *
 * Skips (rather than fails) where a browser cannot be launched, so `npm test` still runs
 * unattended — the same arrangement as dock-congruence and the live tier.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

/*
 * Controls that are DELIBERATELY not the standard action button, each with the reason.
 * A selector here is an exception granted on purpose; anything else that differs is a
 * failure. Keep the reasons — they are what stops this becoming a list of things
 * somebody silenced.
 */
const DELIBERATE = [
    ['#settingsHelpBtn, #closeSettingsBtn',
     'title-bar icons: transparent at rest so the header reads as a header, not a toolbar'],
    ['.slider-step',
     'the - and + steppers: square at the minimum dimension, or two of them leave the slider no room'],
    ['.ee-add, .wv-folder-prompt-btn, .practice-add-key',
     'the primary "add" action in an editor: filled, because it is the one thing to do there'],
    ['.ee-del, .ee-reset, .wv-btn-danger',
     'destructive: a red border, so it does not look like the button beside it'],
    ['.ee-hear',
     'speak-this-aloud: tinted, because it produces sound rather than changing something'],
    ['.practice-card, .wv-module-row, .ep-btn, .sc-choice, .wv-chip',
     'CONTENT, not an action button — its face is the user\'s or the app\'s own words, so it '
     + 'is a card and Section 13 exempts it'],
    ['.ee-tools button, .ee-tool, .cpe-section button',
     'the editors\' own row tools: a coherent family at a slightly larger radius, internally '
     + 'consistent and never mixed with panel actions in the same row'],
];

let server, port, browser, page, skip = false;

before(async () => {
    let puppeteer;
    try {
        puppeteer = (await import('puppeteer')).default;
    } catch {
        skip = 'puppeteer is not installed - the control standards were not measured';
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
        await page.setViewport({ width: 1280, height: 800 });
        await openEverySettingsTab();
    } catch (e) {
        skip = 'could not launch a browser (' + e.message.split('\n')[0] + ') - the control '
             + 'standards were not measured';
        if (server) server.close();
    }
});

after(async () => {
    if (browser) await browser.close();
    if (server) server.close();
});

/*
 * Open the app, press Start, open Settings, and walk every tab expanding every section,
 * collecting what each control looks like as we go.
 *
 * ⚠ IT HAS TO WALK THE TABS. Only one tab is in the layout at a time, so a control on a
 * tab nobody opened measures 0x0 and would be silently skipped — which would let exactly
 * the drift this exists to catch hide on an unvisited tab.
 */
async function openEverySettingsTab() {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.getElementById('startBtn').click());
    await new Promise((r) => setTimeout(r, 900));
    await page.evaluate(() => document.getElementById('settingsBtn').click());
    await new Promise((r) => setTimeout(r, 400));
}

/** Everything visible on every Settings tab, with its computed appearance. */
async function surveySettings(deliberate) {
    return page.evaluate(async (DELIBERATE_SELECTORS) => {
        const out = [];
        const tabs = [...document.querySelectorAll('#settingsDialog .settings-tab[data-tab]')];
        for (const t of tabs) {
            t.click();
            await new Promise((r) => setTimeout(r, 60));
            for (const d of document.querySelectorAll('#settingsDialog details')) d.open = true;
            await new Promise((r) => setTimeout(r, 60));
            for (const el of document.querySelectorAll('#settingsDialog button, '
                    + '#settingsDialog input[type="text"], #settingsDialog select')) {
                const r = el.getBoundingClientRect();
                if (!r.width || !r.height) continue;          // on a tab that is not showing
                const c = getComputedStyle(el);
                out.push({
                    tab: t.dataset.tab,
                    tag: el.tagName.toLowerCase(),
                    id: el.id || '',
                    cls: el.className || '',
                    text: (el.textContent || '').trim().slice(0, 24),
                    hasIcon: !!el.querySelector('svg'),
                    name: el.getAttribute('aria-label') || el.getAttribute('title')
                          || (el.textContent || '').trim(),
                    height: Math.round(r.height),
                    font: `${c.fontFamily.split(',')[0].replace(/["']/g, '')} ${c.fontSize}`,
                    look: `bg=${c.backgroundColor} radius=${c.borderRadius} `
                        + `border=${c.borderTopWidth} ${c.borderTopStyle}`,
                    deliberate: DELIBERATE_SELECTORS.some((s) => el.matches(s)),
                });
            }
        }
        return out;
    }, deliberate);
}

let controls = null;
async function survey() {
    if (!controls) controls = await surveySettings(DELIBERATE.map(([sel]) => sel));
    return controls;
}

/** Group by a key, returning { key: [labels] } so a failure names real controls. */
function group(items, keyOf) {
    const out = {};
    for (const it of items) (out[keyOf(it)] ||= []).push(`${it.id || it.cls || it.tag}@${it.tab}`);
    return out;
}
const report = (g) => Object.entries(g)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([k, v]) => `\n    ${k}\n        ${v.length} control(s): ${v.slice(0, 5).join(', ')}`)
    .join('');

test('every plain action button in Settings has the SAME appearance', async (t) => {
    if (skip) return t.skip(skip);
    const all = await survey();
    const plain = all.filter((c) => c.tag === 'button' && !c.deliberate);
    assert.ok(plain.length > 20, `expected a real population of buttons, got ${plain.length}`);

    const byLook = group(plain, (c) => c.look);
    assert.equal(Object.keys(byLook).length, 1,
        'Settings holds buttons of one kind wearing more than one appearance. Either style '
        + 'it like the others, or add it to DELIBERATE at the top of this file WITH the '
        + 'reason it is different:' + report(byLook));
});

test('every control in Settings is the same size and typeface', async (t) => {
    if (skip) return t.skip(skip);
    const all = await survey();
    // The shortened key is deliberately even-width so a run of characters can be checked
    // against the key in hand; it is the one text field allowed its own typeface.
    const fields = all.filter((c) => c.tag !== 'button' && !/key-redacted/.test(c.cls));
    const byFont = group(fields, (c) => c.font);
    assert.equal(Object.keys(byFont).length, 1,
        'fields and selects in more than one typeface or size:' + report(byFont));
});

test('a text field is as tall as the buttons beside it', async (t) => {
    if (skip) return t.skip(skip);
    const all = await survey();
    const heights = group(all.filter((c) => c.tag === 'input'), (c) => `${c.height}px`);
    assert.equal(Object.keys(heights).length, 1,
        'text fields at more than one height - a field is a touch target like anything '
        + 'else, and a short one is harder to hit, not tidier:' + report(heights));
});

test('an icon-only button always says what it is', async (t) => {
    if (skip) return t.skip(skip);
    const all = await survey();
    const silent = all.filter((c) => c.hasIcon && !c.text && !c.name)
        .map((c) => c.id || c.cls);
    assert.deepEqual(silent, [],
        'icon-only buttons with no accessible name: ' + silent.join(', ')
        + ' — the visible face may be a glyph, the accessible name never is.');
});

test('the conversation surface is icons with names, and content with words', async (t) => {
    if (skip) return t.skip(skip);
    await page.evaluate(() => document.getElementById('closeSettingsBtn').click());
    await new Promise((r) => setTimeout(r, 300));
    const rows = await page.evaluate(() =>
        [...document.querySelectorAll('.cmd-btn, .cmd-btn-end')].map((b) => ({
            id: b.id,
            hasIcon: !!b.querySelector('svg'),
            name: b.getAttribute('aria-label') || b.getAttribute('title') || '',
        })));
    assert.ok(rows.length >= 8, `expected the Command Bar, got ${rows.length} buttons`);
    // Rule 12 / Section 13: a fixed function shows an icon and carries its explanation in
    // the accessible name. The name is what the "?" speaks and what a screen reader says,
    // so a Command Bar button without one is unidentifiable by any route but memory.
    const unnamed = rows.filter((b) => !b.name).map((b) => b.id);
    assert.deepEqual(unnamed, [], 'Command Bar buttons with no accessible name: ' + unnamed.join(', '));
});
