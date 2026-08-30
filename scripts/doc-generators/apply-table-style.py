"""Put every table on the one named house style, and make that style actually govern.

  python scripts/doc-generators/apply-table-style.py "<file.docx>" [--dry]
  python scripts/doc-generators/apply-table-style.py "<file.docx>" --from "<source.docx>"

⚠ THE STYLE LIVES IN ONE DOCUMENT AND HAS TO BE CARRIED TO THE OTHERS. Ken built it in
Word, in the Windows manual, so that is the only file that has ever had the definition -
every generated document has tables carrying their own formatting and no style at all,
which is 29 findings across the set and the single commonest complaint the document
checker makes. --from copies the definition in, after which the rest of this script
works exactly as it does on the manual. The manual is the source of truth for what the
style IS; nothing here invents one.

Ken's comment 4, anchored on the hardware table in section 2.1: "All tables in the
document should share this style including font size bold background color and borders."

⚠ THE STYLE ALREADY EXISTED AND LOOKED LIKE IT DID NOTHING, which is why Ken called it
"my failed attempt". Three separate faults, and the third is the one that made it
invisible:

  1. Its first-column shading was EAF2FA where the section 2.1 table uses F0F4F8.
  2. Its first-column type was 24 half-points (12pt) where that table uses 22 (11pt).
  3. ⚠ EVERY TABLE HAS firstColumn="0" IN ITS tblLook, WHICH SWITCHES THE STYLE'S
     FIRST-COLUMN FORMATTING OFF. A table style's conditional formatting only applies to
     the parts the table opts into. So the style was defined, applied to one table, and
     silently disabled - it rendered as plain bordered cells and looked like nothing had
     happened.

⚠ AND THE DIRECT FORMATTING HAS TO GO, or the style still does not govern. Direct
formatting beats a style, so a table that carries its own borders and its own per-cell
shading will not change when the style changes - which is the entire reason for having a
style. Leaving it in place would produce a document that LOOKS right today and cannot be
restyled tomorrow, which is the failure mode worth avoiding.
"""
import sys, os
from docx import Document

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
STYLE_ID = 'Conversant'

# Taken from the table Ken pointed at (section 2.1), not invented.
FIRST_COL_FILL = 'F0F4F8'
FIRST_COL_SIZE = '22'          # half-points, so 11pt

# THE BODY COLUMN HAD NO RULE AT ALL, which is what Ken saw as "inconsistent point sizes
# in the two columns" (August 29 2026). The style spoke only about the first column, so
# the second took whatever each run happened to carry: 11pt in most tables, 12pt from the
# document default wherever a run carried nothing, and 9pt in two tables somebody had
# shrunk to fit. Often all within one table.
#
# 11pt is not a new decision - it is the size the first column already uses and the
# plurality of the body column (105 runs against 71 at 12pt and 4 at 9pt across the
# Windows manual), and a reference table set one step below the 12pt body prose is the
# ordinary convention. It goes on the STYLE, not on the runs, so the house look has one
# place to change.
TABLE_TEXT_SIZE = '22'         # half-points, so 11pt - both columns


def import_style(doc, source_path):
    """Copy the style definition out of `source_path` into `doc`, if it is not there.

    A deep copy of the whole <w:style> element rather than a rebuild: it carries the
    conditional formatting for the header row and the first column, which is the part
    that actually does the work, and rebuilding it by hand is how a second, subtly
    different house style gets created."""
    import copy
    src = Document(source_path)
    donor = None
    for st in src.styles.element.iter(W + 'style'):
        if st.get(W + 'styleId') == STYLE_ID:
            donor = st
            break
    if donor is None:
        raise SystemExit('the "%s" style is not in %s either' % (STYLE_ID, os.path.basename(source_path)))
    for st in doc.styles.element.iter(W + 'style'):
        if st.get(W + 'styleId') == STYLE_ID:
            return False
    doc.styles.element.append(copy.deepcopy(donor))
    return True


def fix_style(doc):
    """Bring the style's first-column formatting into line with the section 2.1 table."""
    styles = doc.styles.element
    style = None
    for s in styles.iter(W + 'style'):
        if s.get(W + 'styleId') == STYLE_ID:
            style = s
            break
    if style is None:
        raise SystemExit('the "%s" table style is not defined in this document' % STYLE_ID)
    changed = []
    for sp in style.findall(W + 'tblStylePr'):
        if sp.get(W + 'type') != 'firstCol':
            continue
        shd = sp.find(W + 'tcPr/' + W + 'shd') if sp.find(W + 'tcPr') is not None else None
        if shd is not None and shd.get(W + 'fill') != FIRST_COL_FILL:
            changed.append('shading %s -> %s' % (shd.get(W + 'fill'), FIRST_COL_FILL))
            shd.set(W + 'fill', FIRST_COL_FILL)
        sz = sp.find(W + 'rPr/' + W + 'sz') if sp.find(W + 'rPr') is not None else None
        if sz is not None and sz.get(W + 'val') != FIRST_COL_SIZE:
            changed.append('size %s -> %s' % (sz.get(W + 'val'), FIRST_COL_SIZE))
            sz.set(W + 'val', FIRST_COL_SIZE)

    # The base run properties govern every cell, so this is what gives the body column a
    # size of its own instead of leaving it to the document default.
    rpr = style.find(W + 'rPr')
    if rpr is None:
        rpr = style.makeelement(W + 'rPr', {})
        tbl_pr = style.find(W + 'tblPr')
        if tbl_pr is not None:
            tbl_pr.addprevious(rpr)
        else:
            style.append(rpr)
        changed.append('base text size set')
    for tag in ('sz', 'szCs'):
        el = rpr.find(W + tag)
        if el is None:
            el = rpr.makeelement(W + tag, {W + 'val': TABLE_TEXT_SIZE})
            rpr.append(el)
        elif el.get(W + 'val') != TABLE_TEXT_SIZE:
            changed.append('base %s %s -> %s' % (tag, el.get(W + 'val'), TABLE_TEXT_SIZE))
            el.set(W + 'val', TABLE_TEXT_SIZE)
    return changed


