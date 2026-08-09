/* Weekly report — the automatic send that keeps a tester's workload at zero.
 *
 * Ken, August 7 2026: "I want the workload of the testers to be as low as possible
 * and the data collection to be as high as possible." A tester who has to remember
 * to export something will not, and the tester who stops using the app — the one
 * most worth hearing from — will certainly not.
 *
 * WHEN. On app start, if the send is enabled and 7+ days have passed. No background
 * machinery and no service-worker scheduling: opening the app is the only moment we
 * know they are still using it. The FIRST send fires at first launch rather than on
 * day 7, so the pipe is proven while the tester is still sitting there during setup
 * instead of being discovered as broken three weeks later.
 *
 * ⚠ THE PRIVACY RULES, enforced here rather than left to callers:
 *   1. NO TRANSCRIPTS. Not from the saved conversations, not from the live session.
 *   2. `extra` IS STRIPPED FROM EVERY ERROR ENTRY. This is the one that needs care:
 *      logError's `extra.partner` carries partner speech, and it is only redacted
 *      today when the conversation was marked private — for an ordinary
 *      conversation it is there. An automatic send must never carry it.
 *   3. NEITHER API KEY, via storage.reportableSettings().
 *   Residual, accepted and recorded: an error MESSAGE is an app-generated string
 *   ("API error 429: ..."), but a parse failure could in principle quote model
 *   output, which is text generated about the conversation. Messages are capped at
 *   MAX_MESSAGE chars. If that is ever judged too loose, the fallback is to send
 *   error CONTEXTS and COUNTS only and get messages from a manual report.
 *
 * ⚠ NO DELIVERY CONFIRMATION. Apps Script cannot satisfy a CORS preflight, so the
 * POST goes with mode:'no-cors' and Content-Type:'text/plain' (a "simple request").
 * An opaque response cannot be read, so "sent" means HANDED TO THE NETWORK, not
 * received. This is survivable because the failure that actually happens — being
 * offline — still REJECTS, so the queue retries; only a server-side rejection is
 * invisible, and a missing week shows up in the Sheet at Ken's end.
 */
import * as storage from './storage.js';
import * as diagnostics from './diagnostics.js';
import { summarize } from './usage-summary.js';

// The Apps Script web app that receives reports (scripts/weekly-report-endpoint.gs).
// ⚠ An empty string makes the sender INERT — payloads still build, queue and log, but
// nothing leaves the device — so blanking this is the way to disarm every copy at the
// next release. ⚠ Add this origin to the CSP `connect-src` when SEC-3 lands, or sends
// will start failing silently.
export const ENDPOINT = 'https://script.google.com/macros/s/AKfycbx1Y_slFybVpzX3V2YobzgfVFEvoaWUj21zswIodfyuTlsAUHIv25YkPGepYHnCRBqqLA/exec';
// ⚠ THIS IS NOT A SECRET AND MUST NEVER BE TREATED AS ONE. It ships in the app, so
// anyone who opens the site can read both it and the address above. All it buys is
// that filling the Sheet with junk takes deliberate effort rather than a stray POST
// to a discovered URL; if that ever happens, change it here AND in the Apps Script,
// redeploy both, and the old value stops working. It protects nothing already in the
// Sheet — the payload carries a tester's name, so the Sheet is confidential
// regardless. Must match SECRET in scripts/weekly-report-endpoint.gs, and a mismatch
// is SILENT at the app: the server answers "bad secret" and the app cannot read the
// answer, so the only symptom is reports quietly not arriving.
export const SHARED_SECRET = 'u_mlqOZgElbxCB7732CAwSzC';

const INTERVAL_DAYS = 7;
const QUEUE_MAX = 8;          // a tester offline for two months must not grow it forever
const MAX_MESSAGE = 200;      // see the residual note above
const MAX_ERRORS = 200;

/* ── The disclosure ──────────────────────────────────────────────────────────
 * Ken: users should be able to find out WHAT is in a weekly report, but do not
 * need to see their own data. So this is a description of the CATEGORIES, not a
 * dump — and it is the canonical key list, which `assemblePayload` is tested
 * against. That test is what makes the description true rather than merely
 * reassuring: with no raw payload view, this text IS the disclosure, so the first
 * change that adds a field would otherwise turn it into a quiet lie that nobody
 * re-reads. */
