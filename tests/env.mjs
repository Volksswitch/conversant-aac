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
