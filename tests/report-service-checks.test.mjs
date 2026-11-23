/* The service checks the problem report runs: hearing, voice and AI (Ken, November 22 2026).
 *
 * The report tests the chosen hearing service at the moment it is built, so a reader
 * knows whether the service works right now instead of guessing from symptoms. These
 * tests drive stt.testHearingService through each kind of service with a fake fetch,
 * and check the two promises that matter: it uses the same key readers Listen uses,
 * and no key ever appears in what it returns.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as stt from '../app/js/stt.js';
import * as sttRest from '../app/js/stt-rest.js';
import { STT_PROVIDERS } from '../app/js/speech-catalog.js';

const KEY = 'sk-test-0123456789abcdefghijklmnopqrstuv';

async function withFetch(fake, run) {
    const real = globalThis.fetch;
    globalThis.fetch = fake;
    try { return await run(); } finally { globalThis.fetch = real; }
}

const readers = (over = {}) => ({
    getDeepgramKey: () => '',
    getAzureKey: () => KEY,
    getAzureRegion: () => 'westus2',
    getRestKey: () => KEY,
    getRestModel: () => '',
    ...over,
});

test("the device's own recognition needs no test and contacts nothing", async () => {
    let called = 0;
    const res = await withFetch(async () => { called++; return { ok: true }; },
        () => stt.testHearingService('builtin', readers()));
    assert.equal(res.result, 'not needed');
    assert.equal(called, 0);
});

test('a paid service with no key reports "no key" without contacting it', async () => {
    let called = 0;
    const res = await withFetch(async () => { called++; return { ok: true }; },
        () => stt.testHearingService('azure', readers({ getAzureKey: () => '' })));
    assert.equal(res.result, 'no key');
    assert.equal(res.service, 'azure');
    assert.equal(called, 0);
});

test('Azure is tested with the key and region Listen would use', async () => {
    const seen = [];
    const res = await withFetch(async (url, init) => {
        seen.push({ url: String(url), init });
        return { ok: true, status: 200, json: async () => ({ RecognitionStatus: 'NoMatch' }) };
    }, () => stt.testHearingService('azure', readers()));
    assert.equal(res.result, 'ok');
    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /westus2/);
    assert.equal(seen[0].init.headers['Ocp-Apim-Subscription-Key'], KEY);
    assert.ok(!res.message.includes(KEY));
});

test('a refused Azure key is reported as failed', async () => {
    const res = await withFetch(async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => '' }),
        () => stt.testHearingService('azure', readers()));
    assert.equal(res.result, 'failed');
    assert.ok(res.message.length > 0);
});

test('a REST service is tested by the transcription request itself', async () => {
    const urls = [];
    const res = await withFetch(async (url) => {
        urls.push(String(url));
        return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => '' };
    }, () => stt.testHearingService('google', readers()));
    assert.equal(res.result, 'ok', res.message);
    assert.equal(urls.length, 1);
    assert.equal(urls[0], STT_PROVIDERS.google.url({ key: KEY }));
});

test('a refusal that quotes the key back never puts the key in the report', async () => {
    const res = await withFetch(async () => ({
        ok: false, status: 400,
        text: async () => `{"error":{"message":"API key not valid: ${KEY}"}}`,
        json: async () => ({}),
    }), () => stt.testHearingService('google', readers()));
    assert.equal(res.result, 'failed');
    assert.ok(!res.message.includes(KEY), res.message);
});

test('no connection is reported as failed, not thrown', async () => {
    const res = await withFetch(async () => { throw new TypeError('Failed to fetch'); },
        () => stt.testHearingService('elevenlabs', readers()));
    assert.equal(res.result, 'failed');
    assert.match(res.message, /internet/);
});

test('sttRest.testKey with no key does not contact the service', async () => {
    let called = 0;
    const res = await withFetch(async () => { called++; return { ok: true }; },
        () => sttRest.testKey(STT_PROVIDERS.google, ''));
    assert.equal(res.ok, false);
    assert.equal(called, 0);
});

// --- The voice check: asks the paid voice for a word and plays nothing -------------

test("the device's own voice needs no test", async () => {
    const tts = await import('../app/js/tts.js?v=1');
    tts.setProvider('builtin');
    const res = await tts.testPaidVoice();
    assert.equal(res.result, 'not needed');
});

test('a paid voice with no key reports "no key" without contacting it', async () => {
    const tts = await import('../app/js/tts.js?v=2');
    let called = 0;
    tts.setProvider('google', { getKey: () => '' });
    tts.setProviderCredentials('google', { getKey: () => '' });
    const res = await withFetch(async () => { called++; return { ok: true }; }, () => tts.testPaidVoice());
    assert.equal(res.result, 'no key');
    assert.equal(called, 0);
});

test('a refused voice is reported as failed, with the key removed', async () => {
    const tts = await import('../app/js/tts.js?v=3');
    tts.setProvider('google', { getKey: () => KEY });
    tts.setProviderCredentials('google', { getKey: () => KEY, getModel: () => '' });
    const res = await withFetch(async () => ({
        ok: false, status: 400,
        text: async () => `{"error":{"message":"API key not valid: ${KEY}"}}`,
        json: async () => ({}),
    }), () => tts.testPaidVoice());
    assert.equal(res.service, 'google');
    assert.equal(res.result, 'failed');
    assert.ok(!res.message.includes(KEY), res.message);
});

// --- The AI check: one real request through the provider seam ------------------------

test('the AI check with no key reports "no key" without contacting it', async () => {
    const llm = await import('../app/js/llm.js?v=1');
    llm.setApiKey('');
    let called = 0;
    const res = await withFetch(async () => { called++; return { ok: true }; }, () => llm.testSuggestions());
    assert.equal(res.result, 'no key');
    assert.equal(called, 0);
});

test('the AI check makes a real, tiny request with the suggestions model', async () => {
    const llm = await import('../app/js/llm.js?v=2');
    llm.setApiKey(KEY);
    const sent = [];
    const res = await withFetch(async (url, init) => {
        sent.push({ url: String(url), body: JSON.parse(init.body) });
        return { ok: true, status: 200, json: async () => ({
            content: [{ type: 'text', text: 'ready' }], stop_reason: 'end_turn',
            usage: { input_tokens: 15, output_tokens: 1 },
        }) };
    }, () => llm.testSuggestions());
    assert.equal(res.result, 'ok', res.message);
    assert.equal(sent.length, 1);
    assert.match(sent[0].url, /\/v1\/messages/);
    assert.equal(sent[0].body.model, llm.providerInfo().model);
    assert.ok(sent[0].body.max_tokens <= 20);
});

test('an AI refusal such as an empty credit balance is reported, key removed', async () => {
    const llm = await import('../app/js/llm.js?v=3');
    llm.setApiKey(KEY);
    const res = await withFetch(async () => ({
        ok: false, status: 400,
        json: async () => ({ error: { message: `Your credit balance is too low (${KEY})` } }),
        text: async () => `{"error":{"message":"Your credit balance is too low (${KEY})"}}`,
    }), () => llm.testSuggestions());
    assert.equal(res.result, 'failed');
    assert.ok(!res.message.includes(KEY), res.message);
});

// app.js cannot be loaded by a test, so the wiring is checked in the source. The two
// faults these catch are silent: a test is never run, or it runs in the weekly report,
// which contacts a paid service on its own.
test('the problem report runs all three checks; the weekly report runs none', async () => {
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const app = strip(await readFile(new URL('../app/js/app.js', import.meta.url), 'utf8'));
    const body = app.slice(app.indexOf('async function buildProblemReportText'));
    const fn = body.slice(0, body.indexOf('\n}\n'));
    assert.match(fn, /stt\.testHearingService\(storage\.loadSttProvider\(\)/);
    assert.match(fn, /tts\.testPaidVoice\(/);
    assert.match(fn, /llm\.testSuggestions\(/);
    for (const k of ['hearingTest,', 'voiceTest,', 'aiTest,']) assert.ok(fn.includes(k), k);
    const weekly = strip(await readFile(new URL('../app/js/weekly-send.js', import.meta.url), 'utf8'));
    assert.ok(!/testHearingService|testPaidVoice|testSuggestions/.test(weekly));
    const diag = strip(await readFile(new URL('../app/js/diagnostics.js', import.meta.url), 'utf8'));
    const collect = diag.slice(diag.indexOf('export async function collectSystemInfo'), diag.indexOf('export function collectPersonalization'));
    assert.ok(!/hearingTest|voiceTest|aiTest/.test(collect), 'collectSystemInfo also feeds the weekly report');
});
