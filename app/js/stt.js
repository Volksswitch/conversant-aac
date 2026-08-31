import * as platform from './platform.js';
import * as deepgram from './stt-deepgram.js';

let recognition = null;
// A non-browser capture backend (Deepgram), or null when using the built-in
// recognizer. Only one is ever active.
let externalSource = null;
// Which one heard the partner — recorded against each turn in the conversation log,
// so a replay or a critique knows what produced the transcript it is reading.
let backend = 'browser';
export function currentBackend() { return backend; }
// Per-platform recognition tuning (see platform.js). Defaults are the desktop
// values; init() replaces them with the platform's.
let speechCfg = { continuous: true, restartDelayMs: 0, guardVisibility: false };
// Set when recognition was stopped because the page went into the background,
// NOT because the user stopped listening. Distinguishing the two matters:
// listeningIntent must stay true so we resume on return, but onend must not
// restart while we are deliberately suspended, or it fights the guard.
let suspendedForHidden = false;
let onTranscript = null;
let onSilencePeriod = null;
let onStatusChange = null;
let onPartnerActivity = null;   // fired when genuine (non-echo) partner speech arrives
let accumulatedText = '';
let segments = [];          // each finalized statement, in order (accumulatedText = joinParts(segments))
let currentInterim = '';
let silenceTimer = null;
let silenceThreshold = 2000;
let listeningIntent = false;

/*
 * What listening actually DID, for a problem report.
 *
 * The failure this exists for is silent by construction: if the recognizer stops
 * when the page is backgrounded, the app goes on showing a lit microphone and simply
 * hears nothing - the user finds out when the other person's words never appear, and
 * has no way to describe what happened. The iPad has a guard for exactly that; no
 * other platform does, because nowhere else was it known to happen. A phone or tablet
 * is backgrounded constantly, so it is worth knowing rather than assuming.
 *
 * Counts and timings only - never words. Same rule as every other diagnostic here.
 */
const listenStats = {
    sessions: 0,          // recognition.start() calls - a restart loop shows up here
    restartsWhileHidden: 0,
    backgrounded: 0,      // times the page was hidden WHILE the user meant to listen
    resultsAfterReturn: 0,// results heard after coming back - 0 is the bad answer
    returnedToForeground: 0,
    errors: {},           // by kind, including the ones onerror deliberately ignores
};
function noteListen(key) { listenStats[key] = (listenStats[key] || 0) + 1; }

// How long from opening the microphone to the FIRST thing heard, per listening run.
// Ken's question - "the microphone is slow to turn on" - and it is not answerable by
// eye, because the delay is partly the recognizer starting and partly the person not
// having said anything yet. Recorded only for a run that DID hear something, so a
// long quiet stretch cannot be mistaken for a slow start.
let openedAt = 0;
let heardThisRun = false;
const firstHeardMs = [];

export function listenTimings() {
    if (!firstHeardMs.length) return 'no runs heard anything yet';
    const sorted = [...firstHeardMs].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return `firstHeardMs median=${median} min=${sorted[0]} max=${sorted[sorted.length - 1]} ` +
           `over ${sorted.length} run(s)`;
}

export function listenActivity() {
    const e = Object.entries(listenStats.errors).map(([k, n]) => `${k}x${n}`).join(',') || 'none';
    return `sessions=${listenStats.sessions} backgrounded=${listenStats.backgrounded} ` +
           `restartsWhileHidden=${listenStats.restartsWhileHidden} ` +
           `returns=${listenStats.returnedToForeground} heardAfterReturn=${listenStats.resultsAfterReturn} ` +
           `errors=${e}`;
}

