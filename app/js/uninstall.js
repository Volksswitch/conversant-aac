/*
 * "Delete everything on this device" (Ken, November 22 2026), for someone who has
 * decided to stop using Conversant. Settings > About. app.js asks twice, stops the app
 * and shows what happened; this module does the deleting.
 *
 * ⚠ IT CLEARS EVERYTHING STORED AT THE APP'S WEB ADDRESS, NOT A LIST OF NAMES. The app
 * has had a web address of its own since August 2026, so nothing else is stored there,
 * and clearing all of it also covers anything added later that nobody remembered to
 * list here. (A local test server shares its address with whatever else it serves, and
 * that goes too.)
 *
 * ⚠ IN A DATA FOLDER THE USER CAN SEE, ONLY WHAT THE APP MADE IS DELETED, and only when
 * they asked for it. A user may have chosen a folder that also holds their own files -
 * Documents itself, say - and on Windows a folder's name matches whatever its capitals,
 * so a Documents\Audio folder of recordings IS the app's "audio" folder there. So inside
 * the app's folders a file goes only when its name is one the app gives, and a folder
 * goes only once it is empty. The app cannot delete the chosen folder itself: it holds
 * that folder, not the place the folder sits in. On an iPad there is no such folder;
 * everything lives in the browser's private storage, which is cleared whole.
 *
 * ⚠ NOTHING MAY WRITE ONCE IT STARTS. Several parts of the app save on a timer, and one
 * saves when the page is hidden, so a write landing after the delete would put a piece
 * back. refuseFurtherWrites() stops the browser storage being written at all, and
 * storage.releaseForUninstall() (app.js calls it first) lets go of the data folder.
 *
 * ⚠ THE SERVICE WORKER GOES BEFORE THE CACHES. It saves a copy of every file the page
 * fetches, so with the worker still registered a deleted cache could be refilled.
 *
 * A SECOND LOOK, after a pause, catches anything put back while the first pass ran and
 * deletes it again. Whatever is still there after that is reported, never hidden.
 */
import { LOCK_NAME } from './single-instance.js';

// The app's fixed file names at the top of a data folder: the nine data files
// (data-transfer.js DATA_FILES), the two logs and the keyguard file. metrics.log is the
// single log used before monthly files (CR-290). tests/uninstall.test.mjs fails if the
// app starts writing a file there that this list does not cover.
export const APP_FILES = [
    'worldview.json', 'relationships.json', 'places.json', 'topics.json',
    'practice-scenarios.json', 'control-phrases.json', 'placeholders.json',
    'express-panel.json', 'voice.json',
    'errors.log', 'metrics.log', 'Screen Openings.txt',
];
const MONTHLY_METRICS = /^metrics-\d{4}-\d{2}\.log$/;

// The folders the app makes in a data folder (storage.js DATA_SUBFOLDERS).
export const APP_FOLDERS = ['settings', 'conversations', 'backups', 'audio', 'sources'];

// The databases the app opens, for a browser that cannot list them (indexedDB.databases()
// is missing in some older browsers). Deleting one that does not exist does nothing.
const KNOWN_DATABASES = ['aac-db', 'conversant-voice-audio'];

const AUDIO_NAME = /^[A-Za-z0-9_-]+\.(mp3|m4a)$/;   // express-audio.isSafeAudioName

export function isAppFile(name) {
    return APP_FILES.includes(name) || MONTHLY_METRICS.test(name);
}

/* Which files inside one of the app's folders are the app's own. Conversations are
 * named by the date and time they started; backups start with "conversant-"; a
 * settings profile is any .json file there. Sounds and documents have names the user
 * chose, so they count only when the app's own list names them (the Express Panel for
 * sounds, the documents' list for documents). */
export function isAppFileIn(folder, name, known = { audio: new Set(), sources: new Set() }) {
    switch (folder) {
        case 'conversations': return /^\d{4}-\d{2}-\d{2}.*\.json$/.test(name);
        case 'backups': return /^conversant-.*\.json$/i.test(name);
        case 'settings': return /\.json$/i.test(name);
        case 'audio': return known.audio.has(name);
        case 'sources': return known.sources.has(name);
        default: return false;
    }
}

/* True when Conversant is open in another window or tab and waiting for this one to
 * close (single-instance.js). That copy has already read the user's data, and the
 * moment this one goes it becomes usable and can save it all back. */
export async function anotherCopyWaiting(env = globalThis) {
    const locks = env.navigator && env.navigator.locks;
    if (!locks || typeof locks.query !== 'function') return false;
    try {
        const { pending = [] } = await locks.query();
        return pending.some((l) => l && l.name === LOCK_NAME);
    } catch {
        return false;
    }
}

