// Framed pictures for the demo video: the app's picture, a little smaller, with a
// strip underneath for a short caption, and full-screen title cards for the parts
// Ken narrates. Drawn by a second, separate browser, so the app's own page is
// never covered and never loses focus.
//
// Captions are short labels (two to eight words), not subtitles: what is SAID
// goes in the .srt caption file as before.

import fs from 'node:fs';

const BG = '#1d2733';
const ACCENT = '#4fb3a9';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 1280 x 720 page at 1.5x = 1920 x 1080. The app keeps its 16:9 shape at 89%.
const APP_W = 1138, APP_H = 640, STRIP = 720 - APP_H;

export async function makeFramer(browser, view) {
  const page = await browser.newPage();
  await page.setViewport(view);
  const shoot = async (html, out) => {
    await page.setContent(`<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      body { margin: 0; width: 100vw; height: 100vh; overflow: hidden; background: ${BG};
        font-family: 'Segoe UI', Arial, sans-serif; color: #fff; }
    </style></head><body>${html}</body></html>`, { waitUntil: 'load' });
    await page.screenshot({ path: out });
    return out;
  };
  return {
    // The app's picture with a caption strip below it (blank when there is none).
    async framed(appPng, caption, out) {
      const data = `data:image/png;base64,${fs.readFileSync(appPng).toString('base64')}`;
      return shoot(`
        <img src="${data}" style="position:absolute;left:${(1280 - APP_W) / 2}px;top:0;width:${APP_W}px;height:${APP_H}px;">
        <div style="position:absolute;left:0;right:0;top:${APP_H}px;height:${STRIP}px;display:flex;
          align-items:center;justify-content:center;font-size:30px;font-weight:600;letter-spacing:0.01em;">
          ${caption ? `<span style="border-left:6px solid ${ACCENT};padding-left:16px;">${esc(caption)}</span>` : ''}
        </div>`, out);
    },
    // A title card: a heading, an optional web address shown large (on one line, smaller when long), and up to a few short lines.
    // Three other kinds, used by the ATIA video: `diagram` (the architecture, with
    // some boxes lit), `compare` (two pictures side by side) and `timeline` (marks
    // on a line of seconds). `kicker` is a small label above the heading.
    async card(spec, out) {
      if (spec.diagram) return shoot(diagramHtml(spec), out);
      if (spec.compare) return shoot(compareHtml(spec), out);
      if (spec.timeline) return shoot(timelineHtml(spec), out);
      const { title, lines = [], url = '', foot = '', kicker = '' } = spec;
      return shoot(`
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 120px;">
          <div style="width:90px;height:8px;background:${ACCENT};border-radius:4px;margin-bottom:34px;"></div>
          ${kicker ? `<div style="font-size:24px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};margin-bottom:14px;">${esc(kicker)}</div>` : ''}
          <div style="font-size:60px;font-weight:700;line-height:1.15;">${esc(title)}</div>
          ${url ? `<div style="font-size:${url.length > 28 ? 50 : 64}px;font-weight:700;margin-top:34px;white-space:nowrap;color:${ACCENT};">${esc(url)}</div>` : ''}
          ${lines.map((l) => `<div style="font-size:32px;line-height:1.4;margin-top:22px;color:#d9e2ec;">${esc(l)}</div>`).join('')}
        </div>
        ${foot ? `<div style="position:absolute;left:120px;bottom:48px;font-size:22px;color:#9fb3c8;">${esc(foot)}</div>` : ''}`, out);
    },
  };
}

// ---- The ATIA video's extra cards ----

const DIM_FILL = '#26323f', DIM_EDGE = '#3d4c5c', DIM_INK = '#7f93a8';
const LIT_FILL = '#24514d';

// One box of the architecture: lit (accent) or dim.
function box(x, y, w, h, title, sub, lit) {
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:12px;
    border:3px solid ${lit ? ACCENT : DIM_EDGE};background:${lit ? LIT_FILL : DIM_FILL};
    display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:6px 14px;">
    <div style="font-size:26px;font-weight:700;color:${lit ? '#fff' : DIM_INK};">${esc(title)}</div>
    <div style="font-size:18px;margin-top:6px;color:${lit ? '#d9e2ec' : DIM_INK};">${esc(sub)}</div></div>`;
}
function arrow(x1, y, x2, lit) {
  const c = lit ? ACCENT : DIM_EDGE;
  return `<div style="position:absolute;left:${x1}px;top:${y - 2}px;width:${x2 - x1 - 12}px;height:4px;background:${c};"></div>
    <div style="position:absolute;left:${x2 - 14}px;top:${y - 10}px;width:0;height:0;border-top:10px solid transparent;
      border-bottom:10px solid transparent;border-left:14px solid ${c};"></div>`;
}

