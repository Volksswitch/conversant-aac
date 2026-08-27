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
import * as convLogic from '../app/js/conversation-logic.js';

beforeEach(() => llm.setApiKey('test-key'));
afterEach(() => restoreFetch());

/*
 * What the model actually SEES as its system prompt, regardless of how the request
 * carries it. `system` is a plain string on most calls, but generateResponses sends
 * an array of two text blocks so a cache breakpoint can sit between them (see the
 * caching note in llm.js) — and the API concatenates them. Asserting through this
 * helper keeps every prompt-content test about the CONTENT rather than the
 * transport, so adding or moving a cache breakpoint can't fail eighteen tests that
 * have nothing to do with caching.
 */
const sysText = (call) => Array.isArray(call.body.system)
    ? call.body.system.map(b => b.text).join('')
    : call.body.system;

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
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /I actually won my chess game last night/);
    assert.match(sys, /TRUE/); // framed as ground truth that overrides the keep-it-general caution
});

test('regenerate "avoid" list is injected so the model takes a different angle', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How are you?' }], {}, { avoid: ['Pretty good, thanks.'] });
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /Pretty good, thanks\./);
});

test('perCategory:2 requests 8 responses and a larger token budget', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How are you?' }], {}, { perCategory: 2 });
    const body = getFetchCalls()[0].body;
    assert.equal(body.max_tokens, 1000);
    assert.match(sysText(getFetchCalls()[0]), /8 responses total/);
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

test('the prompt instructs ALWAYS returning responses (turn_status no longer gates)', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'So the other day I was walking and' }], {});
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /ALWAYS return all four/);
    assert.match(sys, /INFORMATIONAL ONLY/);
});

// Every response is spoken by TTS, never read, so a written-only form like "fw"
// (texting shorthand for "fuck with") is unsayable however good it looks on the
// card — Ken hit exactly that, August 3 2026. The Practice-partner prompt had
// carried a spoken-aloud instruction all along; the prompt that voices the USER
// did not, which is the wrong way round. Guarded because it is a single sentence
// in a long prompt and nothing else would notice its removal.
test('the prompt says the responses will be SPOKEN, and bans written-only forms', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Tell me what you think.' }], {});
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /SPOKEN ALOUD/);
    assert.match(sys, /fw/);                      // the offending form is named outright
    // It must stay a SPEAKABILITY rule, not a register rule: an adult user's level
    // of slang is their own call and comes from the worldview profile.
    assert.match(sys, /NOT a register rule/);
});

// Absolute for now (Ken, August 3 2026): vulgarity is to be explicitly chosen and
// scoped to an identified partner, which is a future feature. The load-bearing half
// is the refusal to INFER — the offending card was generated with partner: null and
// an age in the profile, both of which the model read as licence.
test('the prompt forbids vulgarity and refuses to infer permission from age or context', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Tell me what you think.' }], {});
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /No vulgarity/);
    assert.match(sys, /the user's age/);          // named as NOT permission
    assert.match(sys, /absence of an instruction/);
});

/*
 * The user is a person, not a smart speaker (Ken, August 8 2026). Found live: the
 * partner asked for Columbus's three ships, the square root of 2, and a definition
 * of entangled particles, and the app answered all three at full depth in the user's
 * voice. The June anti-fabrication rule did not catch it because none of those are
 * autobiography.
 *
 * Two halves are load-bearing and each has its own assertion below. (1) The refusal
 * to infer permission — "it's obvious" and "I'm certain" are exactly the cases the
 * rule must survive, since Ken's argument is that the partner ASKING is evidence the
 * fact is not common ground. (2) No hedged facts, which is the tempting middle road
 * and is not a safeguard: the number still leaves the device as the user's word.
 */
