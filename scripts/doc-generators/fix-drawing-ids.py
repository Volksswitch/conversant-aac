#!/usr/bin/env python3
"""Give every drawing in a .docx its own docPr id.

Usage:  python fix-drawing-ids.py <docx> [<docx> ...]      (in place, reports counts)
        python fix-drawing-ids.py --check <docx> [...]      (report only, exit 1 if any)

WHY THIS EXISTS (September 9 2026). `docx_safe.save()` refused to write the Express
Panel Design document - "duplicated drawing docPr id(s) 1" - while making a one-line
change to its byline. The fault was already in the file and had nothing to do with the
edit: all four of its figures carried `id="1"`.

  * `<wp:docPr id=...>` is a drawing's IDENTITY within the document, and it is supposed
    to be unique. It is the same class of fault as the duplicated `commentReference` and
    the duplicated `w16cid:durableId` already recorded in CLAUDE.md: duplicating an
    identity is exactly what Word refuses while every parser shrugs.

  * ⚠ THE CAUSE IS THE DOCX LIBRARY, NOT OUR GENERATORS. `ImageRun` emits `id="1"` for
    every image it writes, and none of the generators sets it. So ANY document built by
    a generator and carrying more than one figure starts life with this fault.

  * ⚠ WHICH IS WHY ONLY TWO DOCUMENTS HAD IT, AND THE REASON MATTERS MORE THAN THE
    COUNT: WORD SILENTLY RENUMBERS THEM ON SAVE. The Architecture Overview has nine
    figures and is clean, because it has been opened and saved in Word many times. The
    two that were dirty - Express Panel Design and Color Schemes - are the ones nobody
    had ever saved by hand. So a clean survey does NOT mean the generators are fixed; it
    mostly means Word has been tidying up after them. Re-run this after regenerating any
    document that has figures.

  * ⚠ AND WORD OPENING THE FILE IS NOT EVIDENCE IT IS FINE. Both documents opened
    perfectly in the `open-in-word.ps1` check, every documentation rule passed, and the
    zip tested clean. Word tolerates this one and repairs it; it is `docx_safe` that
    declines to write it, deliberately, because the tolerance is not guaranteed and the
    identical fault in a comment reference does make Word refuse the document outright.

THE REPAIR is to number them 1, 2, 3 ... in document order. That is what Word itself
does, the ids are referenced by nothing else in the package, and renumbering changes no
pixel of the rendered document.
"""
import os
import re
import shutil
import sys
import tempfile
import zipfile

# <wp:docPr id="1" name="..."/> - the id attribute of a drawing's non-visual properties.
DOCPR_ID = re.compile(r'(<wp:docPr\b[^>]*?\bid=")(\d+)(")')

# Only the main story is renumbered. A header or footer is its own part with its own id
# space, so a drawing there cannot collide with one in the body.
PART = 'word/document.xml'


def scan(path):
    """(total drawings, list of duplicated ids) for one document."""
    with zipfile.ZipFile(path) as z:
        if PART not in z.namelist():
            return 0, []
        xml = z.read(PART).decode('utf-8')
    ids = [m.group(2) for m in DOCPR_ID.finditer(xml)]
    seen, dup = set(), []
    for i in ids:
        if i in seen and i not in dup:
            dup.append(i)
        seen.add(i)
    return len(ids), dup


def repair(path):
    """Renumber every drawing id in document order. Returns how many were rewritten."""
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        parts = {n: z.read(n) for n in names}

    xml = parts[PART].decode('utf-8')
    counter = [0]

    def renumber(m):
        counter[0] += 1
        return m.group(1) + str(counter[0]) + m.group(3)

    new_xml = DOCPR_ID.sub(renumber, xml)
    if new_xml == xml:
        return 0
    parts[PART] = new_xml.encode('utf-8')

    # [Content_Types].xml must stay the FIRST entry in the archive, so the parts are
    # written back in their original order rather than re-sorted.
    fd, tmp = tempfile.mkstemp(suffix='.docx', dir=os.path.dirname(os.path.abspath(path)))
    os.close(fd)
    try:
        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
            for n in names:
                out.writestr(n, parts[n])
        shutil.move(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    return counter[0]


def main(argv):
    check_only = '--check' in argv
    paths = [a for a in argv if a != '--check']
    if not paths:
        print(__doc__.split('\n\n')[1].strip())
        return 2

    dirty = 0
    for path in paths:
        name = os.path.basename(path)
        try:
            total, dup = scan(path)
        except Exception as exc:
            print('%-52s unreadable: %s' % (name[:52], exc))
            dirty += 1
            continue
        if not dup:
            print('%-52s %d drawing(s), all unique' % (name[:52], total))
            continue
        dirty += 1
        if check_only:
            print('%-52s %d drawing(s), DUPLICATED id(s) %s'
                  % (name[:52], total, ','.join(dup)))
        else:
            n = repair(path)
            print('%-52s %d drawing(s) renumbered 1..%d (was duplicating %s)'
                  % (name[:52], n, n, ','.join(dup)))

    if check_only and dirty:
        print('\nRe-run without --check to renumber them.')
    return 1 if (check_only and dirty) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
