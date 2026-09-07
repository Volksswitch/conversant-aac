/* The Azure speaking backend (app/js/tts-azure.js), and the seam above it.
 *
 * TWO KINDS OF TEST HERE, and the second is the one that matters most.
 *
 * The pure helpers are checked because their failures are SILENT: a wrong escape
 * produces a request Azure refuses with a 400, which the user experiences as pressing
 * a button and nothing being said, on a sentence that looks completely normal.
 *
 * Then one test drives the REAL CHAIN — storage's chosen provider through tts.js's
 * routing, through the backend, to the request that would go on the wire. Per the
 * standing rule in CLAUDE.md, if every check fabricates the input to the layer under
 * test then the path was never tested; somewhere one check has to take the previous
 * layer's output as its input. The failure that rule exists for is exactly available
 * here: the voice id could be dropped between the setting and the request and every
 * piece would still pass on its own.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as azure from '../app/js/tts-azure.js';
import * as tts from '../app/js/tts.js';

/* --- escaping: the silent-failure surface --------------------------------- */

test('the five XML characters are escaped, and ampersand does not double-escape', () => {
    assert.equal(azure.escapeSsmlText('Jim & I'), 'Jim &amp; I');
    assert.equal(azure.escapeSsmlText('5 < 6 > 4'), '5 &lt; 6 &gt; 4');
    assert.equal(azure.escapeSsmlText(`it's "fine"`), 'it&apos;s &quot;fine&quot;');
    // If & were escaped after < , this would come out as &amp;lt; and be spoken aloud
    // as the literal text "&lt;" rather than as a less-than sign.
    assert.equal(azure.escapeSsmlText('<'), '&lt;');
    assert.equal(azure.escapeSsmlText('&amp;'), '&amp;amp;');
});

test('illegal control characters are REMOVED, not encoded', () => {
    // XML 1.0 has no escape that makes these legal, so encoding them would still
    // produce a document the service rejects. They arrive from pasted text and from
    // model output more often than one would expect.
    // Built from character codes rather than written literally: a control character
    // typed into a source file does not survive being copied around, and a test whose
    // input silently becomes ordinary text passes while checking nothing.
    const nul = String.fromCharCode(0);
    const bel = String.fromCharCode(7);
    const us = String.fromCharCode(31);
    const del = String.fromCharCode(127);
    assert.equal(azure.escapeSsmlText(`a${nul}b${bel}c${us}d${del}e`), 'abcde');
});

test('tab, newline and carriage return survive — they are legal and ordinary', () => {
    // A typed statement can contain a newline, and losing it would silently join two
    // sentences together.
    assert.equal(azure.escapeSsmlText('a\tb\nc\rd'), 'a\tb\nc\rd');
});

test('escaping never throws on a missing or non-string value', () => {
    assert.equal(azure.escapeSsmlText(null), '');
    assert.equal(azure.escapeSsmlText(undefined), '');
    assert.equal(azure.escapeSsmlText(42), '42');
});

/* --- the SSML document ---------------------------------------------------- */

test('the document language is taken from the voice, not hardcoded', () => {
    // xml:lang has to agree with the voice or the voice is refused, so hardcoding
    // en-US would break every non-American voice in the picker.
    assert.match(azure.ssmlFor('en-GB-SoniaNeural', 'hi'), /xml:lang="en-GB"/);
    assert.match(azure.ssmlFor('en-AU-NatashaNeural', 'hi'), /xml:lang="en-AU"/);
    assert.match(azure.ssmlFor('en-US-JennyNeural', 'hi'), /xml:lang="en-US"/);
});

test('an unrecognizable voice id still produces a valid document', () => {
    // Better a document in the wrong language than a malformed one: the first is
    // audible and fixable, the second is silence.
    assert.match(azure.ssmlFor('nonsense', 'hi'), /xml:lang="en-US"/);
});

test('the spoken text is escaped inside the document', () => {
    const ssml = azure.ssmlFor('en-US-JennyNeural', 'Jim & I said <this>');
    assert.match(ssml, /Jim &amp; I said &lt;this&gt;/);
    // The only angle brackets left must be the markup's own.
    assert.equal((ssml.match(/</g) || []).length, (ssml.match(/<\/?(speak|voice)/g) || []).length);
});

