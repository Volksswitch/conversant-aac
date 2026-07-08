const STORAGE_KEY = 'aac_settings';
const IDB_NAME = 'aac-db';
const IDB_STORE = 'handles';
const DIR_HANDLE_KEY = 'dataFolder';

let dirHandle = null;

// --- IndexedDB helpers for persisting the directory handle ---

function idbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbPut(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function idbDelete(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// --- Directory handle persistence ---

export async function restoreDataFolder() {
    const stored = await idbGet(DIR_HANDLE_KEY);
    if (!stored) return false;

    try {
        let perm = await stored.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
            perm = await stored.requestPermission({ mode: 'readwrite' });
        }
        if (perm === 'granted') {
            dirHandle = stored;
            return true;
        }
    } catch {
        await idbDelete(DIR_HANDLE_KEY);
    }
    return false;
}

export async function pickDataFolder() {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await idbPut(DIR_HANDLE_KEY, dirHandle);
    return dirHandle;
}

export async function clearDataFolder() {
    dirHandle = null;
    await idbDelete(DIR_HANDLE_KEY);
}

export function hasDataFolder() {
    return dirHandle !== null;
}

export function getDataFolderName() {
    return dirHandle ? dirHandle.name : null;
}

// --- File read/write via the data folder ---

export async function readFile(filename) {
    if (!dirHandle) return null;
    try {
        const fileHandle = await dirHandle.getFileHandle(filename);
        const file = await fileHandle.getFile();
        return await file.text();
    } catch {
        return null;
    }
}

export async function writeFile(filename, content) {
    if (!dirHandle) return;
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

// --- API key (localStorage — per-machine, instant access) ---

function loadSettings() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function loadApiKey() {
    return loadSettings().apiKey || null;
}

export function saveApiKey(apiKey) {
    const settings = loadSettings();
    settings.apiKey = apiKey;
    saveSettings(settings);
}

export function loadVoiceURI() {
    return loadSettings().voiceURI || null;
}

export function saveVoiceURI(voiceURI) {
    const settings = loadSettings();
    settings.voiceURI = voiceURI;
    saveSettings(settings);
}

export function loadSilenceThreshold() {
    return loadSettings().silenceThreshold ?? 2;
}

export function saveSilenceThreshold(seconds) {
    const settings = loadSettings();
    settings.silenceThreshold = seconds;
    saveSettings(settings);
}

export function loadAutoRelisten() {
    return loadSettings().autoRelisten ?? false;
}

export function saveAutoRelisten(enabled) {
    const settings = loadSettings();
    settings.autoRelisten = enabled;
    saveSettings(settings);
}

// 'physical' (use the attached keyboard) | 'onscreen' (the app's own keyboard).
// Default 'physical' — the primary Surface setup is the type cover in laptop
// position, where Windows shows no keyboard and the physical one is in use.
export function loadKeyboardMode() {
    return loadSettings().keyboardMode === 'onscreen' ? 'onscreen' : 'physical';
}

export function saveKeyboardMode(mode) {
    const settings = loadSettings();
    settings.keyboardMode = mode === 'onscreen' ? 'onscreen' : 'physical';
    saveSettings(settings);
}

// Which on-screen keyboard layout to use in each dock (ids from
// keyboard-layouts.js — side: S1..S10, bottom: B1..B10) and which side the
// side dock sits on ('left' | 'right'). Defaults: S1 / B1 / right.
export function loadSideLayout() {
    return loadSettings().sideLayout || 'S1';
}

export function saveSideLayout(id) {
    const settings = loadSettings();
    settings.sideLayout = id;
    saveSettings(settings);
}

export function loadBottomLayout() {
    return loadSettings().bottomLayout || 'B1';
}

export function saveBottomLayout(id) {
    const settings = loadSettings();
    settings.bottomLayout = id;
    saveSettings(settings);
}

// Where the single on-screen keyboard docks, for EVERY typing context (Ken,
// June 21 2026 — replaces the old context-based side/bottom rule). 'side' pairs
// with sideDockPosition (left/right); 'bottom' is the full-width strip.
export function loadKeyboardDock() {
    return loadSettings().keyboardDock === 'side' ? 'side' : 'bottom';
}

export function saveKeyboardDock(dock) {
    const settings = loadSettings();
    settings.keyboardDock = dock === 'side' ? 'side' : 'bottom';
    saveSettings(settings);
}

export function loadSideDockPosition() {
    return loadSettings().sideDockPosition === 'left' ? 'left' : 'right';
}

export function saveSideDockPosition(pos) {
    const settings = loadSettings();
    settings.sideDockPosition = pos === 'left' ? 'left' : 'right';
    saveSettings(settings);
}

// How many response options to generate/show per category cell: 1 or 2 (max 2
// for now). 2 → each of the four slots offers two stacked alternatives.
export function loadResponsesPerCategory() {
    return Number(loadSettings().responsesPerCategory) === 2 ? 2 : 1;
}

export function saveResponsesPerCategory(n) {
    const settings = loadSettings();
    settings.responsesPerCategory = Number(n) === 2 ? 2 : 1;
    saveSettings(settings);
}

// --- Express Panel tap behavior ---
// (The item list itself lives in the express-panel.js model — data folder +
// cache — not here.)

// Tap mode for speaking an Express Panel phrase: 'single' (speak on one tap) or
// 'double' (require a confirming second tap to guard against false hits — Rule 10).
export function loadExpressTapMode() {
    return loadSettings().expressTapMode === 'double' ? 'double' : 'single';
}

export function saveExpressTapMode(mode) {
    const settings = loadSettings();
    settings.expressTapMode = mode === 'double' ? 'double' : 'single';
    saveSettings(settings);
}

// The double-tap interval (ms) — how long the first tap stays "armed" waiting
// for the confirming second tap. Tunable to the user's motor control.
export function loadDoubleTapMs() {
    const v = Number(loadSettings().doubleTapMs);
    return Number.isFinite(v) && v > 0 ? v : 400;
}

export function saveDoubleTapMs(ms) {
    const settings = loadSettings();
    settings.doubleTapMs = Number(ms) || 400;
    saveSettings(settings);
}

// Minimum button size + button spacing — unitless slider positions (0–100). The
// app maps each to a CSS dimension (see app.js applyButtonSizing); the user picks
// by visual "feel". Both feed the keyguard (target size + bar width), so they're
// Setup-tier, supporter-assisted. Defaults reproduce the historical look.
const DEFAULT_BTN_SIZE_POS = 50;   // MIDDLE = the % default layout (Ken June 30 2026); R grows, L shrinks
const DEFAULT_BTN_GAP_POS = 0;     // → gap 0 (flush by default)
const DEFAULT_MIN_GAP_POS = 0;     // → min-gap 0 by default
const DEFAULT_DOCK_SEP_POS = 0;    // → no gap between the dock (keyboard / Express Panel) and the rest of the UI

function clampPos(v, dflt) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : dflt;
}

export function loadButtonSizePos() {
    const s = loadSettings();
    return s.buttonSizePos == null ? DEFAULT_BTN_SIZE_POS : clampPos(s.buttonSizePos, DEFAULT_BTN_SIZE_POS);
}
export function saveButtonSizePos(pos) {
    const settings = loadSettings();
    settings.buttonSizePos = clampPos(pos, DEFAULT_BTN_SIZE_POS);
    saveSettings(settings);
}
export function loadButtonGapPos() {
    const s = loadSettings();
    return s.buttonGapPos == null ? DEFAULT_BTN_GAP_POS : clampPos(s.buttonGapPos, DEFAULT_BTN_GAP_POS);
}
export function saveButtonGapPos(pos) {
    const settings = loadSettings();
    settings.buttonGapPos = clampPos(pos, DEFAULT_BTN_GAP_POS);
    saveSettings(settings);
}
export function loadMinGapPos() {
    const s = loadSettings();
    return s.minGapPos == null ? DEFAULT_MIN_GAP_POS : clampPos(s.minGapPos, DEFAULT_MIN_GAP_POS);
}
export function saveMinGapPos(pos) {
    const settings = loadSettings();
    settings.minGapPos = clampPos(pos, DEFAULT_MIN_GAP_POS);
    saveSettings(settings);
}
// Keyboard separation — the gap between the dock (keyboard / Express Panel) and
// the rest of the UI (transcript / command bar / response palette, and the main
// content of About Me & Settings). Independent of the inter-button gap: it shifts
// where the MAIN content sits, NOT the dock's own footprint, so changing it does
// NOT move the keyguard holes.
export function loadDockSepPos() {
    const s = loadSettings();
    return s.dockSepPos == null ? DEFAULT_DOCK_SEP_POS : clampPos(s.dockSepPos, DEFAULT_DOCK_SEP_POS);
}
export function saveDockSepPos(pos) {
    const settings = loadSettings();
    settings.dockSepPos = clampPos(pos, DEFAULT_DOCK_SEP_POS);
    saveSettings(settings);
}

// Restore button size / spacing / minimum-gap to their defaults (the "Reset
// buttons and gaps to default" control). Removing the keys makes the loaders
// return the defaults again.
export function resetButtonSizing() {
    const settings = loadSettings();
    delete settings.buttonSizePos;
    delete settings.buttonGapPos;
    delete settings.minGapPos;
    // NOTE: dockSepPos (keyboard separation) is deliberately NOT reset here — it's
    // an independent layout preference, not part of button sizing (Ken).
    saveSettings(settings);
}

// --- Text-size scales (Transcript / Composer / Express Panel) ---
// Unitless multipliers (1 = the design default) applied to each surface's base
// font-size via a CSS variable. Independent of the button-size sliders (which
// size touch targets, not text). Clamped to a sane range.
function clampScale(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0.6, Math.min(2, n)) : 1;
}
export function loadTranscriptFontScale() {
    const s = loadSettings();
    return s.transcriptFontScale == null ? 1 : clampScale(s.transcriptFontScale);
}
export function saveTranscriptFontScale(v) {
    const settings = loadSettings();
    settings.transcriptFontScale = clampScale(v);
    saveSettings(settings);
}
export function loadComposerFontScale() {
    const s = loadSettings();
    return s.composerFontScale == null ? 1 : clampScale(s.composerFontScale);
}
export function saveComposerFontScale(v) {
    const settings = loadSettings();
    settings.composerFontScale = clampScale(v);
    saveSettings(settings);
}
export function loadExpressFontScale() {
    const s = loadSettings();
    return s.expressFontScale == null ? 1 : clampScale(s.expressFontScale);
}
export function saveExpressFontScale(v) {
    const settings = loadSettings();
    settings.expressFontScale = clampScale(v);
    saveSettings(settings);
}
export function loadResponseFontScale() {
    const s = loadSettings();
    return s.responseFontScale == null ? 1 : clampScale(s.responseFontScale);
}
export function saveResponseFontScale(v) {
    const settings = loadSettings();
    settings.responseFontScale = clampScale(v);
    saveSettings(settings);
}