// Watch visibility on EVERY platform, for the record only. This does not change
// behaviour anywhere - the iPad's guard is separate and untouched - it just means a
// report can say whether the app was backgrounded and whether it heard anything
// afterwards, instead of leaving that to be guessed at.
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (!listeningIntent) return;
        if (document.hidden) noteListen('backgrounded');
        else noteListen('returnedToForeground');
    });
}
// Echo filtering. While the app speaks (placeholder ladder, prompts), the mic would
// otherwise capture our own TTS, treat it as partner speech, append it to
// accumulatedText and renew the silence timer — restarting the placeholder ladder
// and abandoning the in-flight response generation. We do NOT mute the mic
// (that would also drop a partner who talks over us). Instead we keep a list of
// phrases the app is currently speaking and discard any captured segment that
// matches one — only genuinely new partner content renews the turn. Each phrase
// stays active for a tail window past the end of speech to cover recognition
// lag and the trailing audio.
const activePhrases = [];      // [{ text: <normalized>, tokens: <string[]>, expires: <ms epoch|Infinity> }]
// Two separate windows after the app stops speaking (Ken, July 13 2026):
//  - ECHO_TAIL_MS: the checkpoint gate (speechActive) — kept short so a genuine
//    partner reply right after we speak isn't delayed.
//  - ECHO_MATCH_MS: how long a spoken phrase stays MATCHABLE for excision — kept
//    longer because the cloud recognizer often returns our echo a couple seconds
//    late (after the tail), and if the phrase has already expired the late echo
//    slips through and pollutes the partner turn.
const ECHO_TAIL_MS = 1500;
const ECHO_MATCH_MS = 4000;

// Trigger-level guard against the TTS feedback loop (Ken, June 18 2026). The
// content filter (isEcho) drops captured segments that MATCH what we're saying,
// but the recognizer often mis-hears our own playback (drops/adds a word) so the
// echo slips past, renews the silence timer and re-fires generation — the
// runaway loop (stack grows, options flicker). Content matching can't be made
// robust against mis-transcription, so we also gate at the trigger: while the
// app itself is speaking (and for the echo tail after), captured audio does NOT
// reset the silence timer and the checkpoint does NOT fire. The mic stays on and
// non-echo content still accumulates into the transcript; it just can't drive a
// generation checkpoint while WE are the ones making noise. A genuine partner
// turn fires normally once the app falls quiet.
let appSpeaking = false;       // true between noteSpokenStart and noteSpokenEnd
let speechSettleUntil = 0;     // ms epoch the tail window after speech ends

function speechActive() {
    return appSpeaking || Date.now() < speechSettleUntil;
}

// Join finalized segments (and/or the in-progress interim) with single spaces. The
// recognizer returns each segment WITHOUT a separating space, so "Good morning."
// + "How are you?" would otherwise concatenate into "Good morning.How are you?"
// (Ken, July 13 2026). Trims each part and drops empties so there are no doubles.
function joinParts(parts) {
    return parts.map((s) => (s || '').trim()).filter(Boolean).join(' ');
}

export function isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function setSilenceThreshold(seconds) {
    silenceThreshold = seconds * 1000;
}

