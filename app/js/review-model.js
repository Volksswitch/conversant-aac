/* Conversation Review — the reading half and the answer record.
 *
 * PURE. No DOM, no storage, no network. It takes the parsed conversation file that
 * storage already writes (see "Conversant AAC Conversation Review.docx" §13.1) and
 * turns it into the TURNS review steps through, and it owns the shape of the review
 * file that is written beside the conversation (§13.2).
 *
 * Review adds no capture of its own: everything here is read from entries the app has
 * been writing since September 2026 (offers, events, context), with fallbacks for older
 * files that carry only the user's turn and its `allOptions`.
 *
 * ⚠ THE CONVERSATION FILE IS NEVER REWRITTEN. A correction goes in the review file,
 * keyed by the turn's first timestamp, so the record of what happened stays what
 * happened (§6.4: a correction that edited the record would destroy the evidence it
 * was reporting).
 */

export const REVIEW_VERSION = 1;

// The three things the user did DELIBERATELY, at the time, that are worth a mark on
// the list (§11). Two signals stay out on purpose: a set replaced because the partner
// carried on talking (nearly half of all sets, on one real tester) and a long pause
// before answering, which may only be careful reading.
export const FLAG = {
    ASKED_DIFFERENT: 'asked for different options',
    COMPOSER: 'went to the Composition Pane',
    STEERED: 'steered the AI',
};

function textOfPartner(e) {
    return String((e && (e.cleanedTranscript || e.rawTranscript)) || '').trim();
}

/** A practice conversation is stamped "Practice: <scenario>" on its partner label. */
export function practiceTitle(data) {
    const ex = Array.isArray(data && data.exchanges) ? data.exchanges : [];
    for (const e of ex) {
        const p = e && e.partner;
        const label = p && typeof p === 'object' ? p.label : null;
        if (typeof label === 'string' && label.startsWith('Practice:')) {
            return label.slice('Practice:'.length).trim() || 'Practice';
        }
    }
    return null;
}

export function isPractice(data) { return practiceTitle(data) !== null; }

function labelOf(v) {
    if (!v) return null;
    if (typeof v === 'string') return v;
    return v.label || v.text || v.name || null;
}

/**
 * Split a conversation into turns. A turn is one exchange: what the other person said,
 * the sets of response options that were shown, and what the user did.
 *
 * Events that arrive after the user has spoken (the microphone going back on, for
 * instance) belong to the NEXT turn, so a turn's flags only ever describe what the user
 * did while deciding on that turn.
 */
export function buildTurns(data) {
    const ex = Array.isArray(data && data.exchanges) ? data.exchanges : [];
    const practice = isPractice(data);
    const turns = [];
    let ctx = { partner: null, place: null, feeling: null, goals: null };
    let cur = null;

    const open = (at) => {
        cur = {
            key: at || `t${turns.length}`,
            partner: null, user: null, offers: [], events: [], errors: [], placeholders: [],
            context: { ...ctx },
        };
    };
    const close = () => {
        if (cur && (cur.partner || cur.user || cur.offers.length)) turns.push(cur);
        cur = null;
    };
    // Settles the key on the first entry that makes the turn REAL, so a turn whose first
    // entry was only a "listen on" event is not keyed on that event's time.
    const claimKey = (at) => {
        if (cur && !cur.partner && !cur.user && !cur.offers.length && at) cur.key = at;
    };

    for (const e of ex) {
        if (!e || typeof e !== 'object') continue;
        switch (e.role) {
            case 'context':
                ctx = { partner: e.partner || null, place: e.place || null, feeling: e.feeling || null, goals: e.goals || null };
                if (cur && !cur.user) cur.context = { ...ctx };
                break;
            case 'partner':
                if (cur && (cur.user || cur.partner)) close();
                if (!cur) open(e.timestamp);
                claimKey(e.timestamp);
                cur.partner = {
                    text: textOfPartner(e),
                    raw: String(e.rawTranscript || ''),
                    revisions: Array.isArray(e.revisions) ? e.revisions : [],
                    stt: e.stt || null,
                    at: e.timestamp || null,
                };
                break;
            case 'offer':
                if (cur && cur.user) close();
                if (!cur) open(e.timestamp);
                claimKey(e.timestamp);
                cur.offers.push(e);
                break;
            case 'user':
                if (cur && cur.user) close();
                if (!cur) open(e.timestamp);
                claimKey(e.timestamp);
                cur.user = e;
                if (e.partner || e.place || e.feeling || e.goals) {
                    cur.context = {
                        partner: e.partner || cur.context.partner,
                        place: e.place || cur.context.place,
                        feeling: e.feeling || cur.context.feeling,
                        goals: e.goals || cur.context.goals,
                    };
                }
                break;
            case 'placeholder':
            case 'event':
            case 'error':
                if (cur && cur.user) close();
                if (!cur) open(null);
                (e.role === 'error' ? cur.errors : e.role === 'event' ? cur.events : cur.placeholders).push(e);
                break;
            default:
                break;
        }
    }
    close();
    return turns.map((t, index) => finishTurn(t, index, practice));
}