// --- Conversation privacy (Ken, July 2026) ---
// The user can hold a conversation that is NOT written to the data folder, for
// privacy. `conversationSaving` is the live per-conversation state (gated below);
// `noSaveDefault` is the Settings default that seeds it at the start of each
// conversation. When saving is off, the log functions below no-op entirely — no
// file is created and no turn is written.
let conversationSaving = true;
export function setConversationSaving(on) { conversationSaving = !!on; }
export function isConversationSaving() { return conversationSaving; }
export function loadNoSaveDefault() { return !!loadSettings().noSaveDefault; }
export function saveNoSaveDefault(v) {
    const settings = loadSettings();
    settings.noSaveDefault = !!v;
    saveSettings(settings);
}

// --- "What's new" notice: the highest APP_VERSION whose post-update summary the
// user has already seen. null until first recorded (a brand-new install, or an
// app old enough to predate this feature) — that first run just sets a baseline
// silently. See whats-new.js.
export function loadLastSeenVersion() {
    return loadSettings().lastSeenVersion ?? null;
}
export function saveLastSeenVersion(version) {
    const settings = loadSettings();
    settings.lastSeenVersion = version;
    saveSettings(settings);
}

// --- Conversation logging ---

let conversationDirHandle = null;
let currentLogHandle = null;
let currentLogName = null;
let currentLogData = null;

