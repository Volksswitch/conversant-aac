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

test('the prompt instructs ALWAYS returning responses (turn_status no longer gates)', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'So the other day I was walking and' }], {});
    const sys = getFetchCalls()[0].body.system;
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
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /SPOKEN ALOUD/);
    assert.match(sys, /fw/);                      // the offending form is named outright
    // It must stay a SPEAKABILITY rule, not a register rule: an adult user's level
    // of slang is their own call and comes from the worldview profile.
    assert.match(sys, /NOT a register rule/);
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
    const oneUp = getFetchCalls()[0].body.system;
    assert.match(oneUp, /offered_options/);
    assert.match(oneUp, /at most 4 responses total/, '1-per-category → a 4-card ceiling');

    restoreFetch();
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Hi' }], {}, { perCategory: 2 });
    const twoUp = getFetchCalls()[0].body.system;
    assert.match(twoUp, /at most 8 responses total/, '2-per-category → an 8-card ceiling');
});

// --- Choice chips: focusChoice must override the closed-set rule ---------------
// Without the override the model re-detects the same menu on the regenerate and
// hands back the choice cards again, so tapping a chip would appear to do nothing.

test('focusChoice tells the model the choice is settled and to use the four slots', async () => {
    mockFetch(structured);
    await llm.generateResponses(
        [{ role: 'partner', text: 'Mild, moderate, or severe?' }], {}, { focusChoice: 'moderate' });
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /ALREADY CHOSEN/, 'the override must be stated unambiguously');
    assert.match(sys, /"moderate"/, 'the picked alternative reaches the prompt');
    assert.match(sys, /closed-set rule does NOT apply/,
        'without this the model re-detects the menu and returns choice cards again');
});

test('no focusChoice block on an ordinary generation', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How are you?' }], {});
    assert.doesNotMatch(getFetchCalls()[0].body.system, /ALREADY CHOSEN/);
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
    const sys = getFetchCalls()[0].body.system;
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
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /ALREADY CHOSEN/, 'the choice must survive into the regenerate');
    assert.match(sys, /"milk"/);
    assert.match(sys, /Milk, please\./, 'and the avoid list still asks for different wording');
});

test('a regenerate can carry the composer steer and the avoid list together', async () => {
    mockFetch(structured);
    await llm.generateResponses(
        [{ role: 'partner', text: 'How was the trip?' }], {},
        { avoid: ['It was good.'], steer: 'keep it short' });
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /keep it short/, 'typed guidance must survive a New-N press');
    assert.match(sys, /It was good\./);
});

test('focusChoice and a typed steer can both apply to one regeneration', async () => {
    mockFetch(structured);
    await llm.generateResponses(
        [{ role: 'partner', text: 'Coffee, tea, or milk?' }], {},
        { focusChoice: 'milk', steer: 'mention I am lactose intolerant' });
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /"milk"/);
    assert.match(sys, /lactose intolerant/);
});

test('the partner\'s alternatives outrank the fillers when cells are tight', async () => {
    // Ken, July 27 2026: with four alternatives and four cells, all four are shown
    // and the escape hatch is dropped. Silently trading one of the partner's own
    // choices for a filler is the same defect the CHOICE palette exists to fix.
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Coffee, tea, milk, or juice?' }], {}, { perCategory: 1 });
    const sys = getFetchCalls()[0].body.system;
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
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /a list offered in a STATEMENT/, 'the common everyday form must be covered');
    assert.match(sys, /muffins, croissants/, 'the worked example is present');
    assert.match(sys, /does NOT have to be exhaustive/,
        'a partial menu still counts — "a few different pastries" must not disqualify it');
});

test('the offered-set rule still excludes a narrative list', async () => {
    // The widening must not turn "I picked up milk, eggs, and bread" into a menu.
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'How was your day?' }], {});
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /OFFERING them for the user to choose from — not merely mentioning/);
    assert.match(sys, /milk, eggs, and bread/, 'the counter-example is present');
    assert.match(sys, /NEVER invent an option the partner did not say/);
});

test('a vague item in the list is not dressed up as a definite choice', async () => {
    mockFetch(structured);
    await llm.generateResponses([{ role: 'partner', text: 'Anything jump out?' }], {});
    const sys = getFetchCalls()[0].body.system;
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
    const sys = getFetchCalls()[0].body.system;
    assert.match(sys, /STRONG SIGNAL/);
    assert.match(sys, /but it is NOT required/);
    assert.match(sys, /a plain declarative offer counts too/);
});
