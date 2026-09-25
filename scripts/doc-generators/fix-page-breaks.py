# -*- coding: utf-8 -*-
"""The three page-break rules check docs enforces, applied across the documents.

    python scripts/doc-generators/fix-page-breaks.py                # show what would change
    python scripts/doc-generators/fix-page-breaks.py "Manual" --apply

  S3   a heading is set to keep with the paragraph under it, so it cannot be stranded
       at the foot of a page
  S13  every table row carries "do not break across pages"
  S14  every paragraph in a table's first row keeps with the next, so a header row is
       never left alone at the foot of a page

All three are layout properties with no effect on a single word of text, which is why
they can be applied in bulk where the wording rules cannot. Run apply-doc-style.py
afterwards for S4 (paragraph spacing).
"""
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docx_safe as D
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOCS = os.path.join(ROOT, 'Documents')


def keep_next(p_el):
    """Set w:keepNext, returning True when it was not already there."""
    pPr = p_el.get_or_add_pPr()
    if pPr.find(qn('w:keepNext')) is not None:
        return False
    pPr.append(OxmlElement('w:keepNext'))
    return True


def main(argv):
    apply = '--apply' in argv
    frag = next((a for a in argv if not a.startswith('--')), None)
    paths = sorted(p for p in glob.glob(os.path.join(DOCS, '*.docx'))
                   if not os.path.basename(p).startswith('~$')
                   and (frag is None or frag.lower() in os.path.basename(p).lower()))
    grand = 0

    for path in paths:
        doc = D.open_doc(path)
        s3 = s13 = s14 = 0

        for p in D.body_paragraphs(doc):
            st = getattr(p, 'style', None)
            if st and st.name and st.name.startswith('Heading') and keep_next(p._p):
                s3 += 1

        for t in doc.tables:
            for n, row in enumerate(t.rows):
                trPr = row._tr.find(qn('w:trPr'))
                if trPr is None:
                    trPr = OxmlElement('w:trPr')
                    row._tr.insert(0, trPr)
                if trPr.find(qn('w:cantSplit')) is None:
                    trPr.append(OxmlElement('w:cantSplit'))
                    s13 += 1
                if n == 0 and trPr.find(qn('w:tblHeader')) is None:
                    trPr.append(OxmlElement('w:tblHeader'))
            for cell in t.rows[0].cells:
                for p in cell.paragraphs:
                    if keep_next(p._p):
                        s14 += 1

        n = s3 + s13 + s14
        if not n:
            continue
        print(f'  {n:5}  {os.path.basename(path)}   (S3 {s3}, S13 {s13}, S14 {s14})')
        grand += n
        if apply:
            D.save(doc, path)

    print(f'\n{grand} property change(s)' + ('' if apply else ' (dry run - pass --apply)'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
