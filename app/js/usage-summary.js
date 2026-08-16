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
 * ⚠ EVERYTHING IN THIS FILE IS AGGREGATION, NOT MEASUREMENT. Every field it reports
 * was already being written into the conversation files and read by nothing. That
 * matters when judging a change here: adding a number costs no new capture, no new
 * consent, and no change to what leaves the device, so the bar is only "is it worth
 * reading". Anything that needs a NEW moment recorded belongs in metrics.js instead.
 *
 * ⚠ THE WEEKLY BUCKETS ARE THE HEADLINE MEASURE AND MUST BE COMPUTED HERE, ON THE
 * DEVICE (August 16 2026). The weekly report sends a summary of everything that has
 * ever happened, so a tester whose use halves in week three still shows a healthy
 * cumulative average — the retention curve, which is the agreed headline number, was
 * invisible. It cannot be recovered at the far end either: medians from separate
 * reports cannot be subtracted from one another. So the trajectory is bucketed here,
 * where the individual turns still exist.
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

const DAY = 86400000;
const WEEK = 7 * DAY;

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

function words(text) {
    return typeof text === 'string' ? (text.trim().match(/\S+/g) || []).length : 0;
}

function bump(obj, key, by = 1) {
    if (!key) return;
    obj[key] = (obj[key] || 0) + by;
}

