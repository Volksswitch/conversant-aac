/* Reading a document into plain text (app/js/document-reader.js).
 *
 * The real PDF reader is run on a real PDF, built here byte by byte so the test needs no
 * file in the repo. In Node the reader's "legacy" build is used, which is the same code
 * made to run without a browser; the app loads the browser build from app/vendor/pdfjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageText, joinPages, readPdf, readDocumentFile } from '../app/js/document-reader.js';

// A minimal PDF: one page per entry, each line drawn on its own line of the page.
function makePdf(pages) {
    const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
    const objs = [];
    const add = (body) => { objs.push(body); return objs.length; };
    const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const pagesId = objs.length + 1 + pages.length * 2;   // the Pages object comes after the pages
    const kids = [];
    for (const lines of pages) {
        const stream = `BT /F1 12 Tf 72 720 Td 14 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`;
        const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
        kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`));
    }
    add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
    const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let out = '%PDF-1.4\n';
    const offsets = [];
    objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new TextEncoder().encode(out);
}

const pdfjs = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs');

test('reads the text of a real PDF, page by page', async () => {
    const pdf = makePdf([['People get uneasy after', 'about four seconds of silence.'], ['Second page.']]);
    const seen = [];
    const r = await readPdf(pdf, { pdfjs, onProgress: (p) => seen.push(p.page) });
    assert.equal(r.pages, 2);
    assert.deepEqual(seen, [1, 2]);
    assert.match(r.text, /People get uneasy after/);
    assert.match(r.text, /about four seconds of silence\./);
    assert.match(r.text, /silence\.\n\nSecond page\./, 'a blank line between pages');
});

test('a PDF with no text says so plainly', async () => {
    await assert.rejects(readPdf(makePdf([[]]), { pdfjs }), /no text in it/);
});

test('joins a line broken at a hyphen, keeping the hyphen', () => {
    const t = pageText([{ str: 'This is turn-', hasEOL: true }, { str: 'taking   in', hasEOL: false }, { str: ' practice.', hasEOL: true }]);
    assert.equal(t, 'This is turn-taking in practice.\n');
    assert.equal(joinPages([' a ', '', 'b']), 'a\n\nb');
});

test('drops a running header or footer that repeats on most pages', () => {
    const words = ['Silence matters.', 'Rate is not all.', 'Partners wait.', 'Options help.'];
    const pages = words.map((w, i) => `${w}\nOverview | June 2026 | Page ${i + 1} of 4`);
    const t = joinPages(pages);
    assert.doesNotMatch(t, /Overview \| June/);
    assert.match(t, /Silence matters\.\n\nRate is not all\./);
    // Two pages are too few to tell furniture from content.
    assert.match(joinPages(['A\nSame line', 'B\nSame line']), /Same line[\s\S]*Same line/);
});

test('a text file is taken as it is; other kinds are refused with what to do instead', async () => {
    const txt = { name: 'notes.txt', type: 'text/plain', text: async () => 'Plain words.' };
    assert.deepEqual(await readDocumentFile(txt), { text: 'Plain words.', kind: 'text' });
    const docx = { name: 'paper.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    await assert.rejects(readDocumentFile(docx), /paste it in/);
});

test('the copy in the app is the version package.json names', () => {
    const want = JSON.parse(readFileSync('package.json', 'utf8')).devDependencies['pdfjs-dist'];
    const have = readFileSync('app/vendor/pdfjs/VERSION', 'utf8').trim();
    assert.equal(have, `pdfjs-dist ${want}`, 'run: node scripts/vendor-pdfjs.mjs');
    const lib = readFileSync('app/vendor/pdfjs/pdf.min.js');
    const src = readFileSync('node_modules/pdfjs-dist/build/pdf.min.mjs');
    assert.ok(lib.equals(src), 'app/vendor/pdfjs is out of date - run: node scripts/vendor-pdfjs.mjs');
});
