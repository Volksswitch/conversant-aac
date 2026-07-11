/* "What's new" post-update notice.
 *
 * Conversant auto-updates itself on launch (a redeployed sw.js activates and the
 * controllerchange handler in index.html reloads the page — see index.html). After
 * that silent update, the freshly-loaded build shows the user a short, plain-language
 * summary of what changed since the version they last saw, so an update never happens
 * invisibly. Modeled on the Keyguard Designer web app's "What's new" system.
 *
 * The notes are BUNDLED in the app (the RELEASE_NOTES map below), not fetched — so
 * the notice works even offline / on locked-down networks: the freshly-loaded app
 * already IS the new version, so it carries its own notes.
 *
 * RELEASE_NOTES is generated from the user-facing CHANGELOG.md by
 * scripts/apply-release-notes.mjs (trigger: "apply release notes"). Do NOT edit the
 * block between the @@RELEASE_NOTES markers by hand — edit CHANGELOG.md and regenerate.
 */

import * as storage from './storage.js';

// Clinician/user-facing "What's new" notes, keyed by app version string
// (major.minor.patch). Versions with no user-visible change simply have no key.
// @@RELEASE_NOTES_START@@
const RELEASE_NOTES = {
  "0.5.84": [
    "Fixed: wind-down replies now show the right number of cards. When the other person replied to your wind-down and the app offered your goodbyes again, it showed eight of them even when you'd chosen one card per category. It now matches your setting — four cards (or eight, if you picked eight).",
    "You can now Tab between the controls in the \"In my own words\" box. Pressing Tab (or Shift+Tab) on a physical keyboard cycles through the typing box and the Speak, Reframe, and Cancel buttons instead of jumping away to controls behind the box.",
    "Keyguard-design settings are together on the Keyguard Design tab. \"Keyboard separation\" moved there from Speech & Input, and a new \"Transcript separation\" sets the gap between the transcript and the buttons below it (by making the transcript a little shorter). Both leave room for a keyguard bar without moving any button holes."
  ],
  "0.5.83": [
    "About Me now opens like every other Settings tab. Instead of taking over the whole screen with its own title bar and \"Done\" button, About Me appears in the panel next to the Settings tabs, just like General, Text Size, and the rest. Use the same Close button to return to the conversation.",
    "Save and reload your settings as named profiles. In Settings → General → Settings profiles, you can now save all of your settings (voice, silence period, dock and layout, button and gap sizes, tap mode, text sizes, placeholders) under a name, and bring them back later in one tap. Handy for keeping a known setup to return to, or copying your setup to another device — the profiles are stored in your data folder. Your API key and cost counters are not included.",
    "Fixed: saying goodbye no longer repeats the other person's last words. When you picked several farewells in a row from Wind down (for example \"Great seeing you,\" then \"This was really nice,\" then \"Bye!\"), the other person's final sentence was wrongly repeated in the conversation before each of your goodbyes. It's now recorded just once, the way it was actually said."
  ],
  "0.5.82": [
    "The app no longer goes quiet trying to guess when the other person is finished. Every time the other person pauses, it offers response suggestions (and refines them if they keep talking), until you pick one or end the conversation — you decide when their turn is over, not the app. This removes a whole class of glitch where a conversation you started could stall with no responses and no thinking-out-loud placeholder."
  ],
  "0.5.81": [
    "Fixed: conversations you start yourself now work. When you opened a conversation with a starter (for example \"Hi Tyler, got a minute?\") and the other person replied with a short go-ahead (\"Yeah, sure — any time\"), the app could go silent: no thinking-out-loud placeholder and no suggested responses. It now correctly treats their reply as your cue to lead and offers responses as expected."
  ],
  "0.5.80": [
    "Fixed a leftover clipped-looking border on the \"In my own words\" box. A thin framing line around the box had a rounded corner that got cut off at the edge of the response area, making it look broken. It's now flush and borderless, matching the response cards behind it."
  ],
  "0.5.79": [
    "The app keeps working when the AI can't be reached. If the AI service (or your internet) is unavailable, response suggestions can't be generated — but the partner's words are still shown in the transcript in blue italics (raw, since the AI couldn't tidy them up), the transcript takes on a faint red tint to flag the hiccup, and the problem is recorded in the error log. You can keep the conversation going with the Express Panel and \"In my own words\" — everything you say is spoken, shown in the transcript, and saved as usual. (Note: the browser's speech recognition itself needs an internet connection, so with no internet at all the partner's words can't be transcribed — the red tint is your signal that something's wrong.)",
    "Cleaner \"In my own words\" box. The typing box no longer draws a border around itself, and the Cancel button now has the same dark border as Reframe."
  ],
  "0.5.78": [
    "When the partner asks you to repeat, all three options now show the actual words. If the partner doesn't catch what you said, the \"say it again / say it differently / explain it more\" choices now display the real, ready-to-speak sentences on the cards (prepared the moment they ask), so you can read and pick — instead of showing a label and only producing the wording after you tap.",
    "\"Don't save this conversation\" now covers everything. When a conversation is marked not to be saved, the partner's words are also kept out of the app's error records and out of any copied bug report — previously a technical hiccup could still tuck a snippet of what the partner said into those. Nothing from a private conversation is written down now.",
    "With 8 response cards chosen, you now see 8 slots everywhere. When \"Suggestions per category\" is set to 2 (8 cards), the response area now shows eight slots when the app opens and between turns — not four — so it matches what you see while choosing a reply, and a keyguard lines up the same way throughout.",
    "More conversation closings, so \"Wind down\" fills all eight. There are now eight built-in closings (added \"I need to head out.\", \"Let's talk again soon.\", \"Take care!\", \"Catch you later.\") to match the eight starters, so an 8-card layout fills every slot when you start or end a conversation.",
    "New built-in starters and closings now appear automatically. When an update adds new default conversation starters or closings, they're added to the end of your existing list on their own — you no longer have to reset to see them. Anything you've edited or removed is still respected: your own wording stays, and a card you deleted won't come back.",
    "A placeholder now plays after anything the partner says — including a greeting. Previously the \"I'm thinking…\" placeholders only played after a question. Now the partner always hears a short response coming while you choose, so they're never left wondering whether you heard them or can communicate. After a question you'll hear a question-style \"Good question.\"; after a greeting or statement, a neutral \"Let me see.\" / \"One moment.\" (The initial delay and the per-turn limit still apply, so a quick pick plays none, and you can still set the limit to 0 to turn placeholders off.)"
  ],
  "0.5.77": [
    "Interrupting the partner now records what they had said. If you cut in with an instant statement (like a \"Bye\" Express phrase) while the partner is still talking, the words they'd said up to that point are now saved in the transcript — placed just before your interruption — instead of vanishing. If auto-listen is on, the partner keeps being recorded afterward too if they continue."
  ],
  "0.5.76": [
    "Errors are now saved inside the conversation file, in order. If something goes wrong during a conversation, the problem is written into that conversation's saved record at the moment it happens, in time order with what was said — so a support report shows exactly what failed and when. (Your turns were already saved as they happened; this adds the errors alongside them.)",
    "Each conversation is saved to its own file again. A second conversation in the same session no longer gets appended to the first conversation's file.",
    "More ways to start a conversation. Five new conversation starters were added, and when you have \"Suggestions per category\" set to 2 (eight cards), Start conversation now fills all eight cards with different openers.",
    "Your own statements go straight into the transcript. When you pick a response, type your own words, or tap an Express phrase, it is added to the conversation right after it has been spoken, instead of appearing first as a faint \"about to say\" preview line. That preview line is now only used for the app's place-holding phrases.",
    "\"Repeat what I said\", \"Hold on\", and \"Ask them to repeat\" now appear in the transcript. Anything the app says out loud for you is now part of the written conversation.",
    "Saying goodbye is quicker. After you pick a wind-down or closing line, the closing options (including \"Bye!\") stay on the cards so you can sign off without waiting for the other person to reply first.",
    "\"In my own words\" while you hold the floor now suggests statements to steer the conversation. If you've just spoken and it's your turn to lead, type where you'd like things to go and tap Reframe — the app offers statements that take the conversation there, instead of replies to a question.",
    "Fixed-purpose buttons show an icon. Buttons whose job never changes (like \"In my own words\") now show a clear icon with a tooltip, matching the rest of the control buttons."
  ],
  "0.5.75": [
    "The conversation area turns faintly red if the app hits a problem. If something goes wrong while getting responses, the conversation box gets a soft red tint — a quiet heads-up that a hiccup happened and things may act oddly for a moment (and worth mentioning if you report it). It clears on its own the next time responses come through normally, or when you start or end a conversation."
  ],
  "0.5.73": [
    "Error reports now include the conversation. The error log groups errors by the conversation they happened in (newest first), and Copy puts a full report on the clipboard — each conversation's transcript together with its errors — so you can send the whole picture, not just the error message."
  ],
  "0.5.72": [
    "The app now keeps an error log you can look at. When something goes wrong — most importantly when the AI doesn't return any response options — it's recorded with a timestamp and the conversation it happened in, so a problem from a live demo leaves a trace. View it in Settings → About → Error log (with Copy and Clear); it's also saved as errors.log in your data folder.",
    "You now see why response options didn't appear. If a generation request fails, the response area shows the reason and a Try again button instead of just sitting empty."
  ],
  "0.5.71": [
    "Word prediction: tap the box to accept a suggestion, not space. The suggested word completion is now taken only when you tap anywhere in the typing box — typing a space, comma, period or Enter no longer accepts it. This fixes cases like typing \"Yes\" and ending up with \"Yesterday\" when you only wanted \"Yes\" followed by a space (which could happen without you even seeing the box)."
  ],
  "0.5.70": [
    "The on-screen keyboard now stays put when you open \"In my own words.\" On the tablet the keyboard could still fail to appear (or vanish immediately) when the typing box opened — especially right after using an Express Panel phrase. It now stays up the whole time the typing box is open, in both the side and bottom layouts.",
    "A \"Reload the app\" button in Settings → About. Forces a fresh reload to pick up the latest version — the same as a hard refresh, but without needing to attach a keyboard to press Ctrl+Shift+R.",
    "\"In my own words\" buttons are now a single row in the side layout too. Speak, Reframe and Cancel sit in one horizontal row in both the side and bottom layouts (previously Speak and Reframe were stacked in the side layout)."
  ],
  "0.5.69": [
    "Conversations you start yourself are now saved. When you opened a conversation with an opener or an Express Panel phrase, that first thing you said wasn't being recorded — and if the whole conversation was just you speaking (no partner captured), nothing was saved to your data folder at all. Now the conversation is recorded from your very first words.",
    "The keyboard now always appears when you open \"In my own words.\" In some situations — especially right after using an Express Panel phrase — the typing box could open without the on-screen keyboard showing. It now comes up reliably.",
    "The \"In my own words\" buttons now line up with the response cards. Speak and Reframe sit exactly over the response-card area and Cancel over the \"New 4\" button, so a single keyguard fits both the response cards and the typing buttons — in both the side and bottom layouts."
  ],
  "0.5.68": [
    "The \"What's new\" notice is easier to read — it fills the transcript area, drops the header line, and moves the Close button up next to the title, so more of the space is given to the list of changes."
  ],
  "0.5.67": [
    "The \"What's new\" notice now appears in the transcript area (rather than centered on the screen), so it stays clear of a keyguard. Press Start to see it, then tap \"Got it\" to begin."
  ],
  "0.5.66": [
    "The \"What's new\" notice now appears right after you press Start, instead of on the opening screen. It stays up until you tap \"Got it\", so you can read it at your own pace."
  ],
  "0.5.65": [
    "The temporary welcome line beneath the Start button has been removed.",
    "The \"What's new\" notice now stays on screen until you dismiss it. It no longer disappears on its own when the app finishes updating — read it at your own pace, then tap \"Got it\" (or just press Start)."
  ],
  "0.5.64": [
    "A short welcome line now appears beneath the Start button on the opening screen."
  ],
  "0.5.62": [
    "See what's new after an update. When the app updates itself to a newer version, it now shows a short \"What's new\" summary of the features and fixes you've just received, so you always know what changed. You can also reopen it any time from Settings → About → \"See what's new in this version\"."
  ],
  "0.5.61": [
    "Cleaner About Me pages. Removed the redundant back button from the bottom of the About Me question pages; use the \"‹ Back to topics\" link at the top."
  ],
  "0.5.60": [
    "\"Prefer not to say\" no longer erases your answer. Marking a question as \"Prefer not to say\" now keeps whatever you had already entered, hidden from the AI, and an Undo brings your answer back. Previously it could discard an answer you had saved.",
    "Clearer buttons in About Me. The button that returns to the topic list is now labeled \"‹ Back to topics\", so it's no longer confused with the Done button that closes About Me.",
    "Simpler setting names. \"Minimum gap\" is now Minimum spacing, \"Optional Responses silence period\" is now Silence period, and the two \"Placeholder Statement Delay\" settings are now Initial placeholder delay and Subsequent placeholder delay."
  ],
  "0.5.59": [
    "\"Don't save this conversation.\" A new button on the command bar lets you keep the current conversation from being written to your data folder — useful for a private exchange you don't want stored. You can also set this as the default for every conversation in Settings → Conversation.",
    "Adjust text sizes. A new Text Size tab in Settings lets you set the size of the response cards, the transcript, the \"In my own words\" box, and the Express Panel buttons independently.",
    "Placeholders no longer talk over a returning partner. If the other person pauses and then keeps speaking, any \"still thinking\" placeholder that was about to play is now cancelled so it doesn't speak over them."
  ]
};
// @@RELEASE_NOTES_END@@

