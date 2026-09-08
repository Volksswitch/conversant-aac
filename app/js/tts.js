import * as aura from './tts-deepgram.js';
import * as azure from './tts-azure.js';
import * as rest from './tts-rest.js';
import { TTS_PROVIDERS } from './speech-catalog.js';

const synth = window.speechSynthesis;
let selectedVoiceURI = null;

// --- Voice provider (Ken, July 31 2026; Azure added September 6 2026) ---
//
// Three backends behind ONE seam, on the same reasoning as stt.js: the browser's own
// speechSynthesis (free, works everywhere, the default), and two paid services on the
// user's own key — Deepgram Aura and Azure Speech — for platforms whose built-in
// voices are unusable. Measured on iPadOS: the only ordinary en-US voice on offer is
// Samantha, and everything else is a novelty voice or a one-per-language
// minimum-quality voice, with no upgrade reachable from a web app at any price.
//
// EVERYTHING THAT MATTERS STAYS IN THIS FILE, not in the backend: the speaking-state
// broadcast that the STT echo filter depends on, the token that stops a superseded
// utterance reporting a spurious end, and the fallback to the browser's own voice. A
// backend only produces sound.
//
// ⚠ THE TWO PAID BACKENDS EXPOSE AN IDENTICAL SHAPE — { speak, cancel, isSpeaking,
// unlock, test, reset } — so everything below treats them interchangeably and none of
// the routing has to know which is which. Adding a fourth means adding a factory to
// the table and nothing else. Where they genuinely differ is the SHAPE OF THEIR
// CREDENTIAL: Deepgram takes a key, Azure takes a key AND a region, which is why the
// readers below are passed through rather than being one getKey.
let provider = 'builtin';
// The chosen voice id per paid service, kept SEPARATELY rather than as one "paid
// voice" value. The two id namespaces have nothing in common ('aura-2-thalia-en' vs
// 'en-US-AvaMultilingualNeural'), so one cannot stand in for the other, and sharing a
// slot would mean switching services back and forth silently discarded the choice
// made in each.
const models = { deepgram: aura.DEFAULT_VOICE, azure: azure.DEFAULT_VOICE };
const backends = { deepgram: null, azure: null };
// The REST services (OpenAI, Google Cloud, ElevenLabs) join the same two tables rather
// than getting their own, so everything below - unlockAudio, the fallback, the speaking
// broadcast - covers them without knowing they exist.
for (const id of Object.keys(TTS_PROVIDERS)) {
    models[id] = TTS_PROVIDERS[id].defaultVoice;
    backends[id] = null;
}

// ⚠ EACH SERVICE HAS ITS OWN KEY, so one getKey cannot serve them all. The reader is
// per provider and set alongside the provider choice; a backend reads through it on
// every utterance, so changing a key never needs the backend rebuilding.
const keyReaders = {};
const modelReaders = {};

export function setProviderCredentials(name, { getKey: gk, getModel: gm } = {}) {
    if (gk) keyReaders[name] = gk;
    if (gm) modelReaders[name] = gm;
}
// Reported when a paid voice fails and the browser voice speaks instead. The app
// wires this to the error log, so a silent downgrade is still visible afterwards.
let onFallback = null;

// Held at module scope rather than captured when a backend is built: a backend is
// created ONCE and reused, so wiring these in at creation time would silently pin the
// first key source forever and a later setProvider() call would appear to do nothing.
// A backend reads through these on every utterance instead.
let getKey = () => '';
let getRegion = () => '';
let onBilled = () => {};

function isPaid(name) {
    return name === 'deepgram' || name === 'azure' || !!TTS_PROVIDERS[name];
}

