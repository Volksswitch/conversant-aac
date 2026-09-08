/*
 * speech-catalog.js — one declarative description of every REST speech provider.
 *
 * WHY A TABLE AND NOT A MODULE EACH (Ken, September 8 2026, asking for OpenAI, Google
 * Cloud and ElevenLabs). Deepgram and Azure each got their own file, which was right
 * when there were two and one of them speaks a WebSocket protocol. Three more would
 * have made five files that differ only in a URL, a header name and where the audio
 * sits in the reply — and Ken expects more still. So the REST providers are DATA here,
 * and `tts-rest.js` and `stt-rest.js` are the one implementation that reads it.
 *
 * ⚠ EVERY REQUEST SHAPE BELOW IS COPIED FROM `prototypes/speech-providers.html`, WHICH
 * KEN HAS RUN WITH REAL KEYS. That matters more than it sounds: this project has
 * measured its own hit rate on provider facts taken from documentation at about half
 * (the July 2026 iPad probe overturned four of eight), and the Azure adapter says in as
 * many words that it is built on "the request shape already measured working from a
 * real browser with a real key in the provider bench". These are the same endpoints,
 * headers and body shapes as that bench.
 *
 * ⚠ BUT NOTHING HERE HAS BEEN RUN FROM INSIDE THE APP, and no test can prove it: there
 * is no OpenAI, Google or ElevenLabs key on this machine. Each provider's Test button
 * in Settings is the confirmation, exactly as the Deepgram Aura path was settled by its
 * Test button speaking on the iPad (July 31 2026) rather than by any amount of reading.
 * Until a Test says otherwise, treat every entry below as plausible and unproven.
 *
 * ⚠ ONE DELIBERATE DEVIATION FROM THE BENCH, and it is the first thing to check if
 * Google fails: the bench passes the Google key as `?key=` in the URL and this sends it
 * as an `X-Goog-Api-Key` header instead. Both are documented by Google. The header is
 * used because a key in a URL ends up in more places than a key in a header — proxy
 * logs, browser history, an error message quoted into a bug report — and this project's
 * standing rule is that credentials do not travel in query strings. If Google's Test
 * fails where the bench succeeds, this line is the difference.
 */

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

/*
 * Each entry says how to turn text into audio bytes:
 *
 *   id          the name used in Settings and storage
 *   label       what a person sees
 *   needsRegion whether the credential is a key plus a region (Azure only, today)
 *   url({key, region, voice})            where to POST
 *   headers({key})                       what to send with it
 *   body({voice, text, model})           the request body, already serialized
 *   audioFrom(response)                  → a Blob of playable audio
 *   voices                               a starter list, replaced by the catalog fetch
 *   catalog({key})                       how to fetch the real voice list, or null
 *   defaultVoice / defaultModel
 *   mimeType                             what the reply contains, for the Blob
 */

const json = (o) => JSON.stringify(o);

