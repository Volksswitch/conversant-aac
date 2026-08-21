/* Metrics — the moments the saved conversations cannot show.
 *
 * WHY THIS EXISTS, and why it could not be deferred (August 16 2026). The usage
 * summary reads history: every number it reports was already written into the
 * conversation files, so it could be built at any time and would still see the past.
 * Everything in THIS module is the opposite. An event not recorded when it happens is
 * gone, and the events below are exactly the ones that carry the early-warning
 * signals — the app opened and no conversation started, suggestions shown and then
 * abandoned, a button never pressed in six weeks. Those must be capturing before the
 * first tester's first week or the most important stretch of the beta is unmeasured.
 *
 * ⚠ THE ONE RULE, AND IT IS ENFORCED HERE RATHER THAN TRUSTED TO CALLERS: an event
 * carries counts, durations and categories. NEVER WORDS. `redactFields` drops any
 * value that is not a number or a boolean, and allows a string only under one of a
 * few key names that could not plausibly hold speech (and truncates it even then). So
 * a mistaken `metrics.event('x', { partner: whatTheySaid })` records nothing rather
 * than quietly shipping a sentence in the weekly report. That is the difference
 * between a privacy rule and a privacy hope.
 *
 * WHERE IT GOES. Three sinks, for three different readers:
 *   - a per-day tally in browser storage, which is what the weekly report carries
 *     (compact, and it lets week-by-week be computed at the far end);
 *   - a short in-memory ring of the most recent events, which is the reproduction
 *     context attached to a problem report — "what was happening just before";
 *   - one line per event appended to metrics.log in the data folder, the permanent
 *     detailed record for offline analysis. Best-effort and absent without a folder.
 *
 * ⚠ IT MUST NEVER BREAK WHAT IT MEASURES. Every entry point swallows its own errors.
 * A diagnostic that can throw inside the conversation loop is worse than no
 * diagnostic, because it fails hardest when something is already going wrong.
 */
import * as storage from './storage.js';

const KEY = 'aac_metrics';
const VERSION = 1;
const DAYS_KEPT = 60;         // ~two months; a beta is six to eight weeks
const SAMPLES_PER_DAY = 300;  // per timing name — enough for a stable median
const RING_MAX = 200;

/* The event vocabulary. Listed here rather than left as loose strings so that the
 * set is reviewable in one place, and so a typo at a call site is visible as a name
 * that does not appear in this list rather than as a silently separate counter. */
export const EV = {
    // Opening and setting up
    APP_OPENED: 'app_opened',
    START_PRESSED: 'start_pressed',
    // The conversation itself
    CONVERSATION_STARTED: 'conversation_started',
    CONVERSATION_ENDED: 'conversation_ended',
    LISTEN: 'listen',                       // { auto } — manual tap or auto-resume
    CHECKPOINT: 'checkpoint',               // { n, sinceMs } — a partner pause
    GENERATION: 'generation',               // { ms }
    GENERATION_SUPERSEDED: 'generation_superseded',
    GENERATION_FAILED: 'generation_failed', // { reason }
    RATE_LIMITED: 'rate_limited',
    STT_GAP: 'stt_gap',                     // { ms } — between recognizer deliveries
    // Suggestions
    PALETTE_SHOWN: 'palette_shown',         // { kind, cards, words }
    PALETTE_REFRESHED: 'palette_refreshed',
    PALETTE_ABANDONED: 'palette_abandoned', // { kind, cards }
    // A reprompt finished while the user was in "In my own words", so its cards
    // were kept back rather than rendered under the composer, and shown only if
    // they cancelled (Ken, August 21 2026). A run of these with no cancel after
    // them means the work is being paid for and thrown away.
    PALETTE_HELD: 'palette_held',           // { kind }
    PALETTE_TAKEN: 'palette_taken',         // { kind, heldMs }
    CARD_SELECTED: 'card_selected',         // { slot, index, decideMs }
    // How long the cards were up before the user did ANYTHING — read plus select
    // (Ken, August 16 2026). Tagged with what the action was, so "they read for six
    // seconds and then typed instead" is distinguishable from "they read for six
    // seconds and tapped a card". Both are reading load; only one is a success.
    DECIDE: 'decide',                       // { kind, ms }
    REGENERATE: 'regenerate',
    REFRAME: 'reframe',
    CHOICE_CHIP: 'choice_chip',
    // Saying it another way
    COMPOSER_OPENED: 'composer_opened',
    COMPOSER_SPOKEN: 'composer_spoken',
    COMPOSER_CANCELLED: 'composer_cancelled',
    EXPRESS_PHRASE: 'express_phrase',
    // The buttons
    COMMAND_BAR: 'command_bar',             // { button }
    PLACEHOLDER_SPOKEN: 'placeholder_spoken',
};

