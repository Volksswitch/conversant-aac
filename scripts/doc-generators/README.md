# Document generators

The scripts that build the `.docx` files in `Documents/`, plus the figures they embed
and the HTML the figures are captured from. Moved here from the project root on
August 11 2026 (Ken: *"move the generation scripts to a separate folder"*).

**They are here, and not in `Documents/`, because they are source code.** The documents
are git-ignored OneDrive artifacts; these scripts are tracked. Filing tracked code
inside a folder of ignored documents invites a wholesale ignore rule that would quietly
drop the generators from the repository.

## ⚠ EDITING AN EXISTING DOCUMENT? START AT `docx_safe.py`. READ THIS FIRST.

**`docx_safe.py` is the one place document edits go**, and its `save()` refuses to write
a file Word would reject. Import it; do not write a new helper.

```python
import docx_safe as D
doc = D.open_doc(path)
D.insert_row_after(doc, 'Subsequent delay', ['Wait longer', 'Adds this much...'])
D.append_run(doc, 'anchor text', ' one more sentence.')
D.save(doc, path)          # validates first, raises DocxIntegrityError
```

**WHY THIS PARAGRAPH EXISTS (Ken, September 8 2026: *"I want to kill these ongoing
problems and never allow them to resurrect!"*).** These helpers kept being rewritten
from scratch, once per session, in a scratch directory — so every session re-earned the
same bugs, and a sync pass wrote a `normalize-notes` twin when
[`normalize-notes.py`](normalize-notes.py) was already sitting here doing it better.
**Nineteen helpers were already in this folder and a twentieth got written anyway.**
That is the actual cause of "documents break in every sync pass".

**Two faults it now makes structurally impossible**, both of which produced a document
Word refuses while the zip tested clean, every part parsed and every documentation rule
passed:

| Fault | What caused it | Guard |
|---|---|---|
| Duplicated `commentReference` | appending text by deep-copying a paragraph's last run | `append_run` copies formatting only, never a run holding a unique child |
| An empty `<w:tc>` | deleting a cell's only paragraph instead of the row | `set_cell_text` never empties a cell; `save()` rejects one |

**Guaranteed by `test_docx_safe.py`, which runs inside `npm test`** (via
`tests/docx-toolkit.test.mjs`) and is verified to fail when either guard is removed. The
numbering-id half of the same guarantee lives in
[`fix-numbering-ids.py`](fix-numbering-ids.py) and is reported by `check docs`.

**If you are about to write `insert_row_after` again, you are in the wrong file.**

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

## Drawing ids

`fix-drawing-ids.py` gives every picture in a document its own id.

```bash
python scripts/doc-generators/fix-drawing-ids.py --check Documents/*.docx
python scripts/doc-generators/fix-drawing-ids.py "Documents/One File.docx"
```

**Run it after regenerating any document that has figures.** The docx library's
`ImageRun` emits `id="1"` for every image and no generator sets it, so a freshly
generated document with more than one figure starts life duplicating them - the
same class of fault as a duplicated comment reference, and `docx_safe.save()`
refuses to write it.

**⚠ A CLEAN SURVEY DOES NOT MEAN THE GENERATORS ARE FIXED.** Word silently
renumbers these on save, so only documents nobody has hand-saved stay dirty - the
Architecture Overview has nine figures and is clean for that reason alone. Word
opening a file is likewise no evidence: both dirty documents opened fine and
passed every rule.

## File dates in Explorer

`stamp-doc-dates.py` makes a document's modification date agree with its own
"Last updated" byline, so Explorer answers "when was this last updated?" without
anybody opening Word.

```bash
python scripts/doc-generators/stamp-doc-dates.py            # what is out of step
python scripts/doc-generators/stamp-doc-dates.py --apply    # set them
```

**Run it at the END of a sync**, after `check docs`. It is a step of the sync
workflow rather than a one-off repair, because the thing that breaks the dates is
our own bulk passes: any script that rewrites a file bumps its date whether or not
it changed anything a reader would notice. When this was written, 11 of 32
documents were out of step, the worst by 52 days, and ten of them sat in clusters
sharing a timestamp to the second.

**The byline wins where the two disagree**, and the date only ever moves backwards.
The reasoning, and the one case where its answer is wrong, are in the script's own
header and in CLAUDE.md step 4c.

## Figures

`capture-diagrams.js` and `capture-engine-diagrams.js` screenshot the two HTML files
here into the `.png` files here; the generators then embed them. Both capture scripts
resolve from `__dirname`, so they needed no change in the move.
