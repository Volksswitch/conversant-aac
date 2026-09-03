// Render the real app at full tablet size in every colour scheme, so the schemes
// can be judged from the app rather than from a mock-up of it.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

const OUT = process.argv[2];
const URL = 'http://localhost:8000/';
const SCHEMES = [
    ['light', 'Default'], ['bold', 'Bold outlines'], ['hc-light', 'High contrast, light'],
    ['dark', 'Dark'], ['hc-dark', 'High contrast, dark'], ['yellow', 'Yellow on black'],
    ['cb', 'Color-blind safe'],
];

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: 'networkidle0' });

// One realistic conversation, set up once, so the scheme is the only difference.
await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    // Put the app in the state it is in AFTER Start, rather than pressing Start.
    // handleStart needs a real user gesture (it unlocks audio and may request full
    // screen), which a headless browser cannot give, and it leaves `main.disabled`
    // in place if it does not complete. That class holds the cards and the dock at
    // 40% opacity, so every scheme renders washed out -- which looks exactly like a
    // scheme with weak colours and is not one. This IS the post-Start appearance:
    // the same class removal handleStart performs.
    document.querySelector('main').classList.remove('disabled');
    // display:none, not [hidden] -- the block's own rule sets display:flex, which
    // beats the attribute.
    const startBlock = document.querySelector('#startBlock');
    if (startBlock) startBlock.style.display = 'none';
    document.querySelector('#apiKeyPrompt')?.setAttribute('hidden', '');
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    document.querySelector('#transcriptLog').insertAdjacentHTML('beforeend',
        '<div class="turn turn-partner">How was your weekend?</div>' +
        '<div class="turn turn-user">Pretty good, thanks — went to my sister’s.</div>' +
        '<div class="turn turn-partner">Oh nice. Did you get out at all?</div>');
    const words = ['We walked down by the river on Sunday.', "I'd rather not get into it.",
                   'What about yours?', 'Sorry, could you say that again?'];
    const badges = ['PREFERRED', 'DISPREFERRED', 'INITIATIVE', 'REPAIR'];
    document.querySelectorAll('.response-card-empty').forEach((c, i) => {
        c.classList.remove('response-card-empty');
        c.classList.add('response-card');
        c.innerHTML = '<div class="response-card-top"><span class="response-badge">' +
            badges[i % 4] + '</span><span class="response-latency"></span></div>' +
            '<div class="response-text">' + words[i % 4] + '</div>';
    });
});

for (const [key, label] of SCHEMES) {
    await page.evaluate(k => {
        if (k === 'light') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', k);
    }, key);
    await new Promise(r => setTimeout(r, 250));
    const file = `${OUT}/${key}.png`;
    await page.screenshot({ path: file });
    console.log('wrote', label, '->', file);
}
await browser.close();