export const PAYLOAD_FIELDS = {
    testerName: 'The name we gave you, so we know who to thank',
    installId: 'A code for this device, so reports from it can be grouped',
    appVersion: 'Which version of the app you are running',
    build: 'Which build of the app you are running',
    sentAt: 'When the report was sent',
    coversDays: 'How many days the report covers',
    usage: 'Counts and timings: how many conversations, how often a suggestion fitted, how long people waited',
    errors: 'Which errors happened and when — never what was being said at the time',
    systemInfo: 'Your screen, browser and settings. Sent only when something changes.',
};

export function describeReport() {
    const rows = Object.values(PAYLOAD_FIELDS)
        .map((text, i) => `  ${String(i + 1).padStart(2)}. ${text}`);
    return [
        'Each weekly report contains:',
        '',
        ...rows,
        '',
        'NEVER included:',
        '  - Anything you or the other person said. No transcripts, ever.',
        '  - Your API keys. The report says whether a key is set, and nothing more.',
        '',
        'Reports are sent about once a week, when you open the app.',
        'You can turn them off above; the app works exactly the same either way.',
    ].join('\n');
}

/* ── Pure decisions (unit-tested) ─────────────────────────────────────────── */

/* First launch (lastAt 0) sends immediately — see the header. Disabled always wins.
 *
 * A CHANGED ADDRESS ALSO SENDS, and that clause is doing more than it looks. The week
 * is marked done on ENQUEUE, so a build that could not send anything still marked it —
 * which is exactly what 0.7.0 did, shipping with no address while running this routine
 * on every launch. Without this, every existing tester would update, type their name,
 * and then see nothing for up to a week, with no way for them or for us to tell setup
 * from breakage. Sending on the change makes the very first launch after an update
 * prove the whole path, which is the only moment anyone is watching.
 *
 * `lastEndpoint` is null when never recorded and '' when recorded by an unarmed build;
 * both differ from a real address, so both trigger. A build with no address never
 * forces a send — there is nowhere for it to go, and forcing one would rebuild a
 * payload on every single launch. */
export function shouldSend({ enabled, lastAt, now, intervalDays = INTERVAL_DAYS, endpoint = '', lastEndpoint = null }) {
    if (!enabled) return false;
    if (!lastAt) return true;
    if (endpoint && endpoint !== lastEndpoint) return true;
    return (now - lastAt) >= intervalDays * 86400000;
}

export function enqueue(queue, payload, max = QUEUE_MAX) {
    const q = [...(queue || []), payload];
    // Drop the OLDEST on overflow: a stale week matters less than the current one,
    // and the summary is cumulative anyway so little is actually lost.
    while (q.length > max) q.shift();
    return q;
}

// Strip `extra` outright — see privacy rule 2. Keeping a subset would mean every
// future caller of logError has to think about it; dropping the field means none do.
export function redactErrors(entries, { maxMessage = MAX_MESSAGE, max = MAX_ERRORS } = {}) {
    if (!Array.isArray(entries)) return [];
    return entries.slice(-max).map(e => ({
        ts: e && e.ts || null,
        conversation: e && e.conversation || null,
        context: e && e.context || null,
        message: typeof (e && e.message) === 'string' ? e.message.slice(0, maxMessage) : null,
    }));
}

// Cheap non-cryptographic hash — this only has to notice CHANGE, not resist attack.
export function hashOf(obj) {
    const s = JSON.stringify(obj);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h >>> 0);
}

// Keys must match PAYLOAD_FIELDS exactly — asserted by the drift test.
export function assemblePayload({ testerName, installId, appVersion, build, now, coversDays, usage, errors, systemInfo }) {
    return {
        testerName: testerName || '',
        installId: installId || '',
        appVersion: appVersion || '?',
        build: build || '?',
        sentAt: new Date(now || Date.now()).toISOString(),
        coversDays: coversDays ?? null,
        usage: usage || null,
        errors: errors || [],
        systemInfo: systemInfo || null,   // null when unchanged since the last send
    };
}

/* ── Effects ─────────────────────────────────────────────────────────────── */

