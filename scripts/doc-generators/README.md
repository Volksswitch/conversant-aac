# Document generators

The scripts that build the `.docx` files in `Documents/`, plus the figures they embed
and the HTML the figures are captured from. Moved here from the project root on
August 11 2026 (Ken: *"move the generation scripts to a separate folder"*).

**They are here, and not in `Documents/`, because they are source code.** The documents
are git-ignored OneDrive artifacts; these scripts are tracked. Filing tracked code
inside a folder of ignored documents invites a wholesale ignore rule that would quietly
drop the generators from the repository.

## Running one

From anywhere:

```bash
node scripts/doc-generators/generate-product-overview-doc.js
```

`doc-paths.js` makes that true. These scripts used to address everything by bare
relative name — `readFileSync('ui-fig1-anatomy.png')`, `writeFileSync('… .docx')` —
which resolves against the **shell's** working directory, so they only ever worked when
run from the root. Requiring `doc-paths` chdirs here (so a figure name finds the figure)
and gives `docPath(name)` for an output (which resolves into `Documents/`). Require it
above any `readFileSync` at module scope: several generators load their figures while
the file is being evaluated.

## ⚠ Before you run one

**A generator rewrites its document from the text in the script.** Ken edits several of
the `.docx` by hand, so the document is routinely *newer* than the generator. Back the
document up and diff it against what the script would produce before regenerating —
`generate-beta-test-plan-doc.js` carries this warning in its own header for exactly that
reason.

## Figures

`capture-diagrams.js` and `capture-engine-diagrams.js` screenshot the two HTML files
here into the `.png` files here; the generators then embed them. Both capture scripts
resolve from `__dirname`, so they needed no change in the move.
