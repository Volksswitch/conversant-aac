/* Renders the conversation-review figures (rv-fig1..8.png) for the review document.
 *
 * ⚠ THEY ARE CAPTURED FROM THE PROTOTYPE ITSELF - prototypes/conversation-review.html -
 * and no longer from a separate drawing. There used to be a "Review Figures.html" beside
 * this script that redrew the same screens by hand, and within a day of the prototype
 * changing the document was illustrated with a design that no longer existed. Two hand
 * drawings of one screen is the same trap as two copies of a document: the second one is
 * always the stale one. Shooting the real page means the figures cannot disagree with
 * what the therapists are looking at, and it deletes a whole file's worth of mock-up.
 *
 * Run: node capture-review-figures.js
 */
const puppeteer = require('puppeteer');
const path = require('path');

const PROTO = path.resolve(__dirname, '..', '..', 'prototypes', 'conversation-review.html');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 2 });

    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('dialog', async d => { await d.dismiss(); });

    await page.goto('file:///' + PROTO.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

    const shots = [];
    async function shot(n, selector, prepare) {
        if (prepare) await prepare();
        const el = await page.$(selector);
        if (!el) { errs.push('missing ' + selector + ' for figure ' + n); return; }
        const out = path.join(__dirname, `rv-fig${n}.png`);
        await el.screenshot({ path: out });
        const box = await el.boundingBox();
        shots.push(`rv-fig${n}.png  ${Math.round(box.width)}x${Math.round(box.height)} css px`);
    }

    // 1  the way in - the list, on its Settings tab
    await shot(1, '.sheet:nth-of-type(2) .device');

    // 2  the review screen at rest, on the conversation layout
    await shot(2, '#turnScreen', async () => {
        await page.evaluate(() => { ed = null; verdicts = {}; turnAt = 1; renderTurn(); });
    });

    // 3  a turn the user spoke from their own panel - no card to mark, so the button is lit
    await shot(3, '#turnScreen', async () => {
        await page.evaluate(() => { ed = null; verdicts = {}; turnAt = 4; renderTurn(); });
    });

    // 4  one answer in two steps - switch a person on, then take a phrase that only
    //    exists because they are on
    await shot(4, '#turnScreen', async () => {
        const tap = t => page.evaluate(x => { document.querySelector('#turnScreen [data-cell="' + x + '"]').click(); }, t);
        await page.evaluate(() => { ed = null; verdicts = {}; undoStacks = {}; turnAt = 1; renderTurn(); });
        await tap('Mom');
        await tap("My back's bad today");
    });

    // 5  a card being rewritten in place, with one word highlighted and the keyboard up
    await shot(5, '#turnScreen', async () => {
        await page.evaluate(() => { ed = null; verdicts = {}; turnAt = 1; renderTurn(); });
        await page.click('#turnScreen .tcards > *:nth-child(2)');
        await page.click('#turnScreen .tbar [data-cmd="wfwd"]');
        await page.click('#turnScreen .tbar [data-cmd="wfwd"]');
        await page.type('#turnScreen #winp', 'difficult');
    });

    // 6  correcting what the app wrote down, on the other person's own line
    await shot(6, '#turnScreen', async () => {
        await page.evaluate(() => { ed = null; verdicts = {}; turnAt = 1; renderTurn(); });
        await page.evaluate(() => { document.querySelector('#turnScreen [data-heard]').click(); });
    });

    // 7  played back at the real speed, with the wait counting up
    await shot(7, '#stage', async () => {
        await page.evaluate(() => { setMode('play'); });
        await page.evaluate(() => { document.getElementById('pPlay').click(); });
        await new Promise(r => setTimeout(r, 400));
        await page.evaluate(() => { playT = 44; });
        await new Promise(r => setTimeout(r, 400));
    });

    // 8  what comes of it - review offers, the user decides
    await shot(8, '.sheet:nth-of-type(5) .device', async () => {
        await page.evaluate(() => { PRACTICE_VIEW = false; renderConf(); });
    });

    // The figures are captured BLIND - nobody looks at the PNG before it is embedded -
    // so a box whose text has outgrown it must stop the run rather than ship.
    const overflow = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('.tablet, .tbar, .tcards, .tcard, .tdock, .dcell, .lrow, .device')
            .forEach(el => {
                if (el.scrollWidth > el.clientWidth + 1) {
                    bad.push((el.className || '?') + ': ' + (el.textContent || '').trim().slice(0, 50));
                }
            });
        return bad;
    });

    await browser.close();

    if (errs.length)     { console.error('REFUSING - the prototype reported errors:\n  ' + errs.join('\n  ')); process.exit(1); }
    if (overflow.length) { console.error('REFUSING - content overflows its box:\n  ' + overflow.join('\n  ')); process.exit(1); }
    console.log(shots.join('\n'));
})();
