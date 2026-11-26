/* The keyguard layout file, checked in the real app (Ken, November 26 2026).
 *
 * Run: node scripts/keyguard-layout/browser-check.mjs
 *
 * Drives the real app in a headless browser with real clicks, as on an iPad (no folder
 * picker, so the file leaves by the download path):
 *
 *   1. Device A gets a non-default layout and some personal settings, and saves a
 *      layout file from the Keyguard Design tab.
 *   2. The file holds the layout settings, the device name, the openings, and nothing
 *      personal.
 *   3. Device B (a fresh browser profile, same screen size) loads it. Its layout
 *      changes, its key and tester name do not, and - the point of the whole feature -
 *      the openings B then measures are IDENTICAL to A's.
 *   4. Device C (a shorter window) is told the app areas differ before it loads.
 *
 * ⚠ WHAT THIS CANNOT CHECK: writing into a real data folder on a computer (a browser
 * hands one over only through a dialog no program can click), and a real iPad's share
 * sheet. Both use paths the app already uses for Screen Openings and backups.
 */
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8131;
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

// Runs before the app: no folder picker (as on an iPad), and no real network.
function stubs() {
    try { delete Window.prototype.showDirectoryPicker; } catch { /* ignore */ }
    try { delete window.showDirectoryPicker; } catch { /* ignore */ }
    const realFetch = window.fetch.bind(window);
    window.fetch = async (url, init) => {
        if (String(url).startsWith('https://')) {
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return realFetch(url, init);
    };
}

async function tap(page, find, ...args) {
    const handle = await page.evaluateHandle(find, ...args);
    const el = handle.asElement();
    if (!el) { await handle.dispose(); return false; }
    await el.click();
    await handle.dispose();
    await pace(250);
    return true;
}

async function card(page) {
    return page.evaluate(() => {
        const d = [...document.querySelectorAll('dialog[open]')].filter((x) => x.id !== 'settingsDialog').pop();
        if (!d) return null;
        return {
            title: (d.querySelector('.danger-title') || {}).textContent || '',
            body: (d.querySelector('.danger-body') || {}).textContent || '',
        };
    });
}
async function waitForCard(page, title, ms = 15000) {
    for (let t = 0; t < ms; t += 200) {
        const c = await card(page);
        if (c && title.test(c.title)) return c;
        await pace(200);
    }
    return null;
}
const press = (page, label) => tap(page, (a) => {
    const d = [...document.querySelectorAll('dialog[open]')].filter((x) => x.id !== 'settingsDialog').pop();
    return d ? [...d.querySelectorAll('button')].find((b) => b.textContent === a) || null : null;
}, label);

async function start(page) {
    await tap(page, () => document.getElementById('startBtn'));
    await pace(1200);
    for (let i = 0; i < 6 && await page.evaluate(() => document.querySelector('main').classList.contains('disabled')); i++) {
        await tap(page, () => [...document.querySelectorAll('#startBlock button')]
            .find((b) => b.offsetParent && /Got it|Continue|Not now|Skip|Later|Close|OK/.test(b.textContent)) || null);
        await pace(800);
    }
    return !(await page.evaluate(() => document.querySelector('main').classList.contains('disabled')));
}

async function openLayoutSection(page) {
    if (!(await page.evaluate(() => !!document.querySelector('#settingsDialog[open]')))) {
        await tap(page, () => document.getElementById('settingsBtn'));
        await pace(500);
    }
    await tap(page, () => document.querySelector('.settings-tab[data-tab="keyguard"]'));
    await pace(300);
    const summaryOf = () => [...document.querySelectorAll('.tab-panel[data-tab="keyguard"] summary')]
        .find((x) => /Keyguard layout file/.test(x.textContent)) || null;
    const open = await page.evaluate((f) => {
        const s = [...document.querySelectorAll('.tab-panel[data-tab="keyguard"] summary')]
            .find((x) => /Keyguard layout file/.test(x.textContent));
        return s ? s.parentElement.open : null;
    });
    if (open === false) await tap(page, summaryOf);
    return open !== null;
}

async function newDevice(browser, height, downloads, setup) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1180, height });
    await page.evaluateOnNewDocument(stubs);
    page.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failures++; });
    const cdp = await page.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {
        behavior: 'allow', downloadPath: downloads, browserContextId: ctx.id, eventsEnabled: true,
    });
    await page.goto(URL, { waitUntil: 'load' });
    await page.evaluate(setup);
    await page.reload({ waitUntil: 'load' });
    await pace(800);
    return page;
}

async function saveFile(page, downloads) {
    const before = new Set(fs.readdirSync(downloads));
    await tap(page, () => document.getElementById('saveLayoutFileBtn'));
    const c = await waitForCard(page, /Save this screen/);
    if (!c) return { card: null };
    await press(page, 'Save it');
    let file = null;
    for (let i = 0; i < 50 && !file; i++) {
        await pace(200);
        file = fs.readdirSync(downloads).find((f) => !before.has(f) && f.endsWith('.json'));
    }
    const done = await waitForCard(page, /Keyguard layout file/);
    await press(page, 'OK');
    return { card: c, done, file: file && path.join(downloads, file) };
}

async function loadFile(page, file) {
    const [chooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 5000 }),
        tap(page, () => document.getElementById('loadLayoutFileBtn')),
    ]);
    await chooser.accept([file]);
    return waitForCard(page, /Load this keyguard layout/);
}