// One ID per conversation, shared by the conversation log file AND any error-log
// entries in that conversation, so the two can be correlated (Ken, July 2026).
// It is the timestamp base of the log filename (`<id>.json`). Created lazily the
// first time it's needed (first turn, or first error) and reused until the
// conversation is terminated (resetConversationId, called from
// terminateConversation) — so every turn and error in one conversation shares it,
// even before the log file is written and even when the conversation isn't saved.
let currentConversationId = null;

function ensureConversationId() {
    if (!currentConversationId) {
        currentConversationId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }
    return currentConversationId;
}
export function getConversationId() { return currentConversationId; }
export function resetConversationId() {
    currentConversationId = null;
    // Also drop the per-conversation log target, so the NEXT conversation writes a
    // FRESH <id>.json instead of appending to the previous conversation's file.
    // (Without this, consecutive conversations in one session all merged into the
    // first conversation's log — and its id — breaking error correlation.)
    // NOTE: a deferred transcript-cleanup write for the very last exchange
    // (commitExchange's background round-trip) that lands AFTER this reset will
    // start its own new file — a rare split, but no turn is lost.
    currentLogData = null;
    currentLogHandle = null;
    currentLogName = null;
}

async function getConversationsDir() {
    if (!dirHandle) return null;
    if (!conversationDirHandle) {
        conversationDirHandle = await dirHandle.getDirectoryHandle('conversations', { create: true });
    }
    return conversationDirHandle;
}

