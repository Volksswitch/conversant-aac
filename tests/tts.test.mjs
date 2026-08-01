/* Tier 1 — voice quality tier labelling (app/js/tts.js).
 *
 * WHY THIS IS TESTED: Apple ships an Enhanced or Premium voice under the SAME
 * `name` as its compact sibling, so the voiceURI is the only thing that tells them
 * apart. Get the parsing wrong in either direction and the picker is worse than
 * before — either two identical "Ava (en-US)" rows, or a confidently wrong tier.
 *
 * The voiceURI strings below are the real shapes each engine emits, so this file
 * doubles as the record of what we expect to see on the device.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tts from '../app/js/tts.js';

const v = (name, voiceURI, lang = 'en-US') => ({ name, voiceURI, lang });

test('Apple tiers are read from the voiceURI, not the name', () => {
    // The case the feature exists for: same name, different tier.
    assert.equal(tts.voiceQuality(v('Ava', 'com.apple.voice.compact.en-US.Ava')), 'Compact');
    assert.equal(tts.voiceQuality(v('Ava', 'com.apple.voice.enhanced.en-US.Ava')), 'Enhanced');
    assert.equal(tts.voiceQuality(v('Ava', 'com.apple.voice.premium.en-US.Ava')), 'Premium');
});

test('older Apple voiceURI shapes are recognized too', () => {
    // Pre-iOS-16 bundles used a hyphen rather than a dotted path.
    assert.equal(tts.voiceQuality(v('Samantha', 'com.apple.ttsbundle.Samantha-compact')), 'Compact');
    assert.equal(tts.voiceQuality(v('Samantha', 'com.apple.ttsbundle.Samantha-premium')), 'Premium');
    assert.equal(
        tts.voiceQuality(v('Siri', 'com.apple.ttsbundle.siri_female_en-US_compact')),
        'Compact',
    );
});

test('Edge online voices are labelled from the name', () => {
    assert.equal(
        tts.voiceQuality(v(
            'Microsoft Ava Online (Natural) - English (United States)',
            'Microsoft Ava Online (Natural) - English (United States)',
        )),
        'Natural',
    );
});

test('a voice with no tier gets no label', () => {
    // Windows/Chrome desktop voices carry no tier — their labels must come out
    // exactly as they did before this feature existed.
    assert.equal(tts.voiceQuality(v('Google US English', 'Google US English')), '');
    assert.equal(tts.voiceQuality(v('Microsoft David - English (United States)', 'urn:moz-tts:sapi:David')), '');
    // Eloquence voices name no quality either.
    assert.equal(tts.voiceQuality(v('Reed', 'com.apple.eloquence.en-US.Reed')), '');
});

test('tier words must stand alone — no substring mislabelling', () => {
    // "Naturalist"/"Compactor" contain a tier word but are not tiers. Guarding this
    // is the whole reason the match is word-boundaried rather than an includes().
    assert.equal(tts.voiceQuality(v('Naturalist', 'com.example.voice.Naturalist')), '');
    assert.equal(tts.voiceQuality(v('Compactor', 'com.example.voice.Compactor')), '');
});

test('bad input does not throw', () => {
    assert.equal(tts.voiceQuality(null), '');
    assert.equal(tts.voiceQuality(undefined), '');
    assert.equal(tts.voiceQuality({}), '');
});

test('a tier already spelled out in the name is not repeated', () => {
    // Edge would otherwise render "…(Natural) — Natural".
    const edge = 'Microsoft Ava Online (Natural) - English (United States)';
    assert.equal(tts.voiceLabel(v(edge, edge)), `${edge} (en-US)`);
});

test('voiceLabel puts the tier beside the name, and omits it when there is none', () => {
    assert.equal(
        tts.voiceLabel(v('Ava', 'com.apple.voice.enhanced.en-US.Ava')),
        'Ava — Enhanced (en-US)',
    );
    // Unchanged from the pre-feature label.
    assert.equal(
        tts.voiceLabel(v('Google US English', 'Google US English')),
        'Google US English (en-US)',
    );
});

test('novelty voices are matched by exact id, never by prefix', () => {
    // The whole roster measured on the iPad.
    for (const id of ['Albert', 'BadNews', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos',
        'Deranged', 'Fred', 'GoodNews', 'Hysterical', 'Junior', 'Kathy', 'Organ',
        'Princess', 'Ralph', 'Trinoids', 'Whisper', 'Zarvox']) {
        assert.ok(tts.isNoveltyVoice(v(id, `com.apple.speech.synthesis.voice.${id}`)),
            `${id} should be recognized as a novelty voice`);
    }
    // Alex lives under the SAME legacy prefix and is a genuinely good voice — a
    // prefix rule would hide it, which is why the match is by explicit id.
    assert.equal(tts.isNoveltyVoice(v('Alex', 'com.apple.speech.synthesis.voice.Alex')), false);
    // Eloquence voices are legitimate AAC voices and must never be caught.
    assert.equal(tts.isNoveltyVoice(v('Reed', 'com.apple.eloquence.en-US.Reed')), false);
    assert.equal(tts.isNoveltyVoice(v('Samantha', 'com.apple.voice.compact.en-US.Samantha')), false);
    assert.equal(tts.isNoveltyVoice(null), false);
});

test('usableVoices hides the joke voices, or shows them on request', () => {
    const list = [
        v('Samantha', 'com.apple.voice.compact.en-US.Samantha'),
        v('Zarvox', 'com.apple.speech.synthesis.voice.Zarvox'),
        v('Daniel', 'com.apple.voice.super-compact.en-GB.Daniel', 'en-GB'),
    ];
    globalThis.window.speechSynthesis.getVoices = () => list;
    assert.deepEqual(tts.usableVoices(false).map((x) => x.name), ['Samantha', 'Daniel']);
    assert.deepEqual(tts.usableVoices(true).map((x) => x.name), ['Samantha', 'Zarvox', 'Daniel']);
});

test('usableVoices never hides everything', () => {
    // A silly voice beats no voice at all — an empty picker would leave the user
    // unable to choose any voice.
    globalThis.window.speechSynthesis.getVoices = () => [
        v('Zarvox', 'com.apple.speech.synthesis.voice.Zarvox'),
    ];
    assert.equal(tts.usableVoices(false).length, 1);
    globalThis.window.speechSynthesis.getVoices = () => [];
});

test('the two same-named Apple voices produce distinguishable labels', () => {
    // The end-to-end property: whatever else changes, these two must not read alike.
    const compact = tts.voiceLabel(v('Ava', 'com.apple.voice.compact.en-US.Ava'));
    const enhanced = tts.voiceLabel(v('Ava', 'com.apple.voice.enhanced.en-US.Ava'));
    assert.notEqual(compact, enhanced);
});