test('every voice in the picker yields a language the document can use', () => {
    // A voice added to the list with a malformed id would produce a document Azure
    // refuses, and it would only be discovered by someone choosing that voice.
    for (const v of azure.VOICES) {
        assert.match(azure.languageOf(v.id), /^[a-z]{2}-[A-Z]{2}$/, `${v.id} has no readable language`);
        assert.ok(v.name && v.detail, `${v.id} is missing its label`);
    }
    assert.ok(azure.VOICES.some((v) => v.id === azure.DEFAULT_VOICE), 'the default is in the list');
});

/* --- request shape and failures ------------------------------------------- */

test('the region builds the address, and is escaped into it', () => {
    assert.equal(azure.synthesisUrl('westeurope'),
        'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
    // An empty region must not produce "https://.tts..." — a request to a hostname
    // that cannot resolve, reported as a network failure rather than as a setting.
    assert.match(azure.synthesisUrl(''), /^https:\/\/eastus\./);
});

test('a refusal names the region, because that is the likely cause', () => {
    // The key is far more often right than the region: it is copied and pasted, while
    // the region is typed from memory. A message naming only the key sends the user to
    // check the thing that is probably fine.
    const msg = azure.describeFailure(401, 'westus2');
    assert.match(msg, /westus2/);
    assert.match(azure.describeFailure(400, 'eastus'), /voice/i);
    assert.match(azure.describeFailure(429, 'eastus'), /rate limit/i);
});

test('billing counts characters, and a non-string counts as none', () => {
    assert.equal(azure.billableCharacters('hello'), 5);
    assert.equal(azure.billableCharacters(null), 0);
});

/* --- the whole chain ------------------------------------------------------ */

// A minimal Web Audio stand-in. It has to be a real object graph rather than a stub
// that returns undefined, because the module both awaits decode and waits for the
// playback node's onended — a fake that never fires either would hang the test in a
// way that looks like a bug in the code under test.
function fakeAudio() {
    return {
        state: 'running',
        currentTime: 0,
        resume: async () => {},
        decodeAudioData: async () => ({ duration: 1 }),
        createBufferSource: () => ({
            buffer: null,
            connect() {},
            start() { setTimeout(() => this.onended && this.onended(), 0); },
            stop() {},
            onended: null,
        }),
        destination: {},
    };
}

test('END TO END: the chosen provider, key, region and voice all reach the request', async () => {
    const calls = [];
    const realFetch = globalThis.fetch;
    const realAudio = globalThis.window.AudioContext;
    globalThis.window.AudioContext = function () { return fakeAudio(); };
    globalThis.fetch = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(64) };
    };
    let billed = 0;
    try {
        // Wire the seam exactly as app.js does, then speak through the ordinary
        // public entry point. Nothing below is handed a fabricated request.
        tts.setProvider('azure', {
            model: 'en-GB-SoniaNeural',
            getKey: () => 'the-key',
            getRegion: () => 'uksouth',
            onBilled: (n) => { billed += n; },
        });
        tts.setPaidVoice('azure', 'en-GB-SoniaNeural');
        await tts.speak('Jim & I are fine');

        assert.equal(calls.length, 1, 'exactly one request went out');
        const { url, init } = calls[0];
        // The region reached the address...
        assert.match(url, /^https:\/\/uksouth\.tts\.speech\.microsoft\.com/);
        // ...the key reached the header...
        assert.equal(init.headers['Ocp-Apim-Subscription-Key'], 'the-key');
        assert.equal(init.headers['Content-Type'], 'application/ssml+xml');
        // ...and the voice AND the escaped words reached the body.
        assert.match(init.body, /name="en-GB-SoniaNeural"/);
        assert.match(init.body, /xml:lang="en-GB"/);
        assert.match(init.body, /Jim &amp; I are fine/);
        assert.equal(billed, 'Jim & I are fine'.length, 'billed the characters submitted');
        // The app records what actually spoke, which is what a saved turn stores.
        assert.deepEqual(tts.lastVoiceUsed(), { provider: 'azure', voice: 'en-GB-SoniaNeural' });
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        tts.setProvider('builtin');
    }
});

