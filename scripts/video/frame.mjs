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
    // A title card: a heading and up to a few short lines.
    async card({ title, lines = [], foot = '' }, out) {
      return shoot(`
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 120px;">
          <div style="width:90px;height:8px;background:${ACCENT};border-radius:4px;margin-bottom:34px;"></div>
          <div style="font-size:60px;font-weight:700;line-height:1.15;">${esc(title)}</div>
          ${lines.map((l) => `<div style="font-size:32px;line-height:1.4;margin-top:22px;color:#d9e2ec;">${esc(l)}</div>`).join('')}
        </div>
        ${foot ? `<div style="position:absolute;left:120px;bottom:48px;font-size:22px;color:#9fb3c8;">${esc(foot)}</div>` : ''}`, out);
    },
  };
}
