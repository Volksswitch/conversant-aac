# -*- coding: utf-8 -*-
"""Find CANDIDATES for the searchable writing bugs. Run during a "sync docs" pass.

  python scripts/doc-tests/check-writing-bugs.py ["name fragment"]

The bugs are WRITING-BUGS.md; the rule they come from is CLAUDE.md -> PLAIN STYLE.

(1) IT REPORTS CANDIDATES, NEVER ERRORS, AND ALWAYS EXITS 0. Every pattern here has an
    innocent use - "at all" in "how often anyone used review at all", a sentence-initial
    "So" now and then, "worth" in "worth knowing". A check that fires on correct writing
    is one people learn to scroll past, which is the same reasoning that keeps the
    `essayisms` list honest. A person decides every line this prints.

(2) IT ONLY COVERS 12-21, AND NOT ALL OF THOSE. Bugs 1-11 are about what a sentence is
    trying to do, and no pattern finds those. A clean run here means nothing about
    whether a document reads well.

(3) THE CADENCE BUGS REPORT A COUNT, NOT A LINE EACH. "X, not Y" is fine one at a time
    and a tic at eleven, so a finding per instance would bury every other bug - the same
    shape as the passive-voice rule reporting a rate.

(4) IT READS WITH docx_model, WHICH SEES INSIDE TABLES. doc.paragraphs does not, and
    disagreeing with it by hundreds of paragraphs is how a stale table survived a sync.
"""
import os
import re
import sys

# The documents carry typographic punctuation and the odd warning glyph; a Windows
# console is cp1252 and raises on them, which crashed a full-folder run.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DOCS = os.path.join(ROOT, 'Documents')
sys.path.insert(0, HERE)

import glob                                       # noqa: E402
from docx_model import Doc                        # noqa: E402


def find_documents(frag):
    paths = sorted(glob.glob(os.path.join(DOCS, '*.docx')))
    paths = [p for p in paths if not os.path.basename(p).startswith('~$')]
    if frag:
        paths = [p for p in paths if frag.lower() in os.path.basename(p).lower()]
    return paths

# name -> (bug number, regex, how many to print)
PATTERNS = [
    ('rating its own material', 11,
     r'\b(the main thing|deserves to be|is worth building|matters and should|only worth the)\b', 8),
    ('sentence-initial connective', 12,
     r'(?:^|(?<=[.?!]) )(So|Therefore|Otherwise|And yet)\b[^.?!]{0,60}', 8),
    ('defensive tag', 13,
     r'\b(anyway|at all|of course|after all)\b', 8),
    ('uncontracted negation', 15,
     r'\b(do not|does not|did not|is not|are not|was not|were not|cannot|will not'
     r'|would not|could not|should not|has not|have not|had not)\b', 12),
    ("straight apostrophe", 15, r"\w'\w", 6),
    ('need/want + gerund', 16, r'\b(needs?|wants?|bears?|merits?) \w+ing\b', 8),
    ('do the + gerund', 16, r'\bdoes? the \w+ing\b', 6),
    ('neither + gerund as subject', 16, r'\bNeither \w+ing\b', 4),
    ('formal verb for a common one', 16,
     r'\b(conveys?|comprises?|constitutes?|entails?|obviates?|utiliz\w+|commences?|ascertains?)\b', 6),
    ('abstract stand-in', 16, r'\b(anything|something|nothing) of (that|this) \w+\b', 4),
    ('colon before a clause', 17,
     r'[a-z”]:\s+(?:the|it|they|a|an|you|we|this|that)\b[^,;:]{0,60}'
     r'\b(is|are|was|were|means|can|will|would|does|do|has|have|puts|asks|carries|gives)\b', 8),
    ('pseudo-cleft', 19, r'\bWhat [a-z][^.?!]{3,40}\b(is|are|does|means|comes)\b', 6),
]

# Reported as a rate: fine once, a tic in bulk.
CADENCE = [
    ('corrective "X, not Y"', 21, r',\s*(not|never|rather than)\s+[a-z“]'),
    ('trailing ", which ..." clause', 20, r', which \w+'),
]


def scan(path):
    paras = Doc(path).paras
    text = ' '.join(p.text for p in paras)
    words = max(1, len(text.split()))
    found = []

    for name, bug, pat, cap in PATTERNS:
        hits = []
        for p in paras:
            for m in re.finditer(pat, p.text):
                a = max(0, m.start() - 42)
                hits.append('...' + p.text[a:m.end() + 30].replace('\n', ' ') + '...')
        if hits:
            found.append((f'bug {bug}  {name}', len(hits), hits[:cap]))

    for name, bug, pat in CADENCE:
        n = len(re.findall(pat, text))
        # Roughly one per 250 words is where it starts reading as a habit.
        if n and n / words * 1000 > 4:
            found.append((f'bug {bug}  {name}',
                          n, [f'{n} in {words} words - count them before defending one']))
    return found, words


def main(argv):
    frag = argv[0] if argv else None
    docs = find_documents(frag)
    if not docs:
        print('no documents matched' + (f' {frag!r}' if frag else ''))
        return 0

    total = 0
    for path in docs:
        found, words = scan(path)
        n = sum(c for _, c, _ in found)
        total += n
        print(f'\n{os.path.basename(path)}   ({words} words)')
        if not found:
            print('  no candidates')
            continue
        for title, count, lines in found:
            print(f'  {title}  -- {count}')
            for line in lines:
                print(f'      {line}')
            if count > len(lines):
                print(f'      ... and {count - len(lines)} more')

    print(f'\n{"-" * 70}')
    print(f'{total} candidate(s). These are NOT errors - a person decides each one.')
    print('Bugs 1-11 need a person reading the sentence; nothing here looks for them.')
    print('See WRITING-BUGS.md.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
