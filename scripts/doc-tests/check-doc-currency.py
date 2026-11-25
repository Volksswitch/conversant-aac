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
#
# ⚠ BACKUP COMPATIBILITY WAS ADDED ON September 9 2026 (Ken: "reclassify Backup
# Compatibility as reader-facing"), AFTER BEING MISSED TWICE FOR WANT OF IT. It reads
# like a manual - written for a user moving between devices, in the second person, with
# menu paths - and it is the first thing somebody opens before trusting a backup. But it
# was filed as a design record, so this check reported it current while it said "there
# is one backup format" three releases after there were two. Both times it was found by
# a hand sweep instead. **The test for this list is who the document is written FOR, not
# where it happens to sit in the tracker.**
# Beta Tester Responsibilities was added on November 21 2026 (Ken): a one-page handout
# every new tester receives, attached to the welcome emails, so it is wrong in a way
# that reaches a person. While the beta runs, a sync that changes it also rebuilds those
# emails (CLAUDE.md, "sync docs" step 6b). The Beta Test Plan joined the same day: every
# tester is asked to read it, and the handout summarizes it, so a change to the plan
# means checking the handout too.
READER_FACING = (
    'Conversant AAC Beta Test Plan.docx',
    'Conversant AAC Beta Tester Responsibilities.docx',
    'Conversant AAC Product Overview.docx',
    'Conversant AAC User Manual (Windows Chromebook Mac).docx',
    'Conversant AAC User Manual (iPad).docx',
    'Conversant AAC User Manual (Android).docx',
    'Conversant AAC Backup Compatibility.docx',
)

# ⚠ THE ARCHITECTURE AND DESIGN DOCUMENTS ARE IN THE SYNC SET TOO (Ken, November 25
# 2026): "I'd like all architecture and design documents included in the sync docs
# list so they update automatically. When a problem is encountered or new functionality
# is added I want you to be able to refer to these documents as ground truth." This
# reverses the scoping above for these documents only: they were counted and never
# listed, so a plain "sync docs" passed over them, and the Architecture Overview sat
# at 0.14.0 through all of 0.15 (the iPad sound work, switch access, the Chrome folder
# fix). Documents that describe how the app works NOW. Left out on purpose: point-in-
# time reviews and assessments, proposals and drafts for review, plans, test plans, and
# guides written for users (those are reader-facing questions, not design ones).
DESIGN_RECORDS = (
    'Conversant AAC Architecture Overview.docx',
    'Conversant AAC How Conversant Works.docx',
    'Conversant AAC Configuration Model.docx',
    'Conversant AAC UI-Design.docx',
    'Conversant AAC Conversation Engine Design.docx',
    'Conversant AAC Conversation Engine Overview.docx',
    'Conversant AAC Conversation Flow.docx',
    'Conversant AAC Conversation Goals.docx',
    'Conversant AAC Conversation Review.docx',
    'Conversant AAC Continuous Partner Capture.docx',
    'Conversant AAC Express Panel Design.docx',
    'Conversant AAC Keyboard Layout Options.docx',
    'Conversant AAC Layout Suggestions.docx',
    'Conversant AAC Color Schemes.docx',
    'Conversant AAC Switch Access Design.docx',
    'Conversant AAC Switch Access Proposal.docx',
    'Conversant AAC Question Sessions Design.docx',
    'Conversant AAC Language Support Design.docx',
    'Conversant AAC Practice Mode.docx',
    'Conversant AAC The Suggestion Layer.docx',
    'Conversant AAC Response Option Guardrails.docx',
    'Conversant AAC Pragmatics.docx',
    'Conversant AAC Security Review.docx',
    'Conversant AAC Weekly Report Handling.docx',
    'Conversant AAC iPad Platform Measurements.docx',
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
    # Only titles that name a version: "Release notes: ..." is a changelog edit, not a
    # release, and counting it listed "notes:" as a missed version.
    return [ln for ln in out.splitlines() if re.search(r'\bRelease\s+\d', ln)]


def version_of(line):
    """'<sha> Release 0.10.9 - ...' -> '0.10.9' (also '0.14.0: ...' -> '0.14.0')."""
    m = re.search(r'\bRelease\s+(\d[\d.]*\d)', line)
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
    design = [b for b in behind if b[0] in DESIGN_RECORDS]
    other = [b for b in behind if b[0] not in READER_FACING and b[0] not in DESIGN_RECORDS]
    rc = 0
    if reader:
        print('%d READER-FACING document(s) not reviewed since a release shipped '
              '- these describe a screen testers do not have:' % len(reader))
        for doc, commit, rels in sorted(reader, key=lambda x: -len(x[2])):
            names = ', '.join(version_of(r) for r in reversed(rels))
            print('    %-58s %s' % (doc, names))
        print('  Run "sync docs".')
        rc = 1
    if design:
        print('%d ARCHITECTURE/DESIGN document(s) not reviewed since a release shipped '
              '- these are the reference for how the app works:' % len(design))
        for doc, commit, rels in sorted(design, key=lambda x: -len(x[2])):
            # A count and the first release missed: these fall far behind, and a list
            # of every version is unreadable.
            print('    %-58s %d release(s), from %s' % (doc, len(rels), version_of(rels[-1])))
        print('  Run "sync docs".')
        rc = 1
    if other:
        print('%d other tracked document(s) are behind a release (reviews, proposals, '
              'plans and user guides); run with --all to list them.' % len(other))
        if '--all' in sys.argv:
            for doc, commit, rels in sorted(other, key=lambda x: -len(x[2])):
                print('    %-58s %d release(s) since %s' % (doc, len(rels), commit))
    if not reader and not design and not unknown:
        print('Every reader-facing and architecture/design document has been reviewed '
              'since the last release.')
    return rc


if __name__ == '__main__':
    sys.exit(main())
