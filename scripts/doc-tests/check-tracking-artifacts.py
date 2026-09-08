#!/usr/bin/env python3
"""A document carrying tracked changes or comments is NOT a candidate for syncing.

THE RULE (Ken, September 8 2026): *"There also shouldn't be any MS Word tracking
records in any docs when doc-sync is run. No 'added/deleted text' and no comments. If
you encounter those artifacts it means that that document is not a candidate for
synching."*

WHY IT IS A HARD STOP RATHER THAN A WARNING. Tracked changes and comments mean the
document is IN REVIEW - Ken's edits are decisions not yet accepted, and his comments are
instructions not yet acted on. Editing underneath that does three bad things at once:
new prose arrives as ordinary text among revisions nobody has accepted, so it is
impossible to tell afterwards which words were reviewed; accepting or rejecting the
pending changes can move or reflow text an automated edit anchored to; and a comment is
a question about a passage that is being rewritten while the question is still open.

⚠ AND IT IS EXACTLY HOW THE SEPTEMBER 8 CORRUPTION HAPPENED. The Architecture Overview
carried 27 revisions and 14 comments. A helper appended a sentence by copying the last
run of a paragraph, that paragraph ended in a COMMENT ANCHOR, and the copy duplicated
it - which Word refuses outright while every other check passes. Had this rule been in
force, that document would never have been touched. The corruption was a symptom; the
cause was syncing a document that was still under review.

  python scripts/doc-tests/check-tracking-artifacts.py                 # all documents
  python scripts/doc-tests/check-tracking-artifacts.py <file> [...]    # named ones
  python scripts/doc-tests/check-tracking-artifacts.py --quiet         # exit code only

Exit 1 if any document carries an artifact. Clear them in Word (Review > Accept All,
and resolve or delete the comments), or with accept-revisions.py, before syncing.
"""
import glob
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Every distinct kind of revision markup Word writes. Formatting revisions
# (*PrChange) matter as much as inserted text: they are equally unaccepted decisions,
# and they are the ones a reader skims past.
REVISION_TAGS = (
    'ins', 'del', 'moveFrom', 'moveTo',
    'rPrChange', 'pPrChange', 'tblPrChange', 'tcPrChange', 'trPrChange',
    'sectPrChange', 'numberingChange', 'cellIns', 'cellDel', 'cellMerge',
)


def artifacts(path):
    """What is in this document: (revisions, comments, anchors, tracking_on).

    `tracking_on` is reported separately because it is a different problem: no change
    has been made yet, but the NEXT edit becomes a tracked one, so an automated pass
    would quietly fill the document with revisions.
    """
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        doc = (z.read('word/document.xml').decode('utf8', 'replace')
               if 'word/document.xml' in names else '')
        revisions = {}
        for tag in REVISION_TAGS:
            n = len(re.findall(r'<w:%s[ />]' % tag, doc))
            if n:
                revisions[tag] = n
        comments = 0
        if 'word/comments.xml' in names:
            body = z.read('word/comments.xml').decode('utf8', 'replace')
            comments = len(re.findall(r'<w:comment[ >]', body))
        anchors = len(re.findall(r'<w:commentReference[ />]', doc))
        tracking_on = False
        if 'word/settings.xml' in names:
            settings = z.read('word/settings.xml').decode('utf8', 'replace')
            tracking_on = '<w:trackChanges' in settings
    return revisions, comments, anchors, tracking_on


def blocked(path):
    """True if this document must not be synced."""
    revisions, comments, anchors, tracking_on = artifacts(path)
    return bool(revisions or comments or anchors or tracking_on)


def describe(path):
    revisions, comments, anchors, tracking_on = artifacts(path)
    parts = []
    if revisions:
        parts.append('%d tracked change(s) [%s]'
                     % (sum(revisions.values()),
                        ', '.join('%s x%d' % (k, v) for k, v in sorted(revisions.items()))))
    if comments:
        parts.append('%d comment(s)' % comments)
    if anchors and not comments:
        parts.append('%d orphaned comment anchor(s)' % anchors)
    if tracking_on:
        parts.append('track-changes is switched ON, so the next edit becomes a revision')
    return '; '.join(parts)


def main(argv):
    quiet = '--quiet' in argv
    files = [a for a in argv if not a.startswith('--')]
    if not files:
        files = sorted(glob.glob(os.path.join(ROOT, 'Documents', '*.docx')))
    bad = []
    for f in files:
        try:
            if blocked(f):
                bad.append((os.path.basename(f), describe(f)))
        except Exception as e:                                      # noqa: BLE001
            bad.append((os.path.basename(f), 'could not be read: %s' % e))
    if not quiet:
        if bad:
            print('%d document(s) are NOT candidates for syncing - they are still under '
                  'review:' % len(bad))
            for name, why in bad:
                print('    %s' % name)
                print('        %s' % why)
            print('  Resolve in Word (Review > Accept All Changes, then delete the '
                  'comments),')
            print('  or run scripts/doc-generators/accept-revisions.py, before syncing.')
        else:
            print('No document carries tracked changes or comments.')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