/* From here on, nothing is written to the browser's storage, by this module or any
 * other: saving a setting does nothing, and opening a database fails (every part of the
 * app that opens one already treats a failure as "nothing stored"). Changing the
 * browser's own functions is a blunt tool, and it is used here because the page's job
 * is over: the alternative is finding every timer and page-hide save in the app, and
 * the one that is missed puts something back. Removing and clearing still work. */
export function refuseFurtherWrites(env = globalThis) {
    try {
        if (env.Storage && env.Storage.prototype) env.Storage.prototype.setItem = function () {};
    } catch { /* not changeable here */ }
    try {
        if (env.IDBFactory && env.IDBFactory.prototype) {
            env.IDBFactory.prototype.open = function () {
                throw new Error('Conversant has been deleted from this device.');
            };
        }
    } catch { /* not changeable here */ }
}

// ── The data folder the user can see ────────────────────────────────────────────

async function readJson(dir, name) {
    try {
        const fh = await dir.getFileHandle(name);
        return JSON.parse(await (await fh.getFile()).text());
    } catch {
        return null;
    }
}

function collectAudioNames(value, into) {
    if (typeof value === 'string') {
        if (AUDIO_NAME.test(value)) into.add(value);
    } else if (Array.isArray(value)) {
        for (const v of value) collectAudioNames(v, into);
    } else if (value && typeof value === 'object') {
        for (const v of Object.values(value)) collectAudioNames(v, into);
    }
    return into;
}

async function entryNames(dir, kind) {
    const names = [];
    for await (const [name, handle] of dir.entries()) {
        if (!kind || (handle && handle.kind === kind)) names.push(name);
    }
    return names;
}

/* Delete what the app made in a folder the user chose. Returns what could not be
 * deleted (the names, for the report). A folder left with the user's own files in it
 * is kept, and that is not a failure. */
export async function deleteAppFilesFromFolder(folder, { env = globalThis } = {}) {
    const failed = [];

    // What the app's own lists name, read before anything goes.
    const known = { audio: new Set(), sources: new Set(['index.json']) };
    collectAudioNames(await readJson(folder, 'express-panel.json'), known.audio);
    try {
        const cached = env.localStorage && env.localStorage.getItem('aac_express_items');
        if (cached) collectAudioNames(JSON.parse(cached), known.audio);
    } catch { /* no copy, or not readable */ }
    try {
        const sourcesDir = await folder.getDirectoryHandle('sources');
        const index = await readJson(sourcesDir, 'index.json');
        const docs = index && Array.isArray(index.documents) ? index.documents : [];
        for (const d of docs) {
            if (d && typeof d.base === 'string' && d.base) {
                known.sources.add(`${d.base}.txt`);
                known.sources.add(`${d.base}.pdf`);
            }
        }
    } catch { /* no documents folder */ }

    for (const sub of APP_FOLDERS) {
        let dir;
        try { dir = await folder.getDirectoryHandle(sub); } catch { continue; }   // not there
        let names;
        try {
            names = (await entryNames(dir, 'file')).filter((n) => isAppFileIn(sub, n, known));
        } catch {
            failed.push(sub);
            continue;
        }
        for (const name of names) {
            try { await dir.removeEntry(name); } catch { failed.push(`${sub}/${name}`); }
        }
        // Refused when anything is left in it, which is the point: what is left is not
        // the app's.
        try { await folder.removeEntry(sub); } catch { /* kept, with the user's files in it */ }
    }

    let top = [];
    try { top = (await entryNames(folder, 'file')).filter(isAppFile); } catch { failed.push('the folder itself'); }
    for (const name of top) {
        try { await folder.removeEntry(name); } catch { failed.push(name); }
    }
    return failed;
}

// ── What the browser keeps ──────────────────────────────────────────────────────

function deleteDatabase(idb, name, waitMs) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (outcome) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(outcome);
        };
        // A database still open somewhere is "blocked": the delete is queued and finishes
        // once it closes. The app's own connections close when asked (storage.js and
        // voice-store.js), so this waits only for something outside the app.
        const timer = setTimeout(() => finish('waiting'), waitMs);
        try {
            const req = idb.deleteDatabase(name);
            req.onsuccess = () => finish('deleted');
            req.onerror = () => finish('failed');
        } catch {
            finish('failed');
        }
    });
}

