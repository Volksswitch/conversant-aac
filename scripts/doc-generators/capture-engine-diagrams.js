// Screenshot each .diagram-section in Engine-Diagrams.html to a PNG, for
// embedding in Conversation-Engine-Overview.docx. Same pattern as
// capture-diagrams.js. Regenerable on request.
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });

    const htmlPath = path.resolve(__dirname, 'Engine-Diagrams.html');
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

    const sections = await page.$$('.diagram-section');
    for (let i = 0; i < sections.length; i++) {
        const file = path.join(__dirname, `engine-fig${i + 1}.png`);
        await sections[i].screenshot({ path: file });
        console.log(`Saved engine-fig${i + 1}.png`);
    }

    await browser.close();
    console.log('Done.');
})();