test('the prompt refuses to supply outside knowledge, and will not infer permission', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: "What's the square root of 2?" }], {});
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /NOT an information service/);
    assert.match(sys, /never supply factual knowledge about the world/i);
    assert.match(sys, /however elementary/);          // "it's obvious" is not licence
    assert.match(sys, /however certain you are/);     // nor is being sure
    assert.match(sys, /absence of any instruction/);
    assert.match(sys, /behind a hedge/);              // a hedged fact is still the fact
});

// The over-trigger risk is the real one, and it is the same shape as the
// narrative-list guard on offered_options: a rule aimed at reference questions that
// bleeds into ordinary talk makes the user evasive, which is its own failure.
test('the prompt guards against over-applying it to ordinary conversation', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How was your weekend?' }], {});
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /MOST turns are not knowledge questions/);
    assert.match(sys, /How was your weekend\?/);
    assert.match(sys, /evasive/);
});

// The escape hatch is the whole reason the strict default is affordable: a fact the
// user typed is a fact the user has. If Reframe did not override the rule, a user
// who knows the answer would be refused their own knowledge.
test('typed guidance overrides the outside-knowledge rule, not just the general one', async () => {
    mockFetch(structured);
    await llm.generateResponses(
        [{ role: 'partner', text: 'How far away is the moon?' }],
        {},
        { steer: "it's about 240 thousand miles" }
    );
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /override BOTH/);
    assert.match(sys, /rule against supplying outside knowledge/);
});

// The repair paths reword the user's own words; "expand" is the one that would reach
// for a fact to add detail with. They get the short form, so assert they get it at all.
test('both repair paths forbid adding facts while rewording', async () => {
    mockFetch('{"rephrase": "Said another way.", "expand": "Said with a bit more."}');
    await llm.repairOptions('I went out earlier.', []);
    assert.match(sysText(getFetchCalls()[0]), /Clearer wording, not more information/);

    restoreFetch();
    mockFetch('Said another way.');
    await llm.repairSelf('I went out earlier.', 'expand', []);
    assert.match(sysText(getFetchCalls()[0]), /Clearer wording, not more information/);
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

test('repairSelf(expand) instructs the model to expand and returns the new utterance', async () => {
    mockFetch('I went to the market to buy some fruit.');
    const out = await llm.repairSelf('I went to the market.', 'expand', []);
    assert.equal(out, 'I went to the market to buy some fruit.');
    assert.match(sysText(getFetchCalls()[0]), /Expand and clarify/);
});

test('repairSelf(rephrase) instructs the model to rephrase', async () => {
    mockFetch('I was at the market.');
    await llm.repairSelf('I went to the market.', 'rephrase', []);
    assert.match(sysText(getFetchCalls()[0]), /Rephrase/);
});

// --- Closed-set (alternative-question) turns ----------------------------------

const choiceJson = JSON.stringify({
    partner_action: 'QUESTION',
    turn_status: 'COMPLETE',
    is_repair_initiator: false,
    offered_options: ['mild', 'moderate', 'severe'],
    responses: [
        { slot: 'CHOICE', text: "It's been pretty mild.", hint: 'mild' },
        { slot: 'CHOICE', text: "I'd call it moderate.", hint: 'moderate' },
        { slot: 'CHOICE', text: "Honestly, it's been severe.", hint: 'severe' },
        { slot: 'CHOICE_OTHER', text: "It's somewhere in between.", hint: 'in between' },
    ],
    missing_facts: [],
});

test('parses offered_options and the CHOICE palette through to the engine', async () => {
    mockFetch(choiceJson);
    const result = await llm.generateResponses(
        [{ role: 'partner', text: 'Is the tiredness mild, moderate, or severe?' }], {});
    assert.deepEqual(result.classification.offered_options, ['mild', 'moderate', 'severe']);
    engine.reset();
    const snap = engine.ingestClassification(result, 'Is the tiredness mild, moderate, or severe?');
    assert.deepEqual(snap.palette.map(p => p.hint), ['mild', 'moderate', 'severe', 'in between']);
});

test('offered_options is [] when the model omits it (ordinary turn)', async () => {
    mockFetch(structured);
    const result = await llm.generateResponses([{ role: 'partner', text: 'How are you?' }], {});
    assert.deepEqual(result.classification.offered_options, [],
        'a model that omits the field must not break the ordinary four-slot path');
});

test('the prompt tells the model the palette ceiling and the closed-set rule', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Hi' }], {}, { perCategory: 1 });
    const oneUp = sysText(getFetchCalls()[0]);
    assert.match(oneUp, /offered_options/);
    assert.match(oneUp, /at most 4 responses total/, '1-per-category → a 4-card ceiling');

    restoreFetch();
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Hi' }], {}, { perCategory: 2 });
    const twoUp = sysText(getFetchCalls()[0]);
    assert.match(twoUp, /at most 8 responses total/, '2-per-category → an 8-card ceiling');
});

// --- Choice chips: focusChoice must override the closed-set rule ---------------
// Without the override the model re-detects the same menu on the regenerate and
// hands back the choice cards again, so tapping a chip would appear to do nothing.

test('focusChoice tells the model the choice is settled and to use the four slots', async () => {
    mockFetch(structured);
    await llm.generateResponses(
        [{ role: 'partner', text: 'Mild, moderate, or severe?' }], {}, { focusChoice: 'moderate' });
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /ALREADY CHOSEN/, 'the override must be stated unambiguously');
    assert.match(sys, /"moderate"/, 'the picked alternative reaches the prompt');
    assert.match(sys, /closed-set rule does NOT apply/,
        'without this the model re-detects the menu and returns choice cards again');
});

