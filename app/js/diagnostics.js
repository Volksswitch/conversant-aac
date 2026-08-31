/* Diagnostics — the system-info block and the problem report a tester sends back.
 *
 * WHY THIS EXISTS (CLAUDE.md, "Beta instrumentation and error reporting"): the app
 * has no backend and no telemetry by design, which is the property that lets it
 * outlive the funded AAC projects that were shelved. So the only channel for
 * learning anything about a tester's setup is the tester themselves, on a tablet
 * with no console. Everything we would otherwise have to ask them by hand — which
 * dock, which browser, what the viewport is — is gathered here instead.
 *
 * THE GAP IT CLOSES: `logError` only fires when something THROWS. Most of what
 * testers actually hit is "it behaved wrong but didn't throw" — a silent stall,
 * options that missed, a dead button — which logs nothing at all. A report the user
 * initiates is the only sensor for that class, and the free-text note is the part
 * that carries the information.
 *
 * TWO RULES, both non-negotiable and both enforced here rather than left to callers:
 *   1. NEITHER API KEY, ever. Not redacted, not truncated — absent. Same exclusion
 *      the settings profiles enforce (SEC-6), for the same reason: a report is
 *      mailed around and pasted into places nobody is tracking.
 *   2. A PRIVATE CONVERSATION'S WORDS NEVER APPEAR. The per-conversation "Don't
 *      save" toggle already keeps them off disk; a report that scooped them out of
 *      memory would quietly defeat it (SEC-2).
 */
import * as storage from './storage.js';
import * as platform from './platform.js';
import * as viewport from './viewport.js';
import * as stt from './stt.js';
import * as worldview from './worldview.js';
import * as relationships from './relationships.js';
import * as places from './places.js';
import * as expressPanel from './express-panel.js';
import * as expressItems from './express-items.js';
import * as controlPhrases from './control-phrases.js';
import * as voiceProfile from './voice.js';

// Key redaction lives in storage.reportableSettings(), NOT here: that module owns
// the keys, so the raw bundle is never handed to this one and no future caller can
// forget to strip it.
function safeSettings() {
    try { return storage.reportableSettings(); } catch { return { '(unreadable)': true }; }
}

async function storageInfo() {
    const info = { backend: platform.isIOS() ? 'app-private storage' : 'data folder', folder: false, persisted: null, quotaMB: null, usageMB: null };
    try { info.folder = storage.hasDataFolder(); } catch { /* ignore */ }
    // What the reconnect did, step by step. Whether the app got back into the user's
    // folder is one of the few things that changes what every other number here
    // means, and until this existed the answer had to be guessed at from symptoms.
    try { info.reconnect = storage.folderReconnectTrace() || '(nothing recorded)'; } catch { /* ignore */ }
    try {
        if (navigator.storage && navigator.storage.persisted) info.persisted = await navigator.storage.persisted();
        if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            if (est.quota) info.quotaMB = Math.round(est.quota / 1048576);
            if (est.usage) info.usageMB = Math.round((est.usage / 1048576) * 100) / 100;
        }
    } catch { /* ignore */ }
    return info;
}

/* The structured snapshot. Everything is best-effort: a diagnostic that throws
 * while collecting is worse than one with a gap in it, because it fires exactly
 * when the app is already misbehaving. */
