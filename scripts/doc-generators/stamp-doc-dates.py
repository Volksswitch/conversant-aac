"""Make a document's file date in Explorer agree with its own "Last updated" line.

    python scripts/doc-generators/stamp-doc-dates.py            # show what is out of step
    python scripts/doc-generators/stamp-doc-dates.py --apply    # set the file dates
    python scripts/doc-generators/stamp-doc-dates.py --apply "Conversation Flow"

WHY THIS EXISTS (Ken, September 9 2026): *"I'd like to be able to tell by looking at the
modification date in Windows Explorer when the document was last updated. Right now I have
to look at the document in Word to see if it is 'new'. The modification date in Explorer
can be more recent than the update date in the document."*

WHAT WAS ACTUALLY WRONG, measured rather than assumed: 11 of the 32 documents carried a
file date newer than their own byline, the worst by 52 days. The cause was not Word and
not OneDrive -- it was OUR OWN BULK PASSES. Ten of the eleven sat in clusters sharing a
timestamp to the second (four files at 2026-08-29 20:34, four at 2026-09-08 09:09, two at
2026-09-05 22:21), which is one style or terminology pass rewriting every file it was
handed. Every rewrite bumps the date whether or not it changed anything a reader would
notice, so Explorer ended up reporting when a tool last ran rather than when the document
last said something new.

  * A READ-ONLY WORD OPEN DOES NOT BUMP THE DATE -- verified, not assumed, because it
    decides whether "check docs" can be run freely. open-in-word.ps1 opens every document
    on every run, and if that touched the file it would undo this tool constantly. It does
    not, so the checks stay safe to re-run.

THE BYLINE IS THE AUTHORITY, AND THAT IS THE WHOLE DESIGN DECISION. It would seem more
natural to trust the file date -- it is the thing the operating system maintains -- but it
answers the wrong question. It records when the BYTES last changed, which a spelling
sweep, a spacing pass or a Word save all do. The byline records when the DOCUMENT was last
brought up to date, which is the only question anyone asks of it. So where the two
disagree, the byline wins and the file date is moved to match.

  * ⚠ THE DATE IS ONLY EVER MOVED BACKWARDS, NEVER FORWARDS. A file date that is newer
    than the byline is the fault this fixes. A file date that is OLDER is a different
    thing entirely -- a byline claiming an update the file has no record of -- and quietly
    stamping it forwards would manufacture evidence for it. Those are reported and left
    alone.

  * ⚠ THE TIME OF DAY IS KEPT. Only the date part moves. A document stamped to a fixed
    hour looks synthetic in Explorer, and the time it already carries is the closest thing
    to a real one available.

  * ⚠ IT WILL ALSO PUSH BACK PAST AN EDIT KEN MADE IN WORD WITHOUT TOUCHING THE BYLINE,
    and that is the one case where its answer is arguably wrong -- the document really did
    change that day. It is run at the END OF A SYNC for exactly that reason: a sync has
    just read the document, so an edit of his has been seen and the byline set. Do not run
    it as a routine sweep over documents nobody has looked at.

NOTHING IN THE TOOLING READS THE FILE DATE, so moving it cannot break a check. DOC-SYNC.md
deliberately anchors on a git commit instead, for the very reason this tool exists -- the
file date was never trustworthy. This does not make it trustworthy for the tooling; it
makes it trustworthy for a person looking at a folder.
"""
import argparse
import datetime
import glob
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'doc-tests'))
from docx_model import Doc  # noqa: E402

MONTHS = {m: i + 1 for i, m in enumerate(
    ['January', 'February', 'March', 'April', 'May', 'June', 'July',
     'August', 'September', 'October', 'November', 'December'])}

# "Last updated September 9, 2026" -- the comma is optional because a few documents
# were written without it before the convention settled.
BYLINE = re.compile(r'Last updated\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})')

# The byline is on the title page. Reading the whole document to find it would mean
# a stray "Last updated" in the body could win.
TITLE_PAGE_CHARS = 3000

DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'Documents')

# The Partner Card is a print-and-cut sheet handed to a communication partner, so it
# carries no byline by design and is not a document anyone checks for freshness.
NO_BYLINE_BY_DESIGN = {'Conversant AAC Partner Card.docx'}


def byline_date(path):
    """The date the document says it was last updated, or None if it does not say."""
    m = BYLINE.search(Doc(path).text[:TITLE_PAGE_CHARS])
    if not m:
        return None
    return datetime.date(int(m.group(3)), MONTHS[m.group(1)], int(m.group(2)))


def survey(patterns):
    """(path, byline date, file datetime, verdict) for every document matched."""
    out = []
    for path in sorted(glob.glob(os.path.join(DOCS_DIR, '*.docx'))):
        name = os.path.basename(path)
        if '.bak' in name or name.startswith('~$'):
            continue
        if patterns and not any(p.lower() in name.lower() for p in patterns):
            continue
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(path))
        try:
            said = byline_date(path)
        except Exception as exc:
            out.append((path, None, mtime, 'unreadable: %s' % exc))
            continue
        if said is None:
            skip = name in NO_BYLINE_BY_DESIGN
            out.append((path, None, mtime,
                        'no byline date' + (' (by design)' if skip else '')))
        elif mtime.date() > said:
            out.append((path, said, mtime, 'file is newer'))
        elif mtime.date() < said:
            out.append((path, said, mtime, 'file is OLDER than the byline'))
        else:
            out.append((path, said, mtime, 'agrees'))
    return out


def restamp(path, said, mtime):
    """Move the file date back to the byline date, keeping the time of day."""
    when = datetime.datetime.combine(said, mtime.time())
    stamp = when.timestamp()
    os.utime(path, (stamp, stamp))
    return when


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('patterns', nargs='*', help='substring(s) of the file name; default all')
    ap.add_argument('--apply', action='store_true', help='actually set the dates')
    args = ap.parse_args()

    rows = survey(args.patterns)
    if not rows:
        print('no documents matched')
        return 1

    fixable = [r for r in rows if r[3] == 'file is newer']
    odd = [r for r in rows if r[3].startswith('file is OLDER') or r[3].startswith('unreadable')]
    nobyline = [r for r in rows if r[3].startswith('no byline')]

    for path, said, mtime, verdict in rows:
        if verdict == 'agrees':
            continue
        name = os.path.basename(path)
        if verdict == 'file is newer':
            new = restamp(path, said, mtime) if args.apply else None
            gap = (mtime.date() - said).days
            print('%-52s %s  file %s (%d day%s newer)%s' % (
                name[:52], said, mtime.strftime('%Y-%m-%d %H:%M'), gap,
                '' if gap == 1 else 's',
                '  -> ' + new.strftime('%Y-%m-%d %H:%M') if new else ''))
        else:
            print('%-52s %s' % (name[:52], verdict))

    agreed = sum(1 for r in rows if r[3] == 'agrees')
    print()
    print('%d agree, %d %s, %d with no byline date, %d odd.' % (
        agreed, len(fixable), 'restamped' if args.apply else 'to restamp',
        len(nobyline), len(odd)))
    if fixable and not args.apply:
        print('Re-run with --apply to set them.')
    if odd:
        print('The odd ones are left alone: a file OLDER than its own byline means the')
        print('byline claims an update the file has no record of, and stamping it')
        print('forwards would manufacture evidence for it. Look at those by hand.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
