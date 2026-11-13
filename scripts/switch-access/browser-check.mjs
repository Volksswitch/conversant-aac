// Switch access, end to end: the real app in a headless browser, driven only by switch
// key presses (Switch Access Design section 5, "The real app, end to end"). A stand-in
// AI and microphone, as in scripts/qa-session-eval/browser-check.mjs.
//
// Run: node scripts/switch-access/browser-check.mjs
//
// Two switches throughout: Space (switch 1) moves, Enter (switch 2) chooses.

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8126;
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

function stubs() {
    try { delete Window.prototype.showDirectoryPicker; } catch { /* ignore */ }
    try { delete window.showDirectoryPicker; } catch { /* ignore */ }
    window.__requests = 0;
    const realFetch = window.fetch.bind(window);
    window.fetch = async (url, init) => {
        const u = String(url);
        if (u.startsWith('https://api.anthropic.com/v1/messages')) {
            const n = ++window.__requests;
            const reply = { partner_action: 'QUESTION', turn_status: 'COMPLETE', is_repair_initiator: false,
                offered_options: [], offered_range: null, missing_facts: [], missing_other: [], heard_uncertain: [],
                responses: [
                    { slot: 'PREFERRED', text: `Everyday reply ${n}.`, hint: 'Everyday' },
                    { slot: 'DISPREFERRED', text: `I would rather not ${n}.`, hint: 'Decline' },
                    { slot: 'INITIATIVE', text: `How about you ${n}?`, hint: 'Ask back' },
                    { slot: 'REPAIR', text: `Sorry ${n}?`, hint: 'Sorry?' },
                ] };
            return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }],
                stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }),
                { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (u.startsWith('https://')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
        return realFetch(url, init);
    };
    window.__spoken = [];
    if (window.speechSynthesis) {
        window.speechSynthesis.speak = (utt) => {
            window.__spoken.push(utt.text);
            setTimeout(() => utt.onstart?.(new Event('start')), 10);
            setTimeout(() => utt.onend?.(new Event('end')), 120);
        };
        window.speechSynthesis.cancel = () => {};
    }
    let live = null;
    class StandIn {
        constructor() { this.continuous = true; this.interimResults = true; this.lang = 'en-US'; }
        start() { live = this; setTimeout(() => this.onstart?.(new Event('start')), 10); }
        stop() { if (live === this) live = null; setTimeout(() => this.onend?.(new Event('end')), 10); }
        abort() { this.stop(); }
    }
    window.SpeechRecognition = StandIn;
    window.webkitSpeechRecognition = StandIn;
    window.__mic = {
        isOn: () => !!live,
        hear(text) {
            if (!live) throw new Error('The microphone is not on');
            const result = Object.assign([{ transcript: text, confidence: 0.95 }], { isFinal: true });
            live.onresult?.({ resultIndex: 0, results: [result] });
        },
    };
}