// Build on first use, so a user who never chooses a paid voice never constructs one.
function backendFor(name) {
    if (!isPaid(name)) return null;
    if (!backends[name]) {
        if (name === 'deepgram') {
            backends[name] = aura.createVoice({
                getKey: () => getKey(), onBilled: (n) => onBilled(n),
            });
        } else if (name === 'azure') {
            backends[name] = azure.createVoice({
                getKey: () => getKey(),
                getRegion: () => getRegion(),
                onBilled: (n) => onBilled(n),
            });
        } else {
            // A catalog service. Its key reader is its own, falling back to the shared
            // one so a caller that only ever set the current provider's key still works.
            backends[name] = rest.createVoice({
                provider: TTS_PROVIDERS[name],
                getKey: () => (keyReaders[name] ? keyReaders[name]() : getKey()),
                getModel: () => (modelReaders[name] ? modelReaders[name]() : ''),
                onBilled: (n) => onBilled(n),
            });
        }
    }
    return backends[name];
}

export function setProvider(name, opts = {}) {
    provider = isPaid(name) ? name : 'builtin';
    if (opts.model) models[provider === 'builtin' ? 'deepgram' : provider] = opts.model;
    if (opts.getKey) getKey = opts.getKey;
    if (opts.getRegion) getRegion = opts.getRegion;
    if (opts.onBilled) onBilled = opts.onBilled;
    if (isPaid(provider)) backendFor(provider);
}

export function getProvider() {
    return provider;
}

// The voice for a named paid service, or for the one currently in use.
export function setPaidVoice(name, model) {
    if (model && isPaid(name)) models[name] = model;
}

export function getPaidVoice(name = provider) {
    return models[name] || null;
}

// Kept under the old names because the Deepgram wiring and its tests call them; they
// are now the Deepgram-shaped view of the table above.
export function setAuraModel(model) {
    setPaidVoice('deepgram', model);
}

export function getAuraModel() {
    return models.deepgram;
}

export function onFallbackToBrowser(cb) {
    onFallback = cb;
}

// iOS will not start audio outside a user gesture, and placeholders fire on timers,
// so the audio path has to be unlocked during some earlier tap or the app goes silent
// exactly when it is trying to hold the floor. Safe to call on any tap. Unlocks EVERY
// constructed backend rather than the current one, because the setting can change
// between the unlocking tap and the first thing the app says.
export function unlockAudio() {
    for (const b of Object.values(backends)) if (b) b.unlock();
}

const SAMPLE_PHRASE = 'This is how I will sound during our conversation.';

export function testAuraVoice(key, model, phrase = SAMPLE_PHRASE) {
    return backendFor('deepgram').test(key, model, phrase);
}

export function testAzureVoice(key, region, model, phrase = SAMPLE_PHRASE) {
    return backendFor('azure').test(key, region, model, phrase);
}

/*
 * Test a catalog service (OpenAI, Google Cloud, ElevenLabs).
 *
 * ⚠ FOR THOSE THREE THIS IS THE ONLY PROOF THE PATH WORKS. Their request shapes come
 * from the provider bench and, for ElevenLabs transcription, from documentation alone -
 * nothing has been run against a real key from inside the app. It speaks rather than
 * merely checking the key, because a rejected key, an unknown voice, an unknown model
 * and a blocked audio context all fail differently.
 */
export function testRestVoice(name, key, model, voice, phrase = SAMPLE_PHRASE) {
    const backend = backendFor(name);
    if (!backend) return Promise.resolve({ ok: false, message: '✗ Unknown voice service.' });
    return backend.test(key, model, voice, phrase);
}

/** Every paid voice service the app can use, for the Settings pickers. */
export function paidVoiceServices() {
    return ['deepgram', 'azure', ...Object.keys(TTS_PROVIDERS)];
}

// Speaking-state broadcast. Anything that needs to know when the app is
// producing audio subscribes here — notably the STT layer, which uses the
// spoken text to recognize and discard its own TTS echo (placeholder tokens, the
// spoken response, prompts) so our own speech isn't mistaken for the partner
// and doesn't renew the partner's turn. Listeners get (speaking, text): text
// is the phrase on a start, null on an end. A monotonic token guards against a
// superseded utterance's late onend/onerror reporting a spurious end while a
// newer utterance is still going.
let speaking = false;
let speakToken = 0;
const speakingListeners = [];