async function gatherPayload({ appVersion, build, now }) {
    let usage = null;
    try { usage = summarize(await storage.listConversationLogs()); } catch { /* leave null */ }
    const errors = redactErrors(storage.loadErrorLog());
    let systemInfo = null;
    try {
        const info = await diagnostics.collectSystemInfo({ appVersion, buildId: build });
        const h = hashOf(info);
        if (h !== storage.loadWeeklyInfoHash()) {
            systemInfo = info;
            storage.saveWeeklyInfoHash(h);
        }
    } catch { /* leave null */ }
    const lastAt = storage.loadWeeklySendLastAt();
    return assemblePayload({
        testerName: storage.loadTesterName(),
        installId: storage.loadInstallId(),
        appVersion, build, now,
        coversDays: lastAt ? Math.round((now - lastAt) / 86400000) : null,
        usage, errors, systemInfo,
    });
}

async function post(payload) {
    if (!ENDPOINT) return 'not configured';
    // 'no-cors' + text/plain keeps this a simple request, avoiding the preflight
    // Apps Script cannot answer. The response is opaque, so reaching here means the
    // request left the device — not that it arrived.
    await fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ secret: SHARED_SECRET, ...payload }),
    });
    return 'sent';
}

/* Try to send everything queued. Each success is logged for the tester to read
 * back; the first network failure stops the run and leaves the rest queued, so a
 * flaky connection does not burn through the queue reporting failures. */
export async function flush() {
    let queue = storage.loadWeeklyQueue();
    if (!queue.length) return { sent: 0, queued: 0 };
    let sent = 0;
    while (queue.length) {
        const payload = queue[0];
        let outcome;
        try {
            outcome = await post(payload);
        } catch {
            // Offline or blocked. Keep it — this is the failure the queue exists for.
            storage.saveWeeklyQueue(queue);
            storage.appendWeeklySendLog({ at: new Date().toISOString(), bytes: JSON.stringify(payload).length, outcome: 'waiting for a connection' });
            return { sent, queued: queue.length };
        }
        queue = queue.slice(1);
        storage.saveWeeklyQueue(queue);
        storage.appendWeeklySendLog({ at: new Date().toISOString(), bytes: JSON.stringify(payload).length, outcome });
        if (outcome === 'sent') sent++;
        else break;   // 'not configured' — no point retrying the rest this run
    }
    return { sent, queued: queue.length };
}

/* The app-start hook. Never throws and never blocks startup: a diagnostic that can
 * break the app it is reporting on is worse than no diagnostic. */
export async function maybeSend({ appVersion, build, now = Date.now() } = {}) {
    try {
        if (!shouldSend({
            enabled: storage.loadWeeklySendEnabled(),
            lastAt: storage.loadWeeklySendLastAt(),
            now,
            endpoint: ENDPOINT,
            lastEndpoint: storage.loadWeeklyEndpoint(),
        })) {
            // Still flush anything stranded from a previous week.
            return await flush();
        }
        const payload = await gatherPayload({ appVersion, build, now });
        storage.saveWeeklyQueue(enqueue(storage.loadWeeklyQueue(), payload));
        // Mark the week done on ENQUEUE, not on send: the queue owns delivery from
        // here, and re-marking on every launch while offline would build one payload
        // per launch instead of one per week.
        storage.saveWeeklySendLastAt(now);
        // Recorded beside the date, and for the same reason: together they mean "a
        // report was prepared, on this date, for this address". Recording it here
        // rather than after a successful post is deliberate — delivery is unknowable
        // (the response is opaque), so a send-time record would never be written.
        storage.saveWeeklyEndpoint(ENDPOINT);
        return await flush();
    } catch {
        return { sent: 0, queued: 0 };
    }
}

export function formatSendLog(entries) {
    if (!entries || !entries.length) return 'Nothing sent yet.';
    return entries.slice().reverse().map(e => {
        const when = e.at ? new Date(e.at).toLocaleString() : '?';
        const kb = e.bytes ? `${(e.bytes / 1024).toFixed(1)} KB` : '?';
        return `${when}   ${String(kb).padStart(9)}   ${e.outcome || '?'}`;
    }).join('\n');
}
