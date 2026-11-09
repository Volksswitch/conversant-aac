/*
 * SOURCE MATERIAL — the documents a question session draws on (Ken, November 9 2026).
 *
 * One folder in the data folder, `sources/`, with each document kept ONCE whatever uses
 * it. Places and people will point to documents by id, so replacing a document with a
 * newer version reaches every talk that uses it, and no talk can hold a stale copy.
 *
 * What is in the folder:
 *   index.json        the list: [{ id, title, base, original, kind, added, updated, words, chars }]
 *   <base>.txt        the plain text the AI reads, made once when the document is added
 *   <base>.pdf        the original, when there was one, so the user can see what it came from
 *
 * The files are named after the document's title rather than its id, so a person
 * looking in the folder can tell them apart. The id never changes; the name is chosen
 * once, when the document is added, and a later rename changes only the title.
 *
 * ⚠ THE TEXT IS THE USER'S OWN, NEVER AN AI SUMMARY (design, section 6). A summary loses
 * their wording, and an answer may need a figure or a name exactly as written.
 *
 * ⚠ A BACKUP CARRIES THE INDEX AND THE TEXT, NOT THE ORIGINALS. The text is all an iPad
 * needs to answer questions; a PDF inside a backup would only make it larger.
 */
import * as storage from './storage.js';

const INDEX = 'index.json';

// The most text one document may hold: about 65,000 words. A paper and a product
// description together are about 23,000. Refused rather than cut, because a document
// that silently lost its second half would give answers that are wrong without saying so.
export const MAX_SOURCE_CHARS = 400_000;

// A title the screen and the folder can both show.
export const MAX_TITLE_CHARS = 80;

/** Tidy extracted or pasted text without changing a word of it. */
export function cleanText(text) {
    return String(text || '')
        .normalize('NFC')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')       // trailing spaces
        .replace(/\n{3,}/g, '\n\n')       // runs of blank lines
        .trim();
}

export function wordCount(text) {
    const t = String(text || '').trim();
    return t ? t.split(/\s+/).length : 0;
}

/** A file name from a title: letters, digits, spaces and a few marks, nothing that
 *  could reach outside the folder. */
