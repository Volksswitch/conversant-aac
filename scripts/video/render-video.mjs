// Turns a how-to video script into a finished video.
//
//   node scripts/video/render-video.mjs scripts/video/scripts/01-screen-tour.mjs
//
// Output: Videos/<id>.mp4 and Videos/<id>.srt (a caption file a player can show
// on request; nothing is drawn over the picture).
//
// How it works: the app is served locally and opened in a fresh, headless Chrome
// with an empty profile. Only the page itself is captured - never the screen, the
// desktop, or any other window. For each step the renderer puts the app into that
// step's state, draws a ring on the highlighted control, takes a picture, and
// speaks the step's line in that speaker's fixed voice (scripts/video/voices.json).
// Each picture is held for exactly as long as its line takes.
//
// A step whose highlight matches nothing stops the render. That is the check that
// keeps a video from quietly showing a button that has moved or been renamed.
//
// Spoken lines are cached by voice and wording in Videos/.cache, so re-rendering
// after a screen change costs no speech at all.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { ROOT, readAzureKey, synthesize, pace } from './azure.mjs';

const PORT = 8123;
const VIEW = { width: 1280, height: 720, deviceScaleFactor: 1.5 }; // 1920 x 1080 video
const LEAD_S = 0.35;  // quiet before each line
const TAIL_S = 0.65;  // quiet after each line

function findTool(name) {
  const onPath = spawnSync('where', [name], { encoding: 'utf8' });
  if (onPath.status === 0) return onPath.stdout.split(/\r?\n/)[0].trim();
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  const stack = fs.existsSync(base) ? [base] : [];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.toLowerCase() === `${name}.exe`) return p;
    }
  }
  throw new Error(`${name} is not installed. Install it with: winget install Gyan.FFmpeg`);
}
const FFMPEG = findTool('ffmpeg');
const FFPROBE = findTool('ffprobe');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed:\n${r.stderr.slice(-2000)}`);
  return r.stdout;
}
const durationOf = (f) => Number(run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

const voices = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'video', 'voices.json'), 'utf8'));
const cacheDir = path.join(ROOT, 'Videos', '.cache');
fs.mkdirSync(cacheDir, { recursive: true });
let creds = null;
let lastCall = 0;

async function speech(speaker, text) {
  const voice = voices[speaker]?.azure;
  if (!voice) throw new Error(`No voice for speaker "${speaker}" in voices.json`);
  const hash = crypto.createHash('sha1').update(`${voice}\n${text}`).digest('hex').slice(0, 16);
  const file = path.join(cacheDir, `${hash}.mp3`);
  if (!fs.existsSync(file)) {
    creds ??= readAzureKey();
    const wait = 4000 - (Date.now() - lastCall); // free tier: 20 a minute
    if (wait > 0) await pace(wait);
    fs.writeFileSync(file, await synthesize(creds, voice, text));
    lastCall = Date.now();
  }
  return file;
}

async function startServer() {
  const proc = spawn('python', [path.join(ROOT, 'scripts', 'dev-server.py'), String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return proc; } catch {}
    await pace(200);
  }
  proc.kill();
  throw new Error('The local app server did not start.');
}

// Rings and taps are drawn by the video, not by the app: an overlay above
// everything, positioned on the target's own box.
async function mark(page, selector, kind) {
  await page.evaluate(() => document.getElementById('vid-mark')?.remove());
  if (!selector) return;
  const ok = await page.evaluate((sel, kind) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const m = document.createElement('div');
    m.id = 'vid-mark';
    // Grow the ring a little past the target, but never past the edge of the
    // page, or a control at the edge loses part of its ring.
    const pad = 4, W = innerWidth, H = innerHeight;
    const L = Math.max(0, r.left - pad), T = Math.max(0, r.top - pad);
    const R = Math.min(W, r.right + pad), B = Math.min(H, r.bottom + pad);
    Object.assign(m.style, {
      position: 'fixed', left: `${L}px`, top: `${T}px`,
      width: `${R - L}px`, height: `${B - T}px`,
      border: '5px solid #FF6D00', borderRadius: '10px', boxSizing: 'border-box',
      boxShadow: '0 0 0 3px rgba(255,255,255,0.9), 0 0 18px rgba(255,109,0,0.6)',
      pointerEvents: 'none', zIndex: 2147483647,
    });
    if (kind === 'tap') {
      const dot = document.createElement('div');
      Object.assign(dot.style, {
        // Low and to the right, so the dot does not cover the words being tapped.
        position: 'absolute', left: '75%', top: '72%', width: '46px', height: '46px',
        margin: '-23px 0 0 -23px', borderRadius: '50%',
        background: 'rgba(255,109,0,0.55)', border: '3px solid #fff',
      });
      m.appendChild(dot);
    }
    // The top layer sits above any z-index, so the mark must live in an open dialog
    // when one is showing, or it would be drawn underneath it.
    (document.querySelector('dialog[open]') || document.body).appendChild(m);
    return true;
  }, selector, kind);
  if (!ok) throw new Error(`STOPPING - nothing on screen matches ${selector}`);
}

async function settle(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  await pace(300);
}

async function openApp(browser) {
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  const url = `http://localhost:${PORT}/`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    // A key must be present or Start stops on the "add your key" notice. It is
    // never used: the videos seed their own conversation and call no AI.
    localStorage.setItem('aac_settings', JSON.stringify({
      lastSeenVersion: '99.0.0',
      apiKey: 'sk-ant-video-only-never-sent-0000000000000000000000000',
    }));
  });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.click('#startBtn');
  await pace(1200);
  const started = await page.evaluate(() => {
    const b = document.getElementById('startBlock');
    return !b || b.hidden || b.offsetParent === null;
  });
  if (!started) throw new Error('STOPPING - the app did not get past the start screen');
  return page;
}

