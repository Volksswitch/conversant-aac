/* Tier 1 — the pure parts of the Deepgram Aura voice backend.
 *
 * The socket and the audio device cannot be exercised here, but the PCM decode can,
 * and it is the part where a mistake is least visible: a wrong sign, scale or byte
 * order does not throw, it just produces sound that is distorted, inverted or
 * silent. The rest of the module fails loudly by comparison.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as aura from '../app/js/tts-deepgram.js';

// Build an ArrayBuffer of signed 16-bit little-endian samples, as Deepgram sends.
function pcm(...samples) {
    const buf = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buf);
    samples.forEach((s, i) => view.setInt16(i * 2, s, true));
    return buf;
}

test('pcm16 decodes to float samples in [-1, 1]', () => {
    const out = aura.pcm16ToFloat32([pcm(0, 32767, -32768, 16384)]);
    assert.equal(out.length, 4);
    assert.equal(out[0], 0);
    assert.ok(Math.abs(out[1] - 1) < 0.0001, 'full positive scale reaches ~+1');
    assert.equal(out[2], -1, 'full negative scale is exactly -1, not past it');
    assert.equal(out[3], 0.5);
});

test('pcm16 is little-endian', () => {
    // 0x0100 little-endian is 1; read big-endian it would be 256.
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint8(0, 0x01);
    new DataView(buf).setUint8(1, 0x00);
    const out = aura.pcm16ToFloat32([buf]);
    assert.equal(out[0], 1 / 32768);
});

test('pcm16 joins chunks in order', () => {
    const out = aura.pcm16ToFloat32([pcm(1000, 2000), pcm(3000)]);
    assert.deepEqual([...out], [1000 / 32768, 2000 / 32768, 3000 / 32768]);
});

test('pcm16 ignores a trailing odd byte rather than shifting the rest', () => {
    // A chunk boundary can land mid-sample. Consuming the stray byte as half a
    // sample would shift every following sample by one byte and turn the audio into
    // noise, so the decoder must drop it.
    const good = pcm(1000, 2000);
    const odd = new Uint8Array(3);
    odd.set(new Uint8Array(pcm(3000)), 0);
    const out = aura.pcm16ToFloat32([good, odd.buffer]);
    assert.deepEqual([...out], [1000 / 32768, 2000 / 32768, 3000 / 32768]);
});

test('pcm16 handles empty input', () => {
    assert.equal(aura.pcm16ToFloat32([]).length, 0);
    assert.equal(aura.pcm16ToFloat32([new ArrayBuffer(0)]).length, 0);
});

test('the cache key separates voice from text', () => {
    assert.notEqual(
        aura.cacheKey('aura-2-thalia-en', 'Hello'),
        aura.cacheKey('aura-2-apollo-en', 'Hello'),
        'the same words in a different voice are different audio',
    );
    assert.equal(aura.cacheKey('m', 'Hello'), aura.cacheKey('m', 'Hello'));
});

test('billing counts characters of the text actually sent', () => {
    assert.equal(aura.billableCharacters('Bye!'), 4);
    assert.equal(aura.billableCharacters(''), 0);
    assert.equal(aura.billableCharacters(null), 0);
});

test('every offered voice has a well-formed model id and a label', () => {
    assert.ok(aura.VOICES.length > 0);
    for (const v of aura.VOICES) {
        // Deepgram documents the id format as [model]-[voice]-[language].
        assert.match(v.id, /^aura-2-[a-z]+-en$/, `${v.id} does not match the documented id format`);
        assert.ok(v.name && v.detail, `${v.id} is missing its display text`);
    }
    const ids = aura.VOICES.map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length, 'voice ids must be unique');
    assert.ok(ids.includes(aura.DEFAULT_VOICE), 'the default must be one of the offered voices');
});

test('voiceLabel falls back to the raw id for an unknown voice', () => {
    assert.equal(aura.voiceLabel('aura-2-thalia-en'), 'Thalia — Female · American');
    assert.equal(aura.voiceLabel('something-else'), 'something-else');
});