export const TTS_PROVIDERS = {
    openai: {
        id: 'openai',
        label: 'OpenAI',
        defaultVoice: 'alloy',
        defaultModel: 'gpt-4o-mini-tts',
        mimeType: 'audio/mpeg',
        url: () => 'https://api.openai.com/v1/audio/speech',
        headers: ({ key }) => ({
            Authorization: 'Bearer ' + key,
            'Content-Type': 'application/json',
        }),
        body: ({ voice, text, model }) => json({ model, voice, input: text }),
        // The key Test. Same host and the same Authorization header as the speech call,
        // so it exercises the credential the app actually presents - it just asks for a
        // list instead of audio, which costs nothing and says nothing aloud.
        verify: {
            url: () => 'https://api.openai.com/v1/models',
            headers: ({ key }) => ({ Authorization: 'Bearer ' + key }),
        },
        // A fixed roster: OpenAI publishes no voice-list endpoint, so there is nothing
        // to fetch and the list below IS the list.
        catalog: null,
        voices: [
            { id: 'alloy', name: 'Alloy', detail: 'neutral' },
            { id: 'ash', name: 'Ash', detail: 'warm' },
            { id: 'ballad', name: 'Ballad', detail: 'expressive' },
            { id: 'coral', name: 'Coral', detail: 'bright' },
            { id: 'echo', name: 'Echo', detail: 'even' },
            { id: 'fable', name: 'Fable', detail: 'storytelling' },
            { id: 'nova', name: 'Nova', detail: 'light' },
            { id: 'onyx', name: 'Onyx', detail: 'deep' },
            { id: 'sage', name: 'Sage', detail: 'calm' },
            { id: 'shimmer', name: 'Shimmer', detail: 'soft' },
            { id: 'verse', name: 'Verse', detail: 'varied' },
        ],
    },

    google: {
        id: 'google',
        label: 'Google Cloud',
        defaultVoice: 'en-US-Neural2-F',
        defaultModel: '',
        mimeType: 'audio/mpeg',
        url: () => 'https://texttospeech.googleapis.com/v1/text:synthesize',
        headers: ({ key }) => ({
            'X-Goog-Api-Key': key,          // see the deviation note at the top
            'Content-Type': 'application/json',
        }),
        // ⚠ languageCode must agree with the voice name or Google refuses the pair, so
        // it is DERIVED from the voice rather than fixed: "en-GB-Neural2-A" needs
        // "en-GB", and hardcoding en-US would make every non-American voice unusable.
        body: ({ voice, text }) => json({
            input: { text },
            voice: { languageCode: languageOfGoogleVoice(voice), name: voice },
            audioConfig: { audioEncoding: 'MP3' },
        }),
        // Google returns base64 inside JSON rather than raw bytes.
        audioFrom: async (response, mimeType) => {
            const j = await response.json();
            if (!j.audioContent) throw new Error('no audio came back');
            return base64ToBlob(j.audioContent, mimeType);
        },
        // Same host and header as the synthesis call above; a listing rather than audio.
        verify: {
            url: () => 'https://texttospeech.googleapis.com/v1/voices',
            headers: ({ key }) => ({ 'X-Goog-Api-Key': key }),
        },
        catalog: {
            url: () => 'https://texttospeech.googleapis.com/v1/voices',
            headers: ({ key }) => ({ 'X-Goog-Api-Key': key }),
            // ⚠ { id, name, detail } — the shape the Settings picker already reads.
            // Anything else renders as "undefined — undefined", which is how this was
            // found: the list was the right LENGTH and every entry was blank.
            read: (j) => (j.voices || []).map((v) => ({
                id: v.name,
                name: v.name,
                detail: [String(v.ssmlGender || '').toLowerCase(),
                         (v.languageCodes || [])[0] || ''].filter(Boolean).join(', '),
            })),
        },
        voices: [
            { id: 'en-US-Neural2-F', name: 'Neural2-F', detail: 'female, en-US' },
            { id: 'en-US-Neural2-D', name: 'Neural2-D', detail: 'male, en-US' },
        ],
    },

    elevenlabs: {
        id: 'elevenlabs',
        label: 'ElevenLabs',
        defaultVoice: '21m00Tcm4TlvDq8ikWAM',
        defaultModel: 'eleven_multilingual_v2',
        mimeType: 'audio/mpeg',
        // The voice id is part of the address here rather than the body.
        url: ({ voice }) => 'https://api.elevenlabs.io/v1/text-to-speech/'
            + encodeURIComponent(voice),
        headers: ({ key }) => ({ 'xi-api-key': key, 'Content-Type': 'application/json' }),
        body: ({ text, model }) => json({ text, model_id: model }),
        // Same host and header as the speech call; a listing rather than audio.
        verify: {
            url: () => 'https://api.elevenlabs.io/v1/voices',
            headers: ({ key }) => ({ 'xi-api-key': key }),
        },
        catalog: {
            url: () => 'https://api.elevenlabs.io/v1/voices',
            headers: ({ key }) => ({ 'xi-api-key': key }),
            read: (j) => (j.voices || []).map((v) => ({
                id: v.voice_id,
                name: v.name,
                detail: [(v.labels && v.labels.accent) || '',
                         (v.labels && v.labels.description) || ''].filter(Boolean).join(', '),
            })),
        },
        voices: [
            { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', detail: 'a library voice' },
        ],
    },
};

// ---------------------------------------------------------------------------
// Hearing
// ---------------------------------------------------------------------------

/*
 * A phrase at a time, never streaming — the same shape stt-azure.js uses and for the
 * same reason: none of these publishes a streaming interface a browser can authenticate
 * against with the user's own key. Each entry turns one WAV clip into text.
 *
 *   form(wavBlob, {model})   → a FormData body, for the multipart services
 *   body(base64, {model})    → a JSON body, for the ones that take audio inline
 *   read(json)               → the transcript
 */
export const STT_PROVIDERS = {
    openai: {
        id: 'openai',
        label: 'OpenAI',
        defaultModel: 'gpt-4o-transcribe',
        url: () => 'https://api.openai.com/v1/audio/transcriptions',
        headers: ({ key }) => ({ Authorization: 'Bearer ' + key }),
        // ⚠ NO Content-Type HERE ON PURPOSE. The browser sets it for a FormData body
        // and includes the multipart boundary; setting it by hand omits the boundary
        // and the request is rejected as malformed.
        form: (wav, { model }) => {
            const fd = new FormData();
            fd.append('file', wav, 'clip.wav');
            fd.append('model', model);
            return fd;
        },
        read: (j) => j.text || '',
    },

    google: {
        id: 'google',
        label: 'Google Cloud',
        defaultModel: 'latest_long',
        url: () => 'https://speech.googleapis.com/v1/speech:recognize',
        headers: ({ key }) => ({
            'X-Goog-Api-Key': key,
            'Content-Type': 'application/json',
        }),
        // ⚠ GOOGLE PUNCTUATES ONLY WHEN ASKED. The default is off, so without
        // enableAutomaticPunctuation the transcript is one unbroken run of words while
        // every other service returns sentences — which reads as Google being worse and
        // is really us asking it for something different. It also capitalizes after a
        // full stop. (The bench found this; it is not a guess.)
        body: (base64, { model, sampleRate }) => json({
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: sampleRate,
                languageCode: 'en-US',
                model,
                enableAutomaticPunctuation: true,
            },
            audio: { content: base64 },
        }),
        read: (j) => (j.results || [])
            .map((r) => (r.alternatives && r.alternatives[0] && r.alternatives[0].transcript) || '')
            .join(' ')
            .trim(),
    },

    elevenlabs: {
        id: 'elevenlabs',
        label: 'ElevenLabs',
        defaultModel: 'scribe_v1',
        url: () => 'https://api.elevenlabs.io/v1/speech-to-text',
        headers: ({ key }) => ({ 'xi-api-key': key }),
        form: (wav, { model }) => {
            const fd = new FormData();
            fd.append('file', wav, 'clip.wav');
            fd.append('model_id', model);
            return fd;
        },
        read: (j) => j.text || '',
        // ⚠ THE ONE ENTRY NOT TAKEN FROM THE BENCH — every other shape here was copied
        // from a page Ken has run with a real key, and ElevenLabs transcription is not
        // on that page. It was written from documentation, which this project measures
        // at about a 50% error rate, so it was flagged as the likeliest of the six to
        // be wrong.
        //
        // MEASURED SINCE, from inside the app on September 8 2026: with a deliberately
        // bogus key it returns 401 rather than a CORS failure or a 404. That proves the
        // endpoint exists, is reachable browser-direct, and understood the request well
        // enough to judge the credential — which is most of what could have been wrong.
        // What it does NOT prove is that a real key returns a transcript in the shape
        // `read` expects. That still needs one run with a real key.
        unverified: true,
    },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "en-GB-Neural2-A" → "en-GB". Falls back to en-US for an unrecognizable name. */
export function languageOfGoogleVoice(voice) {
    const m = /^([a-z]{2,3}-[A-Z]{2})/.exec(String(voice || ''));
    return m ? m[1] : 'en-US';
}

/** Base64 → Blob, without going through a data: URL (which caps at a few megabytes). */
export function base64ToBlob(b64, mimeType) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
}

