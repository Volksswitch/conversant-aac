/* Rolling the beta reports up - across testers, and across the dimensions that
 * actually separate one configuration from another.
 *
 * (!) THE ONE ARITHMETIC RULE THAT GOVERNS THIS WHOLE FILE: MEDIANS CANNOT BE POOLED.
 * A report carries each tester's median wait, not the waits themselves, and the
 * middle of five middles is not the middle of everybody's replies. Averaging them
 * would produce a number that looks authoritative and means nothing.
 *
 * So every pooled figure here is either a SUM or a RATIO OF TWO SUMS, both of which
 * combine correctly. That constraint turned out to improve the answer rather than
 * limit it: the founding question is not "what is the typical wait" but "how often
 * did the other person wait longer than they will tolerate", and the share of replies
 * over four seconds is a ratio of two sums. It pools exactly right, and it is the
 * more useful number anyway. Where only medians exist, a RANGE across testers is
 * reported and labelled as what it is.
 *
 * (!) POOLING ACROSS TESTERS AND POOLING ACROSS TURNS ARE DIFFERENT ACTS. Five people
 * is far too few to average as people - one person changing their mind moves any
 * per-tester percentage. But those five people produce thousands of turns, and a
 * question about a CONFIGURATION - does the paid transcription hear people better,
 * does an iPad keep up - is a question about turns. Those pool honestly. Which is why
 * the dimensions below are configuration dimensions and there is no "average tester"
 * anywhere in this file.
 */

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const num = (v) => (Number.isFinite(v) ? v : 0);
const ratio = (n, d) => (d ? n / d : null);

/* What separates one tester's setup from another's. Everything here comes from the
 * system information block, which is only sent when it CHANGES - so it can be missing
 * from a device that has reported for months, and 'unknown' is a real answer rather
 * than a fault. */
export function dimensionsOf(t) {
    const info = t.systemInfo || {};
    const p = info.platform || {};
    const speech = info.speech || {};
    const summary = String(p.summary || '');
    let platform = 'unknown';
    if (/iPad|iOS|WebKit|Safari/i.test(summary)) platform = p.standalone ? 'iPad, installed' : 'iPad, browser tab';
    else if (summary) platform = 'computer';
    return {
        platform,
        hearing: speech.sttProvider || 'unknown',
        voice: speech.ttsProvider || 'unknown',
        version: t.appVersion || 'unknown',
    };
}

/* The countable facts from one tester, reduced to the handful that pool. */
export function tally(t) {
    const u = t.usage || {};
    const ev = (t.events && t.events.totals) || {};
    return {
        testers: 1,
        conversations: num(u.conversations) - num(u.practiceConversations),
        practice: num(u.practiceConversations),
        activeDays: num(u.activeDays),
        userTurns: num(u.userTurns),
        fromCard: num(u.fromCard),
        respondSamples: num(u.respondSamples),
        respondOver4s: num(u.respondOver4s),
        respondDiscarded: num(u.respondDiscarded),
        palettesShown: num(ev.palette_shown),
        palettesAbandoned: num(ev.palette_abandoned),
        regenerates: num(ev.regenerate),
        appOpens: num(ev.app_opened),
        conversationsStarted: num(ev.conversation_started),
        rateLimited: num(ev.rate_limited),
        voiceFellBack: num(u.voiceFellBack),
        errors: (t.errors || []).length,
    };
}

export function addTallies(list) {
    const keys = Object.keys(tally({ usage: {}, events: {} }));
    const out = {};
    for (const k of keys) out[k] = sum(list.map(x => num(x[k])));
    return out;
}

/* The three questions, as ratios of sums so they survive pooling.
 *
 * `sufficiency` is the product's central bet in one number: how often what the app
 * suggested was good enough to say. `overFour` is the founding problem - the pause a
 * conversation partner will not sit through. `abandoned` and `regeneratesPerTurn` are
 * the early warning: both move BEFORE sufficiency falls, and they say which half
 * failed - suggestions not worth reading, or suggestions read and rejected.
 */
export function ratios(t) {
    return {
        sufficiency: ratio(t.fromCard, t.userTurns),
        overFour: ratio(t.respondOver4s, t.respondSamples),
        abandoned: ratio(t.palettesAbandoned, t.palettesShown),
        regeneratesPerTurn: ratio(t.regenerates, t.userTurns),
        startedPerOpen: ratio(t.conversationsStarted, t.appOpens),
    };
}

