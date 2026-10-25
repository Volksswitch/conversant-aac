// Takes the picture for the top of the Conversant home page on volksswitch.org:
// the conversation screen with a partner line and four response options, the
// same staged conversation as video 1.1, with no rings drawn. The Express Panel
// carries the test data set's buttons (test-data-folder, "reset test data"), with
// Devon's partner button lit so his own phrases show.
//
// Run: node scripts/video/capture-home-picture.mjs
// Writes: Other/Web Pages/conversant-home-screen.png (2560 x 1440)

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import { ROOT, pace } from './azure.mjs';

const PORT = 8124;
const OUT = path.join(ROOT, 'Other', 'Web Pages', 'conversant-home-screen.png');
const DATA = path.join(ROOT, 'test-data-folder');
const STORED = {
  aac_express_items: 'express-panel.json', aac_relationships: 'relationships.json',
  aac_places: 'places.json', aac_worldview: 'worldview.json',
};
const PARTNER = "Nice! Are you coming to the game on Saturday?";
const OPTIONS = [
  { slot: 'PREFERRED', text: "Yeah, I'll be there! Want to sit together?", hint: "I'll be there" },
  { slot: 'DISPREFERRED', text: "I wish I could, but I've got plans with my family.", hint: 'Family plans' },
  { slot: 'INITIATIVE', text: 'Maybe! Who else is going?', hint: 'Who else?' },
  { slot: 'REPAIR', text: 'Sorry, which game?', hint: 'Which game?' },
];

const server = spawn('python', [path.join(ROOT, 'scripts', 'dev-server.py'), String(PORT)], { cwd: ROOT, stdio: 'ignore' });
const browser = await puppeteer.launch({ headless: true });
try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch {}
    await pace(200);
  }
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  // No request may reach the AI: the fake key would be refused and the refusal
  // would tint the transcript. A request to it simply never answers.
  await page.evaluateOnNewDocument(() => {
    const real = window.fetch;
    window.fetch = (u, o) => String(u).includes('anthropic.com') ? new Promise(() => {}) : real(u, o);
  });
  const url = `http://localhost:${PORT}/`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const stored = Object.fromEntries(Object.entries(STORED).map(([k, f]) =>
    [k, fs.readFileSync(path.join(DATA, f), 'utf8')]));
  await page.evaluate((stored) => {
    localStorage.setItem('aac_settings', JSON.stringify({
      lastSeenVersion: '99.0.0',
      apiKey: 'sk-ant-picture-only-never-sent-00000000000000000000000',
    }));
    for (const [k, v] of Object.entries(stored)) localStorage.setItem(k, v);
  }, stored);
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: '#startVersion { visibility: hidden !important; } * { caret-color: transparent !important; }' });
  await page.click('#startBtn');
  await pace(1200);
  const devon = await page.$('#expressPanel [aria-label*="Devon"]');
  if (!devon) throw new Error("Devon's partner button is not on the Express Panel");
  await devon.click();
  await pace(600);
  await page.evaluate(async (line, opts) => {
    const ui = await import('/js/ui.js');
    ui.renderConversation([
      { role: 'partner', text: 'Hey Marc! How was your week?' },
      { role: 'user', text: 'Pretty good. I finally beat that last level.' },
      { role: 'partner', text: line },
    ]);
    ui.showResponses(opts, () => {});
  }, PARTNER, OPTIONS);
  await pace(800);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await page.screenshot({ path: OUT });
  console.log(`Wrote ${OUT}`);
} finally {
  await browser.close();
  server.kill();
}