test('no focusChoice block on an ordinary generation', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How are you?' }], {});
    assert.doesNotMatch(sysText(getFetchCalls()[0]), /ALREADY CHOSEN/);
});

test('a focused regeneration refreshes the palette without touching the stack', async () => {
    // The chip is a guided regenerate: the partner's turn and its open obligation
    // must survive, or the sequence stack grows a duplicate FPP.
    engine.reset();
    mockFetch(choiceJson);
    const first = await llm.generateResponses([{ role: 'partner', text: 'Mild, moderate, or severe?' }], {});
    engine.ingestClassification(first, 'Mild, moderate, or severe?');
    const depthBefore = engine.getSnapshot().sequenceStack.length;

    restoreFetch();
    mockFetch(structured);
    const focused = await llm.generateResponses(
        [{ role: 'partner', text: 'Mild, moderate, or severe?' }], {}, { focusChoice: 'moderate' });
    const snap = engine.refreshPalette(focused.responses);
    assert.equal(snap.sequenceStack.length, depthBefore, 'refreshPalette must not push a duplicate FPP');
    assert.deepEqual(snap.palette.map(p => p.slot), ['PREFERRED', 'DISPREFERRED', 'INITIATIVE', 'REPAIR'],
        'the focused palette is the four structural slots, not another choice set');
});

test('the closed-set rule tells the model to fill every spare cell', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Tea or coffee?' }], {}, { perCategory: 1 });
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /FILL EVERY ONE/, 'two alternatives must not leave two dead cells');
    for (const slot of ['CHOICE_OTHER', 'CHOICE_ASK', 'CHOICE_REPAIR']) {
        assert.ok(sys.includes(slot), `${slot} must be offered as a filler`);
    }
});

// --- Steering must survive a "New N" regenerate on the SAME turn ---------------
// Ken, July 27 2026: after tapping the "milk" chip, pressing New-4 came back with
// all three options again — the regenerate rebuilt the request without the steer.
// These assert the request SHAPE that a regenerate has to send; app.js holds the
// per-turn steering that feeds it.

test('a regenerate carrying focusChoice still suppresses the closed-set shape', async () => {
    mockFetch(structured);
    await llm.generateResponses(
        [{ role: 'partner', text: 'Coffee, tea, or milk?' }], {},
        { avoid: ['Milk, please.'], focusChoice: 'milk', perCategory: 1 });
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /ALREADY CHOSEN/, 'the choice must survive into the regenerate');
    assert.match(sys, /"milk"/);
    assert.match(sys, /Milk, please\./, 'and the avoid list still asks for different wording');
});

