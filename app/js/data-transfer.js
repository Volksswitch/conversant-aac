/*
 * data-transfer.js — Export / Import of the complete user data package.
 *
 * WHY THIS EXISTS (Ken, July 30 2026). On Windows the data folder is a real,
 * user-visible directory: backup, transfer between machines, and the plain sense
 * of owning your own data all come free, because the user can open the folder and
 * copy worldview.json (the v0.2.25 "file in the folder wins" flow). On iPad the
 * data folder is OPFS — private to the browser, invisible in the Files app — so
 * ALL THREE of those jobs disappear at once and have to be rebuilt explicitly.
 *
 * It is also the safety net that makes the iPad's Safari-tab mode survivable:
 * measured July 30 2026, navigator.storage.persist() is DENIED in a browser tab,
 * so site data is evictable after seven days of non-use. An export turns that
 * from a loss into a re-import.
 *
 * And it is the bridge between the two iPad modes. A Home Screen app and a
 * Safari tab are separate storage silos (measured), so moving between them
 * without an export loses everything.
 *
 * None of this is iPad-only: this is the mechanism the long-planned cross-device
 * transfer feature has always needed on Windows too.
 *
 * WHAT TRAVELS: everything — the user-owned data files, the conversation logs, the
 * settings, and every saved settings profile. WHAT DOES NOT: the six keys.
 *
 * ⚠ ONE FILE, FILTERED AT IMPORT — AND THIS REPLACES THE TWO-FILE SPLIT OF EARLIER THE
 * SAME DAY (Ken, September 9 2026). The split was built on the belief that settings
 * would be WRONG on another device. Working through all 44 of them killed that: every
 * one is a picker, slider, checkbox or radio reachable without typing, so a wrong value
 * costs one adjustment, and the single real trap (full screen on an iPad) is already
 * refused in code. Ken: *"there aren't many things that can't travel - and they're
 * primarily OS related."*
 *
 * ⚠ SO THE DECISION MOVED TO WHERE THE INFORMATION IS. At EXPORT nobody knows where the
 * file is going, so a split forces the user to guess the destination at the moment they
 * are least able to. At IMPORT the app knows both sides — what the file came off and
 * what this machine is — so it can hold back the handful of settings that are genuinely
 * bound to a device and apply everything else. Two files asked the user a question the
 * app is better placed to answer.
 *
 * ⚠ THE CONTENT ALWAYS TRAVELS WHOLE. Ken's phrasing was that data is "a subset of
 * settings"; About Me answers, people, places, the panel's words and the conversations
 * are not settings at all, so the filter applies to the SETTINGS half only. Nothing the
 * user wrote is ever held back.
 */

import * as storage from './storage.js';
import * as platform from './platform.js';

export const PACKAGE_KIND = 'conversant-aac-backup';
// 3: one file again, carrying content AND settings AND every saved profile, with a
// device signature so the import can decide what applies here. 1 and 2 still import
// (see parsePackage) - 2 is the short-lived data-only shape, 1 the original.
export const PACKAGE_VERSION = 3;

// The separate settings file, which existed for part of one day. Still READ so that
// anyone who made one can restore it; never written any more.
export const SETTINGS_KIND = 'conversant-aac-settings';
export const SETTINGS_VERSION = 2;

/* ── What does not survive a change of device ─────────────────────────────────
 *
 * Both lists are deliberately TINY, and that is the finding rather than an oversight:
 * of 44 travelling settings only these four are bound to the machine. Everything else
 * is the person's, and travels.
 *
 * Each entry carries the reason, because a list of names rots into a list nobody dares
 * change. Add to it only when a setting would be WRONG on the other device - not merely
 * different, and not merely something you might want to re-tune.
 */

