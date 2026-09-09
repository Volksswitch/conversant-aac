"""The one place document edits go, with a save that refuses to write a broken file.

⚠ WHY THIS EXISTS (Ken, September 8 2026: "I want to kill these ongoing problems and
never allow them to resurrect!"). Two separate faults in one sync pass each produced a
document Word rejects outright - "the file appears to be corrupted" - while the zip
tested clean, every part parsed, python-docx read the whole document back, and all
twenty documentation rules reported clean. Both were caused by the same thing: DEEP
COPYING AN ELEMENT THAT CARRIES AN IDENTITY WORD EXPECTS TO BE UNIQUE.

  * a <w:num> cloned to make a new list carried its w16cid:durableId along, so 145
    numbering definitions shared 5 ids;
  * a <w:r> cloned to append a sentence carried a commentReference along, duplicating
    a comment anchor.

Neither is detectable by reading the document back. That is the whole problem: every
cheap check passes, and the damage surfaces later, in Word, in front of someone else.

⚠ AND THE DEEPER CAUSE THIS MODULE IS AIMED AT: these helpers kept being rewritten from
scratch in a scratch directory, once per session, so every session re-earned the same
bugs. There were already nineteen committed helpers here and a twentieth got written
anyway. This is the committed one - extend it rather than starting again, and if you
find yourself writing insert_row_after for the fourth time, it is because you are in the
wrong file.

USE IT LIKE THIS:

    import docx_safe as D
    doc = D.open_doc(path)
    D.insert_row_after(doc, 'Subsequent delay', ['Wait longer', 'Adds this much...'])
    D.append_run(doc, 'anchor text', ' extra sentence.')
    D.save(doc, path)          # <- validates first; raises DocxIntegrityError

The guarantee is only as good as save() being the way documents get written. Do not
call doc.save() directly.
"""
import copy
import re
import collections

import docx
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph


class DocxIntegrityError(Exception):
    """Raised INSTEAD of writing a document Word would refuse."""


# Run children that carry an identity Word expects to be unique in the document. A run
# holding one of these must never be deep-copied.
UNIQUE_RUN_CHILDREN = ('commentReference', 'footnoteReference', 'endnoteReference',
                       'drawing', 'object', 'pict')


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------

def open_doc(path):
    return docx.Document(path)


def body_paragraphs(doc):
    """Every paragraph in document order, INCLUDING those inside table cells and
    content controls.

    ⚠ This is deliberately not python-docx's `doc.paragraphs`, which skips table cells:
    the two disagree by hundreds on a manual (595 against 379), and an edit addressed by
    an index from one view applied through the other lands somewhere else entirely.
    """
    out = []

    def walk(node):
        for child in node.iterchildren():
            tag = child.tag.split('}')[1]
            if tag == 'p':
                out.append(Paragraph(child, doc))
            elif tag == 'tbl':
                for row in child.iterchildren(qn('w:tr')):
                    for tc in row.iterchildren(qn('w:tc')):
                        walk(tc)
            elif tag == 'sdt':
                for content in child.iter(qn('w:sdtContent')):
                    walk(content)
                    break

    walk(doc.element.body)
    return out


def _cells(tr):
    return list(tr.iterchildren(qn('w:tc')))


def _cell_text(tc, doc):
    return '\n'.join(Paragraph(p, doc).text for p in tc.iterchildren(qn('w:p')))


def _one(hits, what):
    if len(hits) != 1:
        raise LookupError('%d matches for %r, need exactly 1' % (len(hits), what))
    return hits[0]


# ---------------------------------------------------------------------------
# Editing - paragraphs
# ---------------------------------------------------------------------------

def replace_text(doc, old, new):
    """Replace a whole paragraph's text, keeping its first run's formatting."""
    p = _one([x for x in body_paragraphs(doc) if x.text.strip() == old.strip()], old[:60])
    for extra in p.runs[1:]:
        extra._element.getparent().remove(extra._element)
    if p.runs:
        p.runs[0].text = new
    else:
        p.add_run(new)
    return p


def insert_para_after(doc, anchor_text, new_text):
    """Add a body paragraph after the one matching `anchor_text`, copying its style.

    Refuses inside a table cell or a content control: a paragraph placed in the wrong
    container is valid XML and renders as prose in the middle of the contents listing,
    which has happened and stood for three days.
    """
    p = _one([x for x in body_paragraphs(doc) if x.text.strip() == anchor_text.strip()],
             anchor_text[:60])
    anchor = p._element
    ancestors = {a.tag.split('}')[1] for a in anchor.iterancestors()}
    if ancestors & {'tc', 'sdt'}:
        raise DocxIntegrityError('anchor is inside a table cell or the contents listing')
    new = copy.deepcopy(anchor)
    for r in list(new.iterchildren(qn('w:r')))[1:]:
        new.remove(r)
    runs = list(new.iterchildren(qn('w:r')))
    if runs:
        _set_run_text(runs[0], new_text)
    anchor.addnext(new)
    return new


