"""Restart numbered lists at each heading, and even out list spacing.

⚠ WHY THIS IS A POST-PASS AND NOT A GENERATOR CHANGE (Ken, August 24 2026). Ken asked
for the formatting to be fixed "in the document generation so I don't have to worry
about it after a sync". Most of the documents cannot be reached that way: of the
seventeen generated documents only five still match their generator, and the two USER
MANUALS - the ones he reads most - have no generator at all. A post-pass runs over any
.docx, generated or hand-written, drifted or clean, so one fix covers all of them.

WHAT IT FIXES

1. NUMBERED LISTS CONTINUING ACROSS SECTIONS. docx-js gives every paragraph that names
   the same numbering reference ONE concrete numbering, so a list in section 8 carries
   on from section 7's count instead of restarting at 1. The fix is to clone the
   concrete numbering for each run and point the later runs at their own copy; a fresh
   numId restarts at its abstract definition's start value.

   A run ends at a HEADING. That is the boundary Ken described, it is the one a reader
   sees, and it leaves a list that is merely interrupted by a paragraph of prose alone -
   which is usually a deliberate aside inside one list rather than two lists.

2. UNEVEN SPACING WITHIN A LIST. Items in one run are given the same space after, so a
   list does not visibly loosen halfway down. Prose is not touched: guessing at the
   author's intent outside a list is how a formatting pass starts making things worse.

Run:  python fix-docx-lists.py <file.docx> [more.docx ...]
      python fix-docx-lists.py --check <file.docx>     (report, change nothing)
"""
import sys, copy
from docx import Document
from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
LIST_SPACE_AFTER = '100'          # twentieths of a point, matching the generators

def q(tag):
    return W + tag

def num_id_of(p):
    npr = p.find(q('pPr') + '/' + q('numPr'))
    if npr is None:
        return None
    n = npr.find(q('numId'))
    return n.get(W + 'val') if n is not None else None

def is_heading(p):
    st = p.find(q('pPr') + '/' + q('pStyle'))
    return st is not None and str(st.get(W + 'val') or '').lower().startswith('heading')

def clone_num(numbering_root, num_id):
    """A new concrete numbering pointing at the same abstract definition."""
    nums = numbering_root.findall(q('num'))
    src = next((n for n in nums if n.get(W + 'numId') == num_id), None)
    if src is None:
        return None
    new_id = str(max(int(n.get(W + 'numId')) for n in nums) + 1)
    new = copy.deepcopy(src)
    new.set(W + 'numId', new_id)
    src.addnext(new)
    return new_id

def set_space_after(p, twips):
    pPr = p.find(q('pPr'))
    if pPr is None:
        pPr = etree.SubElement(p, q('pPr'))
        p.insert(0, pPr)
    sp = pPr.find(q('spacing'))
    if sp is None:
        sp = etree.SubElement(pPr, q('spacing'))
    before = sp.get(W + 'after')
    sp.set(W + 'after', twips)
    return before != twips

def fix(path, check_only=False):
    doc = Document(path)
    root = doc.element
    try:
        numbering = doc.part.numbering_part.element
    except Exception:
        return 'no numbering in this document'

    body = [p for p in root.iter(q('p'))]
    seen_since_heading = {}          # numId -> the concrete id this run should use
    started = set()                  # numIds whose first run keeps the original id
    restarts = 0
    spacing_fixed = 0

    for p in body:
        if is_heading(p):
            seen_since_heading = {}
            continue
        nid = num_id_of(p)
        if nid is None:
            continue
        if nid not in seen_since_heading:
            if nid in started:
                new_id = clone_num(numbering, nid)
                if new_id:
                    seen_since_heading[nid] = new_id
                    restarts += 1
                else:
                    seen_since_heading[nid] = nid
            else:
                started.add(nid)
                seen_since_heading[nid] = nid
        use = seen_since_heading[nid]
        if use != nid and not check_only:
            p.find(q('pPr') + '/' + q('numPr') + '/' + q('numId')).set(W + 'val', use)
        if not check_only and set_space_after(p, LIST_SPACE_AFTER):
            spacing_fixed += 1

    if not check_only and (restarts or spacing_fixed):
        doc.save(path)
    return f'{restarts} list(s) restarted at their heading, {spacing_fixed} item spacing(s) evened'

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--check']
    check = '--check' in sys.argv
    for path in args:
        print(f'{fix(path, check)}  <- {path.split("/")[-1]}')
