/* Tier 1/2 — the user's own practice scenarios (app/js/practice-library.js) and the
 * path from a scenario to the two prompts that use it.
 *
 * The load-bearing checks: a copy never changes the built-in; details and behavior
 * reach BOTH the partner prompt and the user's suggestions; the section 5.3 line is
 * present for every scenario; and edits survive a reload (read back from storage, not
 * from memory - the places.js respelling bug is why).
 */
import { resetLocalStorage, mockFetch, restoreFetch, getFetchCalls } from './env.mjs';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as library from '../app/js/practice-library.js';
import { SCENARIOS, getScenario } from '../app/js/practice-scenarios.js';
import * as llm from '../app/js/llm.js';

beforeEach(async () => { resetLocalStorage(); await library.load(); });
afterEach(() => restoreFetch());

const doctor = () => getScenario('doctor-visit');

test('a copy is editable and the built-in is left exactly as it was', async () => {
    const before = JSON.stringify(doctor());
    const id = await library.copyScenario(doctor());
    await library.updateScenario(id, { details: 'Dr. Alvarez, my right knee.', behavior: 'skeptical' });
    assert.equal(JSON.stringify(doctor()), before);
    const copy = library.getScenario(id);
    assert.equal(copy.title, doctor().title);
    assert.equal(copy.basedOn, 'doctor-visit');
    assert.equal(copy.behavior, 'skeptical');
});

test('the controls tour cannot be copied - there is no person to describe', async () => {
    assert.equal(await library.copyScenario(getScenario('controls-tour')), null);
    assert.equal(library.count(), 0);
});

test('edits survive a reload', async () => {
    const id = await library.copyScenario(doctor());
    await library.updateScenario(id, { details: 'Bring the scan results.', behavior: 'custom', behaviorText: 'tired and curt' });
    await library.load();
    const s = library.getScenario(id);
    assert.equal(s.details, 'Bring the scan results.');
    assert.equal(s.behavior, 'custom');
    assert.equal(s.behaviorText, 'tired and curt');
});

test('blanking the name keeps the old one', async () => {
    const id = await library.copyScenario(doctor());
    await library.updateScenario(id, { title: '   ' });
    assert.equal(library.getScenario(id).title, doctor().title);
});

test('delete removes only that scenario', async () => {
    const a = await library.copyScenario(doctor());
    const b = await library.copyScenario(getScenario('job-interview'));
    await library.removeScenario(a);
    assert.deepEqual(library.listScenarios().map(s => s.id), [b]);
});

test('the partner is never difficult about disability - every scenario, every behavior', () => {
    for (const s of SCENARIOS.filter(x => x.partnerPersona)) {
        assert.match(library.buildPartnerBrief(s), /Never be difficult about the user's disability/);
    }
    for (const b of library.BEHAVIORS) {
        const brief = library.buildPartnerBrief({ ...doctor(), behavior: b.id, behaviorText: 'cold' });
        assert.match(brief, /Never be difficult about the user's disability/, b.id);
    }
});

test('details and behavior reach the partner brief; empty details add nothing', () => {
    const plain = library.buildPartnerBrief(doctor());
    assert.doesNotMatch(plain, /Details the user wrote/);
    const mine = library.buildPartnerBrief({ ...doctor(), behavior: 'angry', details: 'Late rent, March.' });
    assert.match(mine, /openly annoyed/);
    assert.match(mine, /Late rent, March\./);
    assert.match(mine, /Do not give ground easily/);
});

test('a plain built-in adds nothing to the user side; details are sent as true', () => {
    assert.equal(library.buildUserSideBlock(doctor()), '');
    const block = library.buildUserSideBlock({ ...doctor(), details: 'My right knee since March.' });
    assert.match(block, /TRUE facts/);
    assert.match(block, /My right knee since March\./);
});

test('parseDraft tolerates prose and fills a missing title; rejects no persona', () => {
    const d = library.parseDraft('Here: {"category":"Personal","partnerPersona":"Sarah, my girlfriend.","behavior":"warm","opensWith":"user"}', 'Tell Sarah it is over');
    assert.equal(d.title, 'Tell Sarah it is over');
    assert.equal(d.opensWith, 'user');
    assert.equal(library.parseDraft('{"title":"x"}'), null);
    assert.equal(library.parseDraft('not json'), null);
});

// ⚠ THE CROSS-LAYER CHECK: a scenario the user saved, read back from storage, handed to
// the real partner-authoring call. Every other test here hands a layer its input.
test('a saved scenario reaches the partner request with its details and mood', async () => {
    const id = await library.copyScenario(doctor());
    await library.updateScenario(id, { details: 'Dr. Alvarez, rheumatologist.', behavior: 'distracted' });
    await library.load();
    llm.setApiKey('sk-ant-test');
    mockFetch('Hi, what brings you in?');
    const line = await llm.generatePartnerUtterance(library.getScenario(id), []);
    assert.equal(line, 'Hi, what brings you in?');
    const body = getFetchCalls().at(-1).body;
    const sys = typeof body.system === 'string' ? body.system : body.system.map(b => b.text).join('');
    assert.match(sys, /Dr\. Alvarez, rheumatologist\./);
    assert.match(sys, /half paying attention/);
    assert.match(sys, /mean the USER, never you/);
});
