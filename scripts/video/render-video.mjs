// Turns a how-to video script into a finished video.
//
//   node scripts/video/render-video.mjs scripts/video/scripts/2.1-screen-tour.mjs
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
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { ROOT, readAzureKey, synthesize, pace } from './azure.mjs';
import { makeCompanion, placeInCourse, MAX_PAGE_STEPS } from './companion.mjs';

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
  if (!selector) return null;
  // "all:<css>" rings every visible match at once, as one box (a whole group of
  // buttons). Otherwise the selector is resolved through Puppeteer, so a script
  // can name a control by its words with ::-p-text(...), as a person would.
  let handle;
  if (selector.startsWith('all:')) {
    handle = await page.evaluateHandle((css) => {
      const els = [...document.querySelectorAll(css)].filter((e) => e.getClientRects().length);
      if (!els.length) return null;
      const rs = els.map((e) => e.getBoundingClientRect());
      const box = { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)),
        right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) };
      return { scrollIntoView() {}, getBoundingClientRect: () => ({ ...box, width: box.right - box.left, height: box.bottom - box.top }) };
    }, selector.slice(4));
    if (!(await handle.jsonValue().catch(() => null)) && !(await handle.evaluate((h) => !!h))) handle = null;
  } else {
    handle = await page.$(selector);
  }
  const ok = handle && await handle.evaluate((el, kind) => {
    el.scrollIntoView({ block: 'nearest' });
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
    return { left: L, top: T, right: R, bottom: B };
  }, kind);
  if (!ok) throw new Error(`STOPPING - nothing on screen matches ${selector}`);
  return ok;
}

const clearMark = (page) => page.evaluate(() => document.getElementById('vid-mark')?.remove());

async function settle(page, step = {}) {
  // Wait until the app has finished speaking, so whether its "now saying" line is
  // in the picture never depends on timing. A step that is about that moment
  // (a holding phrase being said) sets whileSpeaking and skips the wait.
  if (!step.whileSpeaking) {
    await page.waitForFunction(() => !window.__speakingNow, { timeout: 6000 }).catch(() => {});
  }
  // Wait for animations that end. The Listen button pulses forever while it is
  // on, so waiting for every animation would never return; and nothing waits
  // more than three seconds whatever happens.
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter((a) => a.effect?.getComputedTiming?.().iterations !== Infinity)
      .map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 3000)),
  ]));
  // Animations that never end (the Listen button's pulse, the slow pulse on
  // options that may still change) are switched off for the picture, so the
  // screen shows its plain colors. Caught mid-pulse, each render would differ,
  // and a still picture of a pulse at its faintest makes the options look
  // disabled, which they are not.
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      if (a.effect?.getComputedTiming?.().iterations === Infinity) a.cancel();
    }
  });
  // After a click the mouse stays over the button, so it shows its hover look,
  // which a touch screen never shows. Whether it still does by picture time
  // depends on whether the app has redrawn that button since, so pictures
  // differed between renders. Park the pointer off every control first.
  await page.mouse.move(1, 1);
  await pace(300);
}

// Fixed AI answers. The app's request to the AI is answered here, from the
// script, so the options on screen are always the ones the narration describes.
// A request the script did not plan for stops the render rather than showing
// something nobody wrote.
function makeAI(ai = {}) {
  const partnerLines = [...(ai.partnerLines || [])];
  const responseSets = [...(ai.responseSets || [])];
  return async (bodyText) => {
    const body = JSON.parse(bodyText);
    const system = JSON.stringify(body.system || '');
    if (system.includes('role-playing a communication partner')) {
      if (!partnerLines.length) throw new Error('The app asked for a partner line the script does not have.');
      console.log('  [ai] partner line');
      return partnerLines.shift();
    }
    if (body.output_config) {
      if (!responseSets.length) throw new Error('The app asked for options the script does not have.');
      const set = responseSets.shift();
      console.log('  [ai] response options');
      // A set can arrive late on purpose, to show what the app does while it waits.
      if (set.delayMs) await pace(set.delayMs);
      return JSON.stringify({
        partner_action: set.partnerAction || 'QUESTION', turn_status: 'COMPLETE',
        is_repair_initiator: false, offered_options: set.offered || [], offered_range: null,
        responses: set.responses, missing_facts: [], missing_other: [], heard_uncertain: [],
      });
    }
    throw new Error(`The app made an AI request the script did not plan for: ${system.slice(0, 120)}`);
  };
}

