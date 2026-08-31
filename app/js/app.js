import * as stt from './stt.js';
import * as tts from './tts.js';
import * as llm from './llm.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import * as placeholders from './placeholders.js';
import * as engine from './engine.js';
import * as convLogic from './conversation-logic.js';
import * as worldview from './worldview.js';
import * as relationships from './relationships.js';
import * as places from './places.js';
import * as worldviewUI from './worldview-ui.js';
import * as keyboard from './keyboard.js';
import { SIDE_LAYOUTS, BOTTOM_LAYOUTS, LAYOUTS } from './keyboard-layouts.js';
import * as viewport from './viewport.js';
import * as expressItems from './express-items.js';
import * as pronunciation from './pronunciation.js';
import * as expressPanel from './express-panel.js';
import * as expressBands from './express-bands.js';
// Named voiceProfile, not voice: app.js already uses `voice` as the loop variable
// for a SpeechSynthesisVoice in the two TTS pickers, and a module shadowed inside
// those callbacks would fail silently rather than loudly.
import * as voiceProfile from './voice.js';
import * as expressEditor from './express-editor.js';
import * as controlPhrases from './control-phrases.js';
import * as controlEditor from './control-phrases-editor.js';
import * as placeholderPhrases from './placeholder-phrases.js';
import * as placeholderEditor from './placeholder-editor.js';
import * as whatsNew from './whats-new.js';
import * as chime from './chime.js';
import * as practiceScenarios from './practice-scenarios.js';
import * as practiceTour from './practice-tour.js';
import * as dataTransfer from './data-transfer.js';
import * as platform from './platform.js';
import * as sttDeepgram from './stt-deepgram.js';
import * as ttsDeepgram from './tts-deepgram.js';
import { confirmDanger } from './confirm-dialog.js';
import * as helpMode from './help-mode.js';
import * as usageSummary from './usage-summary.js';
import * as diagnostics from './diagnostics.js';
import * as weeklySend from './weekly-send.js';
import * as metrics from './metrics.js';
import { makeCollapsible } from './sections.js';

// The platform verdict on partner capture (see platform.js), or null when capture
// is expected to work. Non-null drives the pre-start warning; it does NOT by
// itself disable anything — see applyListenAvailability.
let listeningUnavailable = null;

// Disable the Listen control ONLY where there is no recognizer to call at all —
// never merely because this platform measured unreliable (Ken, July 30 2026:
// "for now, don't disable the listening function… give Safari every opportunity to
// surprise us"). The user is warned before they start and then allowed to try; a
// measurement taken on one build of one iPadOS should not permanently refuse to
// attempt something Apple may have since fixed. Where the API is genuinely absent
// there is nothing to attempt, so the button would silently do nothing — that case
// stays disabled.
//
// Practice Mode is exempt even then: that same button never opens the microphone,
// it cues the AI partner to speak. Rehearsing without a mic matters most precisely
// on a device that cannot listen, so the disable must not reach it. Re-applied
// whenever practice starts or ends.
function applyListenAvailability() {
    const btn = document.getElementById('listenBtn');
    if (!btn) return;
    const noRecognizer = !!listeningUnavailable && listeningUnavailable.apiPresent === false;
    const blocked = noRecognizer && !practiceMode;
    btn.disabled = blocked;
    if (blocked) btn.title = listeningUnavailable.reason + ' ' + listeningUnavailable.remedy;
    // Not blocked: let the normal renderer put the icon and its tooltip back.
    // isListening is false on every path that reaches here, so this cannot fire
    // the start-of-listening chime (which needs a false→true edge).
    else ui.setListenButtonState(isListening);
}

// Point-release version shown in Settings → About. Bump alongside the
// sw.js CACHE_VERSION on every release so beta testers can report exactly
// which build they're on.
const APP_VERSION = '0.9.2';

// The exact commit this build came from. Rewritten by the deploy workflow (it
// substitutes the placeholder below); a copy served from the working tree keeps
// the placeholder and reports "dev".
//
// Why this exists: the version alone can't answer "am I looking at the delivery I
// just pushed?" — several pushes share one version during a dev cycle, and the
// version lives in Settings → About, which is unreachable until Start has run. So
// when start-up is what's broken, there was no way to tell a new build from a
// cached old one (Ken, July 30 2026). This shows on the pre-start screen, before
// anything can go wrong.
const BUILD_STAMP = '@@BUILD@@';
const BUILD_ID = BUILD_STAMP.startsWith('@@') ? 'dev' : BUILD_STAMP;

// The known-issues list lives on the web, not in the app (Ken, August 9 2026), so
// it stays current between releases and can be corrected without one. Named here
// and in the Beta Test Plan; if it ever moves, both change.
const KNOWN_ISSUES_URL = 'https://volksswitch.org/index.php/conversant-aac-known-issues/';

const conversationHistory = [];
let isListening = false;
let lastPalette = [];
// Practice Mode (§8): the AI plays the partner; the mic is bypassed. When active,
// the listen/response/teardown paths fork to the practice equivalents below.
let practiceMode = false;
let practiceScenario = null;
// The controls tour's position, when the chosen "scenario" is the tour (it carries
// `steps` instead of a partnerPersona). Null in every other practice session and in
// every real conversation.
let tour = null;
// Raw, combined speech-to-text for the partner's current (uncommitted) turn.
// Grows across silence periods until the user picks a response.
let currentPartnerText = '';
/* Words in the partner's turn the model suspects the recognizer got wrong, from the
 * most recent generation for THIS turn (llm `heard_uncertain`). Recorded onto the
 * saved turn when it is committed, so the weekly report can say how often the
 * microphone is struggling -- and, because turns carry who and where, whether it
 * struggles more with a particular person or in a particular room.
 *
 * Overwritten rather than accumulated: each pause re-sends the FULLER utterance, so
 * the latest answer is about the whole turn and the earlier ones are about fragments
 * of it. Cleared wherever currentPartnerText is. */
let currentPartnerUncertain = [];
// The alternatives the partner has on the table right now ("mild","moderate",
// "severe") — from the classification's offered_options. They fill the Express
// Panel's reserved choice cells so the user can ask for the full four-response
// treatment of one of them; [] whenever no closed set is open.
let offeredChoices = [];
// A number the partner asked for ("on a scale of one to ten", "how many?"), rather
// than a choice between named things. Never set at the same time as offeredChoices —
// a scale of ten is not ten buttons, it is the number pad (Ken, August 22 2026).
let offeredRange = null;
// True while the composer is open to answer a number question, which is the only
// state in which Enter speaks instead of inserting a line break.
let composerForNumber = false;
// How the user has steered THIS partner turn: a tapped choice chip and/or the
// text they typed into Reframe. "New N" must re-apply it (Ken, July 27 2026 —
// pressing it after choosing "milk" was throwing the choice away and coming back
// with all three options): "give me different options" means different options
// UNDER THE SAME STEERING, not a reset. The two are independent — a chip replaces
// the chip, Reframe text replaces the text — and both last only as long as the
// partner turn they steer, which is what keeps Reframe one-shot ACROSS turns
// (the standing v0.3.20 decision) while making it stick WITHIN one.
let activeSteer = { focusChoice: null, steer: null };
// Bumped whenever a speaking button that does NOT consume the partner turn (Say
// again / Hold on / Wind down) fires, so an already-in-flight generateOptions won't
// re-schedule a placeholder after the user has acted — WITHOUT discarding the
// response options it's still producing (that's why this is separate from
// generationToken, which a response selection uses to cancel generation outright).
let placeholderEpoch = 0;
// Cumulative audio (seconds) the paid transcription backend has uploaded since it
// was last started — the source reports a running total, so this holds the last
// value seen in order to store only the increment.
let sttBilledThisSession = 0;
// Abort placeholders now AND stop an in-flight generation from restarting one.
function abortPlaceholders() {
    placeholders.stop();
    placeholderEpoch++;
}
// Index in conversationHistory of the partner's current turn ONCE it has been
// promoted from the bottom "live" line into the ordered history — which happens
// when a user turn (a Say-again / Hold on / Ask-them-to-repeat command) is logged
// mid-turn, so that user turn renders AFTER the partner turn (mirroring the
// transcript, where the partner turn is written at its pause). -1 = not promoted
// (still the live line). Reset per partner turn; commitExchange finalizes it.
let pendingPartnerHistoryIdx = -1;
// Increments on every silence period / reset so that a slower, earlier
// option-generation round-trip can't overwrite a newer one — latest wins.
let generationToken = 0;
// Auto-resume gate (CLAUDE.md Further Design Thoughts #4): listening is never
// started automatically at app startup. The user must manually invoke Start
// Listening at least once per session before auto-resume can fire; a manual
// Stop re-arms the requirement. Set true by a manual start, false by a manual
// stop. The automatic stop when a response is selected does NOT clear it — that
// is exactly the boundary auto-resume is meant to continue past.
let manualListenArmed = false;

// Active influencer TOGGLES from the Express Panel (Ken, June 26 2026). One
// active Partner (who the user is talking with), one active Feeling (current
// mood) and one active Place (where the user is) at a time. The Partner
// personalizes openers + tells the AI who the partner is; the Feeling steers the
// tone of suggestions; the Place is Phase-2 situational awareness without GPS —
// it tells the AI the setting, which shapes what a plausible response even is
// (Ken, August 3 2026). Persist across an exchange; cleared only by tapping the
// same toggle again or picking another.
let activePartner = null;
let activeFeeling = null;
let activePlace = null;

// Conversation privacy (Ken, July 2026): when true, the current conversation is
// NOT written to the data folder — the user may want a conversation that can't be
// retrieved later. Seeded from the Settings default at the start of each
// conversation; the Command Bar "Don't save" button toggles it live.
let conversationPrivate = false;

// True while the app is speaking one of the USER's OWN statements (a selected
// response, composed text, an Express phrase, an opener/closer, a repaired
// utterance, or "Ask them to repeat" / "Repeat what I said"). The user's statements
// are shown directly in the transcript, so they must NOT also appear as the
// tentative "now-playing" pre-text line (Ken) — that line is reserved for
// system-generated placeholder speech the user can't otherwise see.
//
// "Hold on" is deliberately NOT in that list any more: it is a placeholder the user
// fires themselves, so it goes to the now-playing line like every other placeholder
// and into no transcript at all. It still sets this flag, because nothing may speak
// over it either — hence the second flag below.
let speakingUserStatement = false;
// ...unless this particular statement is one the user cannot account for. See
// speakUserStatement's `announce` option.
let announcingUserStatement = false;

/* Speak text that IS the user's own statement: suppress the now-playing pre-text
 * line for its duration (the statement is already in the transcript).
 *
 * `announce: true` keeps the now-playing line, for a statement that goes into NO
 * transcript - today that is "Hold on" alone, and the reason is that it draws a
 * phrase at RANDOM from the placeholder pool (Ken, comment 76). The user pressed
 * the button, so they know something was said; they do not know WHICH of their
 * phrases their own voice just used, and that is exactly the speech the line
 * exists for. It still holds the gate, so an automatic placeholder cannot barge
 * over it.
 */
async function speakUserStatement(text, { announce = false } = {}) {
    speakingUserStatement = true;
    announcingUserStatement = announce;
    try { await tts.speak(text); }
    finally { speakingUserStatement = false; announcingUserStatement = false; }
}

// Spoken help in Settings: arm the "?", then tap a control, its label, or a tab to
// hear what it does. See help-mode.js for the interaction model and why every tap is
// intercepted before the control sees it.
let speakingHelp = false;

function initSpokenHelp() {
    helpMode.init({
        dialog: document.getElementById('settingsDialog'),
        helpBtn: document.getElementById('settingsHelpBtn'),
        speak: async (text) => {
            // Suppressed from the now-playing line for the same reason a user
            // statement is: that line is for speech the user cannot otherwise
            // account for, and help is something they just asked for.
            speakingHelp = true;
            // The SAME selection Practice Mode uses, and BOTH backends, so the rule
            // holds whichever voice the user is on — see the note above pickPartnerVoice.
            try { await tts.speak(text, { voiceURI: pickPartnerVoice(), auraModel: pickAuraPartnerVoice() }); }
            finally { speakingHelp = false; }
        },
        cancel: () => tts.cancel(),
        // No entry: say the control's own label rather than nothing. Silence would
        // read as a broken feature, and the label is usually informative on its own.
        labelFor: (key, groupEl) => {
            const id = key && key.startsWith('control:') ? key.slice('control:'.length) : null;
            const own = id && document.querySelector(`#settingsContent label[for="${CSS.escape(id)}"]`);
            const label = own || (groupEl && groupEl.querySelector('label'));
            return label ? label.textContent.trim() : '';
        },
    });
}

// WHICH VOICE READS THE HELP — the practice partner's, on every platform and both
// backends (Ken, Aug 2 2026: "This sounds like the right thing to do regardless of
// platform").
//
// The reason it generalizes is that help and the practice partner have the SAME two
// requirements, and they pull against each other: the voice must be audibly NOT the
// user's — otherwise the app explaining itself sounds like the user saying it — and
// it must be intelligible. `pickPartnerVoice` already resolves exactly that tension:
// it excludes novelty voices, prefers a different voice in the SAME language, and
// falls back to the user's own when no usable alternative exists. One selection,
// both features, no third voice for the user to discover and no way to configure.
//
// The iPad is what made the tension visible rather than what caused it. Ken: "there's
// only one non-silly voice available on an iPad. If they choose the one non-silly
// voice as their own, then a tool tip would be read in what might be an unintelligible
// voice." That is the sharpest case, not a special one — picking "any voice that is
// not theirs" is wrong on Windows too, just less catastrophically.
//
// BOTH backends, which the first cut got wrong: it passed only `voiceURI`, so on a
// paid Deepgram voice the override was ignored and help spoke in the user's OWN Aura
// voice — intelligible, but indistinguishable from them, which is half the point lost.
// Passing `auraModel` as well mirrors what advancePracticePartner does.
//
// CONSEQUENCE, so it is not a surprise: help and the practice partner sound alike, and
// Settings → Speech → "Practice partner voice" changes both. That is the lever the
// user has over the help voice; without the coupling there would be none at all.

function applyPrivacyState() {
    storage.setConversationSaving(!conversationPrivate);
    ui.setPrivacyState(conversationPrivate);
}

// What the partner has said so far this turn, at the moment the user acts. The
// live STT transcript is more complete than currentPartnerText (which is only
// refreshed at each silence checkpoint), so interrupting the partner mid-utterance
// — e.g. an instant "Bye" before they've paused — still records what they'd said
// up to that point instead of dropping it (Ken). Falls back to currentPartnerText.
function heardPartnerText() {
    return (stt.getCurrentTranscript() || currentPartnerText || '').trim();
}

// Show the partner's in-progress text. Normally the bottom "live" line; but once
// the turn has been promoted into the history (a user turn was logged mid-turn),
// keep updating THAT entry in place so the partner turn stays correctly positioned
// above the later user turn (no duplicate live line).
function updatePartnerLive(text) {
    if (pendingPartnerHistoryIdx >= 0 && conversationHistory[pendingPartnerHistoryIdx]) {
        conversationHistory[pendingPartnerHistoryIdx].text = text;
        ui.renderConversation(conversationHistory);
        ui.setLiveTranscript('');
    } else {
        ui.setLiveTranscript(text);
    }
}

// Promote the live partner turn into the conversation history so a user turn logged
// now renders AFTER it (mirroring the transcript). Idempotent per turn (guarded by
// pendingPartnerHistoryIdx); commitExchange finalizes this entry. No-op when there's
// no live partner text.
function flushLivePartnerToHistory() {
    if (pendingPartnerHistoryIdx >= 0) return; // already promoted this turn
    const raw = heardPartnerText();
    if (!raw) return;
    conversationHistory.push({ role: 'partner', text: raw });
    pendingPartnerHistoryIdx = conversationHistory.length - 1;
    ui.renderConversation(conversationHistory);
    ui.setLiveTranscript('');
}

// Place the partner turn in the history for a commit: if it was already promoted
// (a mid-turn user command), update that entry in place (preserving its position
// before the intervening user turn); otherwise append it. Returns its index; clears
// the promoted-turn tracker.
/* ⚠ NO "uncleaned" FLAG ON A COMMITTED TURN ANY MORE. It used to mark a turn the AI
 * had not tidied, in blue italics -- a real distinction while some turns were tidied
 * and some were not. Nothing is tidied now, so it would have been true of every turn
 * and would have read as "every line of this conversation is degraded". The live
 * turn keeps its own 'uncleaned' state, which means something different and still
 * holds: the AI is unreachable RIGHT NOW. */
function placePartnerTurn(raw) {
    if (pendingPartnerHistoryIdx >= 0 && conversationHistory[pendingPartnerHistoryIdx]) {
        const idx = pendingPartnerHistoryIdx;
        conversationHistory[idx].text = raw;
        pendingPartnerHistoryIdx = -1;
        return idx;
    }
    pendingPartnerHistoryIdx = -1;
    conversationHistory.push({ role: 'partner', text: raw });
    return conversationHistory.length - 1;
}

// Finalize the storage-side pending partner turn as-is (raw = cleaned, no AI
// round-trip), so a later interim can't re-open and append to it. Used by Pardon,
// where the partner's re-speak must start a fresh turn.
function finalizePendingPartnerTurn() {
    const h = storage.detachPendingPartnerTurn();
    if (h) storage.finalizePartnerTurn(h, { rawTranscript: h.rawTranscript, cleanedTranscript: h.rawTranscript, partner: partnerStamp() });
}

function handlePrivacyToggle() {
    conversationPrivate = !conversationPrivate;
    applyPrivacyState();
}

function initApp() {
    // Stamp the error log with this build's version (Ken, July 2026).
    storage.setAppVersion(APP_VERSION);

    // Counting rides on the SAME switch as the weekly report, so a tester who turns
    // reporting off is not still having their taps written to disk. Set before the
    // first event below, or that one event escapes the setting.
    metrics.setEnabled(storage.loadWeeklySendEnabled());
    // THE APP WAS OPENED. Paired with start_pressed and conversation_started, this is
    // the clearest early-quit signal there is: a tester who opens the app and never
    // starts a conversation is drifting away while still nominally taking part, and
    // today looks identical to one who has stopped opening it altogether.
    metrics.event(metrics.EV.APP_OPENED);
    // The tally is held in memory and written on a debounce, so a page going away
    // between writes would lose the last couple of seconds. Both events fire on a
    // tablet where the app is backgrounded rather than closed.
    window.addEventListener('pagehide', () => metrics.flush());
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') metrics.flush();
    });

    // Any logged error (thrown API/parse failure OR a silent no-responses path)
    // trips a faint-red wash on the transcript — a non-verbal heads-up that a
    // hiccup occurred and behavior may deviate; cleared on the next working
    // cycle (a real palette render) or on conversation reset.
    window.addEventListener('aac-error-logged', () => ui.setTranscriptError(true));

    // Log the display metrics (and re-log on every viewport change) so we — and
    // beta testers — can see the real pixel box the app is running in. Started
    // first so the initial numbers are captured even if STT is unsupported.
    viewport.init();

    // Can this environment actually capture the partner? platform.js answers from
    // MEASURED behavior, not feature detection — on iPadOS the API is present and
    // starts happily in a Home Screen app and in Chrome/Edge, then delivers nothing
    // at all. Trusting stt.isSupported() there would leave the user staring at a
    // lit microphone that will never hear a word, which for an AAC user is worse
    // than being told plainly. The app remains fully usable without capture (the
    // AI-optional property): the Express Panel and "In my own words" still speak,
    // and turns are still recorded — so this disables listening, not the app.
    // A paid backend bypasses the platform verdict entirely: it does its own
    // capture and never touches the browser's recognizer, so "Safari delivers
    // nothing in a Home Screen app" simply does not apply to it. That is the whole
    // point of paying — capture where the platform has none.
    const sttProvider = storage.loadSttProvider();
    const usingPaidStt = sttProvider === 'deepgram' && !!(storage.loadDeepgramKey() || '').trim();
    const speechSupport = platform.speechRecognitionSupport();
    listeningUnavailable = (usingPaidStt || speechSupport.usable) ? null : speechSupport;

    // Recording indicator: whether the start-of-listening chime is enabled
    // (partner-awareness cue — see chime.js). Applied here so it's active before
    // the first listen; also live-updated from Settings.
    chime.setEnabled(storage.loadListenChime());
    // With auto-resume on, the mic restarts every exchange — chime only at the
    // start of the conversation rather than on each one (Ken).
    chime.setOncePerConversation(storage.loadAutoRelisten());

    // Wire up capture wherever there is a recognizer to wire — including the
    // platforms platform.js measured as delivering nothing. That is the whole
    // point of warning rather than blocking (Ken, July 30 2026): if the button is
    // live but stt was never initialized, pressing it would do nothing and Safari
    // could never surprise us. Skipped only where the API is absent, because
    // `new SpeechRecognition()` would throw.
    //
    // Every stt entry point is null-safe when init() never ran (`if (!recognition)
    // return`), so on that path the rest of the app calls them harmlessly and no
    // microphone is ever lit. Initialization MUST continue past this point:
    // everything below — the Start button, the Express Panel, "In my own words",
    // the keyboard, Settings — is what the notice promises still works, and an
    // early return here left an iPad Home Screen app with no working controls at
    // all, Start included (Ken, July 30 2026).
    if (speechSupport.apiPresent || usingPaidStt) {
        stt.setSilenceThreshold(storage.loadSilenceThreshold());
        // Stamp every partner turn with what heard it. Set beside init because that
        // is what fixes the choice; changing it needs a reload, so this cannot drift.
        storage.setSttBackend(usingPaidStt ? 'deepgram' : 'browser');
        stt.init({
            onResult: handleSpeechResult,
            onSilence: handleSilencePeriod,
            onStatus: handleSttStatus,
            onPartnerSpeech: handlePartnerResumed,
            source: usingPaidStt ? 'deepgram' : 'builtin',
            // Read at start time, so a key pasted into Settings works on the next
            // Listen rather than needing a reload.
            getDeepgramKey: () => storage.loadDeepgramKey() || '',
            onBilled: handleSttBilled,
        });
    }

    // Hard backstop: a placeholder must never speak over the user's own statement
    // (a spoken button, or the composed statement itself). If a stray scheduled
    // placeholder fires while the user's TTS is playing, placeholders defers instead
    // of barging in (Ken, July 2026).
    //
    // ⚠ THE GATE COVERS SPEECH AND NOTHING ELSE. It used to carry `composerOpen` too
    // (August 20 2026), so the app stayed silent for as long as "In my own words" was
    // open, however long that was — and because the gate DEFERS rather than counting,
    // no placeholder was ever spent, so it was silent indefinitely rather than merely
    // late. Ken reversed it on August 25 2026, and his reasoning is the rule to keep:
    // COMPOSING IS THE EQUIVALENT OF READING THE OFFERED CARDS, so it follows the same
    // placeholder rules. Both are the user deciding what to say while the other person
    // waits, and the whole purpose of a floor-holder is to fill exactly that gap — the
    // longer it runs, the more it is needed. Typing is the SLOWER of the two, so the
    // old behaviour left the longest silences in the app entirely unfilled.
    //
    // What still holds while the box is open, unchanged: the partner speaking again
    // aborts and resets the ladder, tapping Speak stops it, and the per-turn cap ends
    // it — so it goes quiet after the same two phrases it would have said anyway.
    placeholders.setUserSpeakingGate(() => speakingUserStatement);

    // Count the floor-holding phrases as they are actually spoken. Nothing else can:
    // they are scheduled on timers, aborted by the partner resuming, and capped by a
    // setting, so how many a partner really hears per turn is not derivable from the
    // settings or from the saved conversation.
    placeholders.setOnSpoken(({ n }) => metrics.event(metrics.EV.PLACEHOLDER_SPOKEN, { n }));

    // Tell the STT layer what the app is speaking so it can discard its own TTS
    // echo (placeholder ladder, prompts) instead of mistaking it for the partner and
    // renewing the partner's turn. The mic stays on throughout — only matching
    // echo content is dropped.
    tts.onSpeakingChange((speaking, text) => {
        if (speaking) stt.noteSpokenStart(text);
        else stt.noteSpokenEnd();
    });

    // Surface what the app is saying on the user's behalf as text in Region A —
    // nothing the system speaks is invisible (UI-Design.docx §7). Reserved for
    // SYSTEM speech (placeholders): the user's OWN statements go straight to the
    // transcript, so showing them here as tentative "pre-text" is redundant (Ken).
    tts.onSpeakingChange((speaking, text) => {
        // Help is excluded for the same reason a user statement is: this line exists
        // for speech the user cannot otherwise account for, and help is something
        // they just asked for — and it plays behind an open Settings panel anyway.
        if (speaking && ((speakingUserStatement && !announcingUserStatement) || speakingHelp)) return;
        ui.setNowPlaying(speaking ? text : null);
    });

    document.getElementById('startBtn').addEventListener('click', handleStart);
    // API-key notice (step 3 of the pre-start sequence): "Add an API key" opens
    // Settings; "Continue" proceeds into the conversation without a key.
    document.getElementById('apiKeyPromptBtn').addEventListener('click', () => {
        openSettings();
        revealSetting('apiKeyInput');   // the button promises the field, not the tab
    });
    // Reporting from the launch screen. Wired here, early in init, ON PURPOSE: the
    // tester who most needs it is the one whose app did not finish starting, so this
    // listener must be attached before anything that could throw. It saves straight
    // to a file with no note, because the panel you would type a note into is
    // exactly what may be unreachable (Ken, August 7 2026).
    const startReportBtn = document.getElementById('startReportBtn');
    if (startReportBtn) startReportBtn.addEventListener('click', () => sendProblemReportFromStart());
    document.getElementById('apiKeyContinueBtn').addEventListener('click', finishStart);

    // The click IS the fix: a permission request is only granted while the browser
    // still counts a tap as recent, and this handler runs directly inside one.
    // restoreDataFolder is deliberately reused rather than given a second entry
    // point — the code path that failed is the code path that must now succeed.
    document.getElementById('folderReconnectBtn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        let ok = false;
        try { ok = await storage.restoreDataFolder(); } catch { ok = false; }
        if (ok) {
            try { await adoptDataFolder(); } catch { /* best-effort */ }
            btn.disabled = false;
            dismissFolderNotice();
            return;
        }
        // ⚠ FAILURE MUST NOT LOOK LIKE SUCCESS. This used to dismiss either way, so a
        // reconnect that did nothing was indistinguishable from one that worked - the
        // card simply went away and the conversation started. Two rounds of diagnosis
        // were spent on a misreading that this caused (Ken, August 31 2026: "it appears
        // to connect"). Say what happened, and leave the way out visible.
        try { storage.logError('folder', 'reconnect was not granted: ' + storage.folderReconnectTrace()); }
        catch { /* best-effort */ }
        const title = document.querySelector('#folderPrompt .apikey-prompt-title');
        if (title) {
            title.textContent = 'Conversant could not get back into your data folder. ' +
                'Carry on without it for now, or choose the folder again in Settings.';
        }
        btn.hidden = true;                       // retrying does the same thing again
        btn.disabled = false;
    });
    document.getElementById('folderSkipBtn').addEventListener('click', dismissFolderNotice);
    ui.onListenClick(whileComposerClosed(toggleListening));
    ui.onRegenerateClick(handleRegenerate);
    ui.onSpeakClick(handleSpeakComposed);
    ui.onReframeClick(handleReframe);
    ui.onCancelComposerClick(handleCancelComposed);
    ui.onSettingsClick(whileComposerClosed(openSettings));
    // About Me is no longer a title-bar button — it's launched from the Settings
    // panel's "About Me" tab (see initSettingsTabs).
    // Persistent override controls (Conversation-Engine-Design.docx §5.1) — the
    // user's escape hatch when the engine's mode inference is wrong.
    // Every one of these dismisses "In my own words" first if it is open, and puts
    // back the cards that were showing - see whileComposerClosed. "Hold on" and
    // "Don't save" are the two deliberate exemptions and are wired straight through.
    ui.onInitiateClick(whileComposerClosed(handleInitiate));
    ui.onSayAgainClick(whileComposerClosed(handleSayAgain));
    ui.onHoldOnClick(handleHoldOn);
    ui.onPardonClick(whileComposerClosed(handlePardon));
    ui.onWindDownClick(whileComposerClosed(handleWindDown));
    ui.onEndConversationClick(whileComposerClosed(handleEndConversation));
    ui.onPrivacyToggleClick(handlePrivacyToggle);
    // Seed the privacy state from the Settings default (per-conversation button
    // can override it live; it re-seeds at each Start/End conversation).
    conversationPrivate = storage.loadNoSaveDefault();
    applyPrivacyState();
    ui.showEngineState(engine.getSnapshot());
    // Draws the Command Bar in the stored mode (icons or short labels); calls
    // applyControlIcons itself, so this replaces it rather than preceding it.
    ui.setCommandLabelMode(storage.loadCommandLabels());
    applyConversationDockClasses();
    applyButtonSizing();   // compute the conversation layout (region sizes + gaps)
    // Region sizes depend on the viewport — recompute on resize/orientation.
    window.addEventListener('resize', applyButtonSizing);
    // Entering or leaving fullscreen changes whether a title-bar offset exists at
    // all, so the keyguard field has to follow it — including when the user leaves
    // by Esc, which never touches the setting.
    document.addEventListener('fullscreenchange', reflectTitleBarNeed);
    document.addEventListener('webkitfullscreenchange', reflectTitleBarNeed);
    // And entering fullscreen from inside Settings buries the panel under the whole
    // conversation screen until it is re-promoted — see repromoteSettingsOverFullscreen.
    document.addEventListener('fullscreenchange', repromoteSettingsOverFullscreen);
    document.addEventListener('webkitfullscreenchange', repromoteSettingsOverFullscreen);
    blockZoomGestures();
    // The controls tour watches for the press it just asked for. Capture phase, and
    // on document so it sees the Command Bar, the response cards and the Express
    // Panel alike — see handleTourPress for why it must not intercept. Inert unless
    // a tour is running.
    document.addEventListener('click', handleTourPress, true);
    ui.setCardsPerCategory(storage.loadResponsesPerCategory()); // 8-card mode → 8 reserved slots
    ui.setCardTextMode(storage.loadCardTextMode());   // full / short / both, per the user's choice
    clearPalette(); // render the reserved empty card footprint at rest
    renderExpressPanel();
    expressEditor.init(document.getElementById('expressEditor'), {
        onChange: renderExpressPanel,
        onPick: renderExpressPanel,   // the mark lives on the panel, so a pick redraws it
        // The editor moved the caret into a box it just built, so the user is typing
        // and the dock must stay on the keyboard -- see syncExpressTabDock. Cleared by
        // the next tap on the tab, which is the next thing that could legitimately ask
        // for the panel back.
        onAutoFocus: () => { expressAutoFocusedBox = true; },
        // The editor needs the live grid to say where the panel runs out, which is
        // what the cut line in each list reports.
        layoutRows: expressLayoutRows,
    });
    controlEditor.init(document.getElementById('controlEditor'), { onChange: applyControlPhrases });
    // No onChange: placeholders.js reads the pools at the moment it speaks, so an
    // edit is in force on the next phrase with nothing to re-inject.
    placeholderEditor.init(document.getElementById('placeholderEditor'));
    // About Me is an ordinary Settings tab — it renders into its tab-panel and is
    // dismissed by the shared Settings Close button (no overlay of its own).
    worldviewUI.init();
    applyFontScales();   // user-set Transcript / Composer / Express text sizes
    initSliderSteppers(); // − / + fine-step buttons on the size sliders
    ui.setRegenerateLabel(storage.loadResponsesPerCategory() * 4); // "New 4"/"New 8"
    const settingsContent = document.getElementById('settingsContent');
    if (settingsContent) keepDropdownsOpeningDownward(settingsContent);
    keyboard.init();
    keyboard.setMode(storage.loadKeyboardMode());
    keyboard.setSideLayout(storage.loadSideLayout());
    keyboard.setBottomLayout(storage.loadBottomLayout());
    keyboard.setSideDockPosition(storage.loadSideDockPosition());
    keyboard.setKeyboardDock(storage.loadKeyboardDock());
    initSettingsTabs();
    initSpokenHelp();
    // Take the keyboard preview down when Settings is dismissed. The Close
    // button does this explicitly; this 'cancel' listener covers Escape (the
    // dialog 'close' event proved unreliable here). Settings is now a fixed
    // main-area panel (Spatial Stability), so there's no drag position to reset.
    const settingsDialog = document.getElementById('settingsDialog');
    settingsDialog.addEventListener('cancel', () => {
        // Mirror the Close button: persist the API key (covers paste paths that
        // didn't fire `input`) and take the keyboard fully down.
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) {
            const key = keyFieldValue(apiKeyInput);   // null = untouched (still redacted)
            if (key !== null && key !== (storage.loadApiKey() || '')) { llm.setApiKey(key); storage.saveApiKey(key); }
        }
        keyboard.hideKeyboard();
        hostExpressPanel(false);   // Escape must return the panel to the dock too
    });
    // Release number with the build appended (Ken, July 30 2026) — "0.5.99 ·
    // 9e73383". A bug report needs the exact code, not just the version: several
    // deploys share one version during a dev cycle. Shown in three places, each
    // reachable when the others are not: Settings → About, the startup-failure
    // card, and the opening screen (Settings cannot be reached before Start).
    const versionEl = document.getElementById('aboutVersion');
    if (versionEl) versionEl.textContent = `${APP_VERSION} · ${BUILD_ID}`;
    const startVersionEl = document.getElementById('startVersion');
    if (startVersionEl) startVersionEl.textContent = `Version ${APP_VERSION} · ${BUILD_ID}`;

    tts.onVoicesReady(() => {
        const savedURI = storage.loadVoiceURI();
        if (savedURI) tts.setVoice(savedURI);
    });

    // Names the voice gets wrong. Wired once: pronunciation.apply reads the current
    // people and places on every utterance, so an edit takes effect immediately and
    // there is no cache to go stale. The respelling reaches the synthesiser and
    // nothing else — see pronunciation.js.
    tts.setPronouncer(pronunciation.apply);

    applyTtsProvider();
    // A downgrade to the device's own voice is not silent: the user still hears
    // their words, but they hear them in the wrong voice, and the reason belongs in
    // the error log (which also trips the transcript's red wash) rather than only in
    // the console.
    tts.onFallbackToBrowser((reason) => {
        storage.logError('voice', `Paid voice unavailable, used this device's voice instead: ${reason}`);
    });

    llm.onUsage((usage) => storage.addUsageTokens(usage));

    // Load the worldview registry + profile so generation can inject the
    // profile block even before the user opens "About Me". The data folder
    // isn't restored until Start, so this first load uses the localStorage
    // cache; handleStart() reloads from the folder once it's granted.
    worldview.loadRegistry().catch(() => { /* registry optional at startup */ });
    worldview.load().catch(() => { /* falls back to empty profile */ });
    // Relationship graph (people/edges) — its own model + file. Loaded here from
    // the cache; handleStart() reloads from the folder and runs the one-time
    // migration of the former worldview "People" module once both are loaded.
    relationships.load().catch(() => { /* falls back to empty graph */ });
    // My Places (places + their facts) — its own model + file, same lifecycle.
    places.load().catch(() => { /* falls back to no places */ });
    voiceProfile.load().catch(() => { /* falls back to no voice data */ });
    // Express Panel items — its own model + file. Loaded from cache now; the
    // folder copy (source of truth) is adopted in handleStart once granted.
    expressPanel.load().then(renderExpressPanel).catch(() => { /* falls back to defaults */ });
    // Control phrases (Hold on / Pardon? / openers / closers) — own model + file.
    controlPhrases.load().then(applyControlPhrases).catch(() => { /* engine keeps inline defaults */ });
    placeholderPhrases.load().catch(() => { /* the model falls back to its defaults */ });

    const savedKey = storage.loadApiKey();
    if (savedKey) {
        llm.setApiKey(savedKey);
        ui.setStatus('Ready — API key loaded');
    } else {
        // The status bar is visually hidden (v0.5.2), so a setStatus message alone is
        // invisible. Show the visible pre-start prompt instead (it lives in the start
        // block over the transcript). Keep the aria-live status for screen readers.
        ui.setStatus('No API key set — open Settings to add your Claude API key');
    }
    // Neither the "no API key" notice nor the listening notice is shown here —
    // they are steps 3 and 4 of the pre-start sequence (see handleStart), so they
    // never overlap the upgrade screen or each other.

    // Last, so a disabled Listen button and its explanatory tooltip survive
    // ui.applyControlIcons() above (which rewrites the button's label/title).
    applyListenAvailability();
}

