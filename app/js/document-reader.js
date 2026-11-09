/*
 * READING A DOCUMENT INTO PLAIN TEXT, for the source material behind question sessions
 * (Ken, November 9 2026: "PDF reader, plus paste").
 *
 * A PDF is read with Mozilla's PDF reader (pdf.js, Apache 2.0, the one Firefox uses),
 * copied into app/vendor/pdfjs/ by scripts/vendor-pdfjs.mjs. It is the first outside
 * code in the deployed app, so it is credited in NOTICE.
 *
 * ⚠ IT IS LOADED ONLY WHEN A DOCUMENT IS ADDED, never at start-up and never during a
 * conversation, and it is not in the offline file list. 1.7 MB is a lot to make every
 * device download for something done a few times a year, on a computer.
 *
 * Anything that is not a PDF arrives as pasted text or a .txt file and needs no reader.
 */

const PDFJS_URL = new URL('../vendor/pdfjs/pdf.min.js', import.meta.url).href;
const WORKER_URL = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;

let loaded = null;
async function loadPdfjs() {
    if (!loaded) {
        loaded = import(PDFJS_URL).then((lib) => {
            lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
            return lib;
        });
        loaded.catch(() => { loaded = null; });   // a failed load may be tried again
    }
    return loaded;
}

/**
 * Turn one page's text pieces into lines. pdf.js hands back the text as pieces with a
 * flag saying where a line ends; the pieces carry their own spaces most of the time.
 *
 * A line ending in a hyphen is joined to the next WITHOUT a space and with the hyphen
 * kept: "turn-" + "taking" must stay "turn-taking", and "conver-" + "sation" reading
 * "conver-sation" costs the AI nothing, where guessing which hyphens to drop would
 * sometimes join two real words.
 */
export function pageText(items) {
    let out = '';
    for (const it of items || []) {
        if (!it || typeof it.str !== 'string') continue;
        out += it.str;
        if (it.hasEOL) out += '\n';
    }
    return out
        .replace(/[ \t]+/g, ' ')
        .replace(/-\n(?=\S)/g, '-')
        .split('\n').map((l) => l.trim()).join('\n');
}

/**
 * The pages' text as one document, with a blank line between pages.
 *
 * Running headers and footers are dropped: a line that appears on more than half the
 * pages (with any numbers in it treated as alike, so "Page 2 of 26" matches "Page 3 of
 * 26") is the page's furniture, not the document. Left in, it lands in the middle of a
 * sentence on every page break and the AI reads it two dozen times. Only from three
 * pages up; on a short document a repeated line is as likely to be real.
 */
export function joinPages(pages) {
    const trimmed = pages.map((p) => p.trim()).filter(Boolean);
    const shape = (line) => line.replace(/\d+/g, '#').trim();
    let furniture = new Set();
    if (trimmed.length >= 3) {
        const counts = new Map();
        for (const p of trimmed) {
            for (const s of new Set(p.split('\n').map(shape).filter(Boolean))) counts.set(s, (counts.get(s) || 0) + 1);
        }
        furniture = new Set([...counts].filter(([, n]) => n > trimmed.length / 2).map(([s]) => s));
    }
    return trimmed
        .map((p) => p.split('\n').filter((l) => !furniture.has(shape(l))).join('\n').trim())
        .filter(Boolean)
        .join('\n\n');
}

/**
 * Read a PDF's text. `data` is the file's bytes (ArrayBuffer or Uint8Array).
 * `opts.pdfjs` lets a test supply the library; `opts.onProgress({ page, pages })`.
 * Returns { text, pages }.
 */
export async function readPdf(data, opts = {}) {
    const lib = opts.pdfjs || await loadPdfjs();
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    // No running of code carried inside the PDF, and nothing fetched from anywhere.
    const doc = await lib.getDocument({
        data: bytes, isEvalSupported: false, enableXfa: false,
        disableFontFace: true, useSystemFonts: false, stopAtErrors: false,
        verbosity: (lib.VerbosityLevel && lib.VerbosityLevel.ERRORS) || 0,
    }).promise;
    try {
        const pages = [];
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            const content = await page.getTextContent();
            pages.push(pageText(content.items));
            if (opts.onProgress) { try { opts.onProgress({ page: n, pages: doc.numPages }); } catch { /* ignore */ } }
        }
        const text = joinPages(pages);
        if (!text.replace(/\s/g, '')) {
            throw new Error('This PDF has no text in it. It may be pictures of pages from a scanner.');
        }
        return { text, pages: doc.numPages };
    } finally {
        try { await doc.destroy(); } catch { /* ignore */ }
    }
}

/**
 * Read a file the user picked: a PDF through the reader, a plain text file as it is.
 * Returns { text, kind: 'pdf'|'text', pages? }.
 */
export async function readDocumentFile(file, opts = {}) {
    const name = String((file && file.name) || '').toLowerCase();
    const type = String((file && file.type) || '').toLowerCase();
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
        const r = await readPdf(await file.arrayBuffer(), opts);
        return { ...r, kind: 'pdf' };
    }
    if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
        return { text: await file.text(), kind: 'text' };
    }
    throw new Error('Conversant can read a PDF or a plain text file. For anything else, copy its text and paste it in.');
}