export function groupBy(testers, keyFn) {
    const map = new Map();
    for (const t of testers) {
        const k = keyFn(t) || 'unknown';
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(t);
    }
    return [...map.entries()].map(([key, members]) => {
        const totals = addTallies(members.map(tally));
        return { key, members: members.map(m => m.name), totals, ratios: ratios(totals) };
    }).sort((a, b) => b.totals.userTurns - a.totals.userTurns);
}

/* The range of a per-tester median across a group. Reported instead of a pooled
 * median, and never called an average - see the arithmetic rule at the top. */
export function spread(testers, pick) {
    const vals = testers.map(pick).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (!vals.length) return null;
    return { low: vals[0], high: vals[vals.length - 1], n: vals.length,
             middle: vals[(vals.length - 1) >> 1] };
}

/* WHO TO REACH OUT TO. Ken, August 21 2026: "The sheet flags who's not reporting and
 * I follow up out of band. I just need a heads up to reach out."
 *
 * So this deliberately does NOT try to work out whether a quiet tester has stopped
 * using the app or merely stopped reporting - it cannot, and a person can settle it
 * in one message. It answers the smaller question honestly: who has not been heard
 * from, and for how long. Reports arrive about weekly, so anything past a fortnight
 * has missed two.
 */
export function silentTesters(testers, asOf = Date.now(), days = 14) {
    return testers.map(t => {
        const last = Date.parse(t.lastSentAt || '');
        const quietDays = Number.isFinite(last) ? Math.floor((asOf - last) / 86400000) : null;
        return { name: t.name, install: t.install, lastSentAt: t.lastSentAt, quietDays };
    }).filter(r => r.quietDays === null || r.quietDays >= days)
      .sort((a, b) => (b.quietDays ?? 9999) - (a.quietDays ?? 9999));
}

/* The retention curve as a grid: one row per tester, one column per week of THEIR
 * own use. Weeks run from each tester's first day rather than from the calendar, so
 * week 4 means the same thing for everybody however they were recruited.
 *
 * A blank is a week with nothing in it, and blanks are the finding. They are only
 * trustworthy where a LATER report exists to have filled them in - which it always
 * does here, because a report re-counts the tester's whole history every time. */
export function retentionGrid(testers) {
    const rows = testers.map(t => ({
        name: t.name,
        weeks: (t.weeks || []).map(w => ({
            week: w.week, conversations: num(w.conversations) - num(w.practice),
            days: num(w.activeDays), fromCardPercent: w.fromCardPercent,
        })),
    }));
    const widest = Math.max(0, ...rows.map(r => r.weeks.length));
    return { rows, weeks: widest };
}

/* ERRORS, grouped by what went wrong rather than by who hit it.
 *
 * Grouping this way is what separates "the app has a fault" from "that tester's
 * network is poor": the same context appearing for several people is the first,
 * hundreds of one context from one person is the second. Newest first, because the
 * question when reading is almost always whether something has started happening.
 */
export function errorRollup(testers) {
    const byContext = new Map();
    for (const t of testers) {
        for (const e of t.errors || []) {
            const k = e.context || '(unknown)';
            if (!byContext.has(k)) byContext.set(k, { context: k, count: 0, testers: new Set(), versions: new Set(), newest: '', samples: [] });
            const g = byContext.get(k);
            g.count++;
            g.testers.add(t.name);
            if (e.appVersion) g.versions.add(e.appVersion);
            if ((e.ts || '') > g.newest) g.newest = e.ts || '';
            if (g.samples.length < 3 && e.message) g.samples.push(e.message);
        }
    }
    return [...byContext.values()]
        .map(g => ({ ...g, testers: [...g.testers], versions: [...g.versions] }))
        .sort((a, b) => String(b.newest).localeCompare(String(a.newest)));
}

/* Errors first seen since a given moment - what "tell me about errors shortly after
 * they happen" reduces to when the reading is done in batches. */
export function errorsSince(testers, sinceIso) {
    const out = [];
    for (const t of testers) {
        for (const e of t.errors || []) {
            if (!sinceIso || String(e.ts || '') > sinceIso) out.push({ ...e, tester: t.name });
        }
    }
    return out.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}