// --- API key surfaces (Ken, July 2026) -----------------------------------------
// The manual (§3.2) promises a red invalid-key warning under the field and cues the
// user to add a key; neither existed. Three surfaces: (1) a format warning under the
// API Key field as you type; (2) a "Test" button that verifies the key against the
// API; (3) a visible "no API key yet" prompt on the pre-start screen (the hidden
// status bar can't show one). Step 3 of the pre-start sequence (afterWhatsNew)
// drives (3); the two functions below drive (1)/(2).

/*
 * Key fields: hidden at rest, readable while you are editing them.
 *
 * These were masked in CSS with -webkit-text-security, which is the property
 * Safari uses to render a password field — so Safari's password manager classified
 * them as credentials and offered to "Save Password" on every launch of the iPad
 * app, asking for a user name that means nothing for an API key (Ken, July 30
 * 2026). autocomplete="off" does not suppress that heuristic; removing the
 * password-shaped signal does.
 *
 * So a stored key is shown redacted — enough of each end to recognise WHICH key it
 * is, never enough to use — and the real value is put back only while the field has
 * focus. That is also better than masking was: a masked field makes a truncated
 * paste invisible, which is precisely the failure the Test button exists to catch.
 */
function redactKey(key) {
    const k = (key || '').trim();
    if (k.length <= 12) return k ? '•'.repeat(k.length) : '';
    return `${k.slice(0, 7)}…${k.slice(-4)}`;
}

// What the user has actually typed, or null when the field is showing the redacted
// placeholder (i.e. untouched). The persist-on-close paths must treat null as "no
// change" — saving the placeholder would overwrite the real key with "sk-ant-…4f2a".
function keyFieldValue(input) {
    if (!input || input.dataset.redacted) return null;
    return input.value.trim();
}

// Put a real value into a key field programmatically (a paste), leaving it in the
// un-redacted state so it is saved and readable.
function setKeyFieldValue(input, value) {
    input.value = value;
    delete input.dataset.redacted;
    input.classList.remove('key-redacted');
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Show the redacted form (unless the user is typing in it right now).
function showRedactedKey(input, key) {
    if (!input || document.activeElement === input) return;
    const k = (key || '').trim();
    if (!k) { input.value = ''; input.classList.remove('key-redacted'); delete input.dataset.redacted; return; }
    input.value = redactKey(k);            // set directly: no input event, so nothing re-saves
    input.dataset.redacted = '1';
    input.classList.add('key-redacted');
}

// Reveal the real key for editing, and re-redact when focus leaves. `load`/`save`
// keep this generic over both key fields.
function wireKeyField(input, { load, save, onChange }) {
    if (!input) return;
    input.addEventListener('focus', () => {
        if (input.dataset.redacted) {
            input.value = load() || '';
            delete input.dataset.redacted;
            input.classList.remove('key-redacted');
        }
    });
    input.addEventListener('blur', () => showRedactedKey(input, load()));
    input.addEventListener('input', () => {
        // Never save the redacted placeholder back over the real key.
        if (input.dataset.redacted) return;
        save(input.value.trim());
        if (onChange) onChange(input.value.trim());
    });
    showRedactedKey(input, load());
}

function showDeepgramStatus(kind, msg) {
    const el = document.getElementById('deepgramKeyStatus');
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; el.className = 'api-key-status'; return; }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'api-key-status ' + (kind === 'ok' ? 'ok' : kind === 'checking' ? 'checking' : 'warn');
}

// Point tts.js at the chosen voice backend. Called at startup and whenever the
// setting changes — unlike transcription, this takes effect immediately, because
// tts.js routes per utterance instead of building a source once.
function applyTtsProvider() {
    tts.setProvider(storage.loadTtsProvider(), {
        model: storage.loadAuraVoice() || ttsDeepgram.DEFAULT_VOICE,
        // Read at speak time, so a key pasted into Settings works without a reload.
        getKey: () => storage.loadDeepgramKey() || '',
        onBilled: (characters) => storage.addTtsCharacters(characters),
    });
    tts.setAuraModel(storage.loadAuraVoice() || ttsDeepgram.DEFAULT_VOICE);
}

// Same shape as showDeepgramStatus, for whichever of the two Aura voice pickers is
// being tested.
function showAuraStatus(which, kind, msg) {
    const el = document.getElementById(which === 'partner' ? 'auraPartnerVoiceStatus' : 'auraVoiceStatus');
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; el.className = 'api-key-status'; return; }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'api-key-status ' + (kind === 'ok' ? 'ok' : kind === 'checking' ? 'checking' : 'warn');
}

// The Aura voice the Practice partner speaks in: the user's chosen partner voice,
// or the first voice in the list that is not the user's own, so the two sides are
// audibly different out of the box — the same rule as the browser-voice path.
function pickAuraPartnerVoice(chosen = storage.loadAuraPartnerVoice()) {
    if (chosen) return chosen;
    const own = storage.loadAuraVoice() || ttsDeepgram.DEFAULT_VOICE;
    const other = ttsDeepgram.VOICES.find((v) => v.id !== own);
    return other ? other.id : own;
}

function showApiKeyStatus(kind, msg) {
    const el = document.getElementById('apiKeyStatus');
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; el.className = 'api-key-status'; return; }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'api-key-status ' + (kind === 'ok' ? 'ok' : kind === 'checking' ? 'checking' : 'warn');
}

// Format-check the current field value and reflect it under the field. Empty is not
// "invalid" (that's the missing-key case), so it just clears the line.
function reflectApiKeyFormat() {
    // Read through keyFieldValue: a redacted field holds "sk-ant-…4f2a", which
    // would fail the length check and put a red "too short" warning under a
    // perfectly good saved key.
    const input = document.getElementById('apiKeyInput');
    const key = keyFieldValue(input) ?? (storage.loadApiKey() || '');
    if (!key) { showApiKeyStatus(null, ''); return; }
    const v = llm.validateKeyFormat(key);
    if (v.ok) { showApiKeyStatus(null, ''); return; }
    const msg = v.reason === 'prefix' ? "This doesn't look right — a Claude key starts with sk-ant-."
        : v.reason === 'whitespace' ? 'Remove the spaces — a key is one unbroken string.'
        : 'This looks too short — check you copied the whole key.';
    showApiKeyStatus('warn', msg);
}

let lastSpeechResultAt = 0;

function handleSpeechResult(liveText) {
    const now = Date.now();
    if (lastSpeechResultAt) metrics.sttGap(now - lastSpeechResultAt);
    lastSpeechResultAt = now;
    // Live transcript while the partner is speaking — provisional, not yet
    // confirmed. Confirmation happens implicitly when the user picks a response.
    updatePartnerLive(liveText);
    if (liveText) ui.setTranscriptState('unconfirmed');
}

// The partner produced genuine (non-echo) speech. If they resumed after a pause
// that already fired a checkpoint, a placeholder may be scheduled or mid-utterance
// to hold the floor while the user chooses — but the partner is talking again, so
// that response window is stale. Cancel the placeholder timer (and any playing
// placeholder) so nothing is spoken over the partner; the next silence checkpoint
// re-arms and regenerates from the combined speech.
function handlePartnerResumed() {
    // The partner started talking again — abort and reset the placeholder ladder so
    // nothing is spoken over them (Ken). The next silence checkpoint regenerates from
    // the fuller utterance and re-arms placeholders. Detecting resumption fast matters
    // here; it's caught on the first interim STT result (except while a placeholder is
    // actively playing, where the echo guard blocks detection until it finishes — a
    // known limitation until Phase-2 partner voice recognition).
    placeholders.stop();
}

// Fired each time the partner pauses for the configured silence period.
// Recording continues; we just take everything collected so far and refresh
// the response options from it. A later (more complete) period supersedes this.
// Per the no-confirmation-gate decision (June 15 2026) generation fires here on
// silence — there is no confirm-the-transcript step.
async function handleSilencePeriod(text) {
    metrics.checkpoint();
    lastSpeechResultAt = 0;   // the gap that ends at a checkpoint is the silence itself
    currentPartnerText = text;
    updatePartnerLive(text);
    // Mirror the pane in the transcript: write the partner's raw line now (Ken).
    // Each pause overwrites it and clears the cleaned line; it's finalized (cleaned
    // filled) when the user responds. Fire-and-forget so it doesn't delay options.
    if (text) storage.logPartnerInterim({ rawTranscript: text, partner: partnerStamp() });
    engine.partnerSpeaking(text);
    // Start the initial-delay clock at the pause (Ken, June 28 2026) so a slow AI
    // round-trip doesn't leave dead air. arm() only starts the clock; the placeholder
    // is still gated on the classification (questions only) inside generateOptions,
    // which calls placeholders.start() (fires immediately if the delay already
    // elapsed) or placeholders.stop() (not placeholder-worthy).
    placeholders.arm();
    await generateOptions(text);
}

// Audio uploaded to the paid transcription service, in seconds. Reported per
// speech burst (the gate closing), so the running total reflects what was actually
// sent rather than how long the microphone was open — which is the difference the
// gating exists to create, and the number the user is billed on.
function handleSttBilled(seconds) {
    // The source reports its cumulative total for the session; store the delta.
    const delta = seconds - sttBilledThisSession;
    sttBilledThisSession = seconds;
    if (delta > 0) storage.addSttSeconds(delta);
}

// WHY THIS IS A WHITELIST AND NOT `status === 'listening'` (Ken, iPad, August 3 2026).
// It used to be that one-liner, which made every status the app did not recognise mean
// NOT LISTENING — silently, since none of the branches below match either, so nothing
// was shown and nothing was logged. The paid backend emits 'capturing' when the voice
// gate opens, i.e. the moment the user STARTS SPEAKING, so the indicator went dark
// exactly when it was most true. Capture carried on underneath, which is why speech
// still reached the transcript while the button said it was off.
//
// The knock-on was the damaging part: with isListening false, the next tap of the
// Listen button took the START branch instead of the stop branch, and
// startFreshListening() cleared the accumulated transcript. Repeated taps therefore
// discarded the partner's earlier speech a piece at a time — Ken counted to twelve and
// the recorded turn held only "seven, eight, nine, 10, 11, 12".
//
// So: only an explicit stop or error turns the indicator off. An unknown status leaves
// the state ALONE and is logged, because a silent state change is what made this cost
// an evening — the failure looked like a dead button rather than a status mapping.
function handleSttStatus(status, detail) {
    const was = isListening;
    if (status === 'stopped' || status === 'error') isListening = false;
    else if (status === 'listening') isListening = true;
    // 'capturing' — the voice gate opened, i.e. someone is speaking right now. It
    // reports activity WITHIN a listening session, so it must leave the state alone:
    // clearing it was the bug, and setting it would be wrong in the other direction,
    // since the gate can open on the first syllable before the socket has finished
    // connecting and the button would then claim to be listening early — the very
    // thing moving 'listening' to ws.onopen was meant to stop. Measured: it does.
    else if (status === 'capturing') { /* activity, not a state change */ }
    else storage.logError('stt-status', `unknown status "${status}"`);
    ui.setListenButtonState(isListening);

    if (status === 'error') {
        ui.setStatus(`Microphone error: ${detail}`);
        // Record it — this also trips the transcript red-wash (via the
        // 'aac-error-logged' event) so a speech-recognition failure isn't silent now
        // that the status bar is hidden. The common case is 'network': the browser's
        // speech recognition is cloud-based (Chrome→Google, Edge→Microsoft), so with
        // no internet it can't transcribe at all and this is the only signal the user gets.
        storage.logError('stt', detail || 'unknown');
    } else if (status === 'listening') {
        ui.setStatus('Listening...');
    } else if (status === 'stopped') {
        ui.setStatus('Ready');
    }
}

// How long the Start button will wait for storage before going on without it.
// Generous — this is a stuck-detector, not a performance budget.
const STORAGE_WARMUP_MS = 6000;
// How much longer the pre-start chain will wait for a restore that is still running
// before it concludes there is no folder. Separate from the warm-up deadline above
// and deliberately so: that one decides when to stop BLOCKING Start, this one decides
// when it is safe to ANSWER a question about the folder. Conflating them is what put
// a reconnect card in front of a folder that was in the middle of connecting.
const FOLDER_ANSWER_GRACE_MS = 8000;

// Resolve `promise`, or give up after `ms` and carry on. Resolves rather than
// rejects, so callers need no extra error path; a timeout is logged, because a
// storage layer that stops answering is worth knowing about even though the app
// survives it.
/*
 * Stop waiting for `promise` after `ms` so the caller can carry on — and report a
 * fault ONLY if the work never finishes at all.
 *
 * ⚠ THE TWO ARE SEPARATE, AND CONFLATING THEM PUT A RED WASH ON THE TRANSCRIPT AT
 * EVERY LAUNCH. The deadline exists to stop BLOCKING Start; reaching it says the
 * work is SLOW, which is not the same as saying it is BROKEN. On Android, opening a
 * real data folder simply takes longer than the deadline, so every launch logged a
 * failure and painted the transcript with the app's error signal while the folder
 * connected perfectly well moments later (Ken, August 31 2026 - the trace on the
 * same launch reads "connected").
 *
 * A false alarm on that signal is worse than no signal: it is meant to tell the user
 * and their partner "expect a hiccup", and one that fires on every healthy start
 * teaches them to ignore the one time it matters.
 *
 * So: the deadline resolves QUIETLY, and a separate, much longer watch reports the
 * genuine case - work that has still not answered long afterwards.
 */
const HANG_FACTOR = 5;      // how much longer than the deadline counts as a real hang

async function withTimeout(promise, ms, label) {
    let deadlineTimer = null;
    let hangTimer = null;
    // ⚠ Whether the WORK finished, tracked separately from whether the RACE settled.
    // The race settles at the deadline, so a flag set in its `finally` would mark the
    // work "done" the moment we stopped waiting for it - and silence the hang watch
    // in exactly the case it exists for.
    let workDone = false;
    const done = () => { workDone = true; if (hangTimer !== null) clearTimeout(hangTimer); };
    Promise.resolve(promise).then(done, done);

    const hangMs = ms * HANG_FACTOR;
    const watchForHang = () => {
        if (workDone) return;
        // A folder-permission dialog on screen is not a hang: the storage layer is
        // waiting on the USER, who may take as long as they like.
        if (storage.isAwaitingPermission()) { hangTimer = setTimeout(watchForHang, hangMs); return; }
        try { storage.logError('timeout', `${label} had still not finished after ${hangMs}ms`); } catch { /* best-effort */ }
    };
    hangTimer = setTimeout(watchForHang, hangMs);

    let raceSettled = false;
    const deadline = new Promise((resolve) => {
        const check = () => {
            if (raceSettled || workDone) return;
            if (storage.isAwaitingPermission()) { deadlineTimer = setTimeout(check, ms); return; }
            resolve(null);      // carry on WITHOUT logging - slow is not broken
        };
        deadlineTimer = setTimeout(check, ms);
    });
    try {
        return await Promise.race([promise, deadline]);
    } finally {
        raceSettled = true;
        if (deadlineTimer !== null) clearTimeout(deadlineTimer);
        // hangTimer is deliberately NOT cleared here: the work may still be running,
        // and it is the only thing left watching it.
    }
}

// Adopt the data folder (or, on iPad, device storage) and reconcile every
// user-owned file against it: the folder copy wins where it exists, the
// localStorage cache is promoted where it doesn't (the v0.2.25 rule).
async function warmUpStorage() {
    try { await storage.restoreDataFolder(); } catch { /* no stored handle yet */ }
    // Ask the browser to promise not to erase this origin's storage. Fire and
    // forget: on Chrome and Safari the answer is silent - no prompt, no tap - so
    // there is nothing to wait for and nothing for the user to do.
    //
    // It used to be asked ONLY by a button in Settings, which is shown only where
    // there is no folder picker (the iPad). That was reasonable while a folder meant
    // Windows: the real data sits on disk, outside anything the browser sweeps. It
    // stopped being reasonable when Android turned out to have a folder too - a
    // phone runs out of space, Chrome is more aggressive when it does, and what is
    // lost is the app's memory of WHICH folder plus every setting. Recoverable, but
    // only by someone who had saved a settings profile into the folder first.
    //
    // So it is asked for everywhere, always, because it costs nothing to ask. The
    // button stays for the iPad, where it is also the only place the answer is
    // reported; everyone else can read the result under "persisted" in a problem
    // report. A promise worth having should not depend on finding a control.
    storage.requestPersistentStorage().catch(() => { /* declining is not an error */ });
    // Reload the worldview profile from the (now-restored) data folder, then
    // reconcile: if answers accumulated only in the localStorage cache (no
    // folder earlier), promote them to the on-disk worldview.json now.
    try { await worldview.load(); } catch { /* keep cached/empty profile */ }
    try { await worldview.syncToFolder(); } catch { /* best-effort */ }
    // Same for the relationship graph.
    try { await relationships.load(); } catch { /* keep cached/empty graph */ }
    try { await relationships.syncToFolder(); } catch { /* best-effort */ }
    // Same for My Places.
    try { await places.load(); } catch { /* keep cached/empty places */ }
    try { await places.syncToFolder(); } catch { /* best-effort */ }
    try { await voiceProfile.load(); } catch { /* keep cached/empty voice data */ }
    try { await voiceProfile.syncToFolder(); } catch { /* best-effort */ }
    // Same for the Express Panel items (adopt the folder copy, else promote cache).
    try { await expressPanel.load(); } catch { /* keep cached/default items */ }
    try { await expressPanel.syncToFolder(); } catch { /* best-effort */ }
    renderExpressPanel(); // reflect any adopted items
    // Same for the control phrases (Hold on / Pardon? / openers / closers).
    try { await controlPhrases.load(); } catch { /* keep cached/default phrases */ }
    try { await controlPhrases.syncToFolder(); } catch { /* best-effort */ }
    try { await placeholderPhrases.load(); } catch { /* keep cached/default phrases */ }
    try { await placeholderPhrases.syncToFolder(); } catch { /* best-effort */ }
    applyControlPhrases();
}

async function handleStart() {
    metrics.event(metrics.EV.START_PRESSED);
    // Bring the audio context up NOW, while a real tap is in hand. The chime
    // itself is fired from an async recognizer callback where WebKit would refuse
    // to start audio (see chime.unlock).
    chime.unlock();
    // Same reason, for the paid voice: iOS refuses to start audio outside a user
    // gesture, and placeholders fire on TIMERS — so without this the app would go
    // silent exactly when it is trying to hold the floor.
    tts.unlockAudio();
    // Same reason again, and it must stay ABOVE the first await below: a fullscreen
    // request is only granted while user activation lasts, and the first await in an
    // async handler ends it.
    // ⚠ THE DATA FOLDER IS ASKED FOR BEFORE FULL SCREEN, AND THE ORDER IS THE POINT.
    // requestFullscreen CONSUMES the tap - it does not merely need one - so anything
    // asking afterwards finds the tap already spent. Measured on Ken's Android tablet,
    // which has full screen ON: the trace read "tap:asking:activation-GONE", while his
    // phone, with it OFF, was unaffected. Chrome granted the permission anyway, so
    // this is a latent fault rather than the cause of what he was seeing - but a
    // browser that enforces it would break the folder to win a cosmetic full screen,
    // which is the wrong way round. Getting back into the user's own data outranks it.
    //
    // Android does not retain folder permission between launches (measured, INCLUDING
    // as an installed app), so it must be asked for at every start; asking here spends
    // the tap the user has already made. Windows keeps its permission, so this is a
    // no-op there. Not awaited: warmUpStorage picks up the answer, and blocking Start
    // on a dialog would leave a dead-looking button while the user reads it.
    storage.requestFolderPermissionNow();
    requestAppFullscreen();
    // Check for a newer deployed version when the session starts. If one is
    // found the worker activates and the controllerchange handler in index.html
    // reloads the page; when nothing is new this is a cheap no-op.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration()
            .then((reg) => reg && reg.update())
            .catch(() => { /* update check is best-effort */ });
    }
    // Warm up storage, but NEVER let it strand the user on the Start screen. Each
    // call is already try/caught, which covers a rejection — it does not cover a
    // promise that simply never settles, and a hung storage call here would leave
    // Start looking like a dead button with nothing on screen and nothing logged.
    // The data is a nice-to-have at this moment (every module falls back to its
    // localStorage cache); getting the user into the conversation is not.
    await withTimeout(warmUpStorage(), STORAGE_WARMUP_MS, 'storage warm-up');
    // Storage is now reconnected, so the weekly report can count what is actually
    // on disk. See scheduleWeeklyReport for why it is not on a page-load timer.
    scheduleWeeklyReport();
    // Fresh conversation state for this session.
    engine.reset();
    ui.showEngineState(engine.getSnapshot());
    // Pre-start screens run in a strict SEQUENCE, never overlapping (Ken, July 18
    // 2026): Start (greyed screen) → the "What's new" upgrade screen (Close) → the
    // listening notice (Continue anyway) → the API-key notice (Close) → the
    // conversation. Each step hands off to the next only when dismissed, so no two
    // ever sit on top of each other. All three intermediate screens are optional
    // and skipped when not needed.
    //
    // The listening notice comes BEFORE the API-key one because it is about where
    // the user opened the app, and its remedy ("open it in Safari instead") is
    // something they may want to act on before anything else — whereas the API key
    // can be added at any time from Settings.
    const whatsNewNotes = whatsNew.pending(APP_VERSION);
    if (whatsNewNotes.length) {
        // Step 2 — upgrade screen. The app has already re-rendered post-update, so
        // the transcript's location is known; the panel fills that region (a
        // keyguard opening — Spatial Stability). "Close" advances to step 3.
        document.getElementById('startBtn').hidden = true;   // panel carries its own "Close"
        // The notice fills the transcript region, so nothing else may stand in it
        // (Ken, August 19 2026). The version line and the report link are siblings
        // inside the same block, and the notice is a flex item sharing the height
        // with them — so every line they occupy is a line of release notes the user
        // has to scroll to reach. Neither is needed on this screen: they exist for a
        // tester whose app is too broken to drive, and reaching this notice means it
        // started, pressed Start, and rendered. Restored on dismiss, because the
        // API-key notice that may follow shows in this same block.
        setStartScreenFooter(false);
        whatsNew.renderPanel(APP_VERSION, whatsNewNotes, afterWhatsNew);
    } else {
        afterWhatsNew();
    }
}

// Step 3 was a "listening may not work here" notice. REMOVED (Ken, July 30 2026)
// once the iPad Home Screen app was confirmed working apart from capture: "I'm not
// convinced that it is necessary to keep hitting a person in the face with this
// warning each time they start the app, they will understand that quickly and
// probably before they create the desktop app via user documentation."
//
// It is a property of the platform, not an event — it is identical on every launch
// and there is nothing to act on, so a recurring modal step teaches nothing after
// the first read and costs a tap forever. The user documentation carries it
// instead. What survives in code: the verdict still reaches the screen-reader
// status line, still disables the control where there is no recognizer at all, and
// is still reported by platform.describe() in a bug report.
function afterWhatsNew() {
    setStartScreenFooter(true);
    afterFolderNotice();
}

// Step 3b — the reconnect notice, shown only when a folder is REMEMBERED but the
// app has not been let back into it. Its whole purpose is to put a fresh tap behind
// the permission request: the automatic attempt during start-up happens several
// steps after the Start tap, and where the browser no longer counts that tap as
// recent, the request is refused outright (measured on Android, every launch).
//
// It comes BEFORE the API-key notice for the same reason the listening notice used
// to: it is about the app finding the user's own data, and carrying on without it
// means this session writes to the localStorage cache instead of their folder. An
// API key can be added at any time afterwards from Settings.
//
// Skipped entirely where the folder connected normally, so Windows sees nothing new.
async function afterFolderNotice() {
    const prompt = document.getElementById('folderPrompt');
    // ⚠ WAIT FOR THE RESTORE BEFORE DECIDING. This is what was actually putting the
    // card in front of Ken at every launch, and it is not about permission at all:
    // warmUpStorage is abandoned after STORAGE_WARMUP_MS so a hung storage layer can
    // never strand anyone on the Start screen, and on Android that deadline is reached
    // while the folder is still being opened - slow, not hung. The chain then asked
    // "do we have a folder?", got "not yet", and offered to reconnect one that was
    // already connecting. His report shows it finishing moments later, behind the card.
    //
    // So the deadline is left exactly as it is (it guards a real failure) and only the
    // QUESTION is deferred: give an in-flight restore a little longer to answer before
    // concluding there is no folder. Bounded, so a genuinely hung restore still falls
    // through to the card rather than replacing one stall with another.
    try { await storage.settleRestore(FOLDER_ANSWER_GRACE_MS); } catch { /* decide anyway */ }
    let needed = false;
    try { needed = !storage.hasDataFolder() && await storage.hasRememberedFolder(); }
    catch { needed = false; }
    if (!needed || !prompt) return afterListeningNotice();
    // Reset: the card is reused, and a failure last time rewrote its wording and hid
    // its button. Without this, one failed reconnect would leave the card permanently
    // stuck on its failure message for the rest of the session.
    const title = prompt.querySelector('.apikey-prompt-title');
    if (title) {
        title.textContent = 'Let Conversant back into your data folder to load your ' +
            'settings and conversations.';
    }
    const rbtn = document.getElementById('folderReconnectBtn');
    if (rbtn) { rbtn.hidden = false; rbtn.disabled = false; }
    document.getElementById('startBtn').hidden = true;   // the card carries its own controls
    document.getElementById('whatsNewPanel').hidden = true;
    prompt.hidden = false;
}

// Leave the reconnect notice, whichever way it was answered, and carry on down the
// chain. Never blocks: without the folder the app still runs on its cache, which is
// what it does for a user who has never chosen one.
function dismissFolderNotice() {
    document.getElementById('folderPrompt').hidden = true;
    document.getElementById('startBtn').hidden = false;
    afterListeningNotice();
}

// The version line and the "save a report" link at the foot of the pre-start block.
// Hidden only while the "What's new" notice is up, so it gets the whole transcript
// region; see the call site for why they are safe to drop for that one screen.
function setStartScreenFooter(show) {
    for (const id of ['startVersion', 'startReportBtn']) {
        const el = document.getElementById(id);
        if (el) el.hidden = !show;
    }
}

// Step 4 — the API-key notice, shown only when no key is set (informational: the
// app works without one). "Close" enters the conversation; "Add an API key"
// opens Settings. When a key IS set, skip straight into the conversation.
function afterListeningNotice() {
    const hasKey = !!(storage.loadApiKey() || '').trim();
    const prompt = document.getElementById('apiKeyPrompt');
    if (!hasKey && prompt) {
        document.getElementById('startBtn').hidden = true;   // Close is the proceed control here
        document.getElementById('whatsNewPanel').hidden = true;
        prompt.hidden = false;
    } else {
        finishStart();
    }
}

// Leave the pre-start sequence and enter the conversation: hide the start block and
// un-dim the conversation surface. The end of the Start → upgrade → listening →
// API-key chain.
function finishStart() {
    document.getElementById('startBtn').hidden = false;   // restore for any later start screen
    document.getElementById('apiKeyPrompt').hidden = true;
    document.getElementById('folderPrompt').hidden = true;
    document.getElementById('startBlock').classList.add('hidden');
    document.querySelector('main').classList.remove('disabled');
}

function toggleListening() {
    chime.unlock();   // a genuine tap — see handleStart
    // Practice Mode: "Start Listening" does NOT open the mic — it cues the AI
    // partner to speak, reinforcing the same step (and honoring the same
    // manualListenArmed / auto-resume gate) as a real conversation.
    if (practiceMode) return togglePracticeCue();
    // WHICH BRANCH a tap takes is the whole question when the button misbehaves: the
    // symptom "tapping it does nothing" was really "it took the start branch because
    // the app thought it had stopped".
    metrics.event(metrics.EV.LISTEN, { auto: false, status: isListening ? 'stop' : 'start' });
    if (isListening) {
        // Manual stop: disarm auto-resume until the user starts again.
        manualListenArmed = false;
        stt.stopListening();
    } else {
        // Manual start: arm auto-resume for the rest of this session.
        manualListenArmed = true;
        // A stop/start in the MIDDLE of a partner turn is a PAUSE, not a turn
        // boundary (Ken, August 5 2026) — the Listen button controls the microphone,
        // and the partner still holds the floor. Resuming keeps what they have said
        // so far; only a genuinely new turn starts fresh. Uncommitted speech is the
        // test for "mid-turn": every floor change (response picked, pardon, end of
        // conversation) clears the buffer, so an empty one means the last turn is
        // closed and the two paths would be identical anyway.
        if (heardPartnerText()) resumePartnerCapture();
        else startFreshListening();
    }
}

// Reopen the mic on a partner turn that is still running — the counterpart to
// startFreshListening for a stop/start that is a pause (Ken, August 5 2026).
//
// It deliberately does almost NOTHING beyond reopening the microphone. The offered
// choices, the turn steering, currentPartnerText, the promoted-history index and the
// storage-side pending transcript entry all belong to the turn that is still in
// progress, and clearing any of them is what made a mid-turn stop/start lose the
// partner's words. The next silence checkpoint overwrites the pending entry with the
// combined text, which is exactly what an uninterrupted pause already does.
function resumePartnerCapture() {
    stt.resumeListening();
}

// Begin a new partner-capture session with a cleared transcript and options.
function startFreshListening() {
    // A new partner turn. Anything still on offer was never taken — which is the
    // measure the saved conversations can never show — and the checkpoint count for
    // the turn just ended is closed off.
    metrics.paletteAbandoned('new turn');
    metrics.turnBoundary();
    metrics.conversationStarted({ practice: practiceMode });
    currentPartnerText = '';
    currentPartnerUncertain = [];
    setOfferedChoices([]);   // a new partner turn — last turn's choices are gone
    setOfferedRange(null);
    clearTurnSteering();
    dropHeldForComposer();
    pendingPartnerHistoryIdx = -1;   // fresh partner turn — not yet promoted to history
    generationToken++;
    ui.setLiveTranscript('');
    ui.setTranscriptState('idle');
    clearPalette();
    // Create the transcript file as soon as we enter Listen mode, so it exists and
    // mirrors the conversation pane from the very start (Ken). Idempotent — a no-op
    // if this conversation's log already exists. Fire-and-forget (needs a granted
    // data folder; a no-op without one).
    storage.startConversationLog();
    stt.startListening();
}


// Is this the AI refusing because too many requests arrived at once? Matched on the
// status number in the message, which is how llm.js reports it ("API error 429: ...").
// 529 is Anthropic's overloaded, which is the same situation from the other side.
function isRateLimit(err) {
    const m = (err && err.message) || '';
    return /(429|529)/.test(m);
}

async function generateOptions(partnerText) {
    const token = ++generationToken;
    ui.setPaletteBusy(true);   // the cards showing may be replaced — say so (Ken)
    const pEpoch = placeholderEpoch;   // if a speaking button fires mid-generation, don't restart placeholders

    // FAST PATH — winding down + a plain farewell reply: re-offer the goodbyes
    // NOW, skipping the AI round-trip, so the user can speak another closing
    // without waiting (Ken, July 2026 — saving time matters more than saving
    // tokens here). We feed the engine a synthetic CLOSING classification (the
    // same object shape the AI path produces), so all sequence-stack/floor
    // bookkeeping is identical; the AI would have classified this CLOSING and we'd
    // have shown the static closers anyway. Scoped to the pre-closing phase, and
    // precision-biased, so a non-match just falls through to the normal path
    // below. See conversation-logic.looksLikeClosing for the field-feedback note.
    const preSnap = engine.getSnapshot();
    const windingDown = preSnap.mode === engine.MODE.PRE_CLOSING_CLOSING
        || preSnap.phase === 'PRE_CLOSING' || preSnap.phase === 'CLOSING';
    if (windingDown && convLogic.looksLikeClosing(partnerText)) {
        placeholders.stop(); // a farewell doesn't need a "let me think" filler
        updatePartnerLive(partnerText);
        const snap = engine.ingestClassification(
            { classification: { partner_action: 'CLOSING', turn_status: 'COMPLETE', is_repair_initiator: false }, responses: [] },
            partnerText,
        );
        ui.showEngineState(snap);
        lastPalette = snap.palette;
        // The PARTNER started closing, so offer the decline alongside the goodbyes.
        renderStaticPalette('closing', snap.palette,
            'Say goodbye — or hold them a moment', { pin: declineClosingCard() });
        ui.setTranscriptState('ready');
        return;
    }

    ui.setStatus('Generating response options...');
    ui.setTranscriptState('generating');
    // ⚠ THE CARDS ARE NOT CLEARED HERE, AND MUST NEVER BE (Ken, August 21 2026):
    // "In no case should the response options be cleared until something is spoken
    // or the set there is replaced -- but in all cases, not until they are replaced
    // with a new set." A reprompt replaces them when the new set is READY; it does
    // not empty the region and leave the user with nothing in the meantime.
    //
    // This used to clear unconditionally, and it cost more than the gap. Clearing
    // also strips `palette-refreshing`, so it switched OFF the provisional look that
    // setPaletteBusy(true) had turned on thirty lines earlier -- the cards dimming
    // slightly and the stripe sweeping, which exist precisely to say "a reprompt is
    // running". The feature therefore worked when the user pressed New N themselves
    // (that path never clears) and was dead on every reprompt the app started by
    // itself, which is the case it was built for.
    //
    // What the user could do while it ran was already right and is unchanged: tap a
    // card or an Express phrase and it speaks, abandoning the reprompt; open "In my
    // own words" and the reprompt is abandoned too (openComposer bumps the token).
    //
    // The partner has said more, so this is a fresh offer: any steering of the
    // shorter turn is dropped rather than silently shaping the new palette.
    clearTurnSteering();

    // Generate from prior committed turns plus what the partner has said so far in
    // this one. All of it is the recognizer's own wording; nothing rewrites it.
    const history = [...conversationHistory, { role: 'partner', text: partnerText }];

    // Inject the current worldview profile so the assistant speaks AS the user.
    // Rebuilt each turn so questionnaire edits take effect immediately.
    llm.setWorldviewBlock(worldview.buildBlock());
    llm.setRelationshipsBlock(relationships.buildBlock());
    // Omit the place they are standing in — buildHereBlock already carries it, with
    // the framing that fits being present rather than the "places I go" framing.
    llm.setPlacesBlock(places.buildBlock(activePlace && activePlace.placeId));
    llm.setSituationBlock(buildSituationBlock());
    llm.setVoiceBlock(voiceBlockText());

    const startedAt = Date.now();
    try {
        const requestContext = engine.buildRequestContext();
        const result = await llm.generateResponses(history, requestContext, { perCategory: storage.loadResponsesPerCategory() });
        if (token !== generationToken) {
            // Superseded by a later pause. Since July 10 2026 every pause regenerates
            // for the same partner turn and the newest wins, so this work was BILLED
            // AND DISCARDED — which is the entire cost of a short silence setting, and
            // the only number that says whether shortening it was a good trade.
            metrics.event(metrics.EV.GENERATION_SUPERSEDED, { ms: Date.now() - startedAt });
            return;
        }
        metrics.event(metrics.EV.GENERATION, { ms: Date.now() - startedAt });

        // Engine ingests the classification and updates mode / stack / palette.
        const snap = engine.ingestClassification(result, partnerText);
        ui.showEngineState(snap);
        lastPalette = snap.palette;

        // Every checkpoint shows a palette now — we no longer suppress on a
        // turn_status guess (Ken, July 10 2026). generationOutcome still flags the one
        // real anomaly: the model returned an EMPTY palette when it owed responses
        // (logs → transcript red-wash + errors.log). Pure logic, unit-tested in
        // conversation-logic.js.
        const outcome = convLogic.generationOutcome(snap);
        if (outcome.anomaly) {
            storage.logError(outcome.anomaly.context, outcome.anomaly.message, { partner: (partnerText || '').slice(0, 200) });
        }

        // The partner themselves closed → offer the goodbyes as a pageable static
        // palette (New N dips further); otherwise the normal response cards.
        if (snap.mode === engine.MODE.PRE_CLOSING_CLOSING) {
            // Partner-initiated close — pin the decline so they can be held a moment.
            renderStaticPalette('closing', snap.palette,
                'Say goodbye — or hold them a moment', { pin: declineClosingCard() });
        } else if (composerOpen) {
            // ⚠ THE USER IS IN "In my own words", so these cards must not be rendered
            // under the composer — but they must not be thrown away either (Ken,
            // August 21 2026): "the reprompt results should be preserved and displayed
            // when the user selects in my own words and cancels from the compose
            // window. They should be discarded if the user speaks something from
            // within the compose window."
            //
            // Until now this could not arise, because opening the composer abandoned
            // the request outright. That solved the two real problems — a new set
            // landing under the box, and a placeholder speaking mid-sentence — by
            // throwing away work that was already paid for and, on a cancel, leaving
            // the user staring at cards older than what the partner had said.
            //
            // The engine has ALREADY ingested this classification above, so the
            // conversation state is current either way; only the rendering waits.
            currentStatic = { kind: null, full: [] };
            heldForComposer = { palette: snap.palette, at: Date.now() };
            metrics.event(metrics.EV.PALETTE_HELD, { kind: 'ai' });
        } else {
            currentStatic = { kind: null, full: [] };  // AI responses — New N regenerates, not pages
            showPalette(snap.palette);
        }
        ui.setTranscriptState('ready');
        // A closed set on the table → offer the alternatives as Express Panel chips
        // too, so the user can escalate from a one-tap answer to the full four-way
        // treatment of one of them. Deferred with the cards when the composer is open,
        // so the panel and the palette never describe different versions of the turn.
        const offered = (snap.lastClassification && snap.lastClassification.offered_options) || [];
        const range = (snap.lastClassification && snap.lastClassification.offered_range) || null;
        if (heldForComposer) { heldForComposer.offered = offered; heldForComposer.range = range; }
        else { setOfferedChoices(offered); setOfferedRange(range); }
        // Leave the closing branch's own message alone — it set a more specific one
        // above and this line used to overwrite it.
        if (snap.mode === engine.MODE.REPAIR_OF_SELF) {
            ui.setStatus('Partner didn\'t catch that — choose how to repeat');
        } else if (snap.mode !== engine.MODE.PRE_CLOSING_CLOSING) {
            ui.setStatus(offered.length
                ? 'Pick one of their options, or say something else'
                : 'Select a response');
        }
        // The placeholder ladder is already running — arm() started it at the
        // silence checkpoint and the first one may already have spoken (Ken,
        // August 7 2026: placeholders are gated by partner silence, not by this
        // round-trip). So this is now a CONFIRM-or-CANCEL, not a start:
        //   - stop() if a speaking button (Say again / Hold on / Wind down) fired
        //     while this generation was in flight — the user has acted, so no
        //     further placeholder may speak over or right after their statement;
        //   - stop() on a repair-initiator, the one turn that warrants none
        //     (shouldPlayPlaceholder); an acknowledgment may already have slipped
        //     out on a slow round-trip, which is the accepted cost;
        //   - otherwise start(), which just consumes the armed flag and lets the
        //     ladder continue to its later rungs.
        // Either way the response options above still show.
        if (pEpoch === placeholderEpoch && convLogic.shouldPlayPlaceholder(snap)) {
            placeholders.start();
        } else {
            placeholders.stop();
        }
        // Repair-of-self ("What?"): pre-generate the rephrase + expand wordings in ONE
        // call so those cards show real, speakable text (re-speak is already in hand).
        if (snap.mode === engine.MODE.REPAIR_OF_SELF) prefetchRepairOptions(token);

        // Which of the partner's words the model would not swear to. Recorded, not
        // acted on: it does not change the responses (the model answers the turn as it
        // best understands it either way) and nothing is shown to the user yet. Its
        // job for now is to say how well the microphone is doing -- see the note in
        // usage-summary on what this measure can and cannot see.
        currentPartnerUncertain = Array.isArray(result.heardUncertain) ? result.heardUncertain : [];

        // Record facts the model lacked — drives the questionnaire's "suggested
        // next." Open gaps only; recordGaps drops answered/declined keys.
        if (result.missingFacts && result.missingFacts.length) {
            worldview.recordGaps(result.missingFacts, partnerText).catch(() => { /* non-fatal */ });
        }
    } catch (err) {
        if (token !== generationToken) return;
        // A rate-limit refusal is separated from every other failure because it is not
        // a product fault at all: it is several testers sharing one key, and the fix is
        // separate keys rather than anything in the app. Counted apart so a run of them
        // cannot be read as the app breaking.
        metrics.event(isRateLimit(err) ? metrics.EV.RATE_LIMITED : metrics.EV.GENERATION_FAILED,
            { ms: Date.now() - startedAt });
        storage.logError('generateOptions', err.message, { partner: (partnerText || '').slice(0, 200) });
        placeholders.stop();
        // The AI is unreachable, so it can neither suggest responses NOR tidy the
        // transcript. Keep the partner's raw words visible, marked blue/italic
        // (state 'uncleaned' on the LIVE turn), so the user can read them and reply
        // with the Express Panel / "In my own words" — those commit + save on top of
        // this (the red wash from logError flags the hiccup). Nothing is committed
        // here: when the user replies the partner turn is committed like any other, so
        // the words aren't duplicated and none are lost if the partner keeps talking.
        // Try again retries the same turn.
        updatePartnerLive(partnerText);
        ui.setTranscriptState('uncleaned');
        ui.showResponseError('AI is unavailable — reply using the Express Panel or “In my own words.” The partner\'s words are shown above.', () => generateOptions(partnerText));
        ui.setStatus(`Error: ${err.message}`);
    }
}

