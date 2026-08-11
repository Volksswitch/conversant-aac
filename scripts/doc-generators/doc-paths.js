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
 */
const path = require('path');

process.chdir(__dirname);

const DOCS = path.join(__dirname, '..', '..', 'Documents');

module.exports = {
    DOCS,
    /** Absolute path of a generated document, whatever the working directory. */
    docPath: (name) => path.join(DOCS, name),
};
