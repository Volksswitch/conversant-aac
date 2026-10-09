/*
 * Keep the fixed phrases ready in the paid voice (Ken, October 9 2026, option 2).
 *
 * WHICH PHRASES: the holding phrases, the Commands phrases (asking them to repeat,
 * hold on, wrap up, goodbyes, "before you go"), openers that do not name the person,
 * and the Express Panel phrases. Holding phrases come first because they are needed
 * soonest. Openers with {name} are left out: there would be one per person.
 *
 * WHEN: after Start and whenever Settings closes. Never while Settings is open, so
 * testing voices there fetches nothing but the sample sentence (Ken's condition).
 *
 * HOW CHANGING VOICES WORKS: every recording is filed under the service, the voice,
 * the service's model where it has one, and the exact words given to the voice (after
 * any "How to say it" respelling). A different voice finds nothing filed under it and
 * fetches fresh; recordings no longer wanted are deleted.
 *
 * ⚠ SLOWLY. Azure's free plan accepts 20 requests a minute and refuses the rest, and a
 * refusal looks like a bad key. So Azure gets one fetch every four seconds, the others
 * a little faster, and nothing is fetched while the app is speaking. Any failure ends
 * the run quietly: this is a convenience, and a phrase not ready is simply fetched when
 * it is first said, as before.
 */
import * as tts from './tts.js';
import * as voiceStore from './voice-store.js';

// The store, swappable so a test can run the whole path without a browser database.
let store = voiceStore;
export function setStoreForTest(s) { store = s || voiceStore; }

const SEP = '\u0001';
const PACE_MS = { azure: 4000 };
const DEFAULT_PACE_MS = 400;

/** The file name for one recording. */
export function storeKey(provider, voice, variant, text) {
    return [provider, voice || '', variant || '', text].join(SEP);
}

/**
 * The phrases worth keeping, in the order they are fetched: holding phrases, then the
 * Commands phrases, then the Express Panel. Each is the text the voice is given, before
 * any respelling (the caller applies that). Duplicates are dropped; openers that name
 * the person are left out.
 */
export function wantedPhrases({ placeholderPhrases = [], controlPhrases = [], expressItems = [] } = {}) {
    const out = [];
    const seen = new Set();
    const add = (t) => {
        const s = String(t || '').trim();
        if (!s || s.includes('{') || seen.has(s)) return;
        seen.add(s);
        out.push(s);
    };
    placeholderPhrases.forEach(add);
    controlPhrases.forEach(add);
    for (const item of expressItems) {
        if (!item || item.type !== 'phrase') continue;
        add(item.speak || item.text);
    }
    return out;
}

let runToken = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Recordings fetched while the user was talking are kept too, if they are wanted -
 * otherwise a phrase said before the background run reached it would be fetched
 * twice. */
let wantedKeys = new Set();
tts.setAudioKeeper((provider, voice, variant, text, bytes) => {
    const key = storeKey(provider, voice, variant, text);
    if (wantedKeys.has(key)) store.put(key, bytes).catch(() => {});
});

/**
 * Make the wanted phrases ready for the current paid voice: load what is stored, fetch
 * what is missing, delete what is no longer wanted. A new call supersedes one still
 * running. Never throws.
 */
export async function refresh(phrases) {
    const mine = ++runToken;
    try {
        const info = tts.paidVoiceInfo();
        if (!info) { wantedKeys = new Set(); return; }   // the device's own voice: nothing to keep
        const { provider, voice, variant, backend } = info;
        const items = phrases.map((t) => {
            const said = tts.spokenForm(t).trim();
            return { said, key: storeKey(provider, voice, variant, said) };
        }).filter((x) => x.said);
        wantedKeys = new Set(items.map((x) => x.key));

        // Clear out recordings no longer wanted (another voice, a phrase edited away).
        for (const k of await store.keys()) {
            if (mine !== runToken) return;
            if (!wantedKeys.has(k)) await store.remove(k);
        }

        const missing = [];
        for (const { said, key } of items) {
            if (mine !== runToken) return;
            const bytes = await store.get(key);
            if (bytes) {
                try { await backend.preload(said, voice, bytes); } catch { missing.push({ said, key }); }
            } else missing.push({ said, key });
        }

        const pace = PACE_MS[provider] || DEFAULT_PACE_MS;
        for (const { said, key } of missing) {
            if (mine !== runToken) return;
            while (tts.isSpeaking()) { await sleep(500); if (mine !== runToken) return; }
            const bytes = await backend.fetchForStore(said, voice);
            if (mine !== runToken) return;
            if (bytes) await store.put(key, bytes);
            await sleep(pace);
        }
    } catch {
        // Quietly: a phrase that is not ready is fetched when it is first said.
    }
}

/** Stop a run in progress (Settings opened). */
export function pause() { runToken++; }
