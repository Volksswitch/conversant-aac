const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });

    const htmlPath = path.resolve(__dirname, 'Architecture Diagrams.html');
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

    // Capture Phase 1 diagram (first .diagram-section)
    const sections = await page.$$('.diagram-section');

    if (sections.length >= 1) {
        await sections[0].screenshot({ path: path.join(__dirname, 'diagram-phase1.png') });
        console.log('Phase 1 diagram saved.');
    }

    if (sections.length >= 2) {
        await sections[1].screenshot({ path: path.join(__dirname, 'diagram-nthphase.png') });
        console.log('Nth Phase diagram saved.');
    }

    // Capture the Open Interface Specifications + Candidate Assets table
    const notes = await page.$('.notes');
    if (notes) {
        await notes.screenshot({ path: path.join(__dirname, 'diagram-assets.png') });
        console.log('Assets table saved.');
    }

    await browser.close();
    console.log('Done.');
})();