// Held back when the OS or the shell differs.
export const OS_BOUND = {
    // Whether a physical keyboard is attached is a fact about the hardware.
    keyboardMode: 'on-screen or physical keyboard',
    // ⚠ MEASURED, July 30 2026: the free recognizer delivers NOTHING in an iPad Home
    // Screen app. Carrying "use the browser's own listening" there lands somebody on a
    // device that cannot hear a word — the one place where a setting Ken rightly calls
    // operational is also OS-bound.
    sttProvider: 'how the app hears the other person',
    // The Fullscreen API is refused on iOS and the control is hidden there, so this is
    // already harmless — held back for honesty rather than safety.
    fullscreen: 'use the whole screen',
};

// Held back when the screen differs.
export const SCREEN_BOUND = {
    // ⚠ THE CLEAREST CASE IN THE APP, and the one that proves "proportional" is not the
    // test: the value IS proportional and would render fine anywhere, but it exists to
    // clear the lip of a case opening on one particular device (Rule 16). A keyguard is
    // cut for one screen.
    appMarginPos: 'screen edge margin',
};

// The user-owned data files. Each has a data-folder file (source of truth) and a
// localStorage write-through cache (same-machine mirror / no-folder stopgap), so
// the export reads whichever is actually present and the import writes BOTH —
// otherwise an import would appear to work and then be silently overwritten by a
// stale cache on the next load.
const DATA_FILES = [
    { file: 'worldview.json',       cache: 'aac_worldview',       label: 'About Me answers' },
    { file: 'relationships.json',   cache: 'aac_relationships',   label: 'People and relationships' },
    { file: 'places.json',          cache: 'aac_places',          label: 'My Places' },
    { file: 'control-phrases.json', cache: 'aac_control_phrases', label: 'Starters and control phrases' },
    { file: 'placeholders.json',    cache: 'aac_placeholders',     label: 'Placeholder phrases' },
    { file: 'express-panel.json',   cache: 'aac_express_items',   label: 'Express Panel items' },
    { file: 'voice.json',           cache: 'aac_voice',           label: 'How I sound' },
];

function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

// Folder file first (it is the source of truth per v0.2.25), falling back to the
// localStorage cache so a machine that never had a folder granted still exports
// everything the user has entered.
async function readOne(entry) {
    try {
        const text = await storage.readFile(entry.file);
        if (text) return JSON.parse(text);
    } catch { /* fall through to the cache */ }
    return readCache(entry.cache);
}

// Assemble the whole package. Missing pieces are simply absent rather than null,
// so an import can tell "the user had no relationships" from "this key was never
// part of the package format".
// `onProgress({ done, total, label })` as it reads. Ken, September 9 2026: "Exporting
// settings is very slow on an Android tablet" - and a backup with hundreds of saved
// conversations is mostly the READING, so an export needs the same visible progress an
// import already has, for the same reason: a card that never changes is indistinguishable
// from a crash.
export async function buildPackage(appVersion, onProgress) {
    const data = {};
    let done = 0;
    // The files, plus one step for the conversations and one for the settings.
    const total = DATA_FILES.length + 2;
    const step = (label) => {
        done += 1;
        if (onProgress) { try { onProgress({ done, total, label }); } catch { /* never let reporting break an export */ } }
    };
    for (const entry of DATA_FILES) {
        const value = await readOne(entry);
        if (value !== null && value !== undefined) data[entry.file] = value;
        step(entry.label);
    }
    let conversations = [];
    try {
        conversations = await storage.listConversationLogs();
    } catch { /* no folder, or unreadable — export the rest anyway */ }
    step('saved conversations');

    return {
        kind: PACKAGE_KIND,
        packageVersion: PACKAGE_VERSION,
        appVersion: appVersion || '',
        exportedAt: new Date().toISOString(),
        // What kind of device this came off, so the import can decide what applies
        // there. In the file's HEADER rather than inside `settings`: it is a fact about
        // the file, and putting it in the bundle would make it a travelling setting that
        // then has to be excluded again.
        device: platform.deviceSignature(),
        settings: storage.getPortableSettings(),
        profiles: await profilesThenStep(step),
        activeProfile: storage.loadActiveSettingsProfile(),
        data,
        conversations,
    };
}

