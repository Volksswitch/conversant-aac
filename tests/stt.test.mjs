/* Tier 1 — Speech-to-text layer (app/js/stt.js).
 *
 * Drives a fake SpeechRecognition and asserts the silence-checkpoint firing, the
 * TTS-echo content filter, the "app is speaking" trigger-guard, and the segment
 * bookkeeping (dropLastStatement / getCurrentTranscript). stt.js is a singleton
 * module, so each test imports a FRESH copy (cache-busted URL) to get clean echo
 * and timer state — no test-only reset hook needed in the production module.
 *
 * Uses real timers with a tiny silence threshold (40 ms) and short awaits; the
 * one exception is the echo-tail expiry, which is a real 1.5 s constant.
 */
import { recognitions } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const THRESHOLD_S = 0.04;      // 40 ms silence checkpoint for fast tests
let bust = 0;

let stt, rec, silences, statuses, partnerActivity;

beforeEach(async () => {
    stt = await import('../app/js/stt.js?b=' + (bust++));   // fresh module state
    silences = []; statuses = []; partnerActivity = 0;
    stt.setSilenceThreshold(THRESHOLD_S);
    stt.init({
        onResult: () => {},
        onSilence: (t) => silences.push(t),
        onStatus: (s) => statuses.push(s),
        onPartnerSpeech: () => { partnerActivity++; },
    });
    rec = recognitions[recognitions.length - 1];
});

test('a final result fires a silence checkpoint once the partner goes quiet', async () => {
    stt.startListening();
    rec.emitFinal('How are you?');
    await sleep(THRESHOLD_S * 1000 + 60);
    assert.deepEqual(silences, ['How are you?']);
    assert.ok(partnerActivity >= 1);
});

test('consecutive final segments are joined with a single space, not concatenated', async () => {
    // Ken July 13 2026: the recognizer returns segments without a separating space,
    // so "Good morning." + "How was your weekend?" was becoming "…weekend.How…".
    stt.startListening();
    rec.emitFinal('Good morning.');
    rec.emitFinal('How was your weekend?');
    assert.equal(stt.getCurrentTranscript(), 'Good morning. How was your weekend?');
    await sleep(THRESHOLD_S * 1000 + 60);
    assert.equal(silences.at(-1), 'Good morning. How was your weekend?', 'the checkpoint text is spaced too');
});

test('interim then final accumulate; the checkpoint carries the combined text', async () => {
    stt.startListening();
    rec.emitInterim('I was thinking');
    assert.equal(stt.getCurrentTranscript(), 'I was thinking');
    rec.emitFinal('I was thinking we could get lunch.');
    await sleep(THRESHOLD_S * 1000 + 60);
    assert.equal(silences.at(-1), 'I was thinking we could get lunch.');
});

test('the app\'s own TTS echo is dropped — not accumulated, no checkpoint', async () => {
    stt.startListening();
    stt.noteSpokenStart('Good question.');   // app speaks a placeholder
    stt.noteSpokenEnd();                      // ...and finishes (echo tail begins)
    rec.emitFinal('Good question.');          // the mic hears our own words
    await sleep(THRESHOLD_S * 1000 + 60);
    assert.equal(stt.getCurrentTranscript(), '', 'echo must not accumulate');
    assert.equal(silences.length, 0, 'echo must not fire a checkpoint');
});

test('genuine partner speech right after the app spoke is KEPT (not echo-dropped), unlike our own echo', async () => {
    stt.startListening();
    stt.noteSpokenStart('Good question.');
    stt.noteSpokenEnd();
    rec.emitFinal('What do you think about lunch?');  // real partner, different words
    // Content filter: this is NOT our echo, so it accumulates — the key difference
    // from the echo case, which drops to ''. (Its checkpoint is separately delayed
    // by the trigger guard until the echo tail passes; see the two tests below.)
    assert.equal(stt.getCurrentTranscript(), 'What do you think about lunch?');
    await sleep(THRESHOLD_S * 1000 + 60);
    assert.equal(silences.length, 0, 'checkpoint suppressed during the echo tail');
});

test('while the app is speaking, captured audio does not fire a checkpoint (trigger guard)', async () => {
    stt.startListening();
    stt.noteSpokenStart('I am still speaking a long placeholder');   // appSpeaking = true, no end yet
    rec.emitFinal('the partner said something here');                // non-echo content
    await sleep(THRESHOLD_S * 1000 + 260);   // past threshold AND the 200ms re-check
    assert.equal(silences.length, 0, 'no checkpoint may fire while the app speaks');
    // But the content still accumulates (we do not mute the mic).
    assert.ok(stt.getCurrentTranscript().includes('the partner said something here'));
});

test('after the app stops speaking (past the echo tail) a fresh partner turn fires again', async () => {
    stt.startListening();
    stt.noteSpokenStart('a placeholder');
    stt.noteSpokenEnd();
    await sleep(1600);   // real ECHO_TAIL_MS is 1500 ms
    rec.emitFinal('So, how have you been?');
    await sleep(THRESHOLD_S * 1000 + 60);
    assert.equal(silences.at(-1), 'So, how have you been?');
});

test('dropLastStatement removes only the last finalized segment', async () => {
    stt.startListening();
    rec.emitFinal('First sentence. ');
    rec.emitFinal('Second garbled bit.');
    const remaining = stt.dropLastStatement();
    assert.equal(remaining, 'First sentence.');
    assert.equal(stt.getCurrentTranscript(), 'First sentence.');
});

