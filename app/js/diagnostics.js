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

// Key redaction lives in storage.reportableSettings(), NOT here: that module owns
// the keys, so the raw bundle is never handed to this one and no future caller can
// forget to strip it.
function safeSettings() {
    try { return storage.reportableSettings(); } catch { return { '(unreadable)': true }; }
}

async function storageInfo() {
    const info = { backend: platform.isIOS() ? 'app-private storage' : 'data folder', folder: false, persisted: null, quotaMB: null, usageMB: null };
    try { info.folder = storage.hasDataFolder(); } catch { /* ignore */ }
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
    try { info.platform = platform.describe(); } catch { info.platform = { error: 'unavailable' }; }
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
export async function buildProblemReport({ note, appVersion, buildId, errorReport = '', usageText = '' }) {
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
        '════════ SYSTEM INFORMATION ════════',
        formatSystemInfo(info),
        '',
        '(No API keys are included in this report.)',
    ].join('\n');
}

// yyyy-mm-dd-hhmm, for a filename a tester can tell apart from the last one.
export function reportFilename(now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `conversant-problem-report-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.txt`;
}