// A duration is recorded as a timing (samples, so a median is possible) as well as a
// count. Any event carrying one of these keys contributes to the matching timing.
const TIMING_KEYS = ['ms', 'decideMs', 'sinceMs'];

/* String values are allowed ONLY under these names. None of them could plausibly be
 * asked to hold something a person said, which is the point — the whitelist is what
 * makes "never words" structural rather than a matter of remembering. */
const STRING_FIELDS = new Set(['slot', 'kind', 'button', 'source', 'provider', 'reason', 'status']);
const STRING_MAX = 24;

/* ── Pure helpers (unit-tested) ───────────────────────────────────────────── */

/* Drop anything that is not a count, a duration or a small category. A number or a
 * boolean passes; a string passes only under a whitelisted name, truncated. Silence
 * rather than an error is deliberate: this runs inside the conversation loop, and a
 * throw here would cost a turn to protect a diagnostic. */
export function redactFields(fields) {
    const out = {};
    for (const [k, v] of Object.entries(fields || {})) {
        if (typeof v === 'number') { if (Number.isFinite(v)) out[k] = v; }
        else if (typeof v === 'boolean') out[k] = v;
        else if (typeof v === 'string' && STRING_FIELDS.has(k)) out[k] = v.slice(0, STRING_MAX);
        // everything else is dropped on purpose — see the header
    }
    return out;
}

// Local calendar day, matching usage-summary: the tester's day, not UTC's.
export function dayKey(t = Date.now()) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Fold one event into the per-day tally. Returns the same object, mutated — this is
 * called on every card tap and every recognizer delivery, so it stays cheap. */
export function tally(store, name, fields, t = Date.now()) {
    if (!store.days) store.days = {};
    const key = dayKey(t);
    const day = store.days[key] || (store.days[key] = { c: {}, t: {} });
    day.c[name] = (day.c[name] || 0) + 1;
    for (const tk of TIMING_KEYS) {
        const v = fields && fields[tk];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) continue;
        const bucket = `${name}.${tk}`;
        const arr = day.t[bucket] || (day.t[bucket] = []);
        arr.push(Math.round(v));
        // Keep the OLDEST samples on overflow rather than the newest. A day that
        // produces more than the cap is a heavy day, and a median from its first
        // three hundred is representative; rotating would bias the figure towards
        // whatever the tester was doing at bedtime.
        if (arr.length > SAMPLES_PER_DAY) arr.length = SAMPLES_PER_DAY;
    }
    return store;
}

// Forget days older than the window. Runs on save, so the stored blob cannot grow
// without limit on a tester who keeps the app for a year.
export function trimDays(store, keep = DAYS_KEPT, now = Date.now()) {
    if (!store.days) return store;
    const cutoff = dayKey(now - keep * 86400000);
    for (const k of Object.keys(store.days)) {
        if (k < cutoff) delete store.days[k];   // yyyy-mm-dd sorts as it dates
    }
    return store;
}

function median(nums) {
    if (!nums || !nums.length) return null;
    const s = [...nums].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/* Roll the per-day tally up into totals plus the per-day counts. Both are needed and
 * they answer different questions: the totals say what happens, and the per-day
 * series is what makes "it stopped happening in week three" visible. */
export function rollUp(store, { days = DAYS_KEPT } = {}) {
    const dayKeys = Object.keys((store && store.days) || {}).sort().slice(-days);
    const totals = {};
    const timings = {};
    const byDay = {};
    for (const k of dayKeys) {
        const d = store.days[k];
        byDay[k] = { ...d.c };
        for (const [name, n] of Object.entries(d.c || {})) totals[name] = (totals[name] || 0) + n;
        for (const [name, arr] of Object.entries(d.t || {})) {
            (timings[name] || (timings[name] = [])).push(...arr);
        }
    }
    const stats = {};
    for (const [name, arr] of Object.entries(timings)) {
        stats[name] = { n: arr.length, median: median(arr), max: Math.max(...arr) };
    }
    return { days: dayKeys.length, totals, timings: stats, byDay };
}

/* ── State and effects ───────────────────────────────────────────────────── */

let store = { v: VERSION, days: {} };
let ring = [];
let enabled = true;
let loaded = false;

function load() {
    if (loaded) return;
    loaded = true;
    try {
        const raw = JSON.parse(localStorage.getItem(KEY));
        if (raw && typeof raw === 'object' && raw.days) store = raw;
    } catch { /* start fresh rather than fail */ }
    store.v = VERSION;
}

/* ⚠ WRITING TO BROWSER STORAGE ON EVERY EVENT WOULD BE A REAL COST, not a
 * theoretical one: the recognizer delivers several results a second while someone is
 * speaking, and each one serializes the whole tally. So the write is debounced. The
 * exposure is the last couple of seconds of counters if the tab dies, which is a
 * fair trade for not touching the disk inside the speech path — and `flush()` is
 * called on the way out, so an ordinary close loses nothing. */
let persistTimer = null;
const PERSIST_DEBOUNCE_MS = 2000;

function persistNow() {
    persistTimer = null;
    try {
        trimDays(store);
        localStorage.setItem(KEY, JSON.stringify(store));
    } catch { /* quota or serialize — the in-memory tally is still good */ }
}

function persistSoon() {
    if (persistTimer) return;
    try { persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS); }
    catch { persistNow(); }
}