test('END TO END: a repeated phrase is not requested twice', async () => {
    // Most of what the app says repeats constantly — placeholders, control phrases,
    // Express buttons — so a cache miss on every one of them would be a per-utterance
    // round trip and a per-utterance bill for words already paid for.
    const calls = [];
    const realFetch = globalThis.fetch;
    const realAudio = globalThis.window.AudioContext;
    globalThis.window.AudioContext = function () { return fakeAudio(); };
    globalThis.fetch = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(64) };
    };
    let billed = 0;
    try {
        tts.setProvider('azure', {
            getKey: () => 'k', getRegion: () => 'eastus', onBilled: (n) => { billed += n; },
        });
        await tts.speak('Just a second.');
        await tts.speak('Just a second.');
        assert.equal(calls.length, 1, 'the second time is served from the cache');
        assert.equal(billed, 'Just a second.'.length, 'and bills nothing the second time');
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        tts.setProvider('builtin');
    }
});

test('END TO END: a refused request falls back to the browser voice and says so', async () => {
    // The one outcome that is never acceptable is the user pressing a button and
    // nothing being said. This is the path that guarantees it, and the fallback is
    // recorded per turn so a silent downgrade is still visible afterwards.
    const realFetch = globalThis.fetch;
    const realAudio = globalThis.window.AudioContext;
    globalThis.window.AudioContext = function () { return fakeAudio(); };
    globalThis.fetch = async () => ({ ok: false, status: 401 });
    let reported = null;
    try {
        tts.onFallbackToBrowser((msg) => { reported = msg; });
        tts.setProvider('azure', { getKey: () => 'bad', getRegion: () => 'eastus' });
        await tts.speak('hello');
        assert.ok(reported, 'the downgrade was reported');
        assert.match(reported, /eastus/, 'and the message names the region to check');
        const used = tts.lastVoiceUsed();
        assert.equal(used.provider, 'browser');
        assert.equal(used.fellBack, true, 'the turn records that it fell back');
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        tts.onFallbackToBrowser(null);
        tts.setProvider('builtin');
    }
});

test('the two paid voices keep separate settings', () => {
    // The id namespaces have nothing in common, so one cannot stand in for the other:
    // handing an Aura id to Azure is not a voice, it is a 400. Sharing one slot would
    // mean switching services discarded the choice made in each.
    tts.setPaidVoice('deepgram', 'aura-2-orion-en');
    tts.setPaidVoice('azure', 'en-US-GuyNeural');
    assert.equal(tts.getPaidVoice('deepgram'), 'aura-2-orion-en');
    assert.equal(tts.getPaidVoice('azure'), 'en-US-GuyNeural');
    assert.equal(tts.getAuraModel(), 'aura-2-orion-en', 'the Deepgram-shaped view still works');
});

/* --- the real catalog ----------------------------------------------------- */

// One entry in the shape Azure's voices/list actually returns.
const azVoice = (over = {}) => ({
    ShortName: 'en-US-AvaMultilingualNeural',
    DisplayName: 'Ava Multilingual',
    Gender: 'Female',
    Locale: 'en-US',
    LocaleName: 'English (United States)',
    VoiceType: 'Neural',
    Status: 'GA',
    ...over,
});

test('a catalog entry becomes a picker entry', () => {
    const v = azure.normalizeVoice(azVoice());
    assert.equal(v.id, 'en-US-AvaMultilingualNeural');
    assert.equal(v.name, 'Ava Multilingual');
    assert.equal(v.detail, 'Female · English (United States)');
    assert.equal(v.locale, 'en-US');
    assert.equal(v.preview, false);
});

test('retired non-neural voices are dropped', () => {
    // Offering one is offering something that may stop working, which the user
    // experiences as the app losing its voice rather than as a catalog change.
    assert.equal(azure.normalizeVoice(azVoice({ VoiceType: 'Standard' })), null);
    assert.equal(azure.normalizeVoice(azVoice({ ShortName: '' })), null);
    assert.equal(azure.normalizeVoice(null), null);
});