// --- semver comparison (major.minor.patch) -----------------------------------
// Returns -1 if a < b, 0 if equal, 1 if a > b. Tolerates missing parts and a
// leading "v". Non-numeric parts are treated as 0.
export function compareVersions(a, b) {
    const parse = (v) => String(v).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const da = pa[i] || 0;
        const db = pb[i] || 0;
        if (da < db) return -1;
        if (da > db) return 1;
    }
    return 0;
}

// Flat combined list (Ken's choice) of every note for versions newer than
// `sinceVersion` and no newer than `currentVersion`, ordered newest-version-first
// so the most recent changes read at the top.
export function collectWhatsNew(sinceVersion, currentVersion) {
    return Object.keys(RELEASE_NOTES)
        .filter((v) => compareVersions(v, sinceVersion) > 0 && compareVersions(v, currentVersion) <= 0)
        .sort((a, b) => compareVersions(b, a))                 // newest version first
        .flatMap((v) => (RELEASE_NOTES[v] || []).filter(Boolean));
}

// The notes to announce for this version, or [] if there's nothing to show. Also
// handles the silent baseline: a run with no prior record (brand-new user, OR the
// first version to ship this feature) just records the current version — the version
// that INTRODUCES the notice cannot announce itself. Does NOT render anything.
export function pending(currentVersion) {
    const seen = storage.loadLastSeenVersion();
    if (seen == null) {
        storage.saveLastSeenVersion(currentVersion);       // baseline, no notice
        return [];
    }
    if (compareVersions(seen, currentVersion) >= 0) return []; // already current
    return collectWhatsNew(seen, currentVersion);
}