// Reads the profiles and counts that as the last step. A named helper only so the
// object literal above stays readable.
async function profilesThenStep(step) {
    const out = await storage.exportSettingsProfiles();
    step('settings and profiles');
    return out;
}

// Plain-language counts for the confirmation dialogs, so the user can see what
// they are about to write out or overwrite rather than trusting a filename.
export function summarize(pkg) {
    const lines = [];
    for (const entry of DATA_FILES) {
        const value = pkg && pkg.data ? pkg.data[entry.file] : undefined;
        if (value === undefined) continue;
        let detail = '';
        // worldview.json keys its answers under `fields`, not `answers` — reading
        // the wrong key meant this line silently showed no count at all, on the one
        // screen where the user decides whether a backup is worth restoring from.
        // Only `answered` fields count: a declined one is a recorded refusal, not
        // an answer, and calling it one would overstate what the backup holds.
        if (entry.file === 'worldview.json' && value && value.fields) {
            const answered = Object.values(value.fields)
                .filter((f) => f && f.state === 'answered').length;
            detail = ` (${answered} answered)`;
        } else if (entry.file === 'relationships.json' && value && Array.isArray(value.people)) {
            detail = ` (${value.people.length})`;
        } else if (entry.file === 'places.json' && value && Array.isArray(value.places)) {
            detail = ` (${value.places.length})`;
        } else if (entry.file === 'voice.json' && value && value.soundCheck) {
            detail = ` (${Object.keys(value.soundCheck).length} answered)`;
        } else if (Array.isArray(value)) {
            detail = ` (${value.length})`;
        }
        lines.push(entry.label + detail);
    }
    const convos = (pkg && Array.isArray(pkg.conversations)) ? pkg.conversations.length : 0;
    lines.push(`${convos} saved conversation${convos === 1 ? '' : 's'}`);
    const settingCount = pkg && pkg.settings ? Object.keys(pkg.settings).length : 0;
    if (settingCount) lines.push(`${settingCount} setting${settingCount === 1 ? '' : 's'}`);
    const profiles = (pkg && Array.isArray(pkg.profiles)) ? pkg.profiles : [];
    if (profiles.length) {
        lines.push(`${profiles.length} saved profile${profiles.length === 1 ? '' : 's'}: ` +
                   profiles.map((x) => x.name).join(', '));
    }
    lines.push('No keys — a backup never contains one');
    return lines;
}

function pad(n) { return String(n).padStart(2, '0'); }

// "conversant-backup-2026-09-09-1432.json" — sorts chronologically in the Files
// app, which is where these land on an iPad.
//
// ⚠ BACK TO "backup" (September 9 2026, later the same day). It became
// "conversant-data-" while there were two files and the word did not tell them apart.
// There is one again and it holds everything, so "backup" is the true word. Nothing
// breaks either way: an import is validated by the `kind` INSIDE the file, never by its
// name, so every prefix this app has ever written still restores and still lists.
export function suggestedFilename(now = new Date()) {
    return 'conversant-backup-' +
        now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        '-' + pad(now.getHours()) + pad(now.getMinutes()) + '.json';
}

// Hand a file to the user through the browser's own download path. On iPadOS this
// opens the share/save sheet and the file lands in Files — which is the ONLY way to
// get a file out of this app on a tablet, since the data folder there is OPFS and
// invisible. Shared with the Keyguard Design tab's "Screen Openings.txt" for exactly
// that reason.
export function downloadText(filename, text, mime = 'application/json') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick — revoking synchronously can cancel the download in
    // some browsers before it has read the blob.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Trigger a download of the package. On iPadOS this opens the share/save sheet and
// the file lands in Files, which is what makes the data user-visible again.
export async function downloadPackage(appVersion, onProgress) {
    const pkg = await buildPackage(appVersion, onProgress);
    downloadText(suggestedFilename(), JSON.stringify(pkg, null, 2));
    return pkg;
}

