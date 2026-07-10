/* Shared test environment.
 *
 * Import this FIRST in every test file (before importing an app module), because
 * its top-level side effect installs the minimal browser globals the app modules
 * expect (`window.SpeechRecognition`). engine.js and llm.js touch no browser
 * globals; stt.js reads `window.SpeechRecognition` at import, so window must exist
 * before that import runs. ES import order is source order, so a first
 * `import './env.mjs'` guarantees this.
 *
 * The Node test runner isolates each test FILE in its own process, so globals set
 * here never leak between files — mockFetch in one file can't affect another.
 */
import { readFileSync } from 'node:fs';

// --- Fake SpeechRecognition (for stt.js) -------------------------------------
// Registers every instance it creates on `recognitions` so a test can drive the
// exact object stt.js created internally.
export const recognitions = [];

export class FakeRecognition {
    constructor() {
        this.continuous = true;
        this.interimResults = true;
        this.lang = 'en-US';
        this._started = false;
        this.onresult = null;
        this.onend = null;
        this.onerror = null;
        recognitions.push(this);
    }
    start() { if (this._started) throw new Error('already started'); this._started = true; }
    stop() { this._started = false; if (this.onend) setTimeout(() => this.onend && this.onend(), 0); }
    get capturing() { return this._started; }

    // Emit one FINAL recognition segment.
    emitFinal(text) {
        this.onresult({ resultIndex: 0, results: mkResults([{ text, isFinal: true }]) });
    }
    // Emit one INTERIM (not-yet-final) segment.
    emitInterim(text) {
        this.onresult({ resultIndex: 0, results: mkResults([{ text, isFinal: false }]) });
    }
    // Emit several segments in one event (mirrors the recognizer batching results).
    emit(segments) {
        this.onresult({ resultIndex: 0, results: mkResults(segments) });
    }
}

function mkResults(segments) {
    const results = segments.map(s => {
        const r = { 0: { transcript: s.text }, isFinal: !!s.isFinal, length: 1 };
        return r;
    });
    results.length = segments.length;
    return results;
}

// Install the browser globals the modules need. Idempotent.
if (!globalThis.window) globalThis.window = {};
globalThis.window.SpeechRecognition = FakeRecognition;

// --- Mock fetch (for llm.js) -------------------------------------------------
// The native fetch captured at load, so the live tier can restore/use it even if a
// deterministic test swapped in a mock earlier in the same process.
export const nativeFetch = globalThis.fetch;

let fetchCalls = [];
export function getFetchCalls() { return fetchCalls; }

// Make global fetch return a canned Anthropic-style response. `payload` is the
// object the API would return (e.g. { content:[{text: '<json>'}], usage:{...} });
// pass a string to have it wrapped as content[0].text. `opts.ok`/`opts.status`
// simulate an HTTP error. Returns nothing; inspect getFetchCalls() for the
// request bodies (so a test can assert what was sent).
export function mockFetch(payload, opts = {}) {
    fetchCalls = [];
    const ok = opts.ok !== false;
    const status = opts.status || (ok ? 200 : 500);
    globalThis.fetch = async (url, init) => {
        fetchCalls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null });
        const data = typeof payload === 'string'
            ? { content: [{ text: payload }], usage: { input_tokens: 1, output_tokens: 1 } }
            : payload;
        return {
            ok,
            status,
            async json() { return data; },
            async text() { return typeof data === 'string' ? data : JSON.stringify(data); },
        };
    };
}

export function restoreFetch() { globalThis.fetch = nativeFetch; }

// --- localStorage shim (for storage.js + the modules that cache through it) ---
// storage.js touches IndexedDB / the File System Access API only inside functions
// we never call in tests (restore/pick/clear); with no data folder, hasDataFolder()
// is false, readFile() returns null and writeFile() is a no-op — so the modules
// fall back to their localStorage cache, which is all these tests exercise.
if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
        setItem: (k, v) => store.set(String(k), String(v)),
        removeItem: (k) => store.delete(String(k)),
        clear: () => store.clear(),
        key: (i) => [...store.keys()][i] ?? null,
        get length() { return store.size; },
    };
}
export function resetLocalStorage() { globalThis.localStorage.clear(); }
// Write a value straight into the aac_settings blob (many storage.js accessors read
// from there). Merges so multiple calls compose.
export function setSetting(key, value) {
    let s = {};
    try { s = JSON.parse(globalThis.localStorage.getItem('aac_settings')) || {}; } catch { /* fresh */ }
    s[key] = value;
    globalThis.localStorage.setItem('aac_settings', JSON.stringify(s));
}

// --- speechSynthesis shim (tts.js reads window.speechSynthesis at import) ------
// Records every phrase spoken so a test can observe what placeholders.js / tts.js
// produced. onend fires on the next tick so awaited speak() resolves.
export const spokenTexts = [];
export function resetSpoken() { spokenTexts.length = 0; }
if (!globalThis.SpeechSynthesisUtterance) {
    globalThis.SpeechSynthesisUtterance = class {
        constructor(text) { this.text = text; this.voice = null; this.onend = null; this.onerror = null; }
    };
}
if (!globalThis.window.speechSynthesis) {
    globalThis.window.speechSynthesis = {
        speaking: false,
        speak(u) { this.speaking = true; spokenTexts.push(u.text); setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, 0); },
        cancel() { this.speaking = false; },
        getVoices() { return []; },
        onvoiceschanged: null,
    };
}

// --- fetch bundled app/data/*.json off disk (registry, words, placeholder pools) --
// worldview.loadRegistry(), prediction.load(), placeholders.loadPools() fetch
// relative data/*.json URLs; route those to the real files so tests run against the
// shipped data. Everything else 404s.
export function mockFetchFromDisk() {
    fetchCalls = [];
    globalThis.fetch = async (url) => {
        const m = String(url).match(/data\/([\w.-]+\.json)$/);
        if (m) {
            try {
                const text = readFileSync(new URL('../app/data/' + m[1], import.meta.url), 'utf8');
                const json = JSON.parse(text);
                return { ok: true, status: 200, async json() { return json; }, async text() { return text; } };
            } catch { /* fall through to 404 */ }
        }
        return { ok: false, status: 404, async json() { throw new Error('404'); }, async text() { return ''; } };
    };
}

// --- API key for the live tier ----------------------------------------------
// Order: ANTHROPIC_API_KEY env var, then a gitignored `.anthropic-key` file at the
// repo root. Returns null when neither is present (the live tier then skips).
export function loadApiKey() {
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim()) {
        return process.env.ANTHROPIC_API_KEY.trim();
    }
    try {
        const key = readFileSync(new URL('../.anthropic-key', import.meta.url), 'utf8').trim();
        return key || null;
    } catch { return null; }
}