// Normalize for echo comparison: lowercase, strip punctuation, collapse runs of
// whitespace. So "Give me a second." and a recognizer's "give me a second"
// match.
function normalizeForEcho(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Wired to tts speaking-state in app.js. noteSpokenStart(text) registers a
// phrase the app is now speaking; noteSpokenEnd() lets the active phrases
// expire after a tail window (they stay matchable until then).
export function noteSpokenStart(text) {
    appSpeaking = true;
    const norm = normalizeForEcho(text || '');
    if (!norm) return;
    // While speaking, the phrase never expires; noteSpokenEnd sets the deadline.
    // Pre-tokenize for the fuzzy slice matcher (isEcho).
    activePhrases.push({ text: norm, tokens: norm.split(' '), expires: Infinity });
}

export function noteSpokenEnd() {
    appSpeaking = false;
    speechSettleUntil = Date.now() + ECHO_TAIL_MS;      // checkpoint gate — short
    const deadline = Date.now() + ECHO_MATCH_MS;        // matchable window — longer
    for (const p of activePhrases) {
        if (p.expires === Infinity) p.expires = deadline;
    }
}

// Levenshtein distance, only meaningful for the small threshold we compare against
// (early-out when the lengths differ by more than 2 — too far for a mis-hearing).
function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
        let prev = dp[0];
        dp[0] = j;
        for (let i = 1; i <= a.length; i++) {
            const tmp = dp[i];
            dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return dp[a.length];
}

// Two tokens are "similar" if equal or a short mis-hearing apart — the recognizer
// swaps a vowel/consonant on our own playback ("still" → "steel"). Allow up to 2
// edits for words of length >= 4, 1 for length 3; short words must match exactly
// (too easy to collide otherwise).
function tokensSimilar(a, b) {
    if (a === b) return true;
    const minLen = Math.min(a.length, b.length);
    if (minLen < 3) return false;
    return editDistance(a, b) <= (minLen >= 4 ? 2 : 1);
}

// Is `needle` (tokens) a fuzzy CONTIGUOUS slice of `haystack` (tokens)? Slides the
// needle across the haystack; a window matches if at most ~1 token per 3 differs
// (a mis-heard word). This is what catches a partial echo — a suffix or middle
// slice of what we said, e.g. the recognizer returns only "had some time to relax"
// out of a longer response — which exact/prefix matching missed entirely.
function fuzzySlice(haystack, needle) {
    const nn = needle.length, hn = haystack.length;
    if (nn === 0 || nn > hn) return false;
    const maxMiss = Math.floor(nn / 3);
    for (let start = 0; start + nn <= hn; start++) {
        let miss = 0, ok = true;
        for (let k = 0; k < nn; k++) {
            if (!tokensSimilar(haystack[start + k], needle[k]) && ++miss > maxMiss) { ok = false; break; }
        }
        if (ok) return true;
    }
    return false;
}

// A captured segment is echo if, after normalizing, it matches an active spoken
// phrase. Empty-after-normalize segments (pure punctuation/noise) are treated
// as echo too. Expired phrases are pruned here.
//
// Matching, in increasing risk:
//   - exact:  the segment IS the phrase.
//   - prefix: the segment is a leading (sub-word) slice of the phrase — the
//             recognizer's interim results build up as a growing prefix ("give",
//             "give me", "give me a", …) of what we're saying.
//   - slice:  the segment fuzzily matches a CONTIGUOUS run of tokens ANYWHERE in
//             the phrase — a suffix or middle slice of our playback, tolerant of a
//             mis-heard word ("still"→"steel"). This catches the partial/lagged
//             echoes exact/prefix missed (Ken, July 13 2026). Multi-word only.
//   - embed:  our phrase fuzzily appears inside a longer captured segment — the
//             recognizer merged our playback with adjacent noise. Multi-word only,
//             so a short common token can't swallow real partner speech.
function isEcho(transcript) {
    const now = Date.now();
    for (let i = activePhrases.length - 1; i >= 0; i--) {
        if (activePhrases[i].expires < now) activePhrases.splice(i, 1);
    }
    if (activePhrases.length === 0) return false;
    const t = normalizeForEcho(transcript);
    if (!t) return true;
    const segTokens = t.split(' ');
    const multiWord = segTokens.length >= 2;
    return activePhrases.some(({ text: p, tokens: pTokens }) => {
        if (p === t) return true;                                       // exact
        if (p.startsWith(t)) return true;                              // interim prefix
        if (multiWord && fuzzySlice(pTokens, segTokens)) return true;  // echo is a slice of our phrase
        if (pTokens.length >= 2 && fuzzySlice(segTokens, pTokens)) return true; // our phrase inside a longer segment
        return false;
    });
}

/*
 * Does this settled text RE-SEND the last one rather than continue it?
 *
 * Measured on an Android tablet and phone (Chrome, August 31 2026): the recognizer
 * hands over the whole utterance-so-far on every update, so one sentence arrives as
 * a ladder of growing prefixes — "this" / "this is" / "this is a" / "this is a test"
 * — and filing each rung as its own statement produced
 *   "this this is this is a this is a test"
 * in the partner's turn, in the transcript, and in what was sent to the AI.
 * (Two mechanisms fit the captured data equally well: every rung marked final, or
 * the session ending and restarting between rungs so the flush in onend commits
 * each one. This rule neutralizes both, which is why it is not written against
 * either.)
 *
 * The rule: when settled text begins with the statement already recorded, it is a
 * fuller version of that statement, so it REPLACES it instead of being appended.
 * The ladder above collapses back to "this is a test".
 *
 * Deliberately UNCONDITIONAL rather than gated on Android. A well-behaved recognizer
 * sends only the new words, so this never fires on Windows or the iPad, and a rule
 * that is a no-op elsewhere is safer than a platform fork: it needs no detection, it
 * cannot drift out of step with the other platforms, and it stops doing anything on
 * its own the day Chrome changes. It also covers any future device that behaves the
 * same way, before anyone reports it.
 *
 * The cost, accepted: a partner who genuinely says "No." and then "No, I don't think
 * so." has the two merged into the second. Rare, and the merged turn still reads
 * correctly — against a garbled turn that reads as though the app is broken.
 *
 * Compared with punctuation and case stripped, so "This is a test." still recognizes
 * "this is a" as the rung below it.
 */
function resendsLastStatement(transcript) {
    if (!segments.length) return false;
    const prev = normalizeForEcho(segments[segments.length - 1]);
    const next = normalizeForEcho(transcript);
    if (!prev || !next) return false;
    return next === prev || next.startsWith(prev + ' ');
}

// Record a settled statement. Segment boundaries are what let Pardon drop just the
// last thing the partner said, so a re-sent statement must overwrite the rung it
// grew from rather than becoming a boundary of its own.
function commitSegment(transcript) {
    if (resendsLastStatement(transcript)) segments[segments.length - 1] = transcript;
    else segments.push(transcript);
    accumulatedText = joinParts(segments);  // single spaces between segments
}

/*
 * THE SHARED CORE — every backend feeds transcript text through these two, and
 * everything the conversation loop depends on lives here rather than in a backend:
 * accumulation into segments, the TTS-echo filter, the silence checkpoint that
 * fires generation, and the partner-resumed signal that cancels a placeholder.
 *
 * That placement is deliberate. The user's silence period is a setting, "Ask them
 * to repeat" drops the last segment, and interrupting a partner captures whatever
 * has been heard so far — none of which may behave differently because the audio
 * arrived from Deepgram rather than from the browser. A backend supplies text and
 * nothing else.
 *
 * `ingest` returns whether genuine (non-echo) partner content was heard.
 */
function ingest(transcript, isFinal) {
    // Drop our own TTS echo (a placeholder/response/prompt) — it must not
    // accumulate or renew the partner's turn. Only unique partner content gets through.
    if (isEcho(transcript)) return false;
    if (isFinal) {
        commitSegment(transcript);
        currentInterim = '';
    } else {
        currentInterim = transcript;
    }
    return true;
}

function afterIngest(heardPartner, sawFinal) {
    // The question a backgrounding report has to answer: after the app came back, did
    // it hear anything at all? Counted here rather than at the recognizer, so it means
    // "real partner content reached the app", not merely "an event fired".
    if (heardPartner && listenStats.returnedToForeground > 0) noteListen('resultsAfterReturn');
    if (heardPartner && !heardThisRun && openedAt) {
        heardThisRun = true;
        if (firstHeardMs.length < 50) firstHeardMs.push(Date.now() - openedAt);
    }
    // Only renew the partner's turn (reset the silence checkpoint) when genuine
    // partner content was heard AND the app isn't currently speaking. Pure echo
    // leaves the checkpoint alone (content filter), and any audio captured while we
    // speak — including mis-transcribed echo the filter missed — must not renew the
    // turn either (trigger-level loop guard).
    if (heardPartner && !speechActive()) {
        // Genuine partner speech: restart the silence checkpoint AND tell the app
        // the partner is talking again. If the partner resumes after a pause that
        // already fired a checkpoint, the app cancels the pending placeholder so it
        // doesn't speak over the partner (Ken, July 2026).
        resetSilenceTimer(sawFinal);
        if (onPartnerActivity) onPartnerActivity();
    }
    if (onTranscript) onTranscript(joinParts([accumulatedText, currentInterim]));
}

/*
 * `opts.source` selects the backend:
 *   omitted / 'builtin' — the browser's own recognizer (free; the Windows path,
 *                         and the only one that costs nothing).
 *   'deepgram'          — a paid streaming service via the user's own key, for the
 *                         platforms where the built-in one silently delivers
 *                         nothing. `opts.getDeepgramKey` reads the key at start
 *                         time so pasting one into Settings takes effect without a
 *                         reload.
 *
 * Falls back to the built-in recognizer if a paid backend is asked for but cannot
 * be constructed — an app that can hear is better than one that refuses to try.
 */
export function init({ onResult, onSilence, onStatus, onPartnerSpeech, source, getDeepgramKey, onBilled }) {
    backend = source === 'deepgram' ? 'deepgram' : 'browser';
    onTranscript = onResult;
    onSilencePeriod = onSilence;
    onStatusChange = onStatus;
    onPartnerActivity = onPartnerSpeech;

    if (source === 'deepgram') {
        externalSource = deepgram.createSource({
            getKey: getDeepgramKey || (() => ''),
            onText: (text, isFinal) => { afterIngest(ingest(text, isFinal), !!isFinal); },
            onStatus: (status, detail) => {
                if (status === 'error') handleSourceError(detail);
                else if (onStatusChange) onStatusChange(status);
            },
            onBilled,
        });
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    // Per-platform tuning (platform.js). On iPadOS continuous mode measured 2.4s
    // slower to a first result than non-continuous, and this app exists to beat the
    // ~4s awkward-silence threshold — so there it runs non-continuous and leans on
    // the restart-on-end loop below, which was already the shape of this code.
    speechCfg = platform.speechConfig();
    recognition.continuous = speechCfg.continuous;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let heardPartner = false;   // any non-echo content this event?
        let sawFinal = false;       // did the recognizer settle a segment? (the 0s trigger)
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (ingest(event.results[i][0].transcript, event.results[i].isFinal)) heardPartner = true;
            if (event.results[i].isFinal) sawFinal = true;
        }
        afterIngest(heardPartner, sawFinal);
    };

    recognition.onend = () => {
        // A silence period no longer ends recording. While the user still
        // intends to listen, the browser may stop continuous recognition on
        // its own (e.g. after a pause) — restart it so the partner's floor
        // stays open across silences. accumulatedText persists across restarts.
        // While suspended for backgrounding, do NOT restart: the visibility guard
        // owns the restart and will do it when the page comes back.
        if (listeningIntent && !suspendedForHidden) {
            // currentInterim holds words the recognizer has NOT finalized yet.
            // Ending the session discards them and the restarted session does not
            // re-hear audio already spoken — so an interim shown live but not yet
            // final vanishes on restart. If the user then interrupts right after,
            // those words are lost from the captured turn (Ken, July 12 2026:
            // partner said ~10 words, all shown live, but only the one finalized
            // segment "I was" was recorded on interrupt). Flush the pending interim
            // into accumulatedText before restarting so it's retained. No
            // duplication: the fresh session only transcribes audio from now on.
            // commitSegment, not a bare push: where a session ends between rungs of a
            // re-sent utterance (see resendsLastStatement), the flushed interim is a
            // fuller copy of the statement already recorded, not a new one.
            if (currentInterim.trim()) commitSegment(currentInterim);
            currentInterim = '';
            // A short beat before restarting where the platform needs it: with
            // continuous off, sessions end constantly by design, and restarting
            // synchronously into an immediately-ending session spins a tight loop.
            if (typeof document !== 'undefined' && document.hidden) noteListen('restartsWhileHidden');
            if (speechCfg.restartDelayMs > 0) {
                setTimeout(() => {
                    if (!listeningIntent) return;      // stopped while we waited
                    noteListen('sessions');
                    try { recognition.start(); } catch { /* already starting */ }
                }, speechCfg.restartDelayMs);
            } else {
                noteListen('sessions');
                try { recognition.start(); } catch { /* already starting */ }
            }
            return;
        }
        clearSilenceTimer();
        if (onStatusChange) onStatusChange('stopped');
    };

    // iOS stops recognition when the page is backgrounded WITHOUT telling the app,
    // which would otherwise leave it showing a live microphone and silently
    // hearing nothing. Suspend deliberately on hide and resume on return, keeping
    // listeningIntent intact across the gap so the user's intent is not lost.
    // (If more benign per-restart errors turn up during device testing, the
    // onerror allow-list below is where they belong — 'no-speech' and 'aborted'
    // are already ignored, which covers normal session teardown.)
    if (speechCfg.guardVisibility && typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            // ⚠ BOTH BACKENDS. This used to test `recognition` alone, so with a paid
            // backend selected - where `recognition` is null - the guard did nothing
            // at all. It was written when the browser recognizer was the only source,
            // and the gap became load-bearing the moment a platform was recommended
            // to use the paid one (Ken, Android, August 31 2026): the configuration
            // being recommended was the one configuration the guard did not cover.
            //
            // The paid path is not immune to this. It holds a microphone and a socket
            // of its own, and a backgrounded page has its audio pipeline suspended, so
            // it can just as easily come back deaf - and being paid, it fails in a way
            // the user has been told is the reliable option.
            if (!recognition && !externalSource) return;
            if (document.hidden) {
                if (listeningIntent && !suspendedForHidden) {
                    suspendedForHidden = true;
                    suspendSource();
                }
            } else if (suspendedForHidden) {
                suspendedForHidden = false;
                if (listeningIntent) openSource();
            }
        });
    }

    recognition.onerror = (event) => {
        // Counted BEFORE the allow-list: 'aborted' is normal once, and hundreds of
        // them is a restart loop, which is the thing worth seeing.
        listenStats.errors[event.error] = (listenStats.errors[event.error] || 0) + 1;
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        // A surfaced error (network / not-allowed / service-not-allowed /
        // audio-capture) is fatal for this session — see handleSourceError. Without
        // clearing the intent, onend would restart straight into the same error.
        handleSourceError(event.error);
    };
}