// Write the package into <data folder>/backups/ instead of downloading it (Ken,
// July 31 2026). Used where the user picked a real folder: the backup then sits
// beside the data it protects, in the folder they already sync and copy, rather
// than in the browser's Downloads. Returns the path written so the caller can say
// where it went. The download path above remains the ONLY route on a tablet.
export async function savePackageToFolder(appVersion, onProgress) {
    const pkg = await buildPackage(appVersion, onProgress);
    const path = await storage.saveBackup(suggestedFilename(), JSON.stringify(pkg, null, 2));
    return { pkg, path };
}

/* Which of a package's settings apply on THIS device.
 *
 * Returns { settings, heldBack: [{ key, label, why }] } - the caller REPORTS heldBack
 * rather than swallowing it. A setting silently not arriving is the failure this whole
 * design exists to avoid; being told "your screen edge margin stayed behind because this
 * is a different screen" is the point of filtering here rather than at export.
 */
export function settingsForThisDevice(pkg, here) {
    const incoming = (pkg && pkg.settings) || {};
    const comparison = platform.compareDevice(pkg && pkg.device, here || platform.deviceSignature());
    const settings = {};
    const heldBack = [];
    for (const [k, v] of Object.entries(incoming)) {
        if (!comparison.sameOs && OS_BOUND[k]) {
            heldBack.push({ key: k, label: OS_BOUND[k], why: 'os' });
        } else if (!comparison.sameScreen && SCREEN_BOUND[k]) {
            heldBack.push({ key: k, label: SCREEN_BOUND[k], why: 'screen' });
        } else {
            settings[k] = v;
        }
    }
    return { settings, heldBack, comparison };
}

// Validate and parse. Throws a user-facing message — this is the one place a user
// can hand the app an arbitrary file, so the failure has to be legible rather than
// a raw JSON error.
export function parsePackage(text) {
    let pkg;
    try {
        pkg = JSON.parse(text);
    } catch {
        throw new Error('That file is not a Conversant backup — it is not readable as JSON.');
    }
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
        throw new Error('That file is not a Conversant backup.');
    }
    // ⚠ ONE IMPORT BUTTON NOW ACCEPTS EVERY FILE THE APP HAS EVER WRITTEN: the combined
    // backup, the data-only one from earlier today, the original, and the settings-only
    // one that existed for part of a day. A user should never have to know which era
    // their file came from, and the alternative is a legible file being refused by the
    // only button that could have read it.
    const isSettingsOnly = pkg.kind === SETTINGS_KIND;
    if (pkg.kind !== PACKAGE_KIND && !isSettingsOnly) {
        throw new Error('That file is not a Conversant backup. Look for a file named conversant-backup-….json');
    }
    const ceiling = isSettingsOnly ? SETTINGS_VERSION : PACKAGE_VERSION;
    if (typeof pkg.packageVersion !== 'number' || pkg.packageVersion > ceiling) {
        throw new Error('That backup was made by a newer version of Conversant. Update the app first, then import it.');
    }
    // A settings-only file has no data section and must not be judged for lacking one.
    if (!isSettingsOnly && (!pkg.data || typeof pkg.data !== 'object')) {
        throw new Error('That backup looks damaged — it has no data section.');
    }
    if (isSettingsOnly && (!pkg.settings || typeof pkg.settings !== 'object')) {
        throw new Error('That backup looks damaged — it has no settings in it.');
    }
    // Normalized so every caller downstream sees one shape.
    if (isSettingsOnly) pkg.data = pkg.data || {};
    // ⚠ A VERSION-1 FILE'S SETTINGS ARE STILL IGNORED. They were exported when the app
    // had no device signature, so there is no way to know whether they belong here, and
    // guessing would apply another machine's layout unasked. Marked rather than deleted
    // so summarize() can say so.
    if (!isSettingsOnly && pkg.packageVersion < 2 && pkg.settings) {
        pkg.legacySettings = pkg.settings;
        delete pkg.settings;
    }
    return pkg;
}