// The set to show for a turn. If the user took a card, the set they took it from;
// otherwise the last set that was on screen, which is the one they turned away from.
function shownOffer(t) {
    const offers = t.offers;
    if (!offers.length) return null;
    const u = t.user;
    if (u && (u.source === 'card' || (u.source == null && Number.isInteger(u.selectedIndex) && u.selectedIndex >= 0))) {
        for (let i = offers.length - 1; i >= 0; i--) {
            const o = offers[i];
            if (o.outcome === 'card' && o.selectedIndex === u.selectedIndex) return o;
        }
    }
    return offers[offers.length - 1];
}

function finishTurn(t, index, practice) {
    const u = t.user;
    const offer = shownOffer(t);
    let cards = [];
    let took = -1;
    if (offer) {
        cards = (offer.options || []).map((o) => ({ slot: o.slot || null, text: String(o.text || '') }));
        if (offer.outcome === 'card' && Number.isInteger(offer.selectedIndex)) took = offer.selectedIndex;
    } else if (u && Array.isArray(u.allOptions) && u.allOptions.length) {
        // Older files: only the user's turn carries the options, as text. The category
        // is known only for the one that was chosen.
        cards = u.allOptions.map((text, i) => ({
            slot: i === u.selectedIndex ? (u.selectedSlot || null) : null,
            text: String(text || ''),
        }));
    }
    if (took < 0 && u && Number.isInteger(u.selectedIndex) && u.selectedIndex >= 0
        && (u.source === 'card' || u.source == null) && u.selectedIndex < cards.length) {
        took = u.selectedIndex;
    }

    // The deliberate signals, counted only while the turn was undecided.
    const flags = [];
    const regenerates = t.offers.filter((o) => o.outcome === 'regenerate').length
        || t.events.filter((e) => e.kind === 'generation requested' && e.reason === 'regenerate').length;
    if (regenerates) flags.push(FLAG.ASKED_DIFFERENT);
    const sawOptions = t.offers.length > 0;
    const composer = t.offers.some((o) => o.outcome === 'composer')
        || (sawOptions && t.events.some((e) => e.kind === 'composer opened'));
    if (composer) flags.push(FLAG.COMPOSER);
    const steerEvents = t.events.filter((e) => e.kind === 'reframe');
    const steered = steerEvents.length > 0 || t.offers.some((o) => o.outcome === 'reframe');
    if (steered) flags.push(FLAG.STEERED);
    // Round trips the user caused by switching a context button on. Kept apart because
    // they say nothing about whether the options were any good (§6).
    const contextRegens = t.events.filter((e) => e.kind === 'generation requested' && e.reason === 'context change').length;
    const abandoned = t.events
        .filter((e) => e.kind === 'composer canceled' && e.text && String(e.text).trim())
        .map((e) => String(e.text).trim());

    let source = null;
    if (u) source = u.source || (took >= 0 ? 'card' : null);

    return {
        index,
        key: t.key,
        practice,
        partner: t.partner,
        partnerText: t.partner ? t.partner.text : '',
        user: u ? {
            text: String(u.selectedText || ''),
            source,
            slot: u.selectedSlot || null,
            audio: u.audio || null,
            at: u.timestamp || null,
        } : null,
        cards,
        took,
        sets: t.offers.length,
        regenerates,
        contextRegens,
        steers: steerEvents.map((e) => String(e.text || '')).filter(Boolean),
        abandoned,
        flags,
        context: {
            partner: labelOf(t.context.partner),
            place: labelOf(t.context.place),
            feeling: labelOf(t.context.feeling),
        },
        errors: t.errors.map((e) => String(e.message || e.context || 'error')),
    };
}

