// A helper for writing video scripts: opens a Settings tab in a separate copy of the app
// (port 8124, so it never collides with a render) and lists the controls on it.
//   node scripts/video/look.mjs <tab> [out-folder] [selector to tap] [another] ...
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
const ROOT = process.cwd(), TAB = process.argv[2] || 'aboutme', OUT = process.argv[3] || (await import('node:os')).tmpdir();
const srv = spawn('python', [ROOT + '/scripts/dev-server.py', '8124'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const b = await puppeteer.launch({ headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await p.goto('http://localhost:8124/', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.setItem('aac_settings', JSON.stringify({ lastSeenVersion: '99.0.0', apiKey: 'sk-ant-x-000000000000000000000000000000000000000' })));
await p.goto('http://localhost:8124/', { waitUntil: 'networkidle0' });
await p.click('#startBtn'); await new Promise(r => setTimeout(r, 1200));
await p.click('#settingsBtn'); await new Promise(r => setTimeout(r, 600));
await p.click(`#settingsTabs .settings-tab[data-tab="${TAB}"]`); await new Promise(r => setTimeout(r, 800));
for (const sel of process.argv.slice(4)) { await p.click(sel); await new Promise(r => setTimeout(r, 700)); }
await p.screenshot({ path: OUT + '/' + TAB + '.png' });
const txt = await p.evaluate(() => { const d = document.querySelector('#settingsDialog'); return [...d.querySelectorAll('button, summary, h2, h3, label, input, textarea, select, .wv-module-title, .wv-q, a')].filter(e => e.offsetParent).map(e => e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : '') + ': ' + (e.textContent.trim() || e.placeholder || e.type || '').replace(/\s+/g, ' ').slice(0, 70)).join('\n'); });
console.log(txt);
await b.close(); srv.kill();
