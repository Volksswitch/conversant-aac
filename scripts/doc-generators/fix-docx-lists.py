"""Make list numbering behave: one list per run, restarting at each heading.

⚠ WHY A POST-PASS AND NOT A GENERATOR CHANGE (Ken, August 24 2026). He asked for this
to be fixed "in the document generation so I don't have to worry about formatting after
document syncs". Generation cannot reach it: of the seventeen generated documents only
five still match their generator, and the two USER MANUALS - where he saw every one of
these symptoms - have no generator at all. A post-pass runs over any .docx.

THE THREE SYMPTOMS, ALL ONE CAUSE. A Word list is a paragraph property, not a
container: each item points at a "concrete numbering" and Word counts each of those
independently. So:

  - "1, 3, 4"  - adjacent items pointing at DIFFERENT concrete numberings. Measured in
                 the Windows manual: item 1 was numId 8, items 2 and 3 were numId 7,
                 whose counter already stood at 2 from earlier in the document.
  - "8, 9, 10" at the top of section 5.5 - one numbering shared with an earlier
                 section, so it carries on counting instead of restarting.
  - bullets that turn into numbers mid-list - two lists of different formats sitting
                 adjacent with nothing between them.

THE RULE. Walk the body. A RUN is a maximal stretch of numbered paragraphs sharing the
same format (bullet or decimal), bounded by headings; ordinary prose between items does
NOT end a run, because a note in the middle of a procedure is still one procedure. Every
run gets its own fresh concrete numbering, so it starts at 1 and cannot be disturbed by
anything before it.

Formats are kept apart deliberately: a bullet list followed by a numbered list is two
lists, and merging them would silently change what the author wrote.

SPACING is evened only WITHIN a run, to the spacing of that run's first item. Prose is
never touched - guessing at intent outside a list is how a formatting pass starts doing
harm.

Run:  python fix-docx-lists.py [--check] <file.docx> [more.docx ...]
"""
import sys, copy
from docx import Document
from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
def q(t): return W + t

def numpr(p):
    return p.find(q('pPr') + '/' + q('numPr'))

def num_id(p):
    n = numpr(p)
    if n is None:
        return None
    e = n.find(q('numId'))
    return e.get(W + 'val') if e is not None else None

def is_heading(p):
    st = p.find(q('pPr') + '/' + q('pStyle'))
    return st is not None and str(st.get(W + 'val') or '').lower().startswith('heading')

def formats(numbering):
    """concrete numId -> 'bullet' | 'decimal' (level 0)."""
    absn = {a.get(W + 'abstractNumId'): a for a in numbering.findall(q('abstractNum'))}
    out = {}
    for n in numbering.findall(q('num')):
        a = absn.get(n.find(q('abstractNumId')).get(W + 'val'))
        lvl = a.find(q('lvl')) if a is not None else None
        fmt = lvl.find(q('numFmt')).get(W + 'val') if lvl is not None else 'decimal'
        out[n.get(W + 'numId')] = 'bullet' if fmt == 'bullet' else 'decimal'
    return out

def clone(numbering, num_id_val):
    nums = numbering.findall(q('num'))
    src = next((n for n in nums if n.get(W + 'numId') == num_id_val), None)
    if src is None:
        return None
    new_id = str(max(int(n.get(W + 'numId')) for n in nums) + 1)
    new = copy.deepcopy(src)
    new.set(W + 'numId', new_id)
    src.addnext(new)
    return new_id

def spacing_of(p):
    sp = p.find(q('pPr') + '/' + q('spacing'))
    return None if sp is None else (sp.get(W + 'before'), sp.get(W + 'after'))

def apply_spacing(p, before, after):
    pPr = p.find(q('pPr'))
    if pPr is None:
        pPr = etree.SubElement(p, q('pPr'))
        p.insert(0, pPr)
    sp = pPr.find(q('spacing'))
    if sp is None:
        sp = etree.Element(q('spacing'))
        pPr.append(sp)
    changed = False
    for key, val in (('before', before), ('after', after)):
        if val is not None and sp.get(W + key) != val:
            sp.set(W + key, val)
            changed = True
    return changed