export async function collectSystemInfo({ appVersion = '?', buildId = '?' } = {}) {
    const info = {
        app: { version: appVersion, build: buildId, url: location.href },
        when: new Date().toISOString(),
        platform: {}, display: {}, speech: {}, storage: {}, settings: {},
    };
    // ⚠ describe() returns a STRING, so it must go UNDER a key, never become the
    // block itself. Assigning it directly cost three facts at once and reported none
    // of them: block() walked the string with Object.entries and printed it one
    // character per line, and the next assignment threw (a module is strict mode, so
    // adding a property to a string primitive is a TypeError) — taking the whole try
    // block with it, including info.speech.recognition, the one field a "it can't
    // hear me" report turns on.
    try { info.platform = { summary: platform.describe() }; } catch { info.platform = { error: 'unavailable' }; }
    try {
        info.platform.standalone = platform.isStandalone();
        info.platform.iosShell = platform.iosBrowserShell();
        const sr = platform.speechRecognitionSupport();
        info.speech.recognition = { apiPresent: sr.apiPresent, usable: sr.usable, reason: sr.reason || null };
    } catch { /* ignore */ }
    try { info.display = viewport.getMetrics(); } catch { info.display = { error: 'unavailable' }; }
    try {
        info.speech.sttProvider = storage.loadSttProvider ? storage.loadSttProvider() : '(n/a)';
        info.speech.ttsProvider = storage.loadTtsProvider ? storage.loadTtsProvider() : '(n/a)';
    } catch { /* ignore */ }
    // How listening actually behaved, including across being backgrounded. The
    // failure worth catching here is silent - a lit microphone that is hearing
    // nothing - so the numbers are the only way anyone can report it.
    try { info.speech.listening = stt.listenActivity(); } catch { /* ignore */ }
    try {
        // The voice roster answers "why is my voice not in the list", which has no
        // other route on a device with no console. Names only — no settings, no
        // personal data. (This is where the removed About-tab readout returns.)
        const voices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
        info.speech.voiceCount = voices.length;
        info.speech.voices = voices.map(v => `${v.name} [${v.lang}] ${v.voiceURI}`);
    } catch { /* ignore */ }
    info.storage = await storageInfo();
    info.settings = safeSettings();
    return info;
}

/* HOW MUCH OF THE APP THE TESTER HAS MADE THEIR OWN.
 *
 * Every number here already exists in a saved file — nothing new is measured, and
 * nothing here needs the tester to do anything. It is gathered in this module rather
 * than in usage-summary because it reaches across six stores, and usage-summary is
 * deliberately pure so that it can be unit-tested against fixtures.
 *
 * ⚠ IT IS AN ENGAGEMENT MEASURE, AND PROBABLY A LEADING ONE (Ken). Editing your own
 * phrases in week one is investment, and it shows before any conversation number can.
 * It also splits a poor result in two: suggestions ignored by someone with an empty
 * profile is an ONBOARDING problem, and the same result with a full profile is a
 * GENERATOR problem. Those need completely different work and are indistinguishable
 * without this — which is why it is worth gathering even though it counts no events.
 *
 * Every reader is wrapped: these modules read caches that may not have loaded yet,
 * and a report that throws is worse than a report with a gap in it.
 */
export function collectPersonalization() {
    const out = {
        worldviewAnswered: 0, worldviewTotal: 0,
        people: 0, places: 0,
        expressEdited: 0, expressTotal: 0,
        controlPhrasesEdited: 0,
        soundCheckAnswered: 0,
        settingsProfiles: 0,
    };
    try {
        for (const m of worldview.getModules()) {
            out.worldviewAnswered += m.answered || 0;
            out.worldviewTotal += m.total || 0;
        }
    } catch { /* registry may not be loaded */ }
    try { out.people = relationships.count(); } catch { /* ignore */ }
    try { out.places = places.count(); } catch { /* ignore */ }
    try {
        const items = expressPanel.allItems() || [];
        // An undefined cell is not a phrase, so it counts towards neither figure —
        // otherwise a panel padded out to reach cell twelve would look half filled in.
        const real = items.filter(i => !expressItems.isEmptyItem(i));
        out.expressTotal = real.length;
        // Only items the user added or changed. Counting the shipped defaults would
        // report a tester who has touched nothing as fully personalized, and would
        // put "Yes", "No" and "Thank you" forward as this person's characteristic
        // vocabulary.
        out.expressEdited = real.filter(i => expressItems.isUserAuthored(i)).length;
    } catch { /* ignore */ }
    try {
        const p = controlPhrases.getPhrases();
        const d = controlPhrases.DEFAULTS;
        // Compared against the shipped text rather than counted, because the lists are
        // seeded from the defaults: a tester who has changed nothing has the full set.
        for (const k of ['holdOn']) {
            if (p[k] && d[k] && p[k] !== d[k]) out.controlPhrasesEdited++;
        }
        for (const k of ['openers', 'windDowns', 'closings', 'pardon', 'declineClosing']) {
            const mine = new Set(p[k] || []);
            for (const phrase of (d[k] || [])) mine.delete(phrase);
            out.controlPhrasesEdited += mine.size;
        }
    } catch { /* ignore */ }
    try { out.soundCheckAnswered = voiceProfile.answeredCount(); } catch { /* ignore */ }
    return out;
}

