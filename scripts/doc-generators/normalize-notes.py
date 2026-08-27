"""One house format for every Note and Tip (Ken, comment 222).

  python scripts/doc-generators/normalize-notes.py "<file.docx>" [--dry]

THE FORMAT, taken from the example Ken picked rather than invented:

    Note:   bold, black
    body    italic, black

The Windows manual had THIRTEEN different shapes across thirty-one notes - blue labels,
green labels, black labels, bodies italic and not, some notes entirely blue. Nothing was
wrong with any one of them; what was wrong was that a reader cannot tell whether a
difference in appearance means a difference in kind. It does not, so they should look
the same.

⚠ THE PARAGRAPH IS REBUILT AS EXACTLY TWO RUNS, which flattens any formatting inside the
body. That is the point rather than a side effect - a bold phrase in the middle of one
note and not another is precisely the inconsistency being removed - but it means this
must not run over a note containing something that is not plain text.

⚠ SO A NOTE CONTAINING A HYPERLINK, A FIELD OR A PICTURE IS SKIPPED AND REPORTED. Those
carry structure that two runs cannot hold, and silently flattening one would destroy a
working link while looking tidy.
"""
import sys, os, copy
from docx import Document

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
XS = '{http://www.w3.org/XML/1998/namespace}space'
LABELS = ('Note:', 'Tip:')
FRAGILE = (W + 'hyperlink', W + 'fldChar', W + 'instrText', W + 'drawing', W + 'pict')


def text_of(p):
    return ''.join(t.text or '' for t in p.iter(W + 't'))


def set_bold_italic(rPr, bold, italic):
    for tag, want in ((W + 'b', bold), (W + 'i', italic)):
        el = rPr.find(tag)
        if want and el is None:
            rPr.insert(0, rPr.makeelement(tag, {}))
        elif not want and el is not None:
            rPr.remove(el)
    # Black. The blue and green labels are the most visible half of the inconsistency.
    col = rPr.find(W + 'color')
    if col is not None:
        rPr.remove(col)


def run(path, dry=False):
    doc = Document(path)
    root = doc.element
    done, skipped = 0, []

    for i, p in enumerate(root.iter(W + 'p')):
        whole = text_of(p)
        s = whole.lstrip()
        label = next((l for l in LABELS if s.startswith(l)), None)
        if not label:
            continue
        if any(p.find('.//' + tag) is not None for tag in FRAGILE):
            skipped.append((i, ' '.join(whole.split())[:70]))
            continue

        runs = [r for r in p.findall(W + 'r') if r.find(W + 't') is not None]
        if not runs:
            continue
        # Keep the first run's font and size by cloning its properties.
        base = runs[0].find(W + 'rPr')
        rest = whole[whole.index(label) + len(label):]

        def build(text, bold, italic):
            r = p.makeelement(W + 'r', {})
            if base is not None:
                r.append(copy.deepcopy(base))
            else:
                r.append(r.makeelement(W + 'rPr', {}))
            set_bold_italic(r.find(W + 'rPr'), bold, italic)
            t = r.makeelement(W + 't', {XS: 'preserve'})
            t.text = text
            r.append(t)
            return r

        if not dry:
            at = list(p).index(runs[0])
            for r in runs:
                p.remove(r)
            p.insert(at, build(rest, False, True))
            p.insert(at, build(label, True, False))
        done += 1

    if not dry:
        doc.save(path)
    return done, skipped


if __name__ == '__main__':
    path = [a for a in sys.argv[1:] if not a.startswith('--')][0]
    dry = '--dry' in sys.argv
    done, skipped = run(path, dry)
    print(('DRY RUN - ' if dry else '') + os.path.basename(path))
    print('  %d Note/Tip paragraph(s) put on the house format' % done)
    if skipped:
        print('  SKIPPED (contain a link, field or picture - format by hand):')
        for i, txt in skipped:
            print('    para %-4d %s' % (i, txt))
