/* Tier 2 - keeping the fixed phrases ready in the paid voice (app/js/phrase-audio.js).
 *
 * Driven end to end through the real voice path: tts.js wired to the OpenAI voice the
 * way app.js wires it, a stand-in network and audio, and a stand-in store in place of
 * the browser database. What is asserted is what reached the network and the store.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tts from '../app/js/tts.js';
import * as phraseAudio from '../app/js/phrase-audio.js';

test('the phrases worth keeping: holding phrases first, no names, no duplicates', () => {
    const out = phraseAudio.wantedPhrases({
        placeholderPhrases: ["I'm thinking.", 'Working that out.'],
        controlPhrases: ['Hi {name}, got a minute?', 'Bye!', "I'm thinking."],
        expressItems: [
            { type: 'phrase', text: 'Yes' },
            { type: 'phrase', text: 'Siobhan', speak: 'Shiv-awn' },
            { type: 'partner', text: 'Mom' },
            { type: 'phrase', text: '   ' },
        ],
    });
    assert.deepEqual(out, ["I'm thinking.", 'Working that out.', 'Bye!', 'Yes', 'Shiv-awn']);
});

function fakeAudio() {
    return {
        state: 'running', currentTime: 0, resume: async () => {},
        decodeAudioData: async (b) => ({ duration: 1, bytes: b.byteLength }),
        createBufferSource: () => ({
            buffer: null, connect() {}, stop() {}, onended: null,
            start() { setTimeout(() => this.onended && this.onended(), 0); },
        }),
        destination: {},
    };
}

function fakeStore() {
    const m = new Map();
    return {
        m,
        get: async (k) => m.get(k) || null,
        put: async (k, b) => { m.set(k, b); },
        keys: async () => [...m.keys()],
        remove: async (k) => { m.delete(k); },
    };
}

test('fetched once, kept, ready from storage next time; a new voice fetches fresh and clears the old', async () => {
    const realFetch = globalThis.fetch;
    const realAudio = globalThis.window.AudioContext;
    globalThis.window.AudioContext = function () { return fakeAudio(); };
    const asked = [];
    globalThis.fetch = async (url, init) => {
        asked.push(JSON.parse(init.body).input);
        return new Response(new Uint8Array([1, 2, 3, 4]));
    };
    const store = fakeStore();
    phraseAudio.setStoreForTest(store);
    try {
        tts.setProviderCredentials('openai', { getKey: () => 'a-key', getModel: () => 'gpt-4o-mini-tts' });
        tts.setProvider('openai', { getKey: () => 'a-key' });
        tts.setPaidVoice('openai', 'alloy');
        const phrases = ["I'm thinking.", 'Bye!'];

        // First Start: both fetched and kept.
        await phraseAudio.refresh(phrases);
        assert.deepEqual(asked.sort(), ['Bye!', "I'm thinking."]);
        assert.equal(store.m.size, 2);

        // Next Start, as a new session: the voice's memory is empty, so the phrases
        // must come from storage, and nothing is asked of the network.
        tts.paidVoiceInfo().backend.reset();
        asked.length = 0;
        await phraseAudio.refresh(phrases);
        assert.deepEqual(asked, []);

        // Saying a kept phrase now needs no network either: it was loaded from storage.
        await tts.speak('Bye!');
        assert.deepEqual(asked, [], 'played from the kept recording');

        // A different voice: fetched fresh, and the old voice's recordings are gone.
        tts.setPaidVoice('openai', 'nova');
        await phraseAudio.refresh(phrases);
        assert.equal(asked.length, 2);
        assert.equal(store.m.size, 2);
        for (const k of store.m.keys()) assert.ok(k.includes('nova'), k);
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        phraseAudio.setStoreForTest(null);
        tts.setProvider('builtin');
    }
});

test('a wanted phrase said before the background run reaches it is kept; other speech is not', async () => {
    const realFetch = globalThis.fetch;
    const realAudio = globalThis.window.AudioContext;
    globalThis.window.AudioContext = function () { return fakeAudio(); };
    globalThis.fetch = async () => new Response(new Uint8Array([9, 9]));
    const store = fakeStore();
    phraseAudio.setStoreForTest(store);
    try {
        tts.setProviderCredentials('openai', { getKey: () => 'a-key', getModel: () => 'gpt-4o-mini-tts' });
        tts.setProvider('openai', { getKey: () => 'a-key' });
        tts.setPaidVoice('openai', 'echo');
        // A run that is stopped at once, so only the wanted list is set.
        const run = phraseAudio.refresh(['See you later!']);
        phraseAudio.pause();
        await run;
        store.m.clear();
        await tts.speak('See you later!');
        await tts.speak('I had a great weekend at the lake.');
        await new Promise((r) => setTimeout(r, 10));
        assert.equal(store.m.size, 1, 'only the fixed phrase was kept');
        assert.ok([...store.m.keys()][0].endsWith('See you later!'));
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        phraseAudio.setStoreForTest(null);
        tts.setProvider('builtin');
    }
});

test('the device voice keeps nothing', async () => {
    tts.setProvider('builtin');
    const store = fakeStore();
    phraseAudio.setStoreForTest(store);
    try {
        await phraseAudio.refresh(['Bye!']);
        assert.equal(store.m.size, 0);
    } finally { phraseAudio.setStoreForTest(null); }
});

test('Azure: a phrase fetched for keeping plays from memory, and a stored one after a new session', async () => {
    const realFetch = globalThis.fetch;
    const realAudio = globalThis.window.AudioContext;
    globalThis.window.AudioContext = function () { return fakeAudio(); };
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(new Uint8Array([5, 6, 7])); };
    try {
        tts.setProvider('azure', { getKey: () => 'k', getRegion: () => 'eastus' });
        const { backend, voice } = tts.paidVoiceInfo();
        const bytes = await backend.fetchForStore('Bye!', voice);
        assert.equal(bytes.byteLength, 3);
        await tts.speak('Bye!');
        assert.equal(calls, 1, 'no second request');
        backend.reset();
        await backend.preload('Bye!', voice, bytes);
        await tts.speak('Bye!');
        assert.equal(calls, 1, 'played from the stored recording');
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        tts.setProvider('builtin');
    }
});

test('Deepgram: the joined audio is the chunks end to end', async () => {
    const { joinChunks, pcm16ToFloat32 } = await import('../app/js/tts-deepgram.js');
    const a = new Uint8Array([0, 0, 255, 127]).buffer;
    const b = new Uint8Array([0, 128]).buffer;
    const joined = joinChunks([a, b]);
    assert.equal(joined.byteLength, 6);
    assert.deepEqual([...pcm16ToFloat32([joined])], [...pcm16ToFloat32([a, b])]);
});