test('a regenerate can carry the composer steer and the avoid list together', async () => {
    mockFetch(structured);
    await llm.generateResponses(
        [{ role: 'partner', text: 'How was the trip?' }], {},
        { avoid: ['It was good.'], steer: 'keep it short' });
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /keep it short/, 'typed guidance must survive a New-N press');
    assert.match(sys, /It was good\./);
});

test('focusChoice and a typed steer can both apply to one regeneration', async () => {
    mockFetch(structured);
    await llm.generateResponses(
        [{ role: 'partner', text: 'Coffee, tea, or milk?' }], {},
        { focusChoice: 'milk', steer: 'mention I am lactose intolerant' });
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /"milk"/);
    assert.match(sys, /lactose intolerant/);
});

test('the partner\'s alternatives outrank the fillers when cells are tight', async () => {
    // Ken, July 27 2026: with four alternatives and four cells, all four are shown
    // and the escape hatch is dropped. Silently trading one of the partner's own
    // choices for a filler is the same defect the CHOICE palette exists to fix.
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Coffee, tea, milk, or juice?' }], {}, { perCategory: 1 });
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /ALWAYS TAKE PRECEDENCE/);
    assert.match(sys, /Never drop, merge, or omit one of them/);
    assert.match(sys, /return those alternatives ALONE and no fillers/);
    assert.match(sys, /ONLY IF CELLS REMAIN/, 'fillers are conditional on genuinely spare cells');
});

// --- Offered sets in everyday talk, not just textbook alternative questions ----
// Ken, July 27 2026: "We've got muffins, croissants, and a few different pastries
// today — anything jump out at you?" was NOT treated as a closed set, because the
// rule only described alternative questions (the list AS the question). In real
// service talk the list usually sits in a STATEMENT with an open invitation after
// it, which is the far more common form.

test('the offered-set rule covers a list in a statement, not just alternative questions', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Anything jump out at you?' }], {});
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /a list offered in a STATEMENT/, 'the common everyday form must be covered');
    assert.match(sys, /muffins, croissants/, 'the worked example is present');
    assert.match(sys, /does NOT have to be exhaustive/,
        'a partial menu still counts — "a few different pastries" must not disqualify it');
});

test('the offered-set rule still excludes a narrative list', async () => {
    // The widening must not turn "I picked up milk, eggs, and bread" into a menu.
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How was your day?' }], {});
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /OFFERING them for the user to choose from — not merely mentioning/);
    assert.match(sys, /milk, eggs, and bread/, 'the counter-example is present');
    assert.match(sys, /NEVER invent an option the partner did not say/);
});

test('a vague item in the list is not dressed up as a definite choice', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Anything jump out?' }], {});
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /do not pretend it is a definite choice/);
    assert.match(sys, /What kind of pastries do you have\?/, 'vague items become a question, not a fake pick');
});

test('a trailing question is a signal for an offered set, not a requirement', async () => {
    // Ken, July 27 2026: a question usually follows the options, and it is a strong
    // cue — but declarative offers ("I could do Tuesday, Wednesday, or Friday.")
    // carry no question at all, and casual planning is full of them. Requiring one
    // would drop that whole class.
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'I could do Tuesday or Friday.' }], {});
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /STRONG SIGNAL/);
    assert.match(sys, /but it is NOT required/);
    assert.match(sys, /a plain declarative offer counts too/);
});

/* --- Prompt caching (Ken, August 8 2026) ------------------------------------
 *
 * These guard a property that FAILS SILENTLY. If per-turn content drifts back
 * into the cached block, the app keeps working perfectly and simply stops
 * caching — no error, no warning, just a bill that quietly triples. Nothing in
 * the request or the response says "your prefix moved", so the only way to
 * notice is to assert the split here.
 */

