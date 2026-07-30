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
