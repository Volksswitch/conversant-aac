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
import * as metrics from './metrics.js';
import { summarize, summarizePersonalization } from './usage-summary.js';

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

/* IS THIS COPY BEING SERVED LOCALLY - i.e. a build somebody is developing or testing,
 * rather than the app a tester actually uses?
 *
 * (!) WHY THIS EXISTS, measured September 4 2026. Eleven anonymous rows appeared on the
 * retention tab days after the Sheet had been cleared for the first beta tester, under a
 * tester name nobody had set. They came from `serve.bat`: a locally-served copy runs on a
 * different address, so the browser treats it as a different site entirely - its own
 * settings, so no tester name; its own identity, so its own installation id - while the
 * data folder it is pointed at is the real one, holding months of real conversations. One
 * such report re-created a whole retention curve belonging to nobody.
 *
 * ⚠ THE AUGUST 31 GATE DOES NOT COVER THIS, which is why a second guard is needed rather
 * than a tightening of the first. That one withholds a FIRST report until the copy has
 * actually been used; once a local copy has reported even once, the weekly interval takes
 * over and the activity check is never consulted again. So the noise stops for one launch
 * and resumes for every launch after.
 *
 * ⚠ AND IT COST A REAL FALSE ALARM, which is the reason it is worth closing rather than
 * filtering: the retention tab carries no build column, so unlike the other two tabs there
 * is nothing on it that says "dev". An anonymous row there is indistinguishable from a
 * tester who has not typed their name, and the natural response is to go and nudge a
 * tester who has done nothing wrong.
 *
 * Private network addresses count as local too, and deliberately: testing a local build on
 * the tablet means pointing it at this machine's address on the network, which is the same
 * build with the same absent tester name. The real app is only ever served over https from
 * its own domain, so nothing a tester runs can match any of these.
 */
export function isLocalOrigin(loc = (typeof location === 'undefined' ? null : location)) {
    if (!loc) return false;
    if (loc.protocol === 'file:') return true;
    const h = String(loc.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!h) return true;                                    // opened from disk
    if (h === 'localhost' || h.endsWith('.localhost')) return true;
    if (h === '::1' || h === '0.0.0.0') return true;
    if (/^127\./.test(h)) return true;                      // loopback
    if (/^10\./.test(h)) return true;                       // private network
    if (/^192\.168\./.test(h)) return true;                 // private network
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;  // private network
    if (/^169\.254\./.test(h)) return true;                 // link-local
    return false;
}

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
    weeks: 'The same counts broken down by week, so we can see how things change',
    events: 'Counts of what was tapped and how long things took. No words, ever.',
    personalization: 'How much you have filled in and made your own — counts only, never the content',
    errors: 'Which errors happened since the last report, and when — never what was being said at the time',
    systemInfo: 'Your screen, browser and settings',
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
export function shouldSend({ enabled, lastAt, now, intervalDays = INTERVAL_DAYS, endpoint = '', lastEndpoint = null, hasActivity = true, local = false }) {
    // First, and ahead of the switch: a locally-served build has no tester behind
    // it, so its report is noise by construction. See isLocalOrigin.
    if (local) return false;
    if (!enabled) return false;
    if (!lastAt) return hasActivity;
    if (endpoint && endpoint !== lastEndpoint) return true;
    return (now - lastAt) >= intervalDays * 86400000;
}

/* Has this installation actually been USED, or merely opened?
 *
 * (!) WHY THIS EXISTS, measured August 31 2026: 25 of the 29 reports in the Sheet were
 * not from testers at all. They came from development launches - the preview pane and
 * headless test browsers - each of which starts with empty storage, so each looked
 * like a brand-new install, took the first-launch shortcut above, and posted a report
 * nobody wanted. Ten of them reported a screen of 0x0. Six arrived in one day. They
 * outnumbered the real reports six to one and polluted every pooled figure.
 *
 * The first-launch shortcut is still right for a real tester - waiting a week to find
 * out whether reporting works at all would be worse - so it is kept and qualified:
 * a first report goes when there is something in it. Later reports are unaffected,
 * because by then the interval governs and this is never consulted.
 *
 * Read from the event tally rather than from the saved conversations, because it is
 * local, cheap and needs no data folder. Metrics run on the same switch as reporting
 * (app.js sets them from loadWeeklySendEnabled), so a tester who reports has them. */
const ACTIVITY_EVENTS = [metrics.EV.CONVERSATION_STARTED, metrics.EV.CARD_SELECTED, metrics.EV.COMPOSER_SPOKEN, metrics.EV.EXPRESS_PHRASE];