// The profile list needs the data folder, so it is awaited separately and folded in
// by the caller rather than making the whole collector async for one number.
export async function countSettingsProfiles() {
    try { return (await storage.listSettingsProfiles()).length; } catch { return 0; }
}

function block(title, obj, indent = '  ') {
    const lines = [title];
    const walk = (o, pad) => {
        for (const [k, v] of Object.entries(o || {})) {
            if (v && typeof v === 'object' && !Array.isArray(v)) { lines.push(`${pad}${k}:`); walk(v, pad + '  '); }
            else if (Array.isArray(v)) {
                lines.push(`${pad}${k}: ${v.length} item(s)`);
                for (const item of v.slice(0, 80)) lines.push(`${pad}  ${item}`);
                if (v.length > 80) lines.push(`${pad}  … ${v.length - 80} more`);
            } else lines.push(`${pad}${k}: ${v}`);
        }
    };
    walk(obj, indent);
    return lines.join('\n');
}

export function formatSystemInfo(info) {
    return [
        block('APP', info.app),
        `  generated: ${info.when}`,
        '',
        block('PLATFORM', info.platform),
        '',
        block('DISPLAY', info.display),
        '',
        block('SPEECH', info.speech),
        '',
        block('STORAGE', info.storage),
        '',
        block('SETTINGS', info.settings),
    ].join('\n');
}

/* Assemble the full problem report. `note` is the tester's own words and is put
 * FIRST, because it is the only part that says what actually went wrong — everything
 * below it is context for a claim the note makes.
 *
 * `errorReport` and `usageText` are passed in rather than gathered here so this
 * module stays free of app.js's conversation state; app.js owns the SEC-2 decision
 * about whether a live private transcript may be included. */
export async function buildProblemReport({ note, appVersion, buildId, errorReport = '', usageText = '', recentEvents = '' }) {
    const info = await collectSystemInfo({ appVersion, buildId });
    const trimmed = (note || '').trim();
    return [
        'CONVERSANT AAC — PROBLEM REPORT',
        `Generated: ${info.when}`,
        `Version: ${appVersion} (build ${buildId})`,
        '',
        'WHAT HAPPENED (in the tester\'s words)',
        trimmed ? trimmed.split('\n').map(l => '  ' + l).join('\n') : '  (nothing written)',
        '',
        '════════ USAGE SUMMARY ════════',
        usageText || '(none)',
        '',
        '════════ ERRORS AND TRANSCRIPTS ════════',
        errorReport || '(no errors recorded)',
        '',
        // WHAT WAS HAPPENING JUST BEFORE. Most of what testers hit does not throw — a
        // silent stall, options that missed, a button that did nothing — so there is
        // no error to read and the tester's note is the only account of it. This is
        // the sequence of what they actually did, in counts and durations, which is
        // what turns "it stopped working" into something reproducible. Words never
        // appear in it: metrics.js drops anything that is not a count, a duration or
        // a small category before it is recorded.
        '════════ WHAT HAPPENED JUST BEFORE (no words) ════════',
        recentEvents || '(nothing recorded)',
        '',
        '════════ SYSTEM INFORMATION ════════',
        formatSystemInfo(info),
        '',
        '(No API keys are included in this report.)',
    ].join('\n');
}
