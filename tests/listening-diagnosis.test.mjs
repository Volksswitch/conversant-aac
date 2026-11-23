/* The listening check at the top of a problem report (Ken, November 22 2026).
 *
 * A beta tester's device could not hear the other person, and the report held the facts
 * without drawing the conclusion. Each test here is one place hearing can break, and
 * checks the report names THAT place first. The last tests drive the real counters in
 * stt.js and the real report builder, so the check is not only tested on made-up input.
 */
import { recognitions } from './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseListening, formatDiagnosis } from '../app/js/listening-diagnosis.js';

const t0 = Date.parse('2026-11-22T10:00:00Z');
const baseStt = (over = {}) => ({
    sessionStartedAt: t0, backend: 'deepgram', listeningNow: false, sessions: 2,
    recognizerErrors: {}, listenRequests: 2, noSource: 0, sourceErrors: {},
    deliveries: 5, echoDropped: 0, partnerHeard: 5, ...over,
});
const baseMic = (over = {}) => ({
    starts: 2, startsWithNoSound: 0, frames: 900, loudest: 0.2, speechStartsAt: 0.02,
    speechSpans: 4, connected: 2, mutedAtStart: 0, stuck: {}, ...over,
});
const okTest = { result: 'ok', message: '✓ working' };
const run = (over = {}) => diagnoseListening({
    chosen: 'deepgram', test: okTest, permission: 'granted',
    recognition: { apiPresent: true, usable: true }, stt: baseStt(), mic: baseMic(), ...over,
});

test('everything working says so', () => {
    const d = run();
    assert.equal(d.problems, 0);
    assert.equal(d.verdict, 'Hearing worked in this session.');
});

test('a paid choice with no key is named as a FALL-BACK, with the reason', () => {
    const d = run({
        chosen: 'azure', test: { result: 'no key', message: 'No Azure Speech key is set.' },
        stt: baseStt({ backend: 'browser', deliveries: 0, partnerHeard: 0 }),
    });
    assert.match(d.verdict, /^WHERE IT BREAKS: Which service is listening - FELL BACK: Azure Speech was chosen/);
    assert.match(d.verdict, /because no Azure Speech key is set/);
});

test('a fall-back while words still arrived is a warning, not the break', () => {
    const d = run({ chosen: 'azure', test: { result: 'no key', message: 'x' }, stt: baseStt({ backend: 'browser' }) });
    assert.match(d.verdict, /^HEARING WORKED, BUT: .*FELL BACK/);
});

test('Listen never turned on this session says there is nothing to go on', () => {
    const d = run({ stt: baseStt({ listenRequests: 0, deliveries: 0, partnerHeard: 0 }) });
    assert.match(d.verdict, /^NOT ENOUGH TO GO ON: Listen has not been turned on since the app was opened at/);
    const text = formatDiagnosis(d);
    assert.match(text, /send another report without closing the app/);
});

test('a refused service test is where it breaks', () => {
    const d = run({ test: { result: 'failed', message: '✗ The connection was refused' }, stt: baseStt({ deliveries: 0, partnerHeard: 0 }) });
    assert.match(d.verdict, /WHERE IT BREAKS: Deepgram answers a test now - ✗ The connection was refused/);
});

test('a refused microphone permission is named', () => {
    const d = run({ permission: 'denied', stt: baseStt({ deliveries: 0, partnerHeard: 0 }) });
    assert.match(d.verdict, /Microphone permission/);
});

test('a microphone that never opened, and why', () => {
    const d = run({ mic: baseMic({ starts: 0, frames: 0, stuck: { 'audio would not start': 3 } }), stt: baseStt({ deliveries: 0, partnerHeard: 0 }) });
    assert.match(d.verdict, /The microphone opened - Listen was turned on but the microphone never opened: audio would not start \(3 times\)/);
});

test('no sound reaching the app is named', () => {
    const d = run({ mic: baseMic({ frames: 0, speechSpans: 0 }), stt: baseStt({ deliveries: 0, partnerHeard: 0 }) });
    assert.match(d.verdict, /Sound arrived from the microphone - No sound at all/);
});

