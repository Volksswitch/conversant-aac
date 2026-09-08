/* Tier 1 — the REST speech provider catalog and the transcription request builder.
 *
 * WHAT THESE CAN AND CANNOT PROVE, stated up front because it is the whole point.
 * They check the SHAPE of every request the app will make — the address, the headers,
 * the body, and how a reply is read — against a fake fetch. They cannot check that a
 * real service accepts it; there is no OpenAI, Google or ElevenLabs key on this machine
 * and no test can conjure one.
 *
 * What HAS been measured, from inside the running app on September 8 2026 with a
 * deliberately bogus key: all six paths (three voices, three transcriptions) reach their
 * service and come back with an authentication refusal rather than a CORS failure or a
 * 404 — so each request was well-formed enough to be judged. The remaining unknown is
 * what a real key returns, which each service's Test button settles.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TTS_PROVIDERS, STT_PROVIDERS, languageOfGoogleVoice, describeFailure }
    from '../app/js/speech-catalog.js';
import { transcribeClip } from '../app/js/stt-rest.js';

const KEY = 'test-key';

test('every voice provider builds a complete request', () => {
    for (const [id, p] of Object.entries(TTS_PROVIDERS)) {
        const url = p.url({ key: KEY, voice: p.defaultVoice });
        assert.match(url, /^https:\/\//, `${id}: must be https`);
        // ⚠ A CREDENTIAL MUST NEVER TRAVEL IN THE ADDRESS. The provider bench passes the
        // Google key as ?key=, and the app deliberately does not: a key in a URL reaches
        // proxy logs, browser history and any error text quoted into a bug report.
        assert.ok(!url.includes(KEY), `${id}: the key must not be in the URL`);

        const headers = p.headers({ key: KEY });
        assert.ok(Object.values(headers).some((v) => String(v).includes(KEY)),
            `${id}: the key must be sent in a header`);

        const body = p.body({ voice: p.defaultVoice, text: 'Hello.', model: p.defaultModel });
        assert.equal(typeof body, 'string', `${id}: body is already serialized`);
        assert.ok(body.includes('Hello.'), `${id}: the text must reach the body`);
    }
});

test('the voice id reaches the request, wherever that provider puts it', () => {
    // ElevenLabs addresses a voice in the URL; the others name it in the body. Getting
    // this wrong would silently speak in the default voice whatever the user picked.
    const el = TTS_PROVIDERS.elevenlabs;
    assert.match(el.url({ key: KEY, voice: 'VOICE-ID' }), /VOICE-ID/);

    const oa = TTS_PROVIDERS.openai;
    assert.match(oa.body({ voice: 'sage', text: 'x', model: 'm' }), /"voice":"sage"/);

    const go = TTS_PROVIDERS.google;
    assert.match(go.body({ voice: 'en-GB-Neural2-A', text: 'x' }), /"name":"en-GB-Neural2-A"/);
});

test('Google language code is derived from the voice, never assumed', () => {
    // ⚠ Google refuses a voice whose languageCode disagrees with its name, so a fixed
    // "en-US" would make every non-American voice unusable while looking like a bad key.
    assert.equal(languageOfGoogleVoice('en-GB-Neural2-A'), 'en-GB');
    assert.equal(languageOfGoogleVoice('de-DE-Neural2-B'), 'de-DE');
    assert.equal(languageOfGoogleVoice('nonsense'), 'en-US', 'falls back rather than throwing');
    assert.match(TTS_PROVIDERS.google.body({ voice: 'de-DE-Neural2-B', text: 'x' }),
        /"languageCode":"de-DE"/);
});

test('every voice list uses the shape the Settings picker reads', () => {
    // The picker renders `${name} — ${detail}`. A {id,label} entry renders as
    // "undefined — undefined", which is exactly how this was found in the browser: the
    // list had the right LENGTH and every row was blank.
    for (const [id, p] of Object.entries(TTS_PROVIDERS)) {
        assert.ok(p.voices.length, `${id}: needs a starter list`);
        for (const v of p.voices) {
            assert.ok(v.id, `${id}: a voice needs an id`);
            assert.equal(typeof v.name, 'string', `${id}: a voice needs a name`);
            assert.equal(typeof v.detail, 'string', `${id}: a voice needs a detail`);
        }
        assert.ok(p.voices.some((v) => v.id === p.defaultVoice),
            `${id}: the default voice must be in the starter list`);
    }
});

test('a fetched catalog is mapped into that same shape', () => {
    const go = TTS_PROVIDERS.google.catalog.read({
        voices: [{ name: 'en-US-Neural2-F', ssmlGender: 'FEMALE', languageCodes: ['en-US'] }],
    });
    assert.deepEqual(go, [{ id: 'en-US-Neural2-F', name: 'en-US-Neural2-F', detail: 'female, en-US' }]);

    const el = TTS_PROVIDERS.elevenlabs.catalog.read({
        voices: [{ voice_id: 'abc', name: 'Rachel', labels: { accent: 'american' } }],
    });
    assert.deepEqual(el, [{ id: 'abc', name: 'Rachel', detail: 'american' }]);

    // OpenAI publishes no list, and says so by having no catalog rather than by
    // returning an empty one — so a caller can tell "nothing to fetch" from "fetch
    // found nothing" and keep showing the built-in roster.
    assert.equal(TTS_PROVIDERS.openai.catalog, null);
});

test('transcription builds the right body for each service, and reads the reply', async () => {
    const wav = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
    const seen = {};
    const fakeFetch = (url, opts) => {
        seen.url = url;
        seen.headers = opts.headers;
        seen.body = opts.body;
        return Promise.resolve({
            ok: true,
            json: async () => ({ text: 'hello there',
                                 results: [{ alternatives: [{ transcript: 'hello there' }] }] }),
        });
    };

    for (const [id, p] of Object.entries(STT_PROVIDERS)) {
        const text = await transcribeClip(p, KEY, wav, { fetchImpl: fakeFetch });
        assert.equal(text, 'hello there', `${id}: the transcript is read back`);
        assert.ok(!String(seen.url).includes(KEY), `${id}: the key must not be in the URL`);
        assert.ok(Object.values(seen.headers).some((v) => String(v).includes(KEY)),
            `${id}: the key must be sent in a header`);
        // Multipart for the file services, JSON for the ones taking audio inline.
        if (p.form) {
            assert.ok(seen.body instanceof FormData, `${id}: sends a multipart body`);
            // ⚠ NO Content-Type: the browser must set it so the multipart boundary is
            // included. Setting it by hand omits the boundary and the request is refused.
            assert.ok(!Object.keys(seen.headers).some((h) => /content-type/i.test(h)),
                `${id}: must not set Content-Type on a FormData body`);
        } else {
            assert.equal(typeof seen.body, 'string', `${id}: sends a JSON body`);
        }
    }
});

test('Google is asked for punctuation, which it does not add by default', () => {
    // Without this the transcript is one unbroken run of words while every other service
    // returns sentences — which reads as Google being worse and is really us asking it
    // for something different. Found in the provider bench.
    const body = STT_PROVIDERS.google.body('BASE64', { model: 'latest_long', sampleRate: 16000 });
    assert.match(body, /"enableAutomaticPunctuation":true/);
    assert.match(body, /"sampleRateHertz":16000/);
});

test('a failure explains itself, and 400 is not read as our bug', () => {
    assert.match(describeFailure(401, 'OpenAI'), /did not accept the key/);
    // ⚠ GOOGLE REPORTS A BAD KEY AS 400, measured both in the bench and from inside the
    // app. Reading it as "malformed request" sends somebody hunting a bug in the app
    // when the answer is almost always the key.
    assert.match(describeFailure(400, 'Google Cloud'), /key is wrong/);
    assert.match(describeFailure(429, 'ElevenLabs'), /rate limiting|out of credit/);
    assert.match(describeFailure(503, 'OpenAI'), /at their end/);
});
