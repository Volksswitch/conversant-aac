/* Tier 1 — floor-holding placeholders (app/js/placeholders.js).
 *
 * Covers the timing contract (arm() alone speaks — the ladder is gated by partner
 * silence, NOT by the AI round-trip), role-by-position sequencing (first =
 * acknowledgment, later = thinking), the per-turn cap, and the "0 = none" gate.
 * Observes output via the speechSynthesis shim (spokenTexts). Real timers with
 * tiny delays (savePlaceholderSettings sets them small).
 */
import { resetLocalStorage, resetSpoken, spokenTexts } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as placeholders from '../app/js/placeholders.js';
import * as storage from '../app/js/storage.js';
import * as phrasePools from '../app/js/placeholder-phrases.js';

// The pools are user-owned now (placeholder-phrases.js), so the expected phrases come
// from the model's own defaults rather than being copied here — a copy would have to be
// kept in step by hand and would pass while the app said something else.
const ACK = phrasePools.DEFAULTS.acknowledgment;
const THINKING = phrasePools.DEFAULTS.thinking;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
    placeholders.stop();       // clear any timer from a prior test
    placeholders.setUserSpeakingGate(() => false);   // singleton — reset per test
    placeholders.resetConversation();                // singleton — each test is a fresh conversation
    resetLocalStorage();
    resetSpoken();
});

// THE regression guard for the August 7 2026 timing fix (Ken). Placeholders are
// gated by partner silence and terminated by user speech; they have nothing to do
// with the AI round-trip. Before the fix arm() only recorded a timestamp and start()
// — reached only after the classification returned — was what scheduled the speech,
// so the first placeholder actually landed at max(initialDelay, round-trip) and the
// setting was inert whenever the AI was slower than it. Here start() is NEVER
// called, standing in for an AI that is slow, failed, or has no key at all.
test('arm() alone speaks the first placeholder — the AI is never consulted', async () => {
    storage.savePlaceholderSettings(0.02, 5, 2);
    placeholders.arm();
    await sleep(80);
    assert.equal(spokenTexts.length, 1, 'the first placeholder fires on the timer alone');
    assert.ok(ACK.includes(spokenTexts[0]), `it is an acknowledgment: ${spokenTexts[0]}`);
});

// Every acknowledgment must be partner-statement independent, which is what removed
// the need to know the turn type. Guards against reintroducing a turn-type-dependent
// pool (e.g. "Good question.") without re-deciding the timing model.
test('no acknowledgment assumes the partner asked a question', () => {
    const pools = phrasePools.DEFAULTS;
    assert.ok(Array.isArray(pools.acknowledgment), 'acknowledgment is a flat list, not split by turn type');
    for (const phrase of [...pools.acknowledgment, ...pools.thinking]) {
        assert.ok(!/question/i.test(phrase), `"${phrase}" presumes a question`);
    }
});

test('plays acknowledgment then thinking, capped at maxPlaceholders', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 2);
    placeholders.arm();
    await placeholders.start();
    await sleep(220);
    assert.equal(spokenTexts.length, 2, 'the cap of 2 is respected');
    assert.ok(ACK.includes(spokenTexts[0]), `first is an acknowledgment: ${spokenTexts[0]}`);
    assert.ok(THINKING.includes(spokenTexts[1]), `second is a thinking placeholder: ${spokenTexts[1]}`);
});

// start() arrives when the classification comes back, by which time arm() may
// already have spoken. It must confirm the running ladder, not restart it — a reset
// would replay the acknowledgment rung and say two in a row.
test('start() after the first placeholder has spoken does not replay it', async () => {
    storage.savePlaceholderSettings(0.02, 5, 3);
    placeholders.arm();
    await sleep(60);
    assert.equal(spokenTexts.length, 1);
    await placeholders.start();              // the AI finally answered
    await sleep(60);
    assert.equal(spokenTexts.length, 1, 'no second acknowledgment');
});

// The repair-initiator path ("What?"): app.js calls stop() instead of start() once
// the classification identifies it. On a fast round-trip that lands before the
// timer, so nothing is spoken.
test('stop() before the timer fires suppresses the ladder entirely', async () => {
    storage.savePlaceholderSettings(0.1, 0.1, 2);
    placeholders.arm();
    placeholders.stop();
    await sleep(160);
    assert.equal(spokenTexts.length, 0);
});

test('maxPlaceholders = 0 means NONE — nothing is spoken', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 0);
    placeholders.arm();
    await placeholders.start();
    await sleep(120);
    assert.equal(spokenTexts.length, 0);
});

test('consecutive thinking placeholders are never the same phrase back-to-back', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 3);
    placeholders.arm();
    await placeholders.start();
    await sleep(260);
    assert.equal(spokenTexts.length, 3);
    assert.notEqual(spokenTexts[1], spokenTexts[2], 'two thinking placeholders in a row must differ');
});

test('userSpeakingGate: a placeholder waits for the user statement to finish instead of barging in', async () => {
    // Ken July 2026: pressing a speaking button must not let a (stray, in-flight)
    // placeholder cut into the user\'s own speech. The gate defers it, then it speaks
    // once the user is done — it isn't lost.
    storage.savePlaceholderSettings(0.02, 0.03, 2);
    let userSpeaking = true;
    placeholders.setUserSpeakingGate(() => userSpeaking);
    placeholders.arm();
    await placeholders.start();
    await sleep(90);
    assert.equal(spokenTexts.length, 0, 'nothing is spoken while the user statement plays');
    userSpeaking = false;                 // the user statement finished
    await sleep(120);                     // the deferred attempt (subsequentDelay) fires
    assert.ok(spokenTexts.length >= 1, 'the placeholder speaks once the user is done — not dropped');
});

test('stop() cancels a scheduled placeholder before it speaks', async () => {
    storage.savePlaceholderSettings(0.1, 0.1, 2);
    placeholders.arm();
    await placeholders.start();
    placeholders.stop();       // quick selection cancels everything
    await sleep(160);
    assert.equal(spokenTexts.length, 0);
});

/* --- Composing follows the same rules as reading the cards (Ken, August 25 2026) ---
 *
 * ⚠ A SOURCE CHECK, NOT A BEHAVIOUR CHECK, and the reason is worth stating: this
 * decision lives in app.js, which is not loadable in a test (it touches the DOM, the
 * mic and the network at import). The behaviour was verified in the browser; these two
 * assertions are the tripwire that stops it being undone by a change that looks
 * unrelated, because both of the old mechanisms were silent — the app simply said
 * nothing, and nothing anywhere reported that it had chosen not to.
 *
 * THE RULE: opening "In my own words" is the user still CHOOSING, exactly as reading
 * the offered cards is. It is not an act of speaking and not a decision, so it must not
 * silence the floor-holding phrases. Typing is the slower of the two ways to answer, so
 * silencing it left the longest gaps in the app unfilled — the opposite of what a
 * floor-holder is for.
 */
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');

