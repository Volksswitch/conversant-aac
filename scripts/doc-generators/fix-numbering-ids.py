#!/usr/bin/env python3
"""Strip duplicated w16cid:durableId attributes from word/numbering.xml.

WHY THIS EXISTS (September 8 2026). Word refused the Architecture Overview outright -
"the file appears to be corrupted" - while the zip tested clean, every part parsed,
python-docx read the whole document, and all twenty documentation rules passed. The
cause was in numbering.xml: `w16cid:durableId` is meant to identify a numbering
definition uniquely, and `fix-docx-lists.py` creates each new list run by CLONING an
existing <w:num>, which copies that id along with everything else. The file had 145
numbering definitions sharing 5 distinct durableIds.

⚠ IT IS CUMULATIVE, WHICH IS WHY IT SURFACED LONG AFTER THE CAUSE. Every run of
fix-docx-lists adds another generation of clones, so the duplication grows with each
sync pass and the document works until it abruptly does not - 117 definitions opened,
145 did not. So a document that is fine today is not therefore safe.

The attribute is an optional Word 2016 extension, so the honest repair is to remove it
and let Word mint fresh unique ids on its next save. Verified: with it stripped, Word
opens the identical content it had just refused.

Usage:  python fix-numbering-ids.py <docx> [<docx> ...]      (in place, reports counts)
        python fix-numbering-ids.py --check <docx> [...]      (report only, exit 1 if any)
"""
import re
import sys
import zipfile
import shutil
import collections
import tempfile
import os

ATTR = re.compile(r'\s+w16cid:durableId="\d+"')
NUMID = re.compile(r'<w:num\b[^>]*w16cid:durableId="(\d+)"')


def survey(path):
    with zipfile.ZipFile(path) as z:
        if 'word/numbering.xml' not in z.namelist():
            return None
        s = z.read('word/numbering.xml').decode('utf8')
    ids = NUMID.findall(s)
    if not ids:
        return (0, 0, 0)
    c = collections.Counter(ids)
    return (len(ids), len(c), max(c.values()))


def strip(path):
    """Rewrite numbering.xml with the durableIds removed, preserving part order.
    [Content_Types].xml must stay the first entry, so the parts are copied in the
    order the original holds them rather than rebuilt."""
    with zipfile.ZipFile(path) as z:
        if 'word/numbering.xml' not in z.namelist():
            return 0
        items = z.infolist()
        parts = {i.filename: z.read(i.filename) for i in items}
    s = parts['word/numbering.xml'].decode('utf8')
    n = len(ATTR.findall(s))
    if not n:
        return 0
    parts['word/numbering.xml'] = ATTR.sub('', s).encode('utf8')
    fd, tmp = tempfile.mkstemp(suffix='.docx', dir=os.path.dirname(os.path.abspath(path)))
    os.close(fd)
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
        for i in items:
            out.writestr(i, parts[i.filename])
    shutil.move(tmp, path)
    return n


if __name__ == '__main__':
    args = sys.argv[1:]
    check = '--check' in args
    files = [a for a in args if a != '--check']
    dirty = 0
    for f in files:
        info = survey(f)
        name = os.path.basename(f)
        if info is None:
            print(f'  --    {name}  (no numbering)')
            continue
        total, distinct, worst = info
        if worst > 1:
            dirty += 1
            if check:
                print(f'  DUP   {name}  {total} definitions, {distinct} distinct ids, '
                      f'one reused {worst}x')
            else:
                n = strip(f)
                print(f'  FIXED {name}  stripped {n} durableId(s) '
                      f'({total} definitions had only {distinct} distinct ids)')
        else:
            print(f'  ok    {name}  {total} definitions')
    if check and dirty:
        sys.exit(1)
