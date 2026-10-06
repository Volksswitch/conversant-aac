/* Tier 1 — start-of-listening chime POLICY (app/js/chime.js).
 *
 * The tone is Web Audio and can't sound here; what matters is WHEN it is allowed
 * to. playListenChime returns its policy decision, so the gating is testable
 * without a speaker (the audio itself is best-effort and fails invisibly).
 *
 * The rule (Ken, July 27 2026): with "resume listening automatically" ON the mic
 * restarts after every exchange, so the cue fires only at the START of the
 * conversation — chiming each time turns a one-time disclosure into a metronome.
 * With auto-resume OFF each start is a deliberate listening episode and chimes.
 */
import './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as chime from '../app/js/chime.js';

beforeEach(() => {
    chime.setEnabled(true);
    chime.setOncePerConversation(false);
    chime.resetConversation();
});

test('auto-resume OFF: every capture start chimes', () => {
    chime.setOncePerConversation(false);
    for (let i = 1; i <= 5; i++) {
        assert.equal(chime.playListenChime(), true, `start ${i} should chime`);
    }
});

test('auto-resume ON: only the first start of the conversation chimes', () => {
    chime.setOncePerConversation(true);
    assert.equal(chime.playListenChime(), true, 'the conversation opens with the cue');
    assert.equal(chime.playListenChime(), false, 'an auto-resume must not re-announce');
    assert.equal(chime.playListenChime(), false);
});

test('auto-resume ON: the next conversation chimes again', () => {
    chime.setOncePerConversation(true);
    chime.playListenChime();
    assert.equal(chime.playListenChime(), false);
    chime.resetConversation();          // Start / End conversation
    assert.equal(chime.playListenChime(), true, 'a new conversation gets its own cue');
});

test('turning auto-resume ON mid-conversation stops the repeats immediately', () => {
    // The setting is live-applied from Settings, so the switch must take effect on
    // the conversation already in progress.
    chime.setOncePerConversation(false);
    assert.equal(chime.playListenChime(), true);
    assert.equal(chime.playListenChime(), true, 'still per-start while OFF');
    chime.setOncePerConversation(true);
    assert.equal(chime.playListenChime(), false,
        'a start already happened this conversation, so the cue is spent');
});

test('turning auto-resume OFF mid-conversation restores the per-start cue', () => {
    chime.setOncePerConversation(true);
    chime.playListenChime();
    assert.equal(chime.playListenChime(), false);
    chime.setOncePerConversation(false);
    assert.equal(chime.playListenChime(), true, 'discrete listening episodes chime again');
});

test('the chime toggle beats the per-conversation rule', () => {
    chime.setEnabled(false);
    chime.setOncePerConversation(false);
    assert.equal(chime.playListenChime(), false, 'disabled never sounds');
    assert.equal(chime.isEnabled(), false);

    chime.setEnabled(true);
    assert.equal(chime.playListenChime(), true);
});

test('being disabled does not consume the conversation\'s single chime', () => {
    // Otherwise turning the chime on mid-conversation would stay silent until the
    // next conversation, which would read as the toggle being broken.
    chime.setOncePerConversation(true);
    chime.setEnabled(false);
    chime.playListenChime();            // suppressed by the toggle
    chime.setEnabled(true);
    assert.equal(chime.playListenChime(), true, 'the cue was never spent while off');
});

// CR-273. On an iPad the audio is often not ready when listening starts. The tone is
// not played then, and it must not count as played: the next start tries again, and
// only once it actually sounds is the rest of the conversation quiet.
test('auto-resume ON: a start that could not sound does not use up the conversation\'s tone', () => {
    const made = [];
    const fake = {
        state: 'suspended', currentTime: 0, destination: {},
        resume() { return Promise.resolve(); },
        createOscillator() { made.push('osc'); return { type: '', frequency: { value: 0 }, connect(n) { return n; }, start() {}, stop() {} }; },
        createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(n) { return n; } }; },
    };
    const saved = globalThis.window.AudioContext;
    globalThis.window.AudioContext = function () { return fake; };
    try {
        chime.setOncePerConversation(true);
        chime.resetConversation();
        chime.playListenChime();
        assert.equal(made.length, 0, 'nothing is scheduled on audio that is not ready');
        assert.equal(chime.playListenChime(), true, 'the next start still tries');
        fake.state = 'running';
        chime.playListenChime();
        assert.ok(made.length > 0, 'it sounds once the audio is ready');
        assert.equal(chime.playListenChime(), false, 'and then the conversation is quiet');
    } finally {
        globalThis.window.AudioContext = saved;
        chime.resetConversation();
    }
});