// Local calendar day, not UTC: "did they use it today" is a question about the
// user's day, and a UTC date would move the boundary for most of the world.
function dayKey(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Midnight local at the start of that day, which is where week 1 begins. Weeks run
// from the tester's first day rather than from Monday: the question is "how are they
// doing in their fourth week", not "how did they do in the third week of August".
function startOfDay(t) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

// A conversation is practice when its turns carry the practice partner stamp
// (app.js partnerStamp() writes "Practice: <scenario>"). Practice conversations are
// counted separately rather than dropped: rehearsal is itself an engagement signal,
// but counting it as real use would overstate adoption.
function isPracticeLabel(label) {
    return typeof label === 'string' && label.startsWith('Practice:');
}
function isPractice(data) {
    return (data.exchanges || []).some(ex => ex && ex.partner && isPracticeLabel(ex.partner.label));
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
        // --- added August 16 2026: all of it from what was already on disk ---
        weeks: [],                       // the retention curve (see the header note)
        sourceCounts: {},                // card / composed / express / control
        partners: [],                    // one row per named partner, practice excluded
        returningPartners: 0,
        influencers: { turnsWithPartner: 0, turnsWithFeeling: 0, turnsWithPlace: 0,
                       distinctPartners: 0, distinctFeelings: 0, distinctPlaces: 0 },
        voiceByProvider: {}, voiceFellBack: 0,
        byRecognizer: {},
        partnerWordsMedian: null, userWordsMedian: null,
        palettesOffered: 0, optionsOffered: 0, cardsPerPaletteMedian: null, optionWordsMedian: null,
        decideMsMedian: null, decideSamples: 0,
    };
    if (!Array.isArray(logs) || !logs.length) return out;

    const days = new Set();
    const turnsPer = [];
    const durations = [];
    const respondGaps = [];
    const partnerWords = [];
    const userWords = [];
    const cardsPer = [];
    const optionWords = [];
    const decideTimes = [];
    const feelingsSeen = new Set();
    const placesSeen = new Set();
    // partner label -> { conversations:Set, weeks:Set, turns }
    const partnerRows = new Map();
    // recognizer name -> { partnerTurns, gaps:[] }
    const recognizers = new Map();
    // Two passes are needed for the weekly buckets: the week a turn belongs to is
    // relative to the FIRST turn, which is only known once everything has been read.
    // So the first pass collects, and the buckets are filled at the end.
    const bucketable = [];   // { t, kind, conversationId, fromCard }
    let newest = null, oldest = null;

    for (const entry of logs) {
        const data = entry && entry.data;
        if (!data || !Array.isArray(data.exchanges)) continue;
        const convId = (entry && entry.id) || (data && data.id) || String(out.conversations);
        out.conversations++;
        const practice = isPractice(data);
        if (practice) out.practiceConversations++;

        const ex = data.exchanges;
        const turns = ex.filter(e => isPartner(e) || isUser(e));
        if (!turns.length) out.emptyConversations++;
        turnsPer.push(turns.length);
        out.turns += turns.length;

        let sawError = false;
        let lastPartnerAt = null;
        let convStart = null;

        for (const e of ex) {
            if (isError(e)) {
                out.errors++;
                sawError = true;
                bump(out.errorContexts, e.context || '(unknown)');
                continue;
            }
            const t = ms(e && e.timestamp);
            if (t !== null) {
                days.add(dayKey(t));
                if (newest === null || t > newest) newest = t;
                if (oldest === null || t < oldest) oldest = t;
                if (convStart === null) convStart = t;
            }

            // The situation stamps ride on both roles, so they are read once here.
            const label = e && e.partner && e.partner.label;
            if (label) {
                out.influencers.turnsWithPartner++;
                if (!practice && !isPracticeLabel(label)) {
                    if (!partnerRows.has(label)) partnerRows.set(label, { conversations: new Set(), weeks: new Set(), turns: 0 });
                    const row = partnerRows.get(label);
                    row.conversations.add(convId);
                    row.turns++;
                }
            }

            if (isPartner(e)) {
                out.partnerTurns++;
                lastPartnerAt = t;
                const w = words(e.cleanedTranscript || e.rawTranscript);
                if (w) partnerWords.push(w);
                // WHICH RECOGNIZER heard it. Stamped on every partner turn since
                // August 2026, and the single biggest influence on how accurate that
                // line is — so every other number can be read separately for the two
                // instead of averaging two different products together.
                const rec = e.stt || '(not recorded)';
                if (!recognizers.has(rec)) recognizers.set(rec, { partnerTurns: 0, gaps: [] });
                recognizers.get(rec).partnerTurns++;
                if (t !== null) bucketable.push({ t, kind: 'partnerTurn', convId, practice });
            } else if (isUser(e)) {
                out.userTurns++;
                const fromCard = FROM_CARD(e);
                if (fromCard) out.fromCard++; else out.composed++;
                // WHERE THE WORDS CAME FROM. The card-vs-not split above hides three
                // different behaviors under one heading: typing a sentence is the
                // user's own prose, tapping an Express button is their idiom, and one
                // of OUR control phrases is not their voice at all.
                bump(out.sourceCounts, e.source || '(not recorded)');
                const uw = words(e.selectedText);
                if (uw) userWords.push(uw);
                if (e.feeling && (e.feeling.text || e.feeling.id)) {
                    out.influencers.turnsWithFeeling++;
                    feelingsSeen.add(e.feeling.text || e.feeling.id);
                }
                if (e.place && (e.place.label || e.place.id)) {
                    out.influencers.turnsWithPlace++;
                    placesSeen.add(e.place.label || e.place.id);
                }
                // WHICH VOICE actually said it, and whether the paid voice failed and
                // silently dropped to the device voice for this one sentence. That is
                // an identity failure rather than a cosmetic one, and this is the only
                // place the event is visible after the fact.
                if (e.tts && e.tts.provider) {
                    bump(out.voiceByProvider, e.tts.provider);
                    if (e.tts.fellBack) out.voiceFellBack++;
                }
                // Slot is only present on logs written after August 7 2026. Older
                // ones record the option TEXT but not which category it was, so the
                // distribution is reported over the subset that has it rather than
                // silently mixing the two.
                if (typeof e.selectedSlot === 'string' && e.selectedSlot) {
                    bump(out.slotCounts, e.selectedSlot);
                    out.slotsRecorded++;
                }
                // What was on offer, whether or not it was taken. Card count and text
                // length are what a reading-load figure has to be set against — the
                // useful question is not whether four seconds was exceeded but what
                // makes it be exceeded.
                if (Array.isArray(e.allOptions) && e.allOptions.length) {
                    out.palettesOffered++;
                    out.optionsOffered += e.allOptions.length;
                    cardsPer.push(e.allOptions.length);
                    for (const o of e.allOptions) { const ow = words(o); if (ow) optionWords.push(ow); }
                }
                // READING LOAD: time from the cards appearing to the user acting
                // (recorded since August 16 2026). Unlike the wait below it contains
                // no machine time at all. It is read PLUS select — see the note on the
                // field in storage.js, which is where the honest description lives.
                if (Number.isFinite(e.decideMs) && e.decideMs >= 0 && e.decideMs <= 10 * 60 * 1000) {
                    decideTimes.push(e.decideMs);
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
                        // Attributed to the recognizer that heard the turn being
                        // replied to, which is the one that shaped this wait.
                        const prevRec = lastRecognizerBefore(ex, e);
                        if (recognizers.has(prevRec)) recognizers.get(prevRec).gaps.push(gap);
                    }
                    lastPartnerAt = null;
                }
                if (t !== null) bucketable.push({ t, kind: 'userTurn', convId, practice, fromCard });
            }
        }
        if (sawError) out.conversationsWithErrors++;
        if (convStart !== null) bucketable.push({ t: convStart, kind: 'conversation', convId, practice });

        const stamps = ex.map(e => ms(e && e.timestamp)).filter(t => t !== null);
        if (stamps.length >= 2) durations.push(Math.max(...stamps) - Math.min(...stamps));
    }

    out.activeDays = days.size;
    out.firstUsed = oldest;
    out.lastUsed = newest;
    if (newest !== null) out.daysSinceLastUse = Math.floor((Date.now() - newest) / DAY);
    if (oldest !== null && newest !== null) out.spanDays = Math.floor((newest - oldest) / DAY) + 1;
    // Per ACTIVE week, not per calendar week (CLAUDE.md): this population opens an
    // AAC tool when a communication opportunity arises, so dividing by elapsed time
    // would read as failure for a tool they use happily but not daily.
    if (out.activeDays) out.conversationsPerActiveWeek = out.conversations / (out.activeDays / 7);
    out.medianTurnsPerConversation = median(turnsPer);
    out.medianDurationMs = median(durations);
    out.respondMsMedian = median(respondGaps);
    out.respondSamples = respondGaps.length;
    if (out.userTurns) out.fromCardPercent = Math.round((out.fromCard / out.userTurns) * 100);
    out.partnerWordsMedian = median(partnerWords);
    out.userWordsMedian = median(userWords);
    out.cardsPerPaletteMedian = median(cardsPer);
    out.optionWordsMedian = median(optionWords);
    out.decideMsMedian = median(decideTimes);
    out.decideSamples = decideTimes.length;
    out.influencers.distinctFeelings = feelingsSeen.size;
    out.influencers.distinctPlaces = placesSeen.size;

    out.weeks = bucketWeeks(bucketable, oldest);
    // A partner's week is known only once the buckets exist, so this is filled after.
    const weekOf = (t) => oldest === null ? 0 : Math.floor((t - startOfDay(oldest)) / WEEK);
    for (const entry of logs) {
        const data = entry && entry.data;
        if (!data || !Array.isArray(data.exchanges)) continue;
        for (const e of data.exchanges) {
            const label = e && e.partner && e.partner.label;
            const t = ms(e && e.timestamp);
            if (!label || t === null || isPracticeLabel(label)) continue;
            const row = partnerRows.get(label);
            if (row) row.weeks.add(weekOf(t));
        }
    }
    out.partners = [...partnerRows.entries()]
        .map(([label, r]) => ({ label, conversations: r.conversations.size, weeks: r.weeks.size, turns: r.turns }))
        .sort((a, b) => b.conversations - a.conversations);
    out.influencers.distinctPartners = out.partners.length;
    // RETURNING = seen in more than one conversation. The closest thing the app can
    // say to "would that partner do it again", and the only partner-side signal that
    // arrives without asking anybody anything. It is NOT the same as asking them — a
    // family member returns for reasons that have nothing to do with the device — so
    // it is reported as what it is and never labeled willingness.
    out.returningPartners = out.partners.filter(p => p.conversations > 1).length;

    for (const [name, r] of recognizers.entries()) {
        out.byRecognizer[name] = {
            partnerTurns: r.partnerTurns,
            respondMsMedian: median(r.gaps),
            respondSamples: r.gaps.length,
        };
    }
    return out;
}