// A response from the palette was selected. Repair-of-self operations act on the
// user's own last utterance; everything else is a normal SPP / opener / closer.
async function handleResponseSelected(response, index) {
    if (response.op) return handleRepairOfSelf(response);

    // Opening the conversation: after the user's opening statement is spoken, the
    // partner is expected to reply, so start recording automatically (Ken) —
    // regardless of the auto-resume setting, and arm the session so later
    // exchanges can auto-resume too. Captured before selectResponse clears the mode.
    const wasOpener = response.slot === 'OPENER';
    const wasWindDown = response.slot === 'WIND_DOWN';
    const wasClosing = response.slot === 'CLOSING';
    const wasDecline = response.slot === engine.SLOT.CLOSING_DECLINE;

    // Stop the deliberation clock before anything else happens in here — speaking
    // takes a second or more, so a reading time taken after it would be wrong by the
    // length of the sentence.
    const decideMs = noteUserAction('card');
    metrics.paletteTaken({ slot: response.slot || null, index, decideMs });

    placeholders.stop();
    // The user has decided, so their choice beats any refresh still in flight:
    // abandon it and drop the "cards may change" cue now rather than when the
    // palette is cleared several awaits later (Ken, August 20 2026).
    generationToken++; // invalidate any in-flight generation
    ui.setPaletteBusy(false);

    // ⚠ THE DEFERRED ENDING, AND IT MUST HAPPEN HERE — BEFORE `raw` IS READ BELOW.
    // Start conversation puts the openers up without ending anything (see
    // handleInitiate), so choosing one is the moment the old conversation actually
    // closes. terminateConversation() commits whatever the other person had half-said
    // to the OLD conversation and then clears the speech buffer, which is exactly the
    // right home for it. Doing this after `raw` was read would carry their words
    // forward into the NEW conversation instead, where nobody said them — a turn in
    // the wrong file, silent, and only visible weeks later in a review.
    // ⚠ CHOOSING ANY CARD COMMITS, so there is nothing left to go back to and the latch
    // must go out here rather than on the paths that happen to redraw the palette. It
    // was originally cleared only when an opener closed a live conversation, which left
    // the button lit after the ordinary case of opening a conversation from cold - the
    // palette is CLEARED at the end of that path rather than replaced, so the guard in
    // showPalette never saw it either. Two partial clears and no complete one.
    overlayClearLatch();

    if (wasOpener && pendingNewConversation) {
        pendingNewConversation = false;
        await terminateConversation();
        metrics.conversationStarted({ practice: practiceMode });
        // terminateConversation() resets the engine, so put it back into the opening
        // state the card was drawn from before the selection below consumes it.
        ui.showEngineState(engine.initiate({ partnerName: partnerLabel(activePartner) }));
    }

    // Capture the partner's speech BEFORE stopping the mic — if they were still
    // talking (resumed after the options appeared), grab what they'd said, not just
    // the last checkpoint's text.
    const raw = heardPartnerText();
    // In Practice Mode there is no mic — the partner line lives in currentPartnerText
    // (set when it was fed through the pipeline), and touching STT is unnecessary.
    if (!practiceMode) {
        stt.stopListening();
        // Discard the STT buffer now that the partner turn has been consumed.
        // stopListening() leaves accumulatedText intact, so without this a follow-up
        // selection whose mic never restarts (e.g. re-offered closings with
        // auto-resume off) would read the SAME partner speech back out of
        // heardPartnerText() and re-commit it — the last utterance appearing once per
        // closing pick (Ken, July 10 2026).
        stt.resetTranscript();
    }
    currentPartnerText = '';
    currentPartnerUncertain = [];

    ui.setStatus('Speaking...');
    await speakUserStatement(response.text);

    // Append the exchange to the transcript AFTER it has been spoken (Ken). The
    // now-playing line is suppressed for user statements (speakUserStatement), so
    // the statement isn't shown as pre-text — it appears once it has been said.
    engine.selectResponse(response);
    ui.showEngineState(engine.getSnapshot());
    await commitExchange(raw, response.text, index, { decideMs });

    if (wasDecline) {
        // The user held the partner back, so the conversation is open again: leave
        // pre-closing, drop the goodbyes, and start listening for their reply (the
        // user has just claimed the floor to say something, and the partner will
        // typically wait). From here "In my own words" / Reframe generate the lead.
        ui.showEngineState(engine.reopenFromClosing());
        resetStaticPaging();
        clearPalette();
        if (practiceMode) {
            // No mic in practice: wait for the user to say their piece (composer /
            // Express), then Start Listening cues the partner's reply as usual.
            isListening = false;
            ui.setListenButtonState(false);
        } else {
            manualListenArmed = true;
            startFreshListening();   // the partner will likely wait — capture their reply
        }
        ui.setStatus('Go ahead — say what you wanted to say');
    } else if (wasOpener) {
        manualListenArmed = true;   // starting a conversation arms auto-resume
        // Practice Mode has NO mic: "capturing" there means cueing the AI partner, and
        // practiceResumeOrIdle already gates that on the user's own auto-resume setting
        // — which is the point of Practice Mode, since it rehearses their real rhythm.
        // Without this guard startFreshListening() opened a REAL microphone in a
        // practice session. The asymmetry with the live path, which captures whatever
        // auto-resume says, is deliberate: losing a real partner's words is
        // irreversible, while an uncued practice partner simply waits for a tap.
        // (Ken, August 7 2026.)
        if (practiceMode) practiceResumeOrIdle();
        else startFreshListening();   // begin capturing the partner now
    } else if (wasWindDown || wasClosing) {
        // After a wind-down statement, offer the goodbyes so the user can sign off
        // without waiting for the partner to reply; after a goodbye, re-offer them
        // (the partner may say bye back). Listening still resumes if armed (Ken).
        offerClosings();
    } else {
        resumeOrIdle();
    }
}

// Show the CLOSING palette (goodbyes) after a wind-down or closing was spoken, so a
// farewell is one tap away, and resume listening (if armed) so a partner reply is
// still captured. The mic-resume mirrors startFreshListening but WITHOUT clearing
// the palette (we want the closings to stay visible).
function offerClosings() {
    // Same practice guard as the opener path above: this opened a REAL microphone in a
    // practice session. It deliberately does NOT cue the AI partner instead — that
    // would generate a reply immediately and its palette would replace the closings we
    // are about to show, whereas a live mic just waits. So in practice the goodbyes are
    // shown and the user taps Start Listening when ready, matching the decline-a-closing
    // rule already in force. (Ken, August 7 2026.)
    if (!practiceMode && manualListenArmed && storage.loadAutoRelisten()) {
        currentPartnerText = '';
        currentPartnerUncertain = [];
        generationToken++;
        ui.setLiveTranscript('');
        ui.setTranscriptState('idle');
        stt.startListening();
    }
    const snap = engine.showClosings();
    ui.showEngineState(snap);
    renderStaticPalette('closing', snap.palette, 'Say goodbye, or wait for their reply');
}

// REPAIR-OF-SELF (design §7.2): re-speak verbatim (instant, no LLM), or
// rephrase / expand the user's last utterance via a round-trip.
// Pre-generate the rephrase + expand wordings (one combined call) when the partner
// asks the user to repeat, so their cards show real text instead of a hint (Ken).
// Best-effort: on failure/supersession the cards keep their hints and tapping
// falls back to an on-demand round-trip in handleRepairOfSelf.
async function prefetchRepairOptions(token) {
    const last = engine.getLastUserUtterance();
    if (!last) return;
    ui.setPaletteBusy(true);   // rephrase/expand still show hints; their wording is coming
    let opts;
    try {
        opts = await llm.repairOptions(last, conversationHistory);
    } catch (err) {
        storage.logError('repairOptions', err.message);
        return;
    }
    // Bail if a newer turn superseded this, or the user already left repair-of-self.
    if (token !== generationToken) return;
    if (engine.getMode() !== engine.MODE.REPAIR_OF_SELF) return;
    const snap = engine.setRepairOptions(opts);
    // Deliberately NOT showPalette: these cards are already on screen and the user is
    // already reading them — two of the three simply gain real wording in place of
    // their hint. Restarting the deliberation clock here would report the reading as
    // shorter than it was, and counting it as a fresh offer would inflate the
    // denominator abandonment is measured against.
    ui.showResponses(snap.palette, handleResponseSelected);
}

async function handleRepairOfSelf(response) {
    placeholders.stop();
    generationToken++;
    stt.stopListening();

    let text = engine.getLastUserUtterance();
    if (!text) {
        ui.setStatus('Nothing to repeat yet');
        return;
    }
    if (response.op !== 'respeak') {
        // Prefer the pre-generated wording already shown on the card; only round-trip
        // if the pre-generation hasn't arrived yet or failed.
        if (response.text && response.text.trim()) {
            text = response.text.trim();
        } else {
            ui.setStatus(response.op === 'expand' ? 'Expanding…' : 'Rephrasing…');
            try {
                text = await llm.repairSelf(engine.getLastUserUtterance(), response.op, conversationHistory);
            } catch (err) {
                storage.logError('repairSelf', err.message, { op: response.op });
                ui.setStatus(`Error: ${err.message}`);
                return;
            }
        }
    }

    const raw = currentPartnerText; // the partner's repair-initiator turn ("What?")
    currentPartnerText = '';
    currentPartnerUncertain = [];

    ui.setStatus('Speaking...');
    await speakUserStatement(text);

    // Append to the transcript AFTER speaking (Ken); the now-playing line stays
    // suppressed during the speech, so there's no pre-text preview.
    engine.completeRepairOfSelf(text);
    ui.showEngineState(engine.getSnapshot());

    // Log the partner's repair initiation and the user's restated turn. The
    // partner's "What?" was already written at its pause, so finalize that pending
    // entry rather than appending a duplicate.
    if (raw) {
        placePartnerTurn(raw);   // in place if promoted mid-turn, else append
        const h = storage.detachPendingPartnerTurn();
        storage.finalizePartnerTurn(h, { rawTranscript: raw, cleanedTranscript: raw });
    }
    conversationHistory.push({ role: 'user', text });
    storage.logUserResponse({ selectedText: text, spokenText: spokenFormFor(text), ttsUsed: tts.lastVoiceUsed(), selectedIndex: -1, allOptions: [], source });
    ui.renderConversation(conversationHistory);
    ui.setLiveTranscript('');
    resumeOrIdle();
}

// Commit the partner turn (it feeds context for future turns) followed by the
// user's response. `raw` may be empty (openers / closers have no captured partner
// turn).
//
// ⚠ THE PARTNER'S WORDS ARE RECORDED AS HEARD. There used to be a second AI request
// here that rewrote them into readable prose; it was removed on August 27 2026
// because of WHEN it ran -- after the user had already chosen a response, so it could
// never improve the suggestions for the turn it tidied, while it could quietly
// rewrite something that had been right. The reasoning is in full above
// llm.generateResponses. What survives of it is `heard_uncertain`, which reports the
// same judgment instead of acting on it, inside the request that was going out
// anyway.
/**
 * What the synthesiser was actually handed, when that differs from the words shown.
 * Two layers can move it: an Express phrase carrying its own spoken form, and a name
 * carrying a respelling. Returns null when they are the same, which is nearly every
 * turn — see storage.logUserResponse for why the log stores it separately.
 *
 * Recomputed here rather than reported back from tts because it is deterministic
 * given the same lexicon, and this runs microseconds after the speech, so the two
 * cannot disagree.
 */
function spokenFormFor(displayText, spokenOverride) {
    const said = pronunciation.apply(spokenOverride || displayText);
    return said && said !== displayText ? said : null;
}

async function commitExchange(raw, userText, index, opts = {}) {
    const { spokenText = null, decideMs = null } = opts;
    // The user has taken the floor, so the partner's turn — and any choices it put
    // on the table, and any steering of it — is done. Shared by every path that
    // commits a user turn (response pick, Express phrase, composer, repair-of-self).
    setOfferedChoices([]);
    setOfferedRange(null);
    clearTurnSteering();
    dropHeldForComposer();
    if (raw) {
        // Updates the entry in place if it was already promoted by a mid-turn user
        // command (so it stays before that command), else appends it.
        placePartnerTurn(raw);
    }
    conversationHistory.push({ role: 'user', text: userText });
    // Render the running transcript (user turn visible now) and clear the live turn.
    ui.renderConversation(conversationHistory);
    ui.setLiveTranscript('');

    const userLog = {
        selectedText: userText,
        spokenText: spokenFormFor(userText, spokenText),
        ttsUsed: tts.lastVoiceUsed(),
        selectedIndex: index,
        // Only a palette selection (index >= 0) has a meaningful "all options"
        // list; a free-composed utterance (index -1) was not picked from a
        // palette, so don't log the (possibly stale) last palette against it.
        allOptions: index >= 0 ? lastPalette.map(m => m.text).filter(Boolean) : [],
        // WHICH KIND of response was chosen — the CA category, not its position
        // (Ken, August 7 2026). Position carries category on a static layout, but a
        // position alone cannot be read back as a category later, because the
        // palette's composition varies: four structural slots on an ordinary turn,
        // the CHOICE family on a closed-set turn, openers/wind-downs/closings, or
        // the three repair-of-self options. So the slot is recorded explicitly.
        // This is what makes "is every category earning its cell?" answerable — a
        // category never selected across a whole beta is a design finding, and
        // heavy REPAIR use means something upstream is failing.
        selectedSlot: index >= 0 ? (lastPalette[index] && lastPalette[index].slot) || null : null,
        // 'card' when the user tapped one of the AI's suggestions. index < 0 reaches
        // here from repair-of-self and other non-palette commits, which are our words
        // rather than theirs — see the source field in storage.logUserResponse.
        source: index >= 0 ? 'card' : 'control',
        // How long the cards were up before the user acted — see the field note in
        // storage.logUserResponse. null when no cards were showing.
        decideMs,
        // Stamp the situation at this turn (who, how the user felt, where they
        // were) — each null when its toggle is off.
        partner: partnerStamp(),
        feeling: feelingStamp(),
        place: placeStamp(),
    };

    if (raw) {
        // Finalize the partner entry FIRST, then write the user turn, so the file keeps
        // partner-then-user order whether or not a pause had already written the
        // partner line: with a handle the entry is updated in place at its existing
        // position, without one it is appended and must land before the user's turn.
        const stamp = partnerStamp();
        const placeAt = placeStamp();
        const uncertain = currentPartnerUncertain;
        const partnerHandle = storage.detachPendingPartnerTurn();
        (async () => {
            await storage.finalizePartnerTurn(partnerHandle, {
                rawTranscript: raw,
                // Kept equal to the raw wording, and kept as a field: every reader of
                // an older conversation still expects it, and files written while the
                // tidy-up existed genuinely differ. Nothing writes a different value.
                cleanedTranscript: raw,
                partner: stamp,
                // Where they were, so hearing trouble can be read per room and not only
                // per person. Already stamped on the user's side of the exchange; the
                // partner's side is the half that says how well they were heard.
                place: placeAt,
                uncertain,
            });
            await storage.logUserResponse(userLog);
        })();
    } else {
        storage.logUserResponse(userLog);
    }
}

// Auto-resume only if the user has manually started listening this session (and
// hasn't since manually stopped) — see manualListenArmed.
function resumeOrIdle() {
    if (practiceMode) return practiceResumeOrIdle();
    if (manualListenArmed && storage.loadAutoRelisten()) {
        metrics.event(metrics.EV.LISTEN, { auto: true, status: 'start' });
        startFreshListening();
    } else {
        ui.setTranscriptState('idle');
        ui.setStatus('Ready — tap Listen for the next exchange');
    }
}

// --- Practice Mode (§8) --------------------------------------------------------
// The AI plays the communication partner. "Start Listening" cues the partner (no
// mic); the partner's line is spoken in a distinct voice and fed through the SAME
// generation pipeline as a real utterance, so the user picks responses exactly as
// in a real conversation. The listen gate (manualListenArmed + auto-resume) is the
// real one, so practice rehearses the actual discipline.
//
// Practice is entered and left from Settings → Practice (Ken, July 2026), not the
// pre-start screen: it's a mode you drop into and out of from the conversation
// screen, so leaving practice returns there rather than to the Start screen.

// The voice the AI partner speaks in: the user's chosen partner voice, or — if
// none set — the first available voice that isn't the user's own, so it's audibly
// distinct out of the box.
// `chosen` is passed in by the Settings Test button so it can resolve the value
// currently showing in the select rather than the last-saved one.
function pickPartnerVoice(chosen = storage.loadPartnerVoice()) {
    if (chosen) return chosen;
    // Auto never lands on a novelty voice, whatever the user's show/hide choice —
    // that setting governs what they may CHOOSE, not what the app picks for them.
    // Before this, on an iPad, every en-US voice except the user's own was a gag
    // voice, so the practice partner spoke as Albert or Zarvox.
    const voices = tts.usableVoices(false);
    if (!voices.length) return undefined;

    // Resolve what the user's voice ACTUALLY is before excluding it. When Voice is
    // left on "Browser default" the app holds no URI, and the earlier version
    // excluded "no URI" — which excludes nothing, so it returned the first voice in
    // the list. That is precisely the voice the browser default resolves to, so the
    // partner came out sounding identical to the user (Ken, July 31 2026, on the
    // iPad). `default` is the flag that marks it; the first voice is the fallback
    // where nothing is flagged.
    // Resolved against the FULL list, not the filtered one: if the user has turned
    // the joke voices back on and chosen Whisper, that is still the voice we must
    // avoid sounding like, even though it is not a candidate for the partner.
    const all = tts.getVoices();
    const ownURI = tts.getSelectedVoiceURI();
    const own = all.find(v => v.voiceURI === ownURI)
        || all.find(v => v.default)
        || all[0];

    // Prefer a different voice IN THE SAME LANGUAGE. "Any other voice" is fine with
    // the three or four a desktop offers, but an iPad carries dozens across many
    // languages, where the first non-match can easily be another language — audibly
    // distinct and completely unintelligible, which is not the point.
    const different = v => v.voiceURI !== own.voiceURI;
    const pick = voices.find(v => different(v) && v.lang === own.lang)
        || voices.find(different);
    return pick ? pick.voiceURI : undefined;
}

// Settings → Practice tab. Three states: practice already running (show which
// scenario + the way out), no API key (practice needs the AI for BOTH the partner
// and the response suggestions), or the scenario list.
function renderPracticePanel() {
    const panel = document.getElementById('practicePanel');
    panel.textContent = '';

    if (practiceMode && practiceScenario) {
        const now = document.createElement('p');
        now.className = 'practice-active';
        now.textContent = `Practicing: ${practiceScenario.title}`;
        const endBtn = mkButton('End practice', 'practice-end', async () => {
            await endPractice();
            renderPracticePanel();
            hostExpressPanel(false);   // the panel must not close inside the dialog
            document.getElementById('settingsDialog').close();
        });
        panel.append(now, endBtn);
        return;
    }

    // ⚠ THE KEY GATE IS PER-SCENARIO, NOT PER-TAB, AND THAT IS THE WHOLE POINT OF THE
    // TOUR. A conversational scenario needs the AI for both the partner and the
    // response suggestions; the controls tour is scripted and needs neither. Gating
    // the tab would have hidden the tour from exactly the person it is for — someone
    // on their first day whose key is not working yet, looking at a screen of
    // unlabelled icons. So the notice still appears, and the tour is offered under it.
    const hasKey = !!(storage.loadApiKey() || '').trim();
    if (!hasKey) {
        const msg = document.createElement('p');
        msg.className = 'practice-note';
        msg.textContent = 'Practicing a conversation needs a Claude API key — the AI plays the other person and suggests your responses. Add one on the General tab, then come back. The tour of the buttons below works without one.';
        const goBtn = mkButton('Go to the General tab', 'practice-add-key', () => {
            activateSettingsTab(document.querySelector('#settingsTabs .settings-tab[data-tab="general"]'), true);
        });
        panel.append(msg, goBtn);
    }

    const title = document.createElement('h3');
    title.className = 'practice-title';
    title.textContent = hasKey ? 'Choose something to practice' : 'What you can do without a key';
    panel.appendChild(title);

    const list = document.createElement('div');
    list.className = 'practice-list';
    const offered = hasKey
        ? practiceScenarios.SCENARIOS
        : practiceScenarios.SCENARIOS.filter((s) => Array.isArray(s.steps) && s.steps.length);
    for (const scenario of offered) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'practice-card';
        const cat = document.createElement('span');
        cat.className = 'practice-cat';
        cat.textContent = scenario.category;
        const name = document.createElement('span');
        name.className = 'practice-name';
        name.textContent = scenario.title;
        const desc = document.createElement('span');
        desc.className = 'practice-desc';
        desc.textContent = scenario.description;
        card.append(cat, name, desc);
        card.addEventListener('click', () => startPractice(scenario));
        list.appendChild(card);
    }
    panel.appendChild(list);
}

function mkButton(label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
}

// Enter Practice Mode with the chosen scenario: close Settings, start a fresh
// conversation on the real conversation screen, and wait for the user to tap Start
// Listening to cue the partner (never auto-plays — reinforces the step).
async function startPractice(scenario) {
    practiceMode = true;
    practiceScenario = scenario;
    // A scenario carrying `steps` is the controls tour, not a conversation — see
    // practice-tour.js. Set before terminateConversation, which clears the tour.
    const isTour = Array.isArray(scenario.steps) && scenario.steps.length > 0;
    keyboard.hideKeyboard();
    hostExpressPanel(false);       // the panel must not close inside the dialog
    document.getElementById('settingsDialog').close();
    await terminateConversation(); // fresh conversation state + log (keeps practiceMode)
    isListening = false;
    manualListenArmed = false;
    ui.setListenButtonState(false);
    applyListenAvailability();   // practice needs no mic — re-enable Listen if capture is unavailable
    ui.setStatus(`Practice: ${scenario.title}. Tap Start Listening to hear the other person.`);
    // Set here, after the teardown above, so choosing a conversational scenario also
    // clears a tour left running from a previous one.
    tour = isTour ? practiceTour.createTour(scenario.steps) : null;
    ui.setCoachLine(null);
    if (isTour) speakTourStep();
}

// Abort practice and return to the standard conversation screen. Shared by the
// Practice tab's "End practice" button and by End conversation while practicing.
async function endPractice() {
    if (!practiceMode) return;
    await handleEndConversation();
}

// The partner takes a turn: author their line, speak it in the partner voice, then
// feed it through the normal pipeline so the user's response palette appears.
async function advancePracticePartner() {
    if (!practiceMode) return;
    const token = ++generationToken;   // aborts if the user ends/pauses mid-generation
    ui.setPaletteBusy(true);   // the cards showing may be replaced — say so (Ken)
    isListening = true;
    ui.setListenButtonState(true);     // red pulse + chime (rehearse the "listening" feel)
    ui.setStatus('The other person is speaking…');
    let line;
    try {
        line = await llm.generatePartnerUtterance(practiceScenario, conversationHistory);
    } catch (e) {
        storage.logError('practice-partner', e.message || String(e), { partner: partnerStamp() });
        ui.setStatus('Could not reach the AI. Check your API key and internet, then tap Start Listening.');
        isListening = false;
        ui.setListenButtonState(false);
        return;
    }
    if (token !== generationToken || !practiceMode) return;   // superseded (ended/paused)
    // Speak the partner's line in the DISTINCT partner voice. The mic is off in
    // practice, so there's no echo to filter.
    // Both voices are passed; tts.js uses whichever matches the active provider, so
    // the partner stays distinct from the user on either one.
    await tts.speak(line, { voiceURI: pickPartnerVoice(), auraModel: pickAuraPartnerVoice() });
    if (token !== generationToken || !practiceMode) return;
    // Feed the spoken line through the normal pipeline (logs the partner turn,
    // updates the engine, generates the user's response palette). Mic-free.
    await handleSilencePeriod(line);
}

// --- The controls tour (practice-tour.js) ---

// Say the current step and show it, then wait for the user to press the control it
// names. Nothing here is timed: the tour advances on a press and on nothing else, so
// a user who stops to think, or to try the button twice, is never left behind.
async function speakTourStep() {
    const step = practiceTour.currentStep(tour);
    if (!step) return;
    ui.setCoachLine(step.say);
    // The practice partner's voice, for the same reason spoken help uses it: it must
    // be audibly NOT the user's own, or the app explaining itself sounds like the
    // user saying it. One selection, already solved, nothing extra to configure.
    await tts.speak(step.say, { voiceURI: pickPartnerVoice(), auraModel: pickAuraPartnerVoice() });
}

// Set when the tour's last step was one that ends the session, so the closing
// message can be said AFTER the teardown instead of being wiped by it.
let tourFinishPending = false;

/**
 * A press landed somewhere while the tour is running.
 *
 * ⚠ OBSERVES, NEVER INTERCEPTS — no preventDefault and no stopPropagation. The whole
 * point is to learn what a button does, so the button must actually do it; a tour
 * that swallowed the press would be teaching a mime of the app.
 * ⚠ RUNS ON THE CAPTURE PHASE, which looks wrong for an observer and is not. The last
 * step is End conversation, whose handler clears the tour — on the bubble phase the
 * tour would already be gone by the time this ran, and the final step would never be
 * credited. Capture sees every press regardless of what the handler then does to the
 * state this depends on.
 * A press on anything else is ignored in silence: on this surface a stray tap is
 * ordinary, and a tour that scolded or restarted would be worse than one that waits.
 */
function handleTourPress(e) {
    if (!tour || !practiceMode) return;
    const step = practiceTour.currentStep(tour);
    const result = practiceTour.pressed(tour, e.target);
    if (result === 'ignored') { hintWhere(step, e.target); return; }
    if (result === 'finished') {
        const viaSessionEnd = practiceTour.finishedBySessionEnd(tour);
        tour = null;
        if (viaSessionEnd) tourFinishPending = true;   // announced by the teardown
        else announceTourFinished();
        return;
    }
    // Let the pressed control finish what it is doing — several of them repaint the
    // palette or open the composer — before the next instruction talks over it.
    setTimeout(speakTourStep, 700);
}

// When the wrong control is pressed, say where the right one is (Ken, August 15
// 2026) — its icon, its place in the row, and its color where a color actually
// distinguishes it. Describing the button is what "no scolding" should have meant:
// silence tells someone they were wrong without helping them be right, and on a row
// of nine unlabelled icons that is the whole difficulty.
let lastHintAt = 0;

function hintWhere(step, target) {
    if (!step || !step.where) return;
    // Only when the press landed on something PRESSABLE. A tap on the transcript, a
    // heading, or a stray bit of background is not a wrong answer and must not be
    // answered as though it were.
    if (!target || typeof target.closest !== 'function') return;
    if (!target.closest('button, .response-card, .ep-btn')) return;
    // Rapid repeat taps are one gesture, not several questions; without this the
    // hint restarts on each one and the user never hears the end of it.
    const now = Date.now();
    if (now - lastHintAt < 2500) return;
    lastHintAt = now;
    // The instruction STAYS on screen and the hint is added to it — the user still
    // needs to know what they are being asked to do, not only where the button is.
    ui.setCoachLine(`${step.say}\n${step.where}`);
    // Only the new information is spoken. Repeating the whole instruction on every
    // mis-tap would be slower to sit through each time it happened.
    tts.speak(step.where, { voiceURI: pickPartnerVoice(), auraModel: pickAuraPartnerVoice() });
}

function announceTourFinished() {
    tourFinishPending = false;
    ui.setCoachLine(practiceTour.TOUR_DONE);
    tts.speak(practiceTour.TOUR_DONE,
        { voiceURI: pickPartnerVoice(), auraModel: pickAuraPartnerVoice() });
}

// "Start Listening" in practice: cue the partner (or pause if already in a turn).
function togglePracticeCue() {
    // In the tour, Listen is simply the first step's target: it has already been
    // observed by handleTourPress, and there is no AI partner to cue. Returning here
    // is what keeps the tour free of generation calls (and so free of an API key).
    if (tour) return;
    if (isListening) {
        // Pause: stop the current partner turn and disarm auto-resume (mirrors a
        // manual Stop). The user taps again to continue.
        manualListenArmed = false;
        isListening = false;
        generationToken++;             // abort any in-flight partner/options generation
        placeholders.stop();
        tts.cancel();
        ui.setListenButtonState(false);
        ui.setStatus('Paused — tap Start Listening to continue.');
    } else {
        manualListenArmed = true;      // arm auto-resume for the rest of the session
        advancePracticePartner();
    }
}

// After the user responds in practice, either auto-cue the next partner turn (if
// auto-resume is armed) or wait for the user to tap Start Listening — the SAME gate
// as a real conversation.
function practiceResumeOrIdle() {
    if (manualListenArmed && storage.loadAutoRelisten()) {
        advancePracticePartner();
    } else {
        isListening = false;
        ui.setTranscriptState('idle');
        ui.setListenButtonState(false);
        ui.setStatus('Your turn is done — tap Start Listening to hear their reply.');
    }
}

// --- Persistent override controls (design §5.1) ---

// Fully clear and TERMINATE the current conversation (Ken): stop audio +
// listening, invalidate in-flight generation, drop the uncommitted partner turn,
// CLEAR the conversation window (transcript history) and ALL cards, and reset the
// engine to STANDBY. Shared by End conversation and Start conversation.
async function terminateConversation() {
    placeholders.stop();
    tts.cancel();
    // ⚠ THE TOUR IS DELIBERATELY NOT CLEARED HERE, and the first cut got this wrong.
    // This function is not "the conversation ended" — it is "wipe the conversation
    // state", and START conversation calls it too, which is step two of the tour. So
    // clearing here killed the tour on its own second instruction, leaving a blank
    // coach line and no error. The tour ends where the SESSION ends
    // (handleEndConversation) and nowhere else.
    // A new conversation gets its own start-of-listening cue, whichever mode.
    chime.resetConversation();
    // Raises "it ended" only if one had actually begun — see conversationBoundary.
    metrics.conversationBoundary({ turns: conversationHistory.length, practice: practiceMode });
    manualListenArmed = false;
    stt.stopListening();
    // Capture the partner's pending (uncommitted) turn BEFORE we discard the STT
    // buffer / history. If the partner spoke but the user ended / restarted before
    // choosing a reply, commit their words to THIS conversation instead of dropping
    // them (Ken, July 12 2026). Grab the situation stamp now too — it's captured
    // before clearInfluencers() (End's caller) can null the active Partner.
    const pendingRaw = heardPartnerText();
    const pendingStamp = partnerStamp();
    // stopListening() deliberately keeps accumulatedText (it survives restarts across
    // silences), so discard the partner's captured speech explicitly now that we've
    // grabbed it — otherwise it would leak into the next conversation: heardPartnerText()
    // would read the stale buffer when the user picks the next opener, and it would be
    // committed at the top of the new conversation though nobody spoke.
    stt.resetTranscript();
    generationToken++;                 // invalidate any in-flight generation
    currentPartnerText = '';
    currentPartnerUncertain = [];
    setOfferedChoices([]);
    setOfferedRange(null);
    clearTurnSteering();
    dropHeldForComposer();
    lastPalette = [];
    resetStaticPaging();                 // opener/wind-down/closing paging starts fresh
    conversationHistory.length = 0;     // clear the conversation window
    pendingPartnerHistoryIdx = -1;
    engine.reset();
    ui.renderConversation(conversationHistory);
    ui.setLiveTranscript('');
    ui.setTranscriptState('idle');
    ui.setTranscriptError(false);        // fresh conversation starts clean
    clearPalette();                     // clear all cards (back to empty reserved)
    ui.showEngineState(engine.getSnapshot());

    // Finalize the pending partner turn (if any) in the CURRENT <id>.json, THEN
    // reset the id. Ordered/awaited so the write lands in this conversation's file,
    // not the next one's, and done BEFORE the privacy re-seed below so it uses THIS
    // conversation's save setting. Finalized as heard — a
    // dangling turn with no user reply isn't a completed exchange, and raw keeps
    // the flush fast so it can't race the id reset. `heardPartnerText()` may hold
    // speech captured since the last pause, so prefer it over the pending entry's
    // last-written raw.
    const pendingHandle = storage.detachPendingPartnerTurn();
    const finalRaw = pendingRaw || (pendingHandle ? pendingHandle.rawTranscript : '');
    if (finalRaw) {
        await storage.finalizePartnerTurn(pendingHandle, { rawTranscript: finalRaw, cleanedTranscript: finalRaw, partner: pendingStamp });
    }
    storage.resetConversationId();       // next conversation gets a fresh id (error-log correlation)

    // Re-seed conversation privacy from the Settings default — a per-conversation
    // "Don't save" choice does not carry into the next conversation (Ken). After the
    // flush above, so the pending turn is written under this conversation's setting.
    conversationPrivate = storage.loadNoSaveDefault();
    applyPrivacyState();
}

