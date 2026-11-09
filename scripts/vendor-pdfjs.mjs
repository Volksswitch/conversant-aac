// Copies Mozilla's PDF reader (pdfjs-dist, Apache 2.0) from node_modules into
// app/vendor/pdfjs/, which is what the deployed app loads. Run after changing the
// pdfjs-dist version in package.json:  node scripts/vendor-pdfjs.mjs
//
// Only the two files text extraction needs are copied, plus the license. The character
// maps and fonts (several megabytes) are left out: they are needed to DRAW a page and
// for some East Asian PDFs, not to read the text of an ordinary English one.
import fs from 'node:fs';
import path from 'node:path';

const from = path.resolve('node_modules/pdfjs-dist');
const to = path.resolve('app/vendor/pdfjs');
const version = JSON.parse(fs.readFileSync(path.join(from, 'package.json'), 'utf8')).version;
fs.mkdirSync(to, { recursive: true });
// Saved with a plain .js ending: some web servers send .mjs as plain text, and a
// browser refuses to run a module that arrives that way.
for (const [f, as] of [['build/pdf.min.mjs', 'pdf.min.js'], ['build/pdf.worker.min.mjs', 'pdf.worker.min.js'], ['LICENSE', 'LICENSE']]) {
    fs.copyFileSync(path.join(from, f), path.join(to, as));
}
for (const old of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.rmSync(path.join(to, old), { force: true });
fs.writeFileSync(path.join(to, 'VERSION'), `pdfjs-dist ${version}\n`);
console.log(`copied pdfjs-dist ${version} to app/vendor/pdfjs/`);
