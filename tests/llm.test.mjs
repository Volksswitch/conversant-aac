/* Tier 2 — LLM adapter parsing + the llm→engine data path (app/js/llm.js).
 *
 * No real API: global fetch is mocked to return canned Anthropic-style responses,
 * so this exercises the REAL public path (generateResponses → parseGeneration) and
 * the request-body shaping, plus feeding a parsed result through the engine. This
 * is the seam that failed in July 2026 — the engine branching on the model's
 * classification — verified here without spending a token.
 */
import { mockFetch, restoreFetch, getFetchCalls } from './env.mjs';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as llm from '../app/js/llm.js';
import * as engine from '../app/js/engine.js';

beforeEach(() => llm.setApiKey('test-key'));
afterEach(() => restoreFetch());

const structured = JSON.stringify({
    partner_action: 'QUESTION',
    turn_status: 'COMPLETE',
    is_repair_initiator: false,
    responses: [
        { slot: 'PREFERRED', text: 'Pretty good, thanks.' },
        { slot: 'DISPREFERRED', text: "Honestly, a bit tired." },
        { slot: 'INITIATIVE', text: 'How about you?' },
        { slot: 'REPAIR', text: 'Sorry?' },
    ],
    missing_facts: ['home_city'],
});

test('parses the structured object into classification + responses + missingFacts', async () => {
    mockFetch(structured);
    const r = await llm.generateResponses([{ role: 'partner', text: 'How are you?' }]);
    assert.equal(r.classification.partner_action, 'QUESTION');
    assert.equal(r.classification.turn_status, 'COMPLETE');
    assert.equal(r.responses.length, 4);
    assert.equal(r.responses[0].slot, 'PREFERRED');
    assert.deepEqual(r.missingFacts, ['home_city']);
});

test('tolerates a legacy bare array of strings', async () => {
    mockFetch(JSON.stringify(['Yes please.', 'No thanks.', 'Maybe later.']));
    const r = await llm.generateResponses([{ role: 'partner', text: 'Coffee?' }]);
    assert.equal(r.classification, null);
    assert.deepEqual(r.responses.map(x => x.slot), ['PREFERRED', 'DISPREFERRED', 'INITIATIVE']);
    assert.equal(r.responses[0].text, 'Yes please.');
});

test('tolerates a legacy {options:[...]} object', async () => {
    mockFetch(JSON.stringify({ partner_action: 'INVITATION', options: ['Sure.', 'Not today.'] }));
    const r = await llm.generateResponses([{ role: 'partner', text: 'Lunch?' }]);
    assert.equal(r.classification.partner_action, 'INVITATION');
    assert.deepEqual(r.responses.map(x => x.text), ['Sure.', 'Not today.']);
});

test('defaults a missing turn_status to COMPLETE', async () => {
    mockFetch(JSON.stringify({ partner_action: 'STATEMENT', responses: [{ slot: 'PREFERRED', text: 'Nice.' }] }));
    const r = await llm.generateResponses([{ role: 'partner', text: 'It rained.' }]);
    assert.equal(r.classification.turn_status, 'COMPLETE');
});

test('extracts the JSON object even when the model wraps it in prose', async () => {
    mockFetch('Here you go:\n' + structured + '\nHope that helps!');
    const r = await llm.generateResponses([{ role: 'partner', text: 'How are you?' }]);
    assert.equal(r.responses.length, 4);
});

test('throws when the response has no parseable responses/options', async () => {
    mockFetch('completely unparseable, no braces at all');
    await assert.rejects(() => llm.generateResponses([{ role: 'partner', text: 'x' }]), /Could not parse/);
});

test('throws on an HTTP error, surfacing the status', async () => {
    mockFetch('rate limited', { ok: false, status: 429 });
    await assert.rejects(() => llm.generateResponses([{ role: 'partner', text: 'x' }]), /429/);
});

test('Reframe steer text is injected into the system prompt as user-authored ground truth', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How are you?' }], {}, { steer: 'I actually won my chess game last night' });
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /I actually won my chess game last night/);
    assert.match(sys, /TRUE/); // framed as ground truth that overrides the keep-it-general caution
});