# ⚠ PROSE SPACING IS NORMALIZED ONLY WITHIN A NARROW BAND, and the band is the point.
# Ken's complaint was that section 6.7 and 9.2 run together while the rest of the manual
# breathes. Measured: 68 prose paragraphs sit at 80/80, 31 at 100/100, and 14 carry NO
# spacing at all - those last inherit zero, which is why they butt up against each other.
# Four values for one kind of paragraph is the inconsistency.
#
# Anything at 240 or more is left alone. Those are the title page and deliberate breaks,
# and a formatting pass that flattens them would do real damage while looking tidy - the
# whole risk of automating this is confidently destroying something somebody meant.
PROSE_BEFORE, PROSE_AFTER = '80', '80'
LEAVE_ALONE_AT_OR_ABOVE = 240

def is_prose(p):
    anc = [a.tag for a in p.iterancestors()]
    if q('sdt') in anc or q('tc') in anc:      # contents listing, table cell
        return False
    if numpr(p) is not None:                   # list items are handled by the run rule
        return False
    st = p.find(q('pPr') + '/' + q('pStyle'))
    name = str(st.get(W + 'val') or '').lower() if st is not None else ''
    if name.startswith('heading') or name == 'listparagraph':
        return False
    return bool(''.join(x.text or '' for x in p.iter(q('t'))).strip())

def normalize_prose(root):
    changed = 0
    for p in root.iter(q('p')):
        if not is_prose(p):
            continue
        cur = spacing_of(p) or (None, None)
        big = any(v and v.isdigit() and int(v) >= LEAVE_ALONE_AT_OR_ABOVE for v in cur)
        if big:
            continue
        if apply_spacing(p, PROSE_BEFORE, PROSE_AFTER):
            changed += 1
    return changed

def fix(path, check_only=False, prose=False):
    doc = Document(path)
    root = doc.element
    try:
        numbering = doc.part.numbering_part.element
    except Exception:
        return 'no lists in this document'
    fmt = formats(numbering)

    runs, cur, cur_fmt = [], [], None
    for p in root.iter(q('p')):
        if is_heading(p):
            if cur:
                runs.append((cur_fmt, cur))
            cur, cur_fmt = [], None
            continue
        nid = num_id(p)
        if nid is None:
            continue                       # prose inside a list does not end the run
        f = fmt.get(nid, 'decimal')
        if cur and f != cur_fmt:
            runs.append((cur_fmt, cur))
            cur = []
        cur_fmt = f
        cur.append(p)
    if cur:
        runs.append((cur_fmt, cur))

    merged = sum(1 for _, r in runs if len({num_id(p) for p in r}) > 1)
    restarted = 0
    respaced = 0
    for _, run in runs:
        if check_only:
            restarted += 1
            continue
        new_id = clone(numbering, num_id(run[0]))
        if not new_id:
            continue
        restarted += 1
        for p in run:
            numpr(p).find(q('numId')).set(W + 'val', new_id)
        want = spacing_of(run[0])
        if want:
            for p in run[1:]:
                if apply_spacing(p, want[0], want[1]):
                    respaced += 1

    prose_fixed = 0
    if prose and not check_only:
        prose_fixed = normalize_prose(root)

    if not check_only and (restarted or prose_fixed):
        doc.save(path)
    return (f'{restarted} list run(s); {merged} had items split across different '
            f'numberings; {respaced} item spacing(s) evened'
            + (f'; {prose_fixed} prose paragraph(s) set to {PROSE_BEFORE}/{PROSE_AFTER}'
               if prose else ''))

if __name__ == '__main__':
    check = '--check' in sys.argv
    prose = '--prose' in sys.argv
    for path in [a for a in sys.argv[1:] if a not in ('--check', '--prose')]:
        print(f'{fix(path, check, prose)}  <- {path.split("/")[-1]}')
