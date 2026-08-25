"""Does Word open this? The checks that actually decide it.

⚠ WHY THIS EXISTS. The August 20 2026 rule said to use lxml, preserve the nsmap and
mc:Ignorable, and assert that every part you did not mean to change is byte-identical.
All of that was followed on August 24 2026 and BOTH USER MANUALS STILL WOULD NOT OPEN.
The rule checks the FILE; Word also enforces the SCHEMA, and the two failures look
identical from outside - everything parses, all the text reads back, nothing is missing.

The actual fault: five settings entries in the manuals are TABLE CELLS, not prose. A
delete that removed the only <w:p> from a <w:tc> left an EMPTY CELL, which is invalid
OOXML. Word rejects it; python-docx opens it; LibreOffice converts it without complaint.
So neither of the two tools on this machine is an oracle - only these invariants are.

Run against the edited file and its pre-edit backup.
"""
import sys, zipfile
from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
MC = '{http://schemas.openxmlformats.org/markup-compatibility/2006}Ignorable'

def check(path, backup, expect_changed=('word/document.xml',)):
    a, b = zipfile.ZipFile(path), zipfile.ZipFile(backup)
    fails = []

    if set(a.namelist()) != set(b.namelist()):
        fails.append('the set of parts changed')
    if a.namelist()[0] != '[Content_Types].xml':
        fails.append('[Content_Types].xml is not the first zip entry')
    # ⚠ COMPARE MEANING, NOT BYTES. python-docx re-serializes every part it models -
    # styles, numbering, settings, comments - so a byte comparison reports parts as
    # "changed" when nothing about them changed. That is a false alarm, and a check that
    # cries wolf is a check that gets ignored, which is how this class of fault survived
    # twice. What must not happen is content being LOST, so untouched parts are compared
    # as canonical XML with whitespace normalized.
    def canon(blob):
        try:
            t = etree.fromstring(blob, etree.XMLParser(remove_blank_text=True))
            return etree.tostring(t, method='c14n')
        except Exception:
            return blob
    def same(name, x, y):
        # [Content_Types].xml is an unordered declaration list; python-docx rewrites it
        # in a different order and Word does not care. What WOULD matter is a
        # declaration going missing, so compare the set rather than the sequence.
        if name == '[Content_Types].xml':
            import re
            f = lambda blob: set(re.findall(rb'(?:PartName|Extension)="([^"]+)"', blob))
            return f(x) == f(y)
        return canon(x) == canon(y)
    changed = [n for n in a.namelist()
               if n in set(b.namelist()) and not same(n, a.read(n), b.read(n))]
    unexpected = [n for n in changed if n not in expect_changed]
    if unexpected:
        fails.append('parts whose CONTENT changed and should not have: %s' % unexpected)

    ra = etree.fromstring(a.read('word/document.xml'))
    rb = etree.fromstring(b.read('word/document.xml'))
    if ra.nsmap != rb.nsmap:
        fails.append('namespace map changed (this is the xml.etree failure)')
    if ra.get(MC) != rb.get(MC):
        fails.append('mc:Ignorable changed')

    # --- the schema invariants Word enforces and every other tool forgives ---
    empty_tc = [tc for tc in ra.iter(W + 'tc') if tc.find(W + 'p') is None]
    if empty_tc:
        fails.append('%d EMPTY TABLE CELL(S) - a <w:tc> must contain at least one <w:p>. '
                     'This is what broke both manuals: a settings entry is a table cell, '
                     'so removing its paragraph emptied the cell. Delete the ROW instead.'
                     % len(empty_tc))
    empty_hl = [h for h in ra.iter(W + 'hyperlink') if h.find(W + 'r') is None]
    if empty_hl:
        fails.append('%d empty <w:hyperlink>' % len(empty_hl))
    empty_tr = [tr for tr in ra.iter(W + 'tr') if tr.find(W + 'tc') is None]
    if empty_tr:
        fails.append('%d empty <w:tr>' % len(empty_tr))
    empty_tbl = [t for t in ra.iter(W + 'tbl') if t.find(W + 'tr') is None]
    if empty_tbl:
        fails.append('%d empty <w:tbl>' % len(empty_tbl))

    for name, tag in (('fldChar', 'fldCharType'),):
        kinds = [e.get(W + tag) for e in ra.iter(W + name)]
        if kinds.count('begin') != kinds.count('end'):
            fails.append('unbalanced %s: %d begin, %d end'
                         % (name, kinds.count('begin'), kinds.count('end')))
    bs = [e.get(W + 'id') for e in ra.iter(W + 'bookmarkStart')]
    be = [e.get(W + 'id') for e in ra.iter(W + 'bookmarkEnd')]
    if sorted(bs) != sorted(be):
        fails.append('unbalanced bookmarks')

    return fails

if __name__ == '__main__':
    # fix-docx-lists.py legitimately rewrites numbering.xml, so allow it on request
    # rather than teaching people to ignore a failure - an ignored check is no check.
    args = [a for a in sys.argv[1:] if a != '--lists']
    expect = ('word/document.xml', 'word/numbering.xml') if '--lists' in sys.argv         else ('word/document.xml',)
    bad = 0
    for path, backup in zip(args[0::2], args[1::2]):
        fails = check(path, backup, expect)
        name = path.split('/')[-1]
        if fails:
            bad += 1
            print('FAIL  ' + name)
            for f in fails:
                print('        - ' + f)
        else:
            print('OK    ' + name)
    sys.exit(1 if bad else 0)