test('user-started flow: opener spoken, then the partner replies → checkpoint fires (STT half of the bug is clean)', async () => {
    stt.startListening();                         // opener auto-starts listening
    stt.noteSpokenStart('Hi Tyler, got a minute?');   // the opener TTS
    stt.noteSpokenEnd();
    await sleep(1600);                            // past the echo tail (Ken waited ~15s)
    rec.emitFinal('Yeah sure, any time you want, just let me know.');
    await sleep(THRESHOLD_S * 1000 + 60);
    assert.deepEqual(silences, ['Yeah sure, any time you want, just let me know.']);
});

test('onend auto-restarts recognition while listening intent holds (silences bridged)', async () => {
    stt.startListening();
    assert.equal(rec.capturing, true);
    rec._started = false;   // the browser stopped continuous recognition on its own
    rec.onend();
    await sleep(5);
    assert.equal(rec.capturing, true, 'restarted so the partner floor stays open');
});

test('an interim not yet finalized is preserved across an onend restart', async () => {
    // Ken, July 12 2026: partner spoke ~10 words (shown live from the interim), the
    // browser restarted recognition mid-utterance, and the not-yet-final interim was
    // wiped — only the one finalized segment survived, so interrupting them recorded
    // just "I was". onend must flush the pending interim before restarting.
    stt.startListening();
    rec.emitFinal('I was ');
    rec.emitInterim('going to ask you something important');
    assert.equal(stt.getCurrentTranscript(), 'I was going to ask you something important');
    rec._started = false;   // the browser stopped continuous recognition on its own
    rec.onend();            // ...and restarts — the interim must not be lost
    await sleep(5);
    assert.equal(
        stt.getCurrentTranscript(),
        'I was going to ask you something important',
        'the interim words survive the restart (retained on interrupt)',
    );
});

test('a surfaced error (network) is reported and stops the restart loop', async () => {
    stt.startListening();
    rec.onerror({ error: 'network' });
    assert.ok(statuses.includes('error'), 'network error surfaced');
    // listeningIntent is cleared, so onend reports stopped instead of restarting
    // (no tight loop when offline — browser STT is cloud-based).
    rec.onend();
    await sleep(5);
    assert.equal(statuses.at(-1), 'stopped');
});

test('benign errors (no-speech / aborted) are ignored', () => {
    stt.startListening();
    const before = statuses.length;
    rec.onerror({ error: 'no-speech' });
    rec.onerror({ error: 'aborted' });
    assert.equal(statuses.length, before, 'no error status for benign recognizer events');
});

test('resetTranscript discards the accumulated turn', () => {
    stt.startListening();
    rec.emitFinal('some words here');
    assert.notEqual(stt.getCurrentTranscript(), '');
    stt.resetTranscript();
    assert.equal(stt.getCurrentTranscript(), '');
});

test('echo filter: an interim PREFIX of what the app is saying is dropped', () => {
    stt.startListening();
    stt.noteSpokenStart('Still thinking it through.');
    rec.emitInterim('still thinking');   // recognizer interim = growing prefix of our speech
    assert.equal(stt.getCurrentTranscript(), '', 'prefix echo dropped');
    stt.noteSpokenEnd();
});

test('echo filter: a multiword phrase EMBEDDED in a longer captured segment is dropped', () => {
    stt.startListening();
    stt.noteSpokenStart('good question');
    rec.emitFinal('well good question then');   // recognizer padded our phrase
    stt.noteSpokenEnd();
    assert.equal(stt.getCurrentTranscript(), '', 'embedded multiword echo dropped');
});

// --- Hardened echo excision (Ken, July 13 2026) — partial / mis-heard / lagged echo.
// The reported failure: after "Repeat what I said", the mic caught only the TAIL of
// the re-spoken response ("had some time to relax") and appended it to the partner's
// turn; a placeholder "Still mulling that over" came back mis-heard as "Steel …".

test('echo filter: a SUFFIX slice of what the app said is dropped', () => {
    stt.startListening();
    stt.noteSpokenStart('Pretty good, thanks for asking! Had some time to relax.');
    stt.noteSpokenEnd();
    rec.emitFinal('had some time to relax');   // recognizer caught only the tail of our TTS
    assert.equal(stt.getCurrentTranscript(), '', 'partial (suffix) echo dropped');
});

test('echo filter: a mis-transcribed echo is dropped (still → steel)', () => {
    stt.startListening();
    stt.noteSpokenStart('Still mulling that over.');
    stt.noteSpokenEnd();
    rec.emitFinal('Steel mulling that over.');
    assert.equal(stt.getCurrentTranscript(), '', 'fuzzy echo dropped despite the mis-hearing');
});

test('echo filter: a LATE echo (past the checkpoint tail, within the match window) is still dropped', async () => {
    stt.startListening();
    stt.noteSpokenStart('Let me think about that for a moment.');
    stt.noteSpokenEnd();
    await sleep(1600);   // past ECHO_TAIL_MS (1500) — the OLD window; within ECHO_MATCH_MS (4000)
    rec.emitFinal('let me think about that for a moment');
    // Excision is the point: the late echo must not accumulate into the partner
    // turn even though it arrived after the (short) checkpoint-gate tail expired.
    // (Only the excision is asserted — a stray silence checkpoint here would come
    // from a leaked timer of an earlier test's stt instance, not from this echo,
    // since the excised echo never calls resetSilenceTimer.)
    assert.equal(stt.getCurrentTranscript(), '', 'late echo still excised');
});

test('echo filter: genuine partner speech sharing only a couple words is NOT dropped', () => {
    stt.startListening();
    stt.noteSpokenStart('Had some time to relax.');
    stt.noteSpokenEnd();
    rec.emitFinal('Did you get out and see any friends this weekend?');
    assert.ok(stt.getCurrentTranscript().includes('friends'), 'a different partner sentence is kept');
});