// Read a saved conversation log back by its id (the `<id>.json` file). Used to
// bundle a conversation's transcript with its errors in a bug report (Ken, July
// 2026). Returns the parsed log object, or null if there's no folder / no such
// file (e.g. the conversation wasn't saved).
export async function readConversationLog(id) {
    if (!id) return null;
    const dir = await getConversationsDir();
    if (!dir) return null;
    try {
        const fh = await dir.getFileHandle(`${id}.json`);
        const file = await fh.getFile();
        return JSON.parse(await file.text());
    } catch {
        return null;
    }
}

export async function startConversationLog() {
    if (!conversationSaving) return null; // this conversation is private — don't record
    const dir = await getConversationsDir();
    if (!dir) return null;

    const now = new Date();
    const id = ensureConversationId();     // shared with the error log
    currentLogName = `${id}.json`;
    currentLogData = {
        id,
        started: now.toISOString(),
        exchanges: []
    };

    currentLogHandle = await dir.getFileHandle(currentLogName, { create: true });
    await flushLog();
    return currentLogName;
}

// `partner`/`feeling` are the situation stamp — the active Partner / Feeling
// toggles at the moment of the turn (Ken, June 2026). Each is null when no toggle
// is active. `partner` = { id: personId|null, label }; `feeling` = { id, text }.
// Stamped on every turn so a Phase-3 review can see who the user was talking to
// and how they felt for each exchange, even as those change mid-conversation.
export async function logPartnerSpeech({ rawTranscript, cleanedTranscript, partner = null }) {
    if (!conversationSaving) return; // private conversation — nothing is written
    if (!currentLogData) await startConversationLog();
    if (!currentLogData) return;

    currentLogData.exchanges.push({
        timestamp: new Date().toISOString(),
        role: 'partner',
        rawTranscript,
        cleanedTranscript,
        partner            // who spoke (the active Partner), or null
    });
    await flushLog();
}