export function hasActivity(totals) {
    const t = totals || {};
    return ACTIVITY_EVENTS.some(name => (t[name] || 0) > 0);
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
/* The errors a report should carry: those recorded since the last one went.
 *
 * ⚠ THE MARK IS A TIMESTAMP, NOT A COUNT, because the ring buffer drops its oldest
 * entries at 200 — an index would slide underneath itself and silently re-send.
 *
 * An entry with no timestamp is treated as NEW. It should not happen (logError always
 * stamps one), and the failure directions are not equal: sending a duplicate is noise,
 * while dropping a real error loses the only record that it happened.
 */
export function errorsSince(entries, mark) {
    if (!Array.isArray(entries)) return [];
    if (!mark) return entries;
    return entries.filter(e => !(e && e.ts) || e.ts > mark);
}

/* The newest timestamp in a set, for marking what has just been sent. Returns the
 * previous mark when there is nothing newer, so an empty week cannot move it
 * backwards. */
export function newestErrorTs(entries, fallback = '') {
    let out = fallback;
    for (const e of entries || []) {
        if (e && typeof e.ts === 'string' && e.ts > out) out = e.ts;
    }
    return out;
}

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
export function assemblePayload({ testerName, installId, appVersion, build, now, coversDays,
                                  usage, weeks, events, personalization, errors, systemInfo }) {
    return {
        testerName: testerName || '',
        installId: installId || '',
        appVersion: appVersion || '?',
        build: build || '?',
        sentAt: new Date(now || Date.now()).toISOString(),
        coversDays: coversDays ?? null,
        usage: usage || null,
        // Sent as its own field rather than left inside `usage` because it is the one
        // thing a cumulative summary can never show, and because it is what gets read
        // first at the other end: a missing week is what quietly stopping looks like.
        weeks: weeks || [],
        events: events || null,
        personalization: personalization || null,
        errors: errors || [],
        systemInfo: systemInfo || null,   // null when unchanged since the last send
    };
}

/* ── Effects ─────────────────────────────────────────────────────────────── */

async function gatherPayload({ appVersion, build, now }) {
    let usage = null;
    try { usage = summarize(await storage.listConversationLogs()); } catch { /* leave null */ }
    // The weekly buckets ride separately, and `usage.weeks` is dropped from the
    // cumulative block so the same rows are not sent twice in one payload.
    const weeks = (usage && usage.weeks) || [];
    if (usage) delete usage.weeks;
    let events = null;
    try { events = metrics.snapshot(); } catch { /* leave null */ }
    let personalization = null;
    try {
        personalization = summarizePersonalization({
            ...diagnostics.collectPersonalization(),
            settingsProfiles: await diagnostics.countSettingsProfiles(),
        });
    } catch { /* leave null */ }
    // Only what has happened since the last report. The mark is advanced when the
    // payload is ENQUEUED rather than when it is delivered, for the same reason the
    // week itself is: the queue owns delivery from here, and re-marking on every
    // launch while offline would send the same errors again and again.
    const allErrors = storage.loadErrorLog();
    const fresh = errorsSince(allErrors, storage.loadWeeklyErrorMark());
    const errors = redactErrors(fresh);
    storage.saveWeeklyErrorMark(newestErrorTs(fresh, storage.loadWeeklyErrorMark()));
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
        usage, weeks, events, personalization, errors, systemInfo,
    });
}

/* Hand one report to the endpoint and find out what it did with it.
 *
 * (!) THIS READS THE REPLY, AND THAT IS A CHANGE WORTH UNDERSTANDING (August 31 2026).
 * It used to post with mode 'no-cors' on the belief that Apps Script could not answer
 * a cross-origin request, which made the response opaque: every send looked like a
 * success, including the ones the far end threw away. That is exactly how reports were
 * lost silently for six days in August - the endpoint was refusing every one of them
 * and nothing anywhere could tell.
 *
 * MEASURED against the live endpoint rather than assumed: a POST with mode 'cors' and
 * Content-Type text/plain comes back status 200, type 'cors', with the body readable.
 * text/plain keeps it a SIMPLE request, so no preflight is involved - which is the
 * thing Apps Script genuinely cannot answer, and the reason the old belief was half
 * right. Do not add a custom header here: that would trigger a preflight and put the
 * blindness back.
 *
 * The contract is the endpoint's own: 'ok' means written, anything else ('bad secret',
 * 'no body', 'error: ...') means it was not. A body we do not recognise counts as a
 * refusal, because the alternative is to call an unknown answer a success - which is
 * the failure this whole change exists to remove.
 *
 * If the endpoint is ever redeployed without CORS the fetch will simply reject, which
 * is handled as "no connection": kept and retried, never dropped. */