test('sound too quiet to count as speech gives both numbers', () => {
    const d = run({ mic: baseMic({ loudest: 0.003, speechSpans: 0 }), stt: baseStt({ deliveries: 0, partnerHeard: 0 }) });
    assert.match(d.verdict, /loud enough to count as speech - The loudest sound was 0\.003; speech starts counting at 0\.020/);
});

test('speech sent but no words back is named', () => {
    const d = run({ stt: baseStt({ deliveries: 0, partnerHeard: 0 }) });
    assert.match(d.verdict, /Words came back - No words came back at all/);
});

test('words all taken for the app\'s own voice is named', () => {
    const d = run({ stt: baseStt({ deliveries: 6, echoDropped: 6, partnerHeard: 0 }) });
    assert.match(d.verdict, /every one was taken to be the app's own voice/);
});

test('an error that ended listening is given in plain words', () => {
    const d = run({ stt: baseStt({ sourceErrors: { 'not-allowed': 2 }, deliveries: 0, partnerHeard: 0 }) });
    assert.match(d.verdict, /the microphone was refused \(permission\) \(2 times\)/);
});

test("the device's own listening known not to work here is named", () => {
    const d = run({
        chosen: 'builtin', test: { result: 'not needed', message: '' },
        recognition: { apiPresent: true, usable: false, reason: 'Home Screen app' },
        stt: baseStt({ backend: 'browser', deliveries: 0, partnerHeard: 0 }),
    });
    assert.match(d.verdict, /This device's own listening is available - It exists but is known not to deliver words here \(Home Screen app\)/);
    assert.match(formatDiagnosis(d), /NOT MEASURED/);
});

test('the normal "no-speech" and "aborted" are not counted as errors', () => {
    const d = run({ chosen: 'builtin', stt: baseStt({ backend: 'browser', recognizerErrors: { 'no-speech': 9, aborted: 3 } }) });
    assert.equal(d.problems, 0);
});

// --- The real counters ---------------------------------------------------------------

test('stt.js counts Listen, the words that came back and the ones it kept', async () => {
    const stt = await import('../app/js/stt.js?ld=1');
    stt.init({ onResult: () => {}, onSilence: () => {}, onStatus: () => {}, onPartnerSpeech: () => {} });
    const rec = recognitions[recognitions.length - 1];
    stt.startListening();
    rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'hello there' }], { isFinal: true })] });
    const f = stt.listeningFacts();
    assert.equal(f.listenRequests, 1);
    assert.equal(f.deliveries, 1);
    assert.equal(f.partnerHeard, 1);
    assert.equal(f.backend, 'browser');
    stt.stopListening();
});

test('the problem report puts the checks right after the tester\'s note', async () => {
    if (!globalThis.location) globalThis.location = { href: 'http://localhost/' };
    const diagnostics = await import('../app/js/diagnostics.js');
    const text = await diagnostics.buildProblemReport({
        note: 'It cannot hear my wife.', appVersion: '0.0.0', buildId: 'test',
        hearingTest: { service: 'azure', result: 'no key', message: 'No Azure Speech key is set.', ms: 0 },
        aiTest: { provider: 'anthropic', result: 'ok', message: '✓ The AI answered', ms: 900 },
        voiceTest: { service: 'builtin', result: 'not needed', message: 'device', ms: 0 },
    });
    const note = text.indexOf('It cannot hear my wife.');
    const checks = text.indexOf('SERVICE CHECKS');
    const listening = text.indexOf('LISTENING CHECK');
    const convo = text.indexOf('THE CONVERSATION THIS REPORT IS ABOUT');
    assert.ok(note > 0 && note < checks && checks < listening && listening < convo, 'order');
    assert.match(text, /Listening service \(azure\): NO KEY - No Azure Speech key is set\./);
    assert.match(text, /AI \(anthropic\): WORKS/);
});
