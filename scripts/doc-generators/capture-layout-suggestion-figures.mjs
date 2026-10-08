/* Renders the screen mockups for "Conversant AAC Layout Suggestions.docx" (ls-<n>.png).
 * Ken, October 8 2026: suggested starting layouts per screen shape, including how much
 * of the screen each of the four panes gets.
 *
 * Each mockup is drawn at the device's REAL size in screen points with the app's real
 * type size, so the text and buttons look the way they would on the device. The
 * Express Panel grids are imported from the app, except the five-column QWERTY, which
 * is a proposal and not in the app yet.
 *
 * The pane proportions live in SUGGESTIONS below and are written to
 * layout-suggestion-facts.json for the document, so the figures and the text cannot
 * disagree.
 *
 * Run: node capture-layout-suggestion-figures.mjs
 */
import puppeteer from 'puppeteer';
import { LAYOUTS } from '../../app/js/keyboard-layouts.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

const C = (ch) => ({ kind: 'char', span: 1 });
const SP = (span) => ({ kind: 'space', span });
const A = () => ({ kind: 'action', span: 1 });
const five = () => [C(), C(), C(), C(), C()];
const QWERTY_HALVES = { rows: [five(), five(), five(), five(), five(), five(), [A(), SP(3), A()]] };

// t, c, r, e = transcript, command bar, response options, Express Panel, as fractions
// of the screen height. For a side dock, e is a fraction of the WIDTH and t/c/r are
// fractions of the height of the column beside it.
export const SUGGESTIONS = [
    { fig: 'ls-1', title: 'Phone, upright', w: 412, h: 915, dock: 'bottom',
      layout: 'S1', layoutName: 'Alphabet, 5 × 7', options: '2x2',
      t: 0.18, c: 0.07, r: 0.30, e: 0.45 },
    { fig: 'ls-2', title: 'Tablet, upright', w: 820, h: 1180, dock: 'bottom',
      layout: 'S1', layoutName: 'Alphabet, 5 × 7', options: '2x2',
      t: 0.22, c: 0.06, r: 0.30, e: 0.42 },
    { fig: 'ls-3', title: 'Tablet, sideways, keyboard at the side', w: 1368, h: 912, dock: 'side',
      layout: 'S2', layoutName: 'Alphabet, 4 × 9', options: '2x2r',
      t: 0.40, c: 0.10, r: 0.50, e: 0.30 },
    { fig: 'ls-4', title: 'Tablet, sideways, keyboard at the bottom', w: 1368, h: 912, dock: 'bottom',
      layout: 'B11', layoutName: 'QWERTY, 12 × 3', options: 'row',
      t: 0.30, c: 0.10, r: 0.30, e: 0.30 },
    { fig: 'ls-5', title: 'Phone, sideways', w: 915, h: 412, dock: 'side',
      layout: 'S2', layoutName: 'Alphabet, 4 × 9', options: '2x2',
      t: 0.30, c: 0.14, r: 0.56, e: 0.40 },
];

const PHRASES = ['Yes', 'No', 'Maybe', 'OK', 'Thank you', 'Please', 'Hi', 'Bye', 'Excuse me',
    "I don't know", 'Wait', 'Again', 'More', 'Stop', 'Help', 'Good', 'Bad', 'Why?', 'When?',
    'Where?', 'Who?', 'Awesome', 'No way', 'Sure', 'Later', 'Now', 'Done', 'Hungry',
    'Thirsty', 'Tired', 'Happy', 'Sad', 'Funny', 'Cool', 'Wow', 'Oops', 'Hello', 'Fine',
    'Great', 'Nope', 'Yep', 'Same'];

function expressHtml(rows) {
    let n = 0;
    return `<div class="ep" style="grid-template-rows: repeat(${rows.length}, 1fr)">` + rows.map((row) => {
        const cols = row.reduce((s, c) => s + (c.span || 1), 0);
        return `<div class="row" style="grid-template-columns: repeat(${cols}, minmax(0,1fr))">` +
            row.map((c) => {
                if (c.kind === 'blank') return `<div style="grid-column: span ${c.span || 1}"></div>`;
                if (c.kind === 'space') return `<div class="b compose" style="grid-column: span ${c.span}">✎</div>`;
                return `<div class="b ph" style="grid-column: span ${c.span || 1}">${PHRASES[n++ % PHRASES.length]}</div>`;
            }).join('') + '</div>';
    }).join('') + '</div>';
}

const OPTS = [
    ['pref', "Sure, I'd love to."],
    ['dis', "I'd like to, but I have a test."],
    ['init', 'Where were you thinking?'],
    ['rep', 'Sorry, lunch today?'],
];
function optionsHtml(kind) {
    const cards = OPTS.map(([k, t]) => `<div class="opt ${k}">${t}</div>`).join('');
    if (kind === '2x2r') return `<div class="resp row1"><div class="grid4">${cards}</div><div class="b new4">New 4</div></div>`;
    if (kind === '2x2') return `<div class="resp two"><div class="grid4">${cards}</div><div class="b new4">New 4</div></div>`;
    return `<div class="resp row1"><div class="row4">${cards}</div><div class="b new4">New 4</div></div>`;
}
const command = () => `<div class="cmd">${Array.from({ length: 9 }, (_, i) =>
    `<div class="b ${i === 0 ? 'listen' : ''}">${['🎤', '💬', '⊗', '↻', '❚❚', '?', '⤓', '⛨', '⚙'][i]}</div>`).join('')}</div>`;
const transcript = () => `<div class="tr"><div class="bub p">Do you want to grab lunch after class?</div></div>`;
const tag = (label) => `<div class="tag">${label}</div>`;
const pct = (x) => Math.round(x * 100) + '%';