// The recognizer that heard the partner turn immediately before `userEx`. Walks
// backwards rather than being tracked in the loop because error entries and
// consecutive user turns can sit between the two.
function lastRecognizerBefore(exchanges, userEx) {
    const i = exchanges.indexOf(userEx);
    for (let j = i - 1; j >= 0; j--) {
        if (isPartner(exchanges[j])) return exchanges[j].stt || '(not recorded)';
        if (isUser(exchanges[j])) return null;
    }
    return null;
}

/* THE RETENTION CURVE. Week 1 starts at midnight on the tester's first day, so the
 * weeks are relative to them rather than to the calendar — the question is "how are
 * they doing in their fourth week", not "how did they do in the third week of
 * August". Weeks with nothing in them are still emitted, because a gap is the
 * finding: a missing week is what a tester quietly stopping looks like, and dropping
 * empty rows would close the gap up and hide it. */
export function bucketWeeks(entries, firstAt) {
    if (firstAt === null || !entries.length) return [];
    const base = startOfDay(firstAt);
    const weeks = [];
    const ensure = (i) => {
        while (weeks.length <= i) {
            weeks.push({
                week: weeks.length + 1,
                start: base + weeks.length * WEEK,
                conversations: 0, practice: 0, userTurns: 0, partnerTurns: 0,
                fromCard: 0, fromCardPercent: null, activeDays: 0, _days: new Set(),
            });
        }
        return weeks[i];
    };
    for (const e of entries) {
        const idx = Math.floor((e.t - base) / WEEK);
        if (idx < 0) continue;
        const w = ensure(idx);
        w._days.add(dayKey(e.t));
        if (e.kind === 'conversation') { w.conversations++; if (e.practice) w.practice++; }
        else if (e.kind === 'partnerTurn') w.partnerTurns++;
        else if (e.kind === 'userTurn') { w.userTurns++; if (e.fromCard) w.fromCard++; }
    }
    for (const w of weeks) {
        w.activeDays = w._days.size;
        delete w._days;
        if (w.userTurns) w.fromCardPercent = Math.round((w.fromCard / w.userTurns) * 100);
    }
    return weeks;
}

