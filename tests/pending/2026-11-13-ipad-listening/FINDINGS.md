# iPad listening and speaking: problems found in the November 13 2026 changes

**Status: found and proved, NOT fixed.** Found on November 13 2026, when Ken asked for a
hunt for hidden bugs in releases 0.15.2 to 0.15.8. The TODO.md entry "iPad listening: fix
the problems found in the November 13 changes" points here.

Each problem below says what goes wrong, the steps that trigger it, how sure the finding
is, and how serious it is for a user. The "For the fix" lines are notes for the developer
and name the code involved.

## The proof tests in this folder

Each `N-*.proof.mjs` file drives the app's REAL listening code (stt.js, the three paid
hearing sources, audio-session.js, vad.js, mic-check.js) with a fake microphone, fake
audio and a fake service connection. `harness.mjs` holds the fakes.

- **They pass only while the problem is present.** Each one asserts the wrong behavior.
  After a fix, its proof fails: rewrite it to assert the right behavior and move it into
  `tests/` (for example `tests/stt-pause.test.mjs`).
- **`controls.proof.mjs` asserts the right behavior** for paths that are already correct.
  It must still pass after the fixes; move it into `tests/` too.
- **`npm test` does not run this folder**, because the files are not named `*.test.mjs`.
  Run it on its own:

      node --test "tests/pending/2026-11-13-ipad-listening/*.proof.mjs"
      node tests/pending/2026-11-13-ipad-listening/7-voice-variation.mjs

- When every problem is fixed or dropped, delete this folder and the TODO entry, saying
  which.

## What was reviewed, and what was not

**Reviewed:** every listening and speaking change in `5f441d0..e1453d1`: audio-session.js
(new), stt.js, stt-deepgram.js, stt-azure.js, stt-rest.js, the one-line change in each of
tts-deepgram.js, tts-azure.js and tts-rest.js, vad.js, mic-check.js, diagnostics.js,
weekly-send.js and the two `unlockCapture()` lines in app.js. Also the older code those
changes depend on: how tts.js reports speech starting and ending, the holding-phrase
ladder, and the Listen button's handling in app.js. Effects on computers, Android and the
iPad Safari tab were checked, not only the iPad.

**Glanced at, nothing behavioral:** the version bumps, the About license line, the
published-PDF list, and release notes.

**Not reviewed:** the rest of the listening and speaking code that did not change that
day, and the rest of the app. Two older problems turned up in passing (1b and the last
item under 9).

## Decisions that are not to be reopened

From CLAUDE.md, iPad section, November 13 2026. A fix must keep all of these:

- On an iPad with paid hearing **the microphone is closed while the app speaks**, and the
  pause is **invisible**: the Listen button stays lit and no "listen off/on" is recorded.
- **Words the partner says WHILE a phrase plays are not heard.** Ken's accepted cost,
  with his reasoning: in ordinary conversation nobody expects to be heard while talking
  over someone.
- The **room-following speech bar**, with its accepted cost that a cough or a door in a
  quiet room is more likely to be sent and billed.
- **Call processing is ON on an iPad again** (turned back on for 0.15.9 after Kenny's
  0.15.8 report; it was off from 0.15.3 to 0.15.8). The **x5 boost**, which was sized for
  processing off, is **removed** (Ken, November 13 2026, "Yes, remove it"); the paid
  voices play straight to the speakers again. The audio-mode switching stays.
- **A holding phrase always finishes** (October 9 2026): stopping listening must not cut
  it off.

**Coordinate problems 7 and 8 with the TODO entry "Kenny's quiet iPad microphone".** Call
processing is back on for 0.15.9 because with it off the iPad input was about 50 times
quieter (Ken's voice 0.26 to 0.005; Kenny's wife under 0.0005, so nothing was heard). With
it on, Kenny's wife reached 0.008 on 0.15.2, only twice the speech gate's 0.004 minimum,
so quiet setups like his are still the ones problem 7 affects. An input gain, if one is
added later, would change every level again.

---

## 1. The Listen button stays lit with nothing listening, and tapping it does nothing

- **What goes wrong:** the button stays lit and the screen looks normal, but nothing the
  partner says is heard. Tapping Listen neither turns it off nor back on.
- **Steps:** iPad, paid hearing, listening. A holding phrase ends and the app starts
  reopening the microphone. Before the iPad hands it over, the user leaves the app and
  comes back. The return asks to listen again, but that request is ignored because one is
  already in progress; the first request then gives up because leaving the app cancelled
  it.