function notifySpeaking(text) {
    speakingListeners.forEach(cb => cb(speaking, text));
}

export function isSpeaking() {
    return speaking;
}

export function onSpeakingChange(callback) {
    speakingListeners.push(callback);
}

export function setVoice(voiceURI) {
    selectedVoiceURI = voiceURI;
}

export function getSelectedVoiceURI() {
    return selectedVoiceURI;
}

function findVoice(voiceURI) {
    const uri = voiceURI || selectedVoiceURI;
    if (!uri) return null;
    return synth.getVoices().find(v => v.voiceURI === uri) || null;
}

// The browser's own voice. Kept as its own function because it is BOTH one of the
// two providers and the fallback for the other one.
function speakBuiltin(text, opts, myToken) {
    return new Promise((resolve) => {
        if (synth.speaking) synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = findVoice(opts.voiceURI);
        // Assigning a voice the engine rejects throws. It must not escape: this
        // function is the last resort, and an exception here would leave `speaking`
        // true forever with no matching end event — which would tell the STT echo
        // filter the app is permanently talking and suppress every silence
        // checkpoint from then on. Better a voice we did not ask for than a mic that
        // never fires again.
        try {
            if (voice) utterance.voice = voice;
        } catch { /* fall through with the engine's default voice */ }
        const finish = () => {
            // Only report the end if no newer speak()/cancel() superseded this
            // utterance — otherwise we'd report "not speaking" mid-utterance.
            if (myToken === speakToken && speaking) {
                speaking = false;
                notifySpeaking(null);
            }
            resolve();
        };
        utterance.onend = finish;
        utterance.onerror = finish;
        // Same reasoning: if the engine refuses the utterance outright, report the
        // end rather than leaving the speaking state latched on.
        try {
            synth.speak(utterance);
        } catch {
            finish();
        }
    });
}

/*
 * speak(text, opts). opts.voiceURI overrides the user's selected browser voice for
 * this utterance; opts.auraModel and opts.azureVoice do the same for the two paid
 * voices. Practice Mode passes all three, so the AI partner sounds distinct from the
 * user whichever provider is in use — and the same is true of the spoken Settings
 * help, which borrows the practice partner's voice for exactly that reason.
 *
 * The speaking-state broadcast happens HERE, once, around whichever backend runs —
 * including a fallback. The STT echo filter uses that text to recognize and discard
 * the app's own speech, so a path that spoke without announcing itself would make
 * the app transcribe itself as the partner.
 */
/*
 * WHICH VOICE ACTUALLY SPOKE the last utterance — recorded against each turn in the
 * conversation log so a replay can reproduce it (Ken, August 8 2026).
 *
 * ⚠ This reports what was USED, not what is SET, and the difference is the whole
 * reason it exists: the paid voice falls back to the device voice on any failure,
 * per utterance, while Settings goes on saying Deepgram. Reading the setting would
 * therefore record a voice the user never heard — and would hide the one event most
 * worth being able to see afterwards.
 */
let lastUsed = { provider: 'browser', voice: null };
export function lastVoiceUsed() { return { ...lastUsed }; }

