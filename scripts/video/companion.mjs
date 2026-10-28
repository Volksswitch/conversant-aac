// Companion pages: a one-page PDF for each video, and the course map.
//
// A companion page is made from the same script as its video, in the same run,
// from the same pictures, so the two cannot disagree. Its steps are the script
// steps that carry `page:` wording, each shown with the picture from that step.
//
// One page is a promise to the reader, so a page that runs onto a second sheet
// stops the render rather than quietly becoming two pages.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT } from './azure.mjs';

export const MAX_PAGE_STEPS = 6;

export function readCourse() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'video', 'course.json'), 'utf8'));
}

const made = (item) => item.id && fs.existsSync(path.join(ROOT, 'Videos', `${item.id}.mp4`));

// The course entry for a video, and the next video that actually exists.
export function placeInCourse(id) {
  const all = readCourse().groups.flatMap((g) => g.items);
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`STOPPING - ${id} is not in scripts/video/course.json`);
  // The other device versions of the same video are not "next": skip to a new number.
  const next = all.slice(i + 1).find((x) => x.num !== all[i].num && x.id
    && (made(x) || fs.existsSync(path.join(ROOT, 'scripts', 'video', 'scripts', `${x.id}.mjs`))));
  return { entry: all[i], next };
}

// "Installing Conversant (On an iPad)" for a device version, the title alone otherwise.
export const fullTitle = (x) => x.version ? `${x.title} (${x.version})` : x.title;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const STYLE = `
  @page { size: Letter; margin: 0.55in 0.6in 0.6in 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2933; margin: 0; font-size: 11pt; line-height: 1.35; }
  .kicker { font-size: 9.5pt; color: #52606d; letter-spacing: 0.02em; }
  h1 { font-size: 20pt; margin: 2pt 0 4pt; color: #243b53; }
  .learn { font-size: 12pt; margin: 0 0 4pt; }
  .meta { font-size: 9.5pt; color: #52606d; margin-bottom: 12pt; }
  h2 { font-size: 12.5pt; color: #243b53; margin: 10pt 0 6pt; border-bottom: 1.5px solid #9fb3c8; padding-bottom: 2pt; }
  ol.steps { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8pt 16pt; }
  ol.steps li { break-inside: avoid; }
  ol.steps img { width: 3.1in; max-width: 100%; height: auto; margin: 0 auto; border: 1px solid #9fb3c8; border-radius: 3px; display: block; }
  .num { display: inline-block; width: 18pt; height: 18pt; line-height: 18pt; text-align: center; border-radius: 50%;
         background: #243b53; color: #fff; font-weight: bold; font-size: 10pt; margin-right: 5pt; }
  .stext { margin-top: 4pt; display: flex; align-items: flex-start; }
  .stext span:last-child { flex: 1; }
  ul.trouble { margin: 0; padding-left: 16pt; }
  ul.trouble li { margin-bottom: 3pt; }
  .next { margin-top: 10pt; font-size: 11pt; }
  table.map { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
  table.map td { padding: 4pt 6pt; border-bottom: 1px solid #d9e2ec; vertical-align: top; }
  table.map td.n { width: 34pt; font-weight: bold; color: #243b53; }
  table.map td.t { width: 45%; font-weight: bold; }
  .note { font-size: 10pt; color: #52606d; }
`;

