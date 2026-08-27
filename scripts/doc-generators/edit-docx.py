"""Surgical .docx paragraph edits. Two hard-won constraints, both from August 24 2026.

⚠ 1. THE INDEX BASIS MUST MATCH THE SCANNER'S. python-docx's `document.paragraphs`
returns only TOP-LEVEL body paragraphs; the scanner walks every <w:p> in document
order, including those inside tables. On one manual that is 358 against 589, so every
index was wrong and edits landed on unrelated paragraphs. Both walk root.iter(w:p).

⚠ 2. SAVE THROUGH python-docx, NEVER A HAND-ROLLED ZIP. Serializing the root with
lxml and rebuilding the package myself DROPPED an unused namespace declaration
(w16cei: 36 -> 35). Nothing referenced it, so it was probably harmless - but "probably"
is what makes this class of fault expensive, and the whole recorded lesson is that a
docx must be judged by what Word requires rather than by what parses. python-docx
writes the package and preserves the namespace map exactly.

So: python-docx owns the file, lxml owns the surgery on the tree it exposes.
"""
import sys, json, copy, os
from docx import Document
from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
XS = '{http://www.w3.org/XML/1998/namespace}space'

def set_text(p, text):
    runs = [r for r in p.findall('.//' + W + 'r') if r.find(W + 't') is not None]
    if runs:
        t = runs[0].find(W + 't')
        t.text = text
        t.set(XS, 'preserve')
        for r in runs[1:]:
            r.getparent().remove(r)
    else:
        r = etree.SubElement(p, W + 'r')
        t = etree.SubElement(r, W + 't')
        t.text = text
        t.set(XS, 'preserve')

def run(path, ops):
    doc = Document(path)
    root = doc.element
    ps = list(root.iter(W + 'p'))
    for op in sorted(ops, key=lambda o: -o['i']):
        p = ps[op['i']]
        kind = op['op']
        if kind == 'set':
            set_text(p, op['text'])
        elif kind == 'delete':
            # ⚠ A <w:tc> MUST CONTAIN AT LEAST ONE <w:p>. Emptying one produces invalid
            # OOXML that Word refuses while python-docx and LibreOffice both accept it -
            # which is how both manuals were broken. A settings entry in them is a table
            # cell, so what the caller means is to delete the ROW.
            cell = p.getparent()
            if cell is None:
                continue                       # already removed with its row
            if cell.tag == W + 'tc' and len(cell.findall(W + 'p')) == 1:
                row = cell.getparent()
                table = row.getparent() if row is not None else None
                if table is None:
                    continue                   # a label and its description share a row
                if len(table.findall(W + 'tr')) <= 1:
                    raise SystemExit('refusing to empty a table at paragraph %d' % op['i'])
                table.remove(row)
            else:
                cell.remove(p)
        elif kind == 'after':
            new = copy.deepcopy(p)
            p.addnext(new)
            set_text(new, op['text'])
        elif kind == 'row-after':
            # Add a TABLE ROW after the row that paragraph i sits in, copying that row
            # so the new one inherits its widths, shading and cell formatting. op['cells']
            # supplies the text for each cell in order.
            #
            # ⚠ 'after' CANNOT DO THIS. It clones the PARAGRAPH, which inside a table
            # means a second paragraph in the same cell - a taller cell, not a new row.
            # The settings tables in the manuals are one row per setting, so adding a
            # setting means adding a row.
            row = p.getparent()
            while row is not None and row.tag != W + 'tr':
                row = row.getparent()
            if row is None:
                raise SystemExit('paragraph %d is not in a table row' % op['i'])
            new = copy.deepcopy(row)
            row.addnext(new)
            cells = new.findall(W + 'tc')
            for cell, text in zip(cells, op['cells']):
                paras = cell.findall(W + 'p')
                for extra in paras[1:]:
                    cell.remove(extra)
                set_text(paras[0], text)
        elif kind == 'before':
            # Insert BEFORE paragraph i, taking formatting from op['from'] (or from the
            # anchor itself when 'from' is absent). Needed whenever the new material
            # belongs at the START of something - a new section ahead of an existing
            # heading, where anchoring on the paragraph before would land inside the
            # preceding table.
            src = ps[op['from']] if 'from' in op else p
            new = copy.deepcopy(src)
            p.addprevious(new)
            set_text(new, op['text'])
        elif kind == 'clone':
            # Insert after paragraph i, but take the FORMATTING from paragraph
            # op['from']. 'after' can only copy its anchor, which is no use for adding a
            # heading in the middle of prose or a numbered step beside a plain one -
            # both of which this manual pass needs constantly. Borrowing a real
            # paragraph of the right kind is safer than building style properties by
            # hand: it inherits the style, the numbering and the spacing that the rest
            # of the document already agrees on.
            src = ps[op['from']]
            new = copy.deepcopy(src)
            p.addnext(new)
            set_text(new, op['text'])
    doc.save(path)
    return len(ops)

if __name__ == '__main__':
    ops = json.load(open(sys.argv[2], encoding='utf8'))
    print(f'{run(sys.argv[1], ops)} edits -> {os.path.basename(sys.argv[1])}')
