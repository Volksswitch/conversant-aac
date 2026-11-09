// Question sessions in the REAL app, in a real browser (November 9 2026).
//
// app.js cannot be loaded by a unit test, so this drives the whole path the user takes:
// a talk place with a document, the place tapped on the Express Panel, a question heard
// through a stand-in microphone, four answers on screen, one spoken, the answers kept,
// no automatic listening, New 4, Listen clearing them, a second question, and the place
// switched off giving ordinary suggestions again.
//
// No AI key and no microphone are used: the AI service and the speech recognizer are
// stand-ins, and every request the app makes is recorded and checked.
//
// Usage:  node scripts/qa-session-eval/browser-check.mjs
// Exit code 0 when every check passes.

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8124;
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

// Installed before the app loads, on every page load.
function stubs() {
    try { delete Window.prototype.showDirectoryPicker; } catch { /* ignore */ }
    try { delete window.showDirectoryPicker; } catch { /* ignore */ }
    window.__requests = [];
    const realFetch = window.fetch.bind(window);
    window.fetch = async (url, init) => {
        const u = String(url);
        if (u.startsWith('https://api.anthropic.com/v1/messages')) {
            const body = JSON.parse(init.body);
            const system = Array.isArray(body.system) ? body.system.map((b) => b.text).join('\n') : String(body.system);
            const talk = /THE MATERIAL \(chosen by the speaker/.test(system);
            const n = window.__requests.push({ talk, system, messages: body.messages });
            const reply = talk
                ? { unclear_words: [], answers: [
                    { label: `Short ${n}`, kind: 'short', text: `Short answer number ${n}.` },
                    { label: `Angle A ${n}`, kind: 'angle', text: `First deeper answer number ${n}.` },
                    { label: `Angle B ${n}`, kind: 'angle', text: `Second deeper answer number ${n}.` },
                    { label: `Angle C ${n}`, kind: 'angle', text: `Third deeper answer number ${n}.` },
                ] }
                : { partner_action: 'QUESTION', turn_status: 'COMPLETE', is_repair_initiator: false,
                    offered_options: [], offered_range: null, missing_facts: [], missing_other: [], heard_uncertain: [],
                    responses: [
                        { slot: 'PREFERRED', text: 'Everyday reply.', hint: 'Everyday' },
                        { slot: 'DISPREFERRED', text: 'I would rather not.', hint: 'Decline' },
                        { slot: 'INITIATIVE', text: 'How about you?', hint: 'Ask back' },
                        { slot: 'REPAIR', text: 'Sorry?', hint: 'Sorry?' },
                    ] };
            return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(reply) }],
                stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }),
                { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (u.startsWith('https://')) {
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return realFetch(url, init);
    };
    window.__spoken = [];
    if (window.speechSynthesis) {
        window.speechSynthesis.speak = (utt) => {
            window.__spoken.push(utt.text);
            setTimeout(() => utt.onstart?.(new Event('start')), 20);
            setTimeout(() => utt.onend?.(new Event('end')), 200);
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

    // 1. Set up: a key, auto-resume ON (to prove a talk overrides it), a document, a
    //    talk place pointing at it, and the place's button on the Express Panel.
    await page.goto(URL, { waitUntil: 'load' });
    const placeId = await page.evaluate(async () => {
        const storage = await import('/js/storage.js');
        storage.saveApiKey('sk-ant-test-0000000000000000000000000000000000000000');
        storage.saveAutoRelisten(true);
        await storage.restoreDataFolder();
        const src = await import('/js/source-material.js');
        const doc = await src.addSource({ title: 'Test paper', text: 'People get uneasy after four seconds of silence. MATERIAL-SENTINEL' });
        const places = await import('/js/places.js');
        await places.load();
        const id = await places.addPlace({ name: 'At my talk',
            talk: { on: true, sources: [doc.id], note: 'NOTE-SENTINEL I lead the project.', audienceId: null } });
        const ep = await import('/js/express-panel.js');
        const m = ep.getModel();
        ep.setBand('context', [...m.context, { type: 'place', name: 'At my talk', placeId: id }]);
        return id;
    });
    check(!!placeId, 'set up a talk place with one document');
    await page.reload({ waitUntil: 'load' });

    // 2. Start, tap the place.
    await page.click('#startBtn');
    await pace(1500);
    const place = await page.waitForSelector('#expressPanel .ep-btn::-p-text(At my talk)', { timeout: 5000 });
    await place.click();
    await pace(300);
    check(await page.$eval('#expressPanel .ep-btn::-p-text(At my talk)', (b) => (b.closest('.ep-btn') || b).getAttribute('aria-pressed') === 'true'),
        'the talk place is switched on');

    const cards = () => page.$$eval('#responseOptions .response-card:not(.response-card-empty)',
        (cs) => cs.map((c) => ({ cls: c.className, label: c.getAttribute('aria-label') || c.textContent.trim() })));
    const requests = () => page.evaluate(() => window.__requests.map((r) => ({ talk: r.talk, system: r.system, messages: r.messages })));

    // 3. Listen, hear a question.
    await page.click('#listenBtn');
    await pace(800);
    check(await page.evaluate(() => window.__mic.isOn()), 'Listen opens the microphone');
    await page.evaluate(() => window.__mic.hear('How does the device know what to suggest?'));
    await page.waitForFunction(() => window.__requests.length >= 1, { timeout: 8000 });
    await pace(800);
    let reqs = await requests();
    check(reqs[0].talk, 'the question is sent as a talk question, with the documents');
    check(/MATERIAL-SENTINEL/.test(reqs[0].system) && /NOTE-SENTINEL/.test(reqs[0].system), 'the request carries the document and the note');
    check(/How does the device know/.test(JSON.stringify(reqs[0].messages)), 'the request carries the question');
    let shown = await cards();
    check(shown.length === 4, `four answers on screen (saw ${shown.length})`);
    check(/slot-preferred/.test(shown[0]?.cls) && shown.slice(1).every((c) => /slot-initiative/.test(c.cls)),
        'the short answer is first and green, the deeper three blue');

    // 4. Speak the short answer: the answers stay, listening does not restart.
    await page.click('#responseOptions .response-card:not(.response-card-empty)');
    await pace(1500);
    const spoken = await page.evaluate(() => window.__spoken);
    check(spoken.some((t) => /Short answer number 1/.test(t)), 'the short answer is spoken');
    shown = await cards();
    check(shown.length === 4, `the four answers stay on screen after one is spoken (saw ${shown.length})`);
    await pace(1500);
    check(!(await page.evaluate(() => window.__mic.isOn())), 'listening does not restart by itself, though auto-resume is on');

    // 5. A second, deeper answer, then New 4.
    const all = await page.$$('#responseOptions .response-card:not(.response-card-empty)');
    await all[1].click();
    await pace(1200);
    check((await page.evaluate(() => window.__spoken)).some((t) => /First deeper answer number 1/.test(t)), 'a second answer can be spoken');
    await page.click('#regenerateBtn');
    await page.waitForFunction(() => window.__requests.length >= 2, { timeout: 8000 });
    await pace(800);
    reqs = await requests();
    check(reqs[1].talk && /different answers/.test(reqs[1].system), 'New 4 asks again for different answers');
    check(/How does the device know/.test(JSON.stringify(reqs[1].messages)), 'New 4 answers the same question');
    check(/Short answer number 1/.test(reqs[1].system) && /First deeper answer number 1/.test(reqs[1].system),
        'what has been said is passed on, so it is not repeated');
    shown = await cards();
    check(shown.length === 4 && /2/.test(shown[0].label), 'New 4 replaces the answers');

    // 5b. Saying something else at a talk (an Express phrase) does not restart listening
    //     either, though auto-resume is on. This is the path the auto-resume rule guards.
    const yes = await page.$('#expressPanel .ep-btn::-p-text(Yes)');
    if (yes) {
        await yes.click();
        await pace(2000);
        check((await page.evaluate(() => window.__spoken)).includes('Yes'), 'an Express phrase is spoken at a talk');
        check(!(await page.evaluate(() => window.__mic.isOn())), 'and listening does not restart by itself after it');
    } else {
        check(false, 'found the Yes button on the Express Panel');
    }

    // 6. Listen clears them; the next question gets new answers.
    await page.click('#listenBtn');
    await pace(800);
    shown = await cards();
    check(shown.length === 0, `tapping Listen clears the answers (saw ${shown.length})`);
    await page.evaluate(() => window.__mic.hear('Does this only work for people who can read?'));
    await page.waitForFunction(() => window.__requests.length >= 3, { timeout: 8000 });
    await pace(800);
    reqs = await requests();
    check(reqs[2].talk && /only work for people who can read/.test(JSON.stringify(reqs[2].messages)), 'the next question is answered as a talk question');
    check(/How does the device know/.test(reqs[2].system), 'the earlier question is listed as already answered');
    check((await cards()).length === 4, 'four answers for the next question');

    // 7. Switch the place off: ordinary suggestions again.
    await page.click('#responseOptions .response-card:not(.response-card-empty)');
    await pace(1200);
    await page.click('#expressPanel .ep-btn::-p-text(At my talk)');
    await pace(300);
    await page.click('#listenBtn');
    await pace(800);
    await page.evaluate(() => window.__mic.hear('How was your weekend?'));
    await page.waitForFunction(() => window.__requests.length >= 4, { timeout: 8000 });
    await pace(800);
    reqs = await requests();
    check(!reqs[3].talk, 'with the place off, the question gets ordinary suggestions');
    shown = await cards();
    check(shown.some((c) => /Everyday reply/.test(c.label)), 'the ordinary cards are on screen');
} finally {
    await browser.close();
    server.kill();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
