/* The two labeled screenshots the User Manual asks for (Ken's comments 28 and 48):
 *   um-fig1.png  the conversation screen with every region named
 *   um-fig2.png  the Composition Pane, with its parts named
 *
 * ⚠ THESE ARE SCREENSHOTS OF THE REAL APP, NOT DRAWINGS. A hand-drawn diagram of the
 * layout would be wrong within a release and nobody would notice - the whole point of
 * comment 28 is that the manual had the Command Bar in the wrong place. So the app is
 * loaded, driven into the state being illustrated, and photographed.
 *
 * It emits the PNG and a JSON of every labeled element's box in image pixels;
 * label-manual-figures.py draws the callouts from that, so no coordinate is ever
 * typed by hand and the labels cannot drift from the thing they point at.
 *
 * Run: node capture-manual-figures.js   (a local server must be serving app/ on 8000)
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const URL = process.env.APP_URL || 'http://localhost:8000/';
const SCALE = 2;

// The settled region names (Ken, August 26 2026): pane for a region with no grid,
// panel for one with a grid. These are the words the manual uses throughout.
const REGIONS = [
    // 'bl' - the Conversation Log is inset only a few pixels inside this pane, so both
    // badges want the same corner and one of them ends up over the partner's first
    // words. The pane's lower half is empty until the conversation is long.
    ['#transcriptSection', 'Conversation Pane', 'bl'],
    // 'tr' - a turn is a bubble that stops well short of the right edge, so the top
    // right is the one corner of this box that is reliably empty.
    ['#transcriptLog', 'Conversation Log', 'tr'],
    ['#listenControls', 'Command Bar'],
    ['#responsesSection', 'Response Panel'],
    ['#expressPanel', 'Express Panel'],
];
// Speak and Reframe are labeled separately: they are two different actions on the same
// typed words - say it, or hand it to the AI and get fresh suggestions from it - and one
// label across both boxes read as though the pair were a single control.
const COMPOSER = [
    // 'bl' - the placeholder text starts in the top-left corner, so a badge there
    // covers the first word of the very sentence that explains the box.
    ['#composerInput', 'Type what you want to say here', 'bl'],
    ['#speakBtn', 'Speak — say it aloud in your voice'],
    ['#reframeBtn', 'Reframe — get new suggestions built from it'],
    ['#cancelComposerBtn', 'Cancel — close without saying anything'],
    ['#appKeyboard', 'The on-screen keyboard, if you use one'],
];

const boxesOf = (page, pairs) => page.evaluate((pairs, scale) => {
    const out = [];
    for (const [sel, label, corner] of pairs) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        out.push({ label, corner: corner || null,
                   x: r.x * scale, y: r.y * scale, w: r.width * scale, h: r.height * scale });
    }
    return out;
}, pairs, SCALE);

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: SCALE });

    // A side dock, which is what comment 28 asks for ("with side express panel"), and
    // the on-screen keyboard so figure 2 shows what a user of it actually sees.
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
        // ⚠ A KEY MUST BE PRESENT OR THE FIGURE IS OF THE WRONG SCREEN. Start walks a
        // chain of pre-start notices (what's new, the listening notice, the API-key
        // notice) and stops on the first one that applies; the first attempt captured
        // the key notice sitting over the Conversation Log with the app never started.
        // The key is never used - nothing here calls the AI.
        localStorage.setItem('aac_settings', JSON.stringify({
            keyboardMode: 'onscreen', keyboardDock: 'side', sideDockPosition: 'right',
            sideLayout: 'S9', lastSeenVersion: '99.0.0',
            apiKey: 'sk-ant-figures-only-never-sent-0000000000000000000000',
        }));
    });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#startBtn');
    await page.click('#startBtn');
    await new Promise(r => setTimeout(r, 1200));
    // Refuse rather than photograph a half-started app: the pre-start block carries the
    // version stamp and the Start button, and its presence means a notice intervened.
    const started = await page.evaluate(() => {
        const b = document.getElementById('startBlock');
        return !b || b.hidden || b.offsetParent === null;
    });
    if (!started) { console.error('REFUSING - the app did not get past the start screen'); await browser.close(); process.exit(1); }

    // Seed a conversation so the Conversation Log and the Response Panel are showing
    // real content. Driven through the app's own renderers rather than by writing
    // markup, so the figure cannot show a layout the app would not produce.
    await page.evaluate(async () => {
        const ui = await import('/js/ui.js');
        ui.renderConversation([
            { role: 'partner', text: 'Hi! I haven\u2019t seen you in ages. How have you been?' },
            { role: 'user', text: 'Really good, thanks. Busy but good.' },
            { role: 'partner', text: 'Are you still doing the Thursday class?' },
        ]);
        ui.showResponses([
            { slot: 'PREFERRED', text: 'Yes, every week \u2014 I really look forward to it.', hint: 'Still going' },
            { slot: 'DISPREFERRED', text: 'I had to stop for a while, unfortunately.', hint: 'Had to stop' },
            { slot: 'INITIATIVE', text: 'I am. Do you want to come along sometime?', hint: 'Invite them' },
            { slot: 'REPAIR', text: 'Sorry, which class do you mean?', hint: 'Which class?' },
        ], () => {});
    });
    // ⚠ WAIT OUT THE CARD CROSSFADE. showResponses fades its contents in on every
    // render, so a screenshot taken too early catches the cards part-way and they look
    // greyed out - which in this app means disabled, the opposite of what the figure
    // is showing. Waiting on the animation itself rather than on a guessed delay.
    await page.evaluate(() => Promise.all(
        [...document.querySelectorAll('#responseOptions *')]
            .flatMap((el) => el.getAnimations ? el.getAnimations() : [])
            .map((a) => a.finished.catch(() => {}))));
    await new Promise(r => setTimeout(r, 400));

    const shot1 = path.join(__dirname, 'um-fig1.png');
    await page.screenshot({ path: shot1 });
    const boxes1 = await boxesOf(page, REGIONS);

    // Figure 2 — the Composition Pane, opened the way a user opens it.
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll('#expressPanel button')]
            .find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('own words'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 700));
    const open = await page.evaluate(() => !document.getElementById('composerOverlay').hidden);
    if (!open) { console.error('REFUSING - the Composition Pane did not open'); await browser.close(); process.exit(1); }
    await page.evaluate(() => document.getElementById('composerInput').focus());
    await new Promise(r => setTimeout(r, 600));

    const shot2 = path.join(__dirname, 'um-fig2.png');
    await page.screenshot({ path: shot2 });
    const boxes2 = await boxesOf(page, COMPOSER);

    for (const [name, boxes, want] of [['um-fig1', boxes1, REGIONS], ['um-fig2', boxes2, COMPOSER]]) {
        if (boxes.length !== want.length) {
            console.error(`REFUSING - ${name}: found ${boxes.length} of ${want.length} labeled elements`);
            await browser.close(); process.exit(1);
        }
    }
    fs.writeFileSync(path.join(__dirname, 'um-figures.json'),
        JSON.stringify({ scale: SCALE, fig1: boxes1, fig2: boxes2 }, null, 1));
    console.log(`um-fig1.png (${boxes1.length} regions), um-fig2.png (${boxes2.length} parts)`);
    await browser.close();
})();
