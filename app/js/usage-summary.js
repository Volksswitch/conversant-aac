/* Usage summary — aggregates the saved conversation logs into the handful of
 * numbers that answer the three beta questions (CLAUDE.md, "Beta instrumentation
 * and error reporting", Ken, August 7 2026):
 *
 *   1. Do you keep using it?      -> conversations per active week, week 1 vs 4
 *   2. Can you say what you meant? -> share of turns spoken from a card
 *   3. Does it keep up?            -> partner's last pause to the user's turn
 *
 * PURE. No DOM, no storage, no network — it takes the array listConversationLogs()
 * already returns and gives back numbers. That is what makes it unit-testable, and
 * it is why this is the FIRST thing built: almost everything here is derived from
 * data the app has been writing all along, so it reads history rather than needing
 * new capture.
 *
 * Deliberately tolerant of malformed input. These files are written incrementally
 * during live conversations and a crash mid-flush can leave a partial one; a
 * summary that throws on one bad record is worse than useless, because it fails
 * exactly when something has gone wrong and you most want to look.
 */

// A user turn came from a response card when an index into the offered palette was
// recorded. -1 means the user composed it themselves or spoke a fixed phrase, and
// that distinction IS the sufficiency measure — see summarize().
const FROM_CARD = (ex) => Number.isInteger(ex.selectedIndex) && ex.selectedIndex >= 0;

const isPartner = (ex) => ex && ex.role === 'partner';
const isUser = (ex) => ex && ex.role === 'user';
const isError = (ex) => ex && ex.role === 'error';

function ms(ts) {
    const t = Date.parse(ts || '');
    return Number.isFinite(t) ? t : null;
}