const server = await startServer();
const browser = await puppeteer.launch({ headless: true, args: ['--use-fake-ui-for-media-stream'] });
try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await browser.defaultBrowserContext().overridePermissions(`http://localhost:${PORT}`, ['microphone']);
    await page.evaluateOnNewDocument(stubs);
    page.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failures++; });

    // What the highlight is on.
    const hl = () => page.evaluate(() => {
        const el = document.querySelector('.scan-held') || document.querySelector('.scan-hl');
        const frame = document.getElementById('scanFrame');
        return {
            id: el ? el.id : null,
            cls: el ? String(el.className) : '',
            text: el ? (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) : '',
            tab: el && el.dataset ? el.dataset.tab || null : null,
            leave: frame && !frame.hidden ? frame.textContent : null,
        };
    });
    const move = async () => { await page.keyboard.press('Space'); await pace(80); };
    const choose = async () => { await page.keyboard.press('Enter'); await pace(250); };
    async function moveUntil(pred, max = 80) {
        for (let i = 0; i < max; i++) {
            const h = await hl();
            if (pred(h)) return h;
            await move();
        }
        return null;
    }

    // ---- The first launch asks touch or switches.
    await page.goto(URL, { waitUntil: 'load' });
    await pace(500);
    check(!!(await page.$('#firstLaunchChoice')), 'the first launch asks touch or switches');
    check(await page.$eval('#startBtn', (b) => b.hidden), 'the Start button waits for the answer');
    check((await hl()).text === 'Touch', 'the highlight starts on Touch');
    // Wait for "Two switches", then press switch 1.
    let onTwo = false;
    for (let i = 0; i < 40 && !onTwo; i++) { onTwo = (await hl()).text === 'Two switches'; if (!onTwo) await pace(150); }
    check(onTwo, 'the choices are highlighted in turn');
    await page.keyboard.press('Digit1');
    await pace(400);
    const after = await page.evaluate(async () => {
        const s = await import('/js/storage.js');
        return { count: s.loadSwitchCount(), kb: s.loadKeyboardMode(), relisten: s.loadAutoRelisten(), on: document.body.classList.contains('switch-access-on') };
    });
    check(after.count === 2 && after.on, 'switch 1 chose two switches and scanning is on');
    check(after.kb === 'onscreen' && after.relisten, 'choosing switches set the on-screen keyboard and listening that resumes');
    check(!(await page.$('#firstLaunchChoice')) && !(await page.$eval('#startBtn', (b) => b.hidden)), 'the question is gone and Start is back');
    // The test presses faster than a person can, so "Ignore repeated presses within" is
    // turned off here; it is checked on its own at the end.
    await page.evaluate(async () => {
        const s = await import('/js/storage.js');
        s.saveApiKey('sk-ant-test-0000000000000000000000000000000000000000');
        s.saveSwitchScan({ ...s.loadSwitchScan(), repeatMs: 0 });
    });
    // The app reads the key when it starts, so start it again; the switch settings stay.
    await page.reload({ waitUntil: 'load' });
    await pace(600);
    check(!(await page.$('#firstLaunchChoice')) && await page.evaluate(() => document.body.classList.contains('switch-access-on')),
        'after a restart the question is not asked again and switch access is still on');

    // ---- The start screen.
    let h = await moveUntil((x) => x.id === 'startBtn', 6);
    check(!!h, 'the scan reaches the Start button');
    await page.touchscreen.tap(640, 400);
    const startBox = await page.$eval('#startBtn', (b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.touchscreen.tap(startBox.x, startBox.y);
    await pace(400);
    check(await page.evaluate(() => document.querySelector('main').classList.contains('disabled')), 'touching Start does nothing while switch access is on');
    await choose();
    await pace(1200);
    // Any notice after Start: choose whatever is highlighted until the conversation screen.
    for (let i = 0; i < 4 && await page.evaluate(() => document.querySelector('main').classList.contains('disabled')); i++) {
        await moveUntil((x) => /Close|Not now|Start/.test(x.text), 6);
        await choose();
        await pace(800);
    }
    check(!(await page.evaluate(() => document.querySelector('main').classList.contains('disabled'))), 'switch 2 pressed Start');

    // ---- The conversation screen: straight into the Express Panel's first row.
    h = await hl();
    check(/ep-row/.test(h.cls), 'the scan starts on an Express Panel row');
    await choose();
    h = await hl();
    check(/ep-btn/.test(h.cls), 'choosing the row goes to its first button');
    const phrase = h.text;
    const spokenBefore = await page.evaluate(() => window.__spoken.length);
    await choose();
    await pace(400);
    const spoken = await page.evaluate((n) => window.__spoken.slice(n), spokenBefore);
    check(spoken.some((t) => t && phrase && t.toLowerCase().includes(phrase.toLowerCase().slice(0, 4))), `choosing a phrase speaks it (${phrase})`);

    // Touch and a stray tap do nothing; the mouse acts as a switch.
    const settingsBox = await page.$eval('#settingsBtn', (b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.touchscreen.tap(settingsBox.x, settingsBox.y);
    await pace(400);
    check(!(await page.$eval('#settingsDialog', (d) => d.open)), 'touching Settings does nothing');
    const beforeMouse = await hl();
    await page.mouse.click(5, 5, { button: 'left' });
    await pace(200);
    const afterMouse = await hl();
    check(JSON.stringify(beforeMouse) !== JSON.stringify(afterMouse), 'the left mouse button moves the highlight like switch 1');

    // ---- Nothing moves: every button's box is the same with the highlight showing.
    const boxes = () => page.$$eval('#epGrid .ep-btn, #listenControls button, #regenerateBtn',
        (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(','); }));
    const withHighlight = await boxes();

    // ---- Options: Listen, the other person speaks, and the options region is highlighted.
    h = await moveUntil((x) => x.id === 'listenControls', 40);
    check(!!h, 'the scan reaches the Command Bar');
    await choose();
    h = await moveUntil((x) => x.id === 'listenBtn', 12);
    // Speaking the first phrase started a conversation, which opens the microphone.
    if (!(await page.evaluate(() => window.__mic.isOn()))) await choose();
    await pace(600);
    check(await page.evaluate(() => window.__mic.isOn()), 'switch 2 pressed Listen and the microphone is on');
    await page.evaluate(() => window.__mic.hear('How was your weekend?'));
    await page.waitForFunction(() => window.__requests >= 1, { timeout: 8000 }).catch(() => {});
    await pace(1500);
    h = await hl();
    check(h.id === 'responseArea', 'new options highlight the whole response options region');
    await choose();
    h = await hl();
    check(/response-card/.test(h.cls), 'choosing the region goes to the first option');
    const optionText = h.text;
    const n0 = await page.evaluate(() => window.__spoken.length);
    await choose();
    await pace(600);
    const said = await page.evaluate((n) => window.__spoken.slice(n), n0);
    check(said.some((t) => /Everyday reply/.test(t || '')), `choosing an option speaks it (${optionText.slice(0, 30)})`);

    // ---- In my own words: typing by switch.
    h = await moveUntil((x) => /ep-imow/.test(x.cls), 60);
    check(!!h, 'the scan reaches In my own words');
    await choose();
    await pace(600);
    check(await page.$eval('#composerOverlay', (c) => !c.hidden), 'choosing it opens In my own words');
    h = await hl();
    check(/kbd-row/.test(h.cls), 'the scan starts on a row of keys');
    async function typeKey(ch) {
        await moveUntil((x) => /kbd-row/.test(x.cls) && x.text.toLowerCase().split(' ').includes(ch), 12);
        await choose();
        await moveUntil((x) => /kbd-key/.test(x.cls) && x.text.toLowerCase() === ch, 14);
        await choose();
    }
    await typeKey('t');
    check((await page.$eval('#composerInput', (f) => f.value)).toLowerCase() === 't', 'a key chosen by switch types its letter');
    h = await hl();
    check(/kbd-key/.test(h.cls) && h.text.toLowerCase() === 't', 'after a key, the highlight stays on it for one stop');
    await move();
    h = await hl();
    check(/kbd-row/.test(h.cls), 'then goes back to the rows');
    await typeKey('h');
    await pace(300);
    const sug = await page.$eval('.kbd-suggest', (k) => ({ word: k.textContent, off: k.disabled }));
    check(!!sug.word && !sug.off, `the suggestion key shows a word (${sug.word})`);
    await moveUntil((x) => /kbd-row/.test(x.cls) && x.text.includes(sug.word), 12);
    await choose();
    await moveUntil((x) => /kbd-suggest/.test(x.cls), 14);
    await choose();
    const typed = await page.$eval('#composerInput', (f) => f.value);
    check(typed.toLowerCase() === sug.word.toLowerCase() + ' ', `the suggestion key finishes the word and adds a space (${JSON.stringify(typed)})`);
    h = await moveUntil((x) => x.leave === 'Leave keyboard', 12);
    check(!!h, 'Leave keyboard is an outline, not a button');
    await choose();
    h = await hl();
    check(h.id === 'composerControls', 'leaving the keyboard goes to Speak, Reframe and Cancel');
    await choose();
    await moveUntil((x) => x.id === 'cancelComposerBtn', 4);
    await choose();
    await pace(500);
    check(await page.$eval('#composerOverlay', (c) => c.hidden), 'Cancel closes In my own words');

    // ---- Settings is scanned.
    await moveUntil((x) => x.id === 'listenControls', 60);
    await choose();
    await moveUntil((x) => x.id === 'settingsBtn', 12);
    await choose();
    await pace(800);
    check(await page.$eval('#settingsDialog', (d) => d.open), 'switch 2 opened Settings');
    h = await hl();
    check(await page.evaluate(() => !!document.querySelector('#settingsDialog .scan-hl')), 'the highlight is inside Settings');
    h = await moveUntil((x) => x.tab === 'switch', 120);
    check(!!h, 'the scan reaches the Switch Access tab');
    await choose();
    await pace(300);
    check(await page.$eval('.settings-tab[data-tab="switch"]', (t) => t.classList.contains('active')), 'choosing the tab opens it');
    check(await page.evaluate(() => { const el = document.querySelector('#settingsDialog .scan-hl'); return !!el && !!el.closest('.tab-panel[data-tab="switch"]'); }),
        'the highlight goes to the tab\'s first section');
    h = await moveUntil((x) => x.id === 'closeSettingsBtn', 80);
    await choose();
    await pace(500);
    check(!(await page.$eval('#settingsDialog', (d) => d.open)), 'switch 2 closed Settings');

    // ---- A second press too soon after the first is ignored (a bouncing switch).
    await page.evaluate(async () => {
        const s = await import('/js/storage.js');
        s.saveSwitchScan({ ...s.loadSwitchScan(), repeatMs: 300 });
        (await import('/js/switch-access.js')).configure();
    });
    const b0 = await hl();
    await page.keyboard.press('Space'); await page.keyboard.press('Space'); await pace(100);
    const b1 = await hl();
    await move(); await pace(400);
    check(JSON.stringify(b0) !== JSON.stringify(b1), 'a press moves the highlight');
    await page.keyboard.press('Space'); await page.keyboard.press('Space'); await pace(100);
    const b2 = await hl();
    await page.keyboard.press('Space'); await pace(100);
    const b3 = await hl();
    check(JSON.stringify(b2) === JSON.stringify(b3), 'a repeated press within 0.3 seconds is ignored');

    // ---- One switch: the highlight moves by itself, and the switch chooses.
    await page.evaluate(async () => {
        const s = await import('/js/storage.js');
        s.saveSwitchCount(1);
        s.saveSwitchScan({ speed: 0.6 });
        (await import('/js/switch-access.js')).configure();
    });
    const a0 = await hl();
    await pace(1500);
    const a1 = await hl();
    check(JSON.stringify(a0) !== JSON.stringify(a1), 'with one switch the highlight moves by itself');
    await page.keyboard.press('Enter');
    await pace(150);
    check(await page.evaluate(async () => (await import('/js/switch-access.js')).switchCount() === 1), 'Enter does nothing with one switch: it is switch 2');
    await page.keyboard.press('Space');
    await pace(150);
    const a2 = await hl();
    check(/scan-hl|scan-held/.test(a2.cls), 'switch 1 chooses with one switch');

    // ---- Nothing moved.
    await page.evaluate(async () => {
        const s = await import('/js/storage.js');
        s.saveSwitchCount(0);
        (await import('/js/switch-access.js')).configure();
    });
    await pace(300);
    const withoutHighlight = await boxes();
    check(JSON.stringify(withHighlight) === JSON.stringify(withoutHighlight), `no button moved or changed size with switch access on (${withHighlight.length} buttons)`);
    check(await page.evaluate(() => !document.querySelector('.scan-hl, .scan-held')), 'turning switch access off removes the highlight');
} finally {
    await browser.close();
    server.kill();
}
console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
