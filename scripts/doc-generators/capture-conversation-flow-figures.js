/* Renders the five figures in "Conversation Flow Figures.html" to PNGs
 * (cf-fig1..5.png) for "Conversant AAC Conversation Flow.docx". Re-run after
 * editing that file.
 *
 * The figures are drawn BLIND - nobody looks at the PNG before it is embedded - so
 * this refuses to finish if any text box has outgrown its container, which is the
 * only symptom available. Figures 1, 3 and 5 place fixed-size boxes over an SVG
 * wire layer precisely so that this check can see them: SVG text cannot be
 * overflow-checked, which is why only one- and two-word edge labels are drawn there.
 *
 * Run: node capture-conversation-flow-figures.js
 */
const puppeteer = require('puppeteer');
const path = require('path');

const CHECK = '.fig, .box, .side, .loop, .lab, .seg, .seg2, .n, .dtext, .lanehead, ' +
              '.trklab, .ann, .rlab, .fanhead, .colhead, .item, .out, .llab, .mark';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1120, height: 1600, deviceScaleFactor: 2 });
    const html = path.resolve(__dirname, 'Conversation Flow Figures.html');
    await page.goto('file:///' + html.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

    const overflow = await page.evaluate((sel) => {
        const bad = [];
        for (const el of document.querySelectorAll(sel)) {
            if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
                bad.push((el.className || '?') + ' [' + el.clientWidth + 'x' + el.clientHeight +
                         ' needs ' + el.scrollWidth + 'x' + el.scrollHeight + ']: ' +
                         (el.textContent || '').trim().slice(0, 50));
            }
        }
        return bad;
    }, CHECK);
    if (overflow.length) {
        console.error('REFUSING - content overflows its box:\n  ' + overflow.join('\n  '));
        await browser.close();
        process.exit(1);
    }

    for (let i = 1; i <= 5; i++) {
        const el = await page.$('#f' + i);
        if (!el) { console.error('missing #f' + i); continue; }
        const out = path.join(__dirname, `cf-fig${i}.png`);
        await el.screenshot({ path: out });
        const box = await el.boundingBox();
        console.log(`cf-fig${i}.png  ${Math.round(box.width)}x${Math.round(box.height)} css px`);
    }
    await browser.close();
})();
