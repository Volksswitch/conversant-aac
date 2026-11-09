/* Question sessions: the request that writes four answers, and the reading of its
 * reply (app/js/question-session.js, sent by llm.generateAnswers).
 *
 * The network is stubbed; the request that reaches it is checked as the service would
 * receive it, so the cache split is tested on the real request rather than on the
 * builder's own return value.
 */
import { mockFetch, restoreFetch, getFetchCalls } from './env.mjs';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as llm from '../app/js/llm.js';
import * as qs from '../app/js/question-session.js';

beforeEach(() => llm.setApiKey('test-key'));
afterEach(() => restoreFetch());

const reply = (answers, unclear = []) => JSON.stringify({ unclear_words: unclear, answers });
const FOUR = [
    { label: 'Silence, not speed', kind: 'short', text: 'Short answer.' },
    { label: 'Why gaps hurt', kind: 'angle', text: 'Angle one.' },
    { label: 'What rate shows', kind: 'angle', text: 'Angle two.' },
    { label: 'What to measure', kind: 'angle', text: 'Angle three.' },
];
const MATERIAL = [{ name: 'paper.txt', text: 'MATERIAL-SENTINEL The paper says silence matters.' }];

test('sends the material in the cached block and the per-question parts after it', async () => {
    mockFetch(reply(FOUR));
    await llm.generateAnswers({
        question: 'Why not words per minute?',
        material: MATERIAL,
        speakerNote: 'NOTE-SENTINEL I lead the project.',
        audience: 'AUDIENCE-SENTINEL therapists',
        alreadySaid: [{ q: 'Earlier question', a: 'SAID-SENTINEL an earlier answer' }],
    });
    const body = getFetchCalls()[0].body;
    assert.ok(Array.isArray(body.system), 'system is sent as blocks so the material can be cached');
    const [head, tail] = body.system;
    assert.deepEqual(head.cache_control, { type: 'ephemeral' });
    assert.match(head.text, /MATERIAL-SENTINEL/);
    assert.match(head.text, /NOTE-SENTINEL/);
    // Anything that changes per question must stay out of the cached block, or every
    // question would throw the cache away.
    assert.doesNotMatch(head.text, /SAID-SENTINEL|AUDIENCE-SENTINEL/);
    assert.match(tail.text, /SAID-SENTINEL/);
    assert.match(tail.text, /AUDIENCE-SENTINEL/);
    assert.equal(tail.cache_control, undefined);
    assert.match(body.messages[0].content, /A member of the audience asks: "Why not words per minute\?"/);
});

test('the reply shape is enforced by the service', async () => {
    mockFetch(reply(FOUR));
    await llm.generateAnswers({ question: 'Q?', material: MATERIAL });
    const fmt = getFetchCalls()[0].body.output_config.format;
    assert.equal(fmt.type, 'json_schema');
    assert.deepEqual(fmt.schema, qs.ANSWERS_SCHEMA);
});

test('carries the standing rules for spoken text', async () => {
    mockFetch(reply(FOUR));
    await llm.generateAnswers({ question: 'Q?', material: MATERIAL });
    const head = getFetchCalls()[0].body.system[0].text;
    assert.match(head, /SPOKEN ALOUD/);
    assert.match(head, /No vulgarity/);
});

test('with no note, says the speaker is not one of the people the material describes', () => {
    const req = qs.buildAnswerRequest({ question: 'Q?', material: MATERIAL });
    assert.match(req.system[0].text, /THE SPEAKER AND THIS MATERIAL: \(No note was given\. Assume the speaker is not one of the people the material describes\.\)/);
    assert.match(req.system[1].text, /\(nothing yet\)/);
});

test('the cached block is byte-identical whatever has already been said', () => {
    const a = qs.buildAnswerRequest({ question: 'One?', material: MATERIAL, speakerNote: 'n' });
    const b = qs.buildAnswerRequest({ question: 'Two?', material: MATERIAL, speakerNote: 'n',
        alreadySaid: [{ q: 'One?', a: 'An answer.' }], audience: 'someone else' });
    assert.equal(a.system[0].text, b.system[0].text);
});

test('reads four answers and the unclear words', async () => {
    mockFetch(reply(FOUR, ['covered']));
    const r = await llm.generateAnswers({ question: 'Is this covered?', material: MATERIAL });
    assert.equal(r.answers.length, 4);
    assert.equal(r.answers[0].kind, 'short');
    assert.deepEqual(r.unclearWords, ['covered']);
});

test('puts the short answer first even when the reply did not', () => {
    const shuffled = [FOUR[1], FOUR[2], FOUR[0], FOUR[3]];
    const r = qs.parseAnswers(reply(shuffled));
    assert.equal(r.answers[0].label, 'Silence, not speed');
    assert.deepEqual(r.answers.slice(1).map((a) => a.kind), ['angle', 'angle', 'angle']);
});