/*
 * "0 seconds" does NOT mean a zero-length timer, and the difference matters.
 *
 * This timer is restarted by every result the recognizer delivers — INTERIM ones
 * included, and those arrive mid-phrase, several a second. A zero-length timer would
 * therefore fire in the gap between two interim results, while the partner is still
 * mid-sentence, and would do it over and over: a generation call per fragment, all
 * but the last discarded by latest-wins. That is the opposite of what the setting is
 * asking for.
 *
 * What it asks for is: go the moment the recognizer itself reports that they have
 * stopped — which is exactly what a FINAL result is. So at 0 the checkpoint is driven
 * by the recognizer's own endpoint detection rather than by a clock, which is the
 * fastest honest answer available (Ken, August 9 2026).
 *
 * The fallback is not optional. A backend that is stingy with finals would otherwise
 * never fire a checkpoint at all — a silent dead end, the failure class this app has
 * been bitten by more than once. So an interim still arms a timer, just a short one.
 */
const ZERO_FALLBACK_MS = 1500;

function resetSilenceTimer(sawFinal) {
    clearSilenceTimer();
    if (silenceThreshold === 0) {
        silenceTimer = setTimeout(fireSilenceCheckpoint, sawFinal ? 0 : ZERO_FALLBACK_MS);
        return;
    }
    silenceTimer = setTimeout(fireSilenceCheckpoint, silenceThreshold);
}