def strip_direct_sizes(doc):
    """Take the type size off the runs inside tables, so the style is what decides.

    Direct formatting beats a style, so a size on a run is exactly what stopped the
    style from governing - the same fault the borders and the cell shading had. Nothing
    else about the run is touched: bold in a header row is somebody's decision about
    that table, and only the SIZE was inconsistent.
    """
    n = 0
    for tbl in doc.element.iter(W + 'tbl'):
        for rpr in tbl.iter(W + 'rPr'):
            for tag in ('sz', 'szCs'):
                el = rpr.find(W + tag)
                if el is not None:
                    rpr.remove(el)
                    n += 1
    return n


def fix_tables(doc):
    root = doc.element
    report = []
    for n, tbl in enumerate(root.iter(W + 'tbl'), 1):
        notes = []
        pr = tbl.find(W + 'tblPr')
        if pr is None:
            continue

        st = pr.find(W + 'tblStyle')
        if st is None:
            st = pr.makeelement(W + 'tblStyle', {W + 'val': STYLE_ID})
            pr.insert(0, st)
            notes.append('style applied')
        elif st.get(W + 'val') != STYLE_ID:
            st.set(W + 'val', STYLE_ID)
            notes.append('style changed')

        # Direct borders would override the style's. Every table wants the house
        # borders, whatever its shape.
        b = pr.find(W + 'tblBorders')
        if b is not None:
            pr.remove(b)
            notes.append('direct borders removed')

        # ⚠ THE FIRST-COLUMN FORMATTING IS ONLY RIGHT FOR A TWO-COLUMN TABLE, where
        # column one is the label being defined. The other shapes in this manual would
        # each be damaged by it:
        #   - a ONE-column table is a callout box ("Conversant AAC is free to use..."),
        #     and its shading IS its appearance. Turning on first-column formatting
        #     would bold the whole box, and clearing its direct shading would flatten it
        #     into ordinary prose in a border.
        #   - the persistent-buttons table has THREE columns, and the label is the
        #     second: the first holds the icon. First-column formatting would shade an
        #     empty strip and leave the actual labels plain.
        # Both keep the style for its borders and are otherwise left alone.
        rows = tbl.findall(W + 'tr')
        cols = max((len(r.findall(W + 'tc')) for r in rows), default=0)
        if cols != 2:
            notes.append('%d column(s): borders only, first column left off' % cols)
            if notes:
                report.append((n, notes))
            continue

        look = pr.find(W + 'tblLook')
        if look is not None and look.get(W + 'firstColumn') != '1':
            look.set(W + 'firstColumn', '1')
            look.set(W + 'val', '0080')
            notes.append('first column enabled')

        # Direct shading and bold on the label column would override the style.
        cleared = 0
        for row in rows:
            cells = row.findall(W + 'tc')
            if not cells:
                continue
            tcPr = cells[0].find(W + 'tcPr')
            shd = tcPr.find(W + 'shd') if tcPr is not None else None
            if shd is not None:
                tcPr.remove(shd)
                cleared += 1
            for rPr in cells[0].iter(W + 'rPr'):
                bold = rPr.find(W + 'b')
                if bold is not None:
                    rPr.remove(bold)
        if cleared:
            notes.append('direct shading cleared from %d label cell(s)' % cleared)
        if notes:
            report.append((n, notes))
    return report


if __name__ == '__main__':
    path = [a for a in sys.argv[1:] if not a.startswith('--')][0]
    dry = '--dry' in sys.argv
    doc = Document(path)
    src = None
    if '--from' in sys.argv:
        src = sys.argv[sys.argv.index('--from') + 1]
        if import_style(doc, src):
            print('  imported the "%s" style from %s' % (STYLE_ID, os.path.basename(src)))
    style_changes = fix_style(doc)
    sizes = strip_direct_sizes(doc)
    table_report = fix_tables(doc)
    print(('DRY RUN - ' if dry else '') + os.path.basename(path))
    print('  style "%s": %s' % (STYLE_ID, ', '.join(style_changes) or 'already correct'))
    for n, notes in table_report:
        print('  table %-3d %s' % (n, '; '.join(notes)))
    print('  %d direct type size(s) removed from table runs' % sizes)
    print('  %d table(s) touched' % len(table_report))
    if not dry:
        doc.save(path)