export function speak(text, opts = {}) {
    const myToken = ++speakToken;
    // Announce the phrase on every start (even back-to-back placeholders) so the
    // STT echo filter always knows the current spoken text.
    speaking = true;
    // ⚠ The DISPLAY form is what is announced, and `said` is what the voice is given.
    // This one line is the whole display-vs-spoken split for names: everything
    // upstream of the synthesiser — the transcript, the saved conversation file, the
    // "now playing" line, and the echo filter, which all read the announced text —
    // keeps the real name, and only the synthesiser sees the respelling. See
    // pronunciation.js for why each of those must not.
    notifySpeaking(text);
    const said = pronounce(text);

    const paid = backendFor(provider);
    if (!paid) {
        lastUsed = { provider: 'browser', voice: opts.voiceURI || selectedVoiceURI || null };
        return speakBuiltin(said, opts, myToken);
    }

    // Each caller may override the voice for one utterance — Practice Mode does, so
    // the AI partner sounds distinct from the user whichever service is in use. The
    // two overrides are named per service for the same reason the stored voices are:
    // an Aura id handed to Azure is not a voice, it is a 400.
    const model = (provider === 'azure' ? opts.azureVoice : opts.auraModel) || models[provider];
    lastUsed = { provider, voice: model };
    return paid.speak(said, { model })
        .then(() => {
            if (myToken === speakToken && speaking) {
                speaking = false;
                notifySpeaking(null);
            }
        })
        .catch((err) => {
            // Superseded or deliberately cancelled: cancel() has already reported
            // the end, and falling back would speak something the user stopped.
            if (myToken !== speakToken) return;
            // The paid voice failed. Say it anyway with the browser's own voice —
            // the one outcome that is never acceptable is that the user pressed a
            // button and nothing was said.
            if (onFallback) onFallback(err && err.message ? err.message : String(err));
            // The device voice is what the user actually hears for this utterance, so
            // that is what the turn must record — this is the case the field is for.
            lastUsed = { provider: 'browser', voice: opts.voiceURI || selectedVoiceURI || null, fellBack: true };
            return speakBuiltin(said, opts, myToken);
        });
}

/*
 * How to say a name the voice gets wrong. Set once at startup to
 * pronunciation.apply; a hook rather than an import so this module stays free of the
 * data layer, and so it degrades to plain text when nothing has wired it.
 */
let pronouncer = null;
export function setPronouncer(fn) {
    pronouncer = typeof fn === 'function' ? fn : null;
}
function pronounce(text) {
    if (!pronouncer || !text) return text;
    // A pronouncer that throws must never cost the user their voice.
    try { return pronouncer(text) || text; } catch { return text; }
}

export function cancel() {
    speakToken++; // invalidate any pending utterance's finish handler
    synth.cancel();
    // EVERY constructed backend, not just the current one: the provider can change
    // while an utterance is still playing, and a cancel that reached only the new
    // backend would leave the old one talking with nothing able to stop it.
    for (const b of Object.values(backends)) if (b) b.cancel();
    if (speaking) {
        speaking = false;
        notifySpeaking(null);
    }
}

export function getVoices() {
    return synth.getVoices();
}

// --- Voice quality tier (Ken, July 31 2026) ---
//
// WHY: Apple's higher-quality downloadable voices carry the SAME `name` as their
// compact sibling — an Enhanced "Ava" and a compact "Ava" are distinguishable only
// by voiceURI (com.apple.voice.enhanced.en-US.Ava vs ...compact...). So a picker
// showing "name (lang)" lists two identical-looking entries and gives the user no
// way to tell which is which, or whether downloading a better voice changed
// anything at all. With 68 voices on an iPad that is a list you cannot navigate.
//
// This also answers a question we cannot answer from the desktop: the published
// record disagrees with itself about whether iOS exposes Enhanced/Premium voices
// to the Web Speech API at all. Labelling the tier makes it a thing you can SEE on
// the device rather than a claim to trust.
//
// The tier is parsed from the voiceURI (falling back to the name) because that is
// where every engine puts it:
//   Apple    com.apple.voice.{compact,enhanced,premium}.en-US.Ava
//   Edge     "Microsoft Ava Online (Natural) - English (United States)"
//   Google   "Google US English"  — no tier, correctly labelled with none
//
// Matching is word-boundaried so a name that merely contains a tier word as a
// substring cannot be mislabelled. A voice with no recognizable tier gets no
// label at all rather than a guess — on Windows that means the labels are exactly
// what they were before this existed.
const QUALITY_TIERS = [
    [/(^|[^a-z])premium([^a-z]|$)/i, 'Premium'],
    [/(^|[^a-z])enhanced([^a-z]|$)/i, 'Enhanced'],
    [/(^|[^a-z])natural([^a-z]|$)/i, 'Natural'],
    [/(^|[^a-z])neural([^a-z]|$)/i, 'Neural'],
    [/(^|[^a-z])compact([^a-z]|$)/i, 'Compact'],
];