/* Personalization depth — how much of the app the tester has made their own.
 *
 * NOT derived from the conversation logs, so it is a separate function taking counts
 * the caller gathers from the other stores. It is here rather than in a module of its
 * own because it belongs to the same report and, like everything else in this file,
 * it needs no new measurement — every number already exists in a saved file.
 *
 * WHY IT IS AN ENGAGEMENT MEASURE AND PROBABLY A LEADING ONE (Ken): editing your own
 * phrases in week one is investment, and it shows before any conversation number can.
 * It also splits a poor result in two — suggestions ignored by someone with an empty
 * profile is an ONBOARDING problem, the same result with a full profile is a
 * GENERATOR problem, and those need completely different work.
 */
export function summarizePersonalization(input = {}) {
    const n = (v) => Number.isFinite(v) ? v : 0;
    const out = {
        worldviewAnswered: n(input.worldviewAnswered),
        worldviewTotal: n(input.worldviewTotal),
        worldviewPercent: null,
        people: n(input.people),
        places: n(input.places),
        expressEdited: n(input.expressEdited),
        expressTotal: n(input.expressTotal),
        controlPhrasesEdited: n(input.controlPhrasesEdited),
        soundCheckAnswered: n(input.soundCheckAnswered),
        settingsProfiles: n(input.settingsProfiles),
    };
    if (out.worldviewTotal) out.worldviewPercent = Math.round((out.worldviewAnswered / out.worldviewTotal) * 100);
    return out;
}

function pct(n) { return n === null ? '—' : `${n}%`; }
function secs(msVal) { return msVal === null ? '—' : `${(msVal / 1000).toFixed(1)}s`; }
// Under a minute is reported in seconds rather than as "0 min", which reads as
// nothing having happened when in fact a short exchange did.
function mins(msVal) {
    if (msVal === null) return '—';
    return msVal < 60000 ? `${Math.round(msVal / 1000)}s` : `${Math.round(msVal / 60000)} min`;
}
function dateOnly(t) { return t === null ? '—' : new Date(t).toLocaleDateString(); }