function fireSilenceCheckpoint() {
    // The partner has gone quiet for the silence period. Hand the speech
    // collected so far to the app for response generation, but keep recording —
    // if the partner resumes, the next silence period will fire again with the
    // combined speech. Never fire while the app is speaking (or within the echo
    // tail): our own playback could otherwise drive a checkpoint. Re-check soon.
    if (speechActive()) {
        silenceTimer = setTimeout(fireSilenceCheckpoint, 200);
        return;
    }
    const text = joinParts([accumulatedText, currentInterim]);
    if (text && onSilencePeriod) onSilencePeriod(text);
}

function clearSilenceTimer() {
    if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }
}

// A surfaced error is fatal for this listening session whichever backend produced
// it: clear the intent so nothing restarts into the same failure (a tight loop when
// offline, since both backends are network services). The user re-taps to try again.
function handleSourceError(detail) {
    listeningIntent = false;
    if (onStatusChange) onStatusChange('error', detail);
}

// Open the microphone. Shared by startListening (a NEW partner turn) and
// resumeListening (a turn already in progress) — the only difference between the
// two is whether the accumulated transcript survives, so the recognizer/socket
// handling lives here once and cannot drift between them.
// Stop capturing WITHOUT clearing the user's intent to listen - the guard has to be
// able to put it back. stopListening() is the deliberate, user-driven stop and does
// clear the intent; conflating the two would turn a trip to the home screen into the
// user having switched listening off.
function suspendSource() {
    if (externalSource) { try { externalSource.stop(); } catch { /* not running */ } return; }
    try { recognition.stop(); } catch { /* not running */ }
}

