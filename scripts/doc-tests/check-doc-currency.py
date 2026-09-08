#!/usr/bin/env python3
"""Report tracked documents that have not been reviewed since a release shipped.

WHY THIS EXISTS (September 8 2026). Three releases - 0.10.6, 0.10.7 and 0.10.9 -
went out with no document touched, and nothing anywhere said so. The whole of the
0.10.7 work was missing from all three User Manuals: the honesty rule, the deferring
option, Health & Safety, conversation-authored questions, QWERTY by default, the
fourth repair card, the "My best guess" labels. It was found only because somebody
ran a sync by hand and noticed the stamps were old.

DOC-SYNC.md already records what each document was last reviewed against; nothing
read it. This does: for each row it asks git whether any RELEASE commit has landed on
origin/main since that stamp, which is precisely the question "did we ship something
and not tell the documents".

It reports; it does not judge WHICH documents a given release should have touched -
that is a reading job, and CLAUDE.md's planned purification pass is the answer to the
deeper version of it. What this removes is the silent case: shipping and never being
asked the question at all.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROW = re.compile(r'^\|\s*(?P<doc>[^|]+?\.docx)\s*\|\s*(?P<status>[^|]*?)\s*\|'
                 r'\s*(?P<date>[^|]*?)\s*\|\s*`(?P<commit>[0-9a-f]{6,40})`\s*\|', re.M)

# ⚠ SCOPED ON PURPOSE, AND THE SCOPING IS THE DESIGN. A raw "how many releases since
# this stamp" reports two dozen documents forever - most of them design records that a
# release has no reason to touch - and a check that is always red is a check people
# learn to scroll past, which is worse than not having one (the same failure already
# recorded against the flaky live tier). Only these four describe the screen a tester
# is looking at, so only these four are wrong in a way that reaches a person. The rest
# are counted, not listed, and CLAUDE.md's planned purification pass is the answer to
# the deeper question of whether they are still true.
READER_FACING = (
    'Conversant AAC Product Overview.docx',
    'Conversant AAC User Manual (Windows Chromebook Mac).docx',
    'Conversant AAC User Manual (iPad).docx',
    'Conversant AAC User Manual (Android).docx',
)


def git(*args):
    r = subprocess.run(['git'] + list(args), cwd=ROOT, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def releases_since(commit):
    """Release commits on origin/main newer than `commit`, newest first.

    Matched on the message convention this repo has used throughout ("Release 0.10.9
    - ..."), and deliberately against origin/main rather than HEAD: a document may
    honestly be stamped at the last PUBLIC release while local work sits unpushed.
    """
    out = git('log', '--oneline', '--grep', '^Release ', f'{commit}..origin/main')
    if out is None:
        return None
    return [ln for ln in out.splitlines() if ln.strip()]


def version_of(line):
    """'<sha> Release 0.10.9 - ...' -> '0.10.9'."""
    m = re.search(r'\bRelease\s+(\S+)', line)
    return m.group(1) if m else '?'


def main():
    path = os.path.join(ROOT, 'DOC-SYNC.md')
    if not os.path.exists(path):
        print('DOC-SYNC.md not found'); return 0
    with open(path, encoding='utf-8') as f:
        text = f.read()
    behind, unknown = [], []
    for m in ROW.finditer(text):
        doc, commit = m.group('doc').strip(), m.group('commit')
        if git('cat-file', '-e', commit + '^{commit}') is None:
            unknown.append((doc, commit)); continue
        rels = releases_since(commit)
        if rels is None:
            unknown.append((doc, commit))
        elif rels:
            behind.append((doc, commit, rels))
    if unknown:
        print('%d document(s) stamped at a commit git cannot resolve:' % len(unknown))
        for doc, c in unknown:
            print('    %-58s %s' % (doc, c))
    reader = [b for b in behind if b[0] in READER_FACING]
    other = [b for b in behind if b[0] not in READER_FACING]
    rc = 0
    if reader:
        print('%d READER-FACING document(s) not reviewed since a release shipped '
              '- these describe a screen testers do not have:' % len(reader))
        for doc, commit, rels in sorted(reader, key=lambda x: -len(x[2])):
            names = ', '.join(version_of(r) for r in reversed(rels))
            print('    %-58s %s' % (doc, names))
        print('  Run "sync docs".')
        rc = 1
    if other:
        print('%d other tracked document(s) are behind a release. They are design '
              'records, so most releases do not touch them; run with --all to list them.'
              % len(other))
        if '--all' in sys.argv:
            for doc, commit, rels in sorted(other, key=lambda x: -len(x[2])):
                print('    %-58s %d release(s) since %s' % (doc, len(rels), commit))
    if not reader and not unknown:
        print('Every reader-facing document has been reviewed since the last release.')
    return rc


if __name__ == '__main__':
    sys.exit(main())