def _set_run_text(run_el, text):
    for t in list(run_el.iterchildren(qn('w:t'))):
        run_el.remove(t)
    t = run_el.makeelement(qn('w:t'), {})
    t.text = text
    t.set(qn('xml:space'), 'preserve')
    run_el.append(t)


def _is_plain(run_el):
    return not any(c.tag.split('}')[-1] in UNIQUE_RUN_CHILDREN
                   for c in run_el.iterchildren())


def append_run(doc, needle, text):
    """Append text to a paragraph in a NEW run that inherits only the FORMATTING of the
    last plain run - never its content, and never a run carrying a unique child.

    ⚠ The obvious implementation (deep-copy the last run, swap its text) is what put a
    duplicate commentReference into the Architecture Overview and made Word refuse it.
    """
    p = _one([x for x in body_paragraphs(doc) if needle in x.text], needle[:60])
    if not p.runs:
        p.add_run(text)
        return p
    source = next((r._element for r in reversed(p.runs) if _is_plain(r._element)), None)
    anchor = p.runs[-1]._element
    new = anchor.makeelement(qn('w:r'), {})
    if source is not None:
        rPr = source.find(qn('w:rPr'))
        if rPr is not None:
            new.append(copy.deepcopy(rPr))
    _set_run_text(new, text)
    anchor.addnext(new)
    return p


def sub_in_run(doc, old, new):
    """Replace a substring inside the single run holding it.

    Refuses when the text spans runs: rewriting across a run boundary is what silently
    drops inline bold, and being told is better than being flattened.
    """
    for p in body_paragraphs(doc):
        if old not in p.text:
            continue
        for r in p.runs:
            if old in r.text:
                r.text = r.text.replace(old, new)
                return p
        raise DocxIntegrityError('%r spans runs in: %r' % (old, p.text[:80]))
    raise LookupError('%r not found' % (old,))


def set_last_updated(doc, date_text):
    """Rewrite the byline date at run level, so the title page keeps its formatting."""
    for p in body_paragraphs(doc):
        if 'Last updated' in p.text:
            joined = ''.join(r.text for r in p.runs)
            # The day and its comma are OPTIONAL because four older reference
            # documents carry a MONTH-ONLY byline - "Last updated July 2026". They got
            # it from a pass on August 31 2026 that gave every document a byline,
            # taking the creation month from the page footer because it was the only
            # date available. Refusing them would mean the one helper that sets a
            # byline cannot fix the only bylines that are actually wrong.
            new = re.sub(r'Last updated [A-Z][a-z]+ (?:\d{1,2},? )?\d{4}',
                         'Last updated ' + date_text, joined)
            if new == joined:
                # Already carrying this date is a no-op, not a fault: a second pass over
                # the same document in one day is normal and must not blow up.
                if ('Last updated ' + date_text) in joined:
                    return joined
                raise LookupError('unexpected byline form: ' + joined)
            for extra in p.runs[1:]:
                extra._element.getparent().remove(extra._element)
            p.runs[0].text = new
            return new
    raise LookupError('no "Last updated" byline found')


# ---------------------------------------------------------------------------
# Editing - table rows
# ---------------------------------------------------------------------------

def set_cell_text(tc, doc, text):
    """Replace a cell's text, keeping its first paragraph and that paragraph's first
    run. NEVER leaves the cell empty - a <w:tc> with no <w:p> is invalid OOXML and Word
    refuses the document outright.
    """
    paras = list(tc.iterchildren(qn('w:p')))
    for extra in paras[1:]:
        tc.remove(extra)
    p = paras[0]
    runs = list(p.iterchildren(qn('w:r')))
    for extra in runs[1:]:
        p.remove(extra)
    if runs:
        _set_run_text(runs[0], text)
    else:
        Paragraph(p, doc).add_run(text)


def find_row(doc, first_cell_text, second_cell_startswith=None):
    """The table row whose first cell matches exactly.

    `second_cell_startswith` disambiguates where a word appears as the first cell of
    more than one table - "Repair" is both a palette slot and a glossary entry.
    """
    hits = []
    for tbl in doc.element.body.iter(qn('w:tbl')):
        for tr in tbl.iterchildren(qn('w:tr')):
            cs = _cells(tr)
            if not cs or _cell_text(cs[0], doc).strip() != first_cell_text:
                continue
            if (second_cell_startswith is not None and
                    not (len(cs) > 1 and
                         _cell_text(cs[1], doc).startswith(second_cell_startswith))):
                continue
            hits.append((tbl, tr))
    return _one(hits, first_cell_text)