function openSource() {
    listeningIntent = true;
    suspendedForHidden = false;   // a deliberate (re)start clears any backgrounded state
    if (externalSource) {
        // Async: the paid backend needs microphone permission and a socket. Its own
        // status callback reports 'listening' once it is actually up, so the button
        // does not claim to be listening before anything can be heard.
        externalSource.start();
        return;
    }
    noteListen('sessions');
    // Only the FIRST open of a run starts the clock: the restart-on-end loop reopens
    // the recognizer constantly, and timing from the latest reopen would measure the
    // gap since the last restart rather than how long the user waited.
    if (!openedAt) { openedAt = Date.now(); heardThisRun = false; }
    try { recognition.start(); } catch { /* already started */ }
    if (onStatusChange) onStatusChange('listening');
}

// Begin a NEW partner turn: whatever was captured before is gone.
export function startListening() {
    if (!recognition && !externalSource) return;
    resetTranscript();
    openSource();
}

// Reopen the microphone on a turn that is STILL IN PROGRESS, keeping what the
// partner has already said (Ken, August 5 2026).
//
// WHY THIS IS A SEPARATE ENTRY POINT. The buffer clear used to live inside
// startListening(), so a stop/start of the Listen button mid-turn erased the
// partner's uncommitted speech — the app then overwrote the already-written
// transcript line with the shorter text, losing it twice over. Deleting the clear
// outright was the other option, but that would make correctness depend on every
// future caller remembering to reset; naming the two intentions instead keeps the
// invariant visible at the call site.
//
// THE INVARIANT: the partner's turn ends at a FLOOR CHANGE — the user picks a
// response, asks for a pardon, or ends the conversation — never at a microphone
// toggle. Each of those paths already calls resetTranscript() explicitly, so they
// are unaffected by this split.
export function resumeListening() {
    if (!recognition && !externalSource) return;
    openSource();
}

