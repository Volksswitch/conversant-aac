/* Transcript-shaping helpers — the pure array logic behind the conversation
 * transcript (the `<id>.json` file), extracted from storage.js so the tricky
 * rules can be unit-tested without the File System Access / DOM plumbing.
 *
 * Ken (July 2026) — the transcript must MIRROR the conversation pane at all times,
 * so it's a reliable record while the app misbehaves. That means the partner's
 * in-progress turn is written as soon as it's shown live and updated on every
 * pause, not only when the user finally responds. These helpers implement the
 * exact rules:
 *   - a partner turn is written at the first pause (raw text, empty cleaned line),
 *   - each later pause OVERWRITES the raw line and CLEARS the cleaned line,
 *   - EVERY pause also appends a timestamped revision, so a turn keeps its own
 *     history rather than only its final state (Ken, August 21 2026 - see below),
 *   - the turn is FINALIZED (cleaned line filled) when the user responds.
 * No FSA, no DOM, no module state — the caller (storage.js) owns the exchanges
 * array and the "pending partner turn" reference and passes them in.
 */

/* -- Why a partner turn keeps its own history (Ken, August 21 2026) ----------
 *
 * Ken asked whether the saved transcript records the partner's speech as it grows,
 * so a reader can see WHEN they paused, when they carried on, and when the app went
 * back to the AI. It did not: each pause overwrote the raw line and the FIRST
 * pause's timestamp was kept, so a turn that grew across four pauses was saved as a
 * single line with a single time. The intermediate states, the number of pauses and
 * their times were all gone.
 *
 * ⚠ THAT LEFT THE TWO RECORDS UNABLE TO ANSWER THE QUESTION EVEN TOGETHER. The
 * event trace has the pause and reprompt structure in counts and times but carries
 * NO WORDS, deliberately (August 5 2026); the conversation file had the words but no
 * structure. So "the partner paused here, the app said this, then that text
 * appeared" could be reconstructed from neither - which is exactly the shape of the
 * open question about the app's own holding phrases turning up in partner speech.
 *
 * A revision is appended at every pause. `rawTranscript` still holds the current text,
 * so every existing reader is unaffected; the history is purely additive.
 */
const MAX_REVISIONS = 20;

/* ⚠ WHEN TRIMMING, THE FIRST REVISION IS KEPT AND THE SECOND IS DROPPED. The first
 * is what the app acted on when it asked the AI the first time, so it is the most
 * informative single entry and the last one that should be lost. The cap only bounds
 * a pathological turn; a normal one never reaches it. */
function pushRevision(turn, text, timestamp) {
    if (!Array.isArray(turn.revisions)) turn.revisions = [];
    const last = turn.revisions[turn.revisions.length - 1];
    // A pause that added nothing new is not a revision of anything.
    if (last && last.text === text) return;
    turn.revisions.push({ at: timestamp || new Date().toISOString(), text });
    while (turn.revisions.length > MAX_REVISIONS) turn.revisions.splice(1, 1);
}

// Upsert the partner's in-progress ("pending") turn. If `pending` is a live
// partner turn, overwrite its raw text and CLEAR its cleaned text (the partner
// kept talking, so the previous cleaned text is stale); otherwise append a new
// pending partner entry. Returns the pending turn object (the caller keeps it as
// the new `pending` reference).
export function upsertPartnerInterim(exchanges, pending, { rawTranscript, partner = null, stt = null, timestamp }) {
    if (pending) {
        pending.rawTranscript = rawTranscript;
        pending.cleanedTranscript = '';          // partner continued — stale cleaned text is dropped
        if (partner) pending.partner = partner;
        if (stt) pending.stt = stt;
        pushRevision(pending, rawTranscript, timestamp);
        return pending;
    }
    const turn = {
        timestamp: timestamp || new Date().toISOString(),
        role: 'partner',
        rawTranscript,
        cleanedTranscript: '',
        partner,
        // WHICH RECOGNISER HEARD IT ('browser' | 'deepgram'). Recorded because it is
        // the single biggest influence on how accurate this line is, so a later
        // review of a mangled turn can tell a mishearing from a misunderstanding.
        stt,
    };
    // The first pause is revision one - the text the app first asked the AI about.
    pushRevision(turn, rawTranscript, turn.timestamp);
    exchanges.push(turn);
    return turn;
}

// Finalize a partner turn with its cleaned text (called when the user responds,
// or when a conversation is torn down). `handle` is the pending turn returned by
// upsertPartnerInterim (detached by the caller so no further interim touches it).
// If `handle` is set it is updated IN PLACE — preserving its position before the
// user's turn; if `handle` is null (an interruption captured before any pause was
// ever written) a fresh finalized partner entry is appended. Returns the entry.
/* ⚠ `uncertain` IS THE WORDS THE MODEL WOULD NOT SWEAR TO, and it is a MEASURE, not a
 * correction (Ken, August 27 2026). The app used to make a second AI request that
 * rewrote what the recognizer heard; that was removed because of when it ran, and this
 * replaced it -- the same judgment, reported instead of applied, inside the request
 * that was already going out.
 *
 * Recorded on the turn so a report can say how often the microphone is struggling, and
 * -- because a turn also carries who the user was with and where they were -- whether
 * it struggles more with a particular person or in a particular room. Nothing is shown
 * to the user from it yet.
 *
 * ⚠ `cleanedTranscript` IS KEPT AND ALWAYS EQUALS `rawTranscript` NOW. Every reader of
 * an older conversation still expects the field, and files written while the tidy-up
 * existed genuinely hold a different value in it, so it cannot simply be dropped.
 *
 * `place` joins `partner` here: the situation was already stamped on the user's side
 * of an exchange, and the partner's side is the half that says how well they were
 * heard, so it is the half a per-room reading has to come from. */
export function finalizePartner(exchanges, handle, { rawTranscript, cleanedTranscript, partner = null, place = null, stt = null, uncertain = [], timestamp }) {
    const flagged = Array.isArray(uncertain) ? uncertain.filter((w) => typeof w === 'string' && w.trim()) : [];
    if (handle) {
        handle.rawTranscript = rawTranscript;
        handle.cleanedTranscript = cleanedTranscript;
        handle.uncertain = flagged;
        pushRevision(handle, rawTranscript, timestamp);
        if (partner) handle.partner = partner;
        if (place) handle.place = place;
        if (stt) handle.stt = stt;
        return handle;
    }
    const turn = {
        timestamp: timestamp || new Date().toISOString(),
        role: 'partner',
        rawTranscript,
        cleanedTranscript,
        uncertain: flagged,
        partner,
        place,
        stt,
    };
    exchanges.push(turn);
    return turn;
}
