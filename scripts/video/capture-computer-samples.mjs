// Real screenshots, taken on this computer, of the screens Ken captures by hand
// for the "Getting started" videos, so the iPad and Android captures can match
// them. A visible test copy of Chrome (its own empty profile) is opened on the
// real site; only that window's rectangle of the screen is captured, never the
// rest of the desktop.
//
// Only things inside the web page are clicked. Chrome's own buttons and menus are
// not, so a screen that needs one (the browser menu, a folder chosen in the picker)
// cannot be captured here and is marked as missing in the document.
//
//   node scripts/video/capture-computer-samples.mjs  ->  Videos/screenshot-samples/*.png

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer';
import { ROOT } from './azure.mjs';

const SITE = 'https://conversant.volksswitch.org/';
const OUT = path.join(ROOT, 'Videos', 'screenshot-samples');
fs.mkdirSync(OUT, { recursive: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const magick = (args) => {
  const r = spawnSync('magick', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`magick failed: ${r.stderr}`);
};

// The window's rectangle on the physical screen, from the page's own view of it.
async function grab(page, name) {
  await page.bringToFront();
  await pause(600);
  // Clipped to the part of the screen above the taskbar (availHeight), so nothing
  // of the desktop can get into the picture even if the window runs under it.
  const r = await page.evaluate(() => ({
    x: window.screenX, y: window.screenY, w: window.outerWidth,
    h: Math.min(window.outerHeight, screen.availHeight - window.screenY), k: window.devicePixelRatio,
  }));
  const k = r.k;
  const file = path.join(OUT, `${name}.png`);
  const res = spawnSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'scripts', 'video', 'capture-screen.ps1'),
    '-X', String(Math.round(r.x * k)), '-Y', String(Math.round(r.y * k)),
    '-W', String(Math.round(r.w * k)), '-H', String(Math.round(r.h * k)), '-Out', file], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`screen capture failed: ${res.stderr}`);
  // Windows draws an invisible border round every window, so the rectangle
  // includes a sliver of whatever is behind it. Trim it off.
  const edge = Math.round(8 * k);
  magick([file, '-gravity', 'northwest', '-crop', `${Math.round(r.w * k) - 2 * edge}x${Math.round(r.h * k) - edge}+${edge}+${edge}`, '+repage', file]);
  console.log(`  ${name}.png`);
}

async function open({ app = false } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'conversant-sample-'));
  const browser = await puppeteer.launch({
    // The installed Chrome, as a viewer would see it, with a blank profile of its own.
    headless: false, defaultViewport: null, userDataDir: profile, channel: 'chrome',
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--window-position=40,30', '--window-size=1200,760', '--no-first-run', '--no-default-browser-check',
      ...(app ? [`--app=${SITE}`] : [])],
  });
  const page = (await browser.pages())[0] || await browser.newPage();
  // Keep Chrome's install offer, so the page can ask Chrome to show its install box.
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__install = e; });
  });
  if (!app) await page.goto(SITE, { waitUntil: 'networkidle2' });
  else await pause(4000);
  return { browser, page, profile };
}

async function close({ browser, profile }) {
  await browser.close().catch(() => {});
  fs.rmSync(profile, { recursive: true, force: true });
}

// 1.2 on a computer
{
  const s = await open();
  await pause(4000);                       // let Chrome decide the site can be installed
  await grab(s.page, '1.2-computer-01-site-open');
  const offered = await s.page.evaluate(() => !!window.__install);
  if (offered) {
    // A click in the page counts as the person's tap, which Chrome requires before
    // the page may show the install box.
    await s.page.mouse.click(640, 300);
    await s.page.evaluate(() => { window.__install.prompt(); });
    await pause(1500);
    await grab(s.page, '1.2-computer-03-install-box');
  } else {
    console.log('  Chrome did not offer to install the site; no install-box picture');
  }
  await close(s);
}
{
  const s = await open({ app: true });
  await grab(s.page, '1.2-computer-04-own-window');
  await close(s);
}

// 1.4 on a computer: the folder picker, opened from Settings, General, Data Folder.
{
  const s = await open();
  const p = s.page;
  await p.evaluate(() => localStorage.setItem('aac_settings', JSON.stringify({ lastSeenVersion: '99.0.0',
    apiKey: 'sk-ant-sample-only-never-sent-0000000000000000000000000' })));
  await p.goto(SITE, { waitUntil: 'networkidle2' });
  await p.click('#startBtn'); await pause(1200);
  await p.click('#settingsBtn'); await pause(800);
  await p.click('::-p-xpath(//dialog[@open]//summary[.//*[normalize-space(text())="Data Folder"]])'); await pause(600);
  await grab(p, '1.4-computer-00-choose-folder-button');
  await p.click('#pickFolderBtn').catch(() => {});
  await pause(1200);
  // Conversant explains what the folder holds before the picker opens.
  await grab(p, '1.4-computer-01-before-you-choose');
  await p.click('::-p-xpath(//button[normalize-space(.)="Choose a folder"])').catch(() => {});
  await pause(2500);
  await grab(p, '1.4-computer-02-folder-picker');
  // The picker opens on this computer's own folders, so everything below its title
  // line is blurred: the picture shows the kind of window, not what is in it.
  const picker = path.join(OUT, '1.4-computer-02-folder-picker.png');
  magick([picker, '(', '+clone', '-region', '100%x93%+0+50', '-blur', '0x14', ')', '-delete', '0', picker]);
  await close(s);
}
