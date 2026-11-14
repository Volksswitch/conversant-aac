/* Tests for scripts/mic-check/levels.mjs - the loudness figures for a recording made
 * outside the app (Voice Memos), measured the way the app measures its microphone.
 *
 * The point of the tool is a COMPARISON between a tester's recording and a reference,
 * so the tests that matter are the ones showing a known ratio comes back out, and that
 * a recording with nothing in it produces figures rather than an exception.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    SAMPLE_RATE, FRAME_SAMPLES, LEVEL_BANDS, BAR_MIN, BAR_MAX,
    frameLevels, summarize, splitChannels, bandOf, toDb,
} from '../scripts/mic-check/levels.mjs';

// Five seconds of room, then ten of "speech" in syllables. Deterministic.
function recording({ room = 0.001, speech = 0.1, scale = 1 } = {}) {
    const n = SAMPLE_RATE * 15;
    const out = new Float32Array(n);
    let seed = 1;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
    for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        let v = (rand() * 2 - 1) * Math.sqrt(3) * room;
        if (t >= 5 && (t % 0.4) < 0.25) v += Math.sin(2 * Math.PI * 220 * t) * Math.SQRT2 * speech;
        out[i] = v * scale;
    }
    return out;
}

test('a steady tone measures at its RMS, in pieces the size the app uses', () => {
    const tone = new Float32Array(SAMPLE_RATE);
    for (let i = 0; i < tone.length; i++) tone[i] = Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 0.2;
    const levels = frameLevels(tone);
    assert.equal(levels.length, Math.floor(SAMPLE_RATE / FRAME_SAMPLES));
    for (const l of levels) assert.ok(Math.abs(l - 0.2 / Math.SQRT2) < 0.002, `level ${l}`);
});

test('room and speech are told apart, and speech is found at its real level', () => {
    const s = summarize(recording());
    assert.ok(s.room > 0.0007 && s.room < 0.0013, `room ${s.room}`);
    assert.ok(s.loudest > 0.09 && s.loudest < 0.11, `loudest ${s.loudest}`);
    assert.ok(s.speech > 0.02, `speech ${s.speech}`);
    assert.ok(s.speechOverRoom > 20);
    assert.equal(s.bands.reduce((a, b) => a + b, 0), s.frames);
    assert.equal(s.perSecond.length, 15);
    assert.equal(bandOf(s.perSecond[0]), 1, 'the first second is room only');
    assert.equal(bandOf(s.perSecond[10]), LEVEL_BANDS.length, 'a speaking second reaches the top band');
});

test('a microphone 30 times quieter comes out 30 times quieter', () => {
    const good = summarize(recording());
    const weak = summarize(recording({ scale: 1 / 30 }));
    assert.ok(Math.abs(good.loudest / weak.loudest - 30) < 1);
    assert.ok(Math.abs(good.speech / weak.speech - 30) < 1);
    // The speech still stands just as far above its own room: quieter, not noisier.
    assert.ok(Math.abs(toDb(good.speechOverRoom) - toDb(weak.speechOverRoom)) < 1);
    // And on the app's scale none of it would count as speech.
    assert.equal(weak.shareOverBar, 0);
});

test('the speech bar follows the app: 4 times the room, kept between its limits', () => {
    assert.equal(summarize(recording({ room: 0.0001 })).bar, BAR_MIN);
    assert.equal(summarize(recording({ room: 0.05, speech: 0.5 })).bar, BAR_MAX);
});

test('a recording with no speech says so instead of inventing a level', () => {
    const s = summarize(recording({ speech: 0 }));
    assert.equal(s.speech, null);
    assert.equal(s.speechOverRoom, null);
    assert.ok(s.shareAboveRoom < 0.01);
});

test('nothing at all, and less than one piece, do not throw', () => {
    for (const samples of [new Float32Array(0), new Float32Array(100), new Float32Array(SAMPLE_RATE)]) {
        const s = summarize(samples);
        assert.equal(s.speech, null);
        assert.equal(s.loudest, 0);
        assert.equal(s.clipped, false);
    }
});

test('full volume is reported as clipping', () => {
    const loud = recording({ speech: 2 }).map((v) => Math.max(-1, Math.min(1, v)));
    assert.equal(summarize(loud).clipped, true);
});

test('channels are separated, so one dead microphone shows', () => {
    const left = recording();
    const right = recording({ scale: 1 / 100 });
    const inter = new Float32Array(left.length * 2);
    for (let i = 0; i < left.length; i++) { inter[i * 2] = left[i]; inter[i * 2 + 1] = right[i]; }
    const { each, mix } = splitChannels(inter, 2);
    const l = summarize(each[0]);
    const r = summarize(each[1]);
    assert.ok(l.loudest / r.loudest > 90);
    assert.ok(summarize(mix).loudest > 0.04, 'the mix alone would hide it');
});

test('the bands and the piece size are the ones the app reports with', () => {
    // A recording is only readable beside a problem report while these agree.
    const mic = fs.readFileSync(new URL('../app/js/mic-check.js', import.meta.url), 'utf8');
    const stt = fs.readFileSync(new URL('../app/js/stt-deepgram.js', import.meta.url), 'utf8');
    assert.ok(mic.includes(`const LEVEL_BANDS = [${LEVEL_BANDS.join(', ')}];`));
    assert.ok(stt.includes(`const FRAME_SAMPLES = ${FRAME_SAMPLES};`));
});