test('keeps at most four answers, drops empty ones, and supplies a missing label', () => {
    const r = qs.parseAnswers(reply([...FOUR, { label: 'Fifth', kind: 'angle', text: 'Too many.' },
        { label: 'Empty', kind: 'angle', text: '   ' }]));
    assert.equal(r.answers.length, 4);
    const r2 = qs.parseAnswers(reply([{ label: '', kind: 'short', text: 'Rate matters less than silence does here.' }]));
    assert.equal(r2.answers[0].label, 'Rate matters less than silence');
});

test('drops an "unclear word" that is really the question quoted back', () => {
    const r = qs.parseAnswers(reply(FOUR, ['covered', 'is this covered by medicaid or insurance', 'covered']));
    assert.deepEqual(r.unclearWords, ['covered']);
});

test('a reply that cannot be read throws, and keeps the reply for the error log', async () => {
    mockFetch('not json at all');
    await assert.rejects(llm.generateAnswers({ question: 'Q?', material: MATERIAL }),
        (err) => /could not be read/.test(err.message) && err.reply === 'not json at all');
    assert.throws(() => qs.parseAnswers(reply([])), /no answers/);
});

test('no key, no request', async () => {
    llm.setApiKey('');
    mockFetch(reply(FOUR));
    await assert.rejects(llm.generateAnswers({ question: 'Q?', material: MATERIAL }), /API key not set/);
    assert.equal(getFetchCalls().length, 0);
});

// The app's prompt must stay the tested prototype. If one is changed without the
// other, a re-run of the prototype no longer tests what the app sends.
test('the rules match the tested prototype in scripts/qa-session-eval/run.mjs', () => {
    const proto = readFileSync(new URL('../scripts/qa-session-eval/run.mjs', import.meta.url), 'utf8');
    const rules = (s) => (s.match(/^\d+\. .+$/gm) || []).map((l) => l.trim());
    const protoRules = rules(proto.slice(proto.indexOf('Rules:'), proto.indexOf('THE SPEAKER AND THIS MATERIAL')));
    const app = qs.buildAnswerRequest({ question: 'Q?', material: MATERIAL }).system[0].text;
    const appRules = rules(app.slice(app.indexOf('Rules:'), app.indexOf('THE SPEAKER AND THIS MATERIAL')));
    assert.equal(protoRules.length, 10);
    assert.deepEqual(appRules, protoRules);
});

// ⚠ THE CROSS-LAYER CHECK (standing rule: a change that crosses layers gets one check
// that crosses all of them). A reply shaped as the service sends it goes through the
// real request, the real reader and the real engine, and the snapshot the screen
// draws from is checked. Nothing here is handed to a layer pre-made.
import * as engine from '../app/js/engine.js';

test('a talk question runs from the service reply to the four cards on screen', async () => {
    engine.reset();
    // The short answer arrives third, as a careless reply might send it.
    mockFetch(reply([FOUR[1], FOUR[2], FOUR[0], FOUR[3]], ['covered']));
    const result = await llm.generateAnswers({ question: 'Is this covered?', material: MATERIAL,
        avoid: ['AVOID-SENTINEL'], steer: 'STEER-SENTINEL' });
    const tail = getFetchCalls()[0].body.system[1].text;
    assert.match(tail, /AVOID-SENTINEL/);
    assert.match(tail, /STEER-SENTINEL/);
    const snap = engine.ingestClassification({
        classification: { partner_action: 'QUESTION', turn_status: 'COMPLETE', is_repair_initiator: false },
        responses: qs.answersToResponses(result.answers),
    }, 'Is this covered?');
    assert.equal(snap.palette.length, 4, 'always four, whatever the two-per-category setting says');
    assert.deepEqual(snap.palette.map((m) => m.slot), ['ANSWER_SHORT', 'ANSWER', 'ANSWER', 'ANSWER']);
    assert.equal(snap.palette[0].hint, 'Silence, not speed', 'the label is the short form on the card');
    assert.equal(snap.palette[0].text, 'Short answer.', 'the full answer is what is spoken');
    assert.ok(snap.palette.every((m) => qs.isAnswerSlot(m.slot)));
    assert.equal(snap.floor, engine.FLOOR.SELF, 'the question is the partner\'s turn; the user owes the answer');
    // Picking one does not end anything the engine needs for New 4: refreshPalette
    // replaces the cards for the same question.
    engine.selectResponse(snap.palette[0]);
    const again = engine.refreshPalette(qs.answersToResponses(result.answers));
    assert.equal(again.palette.length, 4);
});

test('the cached block is unchanged by New 4 and Reframe', () => {
    const a = qs.buildAnswerRequest({ question: 'Q?', material: MATERIAL });
    const b = qs.buildAnswerRequest({ question: 'Q?', material: MATERIAL, avoid: ['x'], steer: 'y' });
    assert.equal(a.system[0].text, b.system[0].text);
});