const FOOTER = `<div style="font-family: Arial, sans-serif; font-size: 8pt; color: #52606d; width: 100%; padding: 0 0.6in; display: flex; justify-content: space-between;">
  <span>Volksswitch.org | Conversant AAC how-to videos</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

function countPages(pdfBytes) {
  return (pdfBytes.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

async function printPdf(browser, html, outPath, { onePage }) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = Buffer.from(await page.pdf({
      format: 'Letter', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<div></div>', footerTemplate: FOOTER,
      margin: { top: '0.55in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
    }));
    const pages = countPages(pdf);
    if (onePage && pages !== 1) {
      throw new Error(`STOPPING - the companion page came out ${pages} pages long; shorten its steps or wording`);
    }
    fs.writeFileSync(outPath, pdf);
    return pages;
  } finally {
    await page.close();
  }
}

// A picture for the page: zoomed in on what the step points at, so it can be
// read on paper, and compressed, so the PDF stays small. The zoom never goes
// tighter than half the screen, so the reader can still tell where on the
// screen it is.
function thumbnail(ffmpeg, frame) {
  const { file, box, view } = frame;
  const k = view.deviceScaleFactor;
  const W = view.width, H = view.height;
  let filter = 'scale=900:-1';
  if (box) {
    const aspect = W / H;
    let w = Math.max((box.right - box.left) * 1.5, W / 2);
    let h = Math.max((box.bottom - box.top) * 1.5, H / 2);
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    w = Math.min(w, W); h = Math.min(h, H);
    const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
    const x = Math.min(Math.max(cx - w / 2, 0), W - w);
    const y = Math.min(Math.max(cy - h / 2, 0), H - h);
    const px = (v) => Math.round(v * k / 2) * 2;
    filter = `crop=${px(w)}:${px(h)}:${px(x)}:${px(y)},scale=900:-2`;
  }
  const jpg = file.replace(/\.png$/, '.page.jpg');
  const r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-i', file, '-vf', filter, '-q:v', '5', jpg]);
  if (r.status !== 0) throw new Error(`Could not shrink ${file}: ${r.stderr}`);
  return `data:image/jpeg;base64,${fs.readFileSync(jpg).toString('base64')}`;
}

export async function makeCompanion({ browser, script, frames, seconds, ffmpeg }) {
  const { entry, next } = placeInCourse(script.id);
  const steps = script.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.page);
  if (!steps.length) throw new Error(`STOPPING - ${script.id} has no steps marked for its page`);
  if (steps.length > MAX_PAGE_STEPS) {
    throw new Error(`STOPPING - ${script.id} marks ${steps.length} steps for its page; ${MAX_PAGE_STEPS} fit on one page`);
  }
  // A step that points at nothing has no picture of its own: the screen is the
  // same as the step before, and repeating it says nothing new.
  const items = steps.map(({ s, i }, n) => `<li>
      ${frames[i].box ? `<img src="${thumbnail(ffmpeg, frames[i])}" alt="">` : ''}
      <div class="stext"><span class="num">${n + 1}</span><span>${esc(s.page)}</span></div></li>`).join('');
  const trouble = (script.trouble || []).map((t) => `<li>${esc(t)}</li>`).join('');
  const nextLine = next
    ? `<p class="next"><b>Watch next:</b> ${esc(next.num)} ${esc(next.title)}${/[.?!]$/.test(next.title) ? '' : '.'}</p>`
    : '';
  const mins = Math.round(seconds);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
    <div class="kicker">Conversant AAC how-to video ${esc(entry.num)}</div>
    <h1>${esc(fullTitle(entry))}</h1>
    <p class="learn">${esc(entry.learn)}</p>
    <div class="meta">The video is ${mins} seconds long. Updated ${today()}.</div>
    <h2>Steps</h2><ol class="steps">${items}</ol>
    ${trouble ? `<h2>If something goes wrong</h2><ul class="trouble">${trouble}</ul>` : ''}
    ${nextLine}
  </body></html>`;
  const out = path.join(ROOT, 'Videos', `${script.id}.pdf`);
  // If the wording runs long, the pictures get smaller until the page fits on one
  // sheet; past the smallest size, the render stops and says so.
  const sizes = ['3.1in', '2.75in', '2.4in'];
  for (const [n, w] of sizes.entries()) {
    try {
      await printPdf(browser, html.replace('ol.steps img { width: 3.1in;', `ol.steps img { width: ${w};`), out, { onePage: true });
      return out;
    } catch (e) {
      if (n === sizes.length - 1 || !/pages long/.test(e.message)) throw e;
    }
  }
  return out;
}

// The course map: every group, with only the videos that exist so far.
export async function makeCourseMap(browser) {
  const course = readCourse();
  let body = '';
  for (const g of course.groups) {
    // Device versions of one video share a row, with the devices listed.
    const ready = [];
    for (const x of g.items.filter(made)) {
      const row = ready.find((r) => r.num === x.num);
      if (row) { if (x.version) row.versions.push(x.version); }
      else ready.push({ ...x, versions: x.version ? [x.version] : [] });
    }
    if (!ready.length) continue;
    const rows = ready.map((x) => `<tr><td class="n">${esc(x.num)}</td><td class="t">${esc(x.title)}${x.versions.length
      ? `<br><span class="note">${esc(x.versions.map((v) => v.replace(/^On /, 'on ')).join(', '))}</span>` : ''}</td><td>${esc(x.learn)}</td></tr>`).join('');
    body += `<h2>${esc(g.name)}${g.path ? ' <span class="note">(watch these in order)</span>' : ''}</h2><table class="map">${rows}</table>`;
  }
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
    <div class="kicker">Conversant AAC how-to videos</div>
    <h1>Learning Conversant</h1>
    <p class="learn">Short videos, about two minutes each, that show you how to use Conversant. Each one has a one-page guide with the same steps.</p>
    <div class="meta">Start with "Getting started", then "Your first conversations", and watch those in order. After that, pick the ones you need. Updated @@DATE@@.</div>
    ${body}
  </body></html>`;
  const out = path.join(ROOT, 'Videos', 'Learning Conversant.pdf');
  await printPdf(browser, page.replace('@@DATE@@', today()), out, { onePage: false });
  // The wording, without the date, so the publisher re-uploads the map when its
  // words change and not only when the list of published videos does.
  const signature = crypto.createHash('sha256').update(page).digest('hex');
  fs.writeFileSync(out.replace(/\.pdf$/, '.json'), JSON.stringify({ signature }, null, 2) + '\n');
  return out;
}
