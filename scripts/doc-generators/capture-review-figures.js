/* Renders the four conversation-review figures from "Review Figures.html" to PNGs
 * (rv-fig1..4.png) for the review document. Re-run after editing that file.
 *
 * The figures are drawn BLIND - nobody looks at the PNG before it is embedded - so
 * this refuses to finish if a box scrolls, which is the symptom of text that has
 * outgrown its container.
 *
 * Run: node capture-review-figures.js
 */
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1400, deviceScaleFactor: 2 });
    const html = path.resolve(__dirname, 'Review Figures.html');
    await page.goto('file:///' + html.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

    const overflow = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('.fig, .screen, .card, .lrow, .said, .conf, .typebox, .btn, .ev')) {
            if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
                bad.push((el.className || '?') + ': ' + (el.textContent || '').trim().slice(0, 50));
            }
        }
        return bad;
    });
    if (overflow.length) {
        console.error('REFUSING - content overflows its box:\n  ' + overflow.join('\n  '));
        await browser.close();
        process.exit(1);
    }

    for (let i = 1; i <= 4; i++) {
        const el = await page.$('#f' + i);
        if (!el) { console.error('missing #f' + i); continue; }
        const out = path.join(__dirname, `rv-fig${i}.png`);
        await el.screenshot({ path: out });
        const box = await el.boundingBox();
        console.log(`rv-fig${i}.png  ${Math.round(box.width)}x${Math.round(box.height)} css px`);
    }
    await browser.close();
})();
