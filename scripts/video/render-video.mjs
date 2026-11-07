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
import { readElevenKey, synthesizeEleven } from './elevenlabs.mjs';
import { makeFramer } from './frame.mjs';

const PORT = 8123;
const VIEW = { width: 1280, height: 720, deviceScaleFactor: 1.5 }; // 1920 x 1080 video
const LEAD_S = 0.35;  // quiet before each line
const VIDEO_CLOCK = '2026-10-24T17:54:00';  // local time every render starts at (see the page clock below)
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
// A script may bring its own cast (the demo video: Ken's cloned voice and three
// ElevenLabs voices). Speakers it does not name keep their voices.json voice.
let cast = voices;
let elevenKey = null;
const cacheDir = path.join(ROOT, 'Videos', '.cache');
fs.mkdirSync(cacheDir, { recursive: true });
let creds = null;
let lastCall = 0;

// Words with pinned sounds (pronounce.json). A step with pronounce: true gets
// every one that appears in its line; null otherwise, so the cache key of every
// other line is exactly what it always was and its audio is never made again.
const PRONOUNCE = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'video', 'pronounce.json'), 'utf8')).words;
function pinsFor(step, text) {
  if (!step.pronounce) return null;
  const pins = Object.fromEntries(Object.entries(PRONOUNCE).filter(([w]) => new RegExp(`\\b${w}\\b`).test(text)));
  if (!Object.keys(pins).length) throw new Error(`STOPPING - a step asks for pronounce but its line has no word from pronounce.json: ${text}`);
  return pins;
}