const cachedBlock = (call) => call.body.system[0];
const turnBlock = (call) => call.body.system[1];

test('the generation request carries a cache breakpoint on the stable block only', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How are you?' }]);
    const sys = getFetchCalls()[0].body.system;
    assert.ok(Array.isArray(sys), 'system must be an array of blocks to carry a breakpoint');
    assert.equal(sys.length, 2);
    assert.deepEqual(sys[0].cache_control, { type: 'ephemeral' });
    assert.equal(sys[1].cache_control, undefined, 'the volatile tail must not be cached');
    assert.ok(sys.every(b => b.type === 'text' && b.text.length > 0), 'no empty blocks (the API rejects them)');
});

test('NOTHING that changes within a partner turn is inside the cached block', async () => {
    llm.setSituationBlock('SENTINEL_SITUATION');
    mockFetch(structured);
    await llm.generateResponses(
        [{ role: 'partner', text: 'How are you?' }],
        { phase: 'BODY', last_user_utterance: 'SENTINEL_CONTEXT' },
        { steer: 'SENTINEL_STEER', avoid: ['SENTINEL_AVOID'], focusChoice: 'SENTINEL_FOCUS' },
    );
    const call = getFetchCalls()[0];
    for (const s of ['SENTINEL_CONTEXT', 'SENTINEL_STEER', 'SENTINEL_AVOID', 'SENTINEL_FOCUS', 'SENTINEL_SITUATION']) {
        assert.ok(!cachedBlock(call).text.includes(s), `${s} leaked into the cached prefix — caching is now dead`);
        assert.ok(turnBlock(call).text.includes(s), `${s} must still reach the model, in the tail`);
    }
    llm.setSituationBlock('');
});

test('the cached block is byte-identical across calls that differ only per-turn', async () => {
    mockFetch(structured);
    const history = [{ role: 'partner', text: 'How are you?' }];
    await llm.generateResponses(history, { phase: 'BODY' });
    await llm.generateResponses(history, { phase: 'CLOSING' }, { avoid: ['Pretty good, thanks.'], steer: 'keep it short' });
    const [a, b] = getFetchCalls();
    assert.equal(cachedBlock(a).text, cachedBlock(b).text, 'a cache hit requires an identical prefix');
    assert.notEqual(turnBlock(a).text, turnBlock(b).text, 'the tail is where the per-turn difference belongs');
});

test('the profile IS cached, and editing it honestly invalidates the prefix', async () => {
    mockFetch(structured);
    llm.setWorldviewBlock('About me: I live in Denver.');
    await llm.generateResponses([{ role: 'partner', text: 'Hi' }]);
    llm.setWorldviewBlock('About me: I live in Boulder.');
    await llm.generateResponses([{ role: 'partner', text: 'Hi' }]);
    const [a, b] = getFetchCalls();
    assert.match(cachedBlock(a).text, /Denver/, 'the profile belongs in the cached block — it is stable per conversation');
    assert.notEqual(cachedBlock(a).text, cachedBlock(b).text, 'an About Me edit must change the prefix, not be silently stale');
    llm.setWorldviewBlock('');
});

test('the uncached calls still receive the situation block', async () => {
    llm.setSituationBlock('SENTINEL_SITUATION');
    mockFetch('reworded');
    await llm.repairSelf('I said something', 'rephrase');
    assert.match(sysText(getFetchCalls()[0]), /SENTINEL_SITUATION/);

    mockFetch(JSON.stringify({ rephrase: 'a', expand: 'b' }));
    await llm.repairOptions('I said something');
    assert.match(sysText(getFetchCalls()[0]), /SENTINEL_SITUATION/);

    mockFetch(JSON.stringify(['One.', 'Two.', 'Three.', 'Four.']));
    await llm.generateStatements('talk about the trip');
    assert.match(sysText(getFetchCalls()[0]), /SENTINEL_SITUATION/);
    llm.setSituationBlock('');
});