export async function logUserResponse({ selectedText, selectedIndex, allOptions, partner = null, feeling = null }) {
    if (!conversationSaving) return; // private conversation — nothing is written
    // Start the log lazily if this user turn is the FIRST turn of the conversation
    // — an opener (Start conversation) or an Express-panel phrase takes the floor
    // before any partner speech, so the log wouldn't exist yet. Without this, the
    // opening utterance is dropped and a conversation that never reaches a partner
    // turn is never written at all (mirrors logPartnerSpeech). (Ken, July 2026.)
    if (!currentLogData) await startConversationLog();
    if (!currentLogData) return;

    currentLogData.exchanges.push({
        timestamp: new Date().toISOString(),
        role: 'user',
        selectedText,
        selectedIndex,
        allOptions,
        partner,           // who the user was talking with, or null
        feeling            // how the user felt at this turn, or null
    });
    await flushLog();
}

async function flushLog() {
    if (!currentLogHandle || !currentLogData) return;
    try {
        const writable = await currentLogHandle.createWritable();
        await writable.write(JSON.stringify(currentLogData, null, 2));
        await writable.close();
    } catch { /* silent — don't interrupt conversation flow */ }
}

// --- Error log (diagnostics, Ken July 2026) ---
// A persistent record of errors (API failures, JSON parse failures, etc.) so an
// intermittent problem from a live demo leaves a trace we can refer to later —
// previously errors went only to the (now hidden) status bar and the console.
// Two sinks: a capped localStorage ring buffer (always available, shown in
// Settings → About) and an append-only `errors.log` in the data folder (permanent,
// inspectable offline) when a folder is granted. Every entry carries the current
// conversation ID so an error can be matched to its conversation log file.
const ERROR_LOG_KEY = 'aac_error_log';
const ERROR_LOG_MAX = 200;
let appVersion = '';
export function setAppVersion(v) { appVersion = v || ''; }

export function loadErrorLog() {
    try { return JSON.parse(localStorage.getItem(ERROR_LOG_KEY)) || []; }
    catch { return []; }
}

export function clearErrorLog() {
    localStorage.removeItem(ERROR_LOG_KEY);
}

// Record an error. `context` is where it happened (e.g. 'generateOptions'),
// `message` the error text, `extra` any small JSON-able detail (e.g. the partner
// text). Best-effort and never throws — it must not itself break the flow.
export function logError(context, message, extra = null) {
    // Backstop for the per-conversation privacy toggle (SEC-2): the conversation
    // log is gated on `conversationSaving`, but the error sinks (the localStorage
    // ring buffer AND errors.log on disk) are not. Partner speech reaches here via
    // extra.partner (generateOptions), so if the current conversation is private,
    // strip it before it can be persisted — even if a caller forgets to. Keep the
    // error itself (context/message/timestamp); only the captured speech is dropped.
    if (extra && !conversationSaving && Object.prototype.hasOwnProperty.call(extra, 'partner')) {
        extra = { ...extra };
        delete extra.partner;
    }
    const entry = {
        ts: new Date().toISOString(),
        version: appVersion,
        conversation: ensureConversationId(),   // matches the <id>.json log file
        context: String(context || ''),
        message: String(message || ''),
    };
    if (extra != null) entry.extra = extra;
    try {
        const log = loadErrorLog();
        log.push(entry);
        while (log.length > ERROR_LOG_MAX) log.shift();
        localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(log));
    } catch { /* ignore quota/serialize issues */ }
    appendErrorFile(entry);          // fire-and-forget to the data folder (errors.log)
    logErrorToConversation(entry);   // and interleave it into the conversation JSON (Ken)
    try { console.error(`[${entry.context}] ${entry.message}`, extra ?? ''); } catch { /* ignore */ }
    // Let the UI put up a non-verbal heads-up (faint-red transcript) without
    // storage depending on the UI layer. Any logged error trips it.
    try { window.dispatchEvent(new CustomEvent('aac-error-logged', { detail: entry })); } catch { /* non-DOM context */ }
    return entry;
}

