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
    // A touch screen, so a tap is a real tap (a tablet is where touch is blocked).
    await page.setViewport({ width: 1280, height: 800, hasTouch: true });
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

    // ---- The first launch asks touch or switches. The question is hidden from real
    // users until switch access is offered (Ken, November 21 2026); "?ask-access"
    // brings it back for this check.
    await page.goto(URL + '?ask-access', { waitUntil: 'load' });
    await pace(500);
    check(!!(await page.$('#firstLaunchChoice')), 'the first launch asks touch or switches');
    check(await page.$eval('#startBtn', (b) => b.hidden), 'the Start button waits for the answer');
    check((await hl()).text === 'Direct select', 'the highlight starts on Direct select');
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
    // "Switches not working?" is there for a helper's touch, and the scan passes it by,
    // so a stray switch press cannot turn the switches off (Ken, November 21 2026).
    const startStops = new Set();
    for (let i = 0; i < 4; i++) { startStops.add((await hl()).id); await move(); }
    check(await page.$eval('#switchOffBtn', (b) => !b.hidden) && startStops.has('startBtn')
        && startStops.has('startReportBtn') && !startStops.has('switchOffBtn'),
        'the start screen shows "Switches not working?", and the scan passes it by');

    // ---- The report link takes touch (Ken, November 21 2026). The scan presses above
    // are in the report.
    await moveUntil((x) => x.id === 'startBtn', 6);
    const linkBox = await page.$eval('#startReportBtn', (b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.touchscreen.tap(linkBox.x, linkBox.y);
    const reportDialog = () => page.evaluate(() => {
        const d = [...document.querySelectorAll('dialog[open]')].find((x) => /Send this report/.test(x.textContent));
        if (!d) return null;
        const pre = d.querySelector('.danger-preview');
        const no = [...d.querySelectorAll('button')].find((b) => /Not now/.test(b.textContent));
        const r = no ? no.getBoundingClientRect() : null;
        return { text: pre ? pre.value : '', no: r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null };
    });
    let rd = null;
    for (let i = 0; i < 60 && !rd; i++) { await pace(250); rd = await reportDialog(); }
    check(!!rd, 'touching the report link starts a report while switch access is on');
    check(!!rd && /SWITCH PRESSES/.test(rd.text) && /press {2}key Space {2}switch 1 {2}-> moved to/.test(rd.text),
        'the report lists the switch presses and what each one did');
    if (rd && rd.no) await page.touchscreen.tap(rd.no.x, rd.no.y);
    await pace(600);
    check(!(await reportDialog()) && await page.evaluate(() => document.querySelector('main').classList.contains('disabled')),
        'touching "Not now" on the report card closes it, and Start is still untouched');
    await moveUntil((x) => x.id === 'startBtn', 6);
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

    // Touch works alongside the switches until switch access is finished (Ken, November 21
    // 2026); the mouse acts as a switch.
    const tapEl = async (p, sel) => {
        const b = await p.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        await p.touchscreen.tap(b.x, b.y);
    };
    await tapEl(page, '#settingsBtn');
    await pace(600);
    const settingsByTouch = await page.$eval('#settingsDialog', (d) => d.open);
    if (settingsByTouch) { await tapEl(page, '#closeSettingsBtn'); await pace(600); }
    check(settingsByTouch && !(await page.$eval('#settingsDialog', (d) => d.open)),
        'touching Settings opens it and touching its close button closes it, with switch access on');
    const beforeMouse = await hl();
    await page.mouse.click(5, 5, { button: 'left' });
    await pace(200);
    const afterMouse = await hl();
    check(JSON.stringify(beforeMouse) !== JSON.stringify(afterMouse), 'the left mouse button moves the highlight like switch 1');

    // ---- Nothing moves: every button's box is the same with the highlight showing.
    const boxes = () => page.$$eval('#epGrid .ep-btn, #listenControls button, #regenerateBtn',
        (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(','); }));
    const withHighlight = await boxes();

    // ---- Holding a switch, and a release that never arrives (Ken, November 21 2026: on
    // his Android tablet the switches went dead after switch 1 was held down).
    const report = () => page.evaluate(async () => (await import('/js/switch-access.js')).describeForReport());
    const key = (code, opts = {}) => page.evaluate((c, o) => window.dispatchEvent(new KeyboardEvent(o.up ? 'keyup' : 'keydown',
        { code: c, key: c === 'Space' ? ' ' : c, repeat: !!o.repeat, bubbles: true, cancelable: true })), code, opts);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    // Held, with the key repeating as a keyboard's does: the highlight races, and stops
    // when the switch comes up.
    await moveUntil((x) => /ep-row/.test(x.cls), 40);
    const raced = new Set();
    await page.keyboard.down('Space');
    for (let i = 0; i < 40; i++) { await page.keyboard.down('Space'); raced.add(JSON.stringify(await hl())); await pace(50); }
    await page.keyboard.up('Space');
    await pace(300);
    let h1 = await hl(); await pace(1000); let h2 = await hl();
    check(raced.size >= 3 && same(h1, h2), `holding switch 1 races through the stops and letting go stops it (${raced.size} stops)`);
    // Pressed again with the release missing: the old press is let go and the new one
    // counts. On the row that starts with "Yes", so the second press speaks.
    await moveUntil((x) => /ep-row/.test(x.cls) && /^Yes/.test(x.text), 40);
    await key('Enter');
    await pace(900);                          // longer than a key's wait before it repeats
    const inRow = await hl();
    const spokenAt = await page.evaluate(() => window.__spoken.length);
    await key('Enter');                       // no key-up came in between
    await pace(500);
    let rep = await report();
    check(/ep-btn/.test(inRow.cls) && rep.includes('pressed again with no release in between')
        && await page.evaluate((n) => window.__spoken.length > n, spokenAt),
        'switch 2 pressed again with its release missing still works');
    await key('Enter', { up: true });
    await pace(300);
    // A held key that stops repeating with no release after it: let go, and the race stops.
    await key('Space');
    for (let i = 0; i < 12; i++) { await key('Space', { repeat: true }); await pace(50); }
    await pace(2200);
    h1 = await hl(); await pace(900); h2 = await hl();
    rep = await report();
    check(rep.includes('the key stopped repeating') && /Held down now: none/.test(rep) && same(h1, h2),
        'a held key that stops repeating with no release is let go, and its race stops');
    // Held while the app loses focus: let go, and the race stops.
    await key('Space');
    await pace(1000);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await pace(200);
    h1 = await hl(); await pace(1000); h2 = await hl();
    rep = await report();
    check(rep.includes('the app lost focus') && /Held down now: none/.test(rep) && same(h1, h2),
        'a switch held while the app loses focus is let go, and its race stops');
    await key('Space', { up: true });   // the late release does nothing
    await pace(200);

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
    check(await page.evaluate(() => {
        const box = document.querySelector('.scan-region.scan-region-strong');
        if (!box || box.hidden) return false;
        const a = box.getBoundingClientRect(), b = document.getElementById('responseArea').getBoundingClientRect();
        return Math.abs(a.left - b.left) < 2 && Math.abs(a.width - b.width) < 2 && getComputedStyle(box).zIndex > 1000;
    }), 'the highlight on the options region is drawn over the cards, not under them');
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
    check(await page.evaluate(() => {
        const a = document.activeElement;
        return !a || a === document.body || !a.matches(':focus-visible') || getComputedStyle(a).outlineStyle === 'none'
            || a.classList.contains('scan-hl');
    }), 'no browser focus ring is left on the Settings button');

    // ---- A goodbye moves the highlight to Listen, so listening can be turned off.
    await moveUntil((x) => x.id === 'listenControls', 60);
    await choose();
    await moveUntil((x) => x.id === 'windDownBtn', 12);
    await choose();
    await pace(600);
    h = await moveUntil((x) => x.id === 'responseArea', 40);
    await choose();
    await choose();                          // speak the first wind-down
    await pace(900);
    h = await moveUntil((x) => x.id === 'responseArea', 40);
    await choose();
    h = await hl();
    const bye = h.text;
    await choose();                          // speak a goodbye
    await pace(1200);
    h = await hl();
    check(h.id === 'listenBtn', `after a goodbye the highlight is on Listen (${bye.slice(0, 20)})`);

    // ---- End conversation: two presses, a natural pace apart, end it.
    await page.evaluate(() => window.__mic.hear('Is anyone there?'));
    await pace(1500);
    await moveUntil((x) => x.id === 'listenControls', 60);
    await choose();
    await moveUntil((x) => x.id === 'endConversationBtn', 12);
    await page.keyboard.press('Enter');
    await pace(900);                         // slower than the 0.4 s touch window
    check(/scan-held/.test((await hl()).cls), 'End conversation waits for a second press');
    check(await page.evaluate(() => { const t = document.getElementById('pressAgainTag');
        return !!t && !t.hidden && t.textContent === 'Press again'; }), 'the button waiting for a second press says "Press again"');
    await page.keyboard.press('Enter');
    await pace(800);
    check(await page.evaluate(() => !document.querySelector('#transcriptLog').textContent.trim()
        && !document.querySelector('#responseOptions .response-card:not(.response-card-empty)')
        && !window.__mic.isOn()), 'the second press ends the conversation: transcript, options and microphone cleared');

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

    // ---- Direct select, "One tap": End conversation still takes a second tap.
    await page.evaluate(async () => { (await import('/js/storage.js')).saveExpressTapMode('single'); });
    if (!(await page.evaluate(() => window.__mic.isOn()))) await page.click('#listenBtn');
    await pace(600);
    const micBefore = await page.evaluate(() => window.__mic.isOn());
    await page.click('#endConversationBtn');
    await pace(900);
    check(micBefore && await page.evaluate(() => window.__mic.isOn()
        && !document.getElementById('pressAgainTag').hidden),
        'with one tap chosen, a first tap on End conversation only shows "Press again"');
    await page.click('#endConversationBtn');
    await pace(800);
    check(await page.evaluate(() => !window.__mic.isOn() && document.getElementById('pressAgainTag').hidden),
        'a second tap within 2 seconds ends the conversation');
    await page.click('#listenBtn');
    await pace(400);
    check(await page.evaluate(() => window.__mic.isOn() && document.getElementById('pressAgainTag').hidden),
        'Listen still takes one tap');

    // ---- A device question the switches cannot answer (Ken, November 15 2026). The
    // microphone has not been allowed yet, so Listen warns first and asks for a helper.
    await page.evaluate(async () => {
        const s = await import('/js/storage.js');
        s.saveSwitchCount(2);
        s.saveSwitchScan({ ...s.loadSwitchScan(), repeatMs: 0 });
    });
    await page.close();   // the app refuses a second open copy (SEC-9)
    const p2 = await browser.newPage();
    await p2.setViewport({ width: 1280, height: 800 });
    await p2.evaluateOnNewDocument(stubs);
    await p2.evaluateOnNewDocument(() => {
        navigator.permissions.query = async (d) => (d && d.name === 'microphone'
            ? { state: 'prompt', onchange: null } : { state: 'granted', onchange: null });
    });
    p2.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failures++; });
    await p2.goto(URL, { waitUntil: 'load' });
    await pace(600);
    const hl2 = () => p2.evaluate(() => {
        const el = document.querySelector('.scan-held') || document.querySelector('.scan-hl');
        return { id: el ? el.id : null, text: el ? (el.getAttribute('aria-label') || el.textContent || '').trim() : '' };
    });
    const move2 = async () => { await p2.keyboard.press('Space'); await pace(80); };
    const choose2 = async () => { await p2.keyboard.press('Enter'); await pace(300); };
    async function until2(pred, max = 60) {
        for (let i = 0; i < max; i++) { const x = await hl2(); if (pred(x)) return x; await move2(); }
        return null;
    }
    check(await p2.$eval('#helperNote', (n) => n.hidden), 'with no data folder, the start screen has no folder warning');
    await until2((x) => x.id === 'startBtn', 6);
    await choose2();
    await pace(1200);
    await until2((x) => x.id === 'listenControls', 40);
    await choose2();
    await until2((x) => x.id === 'listenBtn', 12);
    await choose2();
    await pace(300);
    const card = await p2.evaluate(() => {
        const d = [...document.querySelectorAll('dialog[open]')].find((x) => /microphone question/.test(x.textContent));
        return d ? d.textContent : '';
    });
    check(/helper/.test(card) && !(await p2.evaluate(() => window.__mic.isOn())),
        'Listen first warns that a helper must answer the microphone question');
    const onCard = await until2((x) => x.text === 'Start listening', 10);
    check(!!onCard, 'the switch scan reaches the warning');
    await choose2();
    await pace(500);
    check(await p2.evaluate(() => window.__mic.isOn()), 'choosing Start listening opens the microphone');
    await until2((x) => x.id === 'listenBtn', 40);
    await choose2();   // off
    await pace(300);
    await choose2();   // on again: warned once a session, so no second warning
    await pace(500);
    check(await p2.evaluate(() => window.__mic.isOn() && !document.querySelector('dialog[open]')),
        'the warning is given once a session');

    // ---- Touch blocking, as it returns once switch access is finished ("?block-touch";
    // Ken, November 21 2026). What still takes touch then is the way out: the report link,
    // "Switches not working?" and the cards they open. Switch access is still on, two
    // switches, from the setup above.
    await p2.close();
    const p3 = await browser.newPage();
    await p3.setViewport({ width: 1280, height: 800, hasTouch: true });
    await p3.evaluateOnNewDocument(stubs);
    p3.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); failures++; });
    await p3.goto(URL + '?block-touch', { waitUntil: 'load' });
    await pace(700);
    const onStart = () => p3.evaluate(() => document.querySelector('main').classList.contains('disabled'));
    const openCard = (re) => p3.evaluate((src) => {
        const d = [...document.querySelectorAll('dialog[open]')].find((x) => new RegExp(src).test(x.textContent));
        return d ? [...d.querySelectorAll('button')].map((b) => b.textContent.trim()) : null;
    }, re);
    const tapCardButton = async (label) => {
        const b = await p3.evaluate((l) => {
            const btn = [...document.querySelectorAll('dialog[open] button')].find((x) => x.textContent.trim() === l);
            if (!btn) return null;
            const r = btn.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, label);
        if (b) await p3.touchscreen.tap(b.x, b.y);
        return !!b;
    };
    await tapEl(p3, '#startBtn');
    await pace(500);
    const touchNote = await p3.evaluate(() => { const n = document.getElementById('touchOffNote'); return n && !n.hidden ? n.textContent : ''; });
    check(await onStart() && /^Touch is off while switch access is on/.test(touchNote),
        'with touch blocking on, touching Start does nothing and a note says touch is off');
    await tapEl(p3, '#startReportBtn');
    let cardButtons = null;
    for (let i = 0; i < 60 && !cardButtons; i++) { await pace(250); cardButtons = await openCard('Send this report'); }
    check(!!cardButtons, 'the report link still takes touch');
    check(cardButtons && await tapCardButton('Not now') && (await pace(500), !(await openCard('Send this report'))),
        'and so does the card it opens');
    await tapEl(p3, '#switchOffBtn');
    await pace(500);
    cardButtons = await openCard('Turn switch access off');
    check(!!cardButtons && cardButtons.includes('Turn it off') && cardButtons.includes('Keep it on'),
        'touching "Switches not working?" asks before turning switch access off');
    await tapCardButton('Turn it off');
    await pace(600);
    check(await p3.evaluate(async () => (await import('/js/storage.js')).loadSwitchCount() === 0
        && !document.body.classList.contains('switch-access-on')
        && !document.querySelector('.scan-hl, .scan-held')
        && document.getElementById('switchOffBtn').hidden),
        'confirming turns switch access off: no highlight, and the link is gone');
    await tapEl(p3, '#startBtn');
    await pace(1500);
    for (let i = 0; i < 4 && await onStart(); i++) {
        const any = await p3.evaluate(() => {
            const b = [...document.querySelectorAll('#startBlock button')].find((x) => x.offsetParent !== null && /Close|Not now/.test(x.textContent));
            return b ? b.id || b.textContent : null;
        });
        if (!any) break;
        const sel = await p3.evaluate((t) => {
            const b = [...document.querySelectorAll('#startBlock button')].find((x) => (x.id || x.textContent) === t);
            b.setAttribute('data-tap-me', '1');
            return '[data-tap-me="1"]';
        }, any);
        await tapEl(p3, sel);
        await p3.evaluate(() => document.querySelectorAll('[data-tap-me]').forEach((x) => x.removeAttribute('data-tap-me')));
        await pace(800);
    }
    check(!(await onStart()), 'after that, touching Start starts the app');

    // ---- The Switch Access tab: "Use switches" is separate from the number of switches,
    // and a switch is set by pressing it (Ken, November 22 2026). Switch access is off
    // here, turned off above with the number left at two.
    const tab = () => p3.evaluate(async () => {
        const sa = await import('/js/switch-access.js');
        const $ = (id) => document.getElementById(id);
        return { onBox: $('switchOnInput').checked, onDisabled: $('switchOnInput').disabled,
            countDisabled: $('switchCountInput').disabled, countValue: $('switchCountInput').value,
            k1: $('switchKeys1').textContent, k2: $('switchKeys2').textContent, k3: $('switchKeys3').textContent,
            last: $('switchLastPress').textContent, on: sa.isOn(), count: sa.switchCount() };
    });
    // The tab's controls are wired when Settings opens.
    for (let i = 0; i < 2 && !(await p3.$eval('#settingsDialog', (d) => d.open)); i++) { await tapEl(p3, '#settingsBtn'); await pace(600); }
    check(await p3.$eval('#settingsDialog', (d) => d.open), 'Settings opens by touch with switch access off');
    let t = await tab();
    check(!t.onBox && !t.onDisabled && !t.countDisabled && t.countValue === '2'
        && await p3.$eval('#switchKeySet1', (b) => !b.disabled) && await p3.$eval('#switchSpeedInput', (b) => b.disabled),
        'with switch access off, "Use switches", the number (two) and the Set buttons are usable; the scan settings are grayed out');
    // Setting up a switch while switch access is off (Ken, November 22 2026).
    await p3.evaluate(() => document.querySelector('.settings-tab[data-tab="switch"]').click());
    await pace(200);
    // Unchecking "Mouse buttons also act as switches" drops the mouse buttons from the
    // switch list at once, and checking it puts them back.
    const toggleMouse = (on) => p3.evaluate((v) => { const b = document.getElementById('mouseSwitchesInput'); b.checked = v; b.dispatchEvent(new Event('change')); }, on);
    await toggleMouse(false);
    await pace(100);
    t = await tab();
    check(!/mouse button/.test(t.k1 + t.k2 + t.k3), `unchecking the mouse box drops the mouse buttons from the list at once (${t.k1} | ${t.k2} | ${t.k3})`);
    await toggleMouse(true);
    await pace(100);
    t = await tab();
    check(/left mouse button/.test(t.k1) && /right mouse button/.test(t.k2), `checking it puts them back (${t.k1} | ${t.k2})`);
    await p3.evaluate(() => document.getElementById('switchKeySet2').onclick());
    await pace(100);
    const primed = await p3.evaluate(() => {
        const tag = document.getElementById('switchSetTag');
        return { tag: tag && !tag.hidden ? tag.textContent : null,
            cls: document.getElementById('switchKeySet2').classList.contains('switch-set-primed') };
    });
    check(primed.tag === 'Press switch 2' && primed.cls, `a primed "Set" button shows as selected and says "Press switch 2" (${JSON.stringify(primed)})`);
    await p3.keyboard.press('KeyG');
    await pace(200);
    t = await tab();
    check(t.k2.split(', ')[0] === 'G' && !/Enter/.test(t.k2) && !t.on,
        `with switch access off, pressing G after "Set" makes G switch 2, in place of its starting keys (${t.k2})`);
    check(await p3.evaluate(() => document.getElementById('switchSetTag').hidden
        && !document.getElementById('switchKeySet2').classList.contains('switch-set-primed')),
        'once the switch is set, the button is no longer primed and the tag is gone');
    await p3.keyboard.press('KeyG');
    await pace(150);
    t = await tab();
    check(t.last === 'Last press: G: switch 2' && !t.on, `with switch access off, a press still shows what it sends (${t.last})`);
    // The right button's menu and the wheel press are off everywhere except in a text
    // box (Ken, November 22 2026), switch access on or off.
    const mouseDefaults = async (x, y) => {
        await p3.evaluate(() => {
            window.__mouseSeen = {};
            window.__mouseRec = (e) => { window.__mouseSeen[e.type + e.button] = e.defaultPrevented; };
            for (const t of ['contextmenu', 'mousedown']) window.addEventListener(t, window.__mouseRec);
        });
        await p3.mouse.move(x, y);
        await p3.mouse.click(x, y, { button: 'right' });
        await p3.mouse.down({ button: 'middle' }); await p3.mouse.up({ button: 'middle' });
        await pace(150);
        return p3.evaluate(() => {
            for (const t of ['contextmenu', 'mousedown']) window.removeEventListener(t, window.__mouseRec);
            return { menu: window.__mouseSeen.contextmenu2, wheel: window.__mouseSeen.mousedown1 };
        });
    };
    let md = await mouseDefaults(640, 300);
    check(md.menu === true && md.wheel === true, `on the Switch Access tab, the right button's menu and the wheel press are cancelled (${JSON.stringify(md)})`);
    await p3.evaluate(() => document.querySelector('.settings-tab[data-tab="general"]').click());
    await pace(200);
    md = await mouseDefaults(640, 300);
    check(md.menu === true && md.wheel === true, `on another tab they are cancelled too (${JSON.stringify(md)})`);
    await p3.evaluate(() => {
        const box = document.createElement('textarea');
        box.id = '__testBox';
        Object.assign(box.style, { position: 'fixed', left: '20px', top: '20px', width: '200px', height: '80px', zIndex: 99999 });
        (document.querySelector('dialog[open]') || document.body).appendChild(box);
    });
    md = await mouseDefaults(100, 60);
    await p3.evaluate(() => document.getElementById('__testBox').remove());
    check(md.menu === false && md.wheel === false, `in a text box they still work (${JSON.stringify(md)})`);
    await p3.evaluate(() => document.querySelector('.settings-tab[data-tab="switch"]').click());
    await pace(200);
    await p3.evaluate(() => document.getElementById('switchKeyReset').onclick());
    await p3.evaluate(() => { const b = document.getElementById('switchOnInput'); b.checked = true; b.dispatchEvent(new Event('change')); });
    await pace(300);
    t = await tab();
    check(t.on && t.count === 2 && !t.countDisabled, 'checking "Use switches" turns switch access back on with two switches');
    await p3.evaluate(() => document.getElementById('switchKeySet1').onclick());
    await p3.keyboard.press('KeyF');
    await pace(200);
    t = await tab();
    check(t.k1.split(', ').includes('F') &&/F: set/.test(t.last), `pressing F after "Set" makes F switch 1, and the line says so (${t.k1})`);
    await p3.keyboard.press('KeyF');
    await pace(150);
    t = await tab();
    check(t.last === 'Last press: F: switch 1', `pressing it again shows what it sends and which switch it is (${t.last})`);
    await p3.keyboard.press('KeyQ');
    await pace(150);
    t = await tab();
    check(t.last === 'Last press: Q: not one of your switches', `a key that is not a switch is named as one (${t.last})`);
    await p3.evaluate(() => document.getElementById('switchKeySet3').onclick());
    await p3.mouse.move(5, 5);
    await p3.mouse.down({ button: 'left' });
    await p3.mouse.up({ button: 'left' });
    await pace(200);
    t = await tab();
    check(/left mouse button/.test(t.k3) && !/left mouse button/.test(t.k1),
        `pressing the left mouse button after "Set" makes it switch 3 (switch 1: ${t.k1}; switch 3: ${t.k3})`);
    await p3.evaluate(() => document.getElementById('switchKeyReset').onclick());
    await pace(100);
    t = await tab();
    check(/left mouse button/.test(t.k1) && !/F/.test(t.k1), 'putting back the starting switches forgets the ones set');
    await p3.evaluate(() => { const b = document.getElementById('switchOnInput'); b.checked = false; b.dispatchEvent(new Event('change')); });
    await pace(300);
    t = await tab();
    check(!t.on && !t.onDisabled && t.countValue === '2', 'unchecking turns switch access off and keeps the number');
} finally {
    await browser.close();
    server.kill();
}
console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