export function stopListening() {
    if (!recognition && !externalSource) return;
    listeningIntent = false;
    suspendedForHidden = false;   // a deliberate stop outranks a backgrounded suspend
    openedAt = 0;                 // the run is over; the next Listen starts a new clock
    clearSilenceTimer();
    if (externalSource) return externalSource.stop();
    recognition.stop();
}

// The partner's speech heard so far this listening session — the finalized
// segments plus the in-progress interim. Lets the app capture what the partner
// had said the instant the user interrupts them (before a silence checkpoint has
// pushed it to the app), so an interruption doesn't lose their partial speech (Ken).
export function getCurrentTranscript() {
    return joinParts([accumulatedText, currentInterim]);
}

// Discard the speech collected so far without stopping recording. Used when the
// user asks the partner to repeat — the current exchange's text is thrown away
// and the system keeps listening for the partner's restated utterance.
export function resetTranscript() {
    accumulatedText = '';
    segments = [];
    currentInterim = '';
    clearSilenceTimer();
}

// Discard only the partner's most recent statement (the last finalized segment
// plus any in-progress interim), keeping earlier statements in the same turn.
// Used by Pardon? when only the last thing the partner said was garbled — the
// good earlier sentences shouldn't be thrown away. A "statement" is one final
// recognition result (≈ one utterance separated by a pause); if the recognizer
// split one sentence across results this drops only the last piece. Returns the
// remaining accumulated text. The silence timer is cleared so the dropped
// fragment can't fire a checkpoint; recording continues.
export function dropLastStatement() {
    currentInterim = '';
    if (segments.length) segments.pop();
    accumulatedText = joinParts(segments);
    clearSilenceTimer();
    return accumulatedText;
}