const server = await startServer();
const browser = await puppeteer.launch({ headless: true });
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'conversant-layout-check-'));
try {
    // ── Device A ─────────────────────────────────────────────────────────────
    const a = await newDevice(browser, 788, downloads, async () => {
        const s = await import('/js/storage.js');
        s.saveApiKey('sk-ant-device-a-000000000000000000000000000000000000');
        s.saveTesterName('Tester A');
        s.saveKeyboardDock('side');
        s.saveSideDockPosition('left');
        s.saveButtonGapPos(40);
        s.saveAppMarginPos(20);
        s.saveSpokenWords([{ word: 'Siobhan', say: 'Shiv-awn' }]);
    });
    check(await start(a), 'device A: the app started');
    check(await openLayoutSection(a), 'device A: the Keyguard layout file section is on the Keyguard Design tab');
    await a.click('#deviceModelInput');
    await a.type('#deviceModelInput', 'iPad Air 11-inch (M2)');
    const saved = await saveFile(a, downloads);
    check(!!saved.card && /iPad Air 11-inch/.test(saved.card.body), 'device A: the save card names the device');
    check(!!saved.file, 'device A: a layout file was saved');
    const text = saved.file ? fs.readFileSync(saved.file, 'utf8') : '{}';
    const fileA = JSON.parse(text);
    check(fileA.kind === 'conversant-keyguard-layout', 'the file is a keyguard layout file');
    check(fileA.settings.keyboardDock === 'side' && fileA.settings.buttonGapPos === 40
        && fileA.settings.appMarginPos === 20 && fileA.settings.sideDockPosition === 'left',
        'the file carries the layout settings');
    check(fileA.device.model === 'iPad Air 11-inch (M2)' && fileA.device.appWidth === 1180 && fileA.device.appHeight === 788,
        `the file records the device and its app area (${fileA.device.appWidth} × ${fileA.device.appHeight})`);
    check(Array.isArray(fileA.openings) && fileA.openings.length > 20, `the file carries the openings (${(fileA.openings || []).length})`);
    check(!/sk-ant|Tester A|Siobhan|Shiv-awn/.test(text), 'nothing personal is in the file');

    // ── Device B: same screen, defaults ─────────────────────────────────────────
    const downloadsB = fs.mkdtempSync(path.join(downloads, 'b-'));
    const b = await newDevice(browser, 788, downloadsB, async () => {
        const s = await import('/js/storage.js');
        s.saveApiKey('sk-ant-device-b-000000000000000000000000000000000000');
        s.saveTesterName('Tester B');
    });
    check(await start(b), 'device B: the app started');
    await openLayoutSection(b);
    const loadCard = await loadFile(b, saved.file);
    check(!!loadCard && /iPad Air 11-inch/.test(loadCard.body) && /Button spacing/.test(loadCard.body),
        'device B: the load card names the source and what changes');
    check(!!loadCard && /same size on both/.test(loadCard.body), 'device B: the load card says the app areas match');
    await Promise.all([b.waitForNavigation({ waitUntil: 'load' }), press(b, 'Load')]);
    await pace(800);
    const afterB = await b.evaluate(async () => {
        const s = await import('/js/storage.js');
        return { dock: s.loadKeyboardDock(), side: s.loadSideDockPosition(), gap: s.loadButtonGapPos(),
                 margin: s.loadAppMarginPos(), tester: s.loadTesterName(), key: s.loadApiKey() };
    });
    check(afterB.dock === 'side' && afterB.side === 'left' && afterB.gap === 40 && afterB.margin === 20,
        'device B: the layout settings were applied');
    check(afterB.tester === 'Tester B' && /device-b/.test(afterB.key), 'device B: its own key and tester name are untouched');
    check(await start(b), 'device B: the app started again');
    await openLayoutSection(b);
    const status = await b.evaluate(() => document.getElementById('layoutFileStatus').textContent);
    check(/iPad Air 11-inch/.test(status) && /same size on both/.test(status), `device B: the tab says it now matches ("${status}")`);
    const savedB = await saveFile(b, downloadsB);
    if (!savedB.file) console.log('      second save:', JSON.stringify({ card: savedB.card, done: savedB.done }));
    const fileB = savedB.file ? JSON.parse(fs.readFileSync(savedB.file, 'utf8')) : { openings: [] };
    // The point of the feature: the same settings on the same screen give the same holes.
    const differ = fileA.openings.map((l, i) => [l, fileB.openings[i]]).filter(([x, y]) => x !== y);
    check(!differ.length && fileB.openings.length === fileA.openings.length,
        'device B now measures exactly the same openings as device A');
    for (const [x, y] of differ.slice(0, 6)) console.log(`      A: ${x}\n      B: ${y}`);

    // ── Device C: a shorter window ──────────────────────────────────────────────
    const c = await newDevice(browser, 763, downloads, async () => {
        const s = await import('/js/storage.js');
        s.saveApiKey('sk-ant-device-c-000000000000000000000000000000000000');
    });
    check(await start(c), 'device C: the app started');
    await openLayoutSection(c);
    const cCard = await loadFile(c, saved.file);
    check(!!cCard && /Their app area was 1180 × 788/.test(cCard.body), 'device C: told the app areas differ before loading');
    await press(c, 'Cancel');

    // A file that is not a layout file is refused in words.
    const bogus = path.join(downloads, 'not-a-layout.json');
    fs.writeFileSync(bogus, JSON.stringify({ kind: 'conversant-backup' }));
    const [chooser] = await Promise.all([
        c.waitForFileChooser({ timeout: 5000 }),
        tap(c, () => document.getElementById('loadLayoutFileBtn')),
    ]);
    await chooser.accept([bogus]);
    const refused = await waitForCard(c, /Keyguard layout file/);
    check(!!refused && /not a Conversant keyguard layout/.test(refused.body), 'a backup file is refused with a plain message');
} finally {
    await browser.close();
    server.kill();
    fs.rmSync(downloads, { recursive: true, force: true });
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