// Render the announcement as a card INSIDE the pre-start block — i.e. within the
// Transcript control's footprint, a keyguard opening, so nothing (including "Got it")
// is obscured (Ken, July 4 2026, Spatial Stability). Called after the user presses
// Start; the app has already re-rendered itself post-update, so the transcript's
// location is known. `onDismiss` runs after "Got it" (which also records the version
// as seen — deferred to that explicit acknowledgment, never at render time).
export function renderPanel(currentVersion, notes, onDismiss) {
    const panel = document.getElementById('whatsNewPanel');
    if (!panel) return;
    panel.textContent = '';

    // Header row: title on the left, Close on the right (saves the vertical space a
    // bottom button row would take — Ken). No decorative graphic.
    const head = document.createElement('div');
    head.className = 'whatsnew-head';
    const h = document.createElement('h2');
    h.className = 'whatsnew-title';
    h.textContent = "What's new in Conversant AAC";
    const okBtn = document.createElement('button');
    okBtn.className = 'whatsnew-ok';
    okBtn.textContent = 'Close';
    head.append(h, okBtn);

    const list = document.createElement('ul');
    list.className = 'whatsnew-list';
    for (const note of notes) {
        const li = document.createElement('li');
        li.textContent = String(note);
        list.appendChild(li);
    }

    let settled = false;
    okBtn.addEventListener('click', () => {
        if (settled) return;
        settled = true;
        markSeen(currentVersion);
        panel.hidden = true;
        panel.textContent = '';
        if (onDismiss) onDismiss();
    });

    panel.append(head, list);
    panel.hidden = false;
    okBtn.focus();
}

// Record that the user has seen the current version's announcement, so it won't
// reappear on the next launch. Called only when the user taps "Got it" — deferred to
// that explicit acknowledgment, never at render time (so nothing marks it seen early).
export function markSeen(currentVersion) {
    storage.saveLastSeenVersion(currentVersion);
}
