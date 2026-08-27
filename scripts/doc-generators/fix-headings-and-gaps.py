"""Two house rules that apply-doc-style.py deliberately leaves alone.

  python scripts/doc-generators/fix-headings-and-gaps.py "<file.docx>" [--dry]

1. A HEADING KEEPS WITH THE PARAGRAPH UNDER IT (Ken's comment 6). Without it a heading
   can be left stranded at the foot of a page with its section starting overleaf. This
   is `w:keepNext`, and it is set directly on the paragraph rather than in the style
   because the manuals' headings already carry a mix of direct properties; setting it in
   one place would be cleaner but would not survive a heading that overrides it.

   ⚠ apply-doc-style.py REFUSES to touch headings, and rightly - it is a SPACING pass,
   and 97% of headings take their spacing from the style definition, which is the right
   way round. keepNext is not spacing, so it belongs here instead of loosening that rule.

2. ONE BLANK LINE BETWEEN PARAGRAPHS, NEVER TWO. Spacing comes from the paragraph style,
   so a second hand-inserted blank is a gap that matches nothing else in the document.

   ⚠ IT ONLY REMOVES THE SECOND AND SUBSEQUENT BLANK, never the first, and never one
   inside a table cell - an empty paragraph is the only legal content of an otherwise
   empty cell, and removing it produces a file Word refuses to open.
"""
import sys, os
from docx import Document

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def is_heading(p):
    pPr = p.find(W + 'pPr')
    st = pPr.find(W + 'pStyle') if pPr is not None else None
    return st is not None and (st.get(W + 'val') or '').startswith('Heading')


def text_of(p):
    return ''.join(t.text or '' for t in p.iter(W + 't'))


def run(path, dry=False):
    doc = Document(path)
    root = doc.element
    kept = 0
    for p in root.iter(W + 'p'):
        if not is_heading(p) or not text_of(p).strip():
            continue
        pPr = p.find(W + 'pPr')
        if pPr is None:
            pPr = p.makeelement(W + 'pPr', {})
            p.insert(0, pPr)
        if pPr.find(W + 'keepNext') is None:
            if not dry:
                pPr.insert(0, pPr.makeelement(W + 'keepNext', {}))
            kept += 1

    # Blank runs: walk in document order, dropping the 2nd+ consecutive blank.
    removed = 0
    run_len = 0
    for p in list(root.iter(W + 'p')):
        in_table = p.getparent() is not None and p.getparent().tag == W + 'tc'
        blank = not text_of(p).strip()
        if blank and not in_table:
            run_len += 1
            if run_len >= 2:
                if not dry:
                    p.getparent().remove(p)
                removed += 1
        else:
            run_len = 0

    if not dry:
        doc.save(path)
    return kept, removed


if __name__ == '__main__':
    path = [a for a in sys.argv[1:] if not a.startswith('--')][0]
    dry = '--dry' in sys.argv
    kept, removed = run(path, dry)
    print(('DRY RUN - ' if dry else '') + os.path.basename(path))
    print('  keep-with-next set on %d heading(s)' % kept)
    print('  %d surplus blank paragraph(s) removed' % removed)