/* Write the tally out now. Wired to the page going away, and called before the
 * weekly report is assembled so the report cannot miss the session that is about to
 * send it. */
export function flush() {
    if (persistTimer) { try { clearTimeout(persistTimer); } catch { /* ignore */ } }
    persistNow();
    try { storage.flushMetricsFile(); } catch { /* best effort */ }
}

/* Record one event. The only entry point callers need.
 *
 * Fire-and-forget by design: it returns nothing useful and never throws, so a call
 * site can be added anywhere in the conversation loop without a guard around it.
 *
 * `quiet` tallies the event without putting it in the ring or the log file. It exists
 * for the one genuinely high-frequency event — the recognizer delivery gap, several a
 * second while anyone is talking — where the DISTRIBUTION is the whole point but an
 * individual gap tells you nothing and would drown the reproduction context that the
 * ring exists to provide. */
export function event(name, fields = {}, { quiet = false } = {}) {
    if (!enabled || !name) return;
    try {
        load();
        const clean = redactFields(fields);
        const t = Date.now();
        tally(store, name, clean, t);
        persistSoon();
        if (quiet) return;
        const entry = { t: new Date(t).toISOString(), e: name, ...clean };
        ring.push(entry);
        while (ring.length > RING_MAX) ring.shift();
        storage.appendMetricsFile(entry);
    } catch { /* a diagnostic must never break what it measures */ }
}

/* The most recent events, oldest first — the reproduction context for a problem
 * report. In memory only: it is deliberately short and deliberately not persisted,
 * because its whole job is "what was happening in the last minute or so". */
export function recent(n = RING_MAX) {
    return ring.slice(-n);
}

export function formatRecent(entries = recent()) {
    if (!entries.length) return '(nothing recorded)';
    return entries.map(e => {
        const when = e.t ? e.t.slice(11, 23) : '?';
        const rest = Object.entries(e)
            .filter(([k]) => k !== 't' && k !== 'e')
            .map(([k, v]) => `${k}=${v}`).join(' ');
        return `${when}  ${e.e}${rest ? '  ' + rest : ''}`;
    }).join('\n');
}

/* What the weekly report carries. Totals, per-day counts and timing statistics —
 * no individual events, which keeps the payload small and means a report can never
 * be read as a timeline of one afternoon. */
export function snapshot(opts) {
    load();
    return rollUp(store, opts);
}

/* How long the recognizer went between deliveries while someone was speaking.
 *
 * ⚠ THIS IS THE CHEAP HALF OF A MEASUREMENT WE CANNOT OTHERWISE TAKE. The real pause
 * a partner has to leave is the recognizer's delay PLUS the silence setting, because
 * the silence timer is reset by text arriving, not by the room going quiet — so a
 * setting of half a second is really a longer wait than it says. The delay itself is
 * only measurable on the paid recognizer, which reports word times; the browser's
 * exposes no audio timing at all. But a checkpoint fires when a DELIVERY GAP exceeds
 * the threshold, so the gap distribution is what actually causes a spurious
 * checkpoint, and it costs nothing on either recognizer.
 *
 * Quiet, because it fires several times a second. Only the distribution is kept. */
export function sttGap(ms) {
    if (!Number.isFinite(ms) || ms < 0) return;
    event(EV.STT_GAP, { ms }, { quiet: true });
}