async function databaseNames(env) {
    const idb = env.indexedDB;
    if (!idb) return [];
    let listed = [];
    if (typeof idb.databases === 'function') {
        try { listed = (await idb.databases()).map((d) => d && d.name).filter(Boolean); } catch { /* not listable */ }
    }
    return [...new Set([...listed, ...KNOWN_DATABASES])];
}

async function privateStorageRoot(env) {
    const s = env.navigator && env.navigator.storage;
    if (!s || typeof s.getDirectory !== 'function') return null;
    try { return await s.getDirectory(); } catch { return null; }
}

/* One pass over everything the browser keeps for the app. Returns what could not be
 * deleted, as { what, name } for the report. */
export async function clearBrowserStorage(env = globalThis, { dbWaitMs = 4000 } = {}) {
    const failed = [];

    const sw = env.navigator && env.navigator.serviceWorker;
    if (sw && typeof sw.getRegistrations === 'function') {
        try {
            for (const reg of await sw.getRegistrations()) {
                try { await reg.unregister(); } catch { failed.push({ what: 'offline', name: 'service worker' }); }
            }
        } catch { failed.push({ what: 'offline', name: 'service worker' }); }
    }

    if (env.caches && typeof env.caches.keys === 'function') {
        try {
            for (const key of await env.caches.keys()) {
                try { await env.caches.delete(key); } catch { failed.push({ what: 'offline', name: key }); }
            }
        } catch { failed.push({ what: 'offline', name: 'caches' }); }
    }

    if (env.indexedDB) {
        for (const name of await databaseNames(env)) {
            const outcome = await deleteDatabase(env.indexedDB, name, dbWaitMs);
            if (outcome !== 'deleted') failed.push({ what: 'database', name });
        }
    }

    const root = await privateStorageRoot(env);
    if (root) {
        try {
            for (const name of await entryNames(root)) {
                try { await root.removeEntry(name, { recursive: true }); } catch { failed.push({ what: 'private', name }); }
            }
        } catch { failed.push({ what: 'private', name: 'files' }); }
    }

    for (const key of ['localStorage', 'sessionStorage']) {
        try { if (env[key]) env[key].clear(); } catch { failed.push({ what: 'settings', name: key }); }
    }
    return failed;
}

/* What the browser still holds for the app, as { what, name }. Empty means everything
 * is gone. Used for the second look, and by the browser check. */
export async function whatIsLeft(env = globalThis) {
    const left = [];
    for (const key of ['localStorage', 'sessionStorage']) {
        try { if (env[key] && env[key].length) left.push({ what: 'settings', name: key }); } catch { /* unreadable */ }
    }
    try {
        const sw = env.navigator && env.navigator.serviceWorker;
        if (sw && typeof sw.getRegistrations === 'function') {
            for (let i = (await sw.getRegistrations()).length; i > 0; i--) left.push({ what: 'offline', name: 'service worker' });
        }
    } catch { /* unreadable */ }
    try {
        if (env.caches && typeof env.caches.keys === 'function') {
            for (const key of await env.caches.keys()) left.push({ what: 'offline', name: key });
        }
    } catch { /* unreadable */ }
    try {
        if (env.indexedDB && typeof env.indexedDB.databases === 'function') {
            for (const d of await env.indexedDB.databases()) if (d && d.name) left.push({ what: 'database', name: d.name });
        }
    } catch { /* unreadable */ }
    try {
        const root = await privateStorageRoot(env);
        if (root) for (const name of await entryNames(root)) left.push({ what: 'private', name });
    } catch { /* unreadable */ }
    return left;
}

/* The whole job. `folder` is the data folder the user can see, given only when they
 * asked for its contents to go too. Resolves to { folderFailed, left }: the folder
 * entries that could not be deleted, and what the browser still holds after the
 * second look. Both empty means everything went. */
export async function deleteEverything({
    folder = null,
    env = globalThis,
    onStep = () => {},
    settleMs = 1500,
    dbWaitMs = 4000,
} = {}) {
    refuseFurtherWrites(env);

    let folderFailed = [];
    if (folder) {
        onStep('folder');
        try { folderFailed = await deleteAppFilesFromFolder(folder, { env }); }
        catch { folderFailed = ['the folder itself']; }
    }

    onStep('browser');
    await clearBrowserStorage(env, { dbWaitMs });

    onStep('checking');
    await new Promise((r) => setTimeout(r, settleMs));
    let left = await whatIsLeft(env);
    if (left.length) {
        await clearBrowserStorage(env, { dbWaitMs });
        left = await whatIsLeft(env);
    }
    return { folderFailed, left };
}
