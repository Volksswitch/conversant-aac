/* Renders one figure per distinct layout SHAPE for "Conversant AAC Layout Review.docx"
 * (lr-<id>.png beside this script). Ken, October 8 2026: review the keyboard / Express
 * Panel layouts visually, trimmed to the shapes that are actually different.
 *
 * The layouts are IMPORTED from the app, never copied, so a figure cannot disagree with
 * the layout it is named after. The one exception is CANDIDATE_QWERTY below, which is a
 * proposal for review and does not exist in the app.
 *
 * Every figure is drawn at the SAME width with the SAME row height, so the eye compares
 * button widths directly. That is the property Ken is judging, so it must not vary.
 *
 * Run: node capture-layout-review-figures.mjs
 */
import puppeteer from 'puppeteer';
import { LAYOUTS, panelPositionCount } from '../../app/js/keyboard-layouts.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

const C  = (ch, span = 1) => ({ kind: 'char', label: ch, span });
const SP = (span = 1) => ({ kind: 'space', label: 'space', span });
const A  = (label, span = 1) => ({ kind: 'action', label, span });
const r  = (s) => s.split(' ').map((c) => C(c));

// A QWERTY that fits five columns: the left-hand half on top, the right-hand half
// below. NOT IN THE APP - drawn so Ken can judge it.
const CANDIDATE_QWERTY = { rows: [
    r('q w e r t'), r('a s d f g'), r('z x c v b'),
    r('y u i o p'), [C('h'), C('j'), C('k'), C('l'), C(',')],
    [C('n'), C('m'), C('.'), A('⌫'), A('⇧')],
    [A('123'), SP(3), A('↵')],
]};

export const SHAPES = [
    { id: 'S6', fig: 'lr-1' },  { id: 'S2', fig: 'lr-2' },  { id: 'S1', fig: 'lr-3' },
    { id: 'QW5', fig: 'lr-4', layout: CANDIDATE_QWERTY },
    { id: 'S8', fig: 'lr-5' },  { id: 'S10', fig: 'lr-6' }, { id: 'S3', fig: 'lr-7' },
    { id: 'B4', fig: 'lr-8' },  { id: 'B1', fig: 'lr-9' },  { id: 'B8', fig: 'lr-10' },
    { id: 'B2', fig: 'lr-11' }, { id: 'B9', fig: 'lr-12' }, { id: 'B11', fig: 'lr-13' },
    { id: 'B3', fig: 'lr-14' },
    { id: 'S7', fig: 'lr-15' },
];

const W = 640, ROW_H = 46;

function cellHtml(c) {
    const span = c.span || 1;
    const k = c.kind;
    const cls = k === 'space' ? 'k sp' : k === 'blank' ? 'k bl' : k === 'action' ? 'k ac' : 'k';
    const label = k === 'blank' ? '' : (c.label === 'space' ? 'space' : c.label);
    return `<div class="${cls}" style="grid-column: span ${span}">${label}</div>`;
}

function figHtml(s) {
    const rows = (s.layout || LAYOUTS[s.id]).rows;
    return `<div class="fig" id="${s.fig}">` + rows.map((row) => {
        const cols = row.reduce((n, c) => n + (c.span || 1), 0);
        return `<div class="row" style="grid-template-columns: repeat(${cols}, minmax(0,1fr))">` +
            row.map(cellHtml).join('') + '</div>';
    }).join('') + '</div>';
}

const html = `<!doctype html><meta charset="utf-8"><style>
body { margin: 20px; font-family: Arial, sans-serif; background: #fff; }
.fig { width: ${W}px; padding: 8px; background: #eceff1; border-radius: 6px; margin-bottom: 30px;
       display: flex; flex-direction: column; gap: 4px; box-sizing: content-box; }
.row { display: grid; gap: 4px; height: ${ROW_H}px; }
.k { background: #fff; border: 1.5px solid #546e7a; border-radius: 6px; display: flex;
     align-items: center; justify-content: center; font-size: 18px; color: #263238; overflow: hidden; }
.ac { background: #cfd8dc; }
.sp { background: #2c3e50; color: #fff; font-size: 14px; }
.bl { background: transparent; border: none; }
</style>${SHAPES.map(figHtml).join('')}`;

const tmp = path.join(here, 'Layout Review Figures.html');
fs.writeFileSync(tmp, html);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 760, height: 1200, deviceScaleFactor: 2 });
await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
const sizes = {};
for (const s of SHAPES) {
    const el = await page.$('#' + s.fig);
    await el.screenshot({ path: path.join(here, s.fig + '.png') });
    const box = await el.boundingBox();
    sizes[s.fig] = [Math.round(box.width), Math.round(box.height)];
}
await browser.close();

// Facts the document reads, computed from the layouts so they cannot drift.
const facts = SHAPES.map((s) => {
    const rows = (s.layout || LAYOUTS[s.id]).rows;
    const across = Math.max(...rows.map((row) => row.reduce((n, c) => n + (c.span || 1), 0)));
    return { id: s.id, fig: s.fig, across, down: rows.length,
             buttons: panelPositionCount(rows), size: sizes[s.fig] };
});
fs.writeFileSync(path.join(here, 'layout-review-facts.json'), JSON.stringify(facts, null, 2));
console.log(facts.map((f) => `${f.id}: ${f.across} x ${f.down}, ${f.buttons} buttons, ${f.size}`).join('\n'));
