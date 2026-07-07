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