// How many opener / wind-down / closing cards the response footprint can show: 8
// with the 2-per-category (8-card) setting, otherwise 4. These are flat lists (one
// per card), so we cap the palette to this before showing it (Ken — 8-card mode
// fills all 8 with conversation starters).
function conversationPaletteCap() {
    return storage.loadResponsesPerCategory() === 2 ? 8 : 4;
}

// --- Static conversation palettes: openers / wind-downs / closings -------------
// These predefined, user-owned lists (control-phrases.js) can define MORE cards
// than the footprint shows. The user pages through the extra cards (Ken, July
// 2026): re-pressing Wind down dips to the next set of wind-downs, and the "New N"
// button dips into whichever static set is showing. A per-kind offset persists for
// the whole conversation and wraps; it's reset when a conversation starts/ends.
const staticOffsets = { opener: 0, windDown: 0, closing: 0 };
let currentStatic = { kind: null, full: [] };  // static palette currently shown (for New N)
// "In my own words" is open, so a reprompt that finishes must wait rather than render
// under the box; and what it produced, kept for the cancel path (Ken, August 21 2026).
let composerOpen = false;
let heldForComposer = null;   // { palette, offered, at }

function dropHeldForComposer() { heldForComposer = null; }

/* Put up the cards a reprompt produced while the user was composing. Only the CANCEL
 * path calls this: speaking from the box ends the turn, and Reframe replaces the set
 * with something the user explicitly asked for. */
function showHeldForComposer() {
    if (!heldForComposer) return false;
    const { palette, offered, range, at } = heldForComposer;
    metrics.event(metrics.EV.PALETTE_TAKEN, { kind: 'ai', heldMs: Date.now() - at });
    heldForComposer = null;
    currentStatic = { kind: null, full: [] };
    showPalette(palette);
    setOfferedChoices(offered || []);
    setOfferedRange(range || null);
    ui.setStatus('Select a response');
    return true;
}
let windDownShown = false;                       // has Wrap up been shown this conversation?
let shownCards = { cards: [], kind: 'ai' };      // what is on the Response Panel right now

/* TEMPORARY PALETTE OVERLAYS — Wrap up and Start conversation (Ken, August 26 2026).
 *
 * Both buttons replace the Response Panel with a set of predefined cards, and before
 * this neither could be taken back: a stray tap left the user somewhere they had not
 * meant to go, with no way out that did not either say something or end something.
 *
 * ⚠ ONE BACKOUT SLOT, NOT ONE PER BUTTON, and the reason is the case with two presses
 * in it: from the openers you press Wrap up. If each button kept its own backout, the
 * Wrap up cancel would return you to the OPENERS - another place you did not mean to
 * be - and you would have to find the second cancel to get home. Keeping the first
 * capture means one cancel always returns to the real cards.
 */
let paletteOverlay = null;   // { which:'wrapUp'|'opener', cards, kind, static, status }

// An opener is showing over a live conversation that has NOT been ended yet. The
// ending is deferred to the moment an opener is actually chosen — see handleInitiate.
let pendingNewConversation = false;

function overlayEnter(which) {
    // Keep the FIRST capture: it is the one that leads back out of the app's overlays
    // entirely rather than into the other one.
    if (!paletteOverlay) {
        paletteOverlay = {
            which, cards: shownCards.cards, kind: shownCards.kind,
            static: currentStatic, status: ui.getStatus(),
        };
    }
    paletteOverlay.which = which;
    ui.setWrapUpState(which === 'wrapUp');
    ui.setStartConversationState(which === 'opener');
}

function overlayCancel() {
    const back = paletteOverlay;
    paletteOverlay = null;
    pendingNewConversation = false;
    ui.setWrapUpState(false);
    ui.setStartConversationState(false);
    // The general "we are staying in this conversation after all" transition.
    ui.showEngineState(engine.resumeConversation());
    currentStatic = back.static;
    showPalette(back.cards, back.kind);
    ui.setStatus(back.status || '');
}

function overlayClearLatch() {
    if (!paletteOverlay) return;
    paletteOverlay = null;
    ui.setWrapUpState(false);
    ui.setStartConversationState(false);
}

// A window of `cap` cards starting at `offset`, wrapping so the footprint stays
// full even when the list isn't a whole number of pages.
function pageWindow(list, offset, cap) {
    const arr = list || [];
    if (arr.length <= cap) return arr.slice();
    const out = [];
    for (let i = 0; i < cap; i++) out.push(arr[(offset + i) % arr.length]);
    return out;
}

/* ── The deliberation clock (Ken, August 16 2026) ────────────────────────────
 *
 * From the moment the cards appear to the moment the user does ANYTHING. That span
 * is the only part of the partner's wait that belongs to the person rather than the
 * machine, and it is what makes reading load measurable at all — the existing wait
 * figure runs from the partner stopping and has the recognizer and the AI mixed into
 * it, so a slow model and a heavy reading task look identical in it.
 *
 * ⚠ THE CLOCK STOPS ON THE FIRST ACTION OF ANY KIND, not on a card tap (Ken). Tapping
 * an Express button, opening "In my own words", pressing a Command Bar button and
 * asking for different options all end the deliberation just as a card tap does. A
 * clock that only stopped on a card tap would systematically miss the turns where the
 * reading was heaviest — the ones where the user gave up and typed instead — and so
 * would report reading load as easier than it is, in exactly the cases that matter.
 *
 * One-shot per palette: only the FIRST action counts, so a user who taps a card and
 * then presses something else does not record two spans for one reading.
 */
let cardsShownAt = 0;
let decideTaken = false;

// Cards became visible. `kind` is 'ai' for generated suggestions, or the static set's
// name (opener / windDown / closing) — worth separating, because reading four
// generated sentences is a different task from reading four of your own goodbyes.
function noteCardsShown(cards, kind) {
    const list = cards || [];
    cardsShownAt = Date.now();
    decideTaken = false;
    let words = 0;
    for (const c of list) {
        if (c && typeof c.text === 'string') words += (c.text.trim().match(/\S+/g) || []).length;
    }
    metrics.paletteShown({ kind, cards: list.length, words });
}

// Stop the clock and report it, once. Returns the span in milliseconds, or null when
// no cards were showing or the span has already been taken for this palette.
function noteUserAction(kind) {
    if (!cardsShownAt || decideTaken) return null;
    decideTaken = true;
    const ms = Date.now() - cardsShownAt;
    // A span over ten minutes is someone who walked away and came back, not a
    // reading time; recording it would wreck the median it feeds.
    if (ms < 0 || ms > 10 * 60 * 1000) return null;
    metrics.event(metrics.EV.DECIDE, { kind, ms });
    return ms;
}

// Show generated cards. Every path that puts AI suggestions in the response
// footprint goes through here so the clock and the offer count cannot drift apart —
// there are six such paths, and instrumenting them one at a time is how one gets
// missed.
/* Clearing the panel back to the empty reserved outlines.
 *
 * ⚠ IT GOES THROUGH HERE SO shownCards CANNOT GO STALE. That record is what the Wrap up
 * and Start conversation cancels put back, and calling ui.clearResponseOptions()
 * directly left it holding whatever was last SHOWN - so cancelling out of the openers
 * restored a palette from an earlier turn instead of the empty panel the user had been
 * looking at. Every path that empties the panel has to say so.
 */
function clearPalette() {
    ui.clearResponseOptions();
    shownCards = { cards: [], kind: 'none' };
}

function showPalette(cards, kind = 'ai') {
    ui.showResponses(cards, handleResponseSelected);
    // The one choke point every palette passes through, so remembering it here is the
    // only way to know what was on screen without every caller reporting it. Used by
    // the Wrap up toggle to put back exactly what it covered.
    shownCards = { cards, kind };
    // ⚠ ANY palette that is not the wind-down statements ends the wrap-up, so the latch
    // is cleared HERE rather than at each of the paths that can do it - speaking a
    // wind-down (which moves on to the goodbyes), the other person talking again, a
    // reframe, a regenerate. Clearing it at the call sites means the one path nobody
    // thought of leaves the button lit with nothing behind it. The cancel press clears
    // the backout itself BEFORE calling this, so restoring cannot re-trip it.
    if (kind !== 'windDown' && kind !== 'opener') overlayClearLatch();
    noteCardsShown(cards, kind);
}

// Render a predefined static palette (opener/windDown/closing), optionally
// advancing to the next page first (the Wind down re-press / New N "dip").
// `pin` holds entries that must ALWAYS be on screen: they take the last cells and
// are excluded from paging, so the paged window shrinks to fit around them. Used
// for the decline-the-closing card, which is useless if a page turn hides it.
function renderStaticPalette(kind, full, statusMsg, { advance = false, pin = [] } = {}) {
    const cap = conversationPaletteCap();
    const window = Math.max(1, cap - pin.length);
    if (advance && full.length > window) {
        staticOffsets[kind] = (staticOffsets[kind] + window) % full.length;
    }
    currentStatic = { kind, full: full || [], pin };
    const cards = [...pageWindow(currentStatic.full, staticOffsets[kind], window), ...pin];
    showPalette(cards, kind);
    if (statusMsg) ui.setStatus(statusMsg);
}

// The "Actually, before you go —" card, offered when the PARTNER starts closing.
// Selecting it speaks the phrase and takes the floor like any other response, so
// the user holds the conversation open and can then say the thing itself.
//
// The wording is one of a LIST the user owns (Ken, August 29 2026). Only one is ever
// on screen, because the card is PINNED to a cell and the whole point of pinning it
// is that a page turn cannot take it away — so "New N" turns the goodbyes AND moves
// this card to the next wording, which is how every version stays reachable without
// the palette ever changing shape.
function declineClosingCard({ advance = false } = {}) {
    const text = advance ? controlPhrases.nextPhrase('declineClosing')
                         : controlPhrases.pickPhrase('declineClosing');
    if (!text) return [];
    return [{ slot: engine.SLOT.CLOSING_DECLINE, text, hint: text, priority: 2, latency: 'instant' }];
}

function resetStaticPaging() {
    staticOffsets.opener = 0;
    staticOffsets.windDown = 0;
    staticOffsets.closing = 0;
    currentStatic = { kind: null, full: [], pin: [] };
    windDownShown = false;
    overlayClearLatch();
    pendingNewConversation = false;
}

// Show a non-paged conversation palette (the Reframe-to-steer STATEMENT cards,
// which the LLM already returns capped). Clears the static-paging cursor so the
// "New N" button doesn't try to page an LLM result.
function showConversationPalette(palette, statusMsg) {
    currentStatic = { kind: null, full: [] };
    showPalette((palette || []).slice(0, conversationPaletteCap()));
    if (statusMsg) ui.setStatus(statusMsg);
}

// Start conversation — terminate the current one (clear window + cards), then
// open a fresh conversation in INITIATING mode with the openers.
/* Start conversation — put the openers up. A toggle, like Wrap up.
 *
 * ⚠ IT NO LONGER ENDS THE CURRENT CONVERSATION WHEN PRESSED. THE ENDING IS DEFERRED
 * TO THE MOMENT AN OPENER IS CHOSEN (Ken, August 26 2026), and without that this
 * button could not honestly be a toggle. Pressing it used to run the full teardown at
 * once: stop listening, commit whatever the other person had half-said, throw away the
 * speech buffer, clear the conversation from the screen, reset Partner and Feeling,
 * close the saved conversation file, reset the engine. Putting the cards back
 * afterwards would have shown a palette belonging to a conversation that no longer
 * existed - the screen looking recovered while the record underneath had already been
 * ended. That is a worse failure than the dead end it was meant to fix.
 *
 * So: press once, the openers appear and NOTHING else happens. Press again, the
 * previous cards return and nothing has changed. Choose an opener and only then is the
 * old conversation closed and the new one begun (see handleResponseSelected).
 *
 * Ken's reason for preferring this to simply disabling the button mid-conversation:
 * starting a new conversation part-way through a session is a legitimate thing to want
 * - you finish with one person and turn to another - so the fix must not remove it.
 */
function handleInitiate() {
    noteUserAction('command');
    placeholders.stop();
    if (paletteOverlay && paletteOverlay.which === 'opener') {
        metrics.event(metrics.EV.COMMAND_BAR, { button: 'start conversation cancel' });
        overlayCancel();
        return;
    }
    metrics.event(metrics.EV.COMMAND_BAR, { button: 'start conversation' });
    // Nothing here ends anything, but a generation still in flight must not land on
    // top of the openers.
    generationToken++;
    overlayEnter('opener');
    // Is there actually a conversation to close when an opener is chosen? Openers on
    // screen are not one, and neither is Practice Mode on its own.
    pendingNewConversation = conversationHistory.length > 0 || isListening
        || !!currentPartnerText || !!heardPartnerText();
    // If a Partner is active, personalize the openers with their name ("Hi Tim,
    // have you got a minute?" instead of "Hey, got a minute?").
    const snap = engine.initiate({ partnerName: partnerLabel(activePartner) });
    ui.showEngineState(snap);
    renderStaticPalette('opener', snap.palette, 'Pick an opener');
}

// Push the user's edited openers / wind-downs / closings into the engine (Hold on /
// Pardon? are read straight from the model at tap time). Called after load/sync and
// on every edit via the editor's onChange.
function applyControlPhrases() {
    const p = controlPhrases.getPhrases();
    // Drop blank rows (the editor allows a transient empty row) so no empty card
    // reaches the palette; setConversationPhrases ignores a fully-empty list and
    // keeps the defaults.
    const clean = (a) => (a || []).map((s) => s.trim()).filter(Boolean);

    // The active partner's own phrases go FIRST, then the global list (Ken, August
    // 7 2026: add rather than replace). So adding one starter for one person costs
    // nothing and loses nothing — page 1 of the palette is theirs, and paging
    // reaches the global set, since static palettes have paginated since v0.5.93.
    // Deduped case-insensitively so a phrase in both lists does not show twice.
    const mine = (activePartner && activePartner.personId)
        ? relationships.partnerPhrases(activePartner.personId)
        : { openers: [], windDowns: [], closings: [] };
    const merge = (theirs, global) => {
        const out = [];
        const seen = new Set();
        for (const s of [...clean(theirs), ...clean(global)]) {
            const k = s.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(s);
        }
        return out;
    };

    engine.setConversationPhrases({
        openers: merge(mine.openers, p.openers),
        windDowns: merge(mine.windDowns, p.windDowns),
        closings: merge(mine.closings, p.closings),
    });
}

// A persistent-control action spoke something AS the user - today "Repeat what I
// said" and "Ask them to repeat". Both carry content the conversation turns on: one
// is the user's own words again, the other a repair the partner answers. So they are
// recorded in the transcript + log (Ken). Not a palette pick, so index -1.
//
// "Hold on" used to come through here and no longer does (Ken, August 27 2026): it
// draws from the placeholder pool, and the app's own placeholders have never been
// recorded.
function logSpokenUserTurn(text) {
    if (!text) return;
    // A live partner turn must sit BEFORE this user turn in both the pane and the
    // transcript (Ken — they mirror). Write the partner's heard text to the
    // transcript (a no-op/overwrite if a pause already wrote it — it does NOT
    // finalize the turn, which the partner still holds), and promote it into the
    // pane history, before appending this user turn.
    const partnerRaw = heardPartnerText();
    if (partnerRaw) storage.logPartnerInterim({ rawTranscript: partnerRaw, partner: partnerStamp() });
    flushLivePartnerToHistory();
    conversationHistory.push({ role: 'user', text });
    ui.renderConversation(conversationHistory);
    // 'control' -- these are OUR phrases (Hold on / Ask them to repeat / the user's
    // own last words re-spoken), never the user's own composition.
    storage.logUserResponse({ selectedText: text, spokenText: spokenFormFor(text), ttsUsed: tts.lastVoiceUsed(), selectedIndex: -1, allOptions: [], source: 'control' });
}

// Say again — re-speak the user's last utterance verbatim. Instant, no LLM.
async function handleSayAgain() {
    noteUserAction('command');
    metrics.event(metrics.EV.COMMAND_BAR, { button: 'say again' });
    const text = engine.getLastUserUtterance();
    if (!text) { ui.setStatus('Nothing to repeat yet'); return; }
    // Abort placeholders instantly AND stop an in-flight generation from restarting
    // one (Ken) — without discarding the partner turn's response options.
    abortPlaceholders();
    ui.setStatus('Speaking...');
    await speakUserStatement(text);
    logSpokenUserTurn(text);          // append to the transcript AFTER speaking (Ken)
    ui.setStatus(isListening ? 'Listening...' : 'Ready');
}

// Hold on — manually fire a floor-holding statement. Instant.
async function handleHoldOn() {
    noteUserAction('command');
    metrics.event(metrics.EV.COMMAND_BAR, { button: 'hold on' });
    abortPlaceholders();   // instant abort + no in-flight generation restart (options kept)
    // ⚠ THIS IS A PLACEHOLDER THE USER FIRES THEMSELVES, drawn from the same list the
    // app speaks from by itself and obeying the same no-repeat rule (Ken, comment 76).
    // It used to say one fixed phrase of its own, edited in a different place from the
    // automatic ones - two lists of holding phrases, maintained separately, saying the
    // same kind of thing. One list, edited on the Placeholders tab, is the whole point.
    //
    // Falls back to the old fixed phrase only if every pool has been emptied, because
    // the one outcome that is never acceptable is that the user pressed a button and
    // nothing was said.
    const text = placeholders.phraseOnDemand() || controlPhrases.getPhrases().holdOn;
    ui.setStatus('Speaking...');
    // ⚠ NOT RECORDED AS A TURN, and this follows from the phrase pool being shared
    // (Ken, August 27 2026). The ladder's own placeholders have never been written to
    // the conversation, so once "Hold on" started drawing from the SAME pool, logging
    // it meant the identical sentence appeared in the record when the user pressed a
    // button and vanished when the app said it by itself - a distinction the record
    // cannot support and nobody reading it back would want.
    //
    // What it buys, beyond consistency: a floor-holder carries no content, so keeping
    // it out of `conversationHistory` also keeps it out of the AI's context, where it
    // read as the user having already answered. "Say again" is unaffected either way -
    // it re-speaks the last utterance from the ENGINE, which this never set.
    //
    // Hence `announce: true`: with no transcript entry, the now-playing line is the
    // only place this speech is visible, and nothing the app says in the user's voice
    // may be invisible.
    await speakUserStatement(text, { announce: true });
    ui.setStatus(isListening ? 'Listening...' : 'Ready');
}

// "Ask them to repeat" (formerly "Pardon?") — the "I didn't catch what the partner
// said" control. The user shouldn't have to reason about sequence-stack mechanics,
// so this one action does what the misheard-partner case needs: it (1) asks the
// partner to repeat, and (2) pushes a repair sequence so the partner's re-speak
// resolves correctly against the original question. engine.pardon() dedups, so
// tapping it again before the re-speak doesn't stack a second repair.
//
// It does NOT throw away the partner's transcript (Ken, July 12 2026 — reverses the
// v0.5.32 "drop the last statement" behavior): what the partner already said is KEPT
// as its own committed turn. But their RE-SPEAK is a SEPARATE new turn AFTER our
// pardon statement — NOT appended to the earlier one (Ken, July 13 2026, refines the
// v0.5.87 "appends to it" behavior, which mis-merged two partner statements and put
// the re-speak before the pardon). The AI still sees everything as ordered turns.
async function handlePardon() {
    noteUserAction('command');
    metrics.event(metrics.EV.COMMAND_BAR, { button: 'ask them to repeat' });
    metrics.paletteAbandoned('pardon');
    placeholders.stop();
    generationToken++;            // invalidate any in-flight generation on the garbled capture
    const snap = engine.pardon(); // push REPAIR* (dedups); floor → partner
    // Show what the partner already said, then commit it (via logSpokenUserTurn) and
    // speak the pardon.
    const kept = heardPartnerText();
    currentPartnerText = kept;
    ui.showEngineState(snap);
    updatePartnerLive(kept);
    clearPalette();
    // One of the user's own "ask them to repeat" phrases, never the same one twice
    // running (Settings → Commands).
    const text = controlPhrases.pickPhrase('pardon');
    ui.setStatus('Speaking...');
    await speakUserStatement(text);
    logSpokenUserTurn(text);          // commits the partner's kept turn, then the pardon after it
    // Finalize the partner's kept turn and RESET capture so their re-speak becomes a
    // fresh turn after this pardon — not appended to the earlier one.
    finalizePendingPartnerTurn();
    stt.resetTranscript();
    currentPartnerText = '';
    currentPartnerUncertain = [];
    pendingPartnerHistoryIdx = -1;
    ui.setTranscriptState('idle');
    ui.setStatus(isListening ? 'Listening...' : 'Ready');
}

// "Show me different options" — the user finds the offered palette not quite
// right and wants a fresh set for the SAME partner turn. Re-runs generation with
// the rejected options passed as `avoid`, then refreshes ONLY the palette
// (engine.refreshPalette) — the sequence stack / mode / floor are unchanged, so
// we deliberately do NOT re-ingest the classification (that would push a
// duplicate FPP). Whole-palette regenerate (not per-response) — see CLAUDE.md to-do.
async function handleRegenerate() {
    noteUserAction('regenerate');
    metrics.event(metrics.EV.REGENERATE, { kind: currentStatic.kind || 'ai' });
    // If a predefined static palette is showing (openers / wind-downs / closings),
    // "New N" dips to the next page of that set rather than calling the AI (Ken,
    // July 2026). Only pages when more cards are defined than fit; otherwise no-op.
    if (currentStatic.kind) {
        // The pinned card (the decline-the-closing one) stays in its cell across the
        // page turn — but it moves on to the next wording, since "New N" is the ask
        // for different words and this card is otherwise stuck on one phrase.
        const pin = (currentStatic.pin || []).length ? declineClosingCard({ advance: true })
                                                     : [];
        renderStaticPalette(currentStatic.kind, currentStatic.full, null,
            { advance: true, pin });
        return;
    }
    if (!currentPartnerText || !lastPalette.length) return;
    const token = ++generationToken;
    placeholders.stop();
    ui.setPaletteBusy(true);   // the cards showing may be replaced — say so (Ken)
    ui.setStatus('Getting different options...');

    const prior = lastPalette.map((m) => m.text).filter(Boolean);
    llm.setWorldviewBlock(worldview.buildBlock());
    llm.setRelationshipsBlock(relationships.buildBlock());
    // Omit the place they are standing in — buildHereBlock already carries it, with
    // the framing that fits being present rather than the "places I go" framing.
    llm.setPlacesBlock(places.buildBlock(activePlace && activePlace.placeId));
    llm.setSituationBlock(buildSituationBlock());
    llm.setVoiceBlock(voiceBlockText());
    const history = [...conversationHistory, { role: 'partner', text: currentPartnerText }];

    try {
        // Carry this turn's steering through — otherwise "New N" silently discards
        // the choice the user tapped (or the guidance they typed) and comes back
        // with the unsteered palette.
        const result = await llm.generateResponses(history, engine.buildRequestContext(), {
            avoid: prior,
            perCategory: storage.loadResponsesPerCategory(),
            focusChoice: activeSteer.focusChoice || undefined,
            steer: activeSteer.steer || undefined,
        });
        if (token !== generationToken) return; // superseded
        const snap = engine.refreshPalette(result.responses);
        ui.showEngineState(snap);
        lastPalette = snap.palette;
        showPalette(snap.palette);
        ui.setStatus(activeSteer.focusChoice
            ? `More ways to say "${activeSteer.focusChoice}"`
            : 'Select a response');
    } catch (err) {
        if (token !== generationToken) return;
        storage.logError('regenerate', err.message);
        ui.showResponseError(`Couldn't get new options: ${err.message}`, handleRegenerate);
        ui.setStatus(`Error: ${err.message}`);
    }
}

// "Reframe" — the second verb on the "In your own words" composer (Ken, June 21
// 2026). Instead of speaking the box text verbatim (Speak), hand it to the AI as
// steering/context and regenerate the suggested responses around it for the SAME
// partner turn. A *guided* regenerate: same engine.refreshPalette seam as
// handleRegenerate (stack / mode / floor untouched — we do NOT re-ingest the
// classification, which would push a duplicate FPP). One-shot: the steer applies
// to this regeneration only and the box is CLEARED on success, so an empty box
// reliably means "nothing pending" (a lingering value would read as a persistent
// steer — that sticky/conversation-goal version is deferred to the Goals
// subsystem). Guarded to an active partner turn with a palette, like regenerate.
// Drop this turn's steering. Called wherever the partner turn being steered ends
// or is replaced, so a steer can never leak into the next turn's options.
function clearTurnSteering() {
    activeSteer = { focusChoice: null, steer: null };
}

// Set (or clear) the alternatives showing as Express Panel choice chips. Cheap
// no-op when nothing changed, since it re-renders the whole panel.
function setOfferedChoices(options) {
    const next = Array.isArray(options) ? options.filter(Boolean) : [];
    if (next.length === offeredChoices.length && next.every((o, i) => o === offeredChoices[i])) return;
    offeredChoices = next;
    renderExpressPanel();
}

// Set (or clear) the number the partner asked for. Same no-op-when-unchanged shape as
// the choices above, since it also re-renders the whole panel.
function setOfferedRange(range) {
    const same = (!range && !offeredRange)
        || (range && offeredRange && range.min === offeredRange.min && range.max === offeredRange.max);
    if (same) return;
    offeredRange = range || null;
    renderExpressPanel();
}

// The number button's label lives in conversation-logic.js so the whole path from a
// model response to the words on the button can be exercised in one test.

// The user tapped the number button: open "In my own words" with the keyboard already
// on its number page. Deliberately NOT automatic on the partner's question — the
// keyboard covers the panel, and most people answer a scale in words. The button is
// there for the user who wants to be exact.
function handleRangeChip() {
    composerForNumber = true;
    openComposer({ page: 'symbols' });
}

// The user tapped a choice chip: they've decided on one of the partner's
// alternatives and want the responses built around it. This is a guided
// regenerate — the SAME seam Reframe uses (refreshPalette leaves the sequence
// stack, mode and floor untouched, so no duplicate FPP), with the picked
// alternative as the steer. The chips stay up: a second thought is one tap away.
async function handleChoiceChip(chip) {
    noteUserAction('choice chip');
    metrics.event(metrics.EV.CHOICE_CHIP);
    const pick = chip && chip.label;
    if (!pick || !currentPartnerText) return;

    const token = ++generationToken;
    ui.setPaletteBusy(true);   // the cards showing may be replaced — say so (Ken)
    abortPlaceholders();   // the user has acted — nothing may speak over the result
    activeSteer.focusChoice = pick;   // "New N" must keep answering with this choice
    renderExpressPanel();             // ...and the chip shows as chosen from this moment
    llm.setWorldviewBlock(worldview.buildBlock());
    llm.setRelationshipsBlock(relationships.buildBlock());
    // Omit the place they are standing in — buildHereBlock already carries it, with
    // the framing that fits being present rather than the "places I go" framing.
    llm.setPlacesBlock(places.buildBlock(activePlace && activePlace.placeId));
    llm.setSituationBlock(buildSituationBlock());
    llm.setVoiceBlock(voiceBlockText());

    ui.setStatus(`Building responses around "${pick}"...`);
    const history = [...conversationHistory, { role: 'partner', text: currentPartnerText }];
    try {
        const result = await llm.generateResponses(history, engine.buildRequestContext(), {
            focusChoice: pick,
            perCategory: storage.loadResponsesPerCategory(),
        });
        if (token !== generationToken) return;   // superseded (newer turn, or another chip)
        const snap = engine.refreshPalette(result.responses);
        ui.showEngineState(snap);
        lastPalette = snap.palette;
        currentStatic = { kind: null, full: [] };  // AI responses — New N regenerates, not pages
        showPalette(snap.palette);
        ui.setStatus(`Ways to say "${pick}" — or tap another choice`);
    } catch (err) {
        if (token !== generationToken) return;
        storage.logError('choiceChip', err.message, { partner: (currentPartnerText || '').slice(0, 200) });
        ui.showResponseError(`Couldn't build responses for "${pick}": ${err.message}`, () => handleChoiceChip(chip));
        ui.setStatus(`Error: ${err.message}`);
    }
}

async function handleReframe() {
    noteUserAction('reframe');
    metrics.event(metrics.EV.REFRAME);
    keyboard.acceptPendingGhost(); // fold a showing word-prediction ghost into the text first
    const steer = ui.getComposerText();
    // Clicking any of the three buttons dismisses the modal (Ken). Capture the
    // steer first, then close.
    ui.clearComposer();
    closeComposer();
    // Reframe with an empty box is a cancel in all but name, so it behaves like one.
    if (!steer) { showHeldForComposer(); return; }

    /* ⚠ THE RACE, and it is decided by INTENT rather than by which answer arrives
     * last (Ken raised it, August 21 2026): the partner spoke again while the user was
     * typing, so a reprompt is in flight or already held, and now the user asks for a
     * reframe. Two answers are coming for the same turn.
     *
     * THE REFRAME WINS, always, and the reprompt is dropped. Three reasons:
     *   1. The user ASKED for it. A reframe is an explicit instruction about what they
     *      want to get across; a reprompt is the app refreshing on its own. Every other
     *      place in this app already resolves that the same way - a card tap, an
     *      Express phrase and opening the composer all supersede work in flight.
     *   2. NOTHING IS LOST BY DROPPING IT. Both are built from the same conversation
     *      history and the same `currentPartnerText`; the reframe adds the steer on
     *      top. So the reframe's context is a superset, never a different view - and
     *      if a newer checkpoint landed in between, the reframe is built on the newer
     *      text as well.
     *   3. ⚠ IF ARRIVAL ORDER DECIDED IT, a slow reframe could be silently overwritten
     *      by an automatic refresh landing after it. To the user that looks exactly
     *      like Reframe not working, and they would have no way to tell why. Deciding
     *      by intent makes the outcome the same however the timing falls.
     *
     * The in-flight case is already handled by the token bump below; this drops one
     * that had finished and was waiting for the cancel path. */
    dropHeldForComposer();

    // A steer is the user saying the suggestion was wrong and how. Recorded so a
    // correction they keep having to repeat can become a standing preference
    // (Sounds Like Me, Phase 2). Gated on the per-conversation privacy choice: "Don't
    // save this conversation" has to mean this too, or the one thing the user typed
    // outlives the conversation they asked not to keep.
    if (storage.isConversationSaving()) voiceProfile.recordSteer(steer);

    const token = ++generationToken;
    placeholders.stop();
    ui.setPaletteBusy(true);   // the cards showing may be replaced — say so (Ken)
    llm.setWorldviewBlock(worldview.buildBlock());
    llm.setRelationshipsBlock(relationships.buildBlock());
    // Omit the place they are standing in — buildHereBlock already carries it, with
    // the framing that fits being present rather than the "places I go" framing.
    llm.setPlacesBlock(places.buildBlock(activePlace && activePlace.placeId));
    llm.setSituationBlock(buildSituationBlock());
    llm.setVoiceBlock(voiceBlockText());

    // Two modes on the one button, chosen by whether a partner turn is on the floor:
    //  • Partner turn active → rework the SUGGESTED RESPONSES around the steer (a
    //    guided regenerate — reply to the partner, taking the input into account).
    //  • No partner turn (the user just responded / holds the floor) → the user
    //    wants to LEAD: generate STATEMENTS that take the conversation where they
    //    want to go (Ken), not replies to a partner.
    if (currentPartnerText && lastPalette.length) {
        ui.setStatus('Reworking options with your input...');
        // Remember it for this turn so "New N" reworks the options with the same
        // guidance instead of discarding it (Ken). Still one-shot ACROSS turns —
        // it dies with the partner turn, and the box is cleared either way.
        activeSteer.steer = steer;
        const history = [...conversationHistory, { role: 'partner', text: currentPartnerText }];
        try {
            const result = await llm.generateResponses(history, engine.buildRequestContext(), { steer, perCategory: storage.loadResponsesPerCategory() });
            if (token !== generationToken) return; // superseded
            const snap = engine.refreshPalette(result.responses);
            ui.showEngineState(snap);
            lastPalette = snap.palette;
            showPalette(snap.palette);
            ui.setStatus('Select a response');
        } catch (err) {
            if (token !== generationToken) return;
            storage.logError('reframe', err.message);
            ui.showResponseError(`Couldn't rework the options: ${err.message}`);
            ui.setStatus(`Error: ${err.message}`);
        }
        return;
    }

    // Lead mode: the user holds the floor and wants to steer.
    ui.setStatus('Finding statements to steer the conversation...');
    try {
        const result = await llm.generateStatements(steer, conversationHistory, engine.buildRequestContext(), conversationPaletteCap());
        if (token !== generationToken) return; // superseded
        const snap = engine.refreshPalette(result.responses);
        ui.showEngineState(snap);
        lastPalette = snap.palette;
        showConversationPalette(snap.palette, 'Pick a statement to steer things');
    } catch (err) {
        if (token !== generationToken) return;
        storage.logError('reframeLead', err.message);
        ui.showResponseError(`Couldn't get statements: ${err.message}`);
        ui.setStatus(`Error: ${err.message}`);
    }
}

// Wrap up — enter PRE-CLOSING and offer the WIND-DOWN statements (intent to end, not
// a goodbye). Selecting one auto-offers the closings.
//
// ⚠ IT IS A TOGGLE, AND THAT IS A SAFETY FIX RATHER THAN A CONVENIENCE (Ken, August 26
// 2026). Before this there was NO WAY BACK. The three exits were: speak a wind-down
// (which sabotages the conversation you were trying to stay in), End conversation
// (worse), or turn the microphone on and hope the other person says something — and in
// manual mode the mic is already off after you answered, so there may be nothing to
// hear. Ken: "If you accidently tap it (maybe you were trying tap a button on either
// side), it is impossible to cancel out of it." A stray tap on a keyguard-backed row of
// buttons is exactly the input this population produces, which is why the double-tap
// safeguard exists at all.
//
// The second press restores WHAT WAS ON SCREEN, not a recomputed guess — see
// shownCards, recorded at the single choke point every palette passes through.
//
// ⚠ PAGING MOVED TO "New N", which already pages a static palette. One button cannot
// both enter a mode and cycle it AND cancel it; the previous arrangement had the same
// press meaning "show me different goodbyes", so there was no press left over to mean
// "I did not mean to do this". Nothing is spoken by either press.
function handleWindDown() {
    noteUserAction('command');
    placeholders.stop();
    if (paletteOverlay && paletteOverlay.which === 'wrapUp') {
        metrics.event(metrics.EV.COMMAND_BAR, { button: 'wrap up cancel' });
        overlayCancel();
        return;
    }
    metrics.event(metrics.EV.COMMAND_BAR, { button: 'wrap up' });
    // ⚠ WHAT CANCELLING CANNOT UNDO, stated so it is not mistaken for a bug: this
    // invalidates any generation still in flight, so if the other person had spoken and
    // suggestions were on their way, cancelling restores the cards that WERE showing
    // rather than the ones that would have arrived. Restoring what the user was looking
    // at is the promise; resurrecting an abandoned request is not.
    generationToken++;
    overlayEnter('wrapUp');
    const snap = engine.windDown();
    ui.showEngineState(snap);
    renderStaticPalette('windDown', snap.palette, 'Signal you\'d like to wrap up');
    windDownShown = true;
}

