"""Read a document's tracked changes and comments, with the text each one is attached to.

  python scripts/doc-generators/review-report.py "<file.docx>" [--comments] [--changes]

This is the READING half of the cooperative review (see CLAUDE.md, "Working through a
document's comments and corrections"). It changes nothing. Its job is to put every
revision and every comment in front of a person with enough surrounding text to judge
it, because a tracked change viewed without its sentence is unreviewable and a comment
detached from the passage it questions is meaningless.

⚠ THE ANCHORED TEXT IS THE POINT, AND IT IS WHY THIS IS NOT A ONE-LINER. A comment
carries no copy of what it is about: the passage lives between <w:commentRangeStart> and
<w:commentRangeEnd> elements elsewhere in the document, matched by id. Reporting the
comment text alone would produce a list of remarks with nothing to apply them to.
"""
import sys
import os

import docx
from docx.oxml.ns import qn

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def _text_of(el):
    """Visible text under an element, including text marked as deleted."""
    out = []
    for node in el.iter():
        if node.tag in (qn('w:t'), qn('w:delText')):
            out.append(node.text or '')
    return ''.join(out)


def _para_of(el):
    for a in el.iterancestors():
        if a.tag == qn('w:p'):
            return a
    return None


def comments(doc):
    """[(id, author, text, anchored_text, paragraph_text)] in document order."""
    part = None
    for rel in doc.part.rels.values():
        if rel.reltype.endswith('/comments'):
            part = rel.target_part
            break
    if part is None:
        return []
    bodies = {}
    for c in part.element.iter(qn('w:comment')):
        bodies[c.get(qn('w:id'))] = (c.get(qn('w:author')) or '?', _text_of(c).strip())

    body = doc.element.body
    # Anchored text: everything between the range start and end carrying the same id.
    spans = {}
    for start in body.iter(qn('w:commentRangeStart')):
        cid = start.get(qn('w:id'))
        collected, node = [], start
        while node is not None:
            node = node.getnext() if node.getnext() is not None else None
            if node is None:
                break
            if node.tag == qn('w:commentRangeEnd') and node.get(qn('w:id')) == cid:
                break
            collected.append(_text_of(node))
        spans[cid] = ''.join(collected).strip()

    out = []
    for ref in body.iter(qn('w:commentReference')):
        cid = ref.get(qn('w:id'))
        author, text = bodies.get(cid, ('?', '(comment body not found)'))
        para = _para_of(ref)
        out.append((cid, author, text, spans.get(cid, ''),
                    _text_of(para).strip() if para is not None else ''))
    return out


def changes(doc):
    """[(kind, author, text, paragraph_text)] for every revision, in document order."""
    out = []
    body = doc.element.body
    for el in body.iter():
        tag = el.tag
        if tag == qn('w:ins'):
            kind = 'INSERTED'
        elif tag == qn('w:del'):
            kind = 'DELETED'
        elif tag.startswith(W) and tag[len(W):].endswith('Change'):
            kind = 'FORMAT (' + tag[len(W):] + ')'
        else:
            continue
        # A w:ins nested inside a w:del is a change to a change; report the outer one.
        if any(a.tag in (qn('w:ins'), qn('w:del')) for a in el.iterancestors()):
            continue
        para = _para_of(el)
        out.append((kind, el.get(qn('w:author')) or '?', _text_of(el).strip(),
                    _text_of(para).strip() if para is not None else ''))
    return out


def main(argv):
    path = next((a for a in argv if not a.startswith('--')), None)
    if not path:
        print(__doc__)
        return 2
    want_c = '--changes' not in argv or '--comments' in argv
    want_r = '--comments' not in argv or '--changes' in argv
    doc = docx.Document(path)
    print('=' * 78)
    print(os.path.basename(path))
    print('=' * 78)

    if want_r:
        rows = changes(doc)
        print('\nTRACKED CHANGES (%d)\n' % len(rows) + '-' * 78)
        for i, (kind, author, text, para) in enumerate(rows, 1):
            print('\n[C%d] %s by %s' % (i, kind, author))
            print('   text : %r' % (text[:300],))
            print('   in   : %s' % (para[:300],))

    if want_c:
        rows = comments(doc)
        print('\n\nCOMMENTS (%d)\n' % len(rows) + '-' * 78)
        for i, (cid, author, text, anchor, para) in enumerate(rows, 1):
            print('\n[K%d] id=%s by %s' % (i, cid, author))
            print('   says   : %s' % text[:500])
            if anchor:
                print('   about  : %r' % (anchor[:200],))
            print('   in     : %s' % (para[:300],))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