function screenHtml(s) {
    const rows = (s.layout === 'QW5' ? QWERTY_HALVES : LAYOUTS[s.layout]).rows;
    const G = 4;
    if (s.dock === 'bottom') {
        const H = s.h - 5 * G;
        return `<div class="scr" id="${s.fig}" style="width:${s.w}px;height:${s.h}px;padding:${G}px;gap:${G}px;display:flex;flex-direction:column">
          <div class="pane" style="height:${s.t * H}px">${transcript()}${tag('Transcript ' + pct(s.t))}</div>
          <div class="pane" style="height:${s.c * H}px">${command()}${tag('Command Bar ' + pct(s.c))}</div>
          <div class="pane" style="height:${s.r * H}px">${optionsHtml(s.options)}${tag('Response options ' + pct(s.r))}</div>
          <div class="pane" style="height:${s.e * H}px">${expressHtml(rows)}${tag('Express Panel ' + pct(s.e) + ' · ' + s.layoutName)}</div>
        </div>`;
    }
    const W = s.w - 3 * G, H = s.h - 4 * G;
    return `<div class="scr" id="${s.fig}" style="width:${s.w}px;height:${s.h}px;padding:${G}px;gap:${G}px;display:flex">
      <div style="width:${(1 - s.e) * W}px;display:flex;flex-direction:column;gap:${G}px">
        <div class="pane" style="height:${s.t * H}px">${transcript()}${tag('Transcript ' + pct(s.t))}</div>
        <div class="pane" style="height:${s.c * H}px">${command()}${tag('Command Bar ' + pct(s.c))}</div>
        <div class="pane" style="height:${s.r * H}px">${optionsHtml(s.options)}${tag('Response options ' + pct(s.r))}</div>
      </div>
      <div class="pane" style="width:${s.e * W}px">${expressHtml(rows)}${tag('Express Panel ' + pct(s.e) + ' of width')}</div>
    </div>`;
}

const html = `<!doctype html><meta charset="utf-8"><style>
body { margin: 20px; font-family: Arial, sans-serif; font-size: 16px; background: #fff; }
.scr { box-sizing: border-box; background: #fafafa; border: 10px solid #222; border-radius: 22px; margin-bottom: 40px; }
.pane { position: relative; box-sizing: border-box; min-height: 0; }
.tag { position: absolute; left: 6px; bottom: 6px; background: rgba(255,214,0,.95); color: #000;
       font-size: 15px; font-weight: bold; padding: 3px 7px; border-radius: 4px; border: 1px solid #333; }
.tr { height: 100%; box-sizing: border-box; border: 1.5px solid #546e7a; border-radius: 8px; background: #f0f0f0; padding: 8px; overflow: hidden; }
.bub { display: inline-block; padding: 8px 12px; border-radius: 12px; background: #fff3e0; border: 1px solid #546e7a; }
.b { box-sizing: border-box; border: 1.5px solid #546e7a; border-radius: 8px; background: #fff; display: flex;
     align-items: center; justify-content: center; text-align: center; overflow: hidden; font-size: 14px; padding: 2px; }
.cmd { height: 100%; display: grid; grid-template-columns: repeat(9, minmax(0,1fr)); gap: 4px; }
.cmd .b { font-size: 20px; }
.listen { background: #2c3e50; color: #fff; }
.resp { height: 100%; display: flex; gap: 4px; }
.resp.two { flex-direction: column; }
.grid4 { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 4px; min-height: 0; }
.row4 { flex: 1; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 4px; }
.resp.two .new4 { height: 14%; }
.resp.row1 .new4 { width: 9%; }
.opt { box-sizing: border-box; border: 1.5px solid #546e7a; border-left-width: 6px; border-radius: 8px; padding: 8px; font-size: 17px; overflow: hidden; }
.pref { background: #e8f5e9; border-left-color: #2e7d32; }
.dis { background: #fff3e0; border-left-color: #a86300; }
.init { background: #e3f2fd; border-left-color: #1565c0; }
.rep { background: #f3e5f5; border-left-color: #6a1b9a; }
.ep { height: 100%; display: grid; gap: 4px; }
.ep .row { display: grid; gap: 4px; min-height: 0; }
.ph { background: #e8eaf6; border-color: #283593; }
.compose { background: #2c3e50; color: #fff; font-size: 22px; }
</style>${SUGGESTIONS.map(screenHtml).join('')}`;

const tmp = path.join(here, 'Layout Suggestion Figures.html');
fs.writeFileSync(tmp, html);
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1200, deviceScaleFactor: 1 });
await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
const sizes = {};
for (const s of SUGGESTIONS) {
    const el = await page.$('#' + s.fig);
    await el.screenshot({ path: path.join(here, s.fig + '.png') });
    const b = await el.boundingBox();
    sizes[s.fig] = [Math.round(b.width), Math.round(b.height)];
}
// Express button size in points, for the document - the thing the proportions trade.
const btn = await page.evaluate(() => [...document.querySelectorAll('.scr')].map((scr) => {
    const r = scr.querySelector('.ph').getBoundingClientRect();
    const o = scr.querySelector('.opt').getBoundingClientRect();
    const c = scr.querySelector('.cmd .b').getBoundingClientRect();
    return { id: scr.id, ep: [Math.round(r.width), Math.round(r.height)],
             opt: [Math.round(o.width), Math.round(o.height)], cmd: [Math.round(c.width), Math.round(c.height)] };
}));
await browser.close();
const facts = SUGGESTIONS.map((s) => ({ ...s, size: sizes[s.fig], ...btn.find((b) => b.id === s.fig) }));
fs.writeFileSync(path.join(here, 'layout-suggestion-facts.json'), JSON.stringify(facts, null, 2));
for (const f of facts) console.log(f.fig, f.title, 'express', f.ep, 'option', f.opt, 'command', f.cmd);
