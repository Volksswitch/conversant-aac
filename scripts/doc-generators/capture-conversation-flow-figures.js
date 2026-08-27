/* Renders the four Express Panel figures from "Conversation Flow Figures.html" to PNGs
 * (cf-fig1..4.png) for the design document. Re-run after editing that file.
 *
 * The figures are drawn BLIND — nobody looks at the PNG before it is embedded — so
 * this refuses to finish if a figure box scrolls, which is the symptom of text that
 * has outgrown its container. See the doc-sync note on figure generation.
 *
 * Run: node capture-express-panel-figures.js
 */
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1060, height: 1600, deviceScaleFactor: 2 });
    const html = path.resolve(__dirname, 'Conversation Flow Figures.html');
    await page.goto('file:///' + html.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

    const overflow = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('.fig, .box, .side, .loop, .lab, .seg')) {
            if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
                bad.push((el.className || '?') + ': ' + (el.textContent || '').trim().slice(0, 40));
            }
        }
        return bad;
    });
    if (overflow.length) {
        console.error('REFUSING — content overflows its box:\n  ' + overflow.join('\n  '));
        await browser.close();
        process.exit(1);
    }

    for (let i = 1; i <= 2; i++) {
        const el = await page.$('#f' + i);
        if (!el) { console.error('missing #f' + i); continue; }
        const out = path.join(__dirname, `cf-fig${i}.png`);
        await el.screenshot({ path: out });
        const box = await el.boundingBox();
        console.log(`cf-fig${i}.png  ${Math.round(box.width)}x${Math.round(box.height)} css px`);
    }
    await browser.close();
})();