function median(nums) {
    if (!nums.length) return null;
    const s = [...nums].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// Local calendar day, not UTC: "did they use it today" is a question about the
// user's day, and a UTC date would move the boundary for most of the world.
function dayKey(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A conversation is practice when its turns carry the practice partner stamp
// (app.js partnerStamp() writes "Practice: <scenario>"). Practice conversations are
// counted separately rather than dropped: rehearsal is itself an engagement signal,
// but counting it as real use would overstate adoption.
function isPractice(data) {
    return (data.exchanges || []).some(ex => ex && ex.partner && typeof ex.partner.label === 'string'
        && ex.partner.label.startsWith('Practice:'));
}

/* Aggregate [{ id, data }] into the summary object. Everything is null/0 rather
 * than absent when there is nothing to measure, so the formatter never has to
 * guard. */
export function summarize(logs) {
    const out = {
        conversations: 0, practiceConversations: 0,
        firstUsed: null, lastUsed: null, activeDays: 0, daysSinceLastUse: null, spanDays: 0,
        conversationsPerActiveWeek: null,
        turns: 0, userTurns: 0, partnerTurns: 0,
        medianTurnsPerConversation: null, medianDurationMs: null,
        fromCard: 0, composed: 0, fromCardPercent: null,
        slotCounts: {}, slotsRecorded: 0,
        respondMsMedian: null, respondSamples: 0, respondOver4s: 0,
        errors: 0, errorContexts: {}, conversationsWithErrors: 0,
        emptyConversations: 0,
    };
    if (!Array.isArray(logs) || !logs.length) return out;

    const days = new Set();
    const turnsPer = [];
    const durations = [];
    const respondGaps = [];
    let newest = null, oldest = null;

    for (const entry of logs) {
        const data = entry && entry.data;
        if (!data || !Array.isArray(data.exchanges)) continue;
        out.conversations++;
        if (isPractice(data)) out.practiceConversations++;

        const ex = data.exchanges;
        const turns = ex.filter(e => isPartner(e) || isUser(e));
        if (!turns.length) out.emptyConversations++;
        turnsPer.push(turns.length);
        out.turns += turns.length;

        let sawError = false;
        let lastPartnerAt = null;

        for (const e of ex) {
            if (isError(e)) {
                out.errors++;
                sawError = true;
                const key = e.context || '(unknown)';
                out.errorContexts[key] = (out.errorContexts[key] || 0) + 1;
                continue;
            }
            const t = ms(e && e.timestamp);
            if (t !== null) {
                days.add(dayKey(t));
                if (newest === null || t > newest) newest = t;
                if (oldest === null || t < oldest) oldest = t;
            }
            if (isPartner(e)) {
                out.partnerTurns++;
                lastPartnerAt = t;
            } else if (isUser(e)) {
                out.userTurns++;
                if (FROM_CARD(e)) out.fromCard++; else out.composed++;
                // Slot is only present on logs written after August 7 2026. Older
                // ones record the option TEXT but not which category it was, so the
                // distribution is reported over the subset that has it rather than
                // silently mixing the two.
                if (typeof e.selectedSlot === 'string' && e.selectedSlot) {
                    out.slotCounts[e.selectedSlot] = (out.slotCounts[e.selectedSlot] || 0) + 1;
                    out.slotsRecorded++;
                }
                // Question 3: how long the partner waited. Only counted when a
                // partner turn immediately precedes, which is the case the number
                // is about — a user turn following another user turn is the user
                // holding the floor, not a response gap.
                if (lastPartnerAt !== null && t !== null && t >= lastPartnerAt) {
                    const gap = t - lastPartnerAt;
                    // Over ten minutes is someone walking away mid-conversation,
                    // not a response time; it would wreck the median's meaning.
                    if (gap <= 10 * 60 * 1000) {
                        respondGaps.push(gap);
                        if (gap > 4000) out.respondOver4s++;
                    }
                    lastPartnerAt = null;
                }
            }
        }
        if (sawError) out.conversationsWithErrors++;

        const stamps = ex.map(e => ms(e && e.timestamp)).filter(t => t !== null);
        if (stamps.length >= 2) durations.push(Math.max(...stamps) - Math.min(...stamps));
    }

    out.activeDays = days.size;
    out.firstUsed = oldest;
    out.lastUsed = newest;
    if (newest !== null) out.daysSinceLastUse = Math.floor((Date.now() - newest) / 86400000);
    if (oldest !== null && newest !== null) out.spanDays = Math.floor((newest - oldest) / 86400000) + 1;
    // Per ACTIVE week, not per calendar week (CLAUDE.md): this population opens an
    // AAC tool when a communication opportunity arises, so dividing by elapsed time
    // would read as failure for a tool they use happily but not daily.
    if (out.activeDays) out.conversationsPerActiveWeek = out.conversations / (out.activeDays / 7);
    out.medianTurnsPerConversation = median(turnsPer);
    out.medianDurationMs = median(durations);
    out.respondMsMedian = median(respondGaps);
    out.respondSamples = respondGaps.length;
    if (out.userTurns) out.fromCardPercent = Math.round((out.fromCard / out.userTurns) * 100);
    return out;
}

function pct(n) { return n === null ? '—' : `${n}%`; }
function secs(msVal) { return msVal === null ? '—' : `${(msVal / 1000).toFixed(1)}s`; }
function mins(msVal) { return msVal === null ? '—' : `${Math.round(msVal / 60000)} min`; }
function dateOnly(t) { return t === null ? '—' : new Date(t).toLocaleDateString(); }

function topEntries(counts, limit = 6) {
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/* Plain language, for a tab a tester reads — not a dashboard. Each line names the
 * question it answers, because a number without its question is noise. */
export function formatSummary(s) {
    if (!s.conversations) {
        return 'No saved conversations yet.\n\n'
            + 'This fills in as you use the app. If you have had conversations and\n'
            + 'nothing appears here, check that a data folder is chosen on the\n'
            + 'General tab — without one, conversations are not saved.';
    }
    const L = [];
    L.push('HOW MUCH IT IS BEING USED');
    L.push(`  Conversations           ${s.conversations}` + (s.practiceConversations ? `  (${s.practiceConversations} of them practice)` : ''));
    L.push(`  Days used               ${s.activeDays}` + (s.spanDays ? ` over ${s.spanDays} days` : ''));
    L.push(`  First / last            ${dateOnly(s.firstUsed)}  ..  ${dateOnly(s.lastUsed)}`);
    if (s.daysSinceLastUse !== null) L.push(`  Days since last use     ${s.daysSinceLastUse}`);
    if (s.conversationsPerActiveWeek !== null) L.push(`  Per week (days used)    ${s.conversationsPerActiveWeek.toFixed(1)}`);
    L.push(`  Typical length          ${s.medianTurnsPerConversation ?? '—'} turns, ${mins(s.medianDurationMs)}`);
    if (s.emptyConversations) L.push(`  Started but nothing said ${s.emptyConversations}`);
    L.push('');

    L.push('HOW OFTEN A SUGGESTION FITTED');
    L.push(`  Things you said         ${s.userTurns}`);
    L.push(`  Chosen from a card      ${s.fromCard}  (${pct(s.fromCardPercent)})`);
    L.push(`  Typed or a fixed phrase ${s.composed}`);
    if (s.slotsRecorded) {
        L.push('  Which kind of reply:');
        for (const [slot, n] of topEntries(s.slotCounts)) {
            L.push(`    ${slot.padEnd(20)} ${n}  (${Math.round((n / s.slotsRecorded) * 100)}%)`);
        }
    }
    L.push('');

    L.push('HOW LONG THE OTHER PERSON WAITED');
    if (s.respondSamples) {
        L.push(`  Typical wait            ${secs(s.respondMsMedian)}`);
        L.push(`  Waits over 4 seconds    ${s.respondOver4s} of ${s.respondSamples}`);
    } else {
        L.push('  Not enough data yet.');
    }
    L.push('');

    L.push('PROBLEMS');
    if (s.errors) {
        L.push(`  Errors recorded         ${s.errors}, in ${s.conversationsWithErrors} conversation(s)`);
        for (const [ctx, n] of topEntries(s.errorContexts)) L.push(`    ${ctx.padEnd(20)} ${n}`);
    } else {
        L.push('  None recorded.');
    }
    return L.join('\n');
}