- **How it ends:** only when the user chooses a conversation opener, or the app is
  reloaded. With automatic listening on it also ends after the user's next reply, unless
  they tapped Listen in the meantime (a tap switches automatic listening off).
- **How sure:** proved, `1-stuck-lit.proof.mjs` test 1a. How often it can happen depends
  on what an iPad does with a microphone request when the app goes to the background
  (device check 2).
- **How serious:** high when it happens.
- **1b, an older gap that is now easier to reach:** turning Listen off and straight back
  on while the microphone is reopening starts nothing; one more tap is needed. Proved,
  test 1b.
- **For the fix:**
  - Cause, part one: in all three sources `start()` returns early on
    `if (starting) return true;` without setting `wanted = true`, so stop-then-start
    during a pending start leaves `wanted` false and the pending start abandons itself at
    its `!wanted` check (the CR-083 logic).
  - Cause, part two: `suspendSource()` clears `pausedForSpeech`/`resumingForSpeech` and
    stops a source that is not running, so no "stopped" is sent; `stopListening()` sends
    "stopped" itself only when `wasPaused`. The app's `isListening` therefore stays true,
    every tap takes the stop branch of `toggleListening()`, and nothing ever reports back.
  - Suggested: (a) in each source, `if (starting) { wanted = true; return true; }`;
    (b) in `stt.stopListening()`, send "stopped" whenever the paid source was not running
    before the stop, as the built-in path already does ("reporting it twice is
    harmless"). Do both: (a) fixes 1a and 1b, and (b) makes any future variant
    recoverable with one tap.

## 2. The Listen button stays dark while the app is listening

- **What goes wrong:** the partner's words appear and are sent to the service and billed,
  but the button says listening is off. The saved conversation records "listen off" with
  no "listen on". One more tap lights it.
- **Steps, either of these:**
  - **2b, iPad with Deepgram:** tap Listen, then tap "Ask them to repeat" or "Hold on" in
    the second or so before the connection to Deepgram opens. The microphone closes for
    the phrase and reopens after it, and the "listening" signal from the reopen is hidden
    on purpose. Here it was the only one, so the app is never told it is listening.
  - **2a and 2c, any paid service:** after a holding phrase, the microphone cannot reopen
    because the iPad's listening audio will not start without a tap. The button goes dark,
    which is right, but the user's next Listen tap starts listening without lighting it.
- **How sure:** proved, `2-dark-while-listening.proof.mjs` (Deepgram both ways, Azure the
  second way). What stops the listening audio by itself is device check 4.
- **How serious:** medium. It is the same kind of mismatch as the August 3 2026
  Listen-button bug: the user may tap again, and the record is wrong.
- **For the fix:**
  - `resumingForSpeech` in stt.js swallows the first "listening" after
    `resumeAfterSpeech()`, assuming the app already shows listening. In 2b the pause
    happened after Deepgram's `start()` set `running = true` but before `ws.onopen`, so the
    app never had "listening". In 2a/2c the reopen's `start()` failed at
    `audioSession.wake()` and sent "stopped" (Deepgram, Azure) or "idle" (REST), not
    "error", which passes through but leaves `resumingForSpeech` set, so the next real
    "listening" is swallowed.
  - Suggested: remember whether "listening" has actually been passed to the app (set when
    one passes, cleared when "stopped", "idle" or "error" passes) and swallow only when it
    has. Clear `resumingForSpeech` when "stopped" or "idle" arrives while it is set.

## 3. Azure, Google Cloud and ElevenLabs throw away words said just before a holding phrase

- **What goes wrong:** when the microphone closes for a holding phrase, these services
  also throw away the sentence the partner was in the middle of, and any finished
  sentence still being transcribed. These were said BEFORE the phrase started; Ken's
  accepted cost was words said during it. They are not shown, saved, or sent to the AI;
  a finished sentence is still billed.
- **Steps:** iPad Home Screen app with Azure (the recommended service). The partner says
  a sentence, pauses briefly, and says another ("How was your weekend? Did you do anything
  fun?"). In the first exchange of a conversation, the first holding phrase starts about
  4 seconds after the first pause (transcription about 1 second, the half-second silence
  period, the 2-second first delay). If the second sentence is still being spoken, or still
  on its way back from the service, at that moment, it is lost. Later exchanges wait
  longer before the first phrase, so the window moves later.
- **How sure:** proved, `3-azure-words-lost.proof.mjs`: the same steps keep the sentence
  on a computer and lose it on an iPad. How often the timing lines up needs the device.
- **How serious:** high for the recommended iPad setup. The partner's question vanishes
  and the suggestions answer the earlier sentence. Deepgram loses much less, because what
  was already shown on screen is kept.
- **For the fix:**
  - `pauseForSpeech()` calls `externalSource.stop()`, the same stop as a user stop. In
    stt-azure.js and stt-rest.js `stop()` drops an open span (CR-157) and bumps
    `generation`, so in-flight `submit()` results are discarded. Right for a user stop,
    wrong for a pause the source will resume from.
  - Suggested: a separate pause path for the sources, used only by `pauseForSpeech()`:
    close and submit the open span as if the gate had closed (keeping the
    `MIN_SPEECH_MS` test), and do not bump `generation`, so results already in flight
    land. A later user stop must still discard. Results that land while the app speaks are
    committed by `ingest()`, and the silence checkpoint waits for the speech tail, which is
    the right order.
  - Deepgram: closing the socket at once loses the last fraction of a second not yet
    shown. Sending `Finalize` and waiting briefly before closing would recover it;
    optional.

## 4. The iPad's recording mode is left on with no microphone

- **The loud half of this problem is gone:** Ken removed the x5 boost on November 13
  2026, so the paid voices can no longer be left five times louder. What remains is the
  iPad's recording mode ("play-and-record") left on with no microphone, and the
  microphone asked for after the user asked to stop.
- **What went wrong before the boost was removed:** paid voices played five times louder
  through the limiter with no microphone open to make the iPad turn them down.
- **Steps, either of these:**
  - **4a:** a microphone reopen fails as in problem 2. Recording mode stays on until
    listening next stops; choosing a reply or an Express phrase puts it right.
  - **4b and 4c:** End conversation, or turning Listen off, while a holding phrase plays.
    Both make the app ask the iPad for the microphone again the moment the phrase ends,
    then let it go (4b). That part happens every time, and the iPad's microphone
    indicator may come on after the user asked for listening to stop. If the iPad refuses
    that request because of its audio mode (likely, since the app has just set playback),
    the automatic retry switches back to recording mode, and nothing switches it off
    (4c).
- **How sure:** proved, `4-boost-and-record-mode.proof.mjs`. Whether the iPad refuses
  that request is device check 3.
- **How serious:** medium-low now the boost is gone: a microphone that comes on after
  the user turned it off, and recording mode left on.
- **For the fix:**
  - 4a: `forListening()` runs before `externalSource.start()` (`reallyOpen()`,
    `resumeAfterSpeech()`); when `start()` fails at `wake()` it sends "stopped"/"idle" and
    nothing calls `audioSession.forSpeaking()`. Call it when a source reports a stop that
    nobody asked for.
  - 4b: `terminateConversation()` calls `tts.cancel()` before `stt.stopListening()`; the
    cancel reports the speech ended, `noteSpokenEnd()` runs `resumeAfterSpeech()` while
    the intent to listen is still set, and the stop then cancels that reopen.
    `toggleListening()`'s `micClosePending` path waits for the phrase to end before
    stopping, so the phrase end always reopens first. Suggested: in
    `terminateConversation()` stop listening before cancelling speech; in
    `toggleListening()`, when stt is paused for speech, stop at once. The reason for
    waiting (not cutting the phrase off) does not apply when the microphone is already
    closed. Keep the October 9 rule: stopping must not cut the phrase off.
  - 4c: `openMic()`'s InvalidStateError retry calls `forListening()` with no way to know
    the start was cancelled. Give it a "still wanted?" check so a cancelled start neither
    retries nor switches the mode.

## 5. A slow reopen lets the user's next phrase play with the microphone open

- **Steps:** tap Hold on, Say again or Ask them to repeat while a holding phrase plays.
  The user's phrase waits for the holding phrase, then half a second more. If the iPad
  takes longer than that to hand the microphone back, the microphone opens partway
  through the user's phrase, so that phrase gets the quiet or phone-call sound the
  November changes removed.
- **How sure:** proved, `5-mic-open-during-phrase.proof.mjs`, with a 0.7-second handover.
  The real handover time is device check 1.
- **How serious:** medium-low: the sound of one phrase.
- **For the fix:** `canPauseForSpeech()` requires `externalSource.isRunning()`; during a
  reopen the source is not running yet, so `noteSpokenStart()` does not pause, and the
  reopen then completes mid-phrase. `speakUserStatement()` waits for the placeholder plus
  500 ms. Suggested: in `noteSpokenStart()`, if a reopen is in flight, cancel it and stay
  paused, so the next `noteSpokenEnd()` reopens once. Mind fix 1(a), which changes how
  stop-then-start behaves during a pending start.

## 6. Leaving the app while the microphone reopens can switch listening off with a false error

- **Steps:** leave the app just after a holding phrase ends. If the iPad refuses the
  microphone request because the app is now in the background, the app treats it as a
  real microphone failure: red wash, an error in the log, and listening is not restored
  on return.
- **How sure:** proved, `6-background-during-reopen.proof.mjs`, assuming the iPad refuses.
  This and problem 1 are the two possible outcomes of the same moment (device check 2).
- **How serious:** medium-low. One Listen tap fixes it, but the error is false.
- **For the fix:** each source's `start()` sends "error" from the `openMic()` catch without
  checking `wanted`, and stt.js `handleSourceError()` then clears the intent to listen, so
  the background guard does not reopen on return. If `wanted` is false, release and return
  quietly: no error, no "stuck" count.

## 7. A quiet partner who is already talking is measured as "the room"

- **What goes wrong:** the speech bar follows the room's quiet level, measured afresh
  each time the microphone opens. For the first second the old fixed bar (0.020) applies.
  If a quiet partner is talking during that second, their own voice is measured as the
  room, and the bar is set above it.
- **When:** quiet input (see the note under "Decisions"), and the microphone opens while
  the partner is talking: at the start of each turn with automatic listening, and on an
  iPad after every holding phrase.
- **How sure:** proved with a made-up voice, `7-gate-measures-speech.proof.mjs`. The
  room-following bar itself works: quiet speech after a quiet room is sent. A steady quiet
  voice that starts first was never sent in 10 seconds. `7-voice-variation.mjs` shows it
  depends on how much the voice varies: when its loudest sounds are 4 or more times its
  quietest, it gets through after 1.2 to 1.7 seconds and the 1.2-second pre-roll keeps its
  start. So real voices may be fine; Kenny's reports (the `levels:` line) should show it.
- **How serious:** medium, for quiet setups like Kenny's (see the note under
  "Decisions"). Partners louder than 0.020 are never affected.
- **For the fix:** every source's `start()` calls `vad.createGate()`, and the floor starts
  unknown (`floor = null`; the fixed bar applies for `floorMinMs`). Suggested: carry the
  last measured floor from one gate to the next (same microphone, same room), for example
  a module-level value in vad.js or an `initialFloor` option, so a reopen starts with the
  room known.

## 8. A steady noise that starts during speech holds the speech gate open

- **What goes wrong:** in a quiet room the level that means "speech has ended" drops to
  about 0.0024 and stays fixed while the gate is open. A fan, heater or kettle that starts
  while the partner talks keeps the gate open, so everything is sent and billed while it
  runs. In the proof the old fixed gate closed after 3 seconds; the new one stayed open for
  the whole 5 minutes.
- **Where:** on an iPad the next holding phrase resets it. On a computer or Android device
  with paid hearing it lasts until listening stops.
- **How sure:** proved with the real gate and a simulated fan,
  `8-gate-held-open.proof.mjs`. How loud real fans are at the microphone needs a device.
- **How serious:** low to medium. With Deepgram it costs about 46 cents an hour while
  open. With Azure, Google and ElevenLabs, long clips of noise (50 or 25 seconds) go off
  for transcription, with some chance of invented words.
- **For the fix:** vad.js closes at `openLevel() * closeShare`, and the floor is not
  measured while the gate is open. Suggested: let the room estimate follow slowly while
  open (for example the lowest level over the last few seconds), so a lasting noise raises
  the closing level. Keep the existing vad.js tests passing.

## 9. Smaller things

- **9a, report lines:** right after each reopen the problem report says
  `quietRoom=not measured` and shows the old 0.020 bar, because mic-check.js keeps only
  the newest gate's levels. Every holding phrase also adds one to `starts=`. Keep the last
  measured room level, and consider counting reopens for speech separately. Proved, 9a.
- **9b, "stuck" for a cancelled start:** a start the user had already cancelled is
  counted as "stuck: audio would not start" if its audio was slow to wake. Check `wanted`
  before `micCheck.noteStuck()`. Proved, 9b.
- **The saved conversation does not record the microphone closing** during holding
  phrases, so it cannot be rebuilt to the second (CLAUDE.md, "can it be recreated to the
  second"). The invisible button is Ken's decision; a quiet entry in the file, such as
  "mic closed for speech" and "mic reopened", would not change the screen.
- **Every device now runs a listening audio channel all session:** `unlockCapture()` in
  `handleStart()` and `toggleListening()` makes and wakes it on every device and with
  every hearing source, including computers, Android with free hearing and the iPad
  Safari tab with built-in recognition, which were meant to be unchanged. No harm was
  seen. Consider calling it only when a paid source is in use.
- **Leftover audio pieces:** each source's `start()` connects
  `processor -> mute (gain 0) -> destination`; `stop()` disconnects the processor and the
  microphone node but never `mute`, and the shared context is never closed, so silent
  nodes build up on the destination for the life of the page. Disconnect `mute` in
  `stop()`.
- **Safari on a Mac:** `forListening()`/`forSpeaking()` set the audio mode wherever
  Safari offers it, which may include a Mac with paid hearing, although audio-session.js
  says the Mac is unchanged. Probably no effect; check, or limit it to `isIOS()`.
- **Automatic listening after a reply does not wake the listening audio.** A reply tap is
  a real tap, but only Start and Listen call `unlockCapture()`. If the listening audio was
  stopped by an interruption, automatic listening fails at the wake limit and the button
  goes dark. Consider calling it on response-card and Express taps too.
- **Older than November 13, found in passing:** in stt-deepgram.js `start()`, if
  `new WebSocket(...)` throws (for example a key with a space inside it), the microphone
  stream is never released, and `stop()` returns early because `running` is false. The
  microphone stays on. Release the stream in that catch.

## Checked and fine

- Turning Listen off while the microphone is closed for a phrase (existing test in
  tests/stt-deepgram.test.mjs).
- Changing the hearing service in Settings in the middle of a phrase (control 1).
- A microphone error while reopening: listening goes off cleanly and the next tap works
  (control 2).
- Two holding phrases overlapping: one close, one reopen, no flicker (control 3).
- Leaving the app during a holding phrase: listening comes back on return (6-control).
- The 1.5-second wake limit leaves no microphone, connection or timer behind.
- Computers, Chromebooks and Android: no closing for speech, no boost, the same
  microphone request as before; the audio-mode setting does nothing where the browser
  lacks it (every Chromium browser).
- The iPad's own recognition in a Safari tab: closing for speech and the audio mode
  apply only to paid hearing.
- Noisy rooms: the bar never rises above the old 0.020, so billing there is unchanged.
- The weekly report's change detection ignores the new audio-mode line, as it should.

## Only a real iPad can show

1. How long the iPad takes to hand the microphone back after a holding phrase. This
   decides how often problems 1, 3 and 5 happen.
2. Whether the iPad finishes, holds or refuses a microphone request when the app goes to
   the background. This decides between problems 1 and 6.
3. Whether the iPad refuses the request made just after playback mode is set (4c).
4. What stops the listening audio by itself (a phone call, Siri, an alarm, the lock
   screen, another app's sound) and whether it starts again on its own (2a, 2c, 4a).
5. Whether reopening the microphone after every holding phrase ever brings back the
   permission prompt, on other iPads or iOS versions.
6. Real quiet voices against the speech bar (problem 7): Kenny's reports.
7. AirPods or another Bluetooth headset connected partway through a session, now that the
   listening audio is set up once at Start rather than at every listening start.

## When fixing

- Run the proofs first: they should pass. Fix one problem at a time, and its proof should
  then fail; rewrite it to assert the right behavior in `tests/`.
- `npm test` must pass, and the controls must still pass.
- These problems shipped to testers (0.15.6 to 0.15.8), so user-visible fixes get plain
  "Fixed:" bullets in `CHANGELOG.md` under Unreleased.
- Update the CLAUDE.md iPad section where behavior changes, and the TODO.md entry.
- Commit locally; do not push (RELEASING.md).