// Also record the error INSIDE the current conversation's JSON log, interleaved in
// time order with the turns (Ken, July 2026) — so the conversation file itself
// shows what went wrong and when, not only the separate errors.log. Written as it
// occurs (flushed immediately), so a lock-up/crash can't lose it. Skipped for a
// private (unsaved) conversation, or when no data folder is granted. The error's
// own timestamp (entry.ts) is used, so sorting exchanges by time is exact.
async function logErrorToConversation(entry) {
    if (!conversationSaving || !dirHandle) return;
    try {
        if (!currentLogData) await startConversationLog();
        if (!currentLogData) return;
        currentLogData.exchanges.push({
            timestamp: entry.ts,
            role: 'error',
            context: entry.context,
            message: entry.message,
            version: entry.version,
            ...(entry.extra != null ? { extra: entry.extra } : {}),
        });
        await flushLog();
    } catch { /* best effort — never break the flow */ }
}

async function appendErrorFile(entry) {
    if (!dirHandle) return;
    try {
        const line = `${entry.ts} v${entry.version} conv=${entry.conversation} [${entry.context}] ${entry.message}`
            + (entry.extra ? ` | ${JSON.stringify(entry.extra)}` : '') + '\n';
        const fh = await dirHandle.getFileHandle('errors.log', { create: true });
        const writable = await fh.createWritable({ keepExistingData: true });
        const file = await fh.getFile();
        await writable.seek(file.size);   // append
        await writable.write(line);
        await writable.close();
    } catch { /* best effort — don't interrupt the app */ }
}

// --- Usage tracking ---

export function loadUsage() {
    const settings = loadSettings();
    return {
        inputTokens: settings.usageInputTokens ?? 0,
        outputTokens: settings.usageOutputTokens ?? 0,
        since: settings.usageSince ?? new Date().toISOString()
    };
}

export function addUsageTokens(inputTokens, outputTokens) {
    const settings = loadSettings();
    if (!settings.usageSince) settings.usageSince = new Date().toISOString();
    settings.usageInputTokens = (settings.usageInputTokens ?? 0) + inputTokens;
    settings.usageOutputTokens = (settings.usageOutputTokens ?? 0) + outputTokens;
    saveSettings(settings);
}

export function resetUsage() {
    const settings = loadSettings();
    settings.usageInputTokens = 0;
    settings.usageOutputTokens = 0;
    settings.usageSince = new Date().toISOString();
    saveSettings(settings);
}

export function loadPlaceholderSettings() {
    const settings = loadSettings();
    return {
        initialDelay: settings.initialDelay ?? 4,
        subsequentDelay: settings.subsequentDelay ?? 10,
        // Cap on placeholders spoken per choosing window. Default 2 so the user
        // hears at most one "I heard you" placeholder plus one "still thinking" placeholder
        // — two different roles, never two same-category placeholders back to back.
        // 0 = none (the user finds placeholders artificial/robotic); -1 = no limit.
        maxPlaceholders: settings.maxPlaceholders ?? 2
    };
}

export function savePlaceholderSettings(initialDelay, subsequentDelay, maxPlaceholders) {
    const settings = loadSettings();
    settings.initialDelay = initialDelay;
    settings.subsequentDelay = subsequentDelay;
    if (maxPlaceholders !== undefined) settings.maxPlaceholders = maxPlaceholders;
    saveSettings(settings);
}