function topEntries(counts, limit = 6) {
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

// Shared by the normal summary and the no-conversations-yet one, so the two cannot
// drift into describing the same numbers differently.
function personalizationBlock(p) {
    return [
        'HOW MUCH YOU HAVE MADE IT YOURS',
        `  About Me answered       ${p.worldviewAnswered} of ${p.worldviewTotal}  (${pct(p.worldviewPercent)})`,
        `  People / places         ${p.people} / ${p.places}`,
        `  Express buttons yours   ${p.expressEdited} of ${p.expressTotal}`,
        `  Starters and goodbyes edited  ${p.controlPhrasesEdited}`,
        `  Sound Check answered    ${p.soundCheckAnswered}`,
        `  Saved settings profiles ${p.settingsProfiles}`,
    ];
}

/* Plain language, for a tab a tester reads — not a dashboard. Each line names the
 * question it answers, because a number without its question is noise. */
export function formatSummary(s, personalization = null) {
    if (!s.conversations) {
        const empty = 'No saved conversations yet.\n\n'
            + 'This fills in as you use the app. If you have had conversations and\n'
            + 'nothing appears here, check that a data folder is chosen on the\n'
            + 'General tab — without one, conversations are not saved.';
        // ⚠ PERSONALIZATION STILL SHOWS HERE, and this is the case it matters most in.
        // Someone who has filled in About Me and edited their phrases but held no
        // conversations is the tester about to quit, and returning the bare empty state
        // would report them as identical to someone who unwrapped the device and never
        // touched it. Those are opposite situations calling for opposite conversations.
        if (!personalization) return empty;
        return `${empty}\n\n${personalizationBlock(personalization).join('\n')}`;
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

    // The curve, not the average. This is the one section a cumulative summary
    // could never show, and the reason it is computed here rather than at the far end.
    if (s.weeks.length) {
        L.push('WEEK BY WEEK');
        L.push('    Week  Days  Conversations  Things said  From a card');
        for (const w of s.weeks) {
            L.push(`    ${String(w.week).padStart(4)}  ${String(w.activeDays).padStart(4)}  `
                + `${String(w.conversations).padStart(13)}  ${String(w.userTurns).padStart(11)}  `
                + `${String(pct(w.fromCardPercent)).padStart(11)}`);
        }
        L.push('');
    }

    L.push('HOW OFTEN A SUGGESTION FITTED');
    L.push(`  Things you said         ${s.userTurns}`);
    L.push(`  Chosen from a card      ${s.fromCard}  (${pct(s.fromCardPercent)})`);
    L.push(`  Typed or a fixed phrase ${s.composed}`);
    if (Object.keys(s.sourceCounts).length) {
        L.push('  Where the words came from:');
        for (const [src, n] of topEntries(s.sourceCounts)) L.push(`    ${String(src).padEnd(20)} ${n}`);
    }
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
    if (s.decideSamples) {
        // The half of the wait that is the person rather than the machine: from the
        // cards appearing to the user doing anything at all.
        L.push(`  Reading and choosing    ${secs(s.decideMsMedian)} typical, over ${s.decideSamples} turns`);
    }
    if (s.cardsPerPaletteMedian !== null) {
        L.push(`  What there was to read  ${s.cardsPerPaletteMedian} cards, about ${s.optionWordsMedian ?? '—'} words each`);
    }
    if (Object.keys(s.byRecognizer).length > 1) {
        L.push('  By what heard them:');
        for (const [name, r] of Object.entries(s.byRecognizer)) {
            L.push(`    ${String(name).padEnd(20)} ${r.partnerTurns} turns, typical wait ${secs(r.respondMsMedian)}`);
        }
    }
    L.push('');

    L.push('WHO, WHERE AND HOW YOU FELT');
    if (s.partners.length) {
        L.push(`  People named            ${s.partners.length}, of whom ${s.returningPartners} in more than one conversation`);
        for (const p of s.partners.slice(0, 6)) {
            L.push(`    ${String(p.label).padEnd(20)} ${p.conversations} conversation(s) across ${p.weeks} week(s)`);
        }
    } else {
        L.push('  No one named yet.');
    }
    L.push(`  Turns with a place      ${s.influencers.turnsWithPlace}` + (s.influencers.distinctPlaces ? `  (${s.influencers.distinctPlaces} place(s))` : ''));
    L.push(`  Turns with a feeling    ${s.influencers.turnsWithFeeling}` + (s.influencers.distinctFeelings ? `  (${s.influencers.distinctFeelings} feeling(s))` : ''));
    L.push('');

    if (Object.keys(s.voiceByProvider).length) {
        L.push('YOUR VOICE');
        for (const [prov, n] of topEntries(s.voiceByProvider)) L.push(`    ${String(prov).padEnd(20)} ${n} turns`);
        // Worth its own line even at zero: a fallback changes the voice the user
        // speaks in, which is identity, and it is otherwise completely silent.
        L.push(`  Fell back to this device's voice   ${s.voiceFellBack}`);
        L.push('');
    }

    if (personalization) {
        L.push(...personalizationBlock(personalization));
        L.push('');
    }

    L.push('PROBLEMS');
    if (s.errors) {
        L.push(`  Errors recorded         ${s.errors}, in ${s.conversationsWithErrors} conversation(s)`);
        for (const [ctx, n] of topEntries(s.errorContexts)) L.push(`    ${ctx.padEnd(20)} ${n}`);
    } else {
        L.push('  None recorded.');
    }
    return L.join('\n');
}
