"""Give a footer the house "Page m of n" (the June 15 2026 convention).

  python fix-footer-page-numbers.py "<file.docx>" [--dry]

Both of the documents this was written for already had a PAGE field and no NUMPAGES,
so the footer read "Page 1" and the reader could not tell a three-page document from a
thirty-page one. This appends "of <NUMPAGES>" after the existing PAGE field, matching
the formatting of the run the PAGE field already uses rather than inventing any.

⚠ A FIELD IS THREE RUNS, NOT A STRING: begin, instrText, end. Writing the literal text
"of 12" would be wrong the moment a page is added, which is exactly the failure the
convention exists to prevent.
"""
import sys, os, copy
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
XS = '{http://www.w3.org/XML/1998/namespace}space'


def field_runs(template_rpr, instr):
    """begin / instrText / end, styled like the run the PAGE field already uses."""
    out = []
    for kind in ('begin', 'text', 'end'):
        r = etree.SubElement(etree.Element(W + 'tmp'), W + 'r')
        if template_rpr is not None:
            r.append(copy.deepcopy(template_rpr))
        if kind == 'text':
            t = etree.SubElement(r, W + 'instrText')
            t.text = instr
            t.set(XS, 'preserve')
        else:
            etree.SubElement(r, W + 'fldChar').set(W + 'fldCharType', kind)
        out.append(r)
    return out


def _add_line(section):
    """Append a centered "Page m of n" paragraph, styled like the footer's own text.

    python-docx owns the package, so asking for section.footer creates the footer part
    and its relationship where there is none - which two of these documents needed.
    """
    footer = section.footer
    footer.is_linked_to_previous = False
    # Copy the look of whatever the footer already says, so a new line does not arrive
    # in a different size or color from the byline above it.
    model = None
    for r in footer._element.iter(W + 'r'):
        if any((t.text or '').strip() for t in r.iter(W + 't')):
            model = r.find(W + 'rPr')
            break
    para = footer.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    body = para._p

    def word(text):
        r = etree.SubElement(etree.Element(W + 'tmp'), W + 'r')
        if model is not None:
            r.append(copy.deepcopy(model))
        t = etree.SubElement(r, W + 't')
        t.text = text
        t.set(XS, 'preserve')
        return r

    for node in ([word('Page ')] + field_runs(model, 'PAGE')
                 + [word(' of ')] + field_runs(model, 'NUMPAGES')):
        body.append(node)


def fix(path, dry=False):
    doc = Document(path)
    touched = 0
    for section in doc.sections:
        el = section.footer._element
        if any((t.text or '').strip().upper().startswith('NUMPAGES') for t in el.iter(W + 'instrText')):
            continue
        page = next((t for t in el.iter(W + 'instrText')
                     if (t.text or '').strip().upper().startswith('PAGE')), None)
        if page is None:
            # No page number at all - three documents had none, and two had no footer
            # whatsoever. Build the whole line rather than reporting a fault no tool
            # here can fix: a checker that reports something nothing will repair is the
            # cry-wolf failure the documentation rules exist to avoid.
            if not dry:
                _add_line(section)
            print('  no PAGE field - added the whole "Page m of n" line')
            touched += 1
            continue
        run = page.getparent()
        para = run.getparent()
        # The field ENDS a couple of runs later; append after that, not after instrText.
        kids = list(para)
        end = next((k for i, k in enumerate(kids) if i > kids.index(run)
                    and k.find(W + 'fldChar') is not None
                    and k.find(W + 'fldChar').get(W + 'fldCharType') == 'end'), run)
        rpr = run.find(W + 'rPr')
        of = etree.SubElement(etree.Element(W + 'tmp'), W + 'r')
        if rpr is not None:
            of.append(copy.deepcopy(rpr))
        t = etree.SubElement(of, W + 't')
        t.text = ' of '
        t.set(XS, 'preserve')
        nodes = [of] + field_runs(rpr, 'NUMPAGES')
        for n in reversed(nodes):
            end.addnext(n)
        touched += 1
    print('%s%s: %d footer(s) given "of n"' % ('DRY RUN - ' if dry else '', os.path.basename(path), touched))
    if touched and not dry:
        doc.save(path)


fix(sys.argv[1], '--dry' in sys.argv)