function srtTime(s) {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

async function main() {
  const scriptPath = process.argv[2];
  if (!scriptPath) throw new Error('Usage: node scripts/video/render-video.mjs <script.mjs>');
  const script = (await import(pathToFileURL(path.resolve(scriptPath)).href)).default;
  const work = path.join(ROOT, 'Videos', '.work', script.id);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  // Speech first: it costs money and is slow, and every line must exist before
  // any picture is worth taking.
  const clips = [];
  for (const step of script.steps) clips.push(await speech(step.speaker, step.say));

  const server = await startServer();
  const browser = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  const segments = [];
  const srt = [];
  let t = 0;
  try {
    const page = await openApp(browser);
    for (const [i, step] of script.steps.entries()) {
      if (step.before) await step.before(page);
      await settle(page);
      await mark(page, step.tap || step.highlight, step.tap ? 'tap' : 'ring');
      const shot = path.join(work, `${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: shot });

      const speak = durationOf(clips[i]);
      const dur = LEAD_S + speak + TAIL_S;
      const seg = path.join(work, `${String(i).padStart(2, '0')}.mp4`);
      run(FFMPEG, ['-y', '-loop', '1', '-framerate', '30', '-i', shot, '-i', clips[i],
        '-filter_complex', `[1:a]adelay=${Math.round(LEAD_S * 1000)}:all=1,apad[a]`,
        '-map', '0:v', '-map', '[a]', '-t', dur.toFixed(3),
        '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '30',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', seg]);
      segments.push(seg);
      srt.push(`${i + 1}\n${srtTime(t + LEAD_S)} --> ${srtTime(t + LEAD_S + speak)}\n${step.say}\n`);
      t += dur;
      console.log(`step ${i + 1}/${script.steps.length}  ${dur.toFixed(1)}s  ${step.speaker}`);
    }
  } finally {
    await browser.close();
    server.kill();
  }

  const list = path.join(work, 'list.txt');
  fs.writeFileSync(list, segments.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  const out = path.join(ROOT, 'Videos', `${script.id}.mp4`);
  run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  fs.writeFileSync(path.join(ROOT, 'Videos', `${script.id}.srt`), srt.join('\n'));
  console.log(`\n${path.relative(ROOT, out)}  ${durationOf(out).toFixed(1)}s`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
