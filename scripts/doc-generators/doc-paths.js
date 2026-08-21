/* Where the generators read and write (August 11 2026)
 *
 * These scripts used to live in the project root, so they addressed everything with
 * bare relative names: `readFileSync('ui-fig1-anatomy.png')` for a figure and
 * `writeFileSync('Conversant AAC Product Overview.docx')` for the output. A bare name
 * resolves against the SHELL'S working directory, not the script, so both only ever
 * worked because you happened to run them from the root.
 *
 * Now that the scripts sit here and the documents live in Documents/, requiring this
 * module restores both meanings and makes them independent of where you run from:
 *
 *   - chdir to this folder, so a bare figure name finds the figure beside the script;
 *   - `docPath(name)` for an output, which resolves into Documents/ explicitly.
 *
 * Require it FIRST, above any readFileSync at module scope — several generators load
 * their figures while the file is being evaluated, so a later require would run after
 * the reads it is meant to fix.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE OVERWRITE GUARD (August 17 2026) — why this module now wraps writeFileSync
 *
 * A generator that overwrites its own output cannot tell "rebuild this document"
 * from "destroy every edit made since it was written." Both are the same call. On
 * August 17 2026 a sweep found SIX generators whose documents had been hand-edited
 * (which is how the "sync docs" pass works — python-docx, straight into the .docx),
 * so running any of them would have silently reverted months of work. One of them
 * would have taken out an entire section written that morning.
 *
 * So: before a generator may overwrite a document, the document must be byte-identical
 * to what it produced last time. `doc-manifest.json` records that hash per document.
 *   - hash matches      → the document is untouched since generation; overwrite freely,
 *                         and the manifest is updated to the newly written bytes.
 *   - hash differs      → somebody edited the document. REFUSE.
 *   - no entry at all   → we cannot prove anything about it. REFUSE.
 *
 * A refusal is not a problem to work around, it is the finding: fold the document's
 * edits back into the generator, then run it again. FORCE_DOC_WRITE=1 overrides, and
 * means "I have read the differences and I am discarding them on purpose."
 *
 * ⚠ NOTE THE FAILURE MODE THIS DELIBERATELY DOES NOT USE: comparing file dates. An
 * mtime rule inverts itself the moment you edit the generator — touching the script
 * makes it "newer" than the document and re-arms the very overwrite it was meant to
 * stop. The hash is a statement about content, which is what we actually mean.
 *
 * To check a generator WITHOUT touching its document — always do this first — send its
 * output somewhere else and diff:
 *
 *   OUTPATH=/tmp/regen.docx node -e "const fs=require('fs');const o=fs.writeFileSync.bind(fs);\
 *     fs.writeFileSync=(p,b)=>o(process.env.OUTPATH,b);require('./generate-whatever-doc.js')"
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.chdir(__dirname);

const DOCS = path.join(__dirname, '..', '..', 'Documents');
const MANIFEST = path.join(__dirname, 'doc-manifest.json');

function readManifest() {
    try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); }
    catch (e) { return {}; }
}

function sha(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

// Wrap whatever writeFileSync is current, so a harness that has already redirected
// writes (the scratch-file check above) still works — its target is outside
// Documents/, so the guard passes it straight through.
const previous = fs.writeFileSync.bind(fs);
fs.writeFileSync = function guardedWriteFileSync(target, data, ...rest) {
    const p = String(target);
    const name = path.basename(p);
    // OUTPATH is the check-without-touching workflow from the header: generate to a
    // scratch file and diff it against the document.
    //
    // ⚠ IT NOW PERFORMS THE REDIRECT ITSELF, AND THAT IS A BUG FIX, NOT A CONVENIENCE
    // (August 20 2026). It used to only stand the guard DOWN, leaving the caller to
    // redirect separately by reassigning fs.writeFileSync. So `OUTPATH=… node gen.js`
    // — which reads exactly like "write it over there" — disarmed the safety check and
    // then wrote straight over the real document. That is precisely the accident the
    // guard exists to prevent, and the guard was the thing that opened the door: it
    // happened here on August 20 2026 to the Architecture Overview, discarding months
    // of hand edits plus that morning's sync (recovered from the pre-edit backup).
    //
    // An environment variable named OUTPATH must send the output to OUTPATH. Anything
    // else is a trap baited with its own name.
    const redirected = !!process.env.OUTPATH;
    if (redirected) {
        return previous(process.env.OUTPATH, data, ...rest);
    }
    const guarded = !redirected
                    && path.dirname(path.resolve(p)) === path.resolve(DOCS)
                    && name.toLowerCase().endsWith('.docx');
    if (guarded && fs.existsSync(p) && process.env.FORCE_DOC_WRITE !== '1') {
        const manifest = readManifest();
        const recorded = manifest[name];
        const actual = sha(fs.readFileSync(p));
        if (recorded !== actual) {
            throw new Error(
                '\n\nREFUSING TO OVERWRITE "' + name + '".\n\n' +
                (recorded
                    ? 'That document has been edited since this generator last wrote it.'
                    : 'No record exists of this generator ever having written that document, ' +
                      'so there is no way to tell whether it holds edits this script does not have.') +
                '\n\nRunning it now would discard whatever those edits are, with no error and\n' +
                'nothing to notice afterwards. Fold them into the generator first:\n\n' +
                '  1. generate to a scratch file and diff it against the document\n' +
                '     (the command is in the header of doc-paths.js);\n' +
                '  2. patch the generator until the two agree;\n' +
                '  3. run it again — the guard passes once they match.\n\n' +
                'FORCE_DOC_WRITE=1 overrides this and throws the edits away on purpose.\n');
        }
    }
    const result = previous(target, data, ...rest);
    if (guarded && Buffer.isBuffer(data)) {
        const manifest = readManifest();
        manifest[name] = sha(data);
        const sorted = {};
        for (const k of Object.keys(manifest).sort()) sorted[k] = manifest[k];
        previous(MANIFEST, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
    }
    return result;
};

module.exports = {
    DOCS,
    /** Absolute path of a generated document, whatever the working directory. */
    docPath: (name) => path.join(DOCS, name),
};
