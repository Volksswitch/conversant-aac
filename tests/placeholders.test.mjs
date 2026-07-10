/* Tier 1 — floor-holding placeholders (app/js/placeholders.js).
 *
 * Covers the role-by-position sequencing (first = acknowledgment, later =
 * thinking), the question-vs-general acknowledgment flavor, the per-turn cap, and
 * the "0 = none" gate. Observes output via the speechSynthesis shim (spokenTexts).
 * Real timers with tiny delays (savePlaceholderSettings sets them small).
 */
import { resetLocalStorage, resetSpoken, mockFetchFromDisk, spokenTexts } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as placeholders from '../app/js/placeholders.js';
import * as storage from '../app/js/storage.js';

// Mirrors app/data/placeholders.json (served from disk via mockFetchFromDisk).
const QUESTION_ACK = ['Good question.', "That's a good question.", "That's a fair question.", 'Hmm, good question.'];
const GENERAL_ACK = ['Let me see.', 'One moment.', 'Just a second.'];
const THINKING = ['Still thinking it through.', "I'm working out what I want to say.", 'Putting my thoughts together.', 'Still mulling that over.', 'Just gathering my thoughts.'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
    placeholders.stop();       // clear any timer from a prior test
    resetLocalStorage();
    resetSpoken();
    mockFetchFromDisk();       // serve the real placeholder pools
});

test('a question turn plays acknowledgment → thinking, capped at maxPlaceholders', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 2);
    placeholders.arm();
    await placeholders.start({ question: true });
    await sleep(220);
    assert.equal(spokenTexts.length, 2, 'the cap of 2 is respected');
    assert.ok(QUESTION_ACK.includes(spokenTexts[0]), `first is a question acknowledgment: ${spokenTexts[0]}`);
    assert.ok(THINKING.includes(spokenTexts[1]), `second is a thinking placeholder: ${spokenTexts[1]}`);
});

test('a non-question turn uses the neutral (general) acknowledgment first', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 2);
    placeholders.arm();
    await placeholders.start({ question: false });
    await sleep(120);
    assert.ok(GENERAL_ACK.includes(spokenTexts[0]), `first is a general acknowledgment: ${spokenTexts[0]}`);
});

test('maxPlaceholders = 0 means NONE — nothing is spoken', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 0);
    placeholders.arm();
    await placeholders.start({ question: true });
    await sleep(120);
    assert.equal(spokenTexts.length, 0);
});

test('consecutive thinking placeholders are never the same phrase back-to-back', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 3);
    placeholders.arm();
    await placeholders.start({ question: true });
    await sleep(260);
    assert.equal(spokenTexts.length, 3);
    assert.notEqual(spokenTexts[1], spokenTexts[2], 'two thinking placeholders in a row must differ');
});

test('stop() cancels a scheduled placeholder before it speaks', async () => {
    storage.savePlaceholderSettings(0.1, 0.1, 2);
    placeholders.arm();
    await placeholders.start({ question: true });
    placeholders.stop();       // quick selection cancels everything
    await sleep(160);
    assert.equal(spokenTexts.length, 0);
});
