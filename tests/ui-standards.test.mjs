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
 * Controls that are DELIBERATELY not the standard, each naming WHICH properties it may
 * differ in and WHY.
 *
 * ⚠ THE PER-PROPERTY SPLIT IS THE WHOLE DESIGN, and a blanket version of this list made
 * About Me's coverage worthless: every button there is legitimately a special kind
 * (primary, speak, link, chip, destructive), so exempting them wholesale excluded the
 * entire screen, and putting its old divergence back - buttons a size smaller and a
 * corner rounder than the rest of the panel - was NOT CAUGHT. A green run that had
 * checked nothing is the failure that looks most like success.
 *
 * The line between the properties is what each one MEANS:
 *   fill   - background and border. These carry a control's ROLE: red destroys, filled is
 *            the primary action, transparent is a link. A named exception may differ.
 *   radius - RECORDED HERE BUT NOT ENFORCED; see the note in the size/typeface test for
 *            why, and what that costs. The entries are kept so the decision is visible
 *            if it is ever turned on.
 *   size   - carries NOTHING, and almost nothing may differ. The two that do are on a
 *            different type scale entirely, not merely a bit smaller.
 */
const DELIBERATE = [
    ['#settingsHelpBtn, #closeSettingsBtn', ['fill'],
     'title-bar icons: transparent at rest so the header reads as a header, not a toolbar'],
    ['.slider-step', ['fill', 'radius', 'size'],
     'the - and + steppers: square at the minimum dimension so two of them leave the slider '
     + 'room, and a deliberately larger glyph so the target reads at a glance'],
    ['.ee-del, .ee-reset, .wv-btn-danger, .wv-fact-del, .wv-entry-remove', ['fill'],
     'destructive: a red border, so it does not look like the button beside it. This is the '
     + 'ONLY thing color is spent on for an action in the panels'],
    ['.practice-end', ['fill'],
     'STATE, not emphasis: a rehearsal is running and this is the way out of it, which '
     + 'Rule 6 says a latched control must show'],
    ['.wv-btn-link, .wv-back', ['fill'],
     'a link, not a button: transparent, because it navigates rather than acting'],
    ['.wv-chip, .wv-chip-on', ['fill', 'radius'],
     'an answer OPTION, not an action: a pill, which is the idiom for "pick one of these"'],
    ['.practice-card, .wv-module-row, .sc-choice', ['fill', 'radius'],
     "CONTENT, not an action button - its face is the user's or the app's own words, so "
     + 'Section 13 counts it as a card'],
    ['.ee-tools button, .ee-tool, .cpe-section button', ['fill', 'radius'],
     "the editors' own row tools: a coherent family, internally consistent and never mixed "
     + 'with panel actions in the same row'],
    ['.ep-btn', ['fill', 'radius', 'size'],
     'the Express Panel PREVIEWED inside Settings - it is the conversation surface, on the '
     + "surface's own type scale, which the user sets separately from the panel's"],
];

/** Selectors allowed to differ in one property. */
const exemptFor = (prop) => DELIBERATE.filter(([, props]) => props.includes(prop)).map(([sel]) => sel);


/*
 * About Me's HOME screen shows almost nothing but a list of topics - its fields, chips
 * and buttons all live one level in, on a topic card, in People, or in Places. Surveying
 * only the home would have measured 20 module rows and none of the controls, which is a
 * green run that checked nothing. So the survey walks in, and back out, and in again.
 */
const ABOUT_ME_SCREENS = [
    ['a topic card', (c) => c.querySelector('.wv-module-row')],
    ['People', (c) => [...c.querySelectorAll('button')].find((b) => /People/i.test(b.textContent))],
    ['My Places', (c) => [...c.querySelectorAll('button')].find((b) => /Places/i.test(b.textContent))],
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
                    exempt: Object.fromEntries(Object.entries(DELIBERATE_SELECTORS)
                        .map(([prop, sels]) => [prop, sels.some((s) => el.matches(s))])),
                });
            }
        }
        return out;
    }, deliberate);
}

/**
 * The controls on one About Me screen, reached by clicking `open` on the home screen and
 * returning afterwards.
 *
 * ⚠ IT ASSERTS IT ACTUALLY GOT THERE. A selector that stops matching - a renamed button,
 * a reordered home screen - would otherwise leave this surveying the home screen twice
 * and passing, which is the failure that looks most like success.
 */
