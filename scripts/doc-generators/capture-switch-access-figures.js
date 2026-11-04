/* Renders the figure in "Switch Access Figures.html" to sa-fig1.png for the switch
 * access proposal. Re-run after editing that file.
 *
 * Refuses to finish if text has outgrown a button, for the same reason as the Express
 * Panel figures: nobody looks at the picture before it is embedded.
 *
 * Run: node capture-switch-access-figures.js
 */
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 2 });
    const html = path.resolve(__dirname, 'Switch Access Figures.html');
    await page.goto('file:///' + html.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

    const overflow = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('.fig, .b')) {
            if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
                bad.push((el.className || '?') + ': ' + (el.textContent || '').trim().slice(0, 40));
            }
        }
        return bad;
    });
    if (overflow.length) {
        console.error('REFUSING - content overflows its box:\n  ' + overflow.join('\n  '));
        await browser.close();
        process.exit(1);
    }

    const el = await page.$('#f1');
    const out = path.join(__dirname, 'sa-fig1.png');
    await el.screenshot({ path: out });
    const box = await el.boundingBox();
    console.log(`sa-fig1.png  ${Math.round(box.width)}x${Math.round(box.height)} css px`);
    await browser.close();
})();