async function openApp(browser, script) {
  await browser.defaultBrowserContext().overridePermissions(`http://localhost:${PORT}`, ['microphone']);
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  const answer = makeAI(script.ai);
  // A failure inside the page is otherwise invisible; show it, so a stalled
  // render says why.
  page.on('console', (m) => { if (m.type() === 'error') console.log(`  [page] ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`  [page] ${e.message}`));
  await page.exposeFunction('__videoAI', async (bodyText) => {
    try { return await answer(bodyText); }
    catch (e) { console.log(`  [ai] ${e.message}`); throw e; }
  });
  await page.evaluateOnNewDocument(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (url, init = {}) => {
      if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
        const text = await window.__videoAI(init.body);
        return new Response(JSON.stringify({
          id: 'msg_video', type: 'message', role: 'assistant', model: 'video',
          content: [{ type: 'text', text }], stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      // The key test asks for the list of models. Answered here, so "Test" says the
      // key works without any real key existing.
      if (String(url).startsWith('https://api.anthropic.com/v1/models')) {
        return new Response(JSON.stringify({ data: [] }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return realFetch(url, init);
    };
    // The video supplies every voice itself, so the device's own speech is replaced
    // by a silent stand-in that finishes at once. Without it the app waits on a
    // voice the headless browser may never finish.
    // Everything the app says is kept in window.__spoken, so a script can voice
    // exactly the words the app chose.
    window.__spoken = [];
    const synth = window.speechSynthesis;
    if (synth) {
      // It takes about as long as the words would take to say, so anything the
      // app shows only while it is speaking is on screen long enough to capture.
      window.__speakingNow = false;
      synth.speak = (u) => {
        window.__spoken.push(u.text);
        window.__speakingNow = true;
        setTimeout(() => u.onstart?.(new Event('start')), 30);
        const ms = Math.min(3000, 400 + 55 * (u.text || '').length);
        // A script can hold speech open (window.__holdSpeech) so a picture of the
        // app mid-sentence does not depend on timing; it ends when released.
        const finish = () => {
          if (window.__holdSpeech) return setTimeout(finish, 50);
          window.__speakingNow = false; u.onend?.(new Event('end'));
        };
        setTimeout(finish, ms);
      };
      synth.cancel = () => {};
    }

    // A stand-in microphone. The app's own speech recognizer is replaced by one
    // that hears only what the script tells it to (window.__videoMic.hear), so a
    // "real" conversation can be shown with no microphone and no room noise.
    let live = null;
    class StandInRecognizer {
      constructor() { this.continuous = true; this.interimResults = true; this.lang = 'en-US'; }
      start() { live = this; setTimeout(() => this.onstart?.(new Event('start')), 10); }
      stop() { if (live === this) live = null; setTimeout(() => this.onend?.(new Event('end')), 10); }
      abort() { this.stop(); }
    }
    window.SpeechRecognition = StandInRecognizer;
    window.webkitSpeechRecognition = StandInRecognizer;
    window.__videoMic = {
      isOn: () => !!live,
      hear(text) {
        if (!live) throw new Error('The microphone is not on');
        const result = Object.assign([{ transcript: text, confidence: 0.95 }], { isFinal: true });
        live.onresult?.({ resultIndex: 0, results: [result] });
      },
    };

    // The version line under Start reads "dev" on a local copy, which means
    // nothing to a viewer, so it is hidden in every video.
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      // The blinking text cursor is hidden too: whether a picture catches it on or
      // off is chance, and chance would make two renders of an unchanged video differ.
      st.textContent = '#startVersion { visibility: hidden !important; } * { caret-color: transparent !important; }';
      document.head.appendChild(st);
    });

    // A fixed sequence of "random" numbers, so anything the app picks at random
    // (which holding phrase to say) comes out the same on every render.
    let seed = 20261024;
    Math.random = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  const url = `http://localhost:${PORT}/`;
  // A script that needs saved conversations (review) asks for the app's own
  // in-browser storage, the way an iPad saves, since a folder can only be chosen
  // through Windows' picker, which nothing here can click.
  if (script.inBrowserStorage) {
    await page.evaluateOnNewDocument(() => {
      try { delete Window.prototype.showDirectoryPicker; } catch {}
      try { delete window.showDirectoryPicker; } catch {}
    });
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate((extra) => {
    // A key must be present or Start stops on the "add your key" notice. It is
    // never used: the videos seed their own conversation and call no AI.
    localStorage.setItem('aac_settings', JSON.stringify({
      lastSeenVersion: '99.0.0',
      apiKey: 'sk-ant-video-only-never-sent-0000000000000000000000000',
      ...extra,
    }));
  }, script.settings || {});
  // A script can start with things already saved (people, places, Express Panel
  // buttons), written where the app keeps them in this browser, so a video can
  // begin partway into using the app.
  if (script.storage) {
    await page.evaluate((stored) => {
      for (const [k, v] of Object.entries(stored)) localStorage.setItem(k, JSON.stringify(v));
    }, script.storage);
  }
  await page.goto(url, { waitUntil: 'networkidle0' });
  // A script that shows the very first screens (before Start) opens the app and
  // leaves it there.
  if (script.start === false) return page;
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
  // Working pictures go in the system's temporary folder, not OneDrive, which
  // would otherwise upload every intermediate frame.
  const work = path.join(os.tmpdir(), 'conversant-video', script.id);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  // Lines written in the script are spoken first, so a missing voice or key
  // fails before the browser opens. A line given as a function is the app's own
  // words, and is spoken when the step reaches it.
  // "{next}" in a line names the next video that exists, from course.json, so a
  // closing line stays right when a video is added between two others. Until
  // video 1.4 exists, 1.3 says "Next: Do You Need a Speech Service?"; once it
  // exists, the next sync re-makes 1.3 to say "Keeping Your Information Safe".
  const { next } = placeInCourse(script.id);
  const nextLine = next ? `Next: ${next.title}${/[.?!]$/.test(next.title) ? '' : '.'}` : 'More videos are on the way.';
  for (const step of script.steps) if (typeof step.say === 'string') step.say = step.say.replace('{next}', nextLine);
  for (const step of script.steps) if (typeof step.say === 'string') await speech(step.speaker, step.say);

  const server = await startServer();
  const browser = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  const segments = [];
  const frames = [];
  const srt = [];
  // What "sync videos" uses to tell whether a video changed: every word said
  // or printed, and which voice said it (the "signature"), plus a small copy of
  // each picture in Videos/.frames, compared with tolerance (see sync-videos.mjs).
  // An exact fingerprint of the pictures cannot work: the browser draws the same
  // screen with faintly different edges from run to run.
  const signature = crypto.createHash('sha256');
  signature.update(JSON.stringify({ trouble: script.trouble || [], course: placeInCourse(script.id), voices }));
  const frameDir = path.join(ROOT, 'Videos', '.frames', script.id);
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir, { recursive: true });
  placeInCourse(script.id);   // a script missing from the course stops here, before any work
  // The page's step limit is checked now, not after a two-minute render.
  const pageSteps = script.steps.filter((s) => s.page).length;
  if (pageSteps > MAX_PAGE_STEPS) throw new Error(`STOPPING - ${script.id} marks ${pageSteps} steps for its page; ${MAX_PAGE_STEPS} fit on one page`);
  let t = 0;
  try {
    const page = await openApp(browser, script);
    for (const [i, step] of script.steps.entries()) {
      if (step.before) await step.before(page);
      if (step.until) await step.until(page).catch(async (e) => {
        const fail = path.join(work, 'failed.png');
        await page.screenshot({ path: fail });
        throw new Error(`STOPPING - step ${i + 1}: ${e.message}. The screen at that moment: ${fail}`);
      });
      if (step.waitFor) await page.waitForSelector(step.waitFor, { visible: true, timeout: 15000 })
        .catch(async () => {
          const fail = path.join(work, 'failed.png');
          await page.screenshot({ path: fail });
          throw new Error(`STOPPING - step ${i + 1} waited for ${step.waitFor}, which never appeared. The screen at that moment: ${fail}`);
        });
      await settle(page, step);
      const box = await mark(page, step.tap || step.highlight, step.tap ? 'tap' : 'ring');
      const shot = path.join(work, `${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: shot });
      frames.push({ file: shot, box, view: VIEW });
      // A step with press: true then really taps what it pointed at, so the app
      // does the work and the next picture shows the result.
      if (step.press) {
        await clearMark(page);
        await page.click(step.tap || step.highlight);
      }

      const said = typeof step.say === 'function' ? await step.say(page) : step.say;
      if (!said) throw new Error(`STOPPING - step ${i + 1} has nothing to say`);
      const clip = await speech(step.speaker, said);
      const speak = durationOf(clip);
      const dur = LEAD_S + speak + TAIL_S;
      const seg = path.join(work, `${String(i).padStart(2, '0')}.mp4`);
      run(FFMPEG, ['-y', '-loop', '1', '-framerate', '30', '-i', shot, '-i', clip,
        '-filter_complex', `[1:a]adelay=${Math.round(LEAD_S * 1000)}:all=1,apad[a]`,
        '-map', '0:v', '-map', '[a]', '-t', dur.toFixed(3),
        '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '30',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', seg]);
      segments.push(seg);
      signature.update(JSON.stringify({ speaker: step.speaker, said, page: step.page || null }));
      run(FFMPEG, ['-y', '-v', 'error', '-i', shot, '-vf', 'scale=960:540', path.join(frameDir, `${String(i).padStart(2, '0')}.png`)]);
      srt.push(`${i + 1}\n${srtTime(t + LEAD_S)} --> ${srtTime(t + LEAD_S + speak)}\n${said}\n`);
      t += dur;
      console.log(`step ${i + 1}/${script.steps.length}  ${dur.toFixed(1)}s  ${step.speaker}`);
    }
    // The companion page, from the same pictures, while the browser is still open.
    const pdf = await makeCompanion({ browser, script, frames, seconds: t, ffmpeg: FFMPEG });
    console.log(`${path.relative(ROOT, pdf)}`);
  } finally {
    await browser.close();
    server.kill();
  }

  const list = path.join(work, 'list.txt');
  fs.writeFileSync(list, segments.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  const out = path.join(ROOT, 'Videos', `${script.id}.mp4`);
  run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
  fs.writeFileSync(path.join(ROOT, 'Videos', `${script.id}.srt`), srt.join('\n'));
  fs.writeFileSync(path.join(ROOT, 'Videos', `${script.id}.json`), JSON.stringify({
    id: script.id, signature: signature.digest('hex'), pictures: frames.length,
    seconds: Math.round(t), rendered: new Date().toISOString(),
  }, null, 2));
  console.log(`\n${path.relative(ROOT, out)}  ${durationOf(out).toFixed(1)}s`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