// End conversation — hard terminate (Ken, June 18 2026). Tears everything down
// and returns the engine to STANDBY: stop the placeholder ladder, cancel any speech,
// stop listening, invalidate in-flight generation, commit the partner's pending
// (uncommitted) turn to the log if they spoke without a reply (Ken, July 12 2026),
// clear the palette/transcript, and reset the engine (empty stack, floor OPEN). No
// danger-confirm — it's the "hang up" control, and the conversation history is
// already logged exchange-by-exchange.
async function handleEndConversation() {
    const wasPractice = practiceMode;
    // Exit Practice Mode BEFORE teardown so the paths (resumeOrIdle, stamps) revert
    // to real-conversation behavior.
    practiceMode = false;
    practiceScenario = null;
    // The session is over, so the tour is too — this is the ONLY place it is cleared
    // (see the note in terminateConversation for why it cannot be done there).
    tour = null;
    ui.setCoachLine(null);
    applyListenAvailability();   // back to a real conversation — Listen follows capture again
    await terminateConversation();
    // Ending a conversation clears the situation influencers — the next person /
    // mood shouldn't inherit this conversation's Partner & Feeling selections.
    // (Done here, NOT in the shared terminateConversation, because Start
    // conversation reuses that and still needs the active Partner to personalize
    // its openers.)
    clearInfluencers();
    if (wasPractice) {
        // Practice is entered from Settings → Practice, so leaving it drops straight
        // back to the standard conversation screen (Ken, July 2026) — the mic-backed
        // conversation is ready to go, no start screen in between.
        ui.setStatus('Practice ended — back to a normal conversation');
        // The tour's last step IS this button, so its closing message can only be
        // said now: everything above has just cancelled speech and cleared the coach
        // line, which would have destroyed it had it been said at press time.
        if (tourFinishPending) announceTourFinished();
    } else {
        ui.setStatus('Conversation ended — tap Start conversation or Listen to begin again');
    }
}

// Clear the active Partner / Feeling toggles and refresh the panel so their
// selected rings drop.
//
// PLACE DELIBERATELY PERSISTS across End conversation (Ken, August 3 2026) — the
// v0.5.31 rule the other two follow does NOT extend to it, because the thing that
// rule is about does not apply. Partner and Feeling are properties OF the
// conversation: it ends, and the next person and mood are genuinely unknown. Where
// you are is a property of the ROOM, and ending a conversation does not move you —
// a café visit or a clinic waiting room is several conversations in one place, and
// clearing it would charge a re-tap for every one of them. Cleared only by tapping
// the place again, or by tapping a different one.
function clearInfluencers() {
    activePartner = null;
    activeFeeling = null;
    renderExpressPanel();
    // Drop the cleared partner's own starters and closings back out of the engine,
    // or the next conversation opens with the last person's phrases still on page 1.
    applyControlPhrases();
}

// The user is TAKING THE FLOOR with their own words — shared by the composer's
// Speak and by an Express Panel phrase. It behaves like selecting a response: terminates
// the partner's open turn (engine.selectResponse pops the partner FPP), stops
// recording, commits the exchange to history, and resumes listening iff
// auto-resume is armed. `historyText` is what's logged/displayed; `spokenText`
// is what TTS says (an Express Panel phrase may carry a distinct pronunciation form).
async function speakAsUserTurn(historyText, spokenText = historyText, source = 'composed') {
    // Saying it their own way ends the deliberation just as a card tap does, and this
    // is the case worth catching: cards were on offer and the user went elsewhere.
    // Recorded as abandonment WITH its reading time, which is the pair that separates
    // "the suggestions missed" from "they had their own thing to say".
    noteUserAction(source === 'express' ? 'express' : 'composer');
    metrics.paletteAbandoned(source === 'express' ? 'express phrase' : 'own words');
    metrics.event(source === 'express' ? metrics.EV.EXPRESS_PHRASE : metrics.EV.COMPOSER_SPOKEN);
    placeholders.stop();
    generationToken++;            // invalidate any in-flight generation on the partner turn
    ui.setPaletteBusy(false);     // ...and stop saying the cards may change (Ken)
    // Does this statement OPEN the conversation? Captured BEFORE commitExchange
    // appends to the history below. Deliberately not storage.getConversationId(),
    // which stays null for the whole of a "Don't save this conversation" session and
    // would report every turn as an opening one.
    const opensConversation = conversationHistory.length === 0;
    // Capture the partner's speech BEFORE stopping the mic, so interrupting them
    // mid-utterance (an instant Express phrase / composed statement) still records
    // what they'd said up to the interruption (Ken).
    const raw = heardPartnerText();
    stt.stopListening();
    currentPartnerText = '';
    currentPartnerUncertain = [];

    ui.setStatus('Speaking...');
    clearPalette();               // any AI palette shown is now stale
    await speakUserStatement(spokenText);

    // Append to the transcript AFTER speaking (Ken); now-playing stays suppressed
    // during the speech, so there's no pre-text preview.
    engine.selectResponse({ text: historyText });
    ui.showEngineState(engine.getSnapshot());
    // Interruption: the partner's heard text is recorded verbatim, like every turn.
    await commitExchange(raw, historyText, -1, { spokenText });

    // The user has spoken and a reply is coming, so the mic has to be open to catch
    // it. Opening a conversation this way is the same act as selecting an opener, so
    // it arms the session exactly as that path does — see
    // conversation-logic.captureAfterUserSpeaks. (Ken, August 7 2026.)
    if (opensConversation) {
        manualListenArmed = true;
        metrics.conversationStarted({ practice: practiceMode });
    }
    const capture = convLogic.captureAfterUserSpeaks({
        opensConversation,
        armed: manualListenArmed,
        autoResume: storage.loadAutoRelisten(),
    });
    // Practice Mode has no mic — "capturing" there means cueing the AI partner, and
    // practiceResumeOrIdle already gates that on the same setting, so route through
    // resumeOrIdle rather than calling startFreshListening (which would open a real
    // mic in a practice session).
    if (capture && !practiceMode) startFreshListening();
    else resumeOrIdle();
}

// --- "In my own words" modal (Rule 8) ---

// Open the modal: show the input box overlay over the reserved response
// footprint (base UI not blurred) and bring up the keyboard in the dock region.
function openComposer(opts = {}) {
    // Opening the box stops the clock even if nothing is ever said from it — the user
    // has finished reading and decided against the cards at this moment, not at the
    // moment they finish typing, which can be a minute later.
    noteUserAction('composer');
    metrics.event(metrics.EV.COMPOSER_OPENED);
    // ⚠ THE REQUEST IS NO LONGER ABANDONED HERE (Ken, August 21 2026). It used to be
    // (`generationToken++`), which fixed the two things that actually go wrong — a
    // new set landing under the box, and a placeholder speaking while the user is
    // mid-sentence — by throwing the work away. On a cancel that left them looking
    // at cards older than what the partner had by then said, with the better set
    // paid for and gone.
    //
    // So the two problems are now solved directly: the render WAITS (composerOpen,
    // read in generateOptions), and the placeholder ladder is silenced through its
    // own mechanism rather than as a side effect of cancelling the generation.
    composerOpen = true;
    // ⚠ THE LADDER IS DELIBERATELY LEFT RUNNING (Ken, August 25 2026). abortPlaceholders()
    // was called here, which killed it outright the moment the box opened — and opening
    // the box is not an act of speaking or deciding, it is the user still choosing. The
    // three other callers of abortPlaceholders are Say again, Hold on and a choice chip,
    // every one of which is the user having ACTED; this one was the odd one out. Reading
    // the cards holds the floor with a phrase, and so does typing.
    ui.setPaletteBusy(false);
    ui.clearComposer();
    ui.showComposerOverlay();
    // Summon the keyboard explicitly rather than relying on the textarea's
    // focusin side effect — that event can be swallowed (e.g. after an Express
    // phrase auto-resumes listening, or when the field already holds focus), so
    // the composer could open with no keyboard. showFor() is a no-op in physical
    // mode. (Ken, July 2026.)
    keyboard.showFor(document.getElementById('composerInput'), { page: opts.page });
    // Answering a number question: Enter speaks it, because a line break inside a
    // one-line answer means nothing and the Enter key is right beside the digits.
    // Scoped to this one surface and cleared in closeComposer.
    keyboard.setEnterAction(composerForNumber ? handleSpeakComposed : null);
    ui.setStatus(composerForNumber ? 'Type the number, then Enter' : 'Type your own words');
}

// Close the modal (Speak / Reframe / Cancel all do this): dismiss the input box
// AND the keyboard. The keyboard is dismissed explicitly — blurring the textarea
// alone won't reliably hide it, because Speak/Reframe/Cancel are "keep-open"
// controls (so their tap doesn't trip the focusout-hide before the handler runs).
function closeComposer() {
    composerOpen = false;
    composerForNumber = false;
    keyboard.setEnterAction(null);   // never leave Enter claimed past this surface
    ui.hideComposerOverlay();
    keyboard.hideKeyboard();
}

// Speak: say the composed text, take the floor + commit, then dismiss the modal.
async function handleSpeakComposed() {
    keyboard.acceptPendingGhost(); // fold a showing word-prediction ghost into the text first
    const text = ui.getComposerText();
    if (!text) { closeComposer(); return; }
    ui.clearComposer();
    closeComposer();
    // Speaking ends the turn, so anything a reprompt produced while they typed is
    // about to be irrelevant (Ken).
    dropHeldForComposer();
    await speakAsUserTurn(text);
}

/* A Command Bar button was pressed while "In my own words" was open (Ken, August 27
 * 2026). The box is dismissed exactly as Cancel dismisses it - nothing typed is
 * spoken, nothing is reframed - and the cards that were on the Response Panel come
 * back; then the button gets on with its own job.
 *
 * ⚠ THE BUTTON STILL RUNS. Swallowing the press would make every one of these a dead
 * tap that has to be made twice, which for Settings and End conversation means the
 * control appears broken at the moment it is most wanted. What "no action" rules out
 * is the COMPOSER acting, not the button.
 *
 * ⚠ RESTORE FIRST, THEN ACT, and the order is load-bearing rather than tidy: Wrap up
 * and Start conversation photograph whatever is on the Response Panel so their cancel
 * can put it back, so a set held during composition has to be showing before they
 * look. Dismissing afterwards would photograph the composer's empty footprint and the
 * backout would return to nothing.
 *
 * TWO BUTTONS ARE EXEMPT and are wired straight through: "Hold on" speaks a
 * floor-holding phrase - the very thing you want while you are still typing - and
 * "Don't save this conversation" is a toggle that touches neither the floor nor the
 * cards. Both leave the box open with the typing intact.
 */
function whileComposerClosed(handler) {
    return (...args) => {
        if (composerOpen) handleCancelComposed();
        return handler(...args);
    };
}

// Cancel: discard the box and dismiss the modal (no speech).
function handleCancelComposed() {
    // Opened and then thought better of it. Worth its own count: a composer opened
    // and abandoned is a user who could not say what they meant either way.
    metrics.event(metrics.EV.COMPOSER_CANCELLED);
    ui.clearComposer();
    closeComposer();
    // Nothing was said and the partner's turn is still live, so if the partner spoke
    // again while they were typing, those are the cards that belong on screen now.
    showHeldForComposer();
}

// --- Express Panel (base UI quick-speak + influencers, Rule 9) ---

// The Express Panel mirrors the SELECTED keyboard layout (so one keyguard
// overlays both): grab the layout rows for whichever dock is chosen and hand
// them to the renderer along with the item list. Re-called when the items, tap
// settings, dock, or layout changes.
function expressLayoutRows() {
    const dock = storage.loadKeyboardDock();
    const id = dock === 'side' ? storage.loadSideLayout() : storage.loadBottomLayout();
    return (LAYOUTS[id] && LAYOUTS[id].rows) || [];
}

// (conversationInProgress() lived here. It gated tap-to-define on whether a
// conversation was under way — the August 7 2026 rule — and became dead when Ken
// moved editing into Settings entirely on August 15 2026. Recover it from git if a
// future feature needs "is a conversation open"; it read practiceMode || isListening
// || a user statement mid-speech || a committed turn || a partner turn in flight ||
// a live or static palette, all of which terminateConversation() clears.)

// True while the panel is hosted inside the open Settings dialog (Express tab).
let expressPanelInSettings = false;

// Move the panel into, or back out of, the open Settings dialog. On the Express
// tab the user is looking straight at the panel they are editing, so it must be
// tappable; everywhere else it goes back to the dock.
function hostExpressPanel(inSettings) {
    expressPanelInSettings = !!inSettings;
    ui.setExpressPanelHost(inSettings ? document.getElementById('settingsDialog') : null);
    // The single choke point for "the panel is no longer being edited": every path
    // that leaves the Express tab or closes Settings comes through here with false,
    // which is exactly the two clearing conditions Ken asked for. Clearing at the
    // individual close sites would have meant finding all six of them, and missing
    // one would strand a highlight on a cell nobody is editing.
    if (!inSettings) expressEditor.clearPicked();
    // Re-render even when there was no pick to clear: the cells' tap behaviour
    // differs between the two hosts (a tap here edits, in the dock it speaks), and
    // that is decided when the handler is bound. Without this the panel keeps the
    // handlers it was last drawn with, so a double-tap user arriving on the Express
    // tab still has to double-tap to select a phrase.
    renderExpressPanel();
}

/**
 * The user tapped an undefined cell IN SETTINGS: open the editor on THAT cell.
 *
 * Ken's reason for tap-to-define is that it makes position and content one
 * operation instead of two — the button is created where it will live, rather than
 * typed into a list and then walked up the order with the ↑ button. So the index of
 * the tapped cell is the whole point, and holding it open is what the 'empty' item
 * type exists for (see express-items.js): every cell before the tapped one gets an
 * empty placeholder, so the new button lands in the cell that was actually tapped.
 *
 * ONLY IN SETTINGS (Ken, August 15 2026). This SUPERSEDES the August 7 2026 rule,
 * which allowed it from the dock between conversations and blocked it only while a
 * conversation was under way. The conversation screen is the surface a non-speaking
 * user drives a live conversation from, a filled cell SPEAKS on tap, and this
 * population taps imprecisely — so a neighbouring cell that instead throws open a
 * full-screen editor is the wrong thing to have there at all, not merely at the
 * wrong moment. "You edit your buttons in Settings" is also a simpler thing to learn
 * than a rule about when the same tap does something different.
 */
function handleDefineCell(index) {
    // Belt and braces: outside Settings the cell is rendered with no handler at all,
    // so this cannot normally be reached.
    if (!expressPanelInSettings) return;

    // Which band owns this cell decides what defining it means, so the editor opens
    // on the right list rather than always on the phrases.
    const composed = composedPanel();
    const band = composed.bands[index];
    if (!band) return;

    const dialog = document.getElementById('settingsDialog');
    if (!dialog.open) openSettings();
    const tab = document.querySelector('#settingsTabs .settings-tab[data-tab="express"]');
    if (tab) activateSettingsTab(tab, false);   // renders the editor and hosts the panel
    expressEditor.addToBand(band);
}

// A tap on a DEFINED button while the panel is live in Settings edits it rather
// than acting on it. Speaking from the Settings panel would be audible to anyone in
// the room and is not a conversational turn; toggling a partner or place from an
// editing surface would change conversation state the user cannot see. Editing is
// what they are there for, and it is the half of "edit in place" that makes the
// panel a view of itself. Returns true when it handled the tap.
function editedInSettings(item) {
    if (!expressPanelInSettings) return false;
    expressEditor.focusItem(item && item.id);
    return true;
}

/**
 * Lay the user's three bands out over the cells of the chosen keyboard layout.
 *
 * The renderer still receives ONE ordered list — bands change what goes in a cell,
 * never where the cells are — plus a parallel list saying which band each cell is in,
 * which is all it needs to pick the background. The grid is untouched, so a keyguard
 * cut for this layout still fits whatever the band sizes are.
 */
/**
 * What to CALL the person a partner button stands for.
 *
 * Answered from About Me every time rather than from a copy kept on the button, so a
 * name changed there is right everywhere at once (Ken, August 25 2026 - he removed the
 * second box that used to ask for it here). The stored `name` is the fallback for a
 * button whose person is not in the graph: an old free-typed one, or somebody since
 * removed, where a blank button would be worse than a stale word.
 */
function partnerLabel(item) {
    if (!item) return '';
    return relationships.displayName(item.personId, item.nickname || item.name);
}

function composedPanel() {
    const composed = expressBands.composePanel(expressLayoutRows(), expressPanel.getModel(), {
        partnerId: activePartner ? (activePartner.personId || activePartner.id) : null,
        placeId: activePlace ? (activePlace.placeId || activePlace.id) : null,
    });
    // Resolve each partner button's face HERE, on the way to the renderer, because the
    // renderer is deliberately ignorant of the relationship graph and must stay so.
    // This is also what carries the answer to the toggle handler, since the item the
    // user taps is one of these.
    composed.items = composed.items.map((item) => (item && item.type === 'partner'
        ? { ...item, label: partnerLabel(item) }
        : item));
    return composed;
}

function rowsMode() {
    return expressPanel.getModel().sizes.shape === expressBands.SHAPE.ROWS;
}

/**
 * Put the band numbers back on screen and say what they came out as. The number the
 * user types is a request; what the panel can actually give them depends on the grid,
 * so the status line reports the answer rather than leaving them to count buttons.
 */
function reflectBandSizes() {
    const sizes = expressPanel.getModel().sizes;
    const rows = rowsMode();
    const ctxIn = document.getElementById('bandContextInput');
    const flexIn = document.getElementById('bandFlexInput');
    const shapeSel = document.getElementById('bandShapeSelect');
    const markSel = document.getElementById('contextMarkSelect');
    if (!ctxIn || !flexIn || !shapeSel || !markSel) return;
    ctxIn.value = rows ? sizes.contextRows : sizes.context;
    ctxIn.min = rows ? 1 : expressBands.CONTEXT_FLOOR;
    flexIn.value = rows ? sizes.flexRows : sizes.flex;
    shapeSel.value = sizes.shape;
    markSel.value = storage.loadContextMark();
    const composed = composedPanel();
    const unit = rows ? 'rows' : 'buttons';
    const bits = [
        `Always ${composed.counts.always}, Context ${composed.counts.context}, Flex ${composed.counts.flex} buttons (set in ${unit}).`,
    ];
    if (composed.unreachable.always) {
        bits.push(`${composed.unreachable.always} Always phrase(s) have nowhere to go and are not showing.`);
    }
    if (composed.unreachable.context) {
        bits.push(`${composed.unreachable.context} Context button(s) do not fit.`);
    }
    if (composed.fromAlwaysSurplus) {
        bits.push(`${composed.fromAlwaysSurplus} Always phrase(s) are filling spare room at the end of the Flex band.`);
    }
    const status = document.getElementById('bandSizeStatus');
    if (status) status.textContent = bits.join(' ');
}

function renderExpressPanel() {
    applyButtonSizing();   // the active layout may have changed → refresh --kbd-rows/--kbd-cols
    const composed = composedPanel();
    ui.renderExpressPanel(expressLayoutRows(), composed.items, {
        // One background color per band, so which band a button is in is readable at a
        // glance without reading the button (Ken, August 22 2026). This replaces the
        // per-phrase color the user used to pick: color now carries a meaning.
        bands: composed.bands,
        choiceSlots: composed.choiceSlots,
        categories: expressItems.CATEGORIES,
        influencerColors: expressItems.INFLUENCER_COLORS,
        // The alternatives the partner just offered. They take the LAST cells of the
        // panel while the closed set is on the table (Ken, August 22 2026) — see
        // chipStartIndex. Nothing is reserved for them: at rest those cells hold
        // whatever they normally hold, and the chips cover them for one turn.
        // Gated on the partner's turn still being open: a chip steers a response TO
        // that turn, so once it's consumed the chips must not linger. Belt and
        // braces with the explicit clears at each turn boundary — any path that
        // ends a turn without clearing still can't leave a dead chip on screen.
        // Capped so a long list can't push most of the phrase panel off the end.
        choiceChips: (currentPartnerText
            ? offeredChoices.slice(0, storage.loadChoiceChipMax()).map((label) => ({ label }))
                // The number button rides the same mechanism and the same promise —
                // it does not speak. Only ever one, and never alongside choices,
                // because the model is told to set one or the other, not both.
                .concat(offeredRange ? [{ label: convLogic.rangeLabel(offeredRange), range: true }] : [])
            : []),
        choiceColor: expressItems.CHOICE_COLOR,
        onChoiceChip: (chip) => (chip && chip.range ? handleRangeChip() : handleChoiceChip(chip)),
        // Derived at render time from the live steering, so the selected chip is
        // correct on every path — the chip tap, a "New N" that re-sends it, and the
        // turn boundaries where clearTurnSteering drops it.
        activeChoice: activeSteer.focusChoice,
        activePartnerId: activePartner ? activePartner.id : null,
        activeFeelingId: activeFeeling ? activeFeeling.id : null,
        activePlaceId: activePlace ? activePlace.id : null,
        // The double-tap safeguard guards SPEAKING: it exists so a stray touch cannot
        // say something aloud that cannot be taken back. In Settings a tap does not
        // speak — it selects the button for editing — so the safeguard is protecting
        // against nothing there while blocking the one thing the user came to do.
        // Found in the field (an SLP on a MacBook, August 15 2026): phrase buttons
        // appeared dead in Settings while feeling buttons worked, because the feeling
        // / partner / place toggles have always been single-tap and only phrases honor
        // this setting. The user's own choice is untouched on the conversation screen.
        tapMode: expressPanelInSettings ? 'single' : storage.loadExpressTapMode(),
        doubleTapMs: storage.loadDoubleTapMs(),
        onSpeak: handleSpeakExpressItem,
        onTogglePartner: handleTogglePartner,
        onToggleFeeling: handleToggleFeeling,
        onTogglePlace: handleTogglePlace,
        onInMyOwnWords: openComposer,
        // Wired only in Settings, which is the only place buttons are edited (Ken).
        // Safe to decide at render time now that hostExpressPanel always re-renders:
        // the panel cannot change host without this being re-evaluated.
        onDefineCell: expressPanelInSettings ? handleDefineCell : null,
        // Only meaningful while the panel is hosted in Settings; elsewhere the editor
        // has cleared it, so this is null and no cell is marked.
        pickedId: expressEditor.getPickedId(),
        // How the three kinds of Context button are told apart inside their shared
        // background. Four candidates ship as a setting because there is no best
        // answer - only the person looking at the panel every day can settle it.
        contextMark: storage.loadContextMark(),
    });
}

// Build the per-turn SITUATION text for generation from the active influencers:
// who the user is talking with (Partner) and how they feel (Feeling). Empty when
// neither is active. The relationships block + nickname rule handle a Partner who
// is also a known person; this just adds "you're talking with them right now".
/**
 * How the user SOUNDS, for the system prompt (Sounds Like Me, Phase 0).
 *
 * Composed here rather than inside voice.js because half of it comes from the
 * Express Panel, and ONLY the items the user actually wrote may be used: seeding it
 * from our shipped defaults would tell the model that this person's characteristic
 * vocabulary is "Yes", "No" and "Thank you". That is what the provenance field on
 * each item is for — see express-items.js.
 */
function voiceBlockText() {
    const idiom = expressPanel.userAuthoredItems()
        .filter((it) => it.type === 'phrase' && it.text)
        .map((it) => it.text);
    return voiceProfile.buildBlock(idiom);
}

function buildSituationBlock() {
    const lines = [];
    // Practice Mode: the response-generation call goes through the normal path and
    // otherwise has NO idea it's a role-play — so ground it in the scenario, or it
    // suggests responses that don't fit the setting (e.g. root beer at a coffee
    // shop). The partner-authoring call already gets the full persona; this grounds
    // the USER's suggested responses to the same setting.
    if (practiceMode && practiceScenario) {
        lines.push(`This is a PRACTICE role-play. The situation is: ${practiceScenario.title} (${practiceScenario.register}). Keep every suggested response realistic and appropriate to THIS setting — only refer to things that would actually make sense here.`);
    }
    // WHO the user is talking to — the stand-in for the Phase-2 face/voice
    // recognition we do not have yet. Like the place button this is situational
    // awareness, NOT framing: it names the person being spoken TO, and must not be
    // read as "the user wants to talk about this person" (that is what Reframe is
    // for). Ken, August 5 2026.
    if (activePartner) {
        const label = partnerLabel(activePartner);
        if (label) lines.push(`You are currently talking with ${label} — ${label} is the person being spoken TO, not a topic to raise. When you address or refer to them, use "${label}".`);
        // How the user speaks WITH this particular person (Phase 3). Only for a
        // partner who is a real node in the graph — a free-typed Express Panel
        // partner has no edge to carry a profile — and only when they have one, so
        // an unedited person adds nothing.
        if (activePartner.personId) {
            const how = relationships.buildPartnerBlock(activePartner.personId, label);
            if (how) lines.push(how);
        }
    }
    if (activeFeeling && activeFeeling.text) {
        lines.push(`The user is currently feeling ${activeFeeling.text.toLowerCase()}. Let this color the tone of the suggested responses, while keeping them authentic to the user.`);
    }
    // WHERE the user is — the GPS-free situational-awareness signal (Ken, August 3
    // 2026). Resolved from the places model by id so the facts are always current;
    // an item whose place has since been deleted falls back to naming the place, so
    // the setting is still conveyed even when the details are gone.
    if (activePlace) {
        const here = activePlace.placeId ? places.buildHereBlock(activePlace.placeId) : '';
        if (here) lines.push(here);
        else if (activePlace.name) lines.push(`The user is at ${activePlace.name} right now. Keep the suggested responses appropriate to being there.`);
    }
    return lines.join(' ');
}

// Situation STAMP for the conversation log (distinct from the generation block
// above): a compact snapshot of the active influencers at the moment of a turn,
// written onto every logged turn for Phase-3 review. `partner` keeps the stable
// personId (when the Partner is a known person) so the log can join back to the
// relationship graph, plus the display label; `feeling` keeps id + text. Each is
// null when its toggle is off.
function partnerStamp() {
    // In Practice Mode the "partner" is the AI playing a scenario — flag every turn
    // so the saved conversation is reviewable but clearly distinguishable from a real
    // one (Ken: saved, flagged as practice).
    if (practiceMode && practiceScenario) {
        return { id: null, label: `Practice: ${practiceScenario.title}` };
    }
    if (!activePartner) return null;
    return {
        id: activePartner.personId || null,
        label: partnerLabel(activePartner),
    };
}
function feelingStamp() {
    if (!activeFeeling || !activeFeeling.text) return null;
    return { id: activeFeeling.id || null, text: activeFeeling.text };
}
// Where the turn happened. Keeps the stable placeId (when the Express item points at
// a recorded place) so a reviewed conversation can join back to My Places, plus the
// display label for the case where the place has since been deleted.
function placeStamp() {
    if (!activePlace) return null;
    const label = (activePlace.name || '').trim();
    if (!label && !activePlace.placeId) return null;
    return { id: activePlace.placeId || null, label };
}

// Partner toggle: one active at a time. Tapping the active one turns it off;
// tapping another switches. Re-renders the panel to reflect the selection. The
// effect is applied at conversation open (personalized openers) and each turn
// (situation block) — no immediate generation needed here.
function handleTogglePartner(item) {
    if (editedInSettings(item)) return;
    activePartner = (activePartner && activePartner.id === item.id) ? null : item;
    renderExpressPanel();
    // Re-merge their own starters and closings into the engine's static palettes.
    // Switching partner has to re-run this in both directions — selecting one adds
    // their phrases, clearing one has to take them back out again.
    applyControlPhrases();
    ui.setStatus(activePartner ? `Talking with ${partnerLabel(activePartner)}` : 'Partner cleared');
}

// Feeling toggle: one active at a time, same on/off/switch behavior.
function handleToggleFeeling(item) {
    if (editedInSettings(item)) return;
    activeFeeling = (activeFeeling && activeFeeling.id === item.id) ? null : item;
    renderExpressPanel();
    ui.setStatus(activeFeeling ? `Feeling ${activeFeeling.text.toLowerCase()}` : 'Feeling cleared');
}

// Place toggle: one active at a time, same on/off/switch behavior. Like Partner,
// the effect is applied at the next generation (situation block) — no round-trip is
// fired here, so tapping where you are never costs a token or interrupts a turn.
function handleTogglePlace(item) {
    if (editedInSettings(item)) return;
    activePlace = (activePlace && activePlace.id === item.id) ? null : item;
    renderExpressPanel();
    ui.setStatus(activePlace ? `At ${activePlace.name}` : 'Place cleared');
}

// Body classes that place the dock area (Express Panel / keyboard) on the
// chosen edge with the keyboard's real-estate, and select the 2×2 (side) vs 1×4
// (bottom) response-card arrangement. Kept in sync with the keyboard dock choice.
function applyConversationDockClasses() {
    const dock = storage.loadKeyboardDock();
    const side = dock === 'side';
    const right = storage.loadSideDockPosition() === 'right';
    document.body.classList.toggle('conv-bottom', !side);
    document.body.classList.toggle('conv-side', side);
    document.body.classList.toggle('conv-side-right', side && right);
    document.body.classList.toggle('conv-side-left', side && !right);
}

// --- Conversation layout solver (Ken, June 30 2026) -------------------------
// Three unitless sliders drive the conversation layout: BUTTON SIZE (default
// middle — slide right to GROW buttons in their unconstrained direction, left
// to SHRINK them and fill with gap), GAP SIZE, and MINIMUM GAP (a hard floor on
// the gap; precedence over button size). The % budget (v0.5.46/0.5.48) is the
// slider's MIDDLE; growth/shrink perturb it. This is past CSS clamp(), so JS
// computes the region sizes + effective gap into CSS vars on init/resize/change.
// FIRST CUT scope (Ken): the SIDE dock (the bottom dock still uses the fixed %
// default; its solver is the next step). Under-specified bits (freed-space
// split, exact shrink curve, calibration of the slider's right end to the true
// max-growth point) are reasonable choices here, to react to.
const GAP_MAX_REM = 1.4, MINGAP_MAX_REM = 1.4;   // slider 0–100 → 0..max rem
const DOCKSEP_MAX_REM = 4.0;      // keyboard-separation slider 0–100 → 0..4rem
// Screen-edge-margin slider 0–100 → 0..3rem. Smaller ceiling than the others on
// purpose: this one is subtracted from BOTH sides of BOTH axes, so at 3rem it
// already costs ~6rem of width and height, and it exists to clear a case lip —
// a few millimetres of plastic — not to reframe the layout.
const APP_MARGIN_MAX_REM = 3.0;
const TRANSCRIPTSEP_MAX_REM = 4.0; // transcript-separation slider 0–100 → 0..4rem
const MIN_BTN_REM = 2.0;          // smallest still-recognizable button (icon + border)
const MIN_TRANSCRIPT_REM = 3.0;   // transcript floor (~2 lines)
const SHRINK_GAP_REM = 1.4;       // how much gap a full left-shrink adds

const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const lerp = (pos, lo, hi) => lo + (Math.max(0, Math.min(100, pos)) / 100) * (hi - lo);

// THE LAYOUT VIEWPORT, never window.innerWidth/innerHeight (Ken, July 31 2026).
// The regions are sized as a fraction of the screen, so they must be measured
// against the screen — and on Safari (iPad included) window.innerWidth/Height
// report the VISUAL viewport, which shrinks when the page is pinch-zoomed. The
// solver bakes its result into --conv-dock-w as a px value, so one run while
// zoomed permanently shrinks the dock: it only recomputes on resize or a settings
// change, so un-zooming does not put it back and the layout stays wrong until the
// app is restarted. That is the "Express Panel kept shrinking while I worked in
// Settings" report. documentElement.clientWidth/Height is the layout viewport and
// is unaffected by zoom; where there is no zoom the two agree exactly, so this is
// a no-op on desktop.
const layoutVW = () => document.documentElement.clientWidth || window.innerWidth;
const layoutVH = () => document.documentElement.clientHeight || window.innerHeight;

// How far the page is pinch-zoomed. 1 = not zoomed. Anything else means the
// on-screen geometry no longer matches what getBoundingClientRect reports, which
// matters for the keyguard measurements. Absent API → assume 1 and do not block.
const zoomScale = () => (window.visualViewport && window.visualViewport.scale) || 1;

// Block pinch-to-zoom (Ken, July 31 2026: "pinch/zoom should be disabled for this
// app"). The viewport meta CANNOT do this on iOS — Safari has ignored
// user-scalable=no since iOS 10 on accessibility grounds — so the only mechanism
// that works there is preventDefault on Safari's own non-standard gesture events.
// They do not exist in Chrome/Edge, where the meta tag is honoured instead, so
// this listens for both and each platform is covered by the half that applies.
// Double-tap zoom is handled separately by `touch-action: manipulation` in CSS.
//
// Why the app refuses a gesture the user made deliberately: the keyguard's holes
// are cut in plastic and cannot zoom with the screen, so any zoom puts every
// control out from under its hole. Text and button sizes are user settings here,
// which serves the same need without breaking the overlay.
function blockZoomGestures() {
    // Safari: pinch. Passive listeners cannot preventDefault, so say so explicitly
    // — these are exactly the events browsers default to passive.
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
        document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
    }
    // Chromium on a touchscreen (a Surface is one too): two-finger pinch arrives as
    // a multi-touch touchmove. Single-touch is untouched, so scrolling and every
    // button still behave normally.
    document.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length > 1) e.preventDefault();
    }, { passive: false });
}

// How many panel buttons the active layout has room for is now asked of
// express-bands.positionPlan, which needs it for the band arithmetic anyway. The old
// expressCellCount() wrapper had no callers left once the editor stopped mapping one
// flat list onto the cells, so it is gone rather than left to rot.

function activeLayoutGrid() {
    const rows = expressLayoutRows();
    const r = rows.length || 1;
    let c = 1;
    for (const row of rows) {
        const span = row.reduce((sum, cell) => sum + (cell.span || 1), 0);
        if (span > c) c = span;
    }
    return { rows: r, cols: c };
}

// Compute the conversation layout from the three sliders and write CSS vars.
function applyButtonSizing() {
    const root = document.documentElement.style;
    const rem = remPx();

    // Screen edge margin: how far the whole app is held off the physical screen
    // edges so a keyguard has material to sit on inside a tight case opening
    // (Ken, Aug 2 2026). EVERY region below is then budgeted against the REDUCED
    // viewport — that is the load-bearing part. The dock's extent comes from these
    // numbers, so computing it from the full viewport and merely insetting it in
    // CSS would push it back over the margin instead of shrinking it into the
    // space that is left.
    const appMargin = lerp(storage.loadAppMarginPos(), 0, APP_MARGIN_MAX_REM) * rem;
    root.setProperty('--app-margin', `${appMargin.toFixed(2)}px`);
    const VW = layoutVW() - 2 * appMargin, VH = layoutVH() - 2 * appMargin;

    // Slider values → px. Effective gap = max(gap-size, min-gap) (min-gap is a
    // one-way floor; lowering it leaves gap-size put — Ken #3).
    const minGap = (lerp(storage.loadMinGapPos(), 0, MINGAP_MAX_REM)) * rem;
    const gapSize = (lerp(storage.loadButtonGapPos(), 0, GAP_MAX_REM)) * rem;
    let gap = Math.max(gapSize, minGap);

    // Button size: middle (50) = the % default; >50 grows, <50 shrinks.
    const growth = (storage.loadButtonSizePos() - 50) / 50;

    // Region defaults (the slider's middle): dock 30%, transcript 30%.
    let dockW = 0.30 * VW;
    let transcriptV = 0.30 * VH;

    const minTranscript = MIN_TRANSCRIPT_REM * rem;
    if (storage.loadKeyboardDock() === 'side') {
        const minBtn = MIN_BTN_REM * rem;
        // Main-area minimum width: the command bar's 8 buttons bind first.
        const minMainW = 8 * minBtn + 9 * gap;
        if (growth > 0) {
            // GROW: the dock widens (main shrinks W → command/response buttons
            // narrow) and the transcript shrinks V (command/response grow V).
            const maxDockW = Math.max(0.30 * VW, VW - minMainW);
            dockW = 0.30 * VW + growth * (maxDockW - 0.30 * VW);
            transcriptV = 0.30 * VH - growth * (0.30 * VH - minTranscript);
        } else if (growth < 0) {
            // SHRINK: regions stay default; buttons shrink, gap fills.
            gap = Math.max(gap, minGap) + (-growth) * SHRINK_GAP_REM * rem;
        }
        root.setProperty('--conv-dock-w', `${Math.round(dockW)}px`);
        root.setProperty('--conv-transcript-v', `${Math.round(transcriptV)}px`);
    } else {
        // BOTTOM dock: the dock's expandable axis is VERTICAL. GROW makes the
        // dock taller (its buttons taller); command (10vh) + response (30vh)
        // stay fixed, the transcript yields vertically to its floor.
        let dockH = 0.30 * VH;
        if (growth > 0) {
            const maxDockH = Math.max(0.30 * VH, 0.60 * VH - minTranscript); // transcript→floor
            dockH = 0.30 * VH + growth * (maxDockH - 0.30 * VH);
        } else if (growth < 0) {
            gap = Math.max(gap, minGap) + (-growth) * SHRINK_GAP_REM * rem;
        }
        root.setProperty('--conv-dock-h', `${Math.round(dockH)}px`);
    }

    root.setProperty('--grid-gap', `${gap.toFixed(2)}px`);
    root.setProperty('--gap-min', `${minGap.toFixed(2)}px`);
    // Keyboard separation: gap between the dock and the rest of the UI (does not
    // touch the dock footprint, so the keyguard holes don't move).
    const dockSep = lerp(storage.loadDockSepPos(), 0, DOCKSEP_MAX_REM) * rem;
    root.setProperty('--dock-sep', `${dockSep.toFixed(2)}px`);
    // Transcript separation: shortens the transcript vertically to open a gap
    // above the command bar (does not move the command-bar / dock holes).
    const transcriptSep = lerp(storage.loadTranscriptSepPos(), 0, TRANSCRIPTSEP_MAX_REM) * rem;
    root.setProperty('--transcript-sep', `${transcriptSep.toFixed(2)}px`);
    const { rows, cols } = activeLayoutGrid();
    root.setProperty('--kbd-rows', String(rows));
    root.setProperty('--kbd-cols', String(cols));
}

