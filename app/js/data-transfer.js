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
 * WHAT TRAVELS: the user-owned data files and the conversation logs. WHAT DOES
 * NOT: the SETTINGS, and with them every key.
 *
 * ⚠ SETTINGS CAME OUT OF THE DATA PACKAGE ON SEPTEMBER 9 2026 (Ken): *"if I want to
 * put Conversant on another device I will want to move my data but not necessarily
 * my settings (unless it's the same kind of device). That can be a separate transfer
 * and import."* That is the whole reason they are two files now, and it is a real
 * distinction rather than tidiness: WHO YOU ARE is portable to anything, while HOW
 * THE SCREEN IS LAID OUT is a property of a particular device. Dock side, button
 * size, gaps, keyboard layout and the chosen voice are all answers to "what is this
 * machine", so carrying them onto a phone-sized tablet actively makes it worse.
 *
 * Settings travel by their own file instead - buildSettingsPackage below. Both are
 * exports, neither can carry a key, and the user chooses which to move.
 */

import * as storage from './storage.js';

export const PACKAGE_KIND = 'conversant-aac-backup';
// 2 since September 9 2026: a package no longer carries a `settings` block. A
// version-1 file still imports - its settings are simply ignored, and summarize()
// says so rather than dropping them silently.
export const PACKAGE_VERSION = 2;

export const SETTINGS_KIND = 'conversant-aac-settings';
// 2 since September 9 2026: the file carries the saved PROFILES and which one was
// current, not just the settings in effect.
export const SETTINGS_VERSION = 2;

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
export async function buildPackage(appVersion) {
    const data = {};
    for (const entry of DATA_FILES) {
        const value = await readOne(entry);
        if (value !== null && value !== undefined) data[entry.file] = value;
    }
    let conversations = [];
    try {
        conversations = await storage.listConversationLogs();
    } catch { /* no folder, or unreadable — export the rest anyway */ }

    return {
        kind: PACKAGE_KIND,
        packageVersion: PACKAGE_VERSION,
        appVersion: appVersion || '',
        exportedAt: new Date().toISOString(),
        // No `settings` key by design - see the header. Do not reinstate it "for
        // completeness": it is what made moving your answers onto a different-shaped
        // device also move that device's layout onto it.
        data,
        conversations,
    };
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
    // A version-1 file carries settings and this app will not restore them. Saying
    // so is the point: silently ignoring part of a file the user is looking at is
    // how somebody concludes the import half-worked.
    const carried = pkg && pkg.settings ? Object.keys(pkg.settings).length : 0;
    if (carried) {
        lines.push(`${carried} setting${carried === 1 ? '' : 's'} in this older backup — NOT restored; ` +
                   'settings now move by their own file');
    }
    return lines;
}

function pad(n) { return String(n).padStart(2, '0'); }

// "conversant-data-2026-07-30-1432.json" — sorts chronologically in the Files
// app, which is where these land on an iPad.
//
// ⚠ "data", NOT "backup" (Ken, September 9 2026): *"conversant-backup should be
// conversant-data since conversant-settings is also a backup."* Both files are
// backups, so the word did not tell them apart and the pair read as though the
// settings file were something lesser. Ken accepted the break with older filenames
// up front - and nothing actually breaks, because an import is validated by the
// `kind` INSIDE the file and never by its name. The folder list keeps older files
// visible by treating everything that is not a settings file as data - see below.
export function suggestedFilename(now = new Date()) {
    return 'conversant-data-' +
        now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        '-' + pad(now.getHours()) + pad(now.getMinutes()) + '.json';
}

// Which files in <data folder>/backups/ belong to which list. Name-based, because
// the alternative is opening every file in the folder just to draw a dropdown, and
// a data package carries every saved conversation.
//
// ⚠ ONLY THE SETTINGS PREFIX IS MATCHED, AND EVERYTHING ELSE COUNTS AS DATA. That
// asymmetry is the whole design. Matching a list of data prefixes instead would
// hide two kinds of file: every backup made before September 9 2026, which is named
// "conversant-backup-", and any file the user renamed themselves. A backup that
// exists and cannot be seen is the failure worth avoiding; a file in the wrong list
// costs nothing, because restore validates the `kind` INSIDE the file and refuses
// with a legible message.
const SETTINGS_PREFIX = 'conversant-settings-';

export function isSettingsBackupName(name) {
    return String(name || '').toLowerCase().startsWith(SETTINGS_PREFIX);
}

export function isDataBackupName(name) {
    return !isSettingsBackupName(name);
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
export async function downloadPackage(appVersion) {
    const pkg = await buildPackage(appVersion);
    downloadText(suggestedFilename(), JSON.stringify(pkg, null, 2));
    return pkg;
}

// Write the package into <data folder>/backups/ instead of downloading it (Ken,
// July 31 2026). Used where the user picked a real folder: the backup then sits
// beside the data it protects, in the folder they already sync and copy, rather
// than in the browser's Downloads. Returns the path written so the caller can say
// where it went. The download path above remains the ONLY route on a tablet.
export async function savePackageToFolder(appVersion) {
    const pkg = await buildPackage(appVersion);
    const path = await storage.saveBackup(suggestedFilename(), JSON.stringify(pkg, null, 2));
    return { pkg, path };
}

// --- Settings, as their own file (Ken, September 9 2026) ---
//
// The companion to the data package above, and deliberately a SEPARATE file: data
// moves to any device, settings move only to one of the same shape.
//
// ⚠ IT CANNOT CARRY A KEY, AND THAT IS ENFORCED IN storage.js RATHER THAN HERE.
// getPortableSettings() drops everything in PROFILE_EXCLUDE, which begins with all
// six SECRET_KEYS - the Anthropic key and the five paid speech keys - and
// applyPortableSettings() drops them again on the way back in. So the guarantee
// holds at BOTH ends and does not depend on this module remembering: a hand-edited
// file with a key pasted into it still cannot install one. A key is per-device and
// per-account, it is the one thing in the app that costs real money if it leaks, and
// this file is made to be emailed and copied between machines.
//
// ⚠ IT GOES WHERE THE DATA BACKUP GOES - into the data folder when there is one,
// and out by the download/share sheet only where there is not (Ken, September 9
// 2026): *"all backups should be written to the data folder with the exception of
// those installations where one cannot create a data folder."* An earlier cut always
// downloaded this one, reasoning that named settings profiles already cover the
// folder. That was wrong on the user's terms rather than the code's: a person who
// backs up looks in ONE place for what they saved, and having half their backups in
// the data folder and half in Downloads is a filing system nobody asked for.
//
// Profiles are still a different thing and both are worth having - a profile is a
// NAMED configuration you switch between deliberately, a settings backup is a dated
// snapshot you restore after something went wrong.
export async function buildSettingsPackage(appVersion) {
    return {
        kind: SETTINGS_KIND,
        packageVersion: SETTINGS_VERSION,
        appVersion: appVersion || '',
        exportedAt: new Date().toISOString(),
        // What is in effect right now.
        settings: storage.getPortableSettings(),
        // Every saved profile, and which one the picker was showing (Ken, September
        // 9 2026). Reading them needs the folder, so this is async now.
        profiles: await storage.exportSettingsProfiles(),
        activeProfile: storage.loadActiveSettingsProfile(),
    };
}

// "conversant-settings-2026-09-09-1432.json" - a different stem from the data
// backup on purpose, so the two are told apart in a Downloads list at a glance.
export function suggestedSettingsFilename(now = new Date()) {
    return 'conversant-settings-' +
        now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        '-' + pad(now.getHours()) + pad(now.getMinutes()) + '.json';
}

export async function downloadSettingsPackage(appVersion) {
    const pkg = await buildSettingsPackage(appVersion);
    downloadText(suggestedSettingsFilename(), JSON.stringify(pkg, null, 2));
    return pkg;
}

// Into <data folder>/backups/, beside the data backups. Same folder on purpose:
// one place to look for anything you saved.
export async function saveSettingsPackageToFolder(appVersion) {
    const pkg = await buildSettingsPackage(appVersion);
    const path = await storage.saveBackup(suggestedSettingsFilename(), JSON.stringify(pkg, null, 2));
    return { pkg, path };
}

// What the user is about to overwrite. Settings are a flat bundle with no natural
// groupings, so the honest summary is a count plus the promise about keys.
export function summarizeSettings(pkg) {
    const n = pkg && pkg.settings ? Object.keys(pkg.settings).length : 0;
    const lines = [`${n} setting${n === 1 ? '' : 's'} in effect`];
    const profiles = (pkg && Array.isArray(pkg.profiles)) ? pkg.profiles : [];
    if (profiles.length) {
        const names = profiles.map((p) => p.name).join(', ');
        lines.push(`${profiles.length} saved profile${profiles.length === 1 ? '' : 's'}: ${names}`);
    }
    // Named only when it is one of the profiles in the file, so the line can never
    // promise to select something that is not there to select.
    if (pkg && pkg.activeProfile && profiles.some((p) => p.name === pkg.activeProfile)) {
        lines.push(`"${pkg.activeProfile}" will be the one in use`);
    }
    lines.push('No keys — an exported settings file never contains one');
    return lines;
}

// ⚠ THE TWO FILES MUST NOT BE INTERCHANGEABLE, and each error says which file the
// user actually picked rather than a generic refusal. Handing the data importer a
// settings file is the obvious mistake once there are two, and "that is not a
// backup" would leave them with no idea what they had done wrong.
export function parseSettingsPackage(text) {
    let pkg;
    try {
        pkg = JSON.parse(text);
    } catch {
        throw new Error('That file is not a Conversant settings file — it is not readable as JSON.');
    }
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
        throw new Error('That file is not a Conversant settings file.');
    }
    if (pkg.kind === PACKAGE_KIND) {
        throw new Error('That is a data backup, not a settings file. Use "Import from a file…" above it.');
    }
    if (pkg.kind !== SETTINGS_KIND) {
        throw new Error('That file is not a Conversant settings file. Look for one named conversant-settings-….json');
    }
    if (typeof pkg.packageVersion !== 'number' || pkg.packageVersion > SETTINGS_VERSION) {
        throw new Error('That settings file was made by a newer version of Conversant. Update the app first, then import it.');
    }
    if (!pkg.settings || typeof pkg.settings !== 'object') {
        throw new Error('That settings file looks damaged — it has no settings in it.');
    }
    return pkg;
}

// Apply them. DESTRUCTIVE - the caller confirms first. Returns how many were taken,
// counted AFTER the exclusion so the number reported is the number that landed.
// ⚠ THE SETTINGS IN EFFECT ARE APPLIED, NOT THE ACTIVE PROFILE'S. They are the same
// thing whenever the user had not tweaked anything since loading that profile, which
// is the ordinary case. Where they differ - a slider moved and not saved - applying
// the LIVE settings reproduces the device exactly as it was at export, while loading
// the profile would throw that tweak away. The profile is still marked as the one in
// use, so it is selected in the picker and one tap re-loads it.
//
// ⚠ PROFILES NEED A DATA FOLDER, and where there is none they are silently
// unwritable - so the count comes back and the caller must SAY so. A user told
// "settings imported" who then finds no profiles would reasonably think the backup
// was faulty.
export async function applySettingsPackage(pkg) {
    const before = storage.getPortableSettings();
    storage.applyPortableSettings(pkg.settings);

    // [{ requested, written }] — the two differ where a name already existed here.
    const landed = await storage.importSettingsProfiles(pkg.profiles);

    // ⚠ FOLLOW THE RENAME. Where the incoming active profile clashed it was written
    // under a new name, and marking the REQUESTED name current would point the picker
    // at this device's own profile of that name — a different configuration that
    // happens to share a title, which is the one outcome the rename exists to avoid.
    const activeEntry = landed.find((e) => e.requested === pkg.activeProfile);

    // Set AFTER applyPortableSettings: activeSettingsProfile is in PROFILE_EXCLUDE,
    // so that call deliberately preserves THIS machine's value and ignores the
    // incoming one. Only set it to a profile that actually landed, or the picker
    // would point at a name with no file behind it.
    if (activeEntry) storage.saveActiveSettingsProfile(activeEntry.written);

    const after = storage.getPortableSettings();
    return {
        count: Object.keys(after).length,
        profiles: landed.map((e) => e.written),
        renamed: landed.filter((e) => e.requested !== e.written),
        profilesInFile: Array.isArray(pkg.profiles) ? pkg.profiles.length : 0,
        activeProfile: activeEntry ? activeEntry.written : '',
        changed: JSON.stringify(before) !== JSON.stringify(after),
    };
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
    if (pkg.kind !== PACKAGE_KIND) {
        throw new Error('That file is not a Conversant data backup. Look for a file named conversant-data-….json');
    }
    if (typeof pkg.packageVersion !== 'number' || pkg.packageVersion > PACKAGE_VERSION) {
        throw new Error('That backup was made by a newer version of Conversant. Update the app first, then import it.');
    }
    if (!pkg.data || typeof pkg.data !== 'object') {
        throw new Error('That backup looks damaged — it has no data section.');
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
    const restored = { files: [], conversations: 0, failed: [] };
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

    // Deliberately NOT applying pkg.settings, even when a version-1 file has them.
    // Importing data must never rearrange the screen underneath somebody.

    for (const c of convos) {
        if (!c || !c.id) { step('conversations'); continue; }
        if (await storage.writeConversationLog(c.id, c.data)) restored.conversations++;
        step('conversations');
    }

    return restored;
}