test('the placeholder gate covers speech only, never an open composer', () => {
    // To the end of the LINE, not to the first ')': the argument is an arrow function,
    // so a lazy paren match stops at its own empty parameter list and captures nothing.
    const call = /setUserSpeakingGate\((.*)$/m.exec(appSource);
    assert.ok(call, 'app.js no longer sets the user-speaking gate at all');
    assert.ok(!/composerOpen/.test(call[1]),
        'the gate must not carry composerOpen — it would silence the ladder for as long as '
        + 'the box is open, and because the gate DEFERS rather than counting, indefinitely');
    assert.ok(/speakingUserStatement/.test(call[1]),
        'the gate must still cover the user\'s own speech — nothing may speak over that');
});

test('opening the composer does not abort the running ladder', () => {
    const at = appSource.indexOf('function openComposer(');
    assert.ok(at > 0, 'openComposer not found');
    const body = appSource.slice(at, appSource.indexOf('\nfunction ', at + 10));
    // Comments explain why it is absent, so match a CALL rather than the bare word.
    assert.ok(!/^\s*abortPlaceholders\(\);/m.test(body),
        'openComposer must not abort placeholders — opening the box is the user still '
        + 'choosing, the same state as reading the cards');
});

// --- "Hold on" is a placeholder the user fires themselves (Ken, comment 76) --------
// It used to say one fixed phrase of its own, edited on a different tab from the
// automatic ones: two lists of holding phrases, maintained separately, saying the same
// kind of thing. These guard the two properties that make it one list instead.

test('Hold on draws from the placeholder list, not a phrase of its own', () => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(placeholders.phraseOnDemand());
    for (const phrase of seen) {
        assert.ok(THINKING.includes(phrase),
            `"${phrase}" is not one of the placeholder phrases`);
    }
    assert.ok(seen.size > 1, 'it varies rather than saying one fixed thing');
});

test('Hold on cannot repeat the phrase the app just said by itself', () => {
    // ⚠ THE LOAD-BEARING ONE. The no-repeat rule is per pool, so sharing that state is
    // what stops the button echoing the automatic phrase - and pressing it right after
    // one has played is exactly when a user would.
    for (let i = 0; i < 60; i++) {
        const first = placeholders.phraseOnDemand();
        const second = placeholders.phraseOnDemand();
        assert.notEqual(second, first, 'said the same phrase twice in a row');
    }
});

/* --- ...so it is not written into the conversation either (Ken, August 27 2026) ---
 *
 * Another SOURCE check, for the same reason: the decision is in app.js. The ladder's
 * own phrases have never been recorded, so once the button started drawing from the
 * SAME pool, logging it meant one sentence appeared in the record when the user pressed
 * a button and vanished when the app said it by itself.
 *
 * ⚠ BOTH HALVES ARE ASSERTED, because doing only the first would make the app speak in
 * the user's voice with nothing anywhere to show for it: with no transcript entry, the
 * now-playing line is the ONLY place this speech is visible, and the phrase is a random
 * draw, so the user cannot otherwise say which of their phrases just went out.
 */
function handleHoldOnBody() {
    const at = appSource.indexOf('async function handleHoldOn(');
    assert.ok(at > 0, 'handleHoldOn not found');
    return appSource.slice(at, appSource.indexOf(String.fromCharCode(10) + '// ', at + 10));
}

