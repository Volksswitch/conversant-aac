// "sync videos": re-make every how-to video, say which ones actually changed,
// and (with --publish) put the changed ones on the website.
//
//   node scripts/video/sync-videos.mjs              re-make everything, report, publish nothing
//   node scripts/video/sync-videos.mjs --publish    ...then publish what changed
//   node scripts/video/sync-videos.mjs --no-render  compare what is already made, without re-making
//   node scripts/video/sync-videos.mjs --only 2.3   only videos whose id starts with this
//
// WHAT COUNTS AS CHANGED. A video changed if any word said or printed changed,
// or a voice changed (the signature written by the renderer), or if any picture
// differs CLEARLY from the published one. "Clearly" matters: the browser draws
// the same screen with faintly different edges from run to run, so an exact
// comparison would call every video changed every time. A pixel counts only if
// it moved by more than a fifth of full brightness, and a picture counts as
// changed only past 200 such pixels. A changed word on a button moves hundreds.
//
// A video that fails to render does not stop the others. Every failure is
// listed at the end, and a failed video is never published.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './azure.mjs';
import { readCourse, fullTitle } from './companion.mjs';

const args = process.argv.slice(2);
const PUBLISH = args.includes('--publish');
const RENDER = !args.includes('--no-render');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const PIXEL_STEP = 51;      // a fifth of full brightness, out of 255
const PICTURE_LIMIT = 200;  // pixels past that step before a picture counts as changed

const PUBLISHED_LIST = path.join(ROOT, 'scripts', 'wordpress', 'videos.json');
const published = fs.existsSync(PUBLISHED_LIST) ? JSON.parse(fs.readFileSync(PUBLISHED_LIST, 'utf8')) : { videos: {} };

function ffmpegPath() {
  const r = spawnSync('where', ['ffmpeg'], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.split(/\r?\n/)[0].trim();
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  const stack = [base];
  while (stack.length) {
    const d = stack.pop();
    if (!fs.existsSync(d)) continue;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p); else if (e.name === 'ffmpeg.exe') return p;
    }
  }
  throw new Error('ffmpeg is not installed');
}
const FFMPEG = ffmpegPath();

const pixels = (file) => spawnSync(FFMPEG, ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
  { maxBuffer: 64 * 1024 * 1024 }).stdout;

function picturesDiffer(a, b) {
  const pa = pixels(a), pb = pixels(b);
  if (pa.length !== pb.length) return true;
  let count = 0;
  for (let i = 0; i < pa.length; i += 3) {
    if (Math.abs(pa[i] - pb[i]) > PIXEL_STEP || Math.abs(pa[i + 1] - pb[i + 1]) > PIXEL_STEP
        || Math.abs(pa[i + 2] - pb[i + 2]) > PIXEL_STEP) {
      if (++count > PICTURE_LIMIT) return true;
    }
  }
  return false;
}

// Why a video needs publishing, or null if it does not.
function whatChanged(id) {
  const made = path.join(ROOT, 'Videos', `${id}.json`);
  if (!fs.existsSync(made)) return 'not made';
  const now = JSON.parse(fs.readFileSync(made, 'utf8'));
  const was = published.videos[id];
  if (!was) return 'new';
  if (was.signature !== now.signature) return 'words or voices changed';
  const newDir = path.join(ROOT, 'Videos', '.frames', id);
  const oldDir = path.join(ROOT, 'Videos', '.published', id);
  if (!fs.existsSync(oldDir)) return 'no published pictures to compare with';
  const newFiles = fs.readdirSync(newDir).sort();
  const oldFiles = fs.readdirSync(oldDir).sort();
  if (newFiles.join() !== oldFiles.join()) return 'number of pictures changed';
  for (const f of newFiles) {
    if (picturesDiffer(path.join(newDir, f), path.join(oldDir, f))) return `picture ${Number(f.slice(0, 2)) + 1} changed`;
  }
  return null;
}

const items = readCourse().groups.flatMap((g) => g.items)
  .filter((x) => x.id && fs.existsSync(path.join(ROOT, 'scripts', 'video', 'scripts', `${x.id}.mjs`)))
  .filter((x) => !ONLY || x.id.startsWith(ONLY));

const failed = [];
if (RENDER) {
  for (const x of items) {
    process.stdout.write(`Making ${x.num} ${fullTitle(x)} ... `);
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'video', 'render-video.mjs'),
      path.join(ROOT, 'scripts', 'video', 'scripts', `${x.id}.mjs`)], { encoding: 'utf8', cwd: ROOT });
    if (r.status === 0) console.log('done');
    else {
      const why = (r.stderr + r.stdout).split(/\r?\n/).find((l) => l.startsWith('STOPPING')) || r.stderr.trim().split(/\r?\n/).pop();
      console.log('FAILED');
      failed.push({ x, why });
    }
  }
  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'video', 'make-course-map.mjs')], { cwd: ROOT });
}

const toPublish = [];
console.log('\nCompared with the website:');
for (const x of items) {
  if (failed.find((f) => f.x === x)) { console.log(`  ${x.num.padEnd(5)} NOT MADE  ${fullTitle(x)}`); continue; }
  const why = whatChanged(x.id);
  console.log(`  ${x.num.padEnd(5)} ${why ? 'CHANGED  ' : 'same     '} ${fullTitle(x)}${why ? `  (${why})` : ''}`);
  if (why && why !== 'not made') toPublish.push(x.id);
}

if (failed.length) {
  console.log('\nThese could not be made, and will not be published:');
  for (const { x, why } of failed) console.log(`  ${x.num} ${fullTitle(x)}: ${why}`);
}

if (!PUBLISH) {
  console.log(toPublish.length
    ? `\n${toPublish.length} to publish. Run with --publish to put them on the website.`
    : '\nNothing to publish.');
  process.exit(failed.length ? 1 : 0);
}

// Publishing: the Python publisher uploads and rewrites the page. Only after it
// succeeds are the pictures recorded as published, so a failed upload is
// retried next time rather than forgotten.
const r = spawnSync('python', [path.join(ROOT, 'scripts', 'wordpress', 'publish-videos.py'), '--apply', ...toPublish],
  { encoding: 'utf8', cwd: ROOT, stdio: 'inherit' });
if (r.status !== 0) { console.log('\nPublishing failed; nothing has been recorded as published.'); process.exit(1); }
for (const id of toPublish) {
  const from = path.join(ROOT, 'Videos', '.frames', id);
  const to = path.join(ROOT, 'Videos', '.published', id);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}
process.exit(failed.length ? 1 : 0);