// Apply the user-set text-size scales as CSS multipliers on each surface's base
// font-size. 1 = the design default. A response card counts as TWO surfaces: the
// full response and the AI's short label are sized apart, because a card can show
// both at once and which one should carry the reading is the user's choice.
function applyFontScales() {
    const root = document.documentElement.style;
    root.setProperty('--transcript-font-scale', String(storage.loadTranscriptFontScale()));
    root.setProperty('--composer-font-scale', String(storage.loadComposerFontScale()));
    root.setProperty('--express-font-scale', String(storage.loadExpressFontScale()));
    root.setProperty('--response-font-scale', String(storage.loadResponseFontScale()));
    root.setProperty('--hint-font-scale', String(storage.loadHintFontScale()));
}

// The − / + buttons flanking each size slider nudge it by a small fixed step
// (Ken: the slider "grows uncontrollably quickly" when dragged right — the
// steppers give precise control). They dispatch the slider's own 'input' event so
// the existing persist/apply/clamp handlers run unchanged.
function initSliderSteppers() {
    const content = document.getElementById('settingsContent');
    if (!content) return;
    content.addEventListener('click', (e) => {
        const step = e.target.closest('.slider-step');
        if (!step) return;
        const slider = document.getElementById(step.dataset.target);
        if (!slider) return;
        // ⚠ THE CONTROL'S OWN RANGE, NOT A HARDCODED 0-100. These steppers were written
        // for the sizing sliders, which all run 0-100, and are now also used by the band
        // number boxes, whose ranges are different (the Context band cannot go below its
        // floor). Reading min/max off the element keeps the number on screen inside the
        // range the model will actually accept.
        const lo = slider.min === '' ? 0 : Number(slider.min);
        const hi = slider.max === '' ? 100 : Number(slider.max);
        const next = Math.max(lo, Math.min(hi, Number(slider.value) + Number(step.dataset.step)));
        slider.value = String(next);
        // ⚠ BOTH EVENTS. The steppers only ever fired 'input', which is what a slider
        // listens for - but a number box listens for 'change', because committing on
        // every keystroke would re-render the editor while somebody is still typing.
        // So the band boxes' + and - buttons moved the number on screen and committed
        // NOTHING: Ken set the Context band to three rows, watched the box say 3, and
        // saw one row on the panel. Nothing else here listens for 'change', so this
        // cannot double-fire an existing control.
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

// An Express Panel phrase was activated (single tap, or confirmed double tap). It
// is the user speaking, so it behaves like a selected response: spoken AND
// committed to history (Ken — "anything spoken is part of the conversation").
// Routed through the shared speak-as-a-turn path.
async function handleSpeakExpressItem(phrase) {
    if (editedInSettings(phrase)) return;
    await speakAsUserTurn(phrase.text, phrase.speak || phrase.text, 'express');
}

// --- Settings dialog ---

// --- Keyguard Design: emit a "Screen Openings.txt" describing each control on
// the main conversation screen, in DEVICE (screenshot) pixels — a physical
// keyguard is cut in real pixels, so everything is CSS px × devicePixelRatio.
// Each opening's Y has the window title-bar height added so it lines up with a
// full-screen screenshot (the page viewport sits below the title bar). X needs
// no offset on a maximized window (content left edge = screen left edge).

// Collect the main-UI controls, in reading order, as { name, el } pairs. Only
// laid-out (visible) elements are included.
function collectMainControls() {
    const out = [];
    const add = (el, name) => {
        if (!el) return;
        if (el.getClientRects().length === 0) return; // skip hidden / unlaid-out
        out.push({ el, name });
    };

    // Transcript (the conversation log box).
    add(document.getElementById('transcript'), 'Transcript');

    // Command Bar — the icon buttons (each keeps an accessible name).
    document.querySelectorAll('#listenControls button').forEach((b) =>
        add(b, b.getAttribute('aria-label') || b.textContent.trim() || b.id));

    // Response footprint — the four fixed cells (empty at rest, populated in a
    // conversation; either way four), then the regenerate button.
    let rN = 0;
    document.querySelectorAll('#responseOptions > .response-card-empty, #responseOptions > .response-cell')
        .forEach((c) => { rN += 1; add(c, `Response option ${rN}`); });
    const regen = document.getElementById('regenerateBtn');
    add(regen, regen ? (regen.getAttribute('aria-label') || regen.textContent.trim()) : null);

    // Express Panel buttons (phrases / partners / feelings / "In my own words").
    document.querySelectorAll('#epGrid .ep-btn').forEach((b) =>
        add(b, b.textContent.trim() || b.getAttribute('aria-label') || 'Express button'));

    return out;
}

async function generateScreenOpenings() {
    // WHERE THE FILE GOES depends on whether the user has a folder they can OPEN
    // (Ken, July 31 2026). On desktop it is written to the picked data folder, as
    // before. On a tablet there is no picker and the data folder is OPFS — private
    // to the browser and invisible in the Files app — so writing there would report
    // success for a file the user could never reach or email. The download path
    // (share/save sheet → Files) is the only way off the device, so that is what a
    // no-picker platform gets. Branch on the CAPABILITY, never on the user agent:
    // iPadOS Safari reports itself as a Mac, so a UA test would send the one browser
    // that needs the download down the folder path.
    const canPickFolder = storage.supportsUserChosenFolder();
    if (canPickFolder && !storage.hasDataFolder()) {
        window.alert('Choose a data folder first (Settings → General → Data Folder), then try again.');
        return;
    }
    // A zoomed page measures wrong in BOTH directions at once — Safari scales
    // devicePixelRatio with the zoom and reports the visual viewport — so the file
    // would come out uniformly off and the error would only show up after the
    // plastic was cut. Zoom is blocked (blockZoomGestures), but browser-level and
    // OS accessibility zoom are outside our reach, so refuse rather than emit a
    // plausible-looking wrong file.
    if (Math.abs(zoomScale() - 1) > 0.01) {
        window.alert('The screen is zoomed, so the measurements would be wrong. ' +
            'Reset the zoom to 100% and try again.');
        return;
    }
    // In real fullscreen the page viewport IS the screen, so there is nothing above
    // it and the offset is necessarily 0 (Ken asked, August 3 2026). Taken from the
    // browser rather than the field, because the field is the trap: someone who typed
    // 32 for a windowed setup and later turned on "Use the whole screen" would emit a
    // file with every opening 32px low — plausible-looking, and only discovered after
    // the plastic is cut. Read the ACTUAL state, never the setting: the request can be
    // refused, and Esc leaves fullscreen without touching the setting.
    const titleBar = isReallyFullscreen()
        ? 0
        : Math.max(0, Math.round(Number(document.getElementById('titleBarHeightInput').value) || 0));
    const dpr = window.devicePixelRatio || 1;
    const px = (n) => Math.round(n * dpr); // CSS px → device/screenshot px

    const controls = collectMainControls();
    const lines = controls.map(({ el, name }) => {
        const r = el.getBoundingClientRect();
        const radCss = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
        const h = px(r.height);
        const w = px(r.width);
        const rad = px(radCss);
        const x = px(r.left + r.width / 2);
        const y = px(r.top + r.height / 2) + titleBar; // add title bar to Y
        // [ "name", "r", height, width, radius, xCenter, yCenter, 0, "C", "T", 0, 0, [], [] ],
        return `[ ${JSON.stringify(name)}, "r", ${h}, ${w}, ${rad}, ${x}, ${y}, 0, "C", "T", 0, 0, [], [] ],`;
    });

    const text = lines.join('\n') + '\n';

    // State the screenshot these coordinates assume. The openings are in device
    // pixels, so they only line up over a screenshot at EXACTLY this size — and the
    // commonest way a keyguard comes out misaligned is a screenshot that got
    // resized on its way to the designer (mail clients shrink attached images by
    // default), which scales the error with distance from the top-left corner and
    // looks like the app measured wrong. Naming the expected size makes that
    // checkable in seconds instead of after the plastic is cut.
    const shotW = px(layoutVW());
    const shotH = px(layoutVH()) + titleBar;
    const expected = `Line these up over a screenshot ${shotW} × ${shotH} pixels — ` +
        `if yours is a different size, it was resized and the openings will not fit. ` +
        `(Measured ${layoutVW()} × ${layoutVH()} at ${dpr}×` +
        `${titleBar ? `, plus ${titleBar}px for the bar above the app`
            : (isReallyFullscreen() ? ', using the whole screen so there is no bar above the app'
                                    : ', no bar above the app')}.)`;

    if (!canPickFolder) {
        dataTransfer.downloadText('Screen Openings.txt', text, 'text/plain');
        window.alert(`"Screen Openings.txt" (${lines.length} controls) is ready to save. ` +
            'Choose "Save to Files" in the sheet that appears, then attach it to an email.\n\n' +
            expected);
        return;
    }
    try {
        await storage.writeFile('Screen Openings.txt', text);
        window.alert(`Wrote "Screen Openings.txt" (${lines.length} controls) to the data folder.\n\n` +
            expected);
    } catch (err) {
        window.alert(`Could not write the file: ${err.message}`);
    }
}

function initSettingsTabs() {
    const tablist = document.getElementById('settingsTabs');
    const tabs = Array.from(tablist.querySelectorAll('.settings-tab'));
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-orientation', 'vertical');   // the tabs stack in a column
    tabs.forEach(tab => {
        tab.setAttribute('role', 'tab');
        const on = tab.classList.contains('active');
        tab.tabIndex = on ? 0 : -1;            // roving tabindex: one Tab stop for the strip
        tab.setAttribute('aria-selected', String(on));
        tab.addEventListener('click', () => activateSettingsTab(tab, false));
    });
    // Up/Down arrows move BETWEEN tabs (Ken, July 2026 — the tabs stack in a
    // vertical column, so up/down is the natural axis). The strip is a single Tab
    // stop (roving tabindex), so a physical-keyboard user doesn't have to Tab
    // through every tab AND its content to reach another tab — they Tab to the
    // strip once, arrow to the tab they want, then Tab on into the panel content.
    tablist.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(document.activeElement);
        if (i < 0) return;
        let j = -1;
        if (e.key === 'ArrowDown') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        else return;
        e.preventDefault();
        activateSettingsTab(tabs[j], true);   // move focus + switch the tab
    });
}

// Select a Settings tab: show its panel, update the roving tabindex + aria state,
// optionally move focus to it (arrow-key navigation), and run its side effects.
// "Use the whole screen" (Ken, August 3 2026). ONE mechanism for every platform,
// capability-gated rather than forked, per the standing platform rule: the standard
// Fullscreen API with WebKit's prefixed spelling behind it. Where neither exists the
// call is a no-op and the app looks exactly as it did before.
//
// WHY THE API RATHER THAN THE MANIFEST. `display: "fullscreen"` is only consulted
// when the app is INSTALLED, is reported to fall back to standalone on desktop
// Chromium, and does nothing at all for someone running in a browser tab — which is
// how the iPad's Conversation mode works, and how anyone tries the app before
// deciding to install it. The API covers every one of those cases. The manifest hint
// is declared as well (display_override), since it costs nothing where ignored.
//
// The gain is vertical, which is the scarce axis (Rule 2), and it MOVES EVERY
// KEYGUARD HOLE — measured: the dock keeps its cell sizes but translates down by the
// full height gained, and the command bar's cells change height. That is why it is
// a setting rather than unconditional behavior.
// NOT OFFERED ON WebKit -- measured on Ken's iPad (iPadOS 26.6, Safari 26.6,
// August 3 2026), where it has no upside in either mode and a large downside in one:
//
//   Home Screen app -- NOTHING to hide. There is no title bar, only the iOS status
//     bar, and fullscreen does not displace that, so the layout is identical whether
//     it is on or off.
//   Safari tab      -- actively breaks the app. Settings closes and its button goes
//     dead (WebKit appears to refuse showModal() while the page is fullscreen), the
//     Listen button latches on and cannot be tapped off, and Safari overlays its own
//     persistent exit-X. The one control that could turn the setting back off is the
//     one that stops working, so this is a trap, not an inconvenience.
//
// Gating the REQUEST rather than only hiding the checkbox is the load-bearing half:
// a profile that already has the setting saved true -- Ken's iPad does, from testing
// -- would otherwise stay broken with the off-switch hidden. This makes a stored true
// inert everywhere it cannot work.
//
// Capability-shaped rather than a fork, per the standing rule: on Chromium isIOS() is
// false and every line below runs exactly as it did.
function requestAppFullscreen() {
    if (platform.isIOS()) return;
    if (!storage.loadFullscreen()) return;
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request || document.fullscreenElement || document.webkitFullscreenElement) return;
    try {
        // navigationUI is honoured where supported and ignored elsewhere; the
        // prefixed WebKit form takes no options, which is harmless.
        const r = request.call(el, { navigationUI: 'hide' });
        if (r && typeof r.catch === 'function') r.catch(() => { /* refused — stay windowed */ });
    } catch { /* unsupported or blocked by policy — stay windowed, never break Start */ }
}

// Whether the page is ACTUALLY filling the screen right now — not whether the
// setting asks for it. The two come apart in both directions: a request can be
// refused (no user activation, or policy), and Esc leaves fullscreen without
// changing the setting. Anything that measures the screen must use this one.
function isReallyFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

// The keyguard title-bar offset only means something when there is chrome above the
// page. Report which of the two situations the user is in, and take the field out of
// play in the one where any value but 0 would be wrong.
function reflectTitleBarNeed() {
    const input = document.getElementById('titleBarHeightInput');
    const status = document.getElementById('titleBarStatus');
    if (!input || !status) return;
    const fs = isReallyFullscreen();
    input.disabled = fs;
    status.hidden = !fs;
    if (fs) status.textContent = 'Not needed right now — the app is using the whole screen, so there is no bar above it. Openings are measured from the top of the screen.';
}

// Toggling "Use the whole screen" from inside Settings painted the conversation
// screen (transcript, Command Bar, Response Palette, dock) OVER the Settings panel
// (Ken, August 3 2026). Not a z-index or a layout fault: a modal <dialog> and a
// fullscreen element BOTH live in the TOP LAYER, which paints in the order things
// were ADDED to it. showModal() promoted Settings; the toggle then promoted
// document.documentElement -- the whole page -- ABOVE it.
//
// The reported "closing and reopening Settings resets the display" is the tell, and
// the only thing that explains it: reopening re-adds the dialog to the top layer,
// which puts it back on top. So do that re-promotion ourselves, in place.
//
// ONLY the entering direction is broken. Leaving fullscreen REMOVES documentElement
// from the top layer, leaving the dialog alone up there, so it needs no repair --
// hence the isReallyFullscreen() guard, which also keeps Esc from causing a pointless
// close/reopen flicker.
//
// WHY IN PLACE RATHER THAN DEFERRING THE FULLSCREEN CHANGE UNTIL SETTINGS CLOSES:
// the Keyguard Design tab reads isReallyFullscreen() to decide whether a title-bar
// offset exists, and Generate Screen Openings measures the LIVE layout -- both from
// inside Settings. Deferring would let someone turn fullscreen on and then generate
// an openings file believing they were in a mode they were not actually in, which is
// the exact trap 0.6.4 closed. The state has to be honest while the panel is open.
//
// Safe to close() here: there is no 'close' listener (the one listener is 'cancel',
// which close() does not fire -- it is Escape only), and the active tab, scroll
// position and field values all live in the DOM and survive. Focus is put back where
// it was so that a reparented on-screen keyboard comes straight back from the
// focusout/focusin round trip.
function repromoteSettingsOverFullscreen() {
    const dlg = document.getElementById('settingsDialog');
    if (!dlg || !dlg.open || !isReallyFullscreen()) return;
    const focused = document.activeElement;
    dlg.close();
    dlg.showModal();
    const restore = (focused && focused !== document.body && dlg.contains(focused))
        ? focused
        : document.getElementById('settingsHeader');
    restore?.focus();
}

function exitAppFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (!exit || !(document.fullscreenElement || document.webkitFullscreenElement)) return;
    try {
        const r = exit.call(document);
        if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch { /* already out, or refused */ }
}

// --- Collapsible setting sections ------------------------------------------------
//
// Settings tabs are ONE column (Ken, August 11 2026: "the two-column, reflow, layouts
// don't work well"). Columns existed to fit the denser tabs without scrolling, which
// this audience needs; sections buy that height back a better way — a tab opens as a
// short list of headings, all of them closed.
//
// EVERY control is inside a section (Ken, August 11 2026: "if no other section makes
// sense then create one just for that control"). A group that used to be a lone
// self-labelling checkbox or button now carries a heading of its own in index.html, so
// there is no such thing as a control sitting loose between sections.
//
// The wrapping itself lives in sections.js, shared with the Controls editor, which
// builds its sections at runtime rather than declaring them in index.html.
function makeGroupsCollapsible(panel) {
    if (panel) makeCollapsible(panel, panel.dataset.tab);
}

function activateSettingsTab(tab, focus) {
    document.querySelectorAll('#settingsTabs .settings-tab').forEach(t => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.tabIndex = on ? 0 : -1;
        t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('#settingsContent .tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.querySelector(`.tab-panel[data-tab="${tab.dataset.tab}"]`);
    panel.classList.add('active');
    if (focus) tab.focus();
    handleSettingsTab(tab.dataset.tab);
    // After handleSettingsTab, never before: the Controls / Express / Practice tabs
    // build their contents there. Idempotent, so a re-visited tab keeps whatever the
    // user had opened.
    makeGroupsCollapsible(panel);
}

/**
 * Take the user to one specific control in Settings, with its section open.
 *
 * Every section starts CLOSED (Rule 18), so a jump that only switches tabs promises
 * a control and delivers a list of headings. That is exactly what the pre-start
 * "Add an API key" button did — it named the field and landed the user on the
 * General tab with the API Key section shut. Any future jump into Settings carries
 * the same obligation, which is why this is one function rather than a line at each
 * call site.
 *
 * Opens EVERY section above the control, not just the one holding it: a sub-section
 * opened inside a shut parent is no use.
 *
 * Deliberately does NOT focus the control — focusing a text field raises the
 * on-screen keyboard over the panel the user was sent here to read, which is why
 * openSettings parks focus on the header in the first place.
 *
 * @param {string} id  the control's element id
 */
function revealSetting(id) {
    const el = document.getElementById(id);
    if (!el) return;

    // The control may be on a tab that isn't showing. Switching tabs also BUILDS that
    // tab's sections (they are made collapsible on first visit), so this has to come
    // before anything that looks for a <details> around the control.
    const panel = el.closest('.tab-panel');
    if (panel && !panel.classList.contains('active')) {
        const tab = document.querySelector(`#settingsTabs .settings-tab[data-tab="${panel.dataset.tab}"]`);
        if (tab) activateSettingsTab(tab, false);
    }

    for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
    el.scrollIntoView({ block: 'center' });
}

// On the Buttons & Keyboard tab the user changes keyboard layout/position but
// there's no text field to type into, so show the keyboard as a live preview of
// the CHOSEN dock. Any other tab takes the preview down.
function handleSettingsTab(tabName) {
    // About Me renders into its own tab-panel and keeps the on-screen keyboard up
    // (a preview when no field is focused; a typing keyboard once a card field is).
    // Every tab but Express puts the panel back in the dock. Done first so no path
    // can leave it hosted in a dialog that is about to show something else.
    hostExpressPanel(tabName === 'express');
    if (tabName === 'aboutme') { worldviewUI.open(); return; }
    // The panel is now live beside the editor, so the editor is a view of the panel
    // as it will actually appear, edited in place. The keyboard shares the same dock
    // band, so it covers the panel once a field is focused and the two swap — which
    // is tolerable on a Settings surface in a way it would not be during a
    // conversation. In physical-keyboard mode there is no conflict at all.
    if (tabName === 'express') {
        expressEditor.render();
        wireExpressTabSections();
        // On this tab the Express Panel is the thing being worked on, so it must be
        // visible whenever the user is not actually typing (Ken, August 23 2026).
        // Focus leaving a phrase box now puts the panel back by itself.
        keyboard.setHideOnBlur(true);
        syncExpressTabDock();
        return;
    }
    keyboard.setHideOnBlur(false);
    if (tabName === 'commands') { controlEditor.render(); keyboard.hideKeyboard(); return; }
    if (tabName === 'placeholders') { placeholderEditor.render(); return; }
    if (tabName === 'practice') { renderPracticePanel(); keyboard.hideKeyboard(); return; }
    // Rendered on open rather than at Settings-open: reading every conversation log
    // off disk is the most expensive thing in this panel, and it is pointless on the
    // ten other tabs. Keeps the keyboard available — the note field is typed into.
    if (tabName === 'troubleshooting') { renderTroubleshooting(); return; }
    // hideKeyboard (not previewHide) so leaving any tab forcibly drops the keyboard
    // even if a field there still holds stale focus (e.g. an About Me card field whose
    // focusout was suppressed while Settings is open). The layout controls used to
    // live on the Buttons tab and previewed the keyboard here; they moved to the
    // Express tab, so that preview moved with them into syncExpressTabDock.
    keyboard.hideKeyboard();
}

/**
 * WHICH OF THE TWO THE DOCK SHOWS WHILE THE EXPRESS TAB IS OPEN.
 *
 * They occupy the same rectangle by design (Rule 9: the panel is grid-congruent with
 * the keyboard so one keyguard overlays both), so only one can be up. The rule is in
 * one sentence: choosing a layout shows the KEYBOARD, because that is when the key
 * positions and the letter and number pages are what you need to see; everything else
 * shows the PANEL, because the panel is what is being administered.
 *
 * Driven by which section is open rather than by a toggle the user has to find and
 * remember to put back. A toggle would be a mode, and being stuck in a mode with no
 * obvious way out is the failure this is fixing. The keyboard's own Hide icon remains
 * the manual override, and opening any other section puts the panel back.
 */
let expressAutoFocusedBox = false;

function syncExpressTabDock() {
    const grid = document.querySelector('#settingsDialog [data-help="expressKeyboard"] details');
    const wantKeyboard = !!(grid && grid.open) && storage.loadKeyboardMode() === 'onscreen';
    if (wantKeyboard) { keyboard.previewShow(storage.loadKeyboardDock()); return; }
    // ⚠ EXCEPT WHEN THE EDITOR HAS JUST PUT THE CARET IN A NEW BOX ITSELF. "Add a
    // phrase" rebuilds the editor, and rebuilding re-creates the <details> elements,
    // so restoring their open state fires `toggle` -- which lands here on the very
    // next tick and took the keyboard straight back down again, one tick after Add
    // had raised it (Ken, August 27 2026: "the Express Panel is still displayed
    // rather than the keyboard... if I click outside of the box and then back in,
    // the keyboard appears" -- clicking back in works precisely because nothing
    // rebuilds, so no toggle fires).
    //
    // ⚠ THE SIGNAL IS THE EDITOR SAYING SO, NOT A READ OF WHERE FOCUS IS. Reading
    // live focus looks equivalent and is not: a tap on a section heading is supposed
    // to put the panel back, and whether that tap has moved focus off the box yet is
    // a browser detail we would then be depending on. An explicit one-shot answers
    // the only question that matters -- "did the app itself just move the caret?" --
    // and a heading tap can never set it.
    // NOT consumed on read: one rebuild fires SEVERAL toggles (opening a section
    // closes the others, and each of those is its own event), so a one-shot was eaten
    // by the first and the second still hid the keyboard. It is cleared by the next
    // pointerdown instead, which is deterministic -- no reliance on which queued task
    // runs first -- and is exactly the moment the user could be asking for the panel.
    if (expressAutoFocusedBox) return;
    keyboard.hideKeyboard();
}

/**
 * Watch the Express tab's sections so the dock follows them. Opening the layout
 * section brings the keyboard up; opening any other section closes the layout section
 * and puts the panel back, so the two can never both be asking for the dock.
 */
/**
 * THE BACKSTOP, and on this tab it is the primary mechanism rather than a safety net.
 *
 * The focus rules in keyboard.js decide things from focusin/focusout, which is right
 * for a form but fragile here: whether a tap on a heading, a toolbar icon or the panel
 * itself moves focus at all varies by browser and by whether the target is focusable,
 * and a rule that only sometimes fires is worse than no rule. So on the Express tab a
 * POINTERDOWN anywhere that is not a text box and not the keyboard puts the panel
 * back. It asks the question the user is actually asking - "am I typing right now?" -
 * and it needs no focus event to answer it.
 *
 * Not applied anywhere else: on every other tab the keyboard staying up through a tap
 * on Save is deliberate and was fixed that way on purpose.
 */
/**
 * KEEP A DROPDOWN'S LIST BELOW ITS OWN LABEL.
 *
 * A native <select> decides for itself which way its list opens: near the bottom of the
 * window the browser opens it UPWARD, where it covers the select's own label and comes
 * to rest directly under the label of the control ABOVE - so the options read as
 * belonging to the wrong setting. Ken hit this on "Telling context buttons apart",
 * whose list appeared under "Measured in".
 *
 * There is no way to force the direction: it is the platform's popup, not ours, and no
 * CSS or attribute reaches it. What we CAN do is remove the reason - if the control is
 * not near the bottom, the browser opens downward. So on pointerdown, if the select
 * sits in the lower part of its scrolling panel, scroll it up first. The list then
 * opens below it, under its own label.
 *
 * Done on pointerdown rather than focus so the scroll lands BEFORE the popup is
 * positioned; a focus handler fires too late on some browsers.
 */
function keepDropdownsOpeningDownward(scroller) {
    scroller.addEventListener('pointerdown', (e) => {
        const sel = e.target instanceof Element ? e.target.closest('select') : null;
        if (!sel) return;
        const box = scroller.getBoundingClientRect();
        const here = sel.getBoundingClientRect();
        // "Near the bottom" = not enough room under it for a short list.
        const roomBelow = box.bottom - here.bottom;
        if (roomBelow >= 180) return;
        scroller.scrollTop += here.top - box.top - 24;   // bring it near the top
    }, true);
}

function wireExpressTabDockBackstop(panel) {
    panel.addEventListener('pointerdown', (e) => {
        // Any tap ends the "the editor just moved the caret here" exemption, whatever
        // the tap turns out to be -- cleared before the early returns below so a tap
        // that keeps the keyboard up still cancels it.
        expressAutoFocusedBox = false;
        const t = e.target instanceof Element ? e.target : null;
        if (!t) return;
        if (t.closest('#expressEditor input, #expressEditor textarea')) return;  // they ARE typing
        if (t.closest('#appKeyboard')) return;                                   // using the keys
        const grid = panel.querySelector('[data-help="expressKeyboard"] details');
        if (grid && grid.open) return;   // the layout section is meant to show the keyboard
        keyboard.hideKeyboard();
    }, true);
}

function wireExpressTabSections() {
    const panel = document.querySelector('#settingsDialog .tab-panel[data-tab="express"]');
    if (!panel || panel.dataset.dockWired === '1') return;
    panel.dataset.dockWired = '1';
    wireExpressTabDockBackstop(panel);
    panel.addEventListener('toggle', (e) => {
        const det = e.target;
        if (!(det instanceof HTMLDetailsElement)) return;
        // Closing the others is sections.js's job now (one section open at a time),
        // so this only has to follow whatever ended up open.
        syncExpressTabDock();
    }, true);   // capture: <details> toggle does not bubble
}

// Show only the controls relevant to the chosen dock: side → which-side + side
// layout; bottom → bottom layout. Keeps Settings from implying both docks exist
// at once now that it's a single choice.
function updateKeyboardPositionGroups() {
    const dock = storage.loadKeyboardDock();
    const side = dock === 'side';
    const set = (id, show) => {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? '' : 'none';
    };
    set('sidePositionGroup', side);
    set('sideLayoutGroup', side);
    set('bottomLayoutGroup', !side);
}

function populateVoiceSelect() {
    const select = document.getElementById('voiceSelect');
    const voices = tts.usableVoices(storage.loadShowNoveltyVoices());
    const savedURI = storage.loadVoiceURI();
    select.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Browser default';
    select.appendChild(defaultOpt);

    voices.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.voiceURI;
        opt.textContent = tts.voiceLabel(voice);
        if (voice.voiceURI === savedURI) opt.selected = true;
        select.appendChild(opt);
    });
}

// Practice partner voice select — same voice list, with an "Auto" default that
// picks a voice different from the user's own.
function populatePartnerVoiceSelect() {
    const select = document.getElementById('partnerVoiceSelect');
    if (!select) return;
    const voices = tts.usableVoices(storage.loadShowNoveltyVoices());
    const saved = storage.loadPartnerVoice();
    select.innerHTML = '';

    const autoOpt = document.createElement('option');
    autoOpt.value = '';
    autoOpt.textContent = 'Auto (a voice that isn\'t yours)';
    select.appendChild(autoOpt);

    voices.forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.voiceURI;
        opt.textContent = tts.voiceLabel(voice);
        if (voice.voiceURI === saved) opt.selected = true;
        select.appendChild(opt);
    });
}

function fillLayoutSelect(select, layouts, selectedId) {
    select.innerHTML = '';
    layouts.forEach(({ id, name }) => {
        const opt = document.createElement('option');
        opt.value = id;
        // Show only the human-readable name — the S1/B1 ids are internal and mean
        // nothing to the user; the id stays as the option's value.
        opt.textContent = name;
        if (id === selectedId) opt.selected = true;
        select.appendChild(opt);
    });
}

// A folder just became available — either the user picked one, or they let the app
// back into the one it already remembered. Reconcile every user-owned file against
// it (adopt the on-disk copy where it exists, promote the localStorage cache where
// it doesn't — the v0.2.25 rule) and redraw everything that reads from it.
//
// Shared rather than inlined at each call site, because the list is long and the
// cost of an omission is silent: the settings-profile list was left out of the pick
// handler, so a user who connected their folder from Settings saw NO profiles until
// they closed the panel and opened it again, and reasonably concluded the profiles
// had been lost (Ken, Android tablet, August 31 2026).
async function adoptDataFolder() {
    try { await worldview.syncToFolder(); } catch { /* best-effort */ }
    try { await relationships.syncToFolder(); } catch { /* best-effort */ }
    try { await places.syncToFolder(); } catch { /* best-effort */ }
    try { await voiceProfile.syncToFolder(); } catch { /* best-effort */ }
    try { await expressPanel.syncToFolder(); } catch { /* best-effort */ }
    renderExpressPanel();
    try { await controlPhrases.syncToFolder(); } catch { /* best-effort */ }
    try { await placeholderPhrases.syncToFolder(); } catch { /* best-effort */ }
    applyControlPhrases();
    updateFolderDisplay();
    // Both of these read FROM the folder, so both show an empty state until one is
    // connected — and neither was redrawn when one was. The backup list has the same
    // fault as the profile list and is fixed in the same place rather than waiting to
    // be reported separately.
    //
    // The panel may not even be open (the reconnect card runs before the conversation
    // starts), in which case these are cheap no-ops against hidden elements.
    try { await renderSettingsProfiles(); } catch { /* best-effort */ }
    try { await renderBackupList(); } catch { /* best-effort */ }
}

function updateFolderDisplay() {
    const nameEl = document.getElementById('dataFolderName');
    const name = storage.getDataFolderName();
    if (name) {
        nameEl.textContent = name;
        nameEl.classList.remove('placeholder');
    } else {
        nameEl.textContent = 'No folder selected';
        nameEl.classList.add('placeholder');
    }

    // On a platform with no folder picker (iPad), the app stores data in the
    // browser's own private storage and there is nothing for the user to choose.
    // Offering "Choose Folder" there would be an invitation to a dead end, so the
    // whole control is swapped for an explanation of where the data actually is
    // and how safe it is. Keyed off capability, never off the user-agent — iPadOS
    // Safari claims to be a Mac.
    const deviceMode = !storage.supportsUserChosenFolder();
    const pickBtn = document.getElementById('pickFolderBtn');
    if (pickBtn) pickBtn.hidden = deviceMode;
    // The group's label still has to swap: "Data Folder" names a thing that does
    // not exist on a tablet. The explanatory hint that used to sit under it was
    // removed with the rest of the per-control help (Ken, Aug 1 2026) and now
    // lives in the manuals, so the label carries the distinction on its own.
    const folderLabel = document.getElementById('dataFolderLabel');
    if (folderLabel) {
        folderLabel.textContent = deviceMode ? 'Where Your Data Is Kept' : 'Data Folder';
    }
    updateStorageDurability(deviceMode);
}

// Report whether the browser has promised to keep this data. Only shown where it
// can actually be in doubt (device storage): measured on an iPad July 30 2026,
// persistence is granted to a Home Screen app and REFUSED in a browser tab, and a
// refused origin is erased after seven days without use. A user whose data can
// evaporate is entitled to know that before it happens, not after.
async function updateStorageDurability(deviceMode) {
    const row = document.getElementById('storageDurabilityRow');
    if (!row) return;
    row.hidden = !deviceMode;
    if (!deviceMode) return;

    const statusEl = document.getElementById('storageDurabilityStatus');
    const btn = document.getElementById('makeStorageDurableBtn');
    const status = await storage.getStorageStatus();
    const room = status.quotaMB ? ` About ${status.quotaMB.toLocaleString()} MB of room.` : '';

    if (!status.supported) {
        statusEl.textContent = 'This browser cannot promise to keep your data. Export a backup regularly.';
        statusEl.className = 'setting-hint storage-warn';
        if (btn) btn.hidden = true;
        return;
    }
    if (status.persisted) {
        statusEl.textContent = `Your data is safe on this device — the browser has promised not to clear it.${room}`;
        statusEl.className = 'setting-hint storage-ok';
        if (btn) btn.hidden = true;
    } else {
        statusEl.textContent = 'Your data is NOT protected yet. This browser may erase it after about a week ' +
            'without use. Tap below to ask it not to — and export a backup either way.';
        statusEl.className = 'setting-hint storage-warn';
        if (btn) btn.hidden = false;
    }
}

let pricingData = null;

async function loadPricing() {
    if (pricingData) return pricingData;
    try {
        const resp = await fetch('data/pricing.json');
        pricingData = await resp.json();
    } catch {
        pricingData = {
            inputCostPerMillionTokens: 3, outputCostPerMillionTokens: 15,
            cacheWriteMultiplier: 1.25, cacheReadMultiplier: 0.1,
        };
    }
    return pricingData;
}

