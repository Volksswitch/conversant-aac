"""Accept the revisions and clear the comments that are SETTLED, keeping the rest.

  python resolve-review.py "<file.docx>" --keep-change "<substring>" --keep-comment <id>

This is the writing half of the cooperative review (CLAUDE.md, "Working through a
document's comments and corrections"). It exists because `accept-revisions.py` accepts
everything wholesale, which is precisely the judgment the exercise is there to apply: it
would silently adopt the very items still waiting on Ken.

⚠ A KEPT ITEM IS LEFT EXACTLY AS IT WAS - still a tracked change, still an open comment -
so it is in front of Ken when he opens the document. Resolving a disagreement by deleting
the comment would throw away the question.

⚠ THE COMMENT BODY IS REMOVED FROM comments.xml, NOT JUST ITS ANCHOR. accept-revisions.py
leaves bodies orphaned, which renders nothing and is fine for Word - but the document
still literally contains comments, so a checker that counts them (and ours does) keeps
reporting the document as under review forever. Clearing means clearing.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import docx
from docx.oxml.ns import qn

import docx_safe as D

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def _text(el):
    return ''.join(n.text or '' for n in el.iter()
                   if n.tag in (qn('w:t'), qn('w:delText')))


def _comments_part(doc):
    for rel in doc.part.rels.values():
        if rel.reltype.endswith('/comments'):
            return rel.target_part
    return None


def resolve(path, keep_changes=(), keep_comments=(), dispositions=None,
            require_disposition=True):
    """`dispositions` maps comment id -> what was done with it. Every comment being
    CLEARED must have one.

    ⚠ THIS IS THE ANTI-CRACK (Ken, September 8 2026). A comment was once cleared with
    the report "it's on the list" when there was no list. Forgetting would have been
    better: it leaves the item visible, where a false assurance tells Ken it is held
    somewhere and stops him tracking it himself. A comment may only be cleared by saying
    what happened to it, and "recorded" must name a real place.
    """
    doc = docx.Document(path)
    body = doc.element.body
    keep_comments = {str(c) for c in keep_comments}
    dispositions = {str(k): v for k, v in (dispositions or {}).items()}
    report = {'accepted': 0, 'kept_changes': 0, 'cleared': 0, 'kept_comments': 0}

    # ⚠ CHECKED FIRST, BEFORE ANYTHING IS REMOVED. The first version of this ran after
    # the clearing loop, by which point there were no comment references left to object
    # to, so it passed every time and refused nothing — a gate that looks present and is
    # not. Refuse the whole pass rather than clear some and report the rest: a partial
    # clear is the state nobody notices.
    if require_disposition:
        clearing = [ref.get(qn('w:id')) for ref in body.iter(qn('w:commentReference'))
                    if ref.get(qn('w:id')) not in keep_comments]
        missing = sorted(set(c for c in clearing if not dispositions.get(c)))
        if missing:
            raise SystemExit(
                'refusing to clear comment(s) %s with no stated disposition.\n'
                '  Say what happened to each:\n'
                '    --done <id>:"acted on in this document"\n'
                '    --recorded <id>:"TODO.md - <entry title>"\n'
                '  "Recorded" must name a real place. If it is not written down, it is\n'
                '  not recorded, and saying it is recorded is worse than forgetting.'
                % ', '.join(missing))

    def keep_this(el):
        t = _text(el)
        return any(k in t for k in keep_changes if k)

    # --- revisions -------------------------------------------------------
    # Collected before mutating: unwrapping changes the tree under our feet.
    for el in list(body.iter(qn('w:ins'))) + list(body.iter(qn('w:del'))):
        parent = el.getparent()
        if parent is None:
            continue                      # already removed with an ancestor
        if keep_this(el):
            report['kept_changes'] += 1
            continue
        if el.tag == qn('w:del'):
            parent.remove(el)             # accepting a deletion removes the text
        else:
            at = list(parent).index(el)   # accepting an insertion keeps the text
            for i, child in enumerate(list(el)):
                parent.insert(at + i, child)
            parent.remove(el)
        report['accepted'] += 1

    # Formatting revisions are decisions too; accepting one is dropping the record.
    for tag in ('rPrChange', 'pPrChange', 'sectPrChange', 'tblPrChange',
                'tcPrChange', 'trPrChange', 'tblGridChange'):
        for el in list(body.iter(qn('w:' + tag))):
            if el.getparent() is not None:
                el.getparent().remove(el)
                report['accepted'] += 1

    # --- comments --------------------------------------------------------
    for tag in ('commentRangeStart', 'commentRangeEnd'):
        for el in list(body.iter(qn('w:' + tag))):
            if el.get(qn('w:id')) in keep_comments:
                continue
            if el.getparent() is not None:
                el.getparent().remove(el)

    for ref in list(body.iter(qn('w:commentReference'))):
        cid = ref.get(qn('w:id'))
        if cid in keep_comments:
            report['kept_comments'] += 1
            continue
        run = ref.getparent()
        # The reference sits in a run of its own; drop the run, not just the marker,
        # or an empty run is left behind carrying the comment's styling.
        if run is not None and run.tag == qn('w:r') and run.getparent() is not None:
            run.getparent().remove(run)
        elif run is not None:
            run.remove(ref)

    part = _comments_part(doc)
    if part is not None:
        for c in list(part.element.iter(qn('w:comment'))):
            if c.get(qn('w:id')) in keep_comments:
                continue
            if c.getparent() is not None:
                c.getparent().remove(c)
                report['cleared'] += 1

    D.save(doc, path)                     # validates before writing
    return report


def main(argv):
    path = next((a for a in argv if not a.startswith('--')), None)
    if not path:
        print(__doc__)
        return 2
    keep_changes, keep_comments, dispositions = [], [], {}
    i = 0
    while i < len(argv):
        if argv[i] == '--keep-change':
            keep_changes.append(argv[i + 1]); i += 2
        elif argv[i] == '--keep-comment':
            keep_comments.append(argv[i + 1]); i += 2
        elif argv[i] in ('--done', '--recorded'):
            cid, _, why = argv[i + 1].partition(':')
            dispositions[cid.strip()] = why.strip() or argv[i]
            i += 2
        else:
            i += 1
    r = resolve(path, keep_changes, keep_comments, dispositions)
    print('  accepted %(accepted)d revision(s), kept %(kept_changes)d' % r)
    print('  cleared  %(cleared)d comment(s), kept %(kept_comments)d' % r)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