test('usage reports the three input buckets separately, not one merged number', async () => {
    const seen = [];
    llm.onUsage((u) => seen.push(u));
    mockFetch({
        content: [{ text: structured }],
        usage: { input_tokens: 12, output_tokens: 34, cache_creation_input_tokens: 3400, cache_read_input_tokens: 0 },
    });
    await llm.generateResponses([{ role: 'partner', text: 'Hi' }]);
    assert.deepEqual(seen[0], { input: 12, output: 34, cacheWrite: 3400, cacheRead: 0 });

    // A cache HIT: input_tokens is only the uncached remainder, so pricing that
    // field alone would under-report this call by 3,400 tokens.
    mockFetch({
        content: [{ text: structured }],
        usage: { input_tokens: 12, output_tokens: 34, cache_read_input_tokens: 3400 },
    });
    await llm.generateResponses([{ role: 'partner', text: 'Hi' }]);
    assert.deepEqual(seen[1], { input: 12, output: 34, cacheWrite: 0, cacheRead: 3400 });

    // A call with no cache fields reports zeros rather than undefined, so the counter
    // can add them. repairOptions is uncached — only generateResponses is worth a
    // cache entry, because only it fires repeatedly against the same prefix.
    mockFetch(JSON.stringify({ rephrase: 'a', expand: 'b' }));
    await llm.repairOptions('hello there');
    assert.deepEqual(seen[2], { input: 1, output: 1, cacheWrite: 0, cacheRead: 0 });
    llm.onUsage(null);
});

// --- a number the partner asked for (Ken, August 22 2026) --------------------
// A scale is NOT a closed set: ten buttons reading 1 to 10 is not something anyone
// can scan mid-conversation, so it routes to the number pad instead. The prompt has
// to say so, or the model will helpfully enumerate it into offered_options.

test('the prompt separates a numeric range from a closed set', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'On a scale of one to ten, how bad is it?' }]);
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /"offered_range"/, 'the field is in the schema');
    assert.match(sys, /A SCALE IS NOT A CLOSED SET/, 'and the model is told not to enumerate it');
    assert.match(sys, /poor, fair, good, excellent/, 'with the word-scale counter-example, which IS a closed set');
});

test('a range is parsed, and the ends are tolerated in either order', async () => {
    mockFetch(JSON.stringify({
        partner_action: 'QUESTION', offered_options: [],
        offered_range: { min: '10', max: '1' },
        responses: [{ slot: 'PREFERRED', text: 'Pretty bad', hint: 'bad' }],
    }));
    const out = await llm.generateResponses([{ role: 'partner', text: 'one to ten?' }]);
    assert.deepEqual(out.classification.offered_range, { min: 1, max: 10 });
});

// ONE CHECK THAT CROSSES EVERY LAYER (the standing rule). The number button shipped in
// 0.7.14 announced and doing nothing, because each layer was tested with fabricated
// input and the link between two of them was never run. So this starts from a real
// model response and ends at the words on the button, taking each layer's OUTPUT as the
// next one's input: parse -> engine ingest -> snapshot -> label.
test('a real range response reaches the button as the label 123', async () => {
    mockFetch(JSON.stringify({
        partner_action: 'QUESTION', turn_status: 'COMPLETE', offered_options: [],
        offered_range: { min: 1, max: 10 },
        responses: [{ slot: 'PREFERRED', text: 'About a six.', hint: 'about a six' }],
    }));
    const out = await llm.generateResponses([{ role: 'partner', text: 'On a scale of one to ten?' }]);

    engine.reset();
    engine.partnerSpeaking('On a scale of one to ten?');
    const snap = engine.ingestClassification(out, 'On a scale of one to ten?');

    assert.deepEqual(snap.lastClassification.offered_range, { min: 1, max: 10 },
        'the range survives the engine, which drops any field not on its whitelist');
    assert.equal(convLogic.rangeLabel(snap.lastClassification.offered_range), '123',
        'and the button says what it does - never "1-10", which promises ten buttons');
});

