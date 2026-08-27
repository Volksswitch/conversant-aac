"""Accept every tracked change and clear every comment anchor in a .docx.

Ken reviews the manuals in Word with track-changes on. His edits are decisions, so they
are accepted wholesale; his comments are instructions, which are acted on separately and
then have to stop being attached to the text.

  python scripts/doc-generators/accept-revisions.py "<file.docx>"

WHAT IT DOES, and each of these is a distinct kind of revision markup:
  w:ins            an insertion  -> unwrap (keep the text, drop the wrapper)
  w:del            a deletion    -> remove the whole element, w:delText and all
  w:rPrChange      a formatting change on a run       -> drop (accepts it)
  w:pPrChange      a formatting change on a paragraph -> drop (accepts it)
  w:sectPrChange   the same for a section             -> drop
  w:tblPrChange, w:tcPrChange, w:trPrChange, w:tblGridChange  -> drop
  w:moveFrom / w:moveTo   a move                      -> drop the from, unwrap the to
  w:commentRangeStart/End -> remove
  a run whose only content is w:commentReference -> remove the run

⚠ ONLY word/document.xml IS TOUCHED. The comments themselves stay in word/comments.xml,
orphaned: with no reference and no range left in the document there is nothing for Word
to anchor them to, so none of them renders. Rewriting the other parts by hand is how
this project has broken documents before (see CLAUDE.md, "sync docs") and it buys
nothing here.

⚠ SAVED THROUGH python-docx, never a hand-rolled zip. Serializing the tree and
rebuilding the package by hand silently drops namespace declarations, and document.xml's
root carries mc:Ignorable whose VALUE IS A LIST OF PREFIX NAMES - lose one and Word
refuses the file outright, while every other tool opens it happily.
"""
import sys, os
from docx import Document

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

UNWRAP = ('ins', 'moveTo')
DROP = ('del', 'moveFrom', 'rPrChange', 'pPrChange', 'sectPrChange',
        'tblPrChange', 'tcPrChange', 'trPrChange', 'tblGridChange',
        'commentRangeStart', 'commentRangeEnd', 'moveFromRangeStart',
        'moveFromRangeEnd', 'moveToRangeStart', 'moveToRangeEnd')


def unwrap(el):
    """Replace an element with its children, in place."""
    parent = el.getparent()
    at = list(parent).index(el)
    for i, child in enumerate(list(el)):
        parent.insert(at + i, child)
    # A tail on the wrapper would otherwise be lost.
    parent.remove(el)


def accept(path):
    doc = Document(path)
    root = doc.element
    counts = {}

    # Deletions and other drops first: an inserted run can sit inside a deleted block,
    # and unwrapping it first would rescue text that was meant to go.
    for tag in DROP:
        for el in list(root.iter(W + tag)):
            if el.getparent() is None:
                continue                      # already removed with an ancestor
            el.getparent().remove(el)
            counts[tag] = counts.get(tag, 0) + 1

    for tag in UNWRAP:
        for el in list(root.iter(W + tag)):
            if el.getparent() is None:
                continue
            unwrap(el)
            counts[tag] = counts.get(tag, 0) + 1

    # A run left holding only a comment reference is an empty run in the text.
    for run in list(root.iter(W + 'r')):
        if run.getparent() is None:
            continue
        kids = [k.tag for k in run if k.tag != W + 'rPr']
        if kids and all(k == W + 'commentReference' for k in kids):
            run.getparent().remove(run)
            counts['commentReference run'] = counts.get('commentReference run', 0) + 1

    doc.save(path)
    return counts


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    for p in sys.argv[1:]:
        c = accept(p)
        print(os.path.basename(p))
        for k in sorted(c):
            print('  %-22s %d' % (k, c[k]))
        if not c:
            print('  nothing to accept')