async function updateUsageDisplay() {
    const usage = storage.loadUsage();
    const pricing = await loadPricing();
    // The AI is not the only thing the user pays for once the paid backends are in
    // use: transcription bills per second of audio and the voice bills per
    // character. Showing only the token cost would understate the bill on exactly
    // the platform (iPad) where both paid services are the normal configuration.
    const sttSeconds = storage.loadSttSeconds();
    const ttsCharacters = storage.loadTtsCharacters();
    // Prompt-cached input is billed at three different rates, so the three buckets
    // are priced separately. Getting this wrong is not cosmetic: the API reports
    // input_tokens as the UNCACHED REMAINDER, so pricing that one number alone
    // would under-report the bill by the hit rate (~90% on the generation call).
    const inputRate = pricing.inputCostPerMillionTokens / 1_000_000;
    const sttCost = (sttSeconds / 3600) * (pricing.deepgramSttCostPerHour ?? 0);
    const ttsCost = (ttsCharacters / 1000) * (pricing.deepgramTtsCostPer1kChars ?? 0);
    const aiCost = (usage.inputTokens * inputRate)
               + (usage.cacheWriteTokens * inputRate * (pricing.cacheWriteMultiplier ?? 1.25))
               + (usage.cacheReadTokens * inputRate * (pricing.cacheReadMultiplier ?? 0.1))
               + (usage.outputTokens * pricing.outputCostPerMillionTokens / 1_000_000);
    const cost = aiCost + sttCost + ttsCost;
    document.getElementById('usageCost').textContent = `$${cost.toFixed(2)}`;
    const sinceDate = new Date(usage.since).toLocaleDateString();
    // Name the paid extras only when they have actually been used, so a Windows
    // user on the free backends sees exactly what they saw before.
    const extras = [];
    // Prompt-cache hit rate — the share of all prompt tokens served from cache. This
    // is the number to WATCH (Ken, August 8 2026): a figure that drops means
    // something is invalidating the prefix, which shows up as spend before it shows
    // up as anything else. Shown only once there is cache activity, so a user who
    // has never had a conversation sees exactly what they saw before.
    //
    // ⚠ THE WORDING IS DELIBERATE AND IS NOT "cached". The first cut read "% of
    // prompt cached", which is two pieces of jargon on a surface a non-technical
    // user reads — written the same day Ken said this vocabulary was over his head.
    // "Reused rather than re-sent" says the whole mechanism in words that need no
    // glossary, and it is what the cost document quotes. Do not "tidy" it back
    // toward the technical term.
    const promptTokens = usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
    if (promptTokens > 0 && (usage.cacheReadTokens > 0 || usage.cacheWriteTokens > 0)) {
        extras.push(`${Math.round(usage.cacheReadTokens / promptTokens * 100)}% reused rather than re-sent`);
    }
    document.getElementById('usageSince').textContent =
        `since ${sinceDate}` + (extras.length ? ` · ${extras.join(' · ')}` : '');

    // ⚠ THREE SEPARATE ESTIMATES, NOT ONE TOTAL WITH THE PARTS IMPLIED (Ken, August 29
    // 2026: "why can't you estimate the AI and Deepgram costs separately?"). The first
    // cut showed the paid extras' shares and left the AI's to be worked out by
    // subtraction, which is the same failure one step along: three services bill this
    // user and the question they actually have is which one to reconsider. Nothing
    // prevented it - all three numbers are computed here already.
    //
    // Shown only once a paid service has been used, because on the free setup the AI
    // figure IS the total and printing it twice says nothing.
    const breakdown = document.getElementById('usageBreakdown');
    if (breakdown) {
        const paidUsed = sttSeconds > 0 || ttsCharacters > 0;
        breakdown.hidden = !paidUsed;
        breakdown.textContent = '';
        if (paidUsed) {
            const line = (what, amount, money, cls) => {
                const row = document.createElement('div');
                row.className = 'usage-line' + (cls ? ' ' + cls : '');
                const a = document.createElement('span'); a.className = 'usage-what'; a.textContent = what;
                const b = document.createElement('span'); b.className = 'usage-amount'; b.textContent = amount;
                const c = document.createElement('span'); c.className = 'usage-money'; c.textContent = `$${money.toFixed(2)}`;
                row.append(a, b, c);
                breakdown.appendChild(row);
            };
            // ⚠ THE TWO HEADLINE FIGURES ARE NAMED BY COMPANY, NOT BY WHAT THEY DO (Ken,
            // August 29 2026: "they should also be totaled and identified as 'Deepgram
            // cost estimate' and 'Anthropic Claude' cost estimate. Two values, by
            // name."). The user holds one account with each company and gets one bill
            // from each, so those are the two figures they can actually check this
            // against. "AI", "Hearing" and "Speaking" describe what the app did with the
            // money, which is the useful SECOND question and not the first one.
            //
            // Hearing and speaking stay, indented under the Deepgram total: they are one
            // bill, but they are two rates on two very different quantities, so which of
            // them is carrying the cost is exactly what a user deciding whether to keep
            // paying needs to see.
            const words = usage.inputTokens + usage.cacheWriteTokens
                        + usage.cacheReadTokens + usage.outputTokens;
            // Both names are literal because both services are. When the provider
            // abstraction lands (CLAUDE.md, "Vendor choice is a USER decision") these
            // become the chosen provider's name, from the same place the endpoint and
            // the rates come from - not two more strings to find.
            line('Anthropic Claude', `${words.toLocaleString()} words in and out`, aiCost);
            line('Deepgram', '', sttCost + ttsCost);
            line('Hearing', sttSeconds > 0 ? `${Math.round(sttSeconds / 60)} min heard` : 'not used', sttCost, 'usage-sub');
            line('Speaking', ttsCharacters > 0 ? `${ttsCharacters.toLocaleString()} characters spoken` : 'not used', ttsCost, 'usage-sub');
        }
    }
}

// Group the error log by conversation, most-recent conversation first. Errors
// with no conversation id ('(none)') sort last. Returns [ [convId, entries], … ].
function groupErrorsByConversation() {
    const groups = new Map();
    for (const e of storage.loadErrorLog()) {
        const k = e.conversation || '(none)';
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(e);
    }
    // ids are timestamp strings, so a lexical sort is chronological; reverse →
    // newest first. '(none)' sorts before digits, so after reverse it lands last.
    return [...groups.keys()].sort().reverse().map((id) => [id, groups.get(id)]);
}

// Render the error-log viewer (Settings → About): errors GROUPED BY CONVERSATION
// (Ken, July 2026), newest conversation first, so all the errors from one exchange
// sit together. Compact here (no transcript); the full transcript is bundled by
// Copy (buildErrorReport).
function renderErrorLog() {
    const view = document.getElementById('errorLogView');
    const countEl = document.getElementById('errorLogCount');
    if (!view) return;
    const log = storage.loadErrorLog();
    if (countEl) countEl.textContent = log.length ? `(${log.length})` : '';
    const lines = [];
    for (const [id, errs] of groupErrorsByConversation()) {
        lines.push(`━━━ Conversation ${id} (${errs.length} error${errs.length > 1 ? 's' : ''}) ━━━`);
        for (const e of errs) {
            lines.push(`  ${e.ts} [${e.context}] ${e.message}` + (e.extra ? ` | ${JSON.stringify(e.extra)}` : ''));
        }
    }
    view.value = lines.join('\n');
    view.scrollTop = 0;   // groups are newest-first, so the most relevant is at top
}

// --- Troubleshooting tab (Ken, August 7 2026) --------------------------------
// The aggregator is deliberately the FIRST thing built: almost every measure the
// beta needs is already sitting in conversations/*.json — timestamps, which card
// was picked, what else was offered — so this reads history rather than adding
// capture. It has simply never had a reader.

async function buildUsageText() {
    const summary = usageSummary.summarize(await storage.listConversationLogs());
    const personalization = usageSummary.summarizePersonalization({
        ...diagnostics.collectPersonalization(),
        settingsProfiles: await diagnostics.countSettingsProfiles(),
    });
    return usageSummary.formatSummary(summary, personalization);
}

async function renderUsageSummary() {
    const view = document.getElementById('usageSummaryView');
    if (!view) return;
    try {
        view.value = await buildUsageText();
    } catch (e) {
        // Never let a diagnostic throw: it runs precisely when something is already
        // wrong, and a blank panel would hide the very thing being looked for.
        view.value = `Could not read the saved conversations.\n${e && e.message ? e.message : e}`;
    }
    view.scrollTop = 0;
}

async function renderSystemInfo() {
    const view = document.getElementById('systemInfoView');
    if (!view) return;
    try {
        view.value = diagnostics.formatSystemInfo(
            await diagnostics.collectSystemInfo({ appVersion: APP_VERSION, buildId: BUILD_ID }));
    } catch (e) {
        view.value = `Could not collect system information.\n${e && e.message ? e.message : e}`;
    }
    view.scrollTop = 0;
}

function renderWeeklyReport() {
    const contents = document.getElementById('weeklyReportContents');
    if (contents) contents.value = weeklySend.describeReport();
    const log = document.getElementById('weeklySendLogView');
    if (log) { log.value = weeklySend.formatSendLog(storage.loadWeeklySendLog()); log.scrollTop = 0; }
    const name = document.getElementById('testerNameInput');
    if (name) name.value = storage.loadTesterName();
    const enabled = document.getElementById('weeklySendEnabledInput');
    if (enabled) enabled.checked = storage.loadWeeklySendEnabled();
    const status = document.getElementById('testerNameStatus');
    // An empty-state message, not per-control help (Rule 14): a supporter setting
    // the device up needs to notice the blank, because a report with no name still
    // sends and Ken has only the device id to go on.
    if (status) status.textContent = storage.loadTesterName()
        ? '' : 'Not set — reports will not say who they are from.';
}

function renderTroubleshooting() {
    renderErrorLog();
    renderUsageSummary();
    renderSystemInfo();
    renderWeeklyReport();
}

// The whole report. `buildErrorReport` already withholds a private conversation's
// transcript (SEC-2) and `storage.reportableSettings` already strips both API keys
// (SEC-6), so neither rule is re-implemented here.
async function buildProblemReportText() {
    const noteEl = document.getElementById('problemNoteInput');
    let usageText = '';
    try { usageText = await buildUsageText(); }
    catch { usageText = '(unavailable)'; }
    let errorReport = '';
    try { errorReport = await buildErrorReport(); } catch { errorReport = '(unavailable)'; }
    return diagnostics.buildProblemReport({
        note: noteEl ? noteEl.value : '',
        appVersion: APP_VERSION,
        buildId: BUILD_ID,
        errorReport,
        usageText,
        recentEvents: metrics.formatRecent(),
    });
}

function setProblemReportStatus(msg) {
    const el = document.getElementById('problemReportStatus');
    if (el) el.textContent = msg || '';
}

/* The problem report from the LAUNCH SCREEN.
 *
 * This button exists because Settings can be unreachable - it is off-limits before
 * Start by design, and the 0.6.5 top-layer fault made it unreachable mid-session on an
 * iPad. So it must not depend on any part of the Settings panel.
 *
 * (!) IT SENDS RATHER THAN SAVING A FILE (Ken, August 31 2026). A file left the tester
 * to find it and decide what to do with it, which is real work at the worst possible
 * moment and, for this population, may not be possible unaided.
 *
 * (!) AND IT STILL SHOWS THE TEXT BEFORE SENDING. The report carries the transcripts
 * of any conversation that hit an error, which is the one thing the app never sends on
 * its own - so the tester SEES the exact text and then CONFIRMS, two steps, neither
 * optional. In Settings the seeing is a preview box on the panel; here the panel is
 * exactly what may be missing, so the dialog carries the preview instead.
 *
 * The report is built ONCE and the same string is previewed, confirmed and sent, so
 * what leaves the device is character-for-character what was shown.
 */
async function sendProblemReportFromStart() {
    // The status line lives in Settings, which is the panel that may be unreachable,
    // so the button reports on itself. Without this the tester gets no confirmation
    // at all beyond whatever the browser happens to show, which can be nothing.
    const btn = document.getElementById('startReportBtn');
    const say = (msg) => {
        setProblemReportStatus(msg);
        if (btn) {
            const orig = btn.dataset.label || btn.textContent;
            btn.dataset.label = orig;
            btn.textContent = msg;
            setTimeout(() => { btn.textContent = btn.dataset.label; }, 5000);
        }
    };
    let text;
    try {
        text = await buildProblemReportText();
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        say(`Could not build the report: ${msg}`);
        // Deliberately not logged from here: the app may be mid-failure, and logError
        // writes to disk and dispatches a UI event, either of which could throw again
        // and swallow the message the tester needs to see.
        return;
    }
    if (!(await confirmDanger({
        title: 'Send this report?',
        body: REPORT_DISCLOSURE,
        preview: text,
        confirmLabel: 'Send it',
        cancelLabel: 'Not now'
    }))) {
        say('Not sent. Nothing has left this device.');
        return;
    }
    try {
        const res = await weeklySend.sendProblemReport({
            note: '', report: text, appVersion: APP_VERSION, build: BUILD_ID,
        });
        if (res && res.sent) say('Sent and received. Thank you.');
        else say('Not sent yet - it is saved and will go by itself next time.');
    } catch {
        say('Not sent yet - it is saved and will go by itself next time.');
    }
}

/* THE ONE DISCLOSURE, used by both places a report can be sent from.
 *
 * (!) EVERY CLAIM IN IT WAS CHECKED AGAINST WHAT IS ACTUALLY SENT (Ken, August 31
 * 2026), and the wording it replaces got four things wrong. It said the text appeared
 * "above the button" when it appeared below it; it said a conversation marked "Don't
 * save" was not in the report at all, when what is withheld is the TRANSCRIPT and an
 * error from it may still be listed; and it named only the note, settings, device and
 * errors while the report also carries the usage summary - which prints THE NAMES OF
 * PEOPLE THE USER HAS TALKED TO - and the recent-actions list.
 *
 * The names are the reason this matters rather than being tidy: those are third
 * parties who never agreed to anything, so a tester cannot meaningfully consent to
 * sending them without being told they are in there.
 *
 * ⚠ IF A SECTION IS EVER ADDED TO buildProblemReport, IT BELONGS HERE TOO. A
 * disclosure that has quietly stopped listing what it sends is worse than none,
 * because it is read as complete. */
const REPORT_DISCLOSURE =
    'It goes to the Conversant AAC team. You can read the whole report below before it '
    + 'leaves. It contains what you typed, your settings, your device, how you have been '
    + 'using the app - including the names of people you have talked to - and the errors '
    + 'it recorded, along with what was said in any conversation those errors happened in. '
    + 'A conversation you marked "Don\u2019t save" has no transcript here, though an error '
    + 'from it may still be listed. Your API keys are never included.';


/* Send the problem report back over the same path the weekly report uses (Ken,
 * August 21 2026). Ken's objection to Save-to-a-file was tester workload: it leaves
 * them to find the file and decide what to do with it, and Copy assumes somewhere to
 * paste. Both are real work at the worst possible moment.
 *
 * ⚠ TWO STEPS, AND NEITHER IS OPTIONAL. The report carries the transcripts of any
 * conversation that hit an error, which is the one thing the app never sends
 * automatically — so the tester must SEE the exact text and then CONFIRM. The preview
 * is the seeing; the red card is the confirming. Anything that reduces this to one
 * tap has broken the rule, not streamlined it.
 *
 * The report is built ONCE and the same string is previewed, confirmed and sent, so
 * what leaves the device is character-for-character what was on screen. Rebuilding it
 * after the confirmation would let it drift between the two.
 */
async function sendProblemReport() {
    let text;
    try {
        text = await buildProblemReportText();
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        setProblemReportStatus(`Could not build the report: ${msg}`);
        storage.logError('problem report', msg);
        return;
    }
    setProblemReportStatus('Read it through, then confirm to send.');
    if (!(await confirmDanger({
        title: 'Send this report?',
        body: REPORT_DISCLOSURE,
        preview: text,
        confirmLabel: 'Send it',
        cancelLabel: 'Not yet'
    }))) {
        setProblemReportStatus('Not sent. Nothing has left this device.');
        return;
    }
    try {
        const res = await weeklySend.sendProblemReport({
            note: document.getElementById('problemNoteInput')?.value || '',
            report: text,
            appVersion: APP_VERSION,
            build: BUILD_ID,
        });
        // (!) THESE THREE MESSAGES ARE NOW TRUE, WHICH THEY WERE NOT BEFORE. The app
        // used to be unable to read the reply, so "Sent" meant only that the request
        // had left the device and a report the far end threw away said thank you.
        // post() now reads the answer, so "received" means received. The tester is
        // never asked to detect a failure by noticing that nothing happened - which
        // was the previous plan and put the onus in the wrong place entirely.
        if (res && res.sent) setProblemReportStatus('Sent and received. Thank you — that is the whole procedure.');
        else if (res && res.queued) setProblemReportStatus('Not sent yet — it is saved and will go by itself next time you open the app. Nothing more for you to do.');
        else setProblemReportStatus('Not sent yet — it is saved and will try again on its own.');
        renderWeeklyReport();
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        setProblemReportStatus('Not sent yet — it is saved and will try again next time you open the app.');
        storage.logError('problem report send', msg);
    }
}

// Populate the Settings-profiles picker (About tab) from the data folder. Disables
// the picker's Load/Delete when there are none, and shows a hint when no folder is
// granted (profiles live in the folder).
// --- Backup & transfer (Ken, July 30 2026) ---
// Export writes one file containing everything; Import replaces everything from
// one. On Windows this is a convenience over the visible data folder; on a tablet,
// where the data folder is private to the browser, it is the ONLY way to back up
// or move data — and the safety net for the measured fact that a browser tab is
// refused persistent storage, so site data can be evicted after 7 days of non-use.
function setBackupStatus(msg) {
    const el = document.getElementById('backupStatus');
    if (el) el.textContent = msg || '';
}

// Restore from the text of a backup file, wherever it came from — the folder list
// or the file picker. Both routes must confirm identically, because both replace
// everything; keeping one implementation is what guarantees that.
async function importPackageText(text, sourceLabel) {
    let pkg;
    try {
        pkg = dataTransfer.parsePackage(text);
    } catch (err) {
        setBackupStatus(err.message);
        return;
    }
    // Show what's in the file BEFORE replacing anything — the user is about to
    // overwrite everything and a filename is not enough to judge by.
    const when = pkg.exportedAt ? new Date(pkg.exportedAt).toLocaleString() : 'an unknown date';
    if (!(await confirmDanger({
        title: 'Replace everything with this backup?',
        body: `${sourceLabel ? sourceLabel + '\n\n' : ''}This backup was made on ${when} and contains:\n\n• ` +
              dataTransfer.summarize(pkg).join('\n• ') +
              `\n\nImporting REPLACES what is on this device — your current About Me answers, people, Express Panel, starters and settings will be overwritten. Your API key is left alone. The app will reload afterwards.`,
        confirmLabel: 'Replace my data',
    }))) {
        setBackupStatus('Import canceled — nothing was changed.');
        return;
    }
    setBackupStatus('Importing…');
    try {
        const restored = await dataTransfer.applyPackage(pkg);
        if (restored.failed.length) {
            storage.logError('import', 'partial restore, failed: ' + restored.failed.join(', '));
        }
        location.reload();      // re-read every store exactly as at startup
    } catch (err) {
        storage.logError('import', err.message || String(err));
        setBackupStatus('Import failed: ' + (err.message || 'unknown error'));
    }
}

// Populate the list of backups sitting in <data folder>/backups/. Hidden entirely
// where the folder is the browser's private storage — there is no folder for the
// user to have put a file into, so an empty picker there would only puzzle them.
async function renderBackupList() {
    const row = document.getElementById('folderBackupRow');
    const select = document.getElementById('backupFileSelect');
    const restoreBtn = document.getElementById('restoreBackupBtn');
    if (!row || !select || !restoreBtn) return;

    if (!storage.hasVisibleDataFolder()) {
        row.hidden = true;
        return;
    }
    row.hidden = false;
    const backups = await storage.listBackups();
    if (!backups.length) {
        select.innerHTML = '<option value="">— No backups in your data folder yet —</option>';
        select.disabled = true;
        restoreBtn.disabled = true;
        return;
    }
    select.disabled = false;
    restoreBtn.disabled = false;
    // Date first (how the user thinks about a backup), then the filename — two
    // backups made in the same minute would otherwise read identically, and the
    // filename is also what they see if they open the folder themselves. Size is
    // there because a suspiciously small backup is worth noticing before restoring
    // from it.
    select.innerHTML = backups.map((b) => {
        const when = b.savedAt ? new Date(b.savedAt).toLocaleString() : 'unknown date';
        return `<option value="${b.name}">${when} — ${b.name} (${b.sizeKB} KB)</option>`;
    }).join('');
}

function wireBackupControls() {
    const fileInput = document.getElementById('importDataFile');

    document.getElementById('exportDataBtn').onclick = async () => {
        setBackupStatus('Preparing your backup…');
        try {
            // Where the user picked a real folder, the backup goes IN it — beside
            // the data it protects. Otherwise (a tablet's private storage, or no
            // folder at all) it leaves by the download/share path, which is then
            // the only way to get a file out of the app.
            if (storage.hasVisibleDataFolder()) {
                const { pkg, path } = await dataTransfer.savePackageToFolder(APP_VERSION);
                await renderBackupList();
                setBackupStatus(`Saved to your data folder as ${path} — ` +
                                dataTransfer.summarize(pkg).join(' · '));
            } else {
                const pkg = await dataTransfer.downloadPackage(APP_VERSION);
                setBackupStatus('Exported: ' + dataTransfer.summarize(pkg).join(' · '));
            }
        } catch (err) {
            storage.logError('export', err.message || String(err));
            setBackupStatus('Could not build the backup: ' + (err.message || 'unknown error'));
        }
    };

    document.getElementById('restoreBackupBtn').onclick = async () => {
        const name = document.getElementById('backupFileSelect').value;
        if (!name) return;
        setBackupStatus('Reading…');
        const text = await storage.readBackup(name);
        if (text === null) {
            setBackupStatus('Could not read that backup — it may have been moved or deleted.');
            await renderBackupList();
            return;
        }
        await importPackageText(text, `From your data folder: ${name}`);
    };

    // The picker needs a real user gesture, so the button just opens it; the work
    // happens on change.
    document.getElementById('importDataBtn').onclick = () => {
        setBackupStatus('');
        fileInput.value = '';       // so re-picking the SAME file still fires change
        fileInput.click();
    };

    fileInput.onchange = async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        await importPackageText(await file.text(), `From the file ${file.name}`);
    };

    renderBackupList();
}

async function renderSettingsProfiles() {
    const select = document.getElementById('settingsProfileSelect');
    const loadBtn = document.getElementById('loadSettingsProfileBtn');
    const delBtn = document.getElementById('deleteSettingsProfileBtn');
    const updBtn = document.getElementById('updateSettingsProfileBtn');
    const status = document.getElementById('settingsProfilesStatus');
    if (!select) return;
    // All three act on the SELECTED profile, so they are enabled and disabled
    // together — there is never a state where one is meaningful and another is not.
    const setActionsEnabled = (on) => {
        loadBtn.disabled = delBtn.disabled = updBtn.disabled = !on;
    };
    if (!storage.hasDataFolder()) {
        select.innerHTML = '<option value="">— Choose a data folder first —</option>';
        select.disabled = true;
        setActionsEnabled(false);
        return;
    }
    select.disabled = false;
    const names = await storage.listSettingsProfiles();
    if (!names.length) {
        select.innerHTML = '<option value="">— No saved profiles —</option>';
        setActionsEnabled(false);
        setProfileStatus('');
        return;
    }
    select.innerHTML = names.map((n) => `<option value="${n}">${n}</option>`).join('');
    setActionsEnabled(true);
    // Reflect the profile currently in effect (persisted across reloads) rather than
    // defaulting to the first name — so after a load/restart the picker shows what's
    // actually in use (Ken, July 12 2026).
    const active = storage.loadActiveSettingsProfile();
    if (active && names.includes(active)) {
        select.value = active;
        setProfileStatus(`In use: “${active}”.`);
    } else {
        setProfileStatus('');
    }
    void status;
}

function setProfileStatus(msg) {
    const status = document.getElementById('settingsProfilesStatus');
    if (status) status.textContent = msg || '';
}

// Format one exchange of a saved conversation log as a transcript line.
function transcriptLine(ex) {
    if (ex.role === 'partner') return `  partner: ${ex.cleanedTranscript || ex.rawTranscript || ''}`;
    if (ex.role === 'error') return `  [error: ${ex.context || ''}] ${ex.message || ''}`;
    return `  user: ${ex.selectedText || ''}`;
}

// Build the full bug report: for each conversation that had errors, its transcript
// (read back from the data folder, or the live in-memory turns for the current
// conversation) followed by that conversation's errors. This is what Copy puts on
// the clipboard so a report carries the conversation, not just the error (Ken).
/* Errors recorded in the saved conversations on disk, grouped like the in-app log.
 *
 * ⚠ THE TWO STORES DRIFT APART, AND THE REPORT USED TO BELIEVE ONLY ONE OF THEM. An
 * error is written to BOTH the browser's own list and the conversation's file, but
 * the browser's list is origin-scoped and is lost whenever browser storage is —
 * which the August 1 2026 web-address change did to every tester at once. A real
 * report then arrived saying "Errors recorded 7" in the usage summary and
 * "(no errors recorded)" three lines below it, from the same app, in the same file.
 *
 * The damage is not the contradiction, it is that transcripts hang off this list:
 * an empty list attaches NO transcript, so the one thing that could explain the
 * complaint is missing exactly when the tester needed it most. Falling back to disk
 * recovers both, because that is where the errors and the transcripts already are.
 */
async function errorsFromDisk() {
    const groups = new Map();
    let logs = [];
    try { logs = await storage.listConversationLogs(); } catch { return []; }
    for (const { id, data } of logs) {
        const errs = ((data && data.exchanges) || []).filter(e => e && e.role === 'error');
        if (!errs.length) continue;
        groups.set(id, errs.map(e => ({
            ts: e.ts || e.time || '?', version: e.version, context: e.context, message: e.message, extra: e.extra,
        })));
    }
    return [...groups.keys()].sort().reverse().map(id => [id, groups.get(id)]);
}

async function buildErrorReport() {
    let groups = groupErrorsByConversation();
    // Nothing in the browser's list is not the same as nothing having gone wrong.
    let fromDisk = false;
    if (!groups.length) {
        groups = await errorsFromDisk();
        fromDisk = groups.length > 0;
    }
    const out = [
        'Conversant AAC — error report',
        `App version: ${APP_VERSION}`,
        `Generated: ${new Date().toISOString()}`,
        '',
    ];
    if (!groups.length) { out.push('(no errors recorded)'); return out.join('\n'); }
    if (fromDisk) {
        // Say where these came from. The in-app error list being empty while the
        // saved conversations are not is itself worth knowing when reading a report.
        out.push('(read from the saved conversations - the in-app error list was empty,',
                 ' which usually means browser storage was cleared or the app changed address)', '');
    }

    for (const [id, errs] of groups) {
        out.push(`════════ Conversation ${id} ════════`);
        const convLog = id !== '(none)' ? await storage.readConversationLog(id) : null;
        if (convLog && convLog.exchanges && convLog.exchanges.length) {
            out.push(`Started: ${convLog.started || '?'}`);
            out.push('Transcript:');
            for (const ex of convLog.exchanges) out.push(transcriptLine(ex));
        } else if (id === storage.getConversationId() && !storage.isConversationSaving()) {
            // The current conversation is private ("Don't save this conversation"),
            // so nothing was written to disk on purpose — don't leak the live turns
            // into the bug report either (SEC-2).
            out.push('Transcript: [private conversation — transcript withheld]');
        } else if (id === storage.getConversationId() && conversationHistory.length) {
            // The current conversation may not be fully on disk yet (an error can
            // fire before the turn is committed) — fall back to the live turns.
            out.push('Transcript (live — this conversation is still open):');
            for (const t of conversationHistory) out.push(`  ${t.role}: ${t.text}`);
        } else {
            out.push('Transcript: [not available — no data folder, or the conversation was not saved]');
        }
        out.push('', `Errors (${errs.length}):`);
        for (const e of errs) {
            out.push(`  ${e.ts} v${e.version || '?'} [${e.context}] ${e.message}` + (e.extra ? ` | ${JSON.stringify(e.extra)}` : ''));
        }
        out.push('');
    }
    return out.join('\n');
}