test('no range means no number button at all', () => {
    assert.equal(convLogic.rangeLabel(null), '',
        'an ordinary turn must not draw one');
});

test('an open count has no top, and an ordinary turn has no range at all', async () => {
    mockFetch(JSON.stringify({ offered_range: { min: 1, max: null }, responses: [] }));
    const open = await llm.generateResponses([{ role: 'partner', text: 'how many?' }]);
    assert.deepEqual(open.classification.offered_range, { min: 1, max: null });

    restoreFetch();
    mockFetch(structured);
    const plain = await llm.generateResponses([{ role: 'partner', text: 'How are you?' }]);
    assert.equal(plain.classification.offered_range, null,
        'an ordinary turn must not acquire a number pad button');
});

// --- words the recognizer may have got wrong (Ken, August 27 2026) -----------
// This replaced the separate tidy-up request. It reports the same judgment instead
// of acting on it, inside the call that was already going out.

test('the prompt asks which words may have been misheard, with a precision guard', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'i can make it saturday' }]);
    const sys = sysText(getFetchCalls()[0]);
    assert.match(sys, /"heard_uncertain"/, 'the field is in the schema');
    // ⚠ WIDENED ON PURPOSE (August 27 2026). It first said to flag only a mishearing
    // that CHANGES THE MEANING, and two live runs disagreed with each other on the same
    // turn: "see side" for "seaside" is plainly a recognition error but the meaning is
    // obvious, so the criterion could be read either way. Ambiguous instruction,
    // unstable measure. It also aimed at the rarest case, which is the wrong target for
    // something whose job is comparing one room or one person against another.
    assert.match(sys, /whether or not you can work out what was meant/, 'any suspected mis-recognition');
    assert.match(sys, /slang, contractions, filler, false starts/, 'but how people talk is not an error');
    assert.match(sys, /Over-flagging is worse than under-flagging/, 'and a guard against flagging everything');
    assert.match(sys, /does NOT change your responses/,
        'the turn is still answered as best understood — this reports, it does not gate');
});

test('the asking rides in the CACHED half, so it costs nothing after the first send', async () => {
    // ⚠ Caching breaks silently and perfectly: move per-turn content into the cached
    // block and everything still works while the bill quietly triples. The instruction
    // is fixed text, so it belongs in the prefix — asserted rather than assumed.
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Hi' }]);
    const sys = getFetchCalls()[0].body.system;
    assert.ok(Array.isArray(sys), 'sent as blocks with a cache breakpoint');
    assert.match(sys[0].text, /"heard_uncertain"/, 'in the cached head');
});

test('doubted words are parsed out, and are NOT put in the classification', async () => {
    // ⚠ engine.ingestClassification rebuilds that object field by field and drops
    // anything it does not know about, silently — the defect that shipped the number
    // button doing nothing. Nothing here needs the engine, so it never goes near it.
    mockFetch(JSON.stringify({
        partner_action: 'STATEMENT', turn_status: 'COMPLETE', is_repair_initiator: false,
        offered_options: [], offered_range: null,
        responses: [{ slot: 'PREFERRED', text: 'Great.', hint: 'Great' }],
        missing_facts: [], heard_uncertain: ['can', '  ', ''],
    }));
    const r = await llm.generateResponses([{ role: 'partner', text: 'i can make it' }]);
    assert.deepEqual(r.heardUncertain, ['can'], 'trimmed, with blanks dropped');
    assert.ok(!('heard_uncertain' in r.classification), 'not routed through the engine');
});

test('a response with no doubted words yields an empty list, never undefined', async () => {
    // The app records the list on the turn; undefined would land in the file as a
    // missing field and read later as "this turn was never checked".
    mockFetch(structured);
    const r = await llm.generateResponses([{ role: 'partner', text: 'Hi' }]);
    assert.deepEqual(r.heardUncertain, []);
});