/**
 * One row of the list: when, who, where, how long, and how many turns carry one of the
 * three deliberate signals. Returns null for a file with nothing to review.
 */
export function summarize(id, data) {
    if (!data || typeof data !== 'object') return null;
    const turns = buildTurns(data);
    if (!turns.length) return null;
    const ex = Array.isArray(data.exchanges) ? data.exchanges : [];
    const stamps = ex.map((e) => Date.parse(e && e.timestamp)).filter((n) => Number.isFinite(n));
    const started = Date.parse(data.started) || (stamps.length ? Math.min(...stamps) : NaN);
    const ended = stamps.length ? Math.max(...stamps) : started;
    const practice = practiceTitle(data);
    let who = null;
    let where = null;
    for (const t of turns) {
        if (!who && t.context.partner && !String(t.context.partner).startsWith('Practice:')) who = t.context.partner;
        if (!where && t.context.place) where = t.context.place;
    }
    return {
        id,
        started: Number.isFinite(started) ? new Date(started).toISOString() : null,
        durationMs: Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, ended - started) : 0,
        who: practice || who,
        where: practice ? 'Practice' : where,
        practice: practice !== null,
        replies: turns.filter((t) => t.user).length,
        turns: turns.length,
        flagged: turns.filter((t) => t.flags.length).length,
    };
}