export function clearAll() {
    store = { v: VERSION, days: {} };
    ring = [];
    loaded = true;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Off is honored everywhere, including the metrics.log line. Wired to the same
// switch as the weekly send, so a tester who turns reporting off is not still
// having their taps counted on disk.
export function setEnabled(on) { enabled = !!on; }
export function isEnabled() { return enabled; }

/* ── A conversation's worth of state ─────────────────────────────────────────
 * Two things need remembering ACROSS events, and neither belongs to a call site:
 * whether a set of suggestions is currently on offer (so abandonment can be told
 * from a refresh), and how many pauses this partner turn has produced. Both are
 * plain module state because there is exactly one conversation at a time. */

let openPalette = null;      // { kind, cards, at } while suggestions are showing
let checkpointsThisTurn = 0;
let lastCheckpointAt = 0;

/* Suggestions became visible. The FIRST render of a turn is "shown"; later renders
 * for the same turn are "refreshed", because every silence checkpoint re-renders and
 * counting each as a fresh offer would inflate the denominator that abandonment is
 * measured against. */
export function paletteShown({ kind = 'ai', cards = 0, words = 0 } = {}) {
    if (openPalette) {
        openPalette = { kind, cards, at: Date.now() };
        event(EV.PALETTE_REFRESHED, { kind, cards, words });
        return;
    }
    openPalette = { kind, cards, at: Date.now() };
    event(EV.PALETTE_SHOWN, { kind, cards, words });
}

/* A card was taken. Closes the open offer WITHOUT recording abandonment, and carries
 * the deliberation time — the stretch from the cards appearing to this tap, which is
 * the only part of the partner's wait that is the person rather than the machine. */
export function paletteTaken({ slot = null, index = -1, decideMs = null } = {}) {
    openPalette = null;
    const f = { index };
    if (slot) f.slot = slot;
    if (Number.isFinite(decideMs)) f.decideMs = decideMs;
    event(EV.CARD_SELECTED, f);
}

/* The turn moved on with the suggestions untaken — the user typed instead, tapped an
 * Express button, or the conversation ended. This is the case the saved conversations
 * can never show: the app did its job, showed four options, and the user went
 * elsewhere. Nothing records that today except as a lower share chosen from a card,
 * which cannot separate "the suggestions missed" from "they had their own thing to
 * say". Safe to call unconditionally; it is a no-op with nothing on offer. */
export function paletteAbandoned(reason = null) {
    if (!openPalette) return;
    const { kind, cards } = openPalette;
    openPalette = null;
    event(EV.PALETTE_ABANDONED, reason ? { kind, cards, reason } : { kind, cards });
}

export function paletteIsOpen() { return !!openPalette; }

/* A partner pause fired a checkpoint. `n` counts within the current partner turn, so
 * "how many times did we ask the AI about one thing they said" is answerable — which
 * is what the half-second silence setting turns on. The gap since the previous
 * checkpoint is recorded with it, because a run of very short gaps is what a setting
 * firing inside continuous speech looks like. */
export function checkpoint() {
    const now = Date.now();
    checkpointsThisTurn++;
    const f = { n: checkpointsThisTurn };
    if (checkpointsThisTurn > 1 && lastCheckpointAt) f.sinceMs = now - lastCheckpointAt;
    lastCheckpointAt = now;
    event(EV.CHECKPOINT, f);
}

// A new partner turn. Resets the per-turn checkpoint count.
export function turnBoundary() {
    checkpointsThisTurn = 0;
    lastCheckpointAt = 0;
}

/* A conversation began. IDEMPOTENT until the next boundary, which is what lets the
 * three paths that can open one — the mic opening, an opener card, an Express phrase
 * spoken into silence — all just call it without any of them having to know whether
 * one of the others got there first. */
let conversationOpen = false;
export function conversationStarted(fields = {}) {
    if (conversationOpen) return;
    conversationOpen = true;
    event(EV.CONVERSATION_STARTED, fields);
}

/* Everything the conversation-scoped state holds, cleared together — and the place
 * the "it ended" event is raised.
 *
 * ⚠ IT IS RAISED HERE, NOT AT THE CALL SITE, because "was there a conversation to
 * end" is exactly what this module already knows and the caller does not. The app
 * clears conversation state from several paths, and one of them is START conversation,
 * which wipes the previous one before opening a new one. Emitting at the call site
 * therefore recorded an ended conversation with no turns every single time somebody
 * pressed Start — inflating the count with conversations that never happened, which
 * would have quietly overstated adoption in the one number it is most tempting to
 * quote. Guarded by conversationOpen, so a clear with nothing open is silent. */
export function conversationBoundary(fields = {}) {
    if (conversationOpen) event(EV.CONVERSATION_ENDED, fields);
    paletteAbandoned('conversation ended');
    turnBoundary();
    conversationOpen = false;
}