function openSettings() {
    const dialog = document.getElementById('settingsDialog');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const voiceSelect = document.getElementById('voiceSelect');
    const silenceThresholdInput = document.getElementById('silenceThresholdInput');
    const autoRelistenInput = document.getElementById('autoRelistenInput');
    const listenChimeInput = document.getElementById('listenChimeInput');
    const initialDelayInput = document.getElementById('initialDelayInput');
    const subsequentDelayInput = document.getElementById('subsequentDelayInput');
    const maxPlaceholdersInput = document.getElementById('maxPlaceholdersInput');
    const responsesPerCategoryInput = document.getElementById('responsesPerCategoryInput');
    const cardTextModeInput = document.getElementById('cardTextModeInput');
    const commandLabelsInput = document.getElementById('commandLabelsInput');
    const choiceChipMaxInput = document.getElementById('choiceChipMaxInput');

    showRedactedKey(apiKeyInput, storage.loadApiKey());
    populateVoiceSelect();
    populatePartnerVoiceSelect();
    silenceThresholdInput.value = storage.loadSilenceThreshold();
    autoRelistenInput.checked = storage.loadAutoRelisten();
    listenChimeInput.checked = storage.loadListenChime();
    responsesPerCategoryInput.value = storage.loadResponsesPerCategory();
    cardTextModeInput.value = storage.loadCardTextMode();
    commandLabelsInput.value = storage.loadCommandLabels();
    choiceChipMaxInput.value = storage.loadChoiceChipMax();
    const keyboardMode = storage.loadKeyboardMode();
    const keyboardRadio = document.querySelector(`input[name="keyboardMode"][value="${keyboardMode}"]`);
    if (keyboardRadio) keyboardRadio.checked = true;
    const bottomLayoutSelect = document.getElementById('bottomLayoutSelect');
    const sideLayoutSelect = document.getElementById('sideLayoutSelect');
    const sideDockPositionToggle = document.getElementById('sideDockPositionToggle');
    fillLayoutSelect(bottomLayoutSelect, BOTTOM_LAYOUTS, storage.loadBottomLayout());
    fillLayoutSelect(sideLayoutSelect, SIDE_LAYOUTS, storage.loadSideLayout());
    sideDockPositionToggle.checked = storage.loadSideDockPosition() === 'right';
    // Keyboard dock (side/bottom) — one choice for every typing context.
    const dockRadio = document.querySelector(`input[name="keyboardDock"][value="${storage.loadKeyboardDock()}"]`);
    if (dockRadio) dockRadio.checked = true;
    updateKeyboardPositionGroups();
    updateUsageDisplay();
    const placeholderSettings = storage.loadPlaceholderSettings();
    initialDelayInput.value = placeholderSettings.initialDelay;
    subsequentDelayInput.value = placeholderSettings.subsequentDelay;
    maxPlaceholdersInput.value = placeholderSettings.maxPlaceholders;
    // Express Panel tap controls (no set selector — one list, always shown).
    const doubleTapMsSelect = document.getElementById('doubleTapMsSelect');
    const tapMode = storage.loadExpressTapMode();
    const tapRadio = document.querySelector(`input[name="expressTapMode"][value="${tapMode}"]`);
    if (tapRadio) tapRadio.checked = true;
    doubleTapMsSelect.value = storage.loadDoubleTapMs();
    reflectBandSizes();
    // Button sizing sliders (unitless 0–100).
    const buttonSizeSlider = document.getElementById('buttonSizeSlider');
    const buttonGapSlider = document.getElementById('buttonGapSlider');
    const minGapSlider = document.getElementById('minGapSlider');
    const dockSepSlider = document.getElementById('dockSepSlider');
    const appMarginSlider = document.getElementById('appMarginSlider');
    const transcriptSepSlider = document.getElementById('transcriptSepSlider');
    buttonSizeSlider.value = storage.loadButtonSizePos();
    buttonGapSlider.value = storage.loadButtonGapPos();
    minGapSlider.value = storage.loadMinGapPos();
    dockSepSlider.value = storage.loadDockSepPos();
    appMarginSlider.value = storage.loadAppMarginPos();
    transcriptSepSlider.value = storage.loadTranscriptSepPos();
    // Text-size selects (string-valued multipliers).
    const transcriptFontSelect = document.getElementById('transcriptFontSelect');
    const composerFontSelect = document.getElementById('composerFontSelect');
    const expressFontSelect = document.getElementById('expressFontSelect');
    const responseFontSelect = document.getElementById('responseFontSelect');
    const hintFontSelect = document.getElementById('hintFontSelect');
    transcriptFontSelect.value = String(storage.loadTranscriptFontScale());
    composerFontSelect.value = String(storage.loadComposerFontScale());
    expressFontSelect.value = String(storage.loadExpressFontScale());
    responseFontSelect.value = String(storage.loadResponseFontScale());
    hintFontSelect.value = String(storage.loadHintFontScale());
    // Conversation privacy default (the Command Bar "Don't save" button overrides
    // it live for the current conversation).
    const noSaveDefaultInput = document.getElementById('noSaveDefaultInput');
    noSaveDefaultInput.checked = storage.loadNoSaveDefault();
    noSaveDefaultInput.onchange = () => storage.saveNoSaveDefault(noSaveDefaultInput.checked);
    // Use the whole screen. Applying it here, in the change handler, is what makes
    // the toggle the way BACK IN too: tapping it is a user gesture, so a user who
    // has left fullscreen (Esc, or the browser dropping it) can restore it without
    // relaunching — Start having already been consumed.
    // Not offered on WebKit — no effect in a Home Screen app, and it breaks Settings
    // and the Listen button in a Safari tab. See requestAppFullscreen, which refuses
    // there too, so a stored `true` is inert rather than stranded behind a hidden control.
    const fullscreenInput = document.getElementById('fullscreenInput');
    document.getElementById('fullscreenGroup').hidden = platform.isIOS();
    fullscreenInput.checked = storage.loadFullscreen();
    fullscreenInput.onchange = () => {
        storage.saveFullscreen(fullscreenInput.checked);
        if (fullscreenInput.checked) requestAppFullscreen();
        else exitAppFullscreen();
    };
    reflectTitleBarNeed();
    updateFolderDisplay();

    // Reset to General tab (keep the roving tabindex + aria-selected in sync).
    // This bypasses handleSettingsTab, so put the panel back in the dock explicitly
    // — otherwise a close path that missed it would strand the panel in a hidden
    // dialog and the dock would open empty.
    hostExpressPanel(false);
    document.querySelectorAll('#settingsTabs .settings-tab').forEach(t => {
        const on = t.dataset.tab === 'general';
        t.classList.toggle('active', on);
        t.tabIndex = on ? 0 : -1;
        t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('#settingsContent .tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.tab-panel[data-tab="general"]').classList.add('active');

    dialog.showModal();
    // Park focus on the (non-input) header so the dialog doesn't autofocus the
    // API-key field — which would pop the on-screen keyboard on open and race
    // with tab switches. The keyboard then appears only when a field or a
    // layout setting is tapped.
    document.getElementById('settingsHeader')?.focus();
    // The default (General) tab is shown without going through activateSettingsTab,
    // so its sections are built here. Every other tab is built when first visited.
    makeGroupsCollapsible(document.querySelector('.tab-panel[data-tab="general"]'));

    document.getElementById('pickFolderBtn').onclick = async () => {
        try {
            await storage.pickDataFolder();
            await adoptDataFolder();
        } catch (err) {
            if (err.name !== 'AbortError') {
                ui.setStatus(`Folder error: ${err.message}`);
            }
        }
    };

    document.getElementById('resetUsageBtn').onclick = () => {
        storage.resetUsage();
        updateUsageDisplay();
    };

    // Reload the app (About tab) — a keyboard-free equivalent of Ctrl+Shift+R for a
    // tablet with no keyboard attached (Ken, July 2026). Refreshes the service
    // worker and clears its caches so the reload re-fetches the latest code from
    // the network instead of an offline copy. Not destructive: committed exchanges
    // are already logged to disk; only the on-screen (uncommitted) state resets.
    document.getElementById('reloadAppBtn').onclick = async () => {
        ui.setStatus('Reloading the app…');
        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg) await reg.update();
            }
            if (window.caches && caches.keys) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
            }
        } catch { /* best effort — reload anyway */ }
        location.reload();
    };

    // Error log viewer (About tab) — populate now (Settings just opened) so Ken can
    // read what failed without a keyboard/devtools; Copy for a bug report, Clear to
    // reset the in-app view (the data-folder errors.log stays as the permanent record).
    renderErrorLog();
    document.getElementById('copyErrorLogBtn').onclick = async () => {
        const btn = document.getElementById('copyErrorLogBtn');
        try {
            await navigator.clipboard.writeText(await buildErrorReport());
            const orig = btn.textContent; btn.textContent = 'Copied ✓';
            setTimeout(() => { btn.textContent = orig; }, 1500);
        } catch { /* clipboard blocked/denied */ }
    };
    document.getElementById('clearErrorLogBtn').onclick = async () => {
        if (!(await confirmDanger({
            title: 'Clear the error log?',
            body: 'This clears the in-app error list. The errors.log file in your data folder is kept.',
            confirmLabel: 'Clear',
        }))) return;
        storage.clearErrorLog();
        renderErrorLog();
    };

    // --- Troubleshooting tab (Ken, August 7 2026) ---
    const flash = (btn, word = 'Copied ✓') => {
        const orig = btn.textContent;
        btn.textContent = word;
        setTimeout(() => { btn.textContent = orig; }, 1500);
    };
    const copyFrom = (btnId, getText) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.onclick = async () => {
            try { await navigator.clipboard.writeText(await getText()); flash(btn); }
            catch { flash(btn, 'Copy blocked'); }
        };
    };
    // Known issues — a page, not a bundled copy (Ken, August 9 2026). Opened in a
    // new tab so the app is never navigated away from: on an installed app that
    // hands off to the browser and leaves the conversation screen exactly as it was.
    const knownIssuesBtn = document.getElementById('knownIssuesBtn');
    if (knownIssuesBtn) knownIssuesBtn.onclick = () => {
        window.open(KNOWN_ISSUES_URL, '_blank', 'noopener');
    };
    copyFrom('copyUsageSummaryBtn', () => document.getElementById('usageSummaryView').value);
    copyFrom('copySystemInfoBtn', () => document.getElementById('systemInfoView').value);
    const refreshBtn = document.getElementById('refreshUsageSummaryBtn');
    if (refreshBtn) refreshBtn.onclick = () => renderTroubleshooting();
    const sendReportBtn = document.getElementById('sendProblemReportBtn');
    if (sendReportBtn) sendReportBtn.onclick = () => sendProblemReport();
    const clearNoteBtn = document.getElementById('clearProblemNoteBtn');
    if (clearNoteBtn) clearNoteBtn.onclick = async () => {
        const box = document.getElementById('problemNoteInput');
        if (!box || !box.value.trim()) return;   // nothing to lose, so nothing to ask
        // ⚠ CONFIRMED, because for this population a typed report IS significant work:
        // composing it may have taken minutes on the on-screen keyboard, and there is
        // no undo on a textarea the app has emptied. The standing rule is that anything
        // which can wipe away significant work asks first, through the red danger card
        // rather than the browser's own dialog (which reads as routine and gets
        // dismissed on autopilot).
        if (!(await confirmDanger({
            title: 'Clear what you have written?',
            body: 'This deletes the description you typed. It cannot be undone.',
            confirmLabel: 'Clear it',
            cancelLabel: 'Keep it',
        }))) return;
        box.value = '';
        box.focus();
    };
    const testerNameInput = document.getElementById('testerNameInput');
    if (testerNameInput) testerNameInput.oninput = () => {
        storage.saveTesterName(testerNameInput.value);
        const status = document.getElementById('testerNameStatus');
        if (status) status.textContent = testerNameInput.value.trim() ? '' : 'Not set — reports will not say who they are from.';
    };
    const weeklyEnabledInput = document.getElementById('weeklySendEnabledInput');
    if (weeklyEnabledInput) weeklyEnabledInput.onchange = () => {
        storage.saveWeeklySendEnabled(weeklyEnabledInput.checked);
        // The same switch governs COUNTING, not just sending. A tester who turns
        // reporting off and still has every tap written to metrics.log has been
        // misled about what the switch does, and it is the one switch in the app
        // whose whole purpose is to be believed.
        metrics.setEnabled(weeklyEnabledInput.checked);
    };

    // Settings profiles (About tab) — save the whole settings bundle to the data
    // folder under a name, and re-apply it later. Populate the picker now.
    renderSettingsProfiles();
    setProfileStatus('');
    const profileNameInput = document.getElementById('settingsProfileNameInput');
    const profileSelect = document.getElementById('settingsProfileSelect');
    const saveCurrentProfile = async () => {
        const name = profileNameInput.value;
        try {
            if (await storage.settingsProfileExists(name)) {
                if (!(await confirmDanger({
                    title: 'Overwrite that profile?',
                    body: `A settings profile named "${name.trim()}" already exists. Replace it with your current settings?`,
                    confirmLabel: 'Overwrite',
                }))) return;
            }
            const saved = await storage.saveSettingsProfile(name);
            // The just-saved profile now matches the current settings — mark it active
            // so the picker reflects it (here and after a reload).
            storage.saveActiveSettingsProfile(saved);
            profileNameInput.value = '';
            await renderSettingsProfiles();
            profileSelect.value = saved;
            setProfileStatus(`Saved “${saved}”. In use: “${saved}”.`);
        } catch (err) {
            setProfileStatus(err.message || 'Could not save the profile.');
        }
    };
    document.getElementById('saveSettingsProfileBtn').onclick = saveCurrentProfile;
    // Enter in the name box saves the current settings under that name (Ken).
    profileNameInput.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveCurrentProfile(); }
    };
    document.getElementById('loadSettingsProfileBtn').onclick = async () => {
        const name = profileSelect.value;
        if (!name) return;
        if (!(await confirmDanger({
            title: 'Load these settings?',
            body: `This replaces all of your current settings with the “${name}” profile, then reloads the app. Your API key stays as it is.`,
            confirmLabel: 'Load',
        }))) return;
        try {
            await storage.applySettingsProfile(name);
            // Record which profile is now in effect (written after the merge, since
            // it's an excluded key) so the picker reflects it after the reload.
            storage.saveActiveSettingsProfile(name);
            location.reload(); // re-apply every setting exactly as at startup
        } catch (err) {
            setProfileStatus(err.message || 'Could not load the profile.');
        }
    };
    // Overwrite the SELECTED profile with the settings currently in effect. This is
    // the counterpart to Load: tweak a setting, then put the change back where it
    // came from. Confirmed because it destroys the profile's previous contents —
    // the same bar Save-over-an-existing-name already meets.
    document.getElementById('updateSettingsProfileBtn').onclick = async () => {
        const name = profileSelect.value;
        if (!name) return;
        if (!(await confirmDanger({
            title: 'Replace that profile?',
            body: `Replace the “${name}” profile with your current settings? Whatever it holds now is lost.`,
            confirmLabel: 'Replace',
        }))) return;
        try {
            const saved = await storage.saveSettingsProfile(name);
            // It now matches the live settings, so it is the profile in effect.
            storage.saveActiveSettingsProfile(saved);
            await renderSettingsProfiles();
            profileSelect.value = saved;
            setProfileStatus(`Updated “${saved}”. In use: “${saved}”.`);
        } catch (err) {
            setProfileStatus(err.message || 'Could not update the profile.');
        }
    };
    document.getElementById('deleteSettingsProfileBtn').onclick = async () => {
        const name = profileSelect.value;
        if (!name) return;
        if (!(await confirmDanger({
            title: 'Delete this profile?',
            body: `Delete the settings profile “${name}”? This removes its file from your data folder.`,
            confirmLabel: 'Delete',
        }))) return;
        await storage.deleteSettingsProfile(name);
        // If the deleted profile was the one in effect, forget the pointer (the live
        // settings are unchanged; they're just no longer "named").
        if (storage.loadActiveSettingsProfile() === name) storage.saveActiveSettingsProfile('');
        await renderSettingsProfiles();
        setProfileStatus(`Deleted “${name}”.`);
    };

    wireBackupControls();

    document.getElementById('makeStorageDurableBtn').onclick = async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        const granted = await storage.requestPersistentStorage();
        btn.disabled = false;
        if (!granted) {
            // A refusal is not an error to hide. On a tablet this is the difference
            // between data that survives and data that does not, and the honest
            // answer is that the browser said no and a backup is now the real
            // protection — measured behavior in a Safari tab, July 30 2026.
            const el = document.getElementById('storageDurabilityStatus');
            el.textContent = 'The browser declined. It may erase this data after about a week without use — ' +
                'export a backup below and keep it somewhere safe. Installing the app to your Home Screen ' +
                'usually gets the promise granted.';
            el.className = 'setting-hint storage-warn';
            btn.hidden = true;
            return;
        }
        updateStorageDurability(true);
    };

    document.getElementById('generateOpeningsBtn').onclick = generateScreenOpenings;

    document.getElementById('testVoiceBtn').onclick = () => {
        tts.setVoice(voiceSelect.value || null);
        tts.speak('This is how I will sound during our conversation.');
    };

    // Test the practice partner's voice. This works for "Auto" too: Auto is not
    // random — pickPartnerVoice takes the first voice that is not the user's own —
    // so it can be resolved here and demonstrated exactly. That matters because
    // Auto is the DEFAULT, and a Test button that refused the default would leave
    // the common case unhearable. The resolved name is shown for Auto, since
    // otherwise the user has no way to know what they just heard.
    // NOTE: read the element here rather than using the `partnerVoiceSelect` const,
    // which is declared further down this function — referencing it now would hit
    // the temporal dead zone the moment the change listener below is attached.
    const partnerVoiceEl = document.getElementById('partnerVoiceSelect');
    document.getElementById('testPartnerVoiceBtn').onclick = () => {
        const status = document.getElementById('partnerVoiceStatus');
        const isAuto = !partnerVoiceEl.value;
        const uri = pickPartnerVoice(partnerVoiceEl.value);
        // The one case Auto genuinely cannot satisfy: a device with a single voice
        // has no other to fall back to, so the partner would sound exactly like the
        // user. Say so rather than playing an identical voice and looking broken.
        if (isAuto && !uri) {
            status.textContent = 'This device only offers one voice, so the other person ' +
                'will sound exactly like you. Practice still works.';
            status.hidden = false;
            return;
        }
        if (isAuto) {
            const v = tts.getVoices().find(x => x.voiceURI === uri);
            status.textContent = `Auto chose ${v ? v.name : 'another voice'}.`;
            status.hidden = false;
        } else {
            status.hidden = true;
        }
        tts.speak('Hello — in Practice Mode, this is the voice of the person you are talking to.',
            { voiceURI: uri });
    };
    // A changed selection makes any previously-reported Auto choice stale.
    partnerVoiceEl.addEventListener('change', () => {
        document.getElementById('partnerVoiceStatus').hidden = true;
    });

    // No Save button (Ken, June 14 2026): every control applies AND persists
    // immediately, so Settings doubles as a live test bench (e.g. trying the
    // side-dock keyboard layouts). Close just dismisses the panel.
    wireKeyField(apiKeyInput, {
        load: () => storage.loadApiKey() || '',
        save: (key) => { llm.setApiKey(key); storage.saveApiKey(key); },
        onChange: () => reflectApiKeyFormat(),   // red warning if it looks malformed
    });
    reflectApiKeyFormat();          // reflect the current saved value on open
    // Paste button beside the API-key field — replaces the keyboard's removed
    // clipboard toolbar as the way to paste a long `sk-ant-…` key.
    // Every outcome is reported. Reading the clipboard is not a plain function
    // call on every platform: Safari answers it by putting up its own "Paste"
    // confirmation that the user has to tap, and rejects if they don't. Swallowing
    // that silently made this look like a dead button on an iPad while the OS's
    // own touch-and-hold Paste worked fine (Ken, July 30 2026) — so a refusal now
    // names the alternative instead of leaving the user with nothing.
    document.getElementById('pasteApiKeyBtn').onclick = async () => {
        try {
            const text = (await navigator.clipboard.readText())?.trim();
            if (!text) {
                showApiKeyStatus('warn', 'The clipboard is empty — copy your key first.');
                return;
            }
            setKeyFieldValue(apiKeyInput, text);
            // The input handler runs the format check, which reports on its own if
            // what was pasted doesn't look like a key.
        } catch {
            showApiKeyStatus('warn',
                'Could not read the clipboard. Touch and hold the box above, then choose Paste.');
        }
    };
    // Test button — the only way to catch a subtly-wrong key (right format, wrong
    // characters). Verifies against the API (GET /v1/models, bills no tokens).
    document.getElementById('testApiKeyBtn').onclick = async () => {
        const key = keyFieldValue(apiKeyInput) ?? (storage.loadApiKey() || '');
        if (!key) { showApiKeyStatus('warn', 'Enter your key first, then tap Test.'); return; }
        const btn = document.getElementById('testApiKeyBtn');
        btn.disabled = true;
        showApiKeyStatus('checking', 'Checking your key…');
        const res = await llm.testApiKey(key);
        btn.disabled = false;
        if (res.ok) showApiKeyStatus('ok', '✓ Your key is working.');
        else if (res.reason === 'rejected') showApiKeyStatus('warn', '✗ The key was rejected — check you copied all of it, including the end.');
        else if (res.reason === 'empty') showApiKeyStatus('warn', 'Enter your key first, then tap Test.');
        else showApiKeyStatus('warn', "Couldn't reach the service — check your internet connection and try again.");
    };
    // --- Transcription backend (Ken, July 30 2026) ---------------------------
    // Changing the provider or the key needs a reload, because stt.init() builds
    // the capture source once at startup. Say so plainly rather than leaving the
    // user to wonder why the setting appears to do nothing until next time.
    const deepgramKeyInput = document.getElementById('deepgramKeyInput');
    const reflectSttProvider = () => {
        const provider = storage.loadSttProvider();
        const radio = document.querySelector(`input[name="sttProvider"][value="${provider}"]`);
        if (radio) radio.checked = true;
        // The key field itself is always on screen (it is shared with the voice
        // choice below); only what this costs is conditional.
    };
    wireKeyField(deepgramKeyInput, {
        load: () => storage.loadDeepgramKey() || '',
        save: (key) => storage.saveDeepgramKey(key),
    });
    reflectSttProvider();
    document.querySelectorAll('input[name="sttProvider"]').forEach((radio) => {
        radio.onchange = () => {
            if (!radio.checked) return;
            storage.saveSttProvider(radio.value);
            reflectSttProvider();
            showDeepgramStatus('ok', 'Saved. Reload the app (About → Reload the app) to start using it.');
        };
    });
    const pasteDeepgramBtn = document.getElementById('pasteDeepgramKeyBtn');
    if (pasteDeepgramBtn) {
        pasteDeepgramBtn.onclick = async () => {
            try {
                const text = (await navigator.clipboard.readText())?.trim();
                if (!text) { showDeepgramStatus('warn', 'The clipboard is empty — copy your key first.'); return; }
                setKeyFieldValue(deepgramKeyInput, text);
                showDeepgramStatus(null, '');
            } catch {
                showDeepgramStatus('warn', 'Could not read the clipboard. Touch and hold the box above, then choose Paste.');
            }
        };
    }
    const testDeepgramBtn = document.getElementById('testDeepgramKeyBtn');
    if (testDeepgramBtn) {
        // Opens the streaming socket and closes it again: it authenticates the key
        // without sending audio, so it bills nothing.
        testDeepgramBtn.onclick = async () => {
            const key = keyFieldValue(deepgramKeyInput) ?? (storage.loadDeepgramKey() || '');
            if (!key) { showDeepgramStatus('warn', 'Enter your key first, then tap Test.'); return; }
            testDeepgramBtn.disabled = true;
            showDeepgramStatus('checking', 'Checking your key…');
            const res = await sttDeepgram.testKey(key);
            testDeepgramBtn.disabled = false;
            showDeepgramStatus(res.ok ? 'ok' : 'warn', res.message);
        };
    }

    // --- Deepgram voice (Aura) ---
    // Unlike the transcription provider, this one takes effect immediately: tts.js
    // routes per utterance rather than building a source once at startup, so there
    // is nothing to reload.
    const auraVoiceSelect = document.getElementById('auraVoiceSelect');
    const auraPartnerVoiceSelect = document.getElementById('auraPartnerVoiceSelect');
    const fillAuraSelect = (select, selected, autoLabel) => {
        if (!select) return;
        select.innerHTML = '';
        if (autoLabel) {
            const auto = document.createElement('option');
            auto.value = '';
            auto.textContent = autoLabel;
            select.appendChild(auto);
        }
        ttsDeepgram.VOICES.forEach((v) => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = `${v.name} — ${v.detail}`;
            if (v.id === selected) opt.selected = true;
            select.appendChild(opt);
        });
    };
    // Swap BOTH voice pickers — the user's own and the Practice partner's — to the
    // chosen backend. The partner follows the same service rather than being a
    // third choice: mixing a device voice against a Deepgram one is a combination
    // nobody asked for, and it would double the pickers on screen again.
    const reflectTtsProvider = () => {
        const provider = storage.loadTtsProvider();
        const aura = provider === 'deepgram';
        const radio = document.querySelector(`input[name="ttsProvider"][value="${provider}"]`);
        if (radio) radio.checked = true;
        const show = (id, on) => {
            const el = document.getElementById(id);
            if (el) el.hidden = !on;
        };
        show('auraRow', aura);
        show('auraPartnerRow', aura);
        show('builtinVoiceRow', !aura);
        show('builtinPartnerVoiceRow', !aura);
    };
    fillAuraSelect(auraVoiceSelect, storage.loadAuraVoice() || ttsDeepgram.DEFAULT_VOICE);
    fillAuraSelect(auraPartnerVoiceSelect, storage.loadAuraPartnerVoice(), 'Auto (a voice that isn\'t yours)');
    reflectTtsProvider();
    document.querySelectorAll('input[name="ttsProvider"]').forEach((radio) => {
        radio.onchange = () => {
            if (!radio.checked) return;
            storage.saveTtsProvider(radio.value);
            reflectTtsProvider();
            applyTtsProvider();
            if (radio.value === 'deepgram' && !(storage.loadDeepgramKey() || '').trim()) {
                showAuraStatus('own', 'warn', 'Add your Deepgram key above, then tap Test this voice.');
            } else {
                showAuraStatus('own', null, '');
            }
        };
    });
    if (auraVoiceSelect) {
        auraVoiceSelect.onchange = () => {
            storage.saveAuraVoice(auraVoiceSelect.value);
            tts.setAuraModel(auraVoiceSelect.value);
            showAuraStatus('own', null, '');
        };
    }
    if (auraPartnerVoiceSelect) {
        auraPartnerVoiceSelect.onchange = () => {
            storage.saveAuraPartnerVoice(auraPartnerVoiceSelect.value);
            showAuraStatus('partner', null, '');
        };
    }
    // Test SPEAKS rather than just checking the key: a rejected key, a mistyped
    // voice id and a browser that will not start audio all fail differently, and
    // hearing it is the only check that covers all three. It is also a user gesture,
    // which is what unlocks audio on iOS.
    const wireAuraTest = (btn, which, getModel, phrase) => {
        if (!btn) return;
        btn.onclick = async () => {
            tts.unlockAudio();
            const key = (keyFieldValue(deepgramKeyInput) ?? (storage.loadDeepgramKey() || '')).trim();
            if (!key) { showAuraStatus(which, 'warn', 'Enter your Deepgram key above first.'); return; }
            btn.disabled = true;
            showAuraStatus(which, 'checking', 'Speaking…');
            const res = await tts.testAuraVoice(key, getModel(), phrase);
            btn.disabled = false;
            showAuraStatus(which, res.ok ? 'ok' : 'warn', res.message);
        };
    };
    wireAuraTest(document.getElementById('testAuraVoiceBtn'), 'own',
        () => (auraVoiceSelect && auraVoiceSelect.value) || ttsDeepgram.DEFAULT_VOICE,
        'This is how I will sound during our conversation.');
    wireAuraTest(document.getElementById('testAuraPartnerVoiceBtn'), 'partner',
        () => pickAuraPartnerVoice(auraPartnerVoiceSelect && auraPartnerVoiceSelect.value),
        'Hello — in Practice Mode, this is the voice of the person you are talking to.');

    const showNoveltyInput = document.getElementById('showNoveltyVoicesInput');
    if (showNoveltyInput) {
        showNoveltyInput.checked = storage.loadShowNoveltyVoices();
        showNoveltyInput.onchange = () => {
            storage.saveShowNoveltyVoices(showNoveltyInput.checked);
            // Repopulate both pickers immediately: a setting whose effect you have to
            // reopen Settings to see reads as a setting that did nothing.
            populateVoiceSelect();
            populatePartnerVoiceSelect();
        };
    }

    voiceSelect.onchange = () => {
        const voiceURI = voiceSelect.value || null;
        tts.setVoice(voiceURI);
        storage.saveVoiceURI(voiceURI);
    };
    const partnerVoiceSelect = document.getElementById('partnerVoiceSelect');
    if (partnerVoiceSelect) {
        partnerVoiceSelect.onchange = () => storage.savePartnerVoice(partnerVoiceSelect.value || '');
    }
    silenceThresholdInput.onchange = () => {
        const threshold = Number(silenceThresholdInput.value);
        stt.setSilenceThreshold(threshold);
        storage.saveSilenceThreshold(threshold);
    };
    autoRelistenInput.onchange = () => {
        storage.saveAutoRelisten(autoRelistenInput.checked);
        // Auto-resume decides whether the chime is per-conversation or per-start.
        chime.setOncePerConversation(autoRelistenInput.checked);
    };
    listenChimeInput.onchange = () => {
        storage.saveListenChime(listenChimeInput.checked);
        chime.setEnabled(listenChimeInput.checked);
    };
    responsesPerCategoryInput.onchange = () => {
        const n = Number(responsesPerCategoryInput.value);
        storage.saveResponsesPerCategory(n);
        ui.setRegenerateLabel((n === 2 ? 2 : 1) * 4); // "New 4" ↔ "New 8"
        ui.setCardsPerCategory(n);
        clearPalette(); // re-render the reserved footprint (4 vs 8 slots)
    };
    cardTextModeInput.onchange = () => {
        storage.saveCardTextMode(cardTextModeInput.value);
        // Purely a re-style of the cards already on screen -- no regeneration, so a
        // user can flip through the four modes mid-conversation and see the real
        // suggestions in each without spending a round trip or losing the palette.
        ui.setCardTextMode(cardTextModeInput.value);
    };
    commandLabelsInput.onchange = () => {
        storage.saveCommandLabels(commandLabelsInput.value);
        // Re-draws the bar behind Settings straight away, so the user can see the
        // change without closing the panel. Geometry is identical in both modes, so
        // nothing re-solves and no keyguard hole moves.
        ui.setCommandLabelMode(commandLabelsInput.value);
        applyListenAvailability();   // keeps a disabled Listen button's explanation
    };
    choiceChipMaxInput.onchange = () => {
        storage.saveChoiceChipMax(choiceChipMaxInput.value);
        renderExpressPanel();
    };
    document.querySelectorAll('input[name="keyboardMode"]').forEach(radio => {
        radio.onchange = () => {
            const mode = document.querySelector('input[name="keyboardMode"]:checked')?.value || 'physical';
            keyboard.setMode(mode);
            storage.saveKeyboardMode(mode);
            // Reflect the change in the live preview on the Speech & Input tab.
            handleSettingsTab(document.querySelector('#settingsTabs .settings-tab.active')?.dataset.tab);
        };
    });
    // Tapping (or focusing, or changing) a keyboard-layout control previews
    // that dock — and shows the keyboard if it's currently hidden (e.g. after
    // Hide). CLICK, not pointerdown: showing the keyboard resizes the Settings
    // panel (it sits clear of the dock), and moving a <select> out from under a
    // finger that is still down makes WebKit abandon the tap — so on an iPad the
    // native picker never opened at all (Ken, July 30 2026). click still covers
    // the case pointerdown was chosen for in v0.2.19, re-tapping an
    // already-focused control where no focus event fires, but arrives after the
    // picker is up. The selects also re-render so the choice shows live.
    const previewBottom = () => keyboard.previewShow('bottom');
    const previewSide = () => keyboard.previewShow('side');
    bottomLayoutSelect.onclick = bottomLayoutSelect.onfocus = previewBottom;
    bottomLayoutSelect.onchange = () => {
        keyboard.setBottomLayout(bottomLayoutSelect.value);
        storage.saveBottomLayout(bottomLayoutSelect.value);
        renderExpressPanel(); // the panel mirrors the layout
        keyboard.previewShow('bottom');
    };
    sideLayoutSelect.onclick = sideLayoutSelect.onfocus = previewSide;
    sideLayoutSelect.onchange = () => {
        keyboard.setSideLayout(sideLayoutSelect.value);
        storage.saveSideLayout(sideLayoutSelect.value);
        renderExpressPanel();
        keyboard.previewShow('side');
    };
    sideDockPositionToggle.onclick = sideDockPositionToggle.onfocus = previewSide;
    sideDockPositionToggle.onchange = () => {
        const pos = sideDockPositionToggle.checked ? 'right' : 'left';
        keyboard.setSideDockPosition(pos);
        storage.saveSideDockPosition(pos);
        applyConversationDockClasses();
        keyboard.previewShow('side');
    };
    // Keyboard dock (side/bottom): the single choice. Persist, apply, show/hide
    // the dock-specific groups, and preview the chosen dock.
    document.querySelectorAll('input[name="keyboardDock"]').forEach((radio) => {
        radio.onchange = () => {
            const dock = document.querySelector('input[name="keyboardDock"]:checked')?.value || 'bottom';
            storage.saveKeyboardDock(dock);
            keyboard.setKeyboardDock(dock);
            updateKeyboardPositionGroups();
            applyConversationDockClasses(); // move the dock area + re-pick 2×2/1×4
            renderExpressPanel();        // mirror the now-current dock's layout
            if (storage.loadKeyboardMode() === 'onscreen') keyboard.previewShow(dock);
        };
    });
    const persistPlaceholders = () => storage.savePlaceholderSettings(
        Number(initialDelayInput.value),
        Number(subsequentDelayInput.value),
        Number(maxPlaceholdersInput.value)
    );
    initialDelayInput.onchange = persistPlaceholders;
    subsequentDelayInput.onchange = persistPlaceholders;
    maxPlaceholdersInput.onchange = persistPlaceholders;

    // Express Panel: persist + live-re-render the panel on any change.
    document.querySelectorAll('input[name="expressTapMode"]').forEach((radio) => {
        radio.onchange = () => {
            const mode = document.querySelector('input[name="expressTapMode"]:checked')?.value || 'single';
            storage.saveExpressTapMode(mode);
            renderExpressPanel();
        };
    });
    doubleTapMsSelect.onchange = () => {
        storage.saveDoubleTapMs(Number(doubleTapMsSelect.value));
        renderExpressPanel();
    };

    // --- Express Panel bands. The user sets Context and Flex; Always takes the
    // remainder, which is what makes an untouched panel almost exactly the panel that
    // shipped before bands existed. Sizes live in the panel MODEL rather than in
    // settings, because they travel with the phrases they lay out.
    const bandContextInput = document.getElementById('bandContextInput');
    const bandFlexInput = document.getElementById('bandFlexInput');
    const bandShapeSelect = document.getElementById('bandShapeSelect');
    const contextMarkSelect = document.getElementById('contextMarkSelect');
    const commitBands = (patch) => {
        const m = expressPanel.getModel();
        m.sizes = { ...m.sizes, ...patch };
        expressPanel.setModel(m);
        renderExpressPanel();
        reflectBandSizes();
        expressEditor.render();   // the cut lines move when the band sizes do
    };
    bandContextInput.onchange = () => commitBands(rowsMode()
        ? { contextRows: Number(bandContextInput.value) }
        : { context: Number(bandContextInput.value) });
    bandFlexInput.onchange = () => commitBands(rowsMode()
        ? { flexRows: Number(bandFlexInput.value) }
        : { flex: Number(bandFlexInput.value) });
    bandShapeSelect.onchange = () => commitBands({ shape: bandShapeSelect.value });
    contextMarkSelect.onchange = () => {
        storage.saveContextMark(contextMarkSelect.value);
        renderExpressPanel();
    };

    // Button sizing — apply live as the slider drags (oninput) so the change is
    // visible immediately (incl. the keyboard preview on this tab), persisting as
    // it goes. applyButtonSizing() re-derives --btn-min-dim / --grid-gap and the
    // dock grows/shrinks accordingly.
    buttonSizeSlider.oninput = () => {
        storage.saveButtonSizePos(Number(buttonSizeSlider.value));
        applyButtonSizing();
    };
    buttonGapSlider.oninput = () => {
        // Gap can't go below the minimum gap (clamp the slider up to it).
        let v = Number(buttonGapSlider.value);
        const mg = Number(minGapSlider.value);
        if (v < mg) { v = mg; buttonGapSlider.value = String(mg); }
        storage.saveButtonGapPos(v);
        applyButtonSizing();
    };
    minGapSlider.oninput = () => {
        const mg = Number(minGapSlider.value);
        storage.saveMinGapPos(mg);
        // Raising min-gap above the current gap pushes the gap up to match
        // (one-way; lowering min-gap leaves the gap where it is — Ken #3).
        if (Number(buttonGapSlider.value) < mg) {
            buttonGapSlider.value = String(mg);
            storage.saveButtonGapPos(mg);
        }
        applyButtonSizing();
    };
    // Screen edge margin — holds the WHOLE app off the physical screen edges, the
    // dock included, so a keyguard has material to sit on inside a tight case
    // opening. Unlike keyboard separation this DOES move the keyguard holes.
    appMarginSlider.oninput = () => {
        storage.saveAppMarginPos(Number(appMarginSlider.value));
        applyButtonSizing();
    };
    // Keyboard separation — independent of the inter-button gap; shifts the rest
    // of the UI away from the dock without resizing buttons or the dock footprint.
    dockSepSlider.oninput = () => {
        storage.saveDockSepPos(Number(dockSepSlider.value));
        applyButtonSizing();
    };
    // Transcript separation — shortens the transcript to open a gap above the
    // command bar; a keyguard-design concern, so it lives on the Keyguard tab.
    transcriptSepSlider.oninput = () => {
        storage.saveTranscriptSepPos(Number(transcriptSepSlider.value));
        applyButtonSizing();
    };

    // Reset button size / spacing / minimum gap to their defaults (Ken).
    document.getElementById('resetSizingBtn').onclick = () => {
        storage.resetButtonSizing();
        buttonSizeSlider.value = String(storage.loadButtonSizePos());
        buttonGapSlider.value = String(storage.loadButtonGapPos());
        minGapSlider.value = String(storage.loadMinGapPos());
        // dockSepSlider is intentionally left untouched — keyboard separation is
        // not part of the button/gap sizing the reset restores (Ken).
        applyButtonSizing();
    };

    // Text-size selects — persist + apply live.
    transcriptFontSelect.onchange = () => { storage.saveTranscriptFontScale(transcriptFontSelect.value); applyFontScales(); };
    composerFontSelect.onchange = () => { storage.saveComposerFontScale(composerFontSelect.value); applyFontScales(); };
    expressFontSelect.onchange = () => { storage.saveExpressFontScale(expressFontSelect.value); applyFontScales(); };
    responseFontSelect.onchange = () => { storage.saveResponseFontScale(responseFontSelect.value); applyFontScales(); };
    hintFontSelect.onchange = () => { storage.saveHintFontScale(hintFontSelect.value); applyFontScales(); };

    document.getElementById('closeSettingsBtn').onclick = () => {
        // Belt-and-suspenders: persist the API key from the field on Close.
        // `oninput` already saves on every keystroke/paste, but some paste paths
        // (e.g. autofill, or an OS paste that doesn't dispatch `input`) can leave
        // the field populated yet unsaved — Ken's bug 1. Saving here guarantees
        // whatever is in the field when the user closes Settings is persisted.
        const key = keyFieldValue(apiKeyInput);   // null = untouched (still redacted)
        if (key !== null && key !== (storage.loadApiKey() || '')) {
            llm.setApiKey(key);
            storage.saveApiKey(key);
        }
        // The keyboard is now kept up when focus moves to in-dialog controls, so
        // take it down explicitly on close (covers both real-typing and preview).
        keyboard.hideKeyboard();
        // Same reason, and the same reparenting: the panel is hosted INSIDE this
        // dialog on the Express tab, so closing without putting it back would take
        // the dock with it and leave an empty band.
        hostExpressPanel(false);
        dialog.close();
    };
}

/*
 * Startup failures must be VISIBLE on the device (Ken, July 30 2026).
 *
 * initApp() wires every control in the app, in one pass, and used to be called
 * bare. So a throw anywhere in it left the surviving buttons dead with no clue
 * why — which on an iPad, where there is no console to open, presents as "the
 * Start button doesn't do anything". That exact symptom has now cost two rounds of
 * guessing, so the app says what broke instead of failing mute.
 *
 * Deliberately not a recovery mechanism: whatever threw is still broken. This only
 * ensures the failure names itself, and that a LATER failure can't hide behind an
 * earlier one (the first message wins, so the root cause stays on screen).
 */
function reportStartupFailure(where, err) {
    const msg = (err && (err.stack || err.message)) || String(err);
    try { console.error('[startup]', where, err); } catch { /* no console */ }
    try { storage.logError('startup:' + where, msg); } catch { /* logging is best-effort */ }
    try {
        const box = document.getElementById('startupError');
        if (!box || !box.hidden) return;   // first failure wins — it is the root cause
        // Only while the pre-start screen is still up. These handlers stay attached
        // for the whole session, and a rejection during a conversation is not a
        // startup failure — it belongs in the error log (above) and the transcript
        // red-wash, not in a card the user can no longer see anyway.
        const startBlock = document.getElementById('startBlock');
        if (!startBlock || startBlock.classList.contains('hidden')) return;
        // Name the build here: this card is shown precisely when Settings — and so
        // the version line in About — cannot be reached.
        document.getElementById('startupErrorDetail').textContent =
            `v${APP_VERSION} · ${BUILD_ID}\n${where} — ${msg}`;
        box.hidden = false;
    } catch { /* the DOM itself is gone; the console line above is all we have */ }
}

window.addEventListener('error', (e) => reportStartupFailure('script', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportStartupFailure('promise', e.reason));

// The build used to be stamped under the Start button as well, because a start-up
// failure made Settings unreachable and there was no other way to tell which build
// you had. Removed once the iPad Home Screen app was confirmed to get past Start
// (Ken, July 30 2026) — Settings → About carries it now. The startup-failure card
// below is what covers the case the stamp was insurance against, and it names the
// build in its own detail line.
try {
    initApp();
} catch (err) {
    reportStartupFailure('initApp', err);
}

// The weekly report (Ken, August 7 2026). Deliberately not awaited: it reads every
// saved conversation off disk and then talks to the network, and a diagnostic that
// can slow or break the app it reports on is worse than no diagnostic. maybeSend
// never throws, and the .catch is belt-and-braces so a rejection here can never
// reach the unhandledrejection handler above and be reported to the user as a
// startup failure.
//
// (!) IT HANGS OFF START, NOT OFF PAGE LOAD, AND THAT IS THE WHOLE POINT (Ken,
// August 31 2026). It used to fire on a three-second timer from load. The data
// folder is reconnected inside handleStart and NOWHERE ELSE, so that timer was a
// race the report usually lost: it counted the conversations in a folder that had
// not been reopened yet and reported "no data folder, no conversations" for anyone
// who took more than three seconds to press Start. Measured against the live Sheet,
// that was both speech therapists - one had said 47 things across four days and was
// filed as having said nothing - while Ken, who presses Start at once, got through.
// The two numbers the beta exists to produce were being silently zeroed for exactly
// the testers it exists to learn from.
//
// It also removes the larger half of the noise: a session where nobody pressed
// Start now reports nothing at all, and 17 of those 29 rows were precisely that.
//
// Called after storage is warm rather than awaited inside handleStart, so nothing
// here can delay getting the user into their conversation. Guarded because Start
// can be reached more than once in a session and this is a once-per-launch job.
let weeklyReportScheduled = false;
function scheduleWeeklyReport() {
    if (weeklyReportScheduled) return;
    weeklyReportScheduled = true;
    setTimeout(() => {
        // Write the tally out first, so the report cannot miss the session that is
        // sending it — the debounce would otherwise still be pending.
        metrics.flush();
        weeklySend.maybeSend({ appVersion: APP_VERSION, build: BUILD_ID }).catch(() => { /* never surfaces */ });
    }, 3000);
}