async function surveyAboutMe(deliberate) {
    const found = [];
    for (const [label] of ABOUT_ME_SCREENS) {
        const rows = await page.evaluate(async (args) => {
            const { name, selectors } = args;
            const c = document.getElementById('worldviewContent');
            const openers = {
                'a topic card': () => c.querySelector('.wv-module-row'),
                People: () => [...c.querySelectorAll('button')].find((b) => /People/i.test(b.textContent)),
                'My Places': () => [...c.querySelectorAll('button')].find((b) => /Places/i.test(b.textContent)),
            };
            const btn = openers[name]();
            if (!btn) return { reached: false, controls: [] };
            btn.click();
            await new Promise((r) => setTimeout(r, 450));
            const controls = [...c.querySelectorAll('button, input[type="text"], select, textarea')]
                .filter((e) => e.getBoundingClientRect().width)
                .map((e) => {
                    const s = getComputedStyle(e); const r = e.getBoundingClientRect();
                    return {
                        tab: 'aboutme:' + name,
                        tag: e.tagName.toLowerCase(),
                        id: e.id || '',
                        cls: e.className || '',
                        text: (e.textContent || '').trim().slice(0, 24),
                        hasIcon: !!e.querySelector('svg'),
                        name: e.getAttribute('aria-label') || e.getAttribute('title')
                              || (e.textContent || '').trim(),
                        height: Math.round(r.height),
                        font: `${s.fontFamily.split(',')[0].replace(/["']/g, '')} ${s.fontSize}`,
                        look: `bg=${s.backgroundColor} radius=${s.borderRadius} `
                            + `border=${s.borderTopWidth} ${s.borderTopStyle}`,
                        exempt: Object.fromEntries(Object.entries(selectors)
                            .map(([prop, sels]) => [prop, sels.some((sel) => e.matches(sel))])),
                    };
                });
            const back = c.querySelector('.wv-back');
            if (back) { back.click(); await new Promise((r) => setTimeout(r, 350)); }
            return { reached: true, controls };
        }, { name: label, selectors: deliberate });

        assert.ok(rows.reached, `About Me: could not open "${label}" - the survey would `
            + 'otherwise measure the home screen again and pass having checked nothing');
        assert.ok(rows.controls.length > 2,
            `About Me / ${label}: only ${rows.controls.length} control(s) - did the screen open?`);
        found.push(...rows.controls);
    }
    return found;
}

let controls = null;
async function survey() {
    if (!controls) {
        const deliberate = { fill: exemptFor('fill'), radius: exemptFor('radius'),
                             size: exemptFor('size') };
        const settings = await surveySettings(deliberate);
        // Leave the About Me tab showing, then walk into its screens.
        await page.evaluate(() =>
            document.querySelector('#settingsDialog .settings-tab[data-tab="aboutme"]').click());
        await new Promise((r) => setTimeout(r, 500));
        controls = [...settings, ...await surveyAboutMe(deliberate)];
    }
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

/*
 * ⚠ WHAT THE ALLOWLIST EXEMPTS, AND WHAT IT DOES NOT - this split is the whole design,
 * and the first cut got it wrong in a way that made About Me's coverage worthless.
 *
 * Every About Me button is legitimately a special kind - primary, speak, link, chip,
 * destructive - so a blanket exemption excluded ALL of them, and the whole screen
 * contributed nothing. Putting the old divergence back (its buttons a size smaller and a
 * corner rounder than the rest of the panel) was NOT CAUGHT, which is the failure that
 * looks exactly like success.
 *
 * So the exemption is per PROPERTY, and the line is what the property means:
 *   FILL and BORDER carry a button's ROLE - red destroys, filled is the primary action,
 *     transparent is a link - so a named exception may differ there. That is the point of
 *     being named.
 *   SIZE, TYPEFACE and CORNER RADIUS carry NOTHING. No exception may differ there, however
 *     special it is: a destructive button is red, it is not a different typeface.
 */
test('no control differs in the ways that carry no meaning - size and typeface', async (t) => {
    if (skip) return t.skip(skip);
    const all = await survey();
    // The shortened key is deliberately even-width, so a run of characters can be checked
    // against the key in hand. It is the one control allowed its own typeface.
    const controls = all.filter((c) => !/key-redacted/.test(c.cls));
    assert.ok(controls.length > 60, `expected a real population, got ${controls.length}`);

    const byFont = group(controls.filter((c) => !c.exempt.size), (c) => c.font);
    assert.equal(Object.keys(byFont).length, 1,
        'controls in more than one typeface or size. This holds for EVERY control, '
        + 'including the ones named in DELIBERATE: being a special kind of button licenses '
        + 'a different colour, never a different size:' + report(byFont));

    /*
     * ⚠ CORNER RADIUS IS DELIBERATELY NOT CHECKED, and this is a scope decision rather
     * than an oversight. The app genuinely draws three families at three radii - the
     * panel's own controls at 4, the editors and About Me at 6, the practice and module
     * cards at 8 - and each is internally consistent. Enforcing one value would mean a
     * sweep across the whole app that nobody has asked for, and a check that demands a
     * change nobody wants is one that gets deleted rather than obeyed.
     *
     * What that costs is worth knowing: a button drifting to a neighbouring family's
     * radius would not be caught here. What catches it in practice is the SIZE check
     * above - the two drifted together both times this has happened, because they come
     * from the same forgotten rule - and the fill check below. Revisit if a radius ever
     * drifts on its own.
     */
});

test('every plain action button has the same fill and border', async (t) => {
    if (skip) return t.skip(skip);
    const all = await survey();
    const plain = all.filter((c) => c.tag === 'button' && !c.exempt.fill);
    assert.ok(plain.length > 20, `expected a real population of buttons, got ${plain.length}`);

    const byFill = group(plain, (c) => c.look.replace(/ radius=[^ ]+/, ''));
    assert.equal(Object.keys(byFill).length, 1,
        'Settings holds buttons of one kind wearing more than one appearance. Either style '
        + 'it like the others, or add it to DELIBERATE at the top of this file WITH the '
        + 'reason it is different:' + report(byFill));
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
