/* Tier 1 — the speech gate that decides what a paid transcription service is
 * asked to listen to (app/js/vad.js).
 *
 * This is worth testing precisely because getting it wrong is expensive in one
 * direction and invisible in the other: too eager and the user pays for silence,
 * too reluctant and words go missing from the transcript with nothing to show why.
 * Neither shows up in a screenshot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGate, rms, billableSeconds, DEFAULTS } from '../app/js/vad.js';

const LOUD = DEFAULTS.openLevel + 0.01;
const QUIET = 0;
const BETWEEN = (DEFAULTS.openLevel + DEFAULTS.closeLevel) / 2;   // inside the hysteresis gap

test('silence alone never opens the gate — nothing is uploaded, nothing is billed', () => {
    const g = createGate();
    let t = 0;
    for (let i = 0; i < 200; i++) assert.equal(g.push(QUIET, t += 50), null);
    assert.equal(g.isOpen(), false);
});

test('speech opens the gate once, not on every frame', () => {
    const g = createGate();
    let t = 0;
    assert.equal(g.push(LOUD, t += 50), 'open');
    for (let i = 0; i < 10; i++) assert.equal(g.push(LOUD, t += 50), null, 'no repeated open edges');
    assert.equal(g.isOpen(), true);
});

test('the gate holds through the gaps between words', () => {
    const g = createGate({ hangMs: 900 });
    let t = 0;
    g.push(LOUD, t += 50);
    // A pause shorter than the hang time — normal between words, and between a
    // word and the "um" after it.
    for (let i = 0; i < 10; i++) g.push(QUIET, t += 50);   // 500ms
    assert.equal(g.isOpen(), true, 'must not chop an utterance into fragments');
    g.push(LOUD, t += 50);
    for (let i = 0; i < 10; i++) g.push(QUIET, t += 50);
    assert.equal(g.isOpen(), true, 'the quiet clock restarts when speech resumes');
});

test('the gate closes once the pause is genuinely long', () => {
    const g = createGate({ hangMs: 900 });
    let t = 0;
    g.push(LOUD, t += 50);
    let edge = null;
    for (let i = 0; i < 40 && edge === null; i++) edge = g.push(QUIET, t += 50);
    assert.equal(edge, 'close');
    assert.equal(g.isOpen(), false);
});

test('hysteresis: a level inside the gap neither opens nor closes', () => {
    const g = createGate();
    let t = 0;
    // Below the OPEN threshold, so it cannot start.
    assert.equal(g.push(BETWEEN, t += 50), null);
    assert.equal(g.isOpen(), false);
    // Once open, the same level is above the CLOSE threshold, so it sustains —
    // this is what stops a voice at the boundary chattering the upstream open and
    // shut many times a second.
    g.push(LOUD, t += 50);
    for (let i = 0; i < 60; i++) g.push(BETWEEN, t += 50);
    assert.equal(g.isOpen(), true);
});

test('reset closes an open gate, so stopping cannot leave an upstream billing', () => {
    const g = createGate();
    g.push(LOUD, 0);
    assert.equal(g.isOpen(), true);
    assert.equal(g.reset(), 'close');
    assert.equal(g.isOpen(), false);
    assert.equal(g.reset(), null, 'already closed — no spurious edge');
});

test('pre-roll is a positive window — the syllable that opened the gate is recoverable', () => {
    const g = createGate();
    assert.ok(g.preRollMs() > 0);
    assert.ok(g.preRollMs() < 2000, 'pre-roll is a beat, not a buffer of the whole conversation');
});

test('rms: silence reads zero, full-scale reads one', () => {
    assert.equal(rms([0, 0, 0, 0]), 0);
    assert.equal(rms([1, -1, 1, -1]), 1);
    assert.equal(rms([]), 0, 'no samples must not divide by zero');
    assert.ok(Math.abs(rms([0.5, -0.5]) - 0.5) < 1e-9);
});

test('billableSeconds totals only the open spans', () => {
    assert.equal(billableSeconds([{ start: 0, end: 1000 }, { start: 5000, end: 6500 }]), 2.5);
    assert.equal(billableSeconds([]), 0);
    assert.equal(billableSeconds(null), 0);
    // A span recorded backwards must not subtract from the bill.
    assert.equal(billableSeconds([{ start: 1000, end: 0 }]), 0);
});

test('the point of the gate: a mostly-silent session bills a fraction of its length', () => {
    // Ten minutes of microphone time with roughly 30 seconds of speech in it —
    // the shape of a real visit, and the case that decides whether this feature is
    // affordable.
    const g = createGate();
    const spans = [];
    let t = 0, openedAt = 0;
    const frame = (level) => {
        const edge = g.push(level, t);
        if (edge === 'open') openedAt = t;
        if (edge === 'close') spans.push({ start: openedAt, end: t });
        t += 50;
    };
    for (let burst = 0; burst < 6; burst++) {
        for (let i = 0; i < 100; i++) frame(LOUD);    // 5s of speech
        for (let i = 0; i < 1900; i++) frame(QUIET);  // 95s of quiet
    }
    if (g.isOpen()) spans.push({ start: openedAt, end: t });
    const billed = billableSeconds(spans);
    const wallClock = t / 1000;
    assert.ok(wallClock > 590, `sanity: simulated ${wallClock}s of microphone time`);
    // Each burst bills its 5s of speech plus the hang time before the gate shuts.
    assert.ok(billed < 60, `billed ${billed.toFixed(1)}s — must be a small fraction of ${wallClock}s`);
    assert.ok(billed > 30, `billed ${billed.toFixed(1)}s — must still contain all the speech`);
});

// ---- The speech level follows the room (November 13 2026) -------------------------
// A beta tester's iPad delivered speech at about 0.008: below the fixed 0.020, so the
// gate never opened and nothing was ever heard. These are the shapes that decide it.

function feed(g, level, ms, t) {
    let edge = null;
    for (let end = t + ms; t < end; t += 85) edge = g.push(level, t) || edge;
    return { t, edge };
}

test('the tester case: quiet speech in a quiet room now opens the gate', () => {
    const g = createGate();
    let { t } = feed(g, 0.0015, 2000, 0);               // two seconds of a quiet room
    assert.ok(Math.abs(g.levels().floor - 0.0015) < 1e-9, 'the room was measured');
    assert.ok(g.levels().open < 0.008, `bar ${g.levels().open} is now under his speech`);
    assert.equal(g.push(0.008, t), 'open');
});

test('without following the room, the same speech is never heard (the old failure)', () => {
    const g = createGate({ adaptive: false });
    let { t } = feed(g, 0.0015, 2000, 0);
    assert.equal(feed(g, 0.008, 3000, t).edge, null);
});

test('a noisy room keeps the old bar: it is never raised above it', () => {
    const g = createGate();
    let { t } = feed(g, 0.015, 3000, 0);               // loud background
    assert.equal(g.levels().open, DEFAULTS.openLevel);
    assert.equal(g.push(DEFAULTS.openLevel + 0.005, t), 'open');
});

test('until a second of quiet has been heard, the fixed bar applies', () => {
    const g = createGate();
    let { t } = feed(g, 0.0015, 300, 0);
    assert.equal(g.levels().floor, null);
    assert.equal(g.push(0.008, t), null, 'too early to trust a measurement of the room');
});

test('a dead-silent input cannot drop the bar to nothing', () => {
    const g = createGate();
    let { t } = feed(g, 0, 2000, 0);
    assert.equal(g.levels().open, DEFAULTS.minOpenLevel);
    assert.equal(g.push(DEFAULTS.minOpenLevel / 2, t), null, 'a faint click does not open it');
});

test('the room is not measured during speech, so a long sentence is not cut off', () => {
    const g = createGate();
    let { t } = feed(g, 0.0015, 2000, 0);
    assert.equal(g.push(0.008, t), 'open');
    const before = g.levels();
    // Twelve seconds of quiet speech, longer than the measuring window.
    const r = feed(g, 0.008, 12000, t + 85);
    assert.equal(r.edge, null, 'the gate stayed open through it');
    assert.deepEqual(g.levels(), before, 'the bar did not rise under the speaker');
});

test('following the room still bills a fraction of a mostly-quiet session', () => {
    // Ten minutes, a quiet room with a little variation, 30 seconds of speech.
    const g = createGate();
    const spans = [];
    let t = 0, openedAt = 0;
    const frame = (level) => {
        const edge = g.push(level, t);
        if (edge === 'open') openedAt = t;
        if (edge === 'close') spans.push({ start: openedAt, end: t });
        t += 50;
    };
    for (let burst = 0; burst < 6; burst++) {
        for (let i = 0; i < 100; i++) frame(0.03);
        for (let i = 0; i < 1900; i++) frame(0.0015 + (i % 7) * 0.0002);
    }
    if (g.isOpen()) spans.push({ start: openedAt, end: t });
    const billed = billableSeconds(spans);
    assert.ok(billed < 60 && billed > 30, `billed ${billed.toFixed(1)}s`);
});

// ---- November 13 2026 findings, problems 7 and 8 --------------------------------

// Kenny's room (0.0004) and a quiet partner beside him whose loudest moments reach
// 0.008, as in his 0.15.2 report. Frames are 85 ms.
const KENNY_ROOM = 0.0004;
const QUIET_VOICE = [0.005, 0.007, 0.008, 0.006, 0.004, 0.002, 0.006, 0.008, 0.007, 0.004, 0.003, 0.0015];
function firstOpenMs(g, levels) {
    let t = 0;
    for (const l of levels) { if (g.push(l, t) === 'open') return t; t += 85; }
    return null;
}
const quietSpeech = (seconds) =>
    Array.from({ length: Math.round((seconds * 1000) / 85) }, (_, i) => QUIET_VOICE[i % QUIET_VOICE.length]);

// Problem 7. A new gate is made every time the microphone opens - on an iPad after
// every holding phrase. One that starts knowing nothing measures whatever it hears
// first as the room, so a quiet partner already talking had their own voice taken for
// the room and was never heard. The room the last gate measured is carried over.
test('a gate given the last room hears a quiet partner who is already talking, at once', () => {
    const carried = createGate({ initialFloor: KENNY_ROOM });
    assert.equal(carried.levels().open, DEFAULTS.minOpenLevel, 'the bar is set before any frame');
    assert.equal(firstOpenMs(carried, quietSpeech(10)), 0, 'opens on the first syllable');
});

// What the carried room cannot cover, recorded so it is not mistaken for fixed: the
// FIRST listening of a session has no earlier room. A voice like this one, quiet and
// talking from the very first moment, is still taken for the room there - the old
// fixed bar applies until a second has been heard. Real voices vary more than this one
// and the November 13 findings measured them getting through after 1.2 to 1.7 seconds.
test('the first listening of a session still needs a moment of room or a voice that varies', () => {
    assert.equal(firstOpenMs(createGate(), quietSpeech(10)), null, 'unchanged for a voice this steady');
    const roomFirst = firstOpenMs(createGate(), [...Array(14).fill(KENNY_ROOM), ...quietSpeech(10)]);
    assert.ok(roomFirst !== null && roomFirst < 1300, 'a quiet room first: heard at once');
});

test('a carried room of zero is still a room (a dead-silent input), and none means none', () => {
    assert.equal(createGate({ initialFloor: 0 }).levels().floor, 0);
    assert.equal(createGate({ initialFloor: null }).levels().floor, null);
    assert.equal(createGate().levels().floor, null);
});

// Problem 8. The room is measured only while the gate is shut, so a fan, heater or
// kettle that started while the partner talked held the gate open - sent and billed -
// for as long as it ran.
function openSeconds({ room = 0.0004, voice = 0.05, voiceMs = 2000, noise, noiseMs, opts = {} }) {
    const g = createGate(opts);
    let t = 0, open = 0, closedAt = null;
    const run = (level, ms) => {
        for (const end = t + ms; t < end; t += 85) {
            const e = g.push(level, t);
            if (e === 'close' && closedAt === null) closedAt = t;
            if (g.isOpen()) open++;
        }
    };
    run(room, 2000);
    run(voice, voiceMs);
    run(noise, noiseMs);
    return { closedAt, openSeconds: (open * 85) / 1000, levels: g.levels() };
}

test('a fan that starts as the partner speaks no longer holds the gate open', () => {
    const r = openSeconds({ noise: 0.004, noiseMs: 5 * 60 * 1000 });
    assert.ok(r.closedAt !== null, 'the gate closes');
    assert.ok(r.openSeconds < 8, `open ${r.openSeconds.toFixed(1)} s of a five-minute fan`);
    assert.ok(r.levels.open > 0.004, 'and the fan is now part of the room, so it does not reopen');
});

test('a quiet partner and a fan nearly as loud as them: closed within about fifteen seconds', () => {
    // Kenny's setup: the voice is only twice the fan, so the voice cannot show the fan
    // up; that it never varies does.
    const r = openSeconds({ voice: 0.008, noise: 0.003, noiseMs: 60 * 1000 });
    assert.ok(r.closedAt !== null, 'the gate closes');
    assert.ok(r.openSeconds < 20, `open ${r.openSeconds.toFixed(1)} s of a one-minute fan`);
});

test('the gate never closes at a level above the old fixed gate', () => {
    // A loud steady sound, louder than the old 0.012 closing level: the old gate stayed
    // open through it too, and so does this one. Raising the room never makes the gate
    // close earlier than the old one would have.
    const r = openSeconds({ noise: 0.03, noiseMs: 30 * 1000 });
    assert.equal(r.closedAt, null);
    assert.ok(r.levels.open <= DEFAULTS.openLevel, 'the bar keeps its 0.020 ceiling');
});

test('a long quiet sentence that rises and falls is not cut off, and the room stays put', () => {
    const g = createGate();
    let { t } = feed(g, KENNY_ROOM, 2000, 0);
    const before = g.levels();
    let edge = null;
    for (const l of quietSpeech(20)) { edge = g.push(l, t) || edge; t += 85; }
    assert.equal(edge, 'open', 'opened, and never closed in twenty seconds');
    assert.ok(g.isOpen());
    assert.deepEqual(g.levels(), before, 'the room and the bar did not move under the speaker');
});

// Found checking c84fb5e, the first fix for problem 8 (Ken approved the change,
// November 13 2026). Someone talking for several seconds with no real pause, in a room
// where the gaps between their words never go fully quiet, left only those gaps as the
// quietest moments of the last four seconds. The quick rule took them for the room,
// the bar rose above the soft last words of the sentence, and up to 1.6 seconds of them
// were never sent. The quick rule now waits until the last 1.5 seconds have been steady.
test('a long sentence with no real pause that ends softly keeps its ending', () => {
    const lost = [];
    for (const dip of [0.004, 0.006]) for (const peak of [0.006, 0.010])
        for (const hangMs of [900, 450]) for (const talkMs of [6000, 8000]) {
            const g = createGate({ hangMs });
            let t = 0;
            const push = (level) => { g.push(level, t); t += 85; return g.isOpen(); };
            for (let i = 0; i * 85 < 2000; i++) push(KENNY_ROOM);
            const talk = [0.03, 0.05, 0.035, 0.012, dip, 0.04, 0.025, 0.015, dip * 1.5];
            for (let i = 0; i * 85 < talkMs; i++) push(talk[i % talk.length]);
            const ending = [0.6, 1, 0.8, 0.4, 0.7, 1, 0.5];
            let shutFrames = 0;
            for (let i = 0; i * 85 < 2000; i++) if (!push(peak * ending[i % ending.length])) shutFrames++;
            if (shutFrames) {
                lost.push(`gaps ${dip}, ending ${peak}, hang ${hangMs} ms, talk ${talkMs / 1000} s: ` +
                    `${((shutFrames * 85) / 1000).toFixed(1)} s of the ending not sent`);
            }
        }
    assert.deepEqual(lost, [], lost.join('\n'));
});

// ...and the fan is still let go soon after the person stops, however long they talked.
// Azure, Google Cloud and ElevenLabs only get the words when the gate closes, so this
// is also how long the words, and the suggestions, wait.
test('a fan that starts as the person stops is let go within about three seconds, after any length of talk', () => {
    for (const hangMs of [900, 450]) for (const talkMs of [2000, 5000, 10000]) {
        const g = createGate({ hangMs });
        let t = 0;
        for (; t < 2000; t += 85) g.push(KENNY_ROOM, t);
        for (const end = t + talkMs; t < end; t += 85) g.push(0.05, t);
        const stoppedAt = t;
        let closedAt = null;
        for (const end = t + 60_000; t < end && closedAt === null; t += 85) {
            if (g.push(0.004, t) === 'close') closedAt = t;
        }
        assert.ok(closedAt !== null, `hang ${hangMs} ms, talk ${talkMs / 1000} s: the gate closes`);
        const waited = (closedAt - stoppedAt) / 1000;
        assert.ok(waited <= 3.5, `hang ${hangMs} ms, talk ${talkMs / 1000} s: the words waited ${waited.toFixed(1)} s`);
    }
});

// With a paid service, stt.js counts a pause only once the microphone has been quiet
// (Ken, November 13 2026: options came partway through his count). The gate is what
// knows: anything above the closing level counts as sound, the gate open or shut.
test('the gate says how long the microphone has been quiet', () => {
    const g = createGate({ initialFloor: 0.0004 });     // bar 0.004, closing level 0.0024
    assert.equal(g.quietForMs(0), Infinity, 'nothing heard yet');
    g.push(0.05, 0);
    g.push(0.0005, 100);                                 // the room
    assert.equal(g.quietForMs(1000), 1000);
    g.push(0.003, 1100);                                 // soft: under the bar, over the closing level
    assert.equal(g.quietForMs(1200), 100, 'a soft sound still counts as sound');
    g.reset();
    assert.equal(g.quietForMs(1300), 200, 'stopping does not forget when it last heard sound');
});