test('Hold on is not recorded as a turn', () => {
    assert.ok(!/^\s*logSpokenUserTurn\(/m.test(handleHoldOnBody()),
        'Hold on must not log a turn - it is a floor-holder drawn from the placeholder '
        + 'pool, and the automatic ones are not recorded');
});

test('Hold on is announced, because nothing now records it', () => {
    assert.match(handleHoldOnBody(), /speakUserStatement\([^)]*announce:\s*true/,
        'with no transcript entry the now-playing line is the only place this speech is '
        + 'visible - nothing spoken in the voice may be invisible');
});

test('an emptied placeholder list leaves Hold on with nothing rather than crashing', () => {
    // The app falls back to a fixed phrase in that case; what must not happen is a throw.
    phrasePools.setPools({ acknowledgment: [], thinking: [] });
    assert.doesNotThrow(() => placeholders.phraseOnDemand());
    phrasePools.resetPools();
});


/* --- Easing off over a conversation (Ken, September 8 2026) -----------------------
 *
 * "It begins to sound overbearing after about the third time." The first placeholder
 * of a turn is DELAYED a little further with each exchange already had, so quick turns
 * fall quiet once the cards beat it while a genuinely long silence is still covered on
 * exchange twelve. These drive the real module and read the real speech shim; the
 * delays are fractional seconds so the whole set runs in about two seconds.
 */

// The load-bearing one: the wait actually grows, so a turn that spoke immediately at
// the start of a conversation is still silent at that same moment later on.
test('easing off: the first placeholder is delayed further with each exchange', async () => {
    storage.savePlaceholderSettings(0.02, 5, 2, 0.1);
    placeholders.arm();
    await sleep(60);
    assert.equal(spokenTexts.length, 1, 'exchange 0 speaks at the plain initial delay');

    resetSpoken();
    placeholders.noteExchange();
    placeholders.noteExchange();          // delay is now 0.02 + 2 x 0.1 = 0.22s
    placeholders.arm();
    await sleep(120);
    assert.equal(spokenTexts.length, 0, 'at 120ms it has not spoken — the wait grew');
    await sleep(280);
    assert.equal(spokenTexts.length, 1, 'but it still speaks: eased off, never removed');
});

// Without a ceiling the delay would run away over a long conversation and the
// floor-holder would be gone for good, which is exactly what easing off is meant NOT
// to do. Growth stops after four exchanges: 0.02 + 4 x 0.1 = 0.42s, not 0.02 + 12.
test('easing off stops growing after the first few exchanges', async () => {
    storage.savePlaceholderSettings(0.02, 5, 2, 0.1);
    for (let i = 0; i < 12; i++) placeholders.noteExchange();
    placeholders.arm();
    await sleep(300);
    assert.equal(spokenTexts.length, 0, 'still waiting at 300ms');
    await sleep(350);
    assert.equal(spokenTexts.length, 1, 'speaks at the capped delay, not 12 exchanges worth');
});

// A new conversation is a new person, who has learned nothing about this device yet.
test('a new conversation starts over at the plain initial delay', async () => {
    storage.savePlaceholderSettings(0.02, 5, 2, 0.1);
    for (let i = 0; i < 4; i++) placeholders.noteExchange();
    placeholders.resetConversation();
    placeholders.arm();
    await sleep(60);
    assert.equal(spokenTexts.length, 1, 'back to speaking at the initial delay');
});

// "Never — same every time" has to reproduce the behaviour from before this existed,
// exactly, however long the conversation runs.
test('easing off set to 0 leaves the delay alone however many exchanges pass', async () => {
    storage.savePlaceholderSettings(0.02, 5, 2, 0);
    for (let i = 0; i < 10; i++) placeholders.noteExchange();
    placeholders.arm();
    await sleep(60);
    assert.equal(spokenTexts.length, 1, 'unchanged: the user asked for the same delay every time');
});

// ⚠ THE TRAP THIS GUARDS: arm() runs at every pause in the other person's speech, and
// at the 0.5s silence default one hesitant speaker produces several inside a single
// turn. If easing off counted those, the app would fall silent while they were still
// on their first sentence — the failure mode is invisible, because going quiet is what
// the feature is supposed to do. An exchange is a COMMITTED USER TURN and nothing else.
test('re-arming within one partner turn does not ease off', async () => {
    storage.savePlaceholderSettings(0.02, 5, 2, 0.1);
    for (let i = 0; i < 6; i++) placeholders.arm();   // six silence checkpoints, one turn
    await sleep(60);
    assert.equal(spokenTexts.length, 1, 'still the plain initial delay — no exchange has completed');
});

// The counting itself lives in app.js, which no test can load, so this is the
// source-level tripwire for the link between the two layers.
test('an exchange is counted at the commit choke point, not at the silence checkpoint', () => {
    const at = appSource.indexOf('async function commitExchange(');
    assert.ok(at > 0, 'commitExchange not found');
    const body = appSource.slice(at, appSource.indexOf('\nasync function ', at + 10));
    assert.ok(/placeholders\.noteExchange\(\);/.test(body),
        'commitExchange must count the exchange — without it the app never eases off '
        + 'and nothing reports that it did not');
    assert.equal((appSource.match(/placeholders\.noteExchange\(\)/g) || []).length, 1,
        'exactly one caller: a second one would ease off twice as fast, silently');
    assert.ok(/placeholders\.resetConversation\(\);/.test(appSource),
        'a conversation boundary must start the easing off over');
});

/* SOURCE-LEVEL GUARDS on the offer record, because the decisions live in app.js and
 * no test can load it (see the note at the top of this file for why that is where
 * such guards go).
 *
 * ⚠ THE FAILURE THESE CATCH IS THE ONE THAT ALREADY HAPPENED ONCE: the goal stamp was
 * designed, the storage layer was ready for it, and app.js never passed it - so the
 * app worked perfectly and the record was simply missing. Losing either of these
 * calls does exactly that to the offer record, silently.
 */
test('showPalette records the set of cards, and finalizes the one it replaces', () => {
    const fn = appSource.slice(appSource.indexOf('function showPalette('));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    assert.match(body, /storage\.logOffer\(/,
        'every set shown must be recorded - showPalette is the only choke point that sees them all');
    assert.match(body, /storage\.finalizeOffer\(\{ outcome: 'superseded'/,
        'the set being replaced is finalized here, because a reprompt replaces it with '
        + 'no user action and nothing else is in a position to notice');
});

test('noteUserAction records HOW the user ended the set', () => {
    const fn = appSource.slice(appSource.indexOf('function noteUserAction('));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    assert.match(body, /storage\.finalizeOffer\(\{ outcome: kind/,
        'the outcome is taken from the label the caller already passes - an offer '
        + 'without its outcome is much weaker evidence');
});

test('the app records the words of every placeholder it speaks, not just a count', () => {
    // ⚠ The hook existed and carried only `n`, so the sentences the partner actually
    // heard were counted and never written down. Guarded at source because the wiring
    // lives in app.js, which no test can load.
    // A fixed window rather than the first '});' - the metrics call inside it ends
    // with one, so searching for the closer finds the wrong brace.
    const i = appSource.indexOf('placeholders.setOnSpoken(');
    const body = appSource.slice(i, i + 900);
    assert.match(body, /storage\.logPlaceholder\(\{ text/,
        'the words go into the conversation record, not only the metric');
});

test('the context provider is registered, so time zero carries what was selected', () => {
    assert.match(appSource, /storage\.setContextProvider\(contextSnapshot\)/,
        'without this a conversation begins with no record of what was already selected');
});

test('every context toggle records the change as its own event', () => {
    for (const trigger of ['partner', 'place', 'feeling', 'goal']) {
        assert.ok(appSource.includes(`storage.logContext('${trigger}')`),
            `a ${trigger} change must be recorded at the moment it happens`);
    }
});

test('a command button records WHICH button, not just "a command"', () => {
    // 'command' covered five different buttons, so the record could say a set of cards
    // was ended by a command bar press and not which one - and "wrap up" versus "ask
    // them to repeat" are completely different findings.
    assert.ok(!appSource.includes("noteUserAction('command')"),
        'the generic label is gone');
    for (const label of ['start conversation', 'say again', 'hold on', 'ask them to repeat', 'wrap up']) {
        assert.ok(appSource.includes(`noteUserAction('${label}')`), `${label} names itself`);
    }
});

test('a card selection records the palette it was ACTUALLY chosen from', () => {
    // ⚠ lastPalette is only ever assigned from an AI generation, so a wind-down or a
    // goodbye was logged with the options and the CATEGORY of an earlier AI set - Ken
    // found "See you later!" recorded as an INITIATIVE in his own transcript. That
    // corrupts the category-selection distribution, one of the two headline measures.
    assert.match(appSource, /const shownAtTap = \(shownCards\.cards \|\| \[\]\)\.slice\(\);/,
        'what was on screen is captured at the tap');
    assert.match(appSource, /chosenFrom: shownAtTap/, 'and passed to the commit');
    assert.match(appSource, /allOptions: index >= 0 \? \(chosenFrom \|\| lastPalette\)/,
        'the options logged are the ones that were showing');
    assert.match(appSource, /selectedSlot: index >= 0 \? \(\(chosenFrom \|\| lastPalette\)\[index\] \|\| \{\}\)\.slot/,
        'and so is the category');
});

test('the microphone going on or off is recorded from the state, not the button', () => {
    // The button is set directly from several paths that open no microphone at all -
    // practice mode cues the AI partner with it - so recording from the button would
    // log listening that never happened.
    const i = appSource.indexOf('function handleSttStatus(');
    const body = appSource.slice(i, i + 2600);
    assert.match(body, /if \(isListening !== was\) storage\.logEvent\(isListening \? 'listen on' : 'listen off'\)/,
        'recorded off the was/is comparison this function already keeps');
});

test('the request moment is recorded through one hook, and each caller says why', () => {
    assert.match(appSource, /llm\.setOnRequest\(\(\{ reason \}\) => storage\.logEvent\('generation requested'/,
        'one hook, so a sixth caller added later is recorded with a null reason rather '
        + 'than being silent');
    for (const reason of ['reprompt', 'regenerate', 'choice chip', 'reframe', 'context change']) {
        assert.ok(appSource.includes(`reason: '${reason}'`), `${reason} names itself`);
    }
});

test('the composer records opening, canceling WITH the words, and the steer', () => {
    assert.match(appSource, /storage\.logEvent\('composer opened'\)/);
    assert.match(appSource, /storage\.logEvent\('composer canceled', \{ text:/,
        'the abandoned prose is the point - it says what the user was trying to say '
        + 'when no card could say it');
    assert.match(appSource, /storage\.logEvent\('reframe', \{ text: steer\.trim\(\) \}\)/,
        'recorded where the steer is taken, so both Reframe branches are covered once');
});

// CR-003. Every path where the USER takes the floor consumes the partner's turn, so
// it must empty the listening buffer - or, with auto-resume off, the next Listen tap
// is read as "paused mid-turn" and the old words are glued onto the new ones.
test('every way of answering empties the listening buffer', () => {
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
        .map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    for (const fn of ['handleResponseSelected', 'speakAsUserTurn', 'playAudioTurn', 'handleRepairOfSelf']) {
        const at = appSource.indexOf(`async function ${fn}(`);
        assert.ok(at > 0, `${fn} not found`);
        const body = strip(appSource.slice(at, appSource.indexOf('\n}\n', at) > 0
            ? appSource.indexOf('\n}\n', at) : appSource.slice(at).search(/\r?\n\}\r?\n/) + at));
        assert.match(body, /stt\.resetTranscript\(\)/, `${fn} must call stt.resetTranscript()`);
    }
});

// CR-004. handleRepairOfSelf logged `source` by shorthand with no such variable in
// scope, so every repair card threw a ReferenceError after speaking.
test('the repair-of-self log names its source explicitly', () => {
    const at = appSource.indexOf('async function handleRepairOfSelf(');
    const end = at + appSource.slice(at).search(/\r?\n\}\r?\n/);
    const body = appSource.slice(at, end).replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    assert.ok(!/[,{]\s*source\s*[,}]/.test(body), 'no bare `source` shorthand - there is no such variable here');
    assert.match(body, /source:\s*'control'/);
});

// CR-005. Typed sentences and Express taps were saved as 'control' because
// speakAsUserTurn never handed its `source` to the commit, so the voice harvest never
// learned from the user's own words. Both halves of the link are checked.
test('a typed sentence or Express tap is recorded with its own source', () => {
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
        .map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    const at = appSource.indexOf('async function speakAsUserTurn(');
    const body = strip(appSource.slice(at, at + appSource.slice(at).search(/\r?\n\}\r?\n/)));
    assert.match(body, /commitExchange\([^)]*\{[^}]*\bsource\b[^}]*\}\s*\)/,
        'speakAsUserTurn must pass source to commitExchange');
    const c = appSource.indexOf('async function commitExchange(');
    const commit = strip(appSource.slice(c, c + appSource.slice(c).search(/\r?\n\}\r?\n/)));
    assert.match(commit, /opts\.source/, 'commitExchange must record opts.source');
});

// CR-008. Choosing a data folder from the About Me banner reconciled only About Me,
// so the other stores kept their stale cache and their next save overwrote the
// folder's files. The banner, and a folder newly restored by open(), must run the
// app's shared post-connect routine.
test('connecting a folder from About Me reconciles every store', () => {
    const wvui = readFileSync(new URL('../app/js/worldview-ui.js', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    const prompt = wvui.slice(wvui.indexOf('function renderFolderPrompt('));
    assert.match(prompt.slice(0, 1500), /await onFolderConnected\(\)/);
    const open = wvui.slice(wvui.indexOf('export async function open('));
    assert.match(open.slice(0, 1200), /onFolderConnected\(\)/);
    assert.match(appSource, /worldviewUI\.init\(\{\s*onFolderConnected:\s*adoptDataFolder\s*\}\)/);
});

// CR-009. The on-screen keyboard sets a field's value and fires 'input', so leaving
// the field fired no 'change', and every editor that commits a typed field "when it
// is left" (People, Places, goal labels) silently dropped on-screen typing. The
// keyboard now fires the 'change' a physical keyboard would. (Verified in the
// browser: a person's note typed with the keys is saved without pressing Done.)
test('leaving a field typed into with the on-screen keyboard fires change', () => {
    const kb = readFileSync(new URL('../app/js/keyboard.js', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    const at = kb.indexOf('const valueOnFocus');
    assert.ok(at > 0, 'the keyboard must remember the value a field had on focus');
    assert.match(kb.slice(at, at + 900), /addEventListener\('focusout'[\s\S]*dispatchEvent\(new Event\('change'/);
});

// CR-011. A "Don't save" conversation still wrote the partner's words into About Me
// through the gaps log. The gap is still recorded; the words go only when saving.
test('the gaps log carries the partner words only when the conversation is saved', () => {
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
        .map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    const src = strip(appSource);
    assert.match(src, /const gapContext = storage\.isConversationSaving\(\) \? partnerText : ''/);
    assert.match(src, /recordGaps\(result\.missingFacts, gapContext\)/);
    assert.match(src, /recordExtraGaps\(result\.missingOther, gapContext\)/);
    assert.doesNotMatch(src, /record(Extra)?Gaps\([^)]*partnerText\)/, 'no caller passes the raw partner text');
});

// CR-017. Before Start the conversation screen only blocked taps, so a keyboard could
// Tab past Start into Listen and the Express Panel and skip the start-up steps. Those
// regions start inert and finishStart clears it.
test('the conversation screen is inert until Start finishes', () => {
    const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
    for (const id of ['transcriptLog', 'listenControls', 'responsesSection', 'dockArea']) {
        assert.match(html, new RegExp(`id="${id}"[^>]*data-prestart-inert inert`), `${id} must start inert`);
    }
    const at = appSource.indexOf('function finishStart(');
    assert.match(appSource.slice(at, at + 1500), /\[data-prestart-inert\][\s\S]*removeAttribute\('inert'\)/);
});

// CR-020. Goodbyes and repair wording arriving while "In my own words" is open are
// held for Cancel like any other set, never drawn under the box.
test('goodbyes and repair wording are held while the composer is open', () => {
    const at = appSource.indexOf('async function generateOptions(');
    const body = appSource.slice(at, at + 12000);
    assert.match(body, /if \(composerOpen\) holdClosingsForComposer\(snap\.palette\)/, 'the farewell fast path holds');
    assert.match(body, /PRE_CLOSING_CLOSING && composerOpen\)[\s\S]{0,400}holdClosingsForComposer/, 'the AI closing path holds');
    const rp = appSource.indexOf('async function prefetchRepairOptions(');
    assert.match(appSource.slice(rp, rp + 2000), /if \(composerOpen\) \{/);
    const sh = appSource.indexOf('function showHeldForComposer(');
    assert.match(appSource.slice(sh, sh + 800), /kind === 'closing'[\s\S]*renderStaticPalette\('closing'/);
});

// CR-021. When the error box replaces the cards, the records must say so - every
// showResponseError call is preceded by the helper that closes the offer and empties
// the record of what is on screen.
test('every error box is preceded by updating the record of what is on screen', () => {
    const lines = appSource.split(/\r?\n/);
    const bad = [];
    lines.forEach((l, i) => {
        if (/^\s*ui\.showResponseError\(/.test(l) && !/notePaletteReplacedByError\(\)/.test(lines[i - 1] || '')) bad.push(i + 1);
    });
    assert.deepEqual(bad, []);
});

// CR-023. Repair replies used to write the turn by hand, skipping the shared commit
// (no stamps, no ease-off, no category count) and leaving the mic off on failure.
test('a repair reply goes through the shared commit step and resumes on failure', () => {
    const at = appSource.indexOf('async function handleRepairOfSelf(');
    const body = appSource.slice(at, at + appSource.slice(at).search(/\r?\n\}\r?\n/));
    assert.match(body, /await commitExchange\(raw, text, index, \{[^}]*source: 'control'/);
    assert.match(body, /noteUserAction\('card', index\)/);
    assert.match(body, /resumePartnerCapture\(\)/);
    assert.doesNotMatch(body, /storage\.logUserResponse\(/, 'no hand-written user turn');
});

// CR-024 and CR-025. Starting practice ends the real conversation BEFORE practice is
// switched on (or its unanswered turn is stamped as practice), and clears the real
// conversation's partner, feeling and goals.
test('starting practice ends the real conversation first and clears its influencers', () => {
    const at = appSource.indexOf('async function startPractice(');
    const body = appSource.slice(at, at + 3000);
    const term = body.indexOf('await terminateConversation()');
    assert.ok(term > 0 && term < body.indexOf('practiceMode = true'), 'teardown before practice is on');
    assert.ok(body.indexOf('clearInfluencers()') > term, 'influencers cleared after the teardown');
});

// CR-026. Every way the practice partner's cue can end early puts the Listen button
// and the busy look back, and a line already spoken is recorded.
test('an interrupted practice partner turn is wound down and its line kept', () => {
    const at = appSource.indexOf('async function advancePracticePartner(');
    const body = appSource.slice(at, at + appSource.slice(at).search(/\r?\n\}\r?\n/));
    assert.equal((body.match(/endPracticeCue\(token\)/g) || []).length, 3, 'error, superseded before speaking, superseded after');
    assert.match(body, /storage\.logPartnerInterim\(\{ rawTranscript: currentPartnerText/);
});

// CR-027 and CR-028. The tour waits for the user's own sentence to finish before the
// next instruction, and never cues the AI practice partner.
test('the button tour waits for quiet and never calls the AI partner', () => {
    const st = appSource.indexOf('async function speakTourStep(');
    assert.match(appSource.slice(st, st + 600), /await waitUntilQuiet\(\)/);
    const ap = appSource.indexOf('async function advancePracticePartner(');
    assert.match(appSource.slice(ap, ap + 300), /if \(!practiceMode \|\| tour\) return;/);
    const pr = appSource.indexOf('function practiceResumeOrIdle(');
    assert.match(appSource.slice(pr, pr + 200), /!tour && manualListenArmed/);
});

// CR-029 and CR-030. Emptying the panel forgets the static set New N would page, and
// ending practice turns the Listen button off.
test('an emptied panel forgets its static set, and ending practice turns Listen off', () => {
    const cp = appSource.indexOf('function clearPalette(');
    assert.match(appSource.slice(cp, cp + 900), /currentStatic = \{ kind: null/);
    const ec = appSource.indexOf('async function handleEndConversation(');
    assert.match(appSource.slice(ec, ec + 1500), /await terminateConversation\(\);[\s\S]{0,300}if \(wasPractice\) \{ isListening = false; ui\.setListenButtonState\(false\); \}/);
});

// CR-031 and CR-032. Choices reset the panel's paging when they ARRIVE, not on every
// draw; and an edit in the Express editor reconciles the lit influencers.
test('More pages while choices show, and edited influencers are reconciled', () => {
    const so = appSource.indexOf('function setOfferedChoices(');
    assert.match(appSource.slice(so, so + 400), /if \(next\.length\) resetExpressPaging\(\)/);
    assert.doesNotMatch(appSource, /if \(currentPartnerText && \(offeredChoices\.length \|\| offeredRange\)\) resetExpressPaging\(\);/);
    assert.match(appSource, /onChange: \(\) => \{ reconcileInfluencers\(\); renderExpressPanel\(\); \}/);
});

// CR-035. Hide-on-blur is set by the one function every tab switch and close passes.
test('hide-on-blur follows the Express Panel being hosted in Settings', () => {
    const at = appSource.indexOf('function hostExpressPanel(');
    assert.match(appSource.slice(at, at + 700), /keyboard\.setHideOnBlur\(!!inSettings\)/);
});

// CR-036. The launch-screen report connects the data folder first, prompt-free.
test('the launch-screen report reconnects the data folder before it is built', () => {
    const at = appSource.indexOf('async function sendProblemReportFromStartNow(');
    const body = appSource.slice(at, at + 2500);
    const restore = body.indexOf('storage.restoreDataFolder()');
    assert.ok(restore > 0 && restore < body.indexOf('buildProblemReportText()'));
    assert.match(body, /folderReadableWithoutPrompt\(\)/);
});

// CR-041. A blank Express phrase is never a live button and never speaks.
test('a blank Express phrase cannot speak', () => {
    const at = appSource.indexOf('async function handleSpeakExpressItem(');
    assert.match(appSource.slice(at, at + 400), /if \(!String\(phrase\.text \|\| ''\)\.trim\(\) && !String\(phrase\.speak \|\| ''\)\.trim\(\)\) return;/);
    const ui = readFileSync(new URL('../app/js/ui.js', import.meta.url), 'utf8');
    assert.match(ui, /item\.type === 'empty' \|\| blankPhrase/);
});

// CR-046. stop() cancels the ladder's own phrase only - never the user's statement
// that happens to be playing when suggestions arrive.
test('stopping the placeholders leaves the user statement playing', async () => {
    const tts = await import('../app/js/tts.js');
    const placeholders = await import('../app/js/placeholders.js');
    placeholders.stop();                       // nothing of the ladder's is playing
    tts.speak('I am saying this myself.');     // the user's statement
    assert.equal(tts.isSpeaking(), true);
    placeholders.stop();
    assert.equal(tts.isSpeaking(), true, 'the user is not cut off');
    tts.cancel();
});

// CR-057. A restore that came across only in part says so.
test('the restart notice reports parts and conversations that did not restore', () => {
    const at = appSource.indexOf('async function offerRestart(');
    const body = appSource.slice(at, at + 2500);
    assert.match(body, /done\.failed/);
    assert.match(body, /conversationsInFile/);
    assert.match(appSource, /offerRestart\('backup', \{ \.\.\.done, conversationsInFile:/);
});

// CR-058. Backup and restore refuse while the folder is remembered but not connected.
test('backup and restore refuse while the data folder is not reconnected', () => {
    const imp = appSource.indexOf('async function importPackageText(');
    assert.match(appSource.slice(imp, imp + 300), /folderRememberedButDisconnected\(\)/);
    const exp = appSource.indexOf("getElementById('exportDataBtn').onclick");
    assert.match(appSource.slice(exp, exp + 300), /folderRememberedButDisconnected\(\)/);
});

// CR-062. A failed request leaves the holding phrases to run.
test('a failed suggestion request does not silence the holding phrases', () => {
    const at = appSource.indexOf("storage.logError('generateOptions', err.message");
    const tail = appSource.slice(at, at + 1200).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(tail.slice(0, tail.indexOf('updatePartnerLive') > 0 ? tail.indexOf('updatePartnerLive') : 600), /placeholders\.stop\(\)/);
});

// CR-063. A chip choice and a Reframe steer go out together whichever came first.
test('the chip choice and the Reframe steer are sent together', () => {
    assert.match(appSource, /reason: 'reframe', steer, focusChoice: activeSteer\.focusChoice/);
    const chip = appSource.indexOf('async function handleChoiceChip(');
    assert.match(appSource.slice(chip, chip + 3000), /focusChoice: pick,\s*steer: activeSteer\.steer/);
});

// CR-065. A tap on an empty cell in Settings says which cell; the Always band uses it.
test('a tapped empty cell passes its position to the editor', () => {
    const at = appSource.indexOf('function handleDefineCell(');
    assert.match(appSource.slice(at, at + 2000), /expressEditor\.addToBand\(band, \{\s*fromCell: true,\s*pos:/);
    const ed = readFileSync(new URL('../app/js/express-editor.js', import.meta.url), 'utf8');
    assert.match(ed, /while \(list\.length < opts\.pos\) list\.push\(newEmptyItem\(\)\)/);
});

test('CR-077: an earlier statement cut off by a later one cannot clear the speaking flag', () => {
    const body = appSource.slice(appSource.indexOf('async function speakUserStatement'));
    assert.match(body.slice(0, 400), /mine === statementSeq/);
});

test('CR-078: every caller stops when the conversation ended under its speech', () => {
    assert.doesNotMatch(appSource, /^\s*await speakUserStatement\(/m, 'no caller ignores the answer');
    const end = appSource.slice(appSource.indexOf('async function terminateConversation'));
    assert.match(end.slice(0, 200), /conversationEpoch\+\+/);
});

test('CR-079: a context refresh or regenerate never skips classifying the newest words', () => {
    for (const name of ['async function refreshForContextChange', 'async function handleRegenerate']) {
        const body = appSource.slice(appSource.indexOf(name));
        const guard = body.indexOf('lastIngestedPartnerText');
        assert.ok(guard > 0 && guard < body.indexOf('lastPalette.length'), name);
    }
    assert.equal((appSource.match(/lastIngestedPartnerText = partnerText/g) || []).length, 2,
        'both places the engine takes in a classification record it');
});

test('CR-080: a sound only clears the playing record while it is still its own', () => {
    const clip = appSource.slice(appSource.indexOf('async function playClip'));
    const body = clip.slice(0, clip.indexOf('async function playAudioTurn'));
    assert.doesNotMatch(body, /^\s*audioPlayer = null;/m, 'every clear is guarded');
    assert.match(body, /audioPlayer === mine/);
    const turn = appSource.slice(appSource.indexOf('async function playAudioTurn'));
    assert.ok(turn.indexOf('result.replaced') < turn.indexOf('startFreshListening'),
        'a replaced sound never turns listening back on');
});

test('CR-081: both report buttons go through the one-at-a-time guard', () => {
    assert.match(appSource, /function sendProblemReport\(\) \{ return oneReportAtATime\(/);
    assert.match(appSource, /function sendProblemReportFromStart\(\) \{ return oneReportAtATime\(/);
    const g = appSource.slice(appSource.indexOf('async function oneReportAtATime'));
    assert.match(g.slice(0, 300), /finally \{ problemReportInProgress = false; \}/);
});

test('CR-084: opening Settings again never adds a second set of key-box listeners', () => {
    const s = appSource.indexOf('\nfunction openSettings');
    const e = appSource.indexOf('\n}\n', s);
    assert.doesNotMatch(appSource.slice(s, e), /addEventListener\(/);
    const w = appSource.slice(appSource.indexOf('function wireKeyField'));
    assert.match(w.slice(0, 600), /if \(!input\.dataset\.keyWired\)/);
});

test('CR-085: leaving the Express tab or Settings stops a sound being previewed', () => {
    const h = appSource.slice(appSource.indexOf('function hostExpressPanel'));
    assert.match(h.slice(0, 1500), /if \(!inSettings\) \{ expressEditor\.stopPreview\(\);/);
});

test('CR-090: a spoken card clears the cards before returning to rest', () => {
    const body = appSource.slice(appSource.indexOf('async function handleResponseSelected'));
    const end = body.indexOf('\n}\n');
    assert.match(body.slice(0, end), /clearPalette\(\);\n\s*resumeOrIdle\(\);\n\s*\}$/);
});

test('CR-091: changing what a card shows re-fits the cards', () => {
    const ui = readFileSync(new URL('../app/js/ui.js', import.meta.url), 'utf8');
    const body = ui.slice(ui.indexOf('export function setCardTextMode'));
    assert.match(body.slice(0, body.indexOf('\n}\n')), /fitCardsAndCommands\(\);/);
});

test('CR-092: a new version waits for a quiet moment before restarting the app', () => {
    const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
    assert.match(html, /if \(window\.__aacReloadIfIdle\) window\.__aacReloadIfIdle\(\);/);
    assert.match(appSource, /window\.__aacReloadIfIdle = reloadForUpdateIfIdle;/);
    const f = appSource.slice(appSource.indexOf('function reloadForUpdateIfIdle'));
    assert.match(f.slice(0, 400), /conversationInProgress\(\)/);
});

test('CR-104/CR-106: named regions carry a role, and Settings is named', () => {
    const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
    for (const id of ['listenControls', 'composerOverlay', 'epGrid']) {
        assert.match(html, new RegExp(`id="${id}" role="group"`), id);
    }
    assert.match(html, /<dialog id="settingsDialog" aria-labelledby="settingsTitle">/);
});

test('CR-105: the cards are not a live region; a status line says they changed', () => {
    const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
    assert.match(html, /<div id="responseOptions" class="palette-grid">/);
    assert.match(html, /id="paletteStatus" class="visually-hidden" role="status"/);
    const ui = readFileSync(new URL('../app/js/ui.js', import.meta.url), 'utf8');
    assert.match(ui, /announcePalette\('New suggestions'\)/);
});

test('CR-103: only the conversation lines are a live region, and they update in place', () => {
    const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
    assert.match(html, /<div id="transcript" class="transcript-log">/);
    assert.match(html, /id="transcriptLog" role="log" aria-live="polite" aria-relevant="additions"/);
    const ui = readFileSync(new URL('../app/js/ui.js', import.meta.url), 'utf8');
    const body = ui.slice(ui.indexOf('export function renderConversation'));
    assert.match(body.slice(0, 2000), /node\.data = text/);
});

test('CR-107-110: choice groups, tabs, dialogs and the idle status are all named', () => {
    const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
    assert.equal((html.match(/class="radio-row">/g) || []).length, 0, 'every choice group has a role and a name');
    assert.match(appSource, /tab\.setAttribute\('aria-controls', panel\.id\)/);
    assert.match(appSource, /status === 'stopped' \|\| status === 'idle'\) \{/);
    const dlg = readFileSync(new URL('../app/js/confirm-dialog.js', import.meta.url), 'utf8');
    assert.match(dlg, /dlg\.setAttribute\('aria-describedby', p\.id\)/);
});

test('CR-111-114: editor buttons and pickers are named; rows select on focus; bands speak', () => {
    const ee = readFileSync(new URL('../app/js/express-editor.js', import.meta.url), 'utf8');
    assert.equal((ee.match(/row\.addEventListener\('focusin', \(\) => markPicked\(row, item\.id\)\)/g) || []).length, 3);
    assert.match(ee, /'Which person this button is for'/);
    assert.match(ee, /'Which partner the Flex phrases are for'/);
    assert.match(ee, /wrap\.dataset\.help = 'express' \+ key\[0\]\.toUpperCase\(\) \+ key\.slice\(1\)/);
    const cp = readFileSync(new URL('../app/js/control-phrases-editor.js', import.meta.url), 'utf8');
    assert.match(cp, /mkBtn\('✕', 'ee-del', 'Delete this phrase'\)/);
});

test('CR-115-118: practice fields named, focus kept, rows named, Review leaves no stray toggles', () => {
    const pe = readFileSync(new URL('../app/js/practice-editor.js', import.meta.url), 'utf8');
    assert.match(pe, /function nameFrom\(g, control\)/);
    assert.match(pe, /landFocus\(\);\n\}/);
    assert.match(pe, /`Delete \$\{s\.title \|\| '\(untitled\)'\}`/);
    const rv = readFileSync(new URL('../app/js/review-ui.js', import.meta.url), 'utf8');
    assert.match(rv, /el\.removeAttribute\('aria-pressed'\)/);
});

test('CR-119-122: Review quiets the log, empty slots leave the Tab order, latch labels survive a redraw, notes are described', () => {
    const rv = readFileSync(new URL('../app/js/review-ui.js', import.meta.url), 'utf8');
    assert.match(rv, /\$\('transcriptLog'\)\?\.setAttribute\('aria-live', 'off'\)/);
    const ui = readFileSync(new URL('../app/js/ui.js', import.meta.url), 'utf8');
    assert.match(ui, /if \(!onDefineCell\) \{ b\.tabIndex = -1; b\.setAttribute\('aria-disabled', 'true'\); \}/);
    assert.match(ui, /setPrivacyState\(lastPrivacy\);/);
    const wn = readFileSync(new URL('../app/js/whats-new.js', import.meta.url), 'utf8');
    assert.match(wn, /okBtn\.setAttribute\('aria-describedby', list\.id\)/);
});

test('CR-123-126: About Me named, chips pressed, gap metric honest, goodbyes drop choices', () => {
    const wv = readFileSync(new URL('../app/js/worldview-ui.js', import.meta.url), 'utf8');
    assert.match(wv, /c\.setAttribute\('aria-labelledby', 'wvq-' \+ field\.key\)/);
    assert.equal((wv.match(/'aria-pressed': String\(/g) || []).length >= 2, true);
    assert.match(appSource, /function handleSpeechResult\(liveText, partnerHeard = true\)/);
    const fast = appSource.slice(appSource.indexOf('if (windingDown && convLogic.looksLikeClosing(partnerText))'));
    assert.ok(fast.indexOf('setOfferedChoices([])') < fast.indexOf("renderStaticPalette('closing'"));
});

test('CR-127: every request for cards sends a moved partner turn once', () => {
    assert.doesNotMatch(appSource, /\[\.\.\.conversationHistory, \{ role: 'partner', text: (currentPartnerText|partnerText) \}/);
});

test('CR-128-130: goodbye listening starts a new turn, partner-led practice counts, cancel restores a closing', () => {
    const oc = appSource.slice(appSource.indexOf('function offerClosings'));
    assert.ok(oc.indexOf('metrics.turnBoundary()') < oc.indexOf('stt.startListening()'));
    const ap = appSource.slice(appSource.indexOf('async function advancePracticePartner'));
    assert.ok(ap.indexOf('noteConversationStarted()') < ap.indexOf('++generationToken'));
    assert.match(appSource, /engine\.restorePhase\(\{ phase: back\.phase, mode: back\.mode \}\)/);
});

test('CR-132/133: clearing the cards stops the reading clock; an opener set is recorded in the new conversation', () => {
    const cp = appSource.slice(appSource.indexOf('function clearPalette'));
    assert.match(cp.slice(0, 900), /cardsShownAt = 0;/);
    const hr = appSource.slice(appSource.indexOf('async function handleResponseSelected'));
    assert.match(hr, /noteUserAction\(opensNewConversation \? 'new conversation' : 'card'/);
    assert.match(hr, /await storage\.logOffer\(\{ kind: 'opener', options: shownAtTap \}\)/);
});

test('CR-134: New N over steering statements asks for different statements', () => {
    const rg = appSource.slice(appSource.indexOf('async function handleRegenerate'));
    assert.match(rg, /if \(!currentPartnerText && activeSteer\.lead && lastPalette\.length\)/);
    assert.match(appSource, /activeSteer = \{ focusChoice: null, steer: null, lead: null \};\n\}/);
});

test('CR-135-138: held choices survive Reframe, practice logs no mic, goal source kept, sound decision at the tap', () => {
    const rf = appSource.slice(appSource.indexOf('async function handleReframe'));
    assert.ok(rf.indexOf('setOfferedChoices(heldForComposer.offered') < rf.indexOf('dropHeldForComposer();'));
    assert.match(appSource, /source: activeGoals\.get\(g\.id\) \|\| g\.source/);
    const pa = appSource.slice(appSource.indexOf('async function playAudioTurn'));
    assert.ok(pa.indexOf("noteUserAction('express')") < pa.indexOf('await playClip('));
    assert.equal((pa.slice(0, 3000).match(/noteUserAction\('express'\)/g) || []).length, 1);
});

test('CR-140/141: a sent note is cleared; restore failures are said on the status line', () => {
    assert.match(appSource, /if \(res && \(res\.sent \|\| res\.queued\)\) \{\n\s*const box = document\.getElementById\('problemNoteInput'\);/);
    assert.match(appSource, /async function importFromFile\(file\)/);
});

// CR-148. A new pause must not forget the phrase just said.
test('the same holding phrase is never said twice in a row across pauses', async () => {
    storage.savePlaceholderSettings(0.005, 5, 1);
    const said = [];
    for (let i = 0; i < 40; i++) {
        resetSpoken();
        placeholders.arm();
        await sleep(25);
        if (spokenTexts[0]) said.push(spokenTexts[0]);
        placeholders.stop();
    }
    assert.ok(said.length > 30, `enough phrases spoken: ${said.length}`);
    for (let i = 1; i < said.length; i++) assert.notEqual(said[i], said[i - 1], `repeat at ${i}`);
});

test('CR-153: each Review edit is its own Undo step', () => {
    const rv = readFileSync(new URL('../app/js/review-ui.js', import.meta.url), 'utf8');
    const stop = rv.slice(rv.indexOf('function stopEditing'));
    assert.match(stop.slice(0, 400), /wordSnapshotTaken = false;/);
});

test('CR-160/161: paid listening is timed; a redrawn Express button keeps its armed state', () => {
    const stt = readFileSync(new URL('../app/js/stt.js', import.meta.url), 'utf8');
    const os = stt.slice(stt.indexOf('function openSource'));
    assert.ok(os.indexOf("noteListen('sessions')") < os.indexOf('if (externalSource)'));
    const tg = readFileSync(new URL('../app/js/tap-guard.js', import.meta.url), 'utf8');
    assert.match(tg, /if \(sameAsArmed\(m\.el\)\) \{ disarm\(\); return; \}/);
    const ui = readFileSync(new URL('../app/js/ui.js', import.meta.url), 'utf8');
    assert.match(ui, /cellEl\.dataset\.tapKey = /);
});

test('CR-163-166: dismissed corrections stay gone; dev copies stay silent; folder cancel; Back to the list', () => {
    const wv = readFileSync(new URL('../app/js/worldview-ui.js', import.meta.url), 'utf8');
    const re = /await [^;]+;[\s\S]{0,400}?e\.currentTarget/;
    assert.doesNotMatch(wv, re, 'no event target read after a wait');
    const ex = wv.slice(wv.indexOf('function renderExtra(name, back = renderHome)'));
    assert.match(ex.slice(0, 900), /onclick: \(\) => back\(\)/);
});

test('CR-167-169: forms keep the latest name and an unfinished Other; a practice pause keeps the line', () => {
    const wv = readFileSync(new URL('../app/js/worldview-ui.js', import.meta.url), 'utf8');
    assert.match(wv, /name: name \|\| lastName,/);
    assert.match(wv, /const relArg = \(relSelect\.value === OTHER && !relationship\) \? undefined : relationship;/);
    const ap = appSource.slice(appSource.indexOf('async function advancePracticePartner'));
    assert.match(ap.slice(0, 2500), /prior \? \[\.\.\.conversationHistory, \{ role: 'partner', text: prior \}\]/);
});

test('CR-171/172/174: discard asks first, a failed review save is logged, changing an answer keeps it', () => {
    const pe = readFileSync(new URL('../app/js/practice-editor.js', import.meta.url), 'utf8');
    assert.match(pe, /title: 'Discard this scenario\?'/);
    const rv = readFileSync(new URL('../app/js/review-ui.js', import.meta.url), 'utf8');
    assert.match(rv, /if \(!ok\) storage\.logError\('review save'/);
    const wv = readFileSync(new URL('../app/js/worldview-ui.js', import.meta.url), 'utf8');
    assert.doesNotMatch(wv, /voiceProfile\.clearAnswer\(item\.id\)/);
});

test('CR-180-182: one look for report boxes, scheme-colored dialogs, report link wired first', () => {
    const css = readFileSync(new URL('../app/css/styles.css', import.meta.url), 'utf8');
    assert.match(css, /#errorLogView, #usageSummaryView, #systemInfoView, #weeklyReportContents, #weeklySendLogView \{/);
    const dlg = css.slice(css.indexOf('.danger-dialog {'));
    assert.match(dlg.slice(0, 400), /background: var\(--surface-raised\);/);
    const init = appSource.slice(appSource.indexOf('function initApp()'));
    assert.ok(init.indexOf("getElementById('startReportBtn')") < init.indexOf('storage.setAppVersion'));
});

test('CR-183/184/186: resume aborts the ladder; no key asks nothing; every paid voice warns without a key', () => {
    const hr = appSource.slice(appSource.indexOf('function handlePartnerResumed'));
    assert.match(hr.slice(0, 1200), /abortPlaceholders\(\);/);
    const go = appSource.slice(appSource.indexOf('async function generateOptions'));
    assert.ok(go.indexOf("if (!(storage.loadApiKey() || '').trim())") < go.indexOf('llm.generateResponses'));
    assert.match(appSource, /setStatusLine\(radio\.value \+ 'VoiceStatus', 'warn'/);
});

// CR-196. The error box's Try again replaces what is on screen, so two-tap mode
// guards it like the cards beside it.
test('the response error retry button is under the two-tap guard', () => {
    assert.match(appSource, /tapGuard\.addRule\('#responseOptions \.response-error-retry'\)/);
});

// CR-206. A failure after Start is logged as 'uncaught:', not as a start-up failure,
// because the error log and the weekly report group by this label.
test('the global error handlers label a failure after Start as uncaught', () => {
    const fn = appSource.slice(appSource.indexOf('function reportStartupFailure'));
    const body = fn.slice(0, fn.indexOf('\n}\n') > 0 ? fn.indexOf('\n}\n') : fn.indexOf('\r\n}\r\n'));
    assert.match(body, /\(started \? 'uncaught:' : 'startup:'\) \+ where/);
    assert.ok(body.indexOf('started =') < body.indexOf('logError('), 'decided before logging');
});

// CR-211. Typing a speech key by hand sent one voice-list request per character, and a
// changed key kept the previous account's list. The list is cleared at once and fetched
// once typing stops, and only the newest answer is kept.
test('a typed service key clears the old voice list and fetches the new one once', () => {
    assert.match(appSource, /storage\.clearServiceVoiceCatalog\(id\);\s*clearTimeout\(voiceTimer\);\s*voiceTimer = setTimeout\(refreshVoices, 600\)/);
    assert.match(appSource, /if \(mine !== voiceSeq\) return/);
});

// CR-215. A second tap on Start while the first is still starting is ignored.
test('Start cannot run twice at once', () => {
    const body = appSource.slice(appSource.indexOf('async function handleStart() {'));
    assert.match(body.slice(0, 200), /if \(startInProgress\) return;\s*setStartBusy\(true\);/);
    const fin = appSource.slice(appSource.indexOf('function finishStart() {'));
    assert.match(fin.slice(0, 120), /setStartBusy\(false\)/);
});

// CR-218. Sound clips no longer on the panel are let go of, never the playing one.
test('clips no longer on the panel release their memory, but not the playing one', () => {
    const body = appSource.slice(appSource.indexOf('function primeExpressAudio(items) {'));
    const fn = body.slice(0, body.indexOf('\nfunction ') > 0 ? body.indexOf('\nfunction ') : 2000);
    assert.match(fn, /URL\.revokeObjectURL\(url\)/);
    assert.match(fn, /audioPlayer && audioPlayer\.item\.file === name/);
});

// CR-234. In Review, the global "any button puts the panel back" rule stands aside, and
// leaving Review puts the live panel back on its first page.
test('review keeps its own Express Panel paging, and leaving it resets the panel', () => {
    const at = appSource.indexOf('if (!expressPaging) return;');
    assert.ok(appSource.slice(at, at + 400).includes('if (reviewUI.isActive()) return;'));
    const fn = appSource.slice(appSource.indexOf('function restoreConversationScreen() {'));
    assert.match(fn.slice(0, 200), /resetExpressPaging\(\)/);
});