export function voiceQuality(voice) {
    if (!voice) return '';
    const hay = `${voice.voiceURI || ''} ${voice.name || ''}`;
    for (const [pattern, label] of QUALITY_TIERS) {
        if (pattern.test(hay)) return label;
    }
    return '';
}

// --- Novelty voices (Ken, July 31 2026) ---
//
// Measured on iPadOS: 19 of the 68 voices on offer are Apple's 1980s-era set —
// Bahh, Boing, Zarvox, Trinoids and friends. For someone choosing the voice they
// will SPEAK AS, a list where a quarter of the entries are gag voices is not a
// richer choice, it is a longer scroll to get past — and scrolling is a real cost
// for the motor control this app is built around.
//
// MATCHED BY EXPLICIT ID, NOT BY PREFIX, and that is deliberate. They all live
// under com.apple.speech.synthesis.voice.*, but so does Alex — a genuinely good
// macOS voice — so a prefix rule would hide a voice someone might actually want.
// This is exactly the roster measured on the device, nothing inferred.
//
// Hiding is REVERSIBLE: Settings has a checkbox to show them again, because a user
// may legitimately want Whisper, and a list that silently omits something offers no
// way to discover that it did.
const NOVELTY_VOICE_IDS = new Set([
    'Albert', 'BadNews', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged',
    'Fred', 'GoodNews', 'Hysterical', 'Junior', 'Kathy', 'Organ', 'Princess',
    'Ralph', 'Trinoids', 'Whisper', 'Zarvox',
]);

export function isNoveltyVoice(voice) {
    if (!voice || !voice.voiceURI) return false;
    const m = /^com\.apple\.speech\.synthesis\.voice\.([A-Za-z]+)$/.exec(voice.voiceURI);
    return !!m && NOVELTY_VOICE_IDS.has(m[1]);
}

// The voices to offer, with the novelty ones dropped unless the user asked to see
// them. Everything that lists or auto-picks a voice goes through this, so the
// pickers and Practice Mode's Auto can never disagree about what is on offer.
export function usableVoices(includeNovelty = false) {
    const all = getVoices();
    if (includeNovelty) return all;
    const kept = all.filter((v) => !isNoveltyVoice(v));
    // Never hide everything: if a device somehow offers nothing but novelty voices,
    // a voice that sounds silly beats no voice at all.
    return kept.length ? kept : all;
}

// The one label both voice pickers use, so they can never drift apart. The tier
// sits directly after the name because that is what disambiguates two otherwise
// identical entries, and the eye scans the name first.
//
// A tier already spelled out in the name is not repeated: Edge names its cloud
// voices "Microsoft Ava Online (Natural) - English (United States)", which would
// otherwise render as "…(Natural) — Natural". Apple's names never carry the tier,
// which is the whole problem, so they always get the suffix.
export function voiceLabel(voice) {
    const quality = voiceQuality(voice);
    const nameCarriesIt = quality &&
        new RegExp(`(^|[^a-z])${quality}([^a-z]|$)`, 'i').test(voice.name || '');
    return quality && !nameCarriesIt
        ? `${voice.name} — ${quality} (${voice.lang})`
        : `${voice.name} (${voice.lang})`;
}

export function onVoicesReady(callback) {
    const voices = synth.getVoices();
    if (voices.length > 0) {
        callback(voices);
    }
    synth.onvoiceschanged = () => callback(synth.getVoices());
}