export function baseFromTitle(title) {
    const b = String(title || '').normalize('NFC')
        .replace(/[^\p{L}\p{N} ._()'-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[ .]+|[ .]+$/g, '')
        .slice(0, 60)
        .trim();
    return b || 'Document';
}

/** True for a name source-material.js could have written. A backup is a file anyone
 *  could hand the app, so a restore refuses anything else. */
export function isSafeBase(base) {
    return typeof base === 'string' && base.length > 0 && base.length <= 64
        && base === baseFromTitle(base) && !base.startsWith('.');
}

function newId() {
    return `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEntry(e) {
    if (!e || typeof e.id !== 'string' || !isSafeBase(e.base)) return null;
    return {
        id: e.id,
        title: String(e.title || e.base).trim().slice(0, MAX_TITLE_CHARS) || e.base,
        base: e.base,
        original: e.original === 'pdf' ? 'pdf' : null,
        kind: e.kind === 'pdf' ? 'pdf' : 'paste',
        added: e.added || null,
        updated: e.updated || e.added || null,
        words: Number(e.words) || 0,
        chars: Number(e.chars) || 0,
    };
}

export function normalizeIndex(raw) {
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.documents) ? raw.documents : []);
    const seen = new Set();
    const out = [];
    for (const e of list.map(normalizeEntry)) {
        if (!e || seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
    }
    return out;
}

async function readIndex() {
    const text = await storage.readSourceFile(INDEX);
    if (!text) return [];
    try { return normalizeIndex(JSON.parse(text)); } catch { return []; }
}

async function writeIndex(list) {
    await storage.writeSourceFile(INDEX, JSON.stringify({ version: 1, documents: list }, null, 2));
}

// One change at a time: two adds racing would each read the old index and the second
// write would drop the first document.
let queue = Promise.resolve();
function serial(fn) {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
}

function checkText(text) {
    const clean = cleanText(text);
    if (!clean) throw new Error('There is no text in that document.');
    if (clean.length > MAX_SOURCE_CHARS) {
        throw new Error(`That document is too long: about ${wordCount(clean).toLocaleString('en-US')} words. The most is about 65,000.`);
    }
    return clean;
}

/** Every document, in the order added. */
export function listSources() {
    return serial(readIndex);
}

/**
 * Add a document. `text` is its plain text; `original` is { blob, ext: 'pdf' } when it
 * came from a file. Returns the new index entry.
 */
export function addSource({ title, text, original = null }) {
    return serial(async () => {
        const clean = checkText(text);
        const list = await readIndex();
        const name = String(title || '').trim().slice(0, MAX_TITLE_CHARS) || 'Document';
        let base = baseFromTitle(name);
        const taken = new Set(list.map((e) => e.base.toLowerCase()));
        for (let n = 2; taken.has(base.toLowerCase()) || await storage.sourceFileExists(`${base}.txt`); n++) {
            base = `${baseFromTitle(name).slice(0, 56)} (${n})`;
        }
        const now = new Date().toISOString();
        const entry = {
            id: newId(), title: name, base,
            original: original && original.blob ? 'pdf' : null,
            kind: original && original.blob ? 'pdf' : 'paste',
            added: now, updated: now,
            words: wordCount(clean), chars: clean.length,
        };
        await storage.writeSourceFile(`${base}.txt`, clean);
        if (entry.original) await storage.writeSourceFile(`${base}.pdf`, original.blob);
        list.push(entry);
        await writeIndex(list);
        return entry;
    });
}

/**
 * Replace a document with a newer version. The id stays the same, so every place or
 * person pointing to it gets the new version.
 */
export function replaceSource(id, { text, original = null }) {
    return serial(async () => {
        const clean = checkText(text);
        const list = await readIndex();
        const entry = list.find((e) => e.id === id);
        if (!entry) throw new Error('That document is no longer in the folder.');
        await storage.writeSourceFile(`${entry.base}.txt`, clean);
        if (original && original.blob) {
            await storage.writeSourceFile(`${entry.base}.pdf`, original.blob);
            entry.original = 'pdf';
            entry.kind = 'pdf';
        } else {
            // Pasted text replacing a PDF: the old PDF no longer matches the text.
            if (entry.original) await storage.deleteSourceFile(`${entry.base}.pdf`);
            entry.original = null;
            entry.kind = 'paste';
        }
        entry.updated = new Date().toISOString();
        entry.words = wordCount(clean);
        entry.chars = clean.length;
        await writeIndex(list);
        return entry;
    });
}

export function renameSource(id, title) {
    return serial(async () => {
        const list = await readIndex();
        const entry = list.find((e) => e.id === id);
        const t = String(title || '').trim().slice(0, MAX_TITLE_CHARS);
        if (!entry || !t) return null;
        entry.title = t;
        await writeIndex(list);
        return entry;
    });
}

export function removeSource(id) {
    return serial(async () => {
        const list = await readIndex();
        const entry = list.find((e) => e.id === id);
        if (!entry) return false;
        await storage.deleteSourceFile(`${entry.base}.txt`);
        if (entry.original) await storage.deleteSourceFile(`${entry.base}.pdf`);
        await writeIndex(list.filter((e) => e.id !== id));
        return true;
    });
}

/**
 * The text of the given documents, as [{ name, text }] in the order asked for, for the
 * request. A document no longer in the folder is skipped, not an error: a talk that
 * still points to one should still work with the rest.
 */
export function readSources(ids) {
    return serial(async () => {
        const list = await readIndex();
        const out = [];
        for (const id of ids || []) {
            const e = list.find((x) => x.id === id);
            if (!e) continue;
            const text = await storage.readSourceFile(`${e.base}.txt`);
            if (text) out.push({ id, name: e.title, text });
        }
        return out;
    });
}

/** For a backup: the index and every document's text. Originals stay behind. */
export function exportSources() {
    return serial(async () => {
        const index = await readIndex();
        const texts = [];
        for (const e of index) {
            const text = await storage.readSourceFile(`${e.base}.txt`);
            if (text) texts.push({ id: e.id, text });
        }
        return { index, texts };
    });
}

/**
 * From a backup. A document with the same id is replaced (the backup's is the version
 * being restored); every other document already here is kept. Returns how many came in.
 */
export function importSources(pkg) {
    return serial(async () => {
        if (!pkg || typeof pkg !== 'object') return 0;
        const incoming = normalizeIndex(pkg.index);
        const texts = new Map((Array.isArray(pkg.texts) ? pkg.texts : [])
            .filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string')
            .map((t) => [t.id, t.text]));
        const list = await readIndex();
        let count = 0;
        for (const e of incoming) {
            const raw = texts.get(e.id);
            if (!raw) continue;
            const clean = cleanText(raw);
            if (!clean || clean.length > MAX_SOURCE_CHARS) continue;
            const here = list.findIndex((x) => x.id === e.id);
            // A different document already using this file name keeps it; the incoming
            // one gets a free name instead of overwriting it.
            let base = here >= 0 ? list[here].base : e.base;
            if (here < 0) {
                const taken = new Set(list.map((x) => x.base.toLowerCase()));
                for (let n = 2; taken.has(base.toLowerCase()); n++) base = `${e.base.slice(0, 56)} (${n})`;
            }
            // A PDF here that no longer matches the restored text would mislead whoever
            // opens it, so it goes.
            let original = here >= 0 ? list[here].original : null;
            if (original && (await storage.readSourceFile(`${base}.txt`)) !== clean) {
                await storage.deleteSourceFile(`${base}.pdf`);
                original = null;
            }
            await storage.writeSourceFile(`${base}.txt`, clean);
            const entry = { ...e, base, original, kind: original ? 'pdf' : e.kind,
                words: wordCount(clean), chars: clean.length };
            if (here >= 0) list[here] = entry; else list.push(entry);
            count++;
        }
        if (count) await writeIndex(list);
        return count;
    });
}
