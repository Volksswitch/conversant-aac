/*
 * Recordings of the fixed phrases in the paid voice, kept between sessions (Ken,
 * October 9 2026).
 *
 * The paid voices already keep what they have said, but only until the app closes,
 * so the first holding phrase of every session waited on the network - exactly the
 * moment the phrase exists to cover. This keeps the recordings of the phrases the app
 * says over and over (holding phrases, the Commands phrases, openers without a name,
 * Express Panel phrases) in the browser's own storage.
 *
 * ⚠ BROWSER STORAGE, NOT THE DATA FOLDER. Every recording can be fetched again, so
 * there is no reason to fill the user's folder with them or carry them in a backup.
 * Eviction costs one fetch per phrase and nothing else.
 *
 * ⚠ ONLY FIXED PHRASES ARE EVER WRITTEN HERE. phrase-audio.js decides what is
 * wanted; nothing an AI wrote and nothing the partner said reaches this store.
 *
 * Every call degrades to a no-op where IndexedDB is missing or refuses (a private
 * window, a test run), because a missing recording only means a fetch.
 */

const DB_NAME = 'conversant-voice-audio';
const STORE = 'clips';

let dbPromise = null;

function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') return resolve(null);
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        } catch { resolve(null); }
    });
    return dbPromise;
}

function run(mode, fn) {
    return open().then((db) => new Promise((resolve) => {
        if (!db) return resolve(null);
        try {
            const tx = db.transaction(STORE, mode);
            const store = tx.objectStore(STORE);
            const req = fn(store);
            tx.oncomplete = () => resolve(req ? req.result : null);
            tx.onerror = () => resolve(null);
            tx.onabort = () => resolve(null);
        } catch { resolve(null); }
    }));
}

/** The stored bytes for a key, or null. */
export async function get(key) {
    const v = await run('readonly', (s) => s.get(key));
    return v && v.bytes ? v.bytes : null;
}

export async function put(key, bytes) {
    if (!bytes || !bytes.byteLength) return;
    await run('readwrite', (s) => s.put({ bytes, at: Date.now() }, key));
}

export async function keys() {
    return (await run('readonly', (s) => s.getAllKeys())) || [];
}

export async function remove(key) {
    await run('readwrite', (s) => s.delete(key));
}
