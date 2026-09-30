/* Tier 2 — the suggestion seam (app/js/suggest-provider.js + suggest-anthropic.js).
 *
 * These guard three failures that are SILENT: nothing errors, no test goes red, and
 * the app either costs several times more than it should or stops producing
 * suggestions altogether. Each was measured against the live API on September 30
 * 2026 before being written down here.
 *
 * Tests about what the PROMPT says live in llm.test.mjs. These are about the
 * transport and the boundary — the parts a provider owns.
 */
import { mockFetch, restoreFetch, getFetchCalls } from './env.mjs';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as llm from '../app/js/llm.js';
import * as provider from '../app/js/suggest-provider.js';

const PALETTE = JSON.stringify({
    partner_action: 'QUESTION',
    turn_status: 'COMPLETE',
    is_repair_initiator: false,
    responses: [
        { slot: 'PREFERRED', text: 'Good, thanks.', hint: 'good' },
        { slot: 'DISPREFERRED', text: 'Not great, honestly.', hint: 'not great' },
        { slot: 'INITIATIVE', text: 'How about you?', hint: 'ask back' },
        { slot: 'REPAIR', text: 'Sorry, what was that?', hint: 'say again' },
    ],
});

beforeEach(() => llm.setApiKey('test-key'));
afterEach(() => restoreFetch());

/*
 * ⚠ THE ONE THAT BREAKS THE APP COMPLETELY.
 *
 * Sonnet 4.6 does not think unless asked. Sonnet 5.5 thinks unless told not to, and
 * the two models disagree about how to say no — 5.5 refuses {"type":"disabled"} with
 * a 400 naming the replacement, and 4.6 does not accept {"type":"between_tools"}.
 *
 * Measured with the real prompt, three runs: without this field the model spent its
 * ENTIRE output budget thinking, returned no JSON at all, and the palette was
 * unparsable every time. Not slower and pricier — no suggestions, reported to the
 * user as an ordinary generation failure. A model change that forgets the matching
 * row in MODELS resurrects exactly that.
 */
test('the request tells the model not to think', async () => {
    mockFetch(PALETTE);
    await llm.generateResponses([{ role: 'partner', text: 'how are you?' }], {}, {});
    const body = getFetchCalls()[0].body;
    assert.deepEqual(body.thinking, { type: 'between_tools' },
        'the shipped model needs thinking switched off explicitly');
});

/*
 * ⚠ THE ONE THAT TRIPLES THE BILL.
 *
 * The response generator is the only cached call, and a lone system block is tidier
 * as a plain string — which silently drops the cache marker with it. The prompt is
 * about 28,000 bytes and is re-sent on every pause in the partner's speech, so losing
 * the marker means paying full price for all of it, several times per turn, with the
 * app behaving identically.
 */
test('the stable half of the prompt is still marked cacheable', async () => {
    mockFetch(PALETTE);
    await llm.generateResponses([{ role: 'partner', text: 'how are you?' }], {}, {});
    const system = getFetchCalls()[0].body.system;
    assert.ok(Array.isArray(system), 'the cached call sends blocks, never one string');
    assert.equal(system[0].cache_control && system[0].cache_control.type, 'ephemeral',
        'the first block carries the cache marker');
    assert.ok(system.length > 1, 'the volatile half sits after the marker, not inside it');
    assert.ok(!system[1].cache_control, 'the per-turn half must not be cached');
});

/* The uncached calls are not made into blocks for the sake of it. */
test('a call with nothing to cache sends a plain prompt', async () => {
    mockFetch('a line the partner says');
    await llm.generatePartnerUtterance({ partnerPersona: 'a friend', register: 'casual' }, []);
    assert.equal(typeof getFetchCalls()[0].body.system, 'string');
});

/*
 * ⚠ THE ONE THAT RETURNS REASONING INSTEAD OF AN ANSWER.
 *
 * If a future model turns thinking on, the first block in the reply is the reasoning
 * and the answer is behind it. Reading the first block blindly hands the parser a
 * paragraph of thinking, which fails as "could not parse" and points at the prompt
 * rather than at the reply.
 */
test('reasoning in the reply is skipped, not parsed', async () => {
    mockFetch({
        content: [
            { type: 'thinking', thinking: 'weighing the options' },
            { type: 'text', text: PALETTE },
        ],
        usage: { input_tokens: 1, output_tokens: 1 },
    });
    const r = await llm.generateResponses([{ role: 'partner', text: 'how are you?' }], {}, {});
    assert.equal(r.responses.length, 4);
    assert.equal(r.responses[0].text, 'Good, thanks.');
});

/*
 * Cached and uncached input bill at different rates, so they reach the cost counter
 * as separate numbers. Collapsing them into one total under-reports the bill by
 * roughly the hit rate — about ninety percent on the hot path — and a cost display
 * that reads low is worse than none here.
 */
test('the four kinds of token are reported separately', async () => {
    mockFetch({
        content: [{ type: 'text', text: PALETTE }],
        usage: {
            input_tokens: 10,
            output_tokens: 20,
            cache_creation_input_tokens: 30,
            cache_read_input_tokens: 40,
        },
    });
    let seen = null;
    llm.onUsage((u) => { seen = u; });
    await llm.generateResponses([{ role: 'partner', text: 'how are you?' }], {}, {});
    assert.deepEqual(seen, { input: 10, output: 20, cacheWrite: 30, cacheRead: 40 });
    llm.onUsage(null);
});

/*
 * The seam itself. An id from saved settings naming a provider this build does not
 * have must not stop the app starting — it degrades to the provider already in use,
 * which is visible and recoverable, rather than throwing on load.
 */
test('an unknown provider is ignored rather than fatal', () => {
    const before = provider.getProviderId();
    assert.equal(provider.setProvider('a-provider-that-does-not-exist'), before);
    assert.equal(provider.getProviderId(), before);
});

test('the shipped provider is registered and names its model', () => {
    const info = llm.providerInfo();
    assert.equal(info.id, 'anthropic');
    assert.ok(info.model, 'the About screen needs a model name to show');
});

/*
 * A provider that needs no key — anything running on the device — must not be asked
 * to prove one. The key checks are the only place the app assumes a service exists,
 * so they are the only place that has to know.
 */
test('a provider that needs no key is never asked for one', async () => {
    provider.register({
        id: 'on-device-stub',
        label: 'On this device',
        needsKey: false,
        complete: async () => ({ text: PALETTE, usage: null }),
    });
    const previous = provider.getProviderId();
    provider.setProvider('on-device-stub');
    try {
        assert.deepEqual(llm.validateKeyFormat(''), { ok: true });
        assert.deepEqual(await llm.testApiKey(null), { ok: true });
        // And it answers without a key having been set anywhere.
        const r = await llm.generateResponses([{ role: 'partner', text: 'hello' }], {}, {});
        assert.equal(r.responses.length, 4);
    } finally {
        provider.setProvider(previous);
    }
});
