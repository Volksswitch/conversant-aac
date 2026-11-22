/* "Delete everything on this device", checked in the real app (Ken, November 22 2026).
 *
 * Run: node scripts/uninstall/browser-check.mjs
 *
 * Drives the real app in a headless browser, pressing the real buttons, then asks the
 * browser what it still holds for the app. Two runs, each in its own browser profile:
 *
 *   1. As on an iPad: no folder picker, so everything lives inside the browser. It is
 *      filled with data, then Cancel, "Save a backup first", a second copy of the app
 *      and "Keep everything" must each delete nothing; the real delete must leave
 *      nothing, nothing may come back afterwards, and the page must not reload.
 *   2. As on a computer with a data folder chosen: the checkbox is offered, it is
 *      cleared each time Settings opens, and what the cards and the final page say
 *      follows it.
 *
 * ⚠ WHAT THIS CANNOT CHECK: deleting files from a real folder on disk. A browser hands
 * one over only through a dialog no program can click, so run 2's folder is one the
 * browser keeps privately, and it is emptied with everything else. Which files in a real
 * folder go and which stay is checked in tests/uninstall.test.mjs.
 */
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8128;
const URL = `http://localhost:${PORT}/`;
const pace = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(ok, what) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
    if (!ok) failures++;
}

async function startServer() {
    const proc = spawn('python', [path.join(ROOT, 'scripts', 'dev-server.py'), String(PORT)], { cwd: ROOT, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
        try { if ((await fetch(URL)).ok) return proc; } catch { /* not up yet */ }
        await pace(200);
    }
    proc.kill();
    throw new Error('The local app server did not start.');
}

// Runs in the page before any of the app's scripts.
function stubs(mode) {
    if (mode === 'device') {
        try { delete Window.prototype.showDirectoryPicker; } catch { /* ignore */ }
        try { delete window.showDirectoryPicker; } catch { /* ignore */ }
    } else {
        // A "chosen" folder: one the browser keeps privately, since a real one needs a
        // dialog no program can click.
        window.showDirectoryPicker = async () =>
            (await navigator.storage.getDirectory()).getDirectoryHandle('Conversant Data', { create: true });
    }
    const realFetch = window.fetch.bind(window);
    window.fetch = async (url, init) => {
        if (String(url).startsWith('https://')) {
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return realFetch(url, init);
    };
}

// What the browser holds for the app, from uninstall.js's own reading of it.
const held = (page) => page.evaluate(async () => (await import('/js/uninstall.js')).whatIsLeft());
const summary = (list) => JSON.stringify(list.map((x) => `${x.what}:${x.name}`).sort());

// Taps the element `find` returns, with a real mouse click. The finders are functions,
// not strings built into code: the app forbids running code from a string (its content
// security policy), and the check must run under the same rules as the app.
async function tap(page, find, ...args) {
    const handle = await page.evaluateHandle(find, ...args);
    const el = handle.asElement();
    if (!el) { await handle.dispose(); return false; }
    await el.click();
    await handle.dispose();
    await pace(250);
    return true;
}

// The card on top: any open dialog other than Settings itself.
async function card(page) {
    return page.evaluate(() => {
        const d = [...document.querySelectorAll('dialog[open]')].filter((x) => x.id !== 'settingsDialog').pop();
        if (!d) return null;
        return {
            title: (d.querySelector('.danger-title') || {}).textContent || '',
            body: (d.querySelector('.danger-body') || {}).textContent || '',
            buttons: [...d.querySelectorAll('button')].map((b) => b.textContent),
        };
    });
}
// The card on top fits on the screen without scrolling, and its buttons sit in one
// row inside it. A first draft did not: above the Express Panel the card scrolled,
// hiding its title and pushing "Continue" out of sight.
async function cardFits(page) {
    return page.evaluate(() => {
        const d = [...document.querySelectorAll('dialog[open]')].filter((x) => x.id !== 'settingsDialog').pop();
        if (!d) return false;
        const r = d.getBoundingClientRect();
        const btns = [...d.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
        return d.scrollHeight <= d.clientHeight + 1
            && btns.every((b) => b.top >= r.top && b.bottom <= r.bottom)
            && new Set(btns.map((b) => Math.round(b.top))).size === 1;
    });
}
async function waitForCard(page, title, ms = 30000) {
    for (let t = 0; t < ms; t += 200) {
        const c = await card(page);
        if (c && (!title || title.test(c.title))) return c;
        await pace(200);
    }
    return null;
}
const press = (page, label) => tap(page, (a) => {
    const d = [...document.querySelectorAll('dialog[open]')].filter((x) => x.id !== 'settingsDialog').pop();
    return d ? [...d.querySelectorAll('button')].find((b) => b.textContent === a) || null : null;
}, label);

async function startApp(page) {
    await page.goto(URL, { waitUntil: 'load' });
    await page.evaluate(async () => {
        const s = await import('/js/storage.js');
        s.saveApiKey('sk-ant-test-0000000000000000000000000000000000000000');
    });
    await page.reload({ waitUntil: 'load' });
    await pace(800);
    await tap(page, () => document.getElementById('startBtn'));
    await pace(1200);
    // Whatever the start screens ask after Start, answer it and go on.
    for (let i = 0; i < 6 && await page.evaluate(() => document.querySelector('main').classList.contains('disabled')); i++) {
        await tap(page, () => [...document.querySelectorAll('#startBlock button')]
            .find((b) => b.offsetParent && /Got it|Continue|Not now|Skip|Later|Close|OK/.test(b.textContent)) || null);
        await pace(800);
    }
    check(!(await page.evaluate(() => document.querySelector('main').classList.contains('disabled'))), 'the app started');
    // The service worker must be in place, or a check that it went proves nothing.
    await page.evaluate(() => navigator.serviceWorker.ready);
    for (let i = 0; i < 40 && !(await page.evaluate(async () => (await caches.keys()).length)); i++) await pace(250);
}

async function openDeleteSection(page) {
    if (!(await page.evaluate(() => !!document.querySelector('#settingsDialog[open]')))) {
        await tap(page, () => document.getElementById('settingsBtn'));
        await pace(500);
    }
    await tap(page, () => document.querySelector('.settings-tab[data-tab="about"]'));
    await pace(300);
    const open = await page.evaluate(() => {
        const s = [...document.querySelectorAll('.tab-panel[data-tab="about"] summary')]
            .find((x) => /Delete Conversant from this device/.test(x.textContent));
        return s ? s.parentElement.open : null;
    });
    if (open === false) {
        await tap(page, () => [...document.querySelectorAll('.tab-panel[data-tab="about"] summary')]
            .find((x) => /Delete Conversant from this device/.test(x.textContent)) || null);
    }
    return open !== null;
}

const pressDelete = (page) => tap(page, () => document.getElementById('deleteEverythingBtn'));

const server = await startServer();
const browser = await puppeteer.launch({ headless: true });
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'conversant-uninstall-check-'));
try {
    // ── Run 1: as on an iPad ────────────────────────────────────────────────────
    const ctx1 = await browser.createBrowserContext();
    const page = await ctx1.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(stubs, 'device');
    page.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failures++; });
    // Downloads are set per browser profile, so this one is named.
    const cdp = await page.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {
        behavior: 'allow', downloadPath: downloads, browserContextId: ctx1.id, eventsEnabled: true,
    });

    await startApp(page);
    await page.evaluate(async () => {
        const vs = await import('/js/voice-store.js');
        await vs.put('seeded clip', new Uint8Array([1, 2, 3]).buffer);
        sessionStorage.setItem('seeded', '1');
        const s = await import('/js/storage.js');
        await s.startConversationLog();
        await s.logPartnerInterim({ rawTranscript: 'something the other person said' });
        await s.whenLogWritten();
        window.__sameDocument = true;
    });
    const before = await held(page);
    const kinds = new Set(before.map((x) => x.what));
    check(['settings', 'offline', 'database', 'private'].every((k) => kinds.has(k)),
        `before: the browser holds settings, the offline copy, databases and private files (${summary(before)})`);
    check(before.some((x) => x.name === 'conversant-voice-audio'), 'before: the stored voice recordings are there');

    check(await openDeleteSection(page), 'Settings > About has the "Delete Conversant from this device" section');
    check(await page.evaluate(() => document.getElementById('deleteFolderTooRow').hidden),
        'no data folder checkbox where everything lives inside the browser');

    // Cancel on the first card.
    await pressDelete(page);
    let c = await waitForCard(page, /Delete everything Conversant keeps/);
    check(!!c && c.buttons.join('|') === 'Cancel|Save a backup first|Continue', `the first card offers Cancel, a backup, and Continue (${c && c.buttons.join('|')})`);
    check(!!c && /saved conversations, backups, sounds and documents go too/.test(c.body), 'it says the conversations go too, since they are kept inside the app');
    check(await cardFits(page), 'the first card fits without scrolling, its three buttons in one row');
    check(!!c && /can’t remove the app’s icon/.test(c.body) && /Section 11/.test(c.body), 'it says what it cannot do, and where the manual shows how');
    await press(page, 'Cancel');
    check(summary(await held(page)) === summary(before), 'Cancel deletes nothing');

    // A backup first.
    await pressDelete(page);
    await waitForCard(page, /Delete everything Conversant keeps/);
    await press(page, 'Save a backup first');
    c = await waitForCard(page, /Backup saved|couldn’t be made/, 60000);
    check(!!c && c.title === 'Backup saved' && /Nothing has been deleted/.test(c.body), `the backup is saved and says nothing was deleted (${c && c.title})`);
    let file = null;
    for (let i = 0; i < 40 && !file; i++) { file = fs.readdirSync(downloads).find((f) => /^conversant-backup-.*\.json$/.test(f)); if (!file) await pace(250); }
    check(!!file, `the backup left the app as a file (${file})`);
    if (file) {
        const pkg = JSON.parse(fs.readFileSync(path.join(downloads, file), 'utf8'));
        check(!JSON.stringify(pkg).includes('sk-ant-test-0000'), 'the backup carries no key');
    }
    await press(page, 'OK');
    check(summary(await held(page)) === summary(before), 'saving a backup deletes nothing');

    // A second copy of the app open in another tab.
    const other = await ctx1.newPage();
    await other.evaluateOnNewDocument(stubs, 'device');
    await other.goto(URL, { waitUntil: 'load' });
    for (let i = 0; i < 30 && !(await other.evaluate(() => !!document.getElementById('singleInstanceOverlay'))); i++) await pace(200);
    await page.bringToFront();
    await pressDelete(page);
    c = await waitForCard(page, /Close the other copy first|Delete everything/);
    check(!!c && c.title === 'Close the other copy first', `with a second copy waiting, it asks for that one to be closed (${c && c.title})`);
    if (c) await press(page, c.buttons.includes('OK') ? 'OK' : 'Cancel');
    await other.close();
    await pace(500);
    check(summary(await held(page)) === summary(before), 'a second copy open: nothing deleted');

    // The second card, refused.
    await pressDelete(page);
    await waitForCard(page, /Delete everything Conversant keeps/);
    await press(page, 'Continue');
    c = await waitForCard(page, /Are you sure/);
    check(!!c && c.buttons.join('|') === 'Keep everything|Delete everything' && /saved conversations/.test(c.body),
        `the second card asks again (${c && c.buttons.join('|')})`);
    await press(page, 'Keep everything');
    check(summary(await held(page)) === summary(before), '"Keep everything" deletes nothing');

    // The real thing.
    await pressDelete(page);
    await waitForCard(page, /Delete everything Conversant keeps/);
    await press(page, 'Continue');
    await waitForCard(page, /Are you sure/);
    await press(page, 'Delete everything');
    let heading = null;
    for (let i = 0; i < 100 && !heading; i++) {
        heading = await page.evaluate(() => { const h = document.querySelector('.deleted-page h1'); return h ? h.textContent : null; });
        if (!heading) await pace(200);
    }
    check(heading === 'Conversant has been deleted from this device', `the page says it is done (${heading})`);
    check(await page.evaluate(() => window.__sameDocument === true), 'the page was not reloaded (a reload would start the app fresh)');
    check(await page.evaluate(() => /That includes your saved conversations and backups/.test(document.body.textContent)
        && /Section 11 of the User Manual/.test(document.body.textContent)), 'it says what went, and how to finish');
    let after = await held(page);
    check(after.length === 0, `afterwards the browser holds nothing for the app (${summary(after)})`);

    // Things that save on their own: a page being hidden, and a pause.
    await page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        document.dispatchEvent(new Event('visibilitychange'));
        localStorage.setItem('aac_settings', '{"put":"back"}');
    });
    await pace(4000);
    after = await held(page);
    check(after.length === 0, `four seconds later, still nothing (${summary(after)})`);
    await ctx1.close();

    // ── Run 2: as on a computer with a data folder chosen ──────────────────────
    const ctx2 = await browser.createBrowserContext();
    const page2 = await ctx2.newPage();
    await page2.setViewport({ width: 1280, height: 800 });
    await page2.evaluateOnNewDocument(stubs, 'folder');
    page2.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failures++; });
    await startApp(page2);
    await page2.evaluate(async () => { const s = await import('/js/storage.js'); await s.pickDataFolder(); });
    check(await page2.evaluate(async () => (await import('/js/storage.js')).hasVisibleDataFolder()), 'a data folder is chosen');

    await openDeleteSection(page2);
    check(await page2.evaluate(() => !document.getElementById('deleteFolderTooRow').hidden
        && !document.getElementById('deleteFolderTooInput').checked), 'with a data folder, the checkbox is offered, unchecked');
    await pressDelete(page2);
    c = await waitForCard(page2, /Delete everything Conversant keeps/);
    check(!!c && /Your data folder “Conversant Data” is kept/.test(c.body), 'unchecked: the first card says the folder is kept');
    await press(page2, 'Cancel');

    // Checked, then Settings closed and opened again: the check does not carry over.
    await tap(page2, () => document.getElementById('deleteFolderTooInput'));
    check(await page2.evaluate(() => document.getElementById('deleteFolderTooInput').checked), 'the checkbox can be checked');
    await tap(page2, () => document.getElementById('closeSettingsBtn'));
    await pace(400);
    await openDeleteSection(page2);
    check(await page2.evaluate(() => !document.getElementById('deleteFolderTooInput').checked), 'opening Settings again clears the check');

    await tap(page2, () => document.getElementById('deleteFolderTooInput'));
    await pressDelete(page2);
    c = await waitForCard(page2, /Delete everything Conversant keeps/);
    check(!!c && /It also deletes what Conversant saved in your data folder “Conversant Data”/.test(c.body)
        && /Anything else in that folder is left alone/.test(c.body), 'checked: the first card says what goes from the folder, and what stays');
    check(await cardFits(page2), 'with the folder paragraph too, the first card still fits');
    await press(page2, 'Continue');
    c = await waitForCard(page2, /Are you sure/);
    check(!!c && /in “Conversant Data”/.test(c.body), 'the second card names the folder');
    await press(page2, 'Delete everything');
    heading = null;
    for (let i = 0; i < 100 && !heading; i++) {
        heading = await page2.evaluate(() => { const h = document.querySelector('.deleted-page h1'); return h ? h.textContent : null; });
        if (!heading) await pace(200);
    }
    check(heading === 'Conversant has been deleted from this device', `folder run: the page says it is done (${heading})`);
    check(await page2.evaluate(() => /So is what it saved in your data folder “Conversant Data”/.test(document.body.textContent)),
        'folder run: it says what went from the folder');
    after = await held(page2);
    check(after.length === 0, `folder run: afterwards the browser holds nothing for the app (${summary(after)})`);
    await ctx2.close();
} finally {
    await browser.close();
    server.kill();
    fs.rmSync(downloads, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