// The architecture as built (deck slide 28), with conversation analysis as the
// base the conversation engine stands on. `lit` names the boxes to light, or 'all'.
function diagramHtml({ title = '', diagram }) {
  const lit = (k) => diagram.lit === 'all' || (diagram.lit || []).includes(k);
  const ca = lit('ca');
  return `
    ${title ? `<div style="position:absolute;left:70px;top:30px;font-size:38px;font-weight:700;">${esc(title)}</div>` : ''}
    <div style="position:absolute;left:50px;top:96px;width:1180px;height:592px;border:3px dashed ${lit('boundary') ? ACCENT : DIM_EDGE};border-radius:18px;"></div>
    <div style="position:absolute;left:50px;top:650px;width:1180px;text-align:center;font-size:20px;font-weight:600;
      color:${lit('boundary') ? ACCENT : DIM_INK};">No server: the user's data stays on their device</div>
    ${box(330, 122, 290, 96, 'Context', 'People, places, about me', lit('context'))}
    ${box(660, 122, 290, 96, 'Worldview', 'How I talk with each person', lit('worldview'))}
    ${box(90, 270, 250, 130, 'Hearing', 'Speech-to-text', lit('hearing'))}
    ${box(410, 255, 460, 160, 'Conversation engine', 'A large language model writes the words', lit('engine'))}
    ${box(940, 270, 250, 130, 'Speaking', 'The user’s chosen voice', lit('speaking'))}
    ${arrow(340, 335, 410, lit('hearing'))}${arrow(870, 335, 940, lit('speaking'))}
    <div style="position:absolute;left:90px;top:445px;width:1100px;height:${ca ? 180 : 120}px;border-radius:12px;
      border:3px solid ${ca ? ACCENT : DIM_EDGE};background:${ca ? LIT_FILL : DIM_FILL};
      display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <div style="font-size:${ca ? 34 : 26}px;font-weight:700;color:${ca ? '#fff' : DIM_INK};">Conversation analysis</div>
      <div style="font-size:${ca ? 22 : 18}px;margin-top:8px;color:${ca ? '#d9e2ec' : DIM_INK};">The structure of every turn: turn-taking · preference · repair · openings and closings · recipient design</div>
    </div>`;
}

// Pictures one above the other (the response options are a wide row), each with
// a label above it.
function compareHtml({ title = '', compare }) {
  const rows = compare.map(({ label, image }) => {
    const data = fs.existsSync(image) ? `data:image/png;base64,${fs.readFileSync(image).toString('base64')}` : '';
    if (!data) throw new Error(`STOPPING - the comparison picture ${image} was never taken`);
    return `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="font-size:26px;font-weight:700;margin-bottom:12px;text-align:center;">${esc(label)}</div>
      <img src="${data}" style="max-width:1180px;max-height:${Math.floor(520 / compare.length) - 50}px;border-radius:8px;border:3px solid ${ACCENT};background:#fff;">
    </div>`;
  }).join('');
  return `
    <div style="position:absolute;left:70px;top:30px;font-size:40px;font-weight:700;">${esc(title)}</div>
    <div style="position:absolute;left:40px;right:40px;top:110px;bottom:20px;display:flex;flex-direction:column;gap:28px;justify-content:center;">${rows}</div>`;
}

// Marks on a line of seconds: { seconds, marks: [{ t, label }] }.
function timelineHtml({ title = '', lines = [], timeline }) {
  const L = 110, R = 1170, Y = 400;
  const x = (t) => L + (R - L) * (t / timeline.seconds);
  const ticks = Array.from({ length: Math.floor(timeline.seconds) + 1 }, (_, s) =>
    `<div style="position:absolute;left:${x(s) - 1}px;top:${Y - 8}px;width:2px;height:16px;background:${DIM_INK};"></div>
     <div style="position:absolute;left:${x(s) - 30}px;top:${Y + 18}px;width:60px;text-align:center;font-size:20px;color:${DIM_INK};">${s} s</div>`).join('');
  const marks = timeline.marks.map(({ t, label }, i) => {
    const up = i % 2 === 0;
    return `<div style="position:absolute;left:${x(t) - 9}px;top:${Y - 9}px;width:18px;height:18px;border-radius:50%;background:${ACCENT};"></div>
      <div style="position:absolute;left:${x(t) - 1}px;top:${up ? Y - 90 : Y + 52}px;width:2px;height:${up ? 80 : 40}px;background:${ACCENT};"></div>
      <div style="position:absolute;left:${x(t) - 130}px;top:${up ? Y - 160 : Y + 96}px;width:260px;text-align:center;font-size:24px;font-weight:600;line-height:1.25;">${esc(label)}</div>`;
  }).join('');
  return `
    <div style="position:absolute;left:110px;top:44px;font-size:48px;font-weight:700;">${esc(title)}</div>
    ${lines.map((l, i) => `<div style="position:absolute;left:110px;top:${120 + i * 40}px;font-size:26px;color:#d9e2ec;">${esc(l)}</div>`).join('')}
    <div style="position:absolute;left:${L}px;top:${Y - 2}px;width:${R - L}px;height:4px;background:${DIM_EDGE};"></div>
    ${ticks}${marks}`;
}