// Restore everything. DESTRUCTIVE — the caller must confirm first (standing rule:
// confirmDanger, never window.confirm). Writes the folder file AND the cache for
// each store so the result survives the reload the caller performs afterwards.
// Returns what was actually restored, so the caller can report it honestly rather
// than claiming success for pieces that failed.
// `onProgress({ done, total, label })` is called as it goes. It exists because on a
// slow device (Ken's Android tablet, September 9 2026) a restore of several hundred
// conversations takes long enough to look like a crash, and a caller that can only say
// "Importing..." cannot tell the user the difference between working and hung. A count
// that visibly climbs can.
export async function applyPackage(pkg, onProgress) {
    const restored = {
        files: [], conversations: 0, failed: [],
        settings: 0, heldBack: [], profiles: [], renamed: [], profilesInFile: 0, activeProfile: '',
        legacySettings: pkg.legacySettings ? Object.keys(pkg.legacySettings).length : 0,
    };
    const convos = Array.isArray(pkg.conversations) ? pkg.conversations : [];
    const total = DATA_FILES.filter((e) => pkg.data[e.file] !== undefined).length + convos.length;
    let done = 0;
    const step = (label) => {
        done += 1;
        if (onProgress) { try { onProgress({ done, total, label }); } catch { /* never let reporting break the restore */ } }
    };

    for (const entry of DATA_FILES) {
        const value = pkg.data[entry.file];
        if (value === undefined) continue;
        const text = JSON.stringify(value, null, 2);
        try {
            localStorage.setItem(entry.cache, JSON.stringify(value));
        } catch {
            restored.failed.push(entry.label);
            continue;
        }
        try {
            await storage.writeFile(entry.file, text);   // no-op without a data folder
        } catch { /* cache write already succeeded; folder is best-effort */ }
        restored.files.push(entry.label);
        step(entry.label);
    }

    // The settings, minus whatever is bound to a device this is not. Applied AFTER the
    // content so a failure part-way leaves the words in place rather than the layout.
    const { settings, heldBack, comparison } = settingsForThisDevice(pkg, undefined);
    if (pkg.settings) {
        // ⚠ HELD BACK MEANS "KEEP THIS DEVICE'S VALUE", NOT "RESET IT" — and it takes
        // this line to be true, because applyPortableSettings REPLACES the whole
        // portable subset rather than merging into it. Leaving a held-back key out of
        // the object therefore deletes it and falls back to the default, so the restart
        // card's "left as they are here" was a plain untruth. Found by reading the
        // stored settings after a real cross-device import, not by any test.
        const mine = storage.getPortableSettings();
        for (const h of heldBack) {
            if (mine[h.key] !== undefined) settings[h.key] = mine[h.key];
        }
        storage.applyPortableSettings(settings);
        restored.settings = Object.keys(settings).length;
        restored.heldBack = heldBack;
        restored.comparison = comparison;
    }

    // [{ requested, written }] — the two differ where a name already existed here.
    const landed = await storage.importSettingsProfiles(pkg.profiles);
    restored.profiles = landed.map((e) => e.written);
    restored.renamed = landed.filter((e) => e.requested !== e.written);
    restored.profilesInFile = Array.isArray(pkg.profiles) ? pkg.profiles.length : 0;
    // ⚠ FOLLOW THE RENAME: marking the requested name current would point the picker at
    // THIS device's own profile of that name, a different configuration sharing a title.
    const activeEntry = landed.find((e) => e.requested === pkg.activeProfile);
    if (activeEntry) storage.saveActiveSettingsProfile(activeEntry.written);
    restored.activeProfile = activeEntry ? activeEntry.written : '';

    for (const c of convos) {
        if (!c || !c.id) { step('conversations'); continue; }
        if (await storage.writeConversationLog(c.id, c.data)) restored.conversations++;
        step('conversations');
    }

    return restored;
}