async function post(payload) {
    if (!ENDPOINT) return 'not configured';
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ secret: SHARED_SECRET, ...payload }),
    });
    let body = '';
    try { body = (await res.text()).trim(); } catch { /* unreadable - treat as refused */ }
    if (res.ok && body === 'ok') return 'sent';
    return `refused: ${body || res.status}`;
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
        // (!) ONLY AN ACCEPTED REPORT LEAVES THE QUEUE. Anything else is KEPT and
        // tried again next launch. The old code sliced the payload off before
        // checking the outcome, so a report the endpoint had not taken was thrown
        // away - the one thing a queue exists to prevent. It could not bite while
        // every send was reported as a success; now that refusals are visible, it
        // would have become the way reports are lost.
        //
        // A permanently refused report does sit at the head and block the rest, but
        // it cannot do so forever: enqueue() drops the OLDEST on overflow, so a stuck
        // head is evicted in time rather than jamming the queue for good.
        if (outcome !== 'sent') {
            storage.appendWeeklySendLog({ at: new Date().toISOString(), bytes: JSON.stringify(payload).length, outcome });
            return { sent, queued: queue.length };
        }
        queue = queue.slice(1);
        storage.saveWeeklyQueue(queue);
        storage.appendWeeklySendLog({ at: new Date().toISOString(), bytes: JSON.stringify(payload).length, outcome });
        sent++;
    }
    return { sent, queued: queue.length };
}

/* The app-start hook. Never throws and never blocks startup: a diagnostic that can
 * break the app it is reporting on is worse than no diagnostic. */
export async function maybeSend({ appVersion, build, now = Date.now() } = {}) {
    try {
        // Only consulted for a first-ever report; see hasActivity. Read defensively
        // because a diagnostic must never be the thing that breaks the launch.
        let used = true;
        try { used = hasActivity((metrics.snapshot() || {}).totals); } catch { used = true; }
        if (!shouldSend({
            enabled: storage.loadWeeklySendEnabled(),
            lastAt: storage.loadWeeklySendLastAt(),
            now,
            endpoint: ENDPOINT,
            lastEndpoint: storage.loadWeeklyEndpoint(),
            hasActivity: used,
            local: isLocalOrigin(),
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

/* ── Sending a problem report on demand (Ken, August 21 2026) ────────────────
 *
 * Ken's objection to the Save-to-a-file route was about tester workload: saving a
 * file leaves the tester to find it and decide what to do with it, and Copy assumes
 * somewhere to paste. Both are real work at the worst possible moment. This reuses
 * the weekly path end to end — same address, same shared secret, same queue, same
 * log — so a report survives being written while offline and goes out on the next
 * launch, exactly as a weekly report does.
 *
 * ⚠ THIS PAYLOAD IS THE ONE EXCEPTION TO "NEVER SEND WHAT WAS SAID". The report text
 * carries transcripts of the conversations that hit errors (buildErrorReport puts
 * them there, withholding any conversation the user marked private). That is allowed
 * ONLY because it is the standing carve-out for a report the tester deliberately
 * sends after seeing it — never as part of anything automatic. So:
 *   - nothing here is ever called from maybeSend or from any timer;
 *   - the caller MUST show the tester the exact text and take a confirmation first.
 * If either of those ever stops being true, this stops being permissible.
 *
 * Save to a file and Copy stay exactly as they were: this is a third route, not a
 * replacement, and it is the only one that needs the network.
 *
 * ⚠ DELIBERATELY NOT GATED ON `loadWeeklySendEnabled`. That switch governs what the
 * app does BY ITSELF — the automatic weekly report and the counting behind it — and a
 * tester who turns it off has asked not to be reported on in the background, not to be
 * prevented from telling us something. Refusing to send a report they wrote, read and
 * confirmed would be answering a question they did not ask, and the failure would look
 * like the button being broken. The Beta Test Plan says so in section 8.
 */
export async function sendProblemReport({ note = '', report = '', appVersion = '', build = '', now = Date.now() } = {}) {
    // ⚠ THE LOCAL GUARD DOES APPLY HERE, and for a different reason than the one the
    // paragraph above refuses. That refusal is about a PREFERENCE: a tester who turned
    // background reporting off has not asked to be silenced when they choose to write to
    // us. This is about there being no tester at all — a locally-served build is a
    // developer's copy, and its report would arrive nameless in the tab that carries the
    // most sensitive content in the Sheet. It is reported back plainly rather than
    // swallowed, because a Send button that appears to do nothing is its own bug.
    if (isLocalOrigin()) return { sent: 0, queued: 0, blocked: 'local' };
    const payload = {
        // `kind` is what lets the receiver tell this from a weekly report. The
        // currently-deployed script does not read it, and that is deliberately safe:
        // its catch-all raw column keeps the whole payload, so a report arrives intact
        // even before the Apps Script is redeployed with a problems tab. It lands in
        // the wrong place, not in no place.
        kind: 'problem',
        testerName: storage.loadTesterName(),
        installId: storage.loadInstallId(),
        appVersion, build,
        sentAt: new Date(now).toISOString(),
        note: String(note || '').trim(),
        report: String(report || ''),
    };
    storage.saveWeeklyQueue(enqueue(storage.loadWeeklyQueue(), payload));
    return await flush();
}