/** "3 min", "45 sec", "1 hr 5 min" — how long a conversation ran. */
export function durationLabel(ms) {
    const s = Math.round((ms || 0) / 1000);
    if (s < 60) return `${s} sec`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} hr ${m % 60} min`;
}

// --- The review file ----------------------------------------------------------

export function emptyReview(conversationId) {
    return { kind: 'conversant-review', version: REVIEW_VERSION, conversationId: conversationId || null, updated: null, turns: {} };
}

export function normalizeReview(raw, conversationId) {
    const out = emptyReview(conversationId);
    if (!raw || typeof raw !== 'object') return out;
    out.updated = raw.updated || null;
    // The furthest turn the user has reached, for "Where you got to" on the list.
    if (Number.isInteger(raw.reached) && raw.reached >= 0) out.reached = raw.reached;
    const turns = raw.turns && typeof raw.turns === 'object' ? raw.turns : {};
    for (const [key, entry] of Object.entries(turns)) {
        const clean = cleanEntry(entry);
        if (clean) out.turns[key] = clean;
    }
    return out;
}

function emptyEntry() {
    return { answer: null, reframers: [], steer: null, misheard: null };
}

// An entry that says nothing is dropped, so the file only ever holds turns the user
// actually touched (§13.2).
function cleanEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const e = {
        answer: entry.answer && typeof entry.answer === 'object' ? { ...entry.answer } : null,
        reframers: Array.isArray(entry.reframers) ? entry.reframers.filter((r) => r && r.kind && (r.id || r.label)) : [],
        steer: typeof entry.steer === 'string' && entry.steer.trim() ? entry.steer.trim() : null,
        misheard: entry.misheard && typeof entry.misheard === 'object' ? { ...entry.misheard } : null,
    };
    if (e.answer && e.answer.kind === 'card') {
        // Leaving the spoken card as it was records nothing (§6.1): from the outside it
        // looks exactly like leaving the turn alone, and the app never guesses.
        if (e.answer.unchangedSpoken) e.answer = null;
    }
    if (e.answer && (e.answer.kind === 'typed') && !String(e.answer.text || '').trim()) e.answer = null;
    if (e.misheard && typeof e.misheard.said === 'string' && !e.misheard.said.trim()) e.misheard.said = null;
    if (!e.answer && !e.reframers.length && !e.steer && !e.misheard) return null;
    return e;
}

export function getEntry(review, key) {
    return (review && review.turns && review.turns[key]) || emptyEntry();
}

function withEntry(review, key, fn) {
    const next = { ...review, turns: { ...review.turns } };
    const entry = JSON.parse(JSON.stringify(getEntry(review, key)));
    fn(entry);
    const clean = cleanEntry(entry);
    if (clean) next.turns[key] = clean; else delete next.turns[key];
    return next;
}

/**
 * Record a card as the answer, with the words as they now stand.
 *
 * Choosing ONE ANSWER CLEARS THE OTHERS: a card, a phrase, a typed sentence and New 4
 * all answer the same question, and two answers to one question mean neither.
 */
export function setCardAnswer(review, turn, index, text) {
    const original = (turn.cards[index] && turn.cards[index].text) || '';
    const words = String(text == null ? original : text).trim();
    return withEntry(review, turn.key, (e) => {
        e.answer = {
            kind: 'card',
            index,
            slot: (turn.cards[index] && turn.cards[index].slot) || null,
            text: words,
            original,
            rewritten: words !== original.trim(),
            unchangedSpoken: index === turn.took && words === original.trim(),
        };
    });
}

export function setPhraseAnswer(review, turn, { itemId = null, text = '', sound = false, needed = null, speak = null } = {}) {
    return withEntry(review, turn.key, (e) => {
        e.answer = {
            kind: sound ? 'sound' : 'phrase',
            itemId,
            text: String(text || ''),
            // The phrase's own "how to say it", so Hear it sounds the way the panel does
            // (CR-258). Kept only when it differs from the words.
            speak: !sound && speak && String(speak) !== String(text || '') ? String(speak) : null,
            // WHAT HAD TO BE SWITCHED ON TO REACH IT. A Flex phrase exists only because a
            // person or place is on, so the answer is the pair (§6, Figure 4).
            needed: Array.isArray(needed) && needed.length ? needed.slice() : null,
        };
    });
}

export function setTypedAnswer(review, turn, text) {
    return withEntry(review, turn.key, (e) => { e.answer = { kind: 'typed', text: String(text || '').trim() }; });
}

/** New 4 in review: "I would have asked for a different set." Pressing it again clears it. */
export function toggleMoreOptions(review, turn) {
    return withEntry(review, turn.key, (e) => {
        e.answer = (e.answer && e.answer.kind === 'more') ? null : { kind: 'more' };
    });
}

export function clearAnswer(review, turn) {
    return withEntry(review, turn.key, (e) => { e.answer = null; });
}

/**
 * Mark or unmark a reframer (partner, place, feeling or goal): what the app SHOULD HAVE
 * BEEN TOLD. It sits alongside whatever answer the user gives, and several can be marked.
 * Partner, place and feeling are one-at-a-time, as they are in a conversation.
 */
export function toggleReframer(review, turn, { kind, id = null, label = '' }) {
    return withEntry(review, turn.key, (e) => {
        const at = e.reframers.findIndex((r) => r.kind === kind && (r.id || r.label) === (id || label));
        if (at >= 0) {
            e.reframers.splice(at, 1);
        } else {
            if (kind !== 'goal') e.reframers = e.reframers.filter((r) => r.kind !== kind);
            e.reframers.push({ kind, id, label });
        }
        // Switching a context button off can empty the band a chosen phrase came out
        // of, and an answer pointing at a button that is no longer there means nothing.
        if (e.answer && Array.isArray(e.answer.needed)) {
            const still = e.answer.needed.every((n) => e.reframers.some((r) => (r.id || r.label) === (n.id || n.label)));
            if (!still) e.answer = null;
        }
    });
}

/** Reframe in review's Composition Pane: the direction they would have steered the AI in. */
export function setSteer(review, turn, text) {
    return withEntry(review, turn.key, (e) => { e.steer = String(text || '').trim() || null; });
}

/**
 * "It wrote down the wrong words." The flag comes first and stands on its own; what the
 * user says was actually said is optional and asked for after it (§6.4).
 */
export function setMisheard(review, turn, said) {
    const heard = turn.partnerText || '';
    return withEntry(review, turn.key, (e) => {
        const s = typeof said === 'string' ? said.trim() : null;
        e.misheard = { heard, said: s && s !== heard.trim() ? s : null };
    });
}

export function clearMisheard(review, turn) {
    return withEntry(review, turn.key, (e) => { e.misheard = null; });
}

/** Record that the user has reached turn `i`. Only ever moves forward. */
export function markReached(review, i) {
    const prev = Number.isInteger(review.reached) ? review.reached : -1;
    return i > prev ? { ...review, reached: i } : review;
}

/**
 * "Where you got to" (Figure 1): not looked at, part way through with how many turns are
 * left, or finished. `rank` orders them for sorting, least far first.
 */
export function progressOf(review, turnCount) {
    const reached = review && Number.isInteger(review.reached) ? review.reached : -1;
    if (reached < 0) return { state: 'none', left: turnCount, rank: 0, label: 'not looked at' };
    const left = Math.max(0, turnCount - 1 - reached);
    if (!left) return { state: 'done', left: 0, rank: 2, label: 'finished' };
    return { state: 'part', left, rank: 1, label: `part way through — ${left} of ${turnCount} left` };
}

const SORT_KEYS = {
    when: (r) => Date.parse(r.started) || 0,
    who: (r) => String(r.who || '').toLowerCase(),
    where: (r) => String(r.where || '').toLowerCase(),
    length: (r) => r.durationMs || 0,
    progress: (r) => (r.progressRank || 0) * 1000 + (r.flagged ? 1 : 0),
};

/**
 * Sort the list's rows by a column. Ties fall back to newest first, so rows with the
 * same person or place still read in a sensible order.
 */
export function sortRows(rows, column = 'when', ascending = false) {
    const key = SORT_KEYS[column] || SORT_KEYS.when;
    const newest = SORT_KEYS.when;
    return rows.slice().sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        let c = typeof ka === 'string' ? ka.localeCompare(kb) : ka - kb;
        if (!ascending) c = -c;
        return c || (newest(b) - newest(a));
    });
}

/** How many turns the user has said something about. */
export function touchedCount(review) {
    return review && review.turns ? Object.keys(review.turns).length : 0;
}

// --- Undo / Redo --------------------------------------------------------------

/**
 * One action at a time, both ways. The caller pushes the state BEFORE each discrete
 * action and once when a word starts changing, so undo steps back a word rather than a
 * letter, and no single press can lose more than the last thing the user did (§6).
 */
export function createHistory(limit = 100) {
    const back = [];
    const fwd = [];
    return {
        push(state, turnKey) {
            back.push({ state: JSON.stringify(state), turnKey });
            if (back.length > limit) back.shift();
            fwd.length = 0;
        },
        undo(current, turnKey) {
            const prev = back.pop();
            if (!prev) return null;
            fwd.push({ state: JSON.stringify(current), turnKey: prev.turnKey || turnKey });
            return { state: JSON.parse(prev.state), turnKey: prev.turnKey };
        },
        redo(current, turnKey) {
            const next = fwd.pop();
            if (!next) return null;
            back.push({ state: JSON.stringify(current), turnKey: next.turnKey || turnKey });
            return { state: JSON.parse(next.state), turnKey: next.turnKey };
        },
        canUndo: () => back.length > 0,
        canRedo: () => fwd.length > 0,
        clear() { back.length = 0; fwd.length = 0; },
    };
}