/*
 * Blob → base64 (no data: prefix), for the services that take audio inline.
 *
 * ⚠ USES arrayBuffer() RATHER THAN FileReader, and not only because FileReader is the
 * older API: FileReader does not exist outside a browser, so a request builder written
 * on it cannot be unit-tested at all. That is how this was found — the transcription
 * test could reach every other provider and died on Google's inline-audio body.
 *
 * Converted in chunks because String.fromCharCode applied to a whole clip at once
 * overflows the call stack; a few seconds of 16 kHz mono is around 100 KB, which is
 * already far past the limit on some engines.
 */
export async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    // btoa is present in browsers and in Node 16+.
    return btoa(binary);
}

/** Every REST provider id, for the Settings tab and the storage accessors. */
export const TTS_IDS = Object.keys(TTS_PROVIDERS);
export const STT_IDS = Object.keys(STT_PROVIDERS);

/**
 * A readable reason for a failed call.
 *
 * Kept here rather than in each provider because the status codes mean the same thing
 * everywhere, and because a message a user might read should not vary by vendor.
 */
export function describeFailure(status, label) {
    if (status === 401 || status === 403) {
        return `${label} did not accept the key. Check it was copied in full.`;
    }
    // ⚠ GOOGLE REPORTS A BAD KEY AS 400, NOT 401 — measured, both in the provider bench
    // (recorded in CLAUDE.md's reachability table) and again from inside the app on
    // September 8 2026. Reading 400 as "malformed request" would send somebody looking
    // for a bug in the app when the real answer is almost always the key, so the message
    // names the likely cause first and the other possibility second.
    if (status === 400) {
        return `${label} rejected the request. Usually that means the key is wrong `
             + 'or the account does not have this service switched on.';
    }
    if (status === 404) {
        return `${label} did not recognize that request. The voice may no longer exist.`;
    }
    if (status === 429) {
        return `${label} is rate limiting, or the account is out of credit.`;
    }
    if (status >= 500) return `${label} had a problem at their end. Try again shortly.`;
    return `${label} refused the request (error ${status}).`;
}