async function speech(speaker, text, pins = null) {
  const eleven = cast[speaker]?.eleven;
  if (eleven) {
    if (pins) throw new Error(`STOPPING - pinned sounds work only with Azure voices (speaker "${speaker}")`);
    const one = async (t) => {
      const id = `eleven:${eleven.id}:${eleven.model || ''}:${JSON.stringify(eleven.settings || null)}:${eleven.speed ?? ''}\n${t}`;
      const file = path.join(cacheDir, `${crypto.createHash('sha1').update(id).digest('hex').slice(0, 16)}.mp3`);
      if (!fs.existsSync(file)) {
        elevenKey ??= readElevenKey();
        fs.writeFileSync(file, await synthesizeEleven(elevenKey, eleven, t));
      }
      return file;
    };
    // A voice with `gap` says each sentence on its own and joins them with that
    // much quiet, so a narrator does not run one sentence into the next (Ken,
    // November 7 2026: "put more natural, relaxed delays between sentences").
    // A title's full stop ("Ms. Marvel") is not the end of a sentence.
    const kept = text.replace(/\b(Ms|Mr|Mrs|Dr|St)\./g, '$1\u0001');
    const sentences = eleven.gap
      ? kept.match(/[^.?!]+[.?!]+["'\u2019\u201d]*\s*|[^.?!]+$/g).map((x) => x.replace(/\u0001/g, '.').trim()).filter(Boolean)
      : [text];
    if (sentences.length < 2) return one(text);
    const parts = [];
    for (const t of sentences) parts.push(await one(t));
    const id = `joined:${eleven.gap}:${parts.join('|')}`;
    const file = path.join(cacheDir, `${crypto.createHash('sha1').update(id).digest('hex').slice(0, 16)}.mp3`);
    if (!fs.existsSync(file)) {
      const gap = silence(eleven.gap, path.join(cacheDir, `gap-${eleven.gap.toFixed(2)}-44k.mp3`), 44100);
      const inputs = parts.flatMap((f, i) => (i ? [gap, f] : [f]));
      run(FFMPEG, ['-y', '-v', 'error', ...inputs.flatMap((f) => ['-i', f]),
        '-filter_complex', `${inputs.map((_, i) => `[${i}:a]`).join('')}concat=n=${inputs.length}:v=0:a=1[a]`,
        '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', file]);
    }
    return file;
  }
  const voice = cast[speaker]?.azure;
  if (!voice) throw new Error(`No voice for speaker "${speaker}" in voices.json`);
  const key = `${voice}\n${text}${pins ? `\n${JSON.stringify(pins)}` : ''}`;
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
  const file = path.join(cacheDir, `${hash}.mp3`);
  if (!fs.existsSync(file)) {
    creds ??= readAzureKey();
    const wait = 4000 - (Date.now() - lastCall); // free tier: 20 a minute
    if (wait > 0) await pace(wait);
    fs.writeFileSync(file, await synthesize(creds, voice, text, pins));
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
      const clip = (e) => {
        let r = e.getBoundingClientRect();
        let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        for (let a = e.parentElement; a; a = a.parentElement) {
          const o = getComputedStyle(a).overflowY + getComputedStyle(a).overflowX;
          if (!/auto|scroll|hidden/.test(o)) continue;
          const c = a.getBoundingClientRect();
          box = { left: Math.max(box.left, c.left), top: Math.max(box.top, c.top),
            right: Math.min(box.right, c.right), bottom: Math.min(box.bottom, c.bottom) };
        }
        return box;
      };
      const rs = [...document.querySelectorAll(css)].filter((e) => e.getClientRects().length)
        .map(clip).filter((b) => b.right - b.left > 2 && b.bottom - b.top > 2);
      if (!rs.length) return null;
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
// REAL answers, recorded once and then fixed (the demo video, Ken November 7 2026).
// With --capture every request the app makes goes to the real AI with the key in
// .anthropic-key, and the whole answer, plus how long it took, is saved to the
// script's recording file. Every later render answers from that file in the same
// order, after the same wait, so the video repeats exactly and still shows only
// words the AI actually wrote. A request that does not line up with the recording
// (a different kind, or one too many) stops the render: the script has changed
// and needs a fresh --capture.
const kindOf = (body) => {
  const system = JSON.stringify(body.system || '');
  if (system.includes('role-playing a communication partner')) return 'partner line';
  if (body.output_config) return 'response options';
  return 'other';
};
const MIN_WAIT_MS = 2600;  // see the replay below
function makeRecordedAI(file, capture, page) {
  // A step can hold the next set of options back (page.holdNextOptions()) until it
  // calls page.releaseOptions(), so a picture taken while a holding phrase plays
  // never depends on how fast the answer came.
  let hold = false, release = null, released = false;
  page.holdNextOptions = () => { hold = true; released = false; };
  page.releaseOptions = () => { if (release) { release(); release = null; } else released = true; };
  const saved = !capture && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (!capture && !saved) throw new Error(`STOPPING - no recorded AI answers yet. Run once with --capture to record them: ${path.relative(ROOT, file)}`);
  const recording = capture ? { note: 'Real AI answers recorded by render-video.mjs --capture. Do not edit by hand.', recorded: new Date().toISOString(), answers: [] } : saved;
  let next = 0;
  const answer = async (bodyText) => {
    const body = JSON.parse(bodyText);
    const kind = kindOf(body);
    // A step can wait for the request a tap set off and learn how long its answer
    // took (page.aiRequests counts requests begun; page.lastAIms is that wait in
    // ms), so the video holds a picture exactly as long as the real wait.
    let tell;
    page.aiRequests = (page.aiRequests || 0) + 1;
    page.lastAIms = new Promise((r) => { tell = r; });
    if (!capture) {
      const a = recording.answers[next++];
      if (!a) throw new Error(`STOPPING - the app asked for ${kind} beyond the recording. Re-record with --capture.`);
      if (a.kind !== kind) throw new Error(`STOPPING - request ${next} is ${kind} but the recording has ${a.kind}. Re-record with --capture.`);
      tell(a.kind === 'response options' ? Math.max(a.ms, MIN_WAIT_MS) : a.ms);
      // The real wait, so a holding phrase plays exactly where it did for real. A
      // floor keeps the first holding phrase (spoken 2 seconds after the pause)
      // from depending on a lucky fast answer; real waits are 3 to 8 seconds.
      await pace(a.kind === 'response options' ? Math.max(a.ms, MIN_WAIT_MS) : a.ms);
      if (hold && a.kind === 'response options') {
        hold = false;
        if (!released) await new Promise((r) => { release = r; });
        released = false;
      }
      console.log(`  [ai] ${kind} (recorded)`);
      return { full: JSON.stringify(a.response) };
    }
    const key = fs.readFileSync(path.join(ROOT, '.anthropic-key'), 'utf8').split(/\r?\n/)[0].trim();
    const t0 = Date.now();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: bodyText,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`The real AI refused: ${r.status} ${text.slice(0, 300)}`);
    const ms = Date.now() - t0;
    tell(kind === 'response options' ? Math.max(ms, MIN_WAIT_MS) : ms);
    const response = JSON.parse(text);
    const words = (response.content || []).find((c) => c.type === 'text')?.text || '';
    recording.answers.push({ kind, ms, response, words });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(recording, null, 2));
    console.log(`  [ai] ${kind} (live, ${ms} ms)`);
    if (hold && kind === 'response options') {
      hold = false;
      if (!released) await new Promise((r) => { release = r; });
      released = false;
    }
    return { full: text };
  };
  answer.check = () => {
    if (!capture && next !== recording.answers.length) {
      throw new Error(`STOPPING - the recording holds ${recording.answers.length} answers but the app asked for ${next}. Re-record with --capture.`);
    }
  };
  return answer;
}

function makeAI(ai = {}, page) {
  if (ai.recording) {
    const answer = makeRecordedAI(path.join(ROOT, ai.recording), process.argv.includes('--capture'), page);
    page.checkAI = answer.check;
    return answer;
  }
  const partnerLines = [...(ai.partnerLines || [])];
  const responseSets = [...(ai.responseSets || [])];
  // A set marked untilReleased is held until a step calls page.releaseOptions().
  // A fixed delay is not enough: how long the steps before it take varies from
  // render to render, so the options could land a step early (October 31 2026,
  // video 2.7 showed them while the narrator was still saying they had not come).
  let release = null;
  let released = false;
  page.releaseOptions = () => {
    if (release) { release(); release = null; } else released = true;
  };
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
      if (set.untilReleased) {
        if (!released) await new Promise((r) => { release = r; });
        released = false;
      }
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
  const answer = makeAI(script.ai, page);
  // A failure inside the page is otherwise invisible; show it, so a stalled
  // render says why.
  page.on('console', (m) => { if (m.type() === 'error') console.log(`  [page] ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`  [page] ${e.message}`));
  await page.exposeFunction('__videoAI', async (bodyText) => {
    // page.aiCount lets a script wait for an answer to land (a refresh after New 4,
    // Reframe or a goal button, where the old options stay on screen meanwhile).
    try { const r = await answer(bodyText); page.aiCount = (page.aiCount || 0) + 1; return r; }
    catch (e) { console.log(`  [ai] ${e.message}`); throw e; }
  });
  await page.evaluateOnNewDocument(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (url, init = {}) => {
      if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
        const text = await window.__videoAI(init.body);
        if (text && typeof text === 'object' && text.full) {
          return new Response(text.full, { status: 200, headers: { 'content-type': 'application/json' } });
        }
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
  // Every render runs on the same clock, so a date or time the app shows (the
  // review list's "Sat, Oct 24, 5:54 PM", a "{time of day}" phrase) comes out the
  // same each time. Without it the change check calls a video changed every day it
  // is re-made. The clock still ticks from that moment, so durations stay real.
  // The default is when the published 3.10 was made; a script may give its own.
  await page.evaluateOnNewDocument((startAt) => {
    const RealDate = Date;
    const offset = new RealDate(startAt).getTime() - RealDate.now();
    class VideoDate extends RealDate {
      constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + offset); }
      static now() { return RealDate.now() + offset; }
    }
    window.Date = VideoDate;
  }, script.clock || VIDEO_CLOCK);
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
  // A script can start from a whole backup file (the demo's Marc), written where an
  // import would put it: each data file into the app's own storage, and the saved
  // conversations into the in-browser conversations folder (so the script must
  // also ask for inBrowserStorage). The file-to-storage list is data-transfer.js's.
  if (script.backup) {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, script.backup), 'utf8'));
    // Changes for the video only; the backup file itself is never touched.
    if (script.adjustBackup) script.adjustBackup(pkg);
    const CACHES = {
      'worldview.json': 'aac_worldview', 'relationships.json': 'aac_relationships',
      'places.json': 'aac_places', 'practice-scenarios.json': 'aac_practice_scenarios',
      'control-phrases.json': 'aac_control_phrases', 'placeholders.json': 'aac_placeholders',
      'express-panel.json': 'aac_express_items', 'voice.json': 'aac_voice',
    };
    const data = {};
    for (const [file, value] of Object.entries(pkg.data || {})) {
      if (!CACHES[file]) throw new Error(`STOPPING - the backup holds ${file}, which the video does not know how to load`);
      data[CACHES[file]] = value;
    }
    if ((pkg.conversations || []).length && !script.inBrowserStorage) {
      throw new Error('STOPPING - a backup with conversations needs inBrowserStorage: true');
    }
    await page.evaluate(async (stored, convos) => {
      for (const [k, v] of Object.entries(stored)) localStorage.setItem(k, JSON.stringify(v));
      if (!convos.length) return;
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('conversations', { create: true });
      const put = async (name, value) => {
        const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await w.write(JSON.stringify(value, null, 2));
        await w.close();
      };
      for (const c of convos) {
        await put(`${c.id}.json`, c.data);
        if (c.review && typeof c.review === 'object') await put(`${c.id}.review.json`, c.review);
      }
    }, data, pkg.conversations || []);
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

// Videos made from hand-taken screenshots (the device's own screens, which the
// program cannot reach: a browser's menus, the Home Screen, a file picker). A step
// names its picture with `image` (a path inside Videos/), and `ring` is the box to
// point at, in that picture's own pixels: [left, top, width, height]. `blur` lists
// boxes to hide (an email address, a folder name). The picture is fitted onto the
// video's frame, and the ring is drawn by the same code as in a live video.
async function openPictures(browser) {
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  return page;
}

async function showPicture(page, step) {
  const file = path.join(ROOT, 'Videos', step.image);
  if (!fs.existsSync(file)) throw new Error(`STOPPING - the picture ${step.image} is missing`);
  const data = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  const [iw, ih] = run(FFPROBE, ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0', file]).trim().split(',').map(Number);
  const k = Math.min(VIEW.width / iw, VIEW.height / ih);
  const ox = (VIEW.width - iw * k) / 2, oy = (VIEW.height - ih * k) / 2;
  const box = ([x, y, w, h], extra) => `position:absolute;left:${ox + x * k}px;top:${oy + y * k}px;width:${w * k}px;height:${h * k}px;${extra}`;
  const blurs = (step.blur || []).map((b) => `<div style="${box(b, 'backdrop-filter:blur(7px);background:rgba(240,240,240,0.35);')}"></div>`).join('');
  await page.setContent(`<!doctype html><html><body style="margin:0;width:100vw;height:100vh;overflow:hidden;background:#1d2733;">
    <img src="${data}" style="position:absolute;left:${ox}px;top:${oy}px;width:${iw * k}px;height:${ih * k}px;">
    ${blurs}${step.ring ? `<div id="vid-target" style="${box(step.ring, '')}"></div>` : ''}</body></html>`, { waitUntil: 'load' });
}

function srtTime(s) {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

// A silent stretch of audio, for a step that shows something without a word said
// (a caption-only moment in the demo).
function silence(seconds, file, rate = 48000) {
  if (!fs.existsSync(file)) {
    run(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=${rate}:cl=${rate === 48000 ? 'stereo' : 'mono'}`,
      '-t', seconds.toFixed(3), '-c:a', 'libmp3lame', '-b:a', '64k', file]);
  }
  return file;
}

async function main() {
  const scriptPath = process.argv[2];
  if (!scriptPath) throw new Error('Usage: node scripts/video/render-video.mjs <script.mjs> [--capture]');
  const script = (await import(pathToFileURL(path.resolve(scriptPath)).href)).default;
  // A STANDALONE video (the demo) is not part of the course: no "Next:" line, no
  // companion page, no change-check pictures, and it is written to its own folder.
  const standalone = !!script.standalone;
  cast = { ...voices, ...(script.voices || {}) };
  // Working pictures go in the system's temporary folder, not OneDrive, which
  // would otherwise upload every intermediate frame.
  const work = path.join(os.tmpdir(), 'conversant-video', script.id);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  const endings = script.endings || null;
  const endingSteps = endings ? Object.values(endings).flatMap((e) => e.steps) : [];
  for (const step of endingSteps) {
    if (!step.card) throw new Error('STOPPING - an ending may only hold title cards, so every version shares one app run');
  }

  // Lines written in the script are spoken first, so a missing voice or key
  // fails before the browser opens. A line given as a function is the app's own
  // words, and is spoken when the step reaches it.
  // "{next}" in a line names the next video that exists, from course.json, so a
  // closing line stays right when a video is added between two others. Until
  // video 1.4 exists, 1.3 says "Next: Do You Need a Speech Service?"; once it
  // exists, the next sync re-makes 1.3 to say "Keeping Your Information Safe".
  // The last video in the course says nothing after its own last line.
  const { next } = standalone ? { next: null } : placeInCourse(script.id);
  const nextLine = next ? `Next: ${next.title}${/[.?!]$/.test(next.title) ? '' : '.'}` : '';
  const allSteps = [...script.steps, ...endingSteps];
  for (const step of allSteps) if (typeof step.say === 'string') step.say = step.say.replace('{next}', nextLine).trim();
  for (const step of allSteps) if (typeof step.say === 'string') await speech(step.speaker, step.say, pinsFor(step, step.say));

  const server = script.pictures ? null : await startServer();
  const browser = await puppeteer.launch({ headless: true, args: ['--mute-audio'] });
  // The framer is its own browser, so drawing a caption never touches the app's page.
  const framerBrowser = (script.framed || allSteps.some((s) => s.card)) ? await puppeteer.launch({ headless: true }) : null;
  const framer = framerBrowser ? await makeFramer(framerBrowser, VIEW) : null;
  const frames = [];
  const srt = [];
  // What "sync videos" uses to tell whether a video changed: every word said
  // or printed, and which voice said it (the "signature"), plus a small copy of
  // each picture in Videos/.frames, compared with tolerance (see sync-videos.mjs).
  // An exact fingerprint of the pictures cannot work: the browser draws the same
  // screen with faintly different edges from run to run.
  const signature = crypto.createHash('sha256');
  signature.update(JSON.stringify({ trouble: script.trouble || [], course: standalone ? null : placeInCourse(script.id), voices: cast }));
  const frameDir = path.join(ROOT, 'Videos', '.frames', script.id);
  if (!standalone) {
    fs.rmSync(frameDir, { recursive: true, force: true });
    fs.mkdirSync(frameDir, { recursive: true });
    // The page's step limit is checked now, not after a two-minute render.
    const pageSteps = script.steps.filter((s) => s.page).length;
    if (pageSteps > MAX_PAGE_STEPS) throw new Error(`STOPPING - ${script.id} marks ${pageSteps} steps for its page; ${MAX_PAGE_STEPS} fit on one page`);
  }

  // One step: its picture, its sound, and its stretch of video.
  let counter = 0;
  const makeSegment = async (page, step, i, label) => {
    const n = String(counter++).padStart(3, '0');
    let shot = path.join(work, `${n}.png`);
    let box = null;
    if (step.card) {
      // A title card can still act on the app behind it (end a conversation, set
      // something up) before or after it is shown.
      if (step.before && !script.pictures) await step.before(page);
      await framer.card(step.card, shot);
      if (step.after && !script.pictures) await step.after(page);
    } else {
      if (script.pictures) {
        if (!step.image) throw new Error(`STOPPING - step ${label} has no picture`);
        await showPicture(page, step);
        if (step.ring) step[step.tap ? 'tap' : 'highlight'] = '#vid-target';
        else delete step.tap;
      }
      if (step.before) await step.before(page);
      if (step.until) await step.until(page).catch(async (e) => {
        const fail = path.join(work, 'failed.png');
        await page.screenshot({ path: fail });
        throw new Error(`STOPPING - step ${label}: ${e.message}. The screen at that moment: ${fail}`);
      });
      if (step.waitFor) await page.waitForSelector(step.waitFor, { visible: true, timeout: 20000 })
        .catch(async () => {
          const fail = path.join(work, 'failed.png');
          await page.screenshot({ path: fail });
          throw new Error(`STOPPING - step ${label} waited for ${step.waitFor}, which never appeared. The screen at that moment: ${fail}`);
        });
      await settle(page, step);
      // A tap can be worked out at the moment (the demo picks the option whose
      // words fit, since the real AI decides which position it lands in).
      const tap = typeof step.tap === 'function' ? await step.tap(page) : step.tap;
      box = await mark(page, tap || step.highlight, tap ? 'tap' : 'ring');
      await page.screenshot({ path: shot });
      if (script.framed) {
        const raw = shot;
        shot = path.join(work, `${n}-framed.png`);
        await framer.framed(raw, step.caption || '', shot);
      }
      // A step with press: true then really taps what it pointed at, so the app
      // does the work and the next picture shows the result.
      if (step.press && !script.pictures) {
        await clearMark(page);
        await page.click(tap || step.highlight);
      }
      if (step.after) await step.after(page);
    }
    frames.push({ file: shot, box, view: VIEW });

    const said = typeof step.say === 'function' ? await step.say(page) : step.say;
    let clip;
    let speak = 0;
    if (said) {
      const pins = pinsFor(step, said);
      clip = await speech(step.speaker, said, pins);
      speak = durationOf(clip);
      signature.update(JSON.stringify({ speaker: step.speaker, said, page: step.page || null, pronounce: pins || undefined }));
    } else if (step.hold) {
      clip = silence(step.hold, path.join(cacheDir, `silence-${step.hold.toFixed(2)}.mp3`));
      speak = step.hold;
      signature.update(JSON.stringify({ hold: step.hold, caption: step.caption || null, card: step.card || null }));
    } else {
      throw new Error(`STOPPING - step ${label} has nothing to say and no hold time`);
    }
    if (step.caption || step.card) signature.update(JSON.stringify({ caption: step.caption || null, card: step.card || null }));
    // A script may set its own quiet before and after every line, and a step's
    // tail may be worked out at the moment (how long the real AI took to answer).
    const lead = typeof step.lead === 'function' ? await step.lead(page) : (step.lead ?? script.lead ?? LEAD_S);
    const tail = typeof step.tail === 'function' ? await step.tail(page, { lead, speak }) : (step.tail ?? script.tail ?? TAIL_S);
    const dur = lead + speak + tail;
    const seg = path.join(work, `${n}.mp4`);
    run(FFMPEG, ['-y', '-loop', '1', '-framerate', '30', '-i', shot, '-i', clip,
      '-filter_complex', `[1:a]adelay=${Math.round(lead * 1000)}:all=1,apad[a]`,
      '-map', '0:v', '-map', '[a]', '-t', dur.toFixed(3),
      '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', seg]);
    if (!standalone) {
      run(FFMPEG, ['-y', '-v', 'error', '-i', shot, '-vf', 'scale=960:540', path.join(frameDir, `${n.slice(1)}.png`)]);
    }
    console.log(`step ${label}  ${dur.toFixed(1)}s  ${step.speaker || (step.card ? 'card' : 'silent')}`);
    return { seg, dur, lead, speak, said };
  };

  const main = [];
  const variants = {};
  try {
    const page = script.pictures ? await openPictures(browser) : await openApp(browser, script);
    for (const [i, step] of script.steps.entries()) {
      main.push(await makeSegment(page, step, i, `${i + 1}/${script.steps.length}`));
    }
    page.checkAI?.();
    for (const [name, ending] of Object.entries(endings || {})) {
      variants[name] = [];
      for (const [i, step] of ending.steps.entries()) variants[name].push(await makeSegment(page, step, i, `${name} ${i + 1}/${ending.steps.length}`));
    }
    // The companion page, from the same pictures, while the browser is still open.
    if (!standalone) {
      const seconds = main.reduce((a, s) => a + s.dur, 0);
      const pdf = await makeCompanion({ browser, script, frames, seconds, ffmpeg: FFMPEG });
      console.log(`${path.relative(ROOT, pdf)}`);
    }
  } finally {
    await browser.close();
    await framerBrowser?.close();
    server?.kill();
  }

  // Each version is the shared main run plus its own ending (or the main run alone).
  const outDir = path.join(ROOT, 'Videos', ...(script.outDir ? [script.outDir] : []));
  fs.mkdirSync(outDir, { recursive: true });
  const versions = endings
    ? Object.entries(endings).map(([name, e]) => ({ name: e.file || `${script.id}-${name}`, segs: [...main, ...variants[name]] }))
    : [{ name: script.id, segs: main }];
  for (const v of versions) {
    const list = path.join(work, `list-${v.name.replace(/[^\w-]/g, '_')}.txt`);
    fs.writeFileSync(list, v.segs.map((s) => `file '${s.seg.replace(/\\/g, '/')}'`).join('\n'));
    const out = path.join(outDir, `${v.name}.mp4`);
    run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]);
    // The caption file: every spoken line at the moment it is heard.
    let t = 0, k = 0;
    const lines = [];
    for (const s of v.segs) {
      if (s.said) lines.push(`${++k}\n${srtTime(t + s.lead)} --> ${srtTime(t + s.lead + s.speak)}\n${s.said}\n`);
      t += s.dur;
    }
    fs.writeFileSync(path.join(outDir, `${v.name}.srt`), lines.join('\n'));
    console.log(`\n${path.relative(ROOT, out)}  ${durationOf(out).toFixed(1)}s`);
  }
  // The how-to videos' change check reads this; one signature covers every version.
  fs.writeFileSync(path.join(outDir, `${script.id}.json`), JSON.stringify({
    id: script.id, signature: signature.digest('hex'), pictures: frames.length,
    seconds: Math.round(main.reduce((a, s) => a + s.dur, 0)), rendered: new Date().toISOString(),
  }, null, 2));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
