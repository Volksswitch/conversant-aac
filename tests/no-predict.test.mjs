/* Word completion must stay OFF in the "How to say it" boxes.
 *
 * (!) WHY A SOURCE-LEVEL GUARD RATHER THAN A UNIT TEST. The decision lives in
 * keyboard.js, which cannot be loaded here - it builds a keyboard into a real
 * document and reads live field geometry. The behaviour was verified in the browser
 * instead (typing "thi" into "What the button says" shows the completion, the same
 * letters into "How to say it" show nothing), and this keeps that from rotting.
 *
 * (!) THE FAILURE IS SILENT IN BOTH DIRECTIONS, which is what earns a test. Lose the
 * marker on a field and completion quietly comes back; rename the marker in
 * keyboard.js and every field keeps its attribute while nothing reads it. Neither
 * throws, and the app looks completely normal - you find out when a respelling has
 * been replaced by the very spelling the voice already says wrong.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../app/js/' + p, import.meta.url), 'utf8');

test('keyboard.js still has one place that decides where prediction is off', () => {
    const src = read('keyboard.js');
    assert.match(src, /function predictionOff\(/,
        'the shared guard is gone - each caller will have drifted');
    assert.match(src, /dataset\s*&&\s*f\.dataset\.noPredict !== undefined/,
        'predictionOff no longer reads data-no-predict, so every marked field is unguarded');
});

test('both prediction entry points go through the guard', () => {
    const src = read('keyboard.js');
    // The ghost is what the user SEES; the prefix is what gets LEARNED. Missing the
    // second would keep respellings out of sight while still teaching them as words.
    // (!) Match the CALL SITES, not every mention: /predictionOff\(f\)/ also matches
    // the function's own declaration, so a bare count of 2 was satisfied by the
    // definition plus a single caller - and the test passed with the ghost path
    // unguarded. Found by deliberately breaking it.
    const uses = src.match(/if \(predictionOff\(f\)\)/g) || [];
    assert.ok(uses.length >= 2,
        `expected the ghost and the word-prefix reader to both consult it, found ${uses.length}`);
    assert.doesNotMatch(src, /if \(!f \|\| f\.id === 'apiKeyInput'\)/,
        'an old inline exclusion is back, which will disagree with predictionOff');
});

test('every "How to say it" field is marked', () => {
    // A respelling is a deliberate misspelling. Any box that collects one belongs here.
    const express = read('express-editor.js');
    assert.match(express, /'How to say it \(optional\)'[\s\S]{0,600}?noPredict: true/,
        'the Express Panel respelling field is no longer marked');

    const wv = read('worldview-ui.js');
    // Two sites: the shared name/nickname row, and the place form.
    const marked = (wv.match(/wv-say-as'[\s\S]{0,200}?'data-no-predict'/g) || []).length;
    assert.equal(marked, 2,
        `both worldview respelling fields must be marked, found ${marked}`);
});

test('the ordinary text fields are NOT marked', () => {
    // The guard is only ever right if it is narrow. If "What the button says" picked
    // up the marker, prediction would be dead where it is genuinely wanted - and that
    // is a silent loss of a feature, not an error.
    const express = read('express-editor.js');
    const saysIdx = express.indexOf("'What the button says'");
    const speakIdx = express.indexOf("'How to say it (optional)'");
    assert.ok(saysIdx > -1 && speakIdx > saysIdx, 'the two Express fields moved');
    assert.doesNotMatch(express.slice(saysIdx, speakIdx), /noPredict/,
        'the visible-text field must keep word completion');
});