test('regenerate "avoid" list is injected so the model takes a different angle', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How are you?' }], {}, { avoid: ['Pretty good, thanks.'] });
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /Pretty good, thanks\./);
});

test('perCategory:2 requests 8 responses and a larger token budget', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How are you?' }], {}, { perCategory: 2 });
    const body = getFetchCalls()[0].body;
    assert.equal(body.max_tokens, 1000);
    assert.match(body.system, /8 responses total/);
});

test('conversation history maps partner→user and user→assistant roles', async () => {
    mockFetch(structured);
    await llm.generateResponses([
        { role: 'user', text: 'Hi Tyler, got a minute?' },
        { role: 'partner', text: 'Sure.' },
    ]);
    assert.deepEqual(getFetchCalls()[0].body.messages, [
        { role: 'assistant', content: 'Hi Tyler, got a minute?' },
        { role: 'user', content: 'Sure.' },
    ]);
});

test('partner_has_paused injects a force-complete instruction into the prompt', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Go ahead. Uh, my ears are wide open.' }], { partner_has_paused: true });
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /PAUSED and gone quiet/);
    assert.match(sys, /never an empty responses array/i);
});

test('DATA PATH: a mocked COMPLETE result flows through the engine to a 4-card palette', async () => {
    mockFetch(structured);
    engine.reset();
    engine.partnerSpeaking('How are you?');
    const result = await llm.generateResponses([{ role: 'partner', text: 'How are you?' }], engine.buildRequestContext());
    const snap = engine.ingestClassification(result, 'How are you?');
    assert.equal(snap.mode, engine.MODE.RESPONDING);
    assert.equal(snap.palette.length, 4);
    assert.equal(snap.palette[0].text, 'Pretty good, thanks.');
});

test('generateStatements parses a JSON array into STATEMENT-slot responses', async () => {
    mockFetch(JSON.stringify(['I wanted to tell you about my week.', 'Have you got a few minutes?']));
    const r = await llm.generateStatements('lead into my week', [], {}, 4);
    assert.equal(r.responses.length, 2);
    assert.ok(r.responses.every(x => x.slot === 'STATEMENT'));
    assert.equal(r.responses[0].text, 'I wanted to tell you about my week.');
});

test('repairOptions parses {rephrase, expand}', async () => {
    mockFetch(JSON.stringify({ rephrase: 'I was at the market.', expand: 'I went to the market for fruit.' }));
    const r = await llm.repairOptions('I went to the market.');
    assert.equal(r.rephrase, 'I was at the market.');
    assert.equal(r.expand, 'I went to the market for fruit.');
});

test('cleanupTranscript returns the corrected text', async () => {
    mockFetch('Hey Mark, how are you?');
    const out = await llm.cleanupTranscript('kmart how are you', [{ role: 'partner', text: 'x' }]);
    assert.equal(out, 'Hey Mark, how are you?');
});

test('cleanupTranscript falls back to the raw text with no API key', async () => {
    llm.setApiKey('');   // no key
    const out = await llm.cleanupTranscript('raw and uncleaned');
    assert.equal(out, 'raw and uncleaned');
});

test('cleanupTranscript falls back to the raw text on an API error', async () => {
    mockFetch('boom', { ok: false, status: 500 });
    const out = await llm.cleanupTranscript('raw and uncleaned', []);
    assert.equal(out, 'raw and uncleaned');
});

test('repairSelf(expand) instructs the model to expand and returns the new utterance', async () => {
    mockFetch('I went to the market to buy some fruit.');
    const out = await llm.repairSelf('I went to the market.', 'expand', []);
    assert.equal(out, 'I went to the market to buy some fruit.');
    assert.match(getFetchCalls()[0].body.system, /Expand and clarify/);
});

test('repairSelf(rephrase) instructs the model to rephrase', async () => {
    mockFetch('I was at the market.');
    await llm.repairSelf('I went to the market.', 'rephrase', []);
    assert.match(getFetchCalls()[0].body.system, /Rephrase/);
});
