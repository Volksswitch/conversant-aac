/* Captures document figures from the REAL APP, not from a drawing or a prototype:
 *
 *   rv-fig2.png  Conversation Review, Figure 2: a turn answered from a response option
 *   rv-fig3.png  Conversation Review, Figure 3: a turn answered from the Express Panel
 *   ep-fig4.png  Express Panel Design, Figure 4: the Flex band's editor in Settings,
 *                with the Insert buttons, the topic dropdown and the live panel beside it
 *
 * Run from anywhere:   node scripts/doc-generators/capture-app-figures.mjs [review|editor]
 * (no argument does both). It starts scripts/dev-server.py on its own port, drives the
 * app headless, and writes the PNGs into this folder. Then swap the bytes of the
 * matching picture inside the .docx (the sizes below are the sizes the documents
 * already embed, and the script stops if a capture comes out any other size).
 *
 * The user is Marc Delgado from test-data-folder/ (made by "reset test data"), loaded
 * into the browser's own storage the way an iPad keeps it, because a data folder can
 * only be chosen through a dialog no program can click. The reviewed conversation is
 * written here, so the review figures do not depend on what the test folder holds.
 * No AI and no speech are used: any request to the AI stops the capture.
 *
 * Made November 25 2026, replacing the prototype shots that capture-review-figures.js
 * makes for these two review figures, and the drawn Figure 4 in
 * "Express Panel Figures.html".
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const puppeteer = require('puppeteer');
const PORT = 8137;
const which = process.argv[2] || 'all';
const pace = (ms) => new Promise((r) => setTimeout(r, ms));

const TD = path.join(ROOT, 'test-data-folder');
if (!fs.existsSync(path.join(TD, 'express-panel.json'))) {
    console.error('STOPPING - test-data-folder is missing. Ask Claude to "reset test data" first.');
    process.exit(1);
}
const readJ = (f) => JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));

// The conversation shown in review: Mom invites Marc over, he answers with a response
// option, then with "Thank you" from his Express Panel, then says goodbye.
function conversation() {
    const t0 = Date.parse('2026-11-22T18:10:00.000Z');
    const at = (s) => new Date(t0 + s * 1000).toISOString();
    const mom = { id: 'p-elena', label: 'Mom' };
    const partner = (s, text) => ({ timestamp: at(s), role: 'partner', rawTranscript: text, cleanedTranscript: text,
        uncertain: [], partner: mom, place: null, stt: 'browser', revisions: [{ at: at(s), text }] });
    const tts = { provider: 'browser', voice: 'Microsoft Guy Online (Natural) - English (United States)' };
    const o1 = [
        { slot: 'PREFERRED', text: "Sunday works. I'll come over." },
        { slot: 'DISPREFERRED', text: "I'd love to, but Sunday isn't great for me." },
        { slot: 'INITIATIVE', text: 'Could we make it Saturday instead?' },
        { slot: 'REPAIR', text: 'Sorry, which Sunday do you mean?' },
    ];
    const o2 = [
        { slot: 'PREFERRED', text: 'That would be great, thanks.' },
        { slot: 'DISPREFERRED', text: "You really don't have to." },
        { slot: 'INITIATIVE', text: 'Could you bring those pictures instead?' },
        { slot: 'REPAIR', text: 'Sorry, bring what?' },
    ];
    const id = '2026-11-22T18-10-00';
    const data = {
        id, started: at(0),
        exchanges: [
            { timestamp: at(0), role: 'context', trigger: 'start', partner: mom, feeling: null, place: null, goals: null },
            { timestamp: at(0.5), role: 'event', kind: 'listen on' },
            partner(3, 'We were wondering if you could come over on Sunday. Does that work?'),
            { timestamp: at(4.5), role: 'offer', kind: 'ai', options: o1, outcome: 'card', selectedIndex: 0, shownMs: 6200 },
            { timestamp: at(10.7), role: 'user', selectedText: o1[0].text, spokenText: null, tts, selectedIndex: 0,
              allOptions: o1.map((o) => o.text), selectedSlot: 'PREFERRED', source: 'card', decideMs: 6200, partner: mom, feeling: null, place: null },
            partner(14, "Great. I'll bring dessert, then."),
            { timestamp: at(15.4), role: 'offer', kind: 'ai', options: o2, outcome: 'express', shownMs: 2600 },
            { timestamp: at(18), role: 'user', selectedText: 'Thank you', spokenText: null, tts, selectedIndex: -1,
              allOptions: [], selectedSlot: null, source: 'express', decideMs: null, partner: mom, feeling: null, place: null },
            partner(21, 'See you Sunday, sweetheart.'),
            { timestamp: at(22.4), role: 'offer', kind: 'static', options: [{ slot: 'CLOSING', text: 'See you then!' }, { slot: 'CLOSING', text: 'Bye, Mom!' }], outcome: 'card', selectedIndex: 1, shownMs: 1800 },
            { timestamp: at(24.2), role: 'user', selectedText: 'Bye, Mom!', spokenText: null, tts, selectedIndex: 1,
              allOptions: ['See you then!', 'Bye, Mom!'], selectedSlot: 'CLOSING', source: 'card', decideMs: 1800, partner: mom, feeling: null, place: null },
            { timestamp: at(25), role: 'event', kind: 'listen off' },
        ],
    };
    return { id, data };
}

async function startServer() {
    const proc = spawn('python', [path.join(ROOT, 'scripts', 'dev-server.py'), String(PORT)], { cwd: ROOT, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
        try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return proc; } catch {}
        await pace(200);
    }
    proc.kill();
    throw new Error('The local app server did not start.');
}

async function openApp(browser, view, extraStorage = {}) {
    const page = await browser.newPage();
    await page.setViewport(view);
    page.on('pageerror', (e) => console.log('  [page]', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text()); });
    await page.evaluateOnNewDocument(() => {
        // The browser's own storage, as on an iPad (see the header).
        try { delete Window.prototype.showDirectoryPicker; } catch {}
        try { delete window.showDirectoryPicker; } catch {}
        const synth = window.speechSynthesis;
        if (synth) { synth.speak = (u) => setTimeout(() => u.onend?.(new Event('end')), 50); synth.cancel = () => {}; }
        const realFetch = window.fetch.bind(window);
        window.fetch = async (url, init) => {
            if (String(url).startsWith('https://api.anthropic.com')) throw new Error('no AI in a figure capture');
            return realFetch(url, init);
        };
        document.addEventListener('DOMContentLoaded', () => {
            const st = document.createElement('style');
            st.textContent = '* { caret-color: transparent !important; } #startVersion { visibility: hidden !important; }';
            document.head.appendChild(st);
        });
        // A fixed clock, so anything dated comes out the same on every run.
        const RealDate = Date;
        const offset = new RealDate('2026-11-24T19:30:00Z').getTime() - RealDate.now();
        class FixedDate extends RealDate {
            constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + offset); }
            static now() { return RealDate.now() + offset; }
        }
        window.Date = FixedDate;
    });
    const url = `http://localhost:${PORT}/`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const store = {
        aac_express_items: readJ('express-panel.json'),
        aac_relationships: readJ('relationships.json'),
        aac_places: readJ('places.json'),
        aac_worldview: readJ('worldview.json'),
        ...extraStorage,
    };
    const conv = conversation();
    await page.evaluate(async (settings, store, conv) => {
        localStorage.clear();
        // A key must be present or Start stops on the "add your key" notice. Never used.
        localStorage.setItem('aac_settings', JSON.stringify({
            lastSeenVersion: '99.0.0',
            apiKey: 'sk-ant-figure-only-never-sent-00000000000000000000000000',
            ...settings,
        }));
        for (const [k, v] of Object.entries(store)) localStorage.setItem(k, JSON.stringify(v));
        // Empty the browser's storage first: it is the data folder here, and a file left
        // by an earlier capture in the same run would win over what is seeded above.
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });
        const dir = await root.getDirectoryHandle('conversations', { create: true });
        const w = await (await dir.getFileHandle(`${conv.id}.json`, { create: true })).createWritable();
        await w.write(JSON.stringify(conv.data, null, 2));
        await w.close();
    }, SETTINGS, store, conv);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.click('#startBtn');
    await pace(1500);
    return page;
}

// Keyboard at the side (the document text speaks of "the panel down the side"), the
// response options two by two, and the Command Bar showing words rather than icons
// so a reader can tell the buttons apart.
const SETTINGS = {
    keyboardDock: 'side', sideLayout: 'S2', bottomLayout: 'B11',
    optionsArrangement: { side: 'grid', bottom: 'row' },
    maxPlaceholders: 0, autoRelisten: false,
    convLayout: { side: { command: 0.10, response: 0.46, dock: 0.30 } },
    commandLabels: 'words',
};

async function openSettingsTab(page, tab) {
    await page.click('#settingsBtn');
    await page.waitForSelector('#settingsDialog[open]');
    await pace(400);
    await page.click(`#settingsTabs .settings-tab[data-tab="${tab}"]`);
    await pace(400);
}
async function openSection(page, name) {
    const sel = `::-p-xpath(//dialog[@open]//summary[.//*[normalize-space(text())=${JSON.stringify(name)}]])`;
    const h = await page.waitForSelector(sel, { timeout: 5000 });
    await h.click();
    await pace(500);
}

// Saves a screenshot at exactly the size the document embeds. A screen whose size is
// a whole number of points cannot always land on that pixel size exactly, so a capture
// up to 2 pixels too large is trimmed from the right and bottom edges; anything else
// stops the run.
async function save(page, name, want) {
    const file = path.join(HERE, name);
    let buf = await page.screenshot();
    const sizeOf = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];
    let size = sizeOf(buf);
    const over = [size[0] - want[0], size[1] - want[1]];
    if (over.some((n) => n < 0 || n > 2)) {
        throw new Error(`STOPPING - ${name} came out ${size.join('x')}, the document embeds ${want.join('x')}`);
    }
    if (over[0] || over[1]) {
        const trimmed = await page.evaluate(async (src, w, h) => {
            const img = new Image();
            img.src = src;
            await img.decode();
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0);
            return c.toDataURL('image/png').split(',')[1];
        }, 'data:image/png;base64,' + Buffer.from(buf).toString('base64'), want[0], want[1]);
        buf = Buffer.from(trimmed, 'base64');
        size = sizeOf(buf);
    }
    fs.writeFileSync(file, buf);
    console.log(`${name}  ${size.join('x')}`);
}

async function review(browser) {
    // 1221 x 675 at 4/3 is 1628 x 900, the size the review document embeds.
    const page = await openApp(browser, { width: 1221, height: 675, deviceScaleFactor: 4 / 3 });
    await openSettingsTab(page, 'review');
    await openSection(page, 'Saved conversations');
    await page.waitForSelector('.review-row', { timeout: 8000 });
    await page.click('.review-row');
    await page.waitForSelector('body.reviewing', { timeout: 8000 });
    await pace(900);
    const settle = async () => {
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.mouse.move(560, 330);   // off every button, so nothing shows as hovered
        await pace(400);
    };
    await settle();
    await save(page, 'rv-fig2.png', [1628, 900]);
    await page.click('#initiateBtn');      // Next turn, in review
    await pace(900);
    await settle();
    await save(page, 'rv-fig3.png', [1628, 900]);
    await page.close();
}

async function editor(browser) {
    // Marc's panel plus a phrase using {name} in Mom's list and a topic, so the editor
    // shows the topic dropdown and the Insert buttons have something to show for.
    const ep = readJ('express-panel.json');
    ep.flex['p-elena|anyplace'] = [
        { id: 'fxm1', type: 'phrase', text: 'Love you, {name}', origin: 'added' },
        ...(ep.flex['p-elena|anyplace'] || []),
    ];
    ep.context.splice(3, 0, { id: 'cxt1', type: 'topic', name: 'Conversant', topicId: 't-conversant', origin: 'added' });
    const extra = {
        aac_express_items: ep,
        aac_topics: { version: 1, updated: '2026-11-20T12:00:00.000Z',
            topics: [{ id: 't-conversant', name: 'Conversant', pronunciation: '', sources: [], note: '' }] },
    };
    const dpr = 1640 / 1110;
    const page = await openApp(browser, { width: 1110, height: 749, deviceScaleFactor: dpr }, extra);
    await openSettingsTab(page, 'express');
    await openSection(page, 'Flex — phrases that suit who you are with and where you are');
    await page.evaluate(() => {
        const s = [...document.querySelectorAll('#settingsDialog .ee-scope select')]
            .find((x) => [...x.options].some((o) => o.value === 'p-elena'));
        if (s) { s.value = 'p-elena'; s.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await pace(700);
    const rows = await page.$$('#settingsDialog details[open] .ee-row input');
    if (rows[0]) await rows[0].click();   // selects the row, which lights the toolbar
    await pace(500);
    await page.evaluate(() => {
        document.activeElement?.blur?.();
        document.querySelector('#settingsDialog .ee-scope')?.scrollIntoView({ block: 'start' });
    });
    await page.mouse.move(5, 5);
    await pace(600);
    await save(page, 'ep-fig4.png', [1640, 1106]);
    await page.close();
}

const server = await startServer();
const browser = await puppeteer.launch({ headless: true });
try {
    if (which === 'all' || which === 'review') await review(browser);
    if (which === 'all' || which === 'editor') await editor(browser);
} finally {
    await browser.close();
    server.kill();
}