def insert_row_after(doc, after_first_cell_text, values, second_cell_startswith=None):
    """Clone a row and insert it below with `values` as its cell texts.

    A settings entry in the manuals is a ROW, not prose: adding or removing paragraphs
    inside a cell is how an empty <w:tc> gets made, which Word refuses.
    """
    _, tr = find_row(doc, after_first_cell_text, second_cell_startswith)
    new = copy.deepcopy(tr)
    cs = _cells(new)
    if len(cs) != len(values):
        raise ValueError('row has %d cells, given %d values' % (len(cs), len(values)))
    for tc, value in zip(cs, values):
        set_cell_text(tc, doc, value)
    tr.addnext(new)
    return new


# ---------------------------------------------------------------------------
# The gate
# ---------------------------------------------------------------------------

def check_integrity(doc):
    """Everything Word enforces that every parser forgives. Returns a list of problems.

    Each entry here is a fault that has actually shipped, not a hypothetical.
    """
    problems = []
    body = doc.element.body

    for tc in body.iter(qn('w:tc')):
        if not list(tc.iterchildren(qn('w:p'))):
            problems.append('an empty <w:tc>: a table cell must hold at least one '
                            'paragraph (delete the ROW, not the cell\'s only paragraph)')
            break
    for tr in body.iter(qn('w:tr')):
        if not _cells(tr):
            problems.append('an empty <w:tr>')
            break
    # ⚠ THE GRID AND THE ROWS MUST AGREE, and nothing else notices when they do not.
    # A <w:tbl> declares its columns ONCE in <w:tblGrid>; widening a table by adding a
    # <w:tc> to every row without adding a <w:gridCol> leaves the two disagreeing.
    # python-docx goes on reporting the OLD column count, so the table looks untouched
    # from code, and Word lays the surplus column out by guesswork. Hit while adding the
    # control-standards table to the UI Design document, September 8 2026 - every other
    # check in this function passed the malformed table.
    for tbl in body.iter(qn('w:tbl')):
        rows = list(tbl.iterchildren(qn('w:tr')))
        if not rows:
            problems.append('an empty <w:tbl>')
            continue
        grid = tbl.find(qn('w:tblGrid'))
        declared = len(grid.findall(qn('w:gridCol'))) if grid is not None else 0
        # A merged cell legitimately spans several grid columns, so the test is that no
        # row claims MORE cells than the grid declares - not that they are equal.
        widest = max(len(_cells(tr)) for tr in rows)
        if declared and widest > declared:
            problems.append(
                'a table whose rows hold %d cells while its <w:tblGrid> declares %d '
                'columns: add a <w:gridCol> when you add a cell' % (widest, declared))
            break

    # Duplicated identities - the class that caused both September 8 faults.
    for tag in ('commentReference', 'footnoteReference', 'endnoteReference'):
        ids = [e.get(qn('w:id')) for e in body.iter(qn('w:' + tag))]
        dup = [k for k, v in collections.Counter(i for i in ids if i).items() if v > 1]
        if dup:
            problems.append('duplicated %s id(s) %s - a run carrying one was probably '
                            'deep-copied' % (tag, ', '.join(sorted(dup))))

    docpr = [e.get('id') for e in body.iter() if e.tag.endswith('}docPr')]
    dup = [k for k, v in collections.Counter(i for i in docpr if i).items() if v > 1]
    if dup:
        problems.append('duplicated drawing docPr id(s) %s' % ', '.join(sorted(dup)))

    # Field characters must balance, or the document renders as a run-on field.
    begins = sum(1 for e in body.iter(qn('w:fldChar'))
                 if e.get(qn('w:fldCharType')) == 'begin')
    ends = sum(1 for e in body.iter(qn('w:fldChar'))
               if e.get(qn('w:fldCharType')) == 'end')
    if begins != ends:
        problems.append('unbalanced fldChar: %d begin, %d end' % (begins, ends))

    return problems


def save(doc, path):
    """Validate, then write. Raises DocxIntegrityError instead of producing a file
    Word will refuse.

    ⚠ Numbering ids are NOT checked here - they live in a part python-docx does not
    expose on this object. `check docs` reports them and fix-numbering-ids.py repairs
    them; that is the other half of the same guarantee.
    """
    problems = check_integrity(doc)
    if problems:
        raise DocxIntegrityError(
            'refusing to write %s - Word would reject it:\n  - %s'
            % (path, '\n  - '.join(problems)))
    doc.save(path)
    return path
