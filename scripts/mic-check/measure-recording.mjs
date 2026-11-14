/*
 * Measures how loud a recording is, the way the app measures its microphone.
 *
 * Trigger phrase: "measure recording"
 *   node scripts/mic-check/measure-recording.mjs                 newest recording in Downloads
 *   node scripts/mic-check/measure-recording.mjs a.m4a b.m4a     these, with a comparison
 *
 * For a recording a tester made OUTSIDE Conversant (Voice Memos, or a short video from
 * the Camera app), so the device's microphone can be judged with the app out of the
 * picture. See levels.mjs for what is measured and why the bands match a problem report.
 *
 * Give it a reference recording made the same way on a device known to work as well:
 * the two are compared at the end. A recording's volume scale is its own, so the
 * comparison is the finding, not either file's numbers alone.
 *
 * Needs ffmpeg and ffprobe on the PATH to read the file. Nothing is written anywhere.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SAMPLE_RATE, summarize, splitChannels, bandLabel, bandOf, toDb } from './levels.mjs';

const KINDS = ['.m4a', '.mp4', '.mov', '.wav', '.caf', '.aac', '.mp3', '.qta', '.aif', '.aiff', '.flac', '.ogg', '.webm'];

function downloadsFolders() {
    const out = [];
    const home = os.homedir();
    out.push(path.join(home, 'Downloads'));
    if (process.env.OneDrive) out.push(path.join(process.env.OneDrive, 'Downloads'));
    return out.filter((d) => fs.existsSync(d));
}

function newestRecording() {
    let best = null;
    for (const dir of downloadsFolders()) {
        for (const name of fs.readdirSync(dir)) {
            if (!KINDS.includes(path.extname(name).toLowerCase())) continue;
            const full = path.join(dir, name);
            const when = fs.statSync(full).mtimeMs;
            if (!best || when > best.when) best = { full, when };
        }
    }
    return best ? best.full : null;
}

function have(tool) {
    const r = spawnSync(tool, ['-version'], { encoding: 'utf8' });
    return !r.error && r.status === 0;
}

function describe(file) {
    const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_name,channels,sample_rate', '-of', 'json', file], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error((r.stderr || 'could not be read').trim());
    const stream = (JSON.parse(r.stdout).streams || [])[0];
    if (!stream) throw new Error('there is no sound in this file');
    return { codec: stream.codec_name, channels: Number(stream.channels) || 1, rate: Number(stream.sample_rate) || 0 };
}

function decode(file) {
    // Raw 32-bit samples at the app's own rate, every channel kept.
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-map', '0:a:0',
        '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', String(SAMPLE_RATE), '-'],
    { maxBuffer: 2 * 1024 * 1024 * 1024 });
    if (r.status !== 0) throw new Error((r.stderr ? r.stderr.toString() : 'could not be read').trim());
    const buf = r.stdout;
    return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}

// Three decimals for ordinary levels; two significant figures for very small ones,
// so a room of 0.00003 does not print as 0.0000.
const f = (n) => (n >= 0.01 ? n.toFixed(3) : n >= 0.001 ? n.toFixed(4) : n > 0 ? n.toPrecision(2) : '0');

function strip(perSecond) {
    // One figure a second: the band the loudest moment of that second reached.
    const digits = perSecond.map((l) => String(bandOf(l)));
    const rows = [];
    for (let i = 0; i < digits.length; i += 10) rows.push(digits.slice(i, i + 10).join(''));
    return rows.join(' ');
}

function report(label, s) {
    const lines = [];
    lines.push(`  ${label}`);
    lines.push(`    loudest moment        ${f(s.loudest)}`);
    lines.push(`    quiet room            ${f(s.room)}`);
    if (s.speech === null) {
        lines.push('    typical speech        (nothing rose clearly above the room)');
    } else {
        lines.push(`    typical speech        ${f(s.speech)}   (${s.speechOverRoom.toFixed(0)} times the room, ${toDb(s.speechOverRoom).toFixed(0)} dB)`);
    }
    lines.push(`    time above the room   ${(s.shareAboveRoom * 100).toFixed(0)}% of the recording (4 times the room or more)`);
    lines.push(`    time above the app's speech bar (${f(s.bar)})   ${(s.shareOverBar * 100).toFixed(0)}%`);
    lines.push(`    levels: ${s.bands.map((n, i) => `${bandLabel(i)}:${n}`).join(' ')}`);
    lines.push(`    second by second (0 = under 0.001 ... 7 = 0.064 and up):`);
    lines.push(`      ${strip(s.perSecond)}`);
    if (s.clipped) lines.push('    NOTE: the recording hit full volume (it clipped), so the loudest figures read low.');
    return lines.join('\n');
}

function measure(file) {
    const info = describe(file);
    const samples = decode(file);
    const { each, mix } = splitChannels(samples, info.channels);
    const whole = summarize(mix);
    const out = [];
    out.push(`${path.basename(file)}`);
    out.push(`  ${info.codec}, ${info.rate} Hz, ${info.channels} channel${info.channels === 1 ? '' : 's'}, ${whole.seconds.toFixed(1)} seconds`);
    out.push(report(info.channels === 1 ? 'The recording' : 'All channels together', whole));
    if (info.channels > 1) {
        // A recording with more than one channel comes from more than one microphone.
        // One channel far quieter than the other points at one blocked microphone.
        each.forEach((ch, i) => out.push(report(`Channel ${i + 1} alone`, summarize(ch))));
    }
    return { file, text: out.join('\n'), whole };
}

function compare(results) {
    const lines = ['', 'COMPARISON (first file against each other file)'];
    const a = results[0];
    for (const b of results.slice(1)) {
        const an = path.basename(a.file);
        const bn = path.basename(b.file);
        const row = (what, x, y) => {
            if (!(x > 0) || !(y > 0)) return `  ${what}: cannot be compared`;
            const r = x / y;
            return r >= 1
                ? `  ${what}: ${an} is ${r.toFixed(1)} times ${bn} (${toDb(r).toFixed(0)} dB louder)`
                : `  ${what}: ${an} is ${(1 / r).toFixed(1)} times quieter than ${bn} (${toDb(1 / r).toFixed(0)} dB)`;
        };
        lines.push(row('loudest moment', a.whole.loudest, b.whole.loudest));
        lines.push(row('typical speech', a.whole.speech, b.whole.speech));
        lines.push(row('quiet room', a.whole.room, b.whole.room));
        lines.push(row('speech over the room', a.whole.speechOverRoom, b.whole.speechOverRoom));
    }
    return lines.join('\n');
}

function main() {
    if (!have('ffmpeg') || !have('ffprobe')) {
        console.error('ffmpeg is needed to read a recording and is not installed on this machine.');
        console.error('Install it once with:  winget install Gyan.FFmpeg   (then open a new window)');
        process.exit(2);
    }
    let files = process.argv.slice(2);
    if (!files.length) {
        const newest = newestRecording();
        if (!newest) {
            console.error('No recording was found in Downloads. Give the file on the command line.');
            process.exit(2);
        }
        console.log(`(newest recording in Downloads)\n`);
        files = [newest];
    }
    const results = [];
    for (const file of files) {
        try {
            const r = measure(file);
            results.push(r);
            console.log(r.text + '\n');
        } catch (e) {
            console.log(`${path.basename(file)}\n  could not be measured: ${e.message}\n`);
        }
    }
    if (results.length > 1) console.log(compare(results));
    console.log('\nA recording has its own volume scale. Judge a tester\'s recording against a');
    console.log('reference made the same way on a device that works, not against a problem report.');
}

main();
