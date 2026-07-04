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

// Build + show the modal. `notes` is a flat array of plain-text strings. `heading`
// tailors the intro line (post-update vs. an on-demand "what's new in this version").
function showWhatsNewModal(currentVersion, notes, { onDemand = false } = {}) {
    const dlg = document.createElement('dialog');
    dlg.className = 'whatsnew-dialog';

    const head = document.createElement('div');
    head.className = 'whatsnew-head';
    const mark = document.createElement('span');
    mark.className = 'whatsnew-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '✨';
    const h = document.createElement('h2');
    h.className = 'whatsnew-title';
    h.textContent = "What's new in Conversant AAC";
    head.append(mark, h);

    const intro = document.createElement('p');
    intro.className = 'whatsnew-intro';
    if (onDemand) {
        intro.textContent = `Version ${currentVersion} — here's what changed:`;
    } else {
        intro.append('The app updated itself to version ');
        const b = document.createElement('b');
        b.textContent = currentVersion;
        intro.append(b, ". Here's what changed:");
    }

    const list = document.createElement('ul');
    list.className = 'whatsnew-list';
    for (const note of notes) {
        const li = document.createElement('li');
        li.textContent = String(note);
        list.appendChild(li);
    }

    const actions = document.createElement('div');
    actions.className = 'whatsnew-actions';
    const okBtn = document.createElement('button');
    okBtn.className = 'whatsnew-ok';
    okBtn.textContent = 'Got it';
    actions.append(okBtn);

    dlg.append(head, intro, list, actions);

    let settled = false;
    const done = () => {
        if (settled) return;
        settled = true;
        try { dlg.close(); } catch { /* already closing */ }
        dlg.remove();
    };
    okBtn.addEventListener('click', done);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(); });   // Escape
    dlg.addEventListener('click', (e) => { if (e.target === dlg) done(); });  // backdrop

    document.body.append(dlg);
    dlg.showModal();   // top layer — sits above the full-screen overlays
    okBtn.focus();
}

// Called once at app load. Shows the notice when the running version is newer than
// the last one the user acknowledged, then records the current version. A run with
// no prior record (brand-new user, OR the first version to ship this feature — older
// versions never stored the value) just establishes the baseline silently: the
// version that INTRODUCES the notice cannot announce itself.
export function maybeShowWhatsNew(currentVersion) {
    const seen = storage.loadLastSeenVersion();
    if (seen == null) {
        storage.saveLastSeenVersion(currentVersion);       // baseline, no notice
        return;
    }
    if (compareVersions(seen, currentVersion) >= 0) return; // already current (or ahead)
    const notes = collectWhatsNew(seen, currentVersion);
    storage.saveLastSeenVersion(currentVersion);            // record before showing (a reload can't re-trigger)
    if (notes.length) showWhatsNewModal(currentVersion, notes);
}

// On-demand view (Settings → About "See what's new"): shows the notes for the
// current version regardless of what's been seen. Falls back to a friendly message
// when this version carries no user-facing notes.
export function showWhatsNewForVersion(currentVersion) {
    const notes = (RELEASE_NOTES[currentVersion] || []).filter(Boolean);
    if (notes.length) {
        showWhatsNewModal(currentVersion, notes, { onDemand: true });
    } else {
        showWhatsNewModal(currentVersion, ['No notable changes are listed for this version.'], { onDemand: true });
    }
}