test('a preview voice is kept but marked', () => {
    // It can disappear between sessions, so the picker says so rather than letting a
    // voice vanish with no explanation.
    assert.equal(azure.normalizeVoice(azVoice({ Status: 'Preview' })).preview, true);
});

test('the hidden filter keeps English and drops everything else', () => {
    const list = [
        azVoice({ ShortName: 'en-GB-SoniaNeural', Locale: 'en-GB', DisplayName: 'Sonia' }),
        azVoice({ ShortName: 'fr-FR-DeniseNeural', Locale: 'fr-FR', DisplayName: 'Denise' }),
        azVoice({ ShortName: 'ja-JP-NanamiNeural', Locale: 'ja-JP', DisplayName: 'Nanami' }),
        azVoice(),
    ];
    const out = azure.filterVoices(list);
    assert.deepEqual(out.map((v) => v.locale), ['en-US', 'en-GB']);
});

test('American English sorts first, and the rest are kept rather than dropped', () => {
    // Ken asked for English, American if possible. Ordering rather than excluding is
    // what gets that without taking away the British, Australian, Canadian and Irish
    // voices that already shipped — removing a voice somebody is using would be worse
    // than a longer list.
    const list = [
        azVoice({ ShortName: 'en-AU-NatashaNeural', Locale: 'en-AU', DisplayName: 'Natasha' }),
        azVoice({ ShortName: 'en-GB-SoniaNeural', Locale: 'en-GB', DisplayName: 'Sonia' }),
        azVoice({ ShortName: 'en-US-GuyNeural', Locale: 'en-US', DisplayName: 'Guy' }),
        azVoice({ ShortName: 'en-US-AnaNeural', Locale: 'en-US', DisplayName: 'Ana' }),
    ];
    const out = azure.filterVoices(list);
    assert.deepEqual(out.map((v) => v.name), ['Ana', 'Guy', 'Natasha', 'Sonia']);
    assert.equal(out[0].locale, 'en-US', 'American first');
    assert.equal(out.length, 4, 'nothing English was dropped');
});

test('the catalog address is built from the region', () => {
    assert.equal(azure.catalogUrl('westus2'),
        'https://westus2.tts.speech.microsoft.com/cognitiveservices/voices/list');
});

test('fetching returns the filtered catalog and sends the key', async () => {
    const realFetch = globalThis.fetch;
    let seen = null;
    globalThis.fetch = async (url, init) => {
        seen = { url, init };
        return { ok: true, status: 200, json: async () => [
            azVoice(),
            azVoice({ ShortName: 'de-DE-KatjaNeural', Locale: 'de-DE', DisplayName: 'Katja' }),
        ] };
    };
    try {
        const voices = await azure.fetchVoices('the-key', 'uksouth');
        assert.match(seen.url, /^https:\/\/uksouth\./);
        assert.equal(seen.init.headers['Ocp-Apim-Subscription-Key'], 'the-key');
        assert.deepEqual(voices.map((v) => v.id), ['en-US-AvaMultilingualNeural']);
    } finally {
        globalThis.fetch = realFetch;
    }
});

test('fetching THROWS rather than quietly returning the shipped handful', async () => {
    // The caller has to be able to tell "this is the real catalog" from "this is the
    // few we ship with" — in a picker those look identical and mean very different
    // things when a voice the user expected is not in the list.
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 401 });
    try {
        await assert.rejects(() => azure.fetchVoices('bad', 'eastus'), /refused the key/);
    } finally {
        globalThis.fetch = realFetch;
    }
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => [] });
    try {
        await assert.rejects(() => azure.fetchVoices('k', 'eastus'), /no English voices/);
    } finally {
        globalThis.fetch = realFetch;
    }
});

test('fetching with no key fails before any request is made', async () => {
    const realFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => { called = true; return { ok: true, json: async () => [] }; };
    try {
        await assert.rejects(() => azure.fetchVoices('', 'eastus'), /No Azure Speech key/);
        assert.equal(called, false, 'no pointless request went out');
    } finally {
        globalThis.fetch = realFetch;
    }
});
