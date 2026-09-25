# -*- coding: utf-8 -*-
"""Bug 15 (WRITING-BUGS.md): contract the negations, and match the apostrophes.

    python scripts/doc-generators/fix-contractions.py                 # show what would change
    python scripts/doc-generators/fix-contractions.py "Product" --apply

⚠ FOUR TRAPS, ALL OF WHICH SHIPPED AS REAL DAMAGE BEFORE THEY WERE GUARDED HERE
(September 25 2026, on the Conversation Review and the Product Overview):

 1. WORD BOUNDARIES. A plain replace("is not", "isn't") turns "there is nothing" into
    "there isn'thing" and "is noticeable" into "isn'ticeable". Three of those shipped.
    Every pattern here is anchored with \\b on both sides.

 2. A COPULA THAT ENDS A CLAUSE CANNOT CONTRACT. "where they are and who they are with"
    became "where they're and", which is not English. So a pronoun pair contracts only
    when something follows it that it can attach to - not a comma, period, dash, "and"
    or "or".

 3. A PRONOUN PAIR CONTRACTS ONLY AT THE START OF A CLAUSE. Otherwise "whatever it is
    asked", "how they are worded" and "a situation that is coming" all match.

 4. "THIS IS" HAS NO CONTRACTION, and "there are" has none in written English
    ("there're"). Both are absent from the table on purpose, as are "must not" and
    "may not" - "mustn't" and "mayn't" are a British register (bug 10).

⚠ EDITS RUN BY RUN, never by replacing a paragraph: these documents have bold lead-in
runs, and docx_safe.set_para_text rightly refuses a paragraph whose runs disagree. A
phrase split across a run boundary is reported rather than guessed at.

⚠ AND IT VERIFIES ITSELF. After applying, every textual difference from the backup is
checked against the replacement table; anything else is reported. That check is what
found all five faults in the Product Overview pass, none of which a read had noticed.
"""
import datetime
import glob
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docx_safe as D

Q = '’'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOCS = os.path.join(ROOT, 'Documents')

NEG = [('cannot', 'can' + Q + 't'), ('do not', 'don' + Q + 't'),
       ('does not', 'doesn' + Q + 't'), ('did not', 'didn' + Q + 't'),
       ('is not', 'isn' + Q + 't'), ('are not', 'aren' + Q + 't'),
       ('was not', 'wasn' + Q + 't'), ('were not', 'weren' + Q + 't'),
       ('will not', 'won' + Q + 't'), ('would not', 'wouldn' + Q + 't'),
       ('could not', 'couldn' + Q + 't'), ('should not', 'shouldn' + Q + 't'),
       ('has not', 'hasn' + Q + 't'), ('have not', 'haven' + Q + 't'),
       ('had not', 'hadn' + Q + 't')]

PRON = [('it is', 'it' + Q + 's'), ('that is', 'that' + Q + 's'),
        ('they are', 'they' + Q + 're'), ('there is', 'there' + Q + 's'),
        ('we are', 'we' + Q + 're'), ('you are', 'you' + Q + 're'),
        ('what is', 'what' + Q + 's'), ('who is', 'who' + Q + 's')]

# Trap 3: the pronoun must open a clause.
OPENER = (r'(?:^|(?<=[.?!:;—–,(])\s|(?<=\s)(?:and|but|so|because|since|when|'
          r'while|if|though|although|where|whereas|then|yet)\s)')
# Trap 2: and something must follow that it can attach to.
NOT_STRANDED = r'(?!\s*(?:[.,;:)—–?!]|and\b|or\b|$))'

# Quoted material is somebody's own words - a goal the user typed, a persona entry, a
# phrase we are showing them. Contracting inside a quotation edits the quotation, which
# is the same principle that forbids Americanizing a cited institution or the deliberately
# Irish test persona. Listed by exact phrase, because "is it inside quotes?" cannot be
# answered from a single run.
QUOTED = [
    '"do not ask me what happened to you"',
    '"Do not ask me about my disability',
    '"do not damage the relationship',
]


ALLOWED = {}
for _a, _b in NEG + PRON:
    ALLOWED[_a] = _b
    ALLOWED[_a.capitalize()] = _b.capitalize()


def wanted(text):
    """Every replacement this text calls for, as (pattern-or-literal, new, regex|None)."""
    out = []
    for a, b in NEG:
        for x, y in ((a, b), (a.capitalize(), b.capitalize())):
            rx = re.compile(r'\b' + re.escape(x) + r'\b')          # trap 1
            out += [(x, y, rx)] * len(rx.findall(text))
    for a, b in PRON:
        for x, y in ((a, b), (a.capitalize(), b.capitalize())):
            rx = re.compile('(' + OPENER + ')' + re.escape(x) + r'\b' + NOT_STRANDED)
            out += [(x, y, rx, True)] * len(rx.findall(text))
    return out


def apply_to(paragraphs, do_it):
    done, split = 0, []
    for i, p in enumerate(paragraphs):
        for item in wanted(p.text):
            x, y, rx = item[0], item[1], item[2]
            keep_opener = len(item) > 3
            if any(q in p.text for q in QUOTED) and any(
                    x in q for q in QUOTED if q in p.text):
                continue
            placed = False
            for r in p.runs:
                if rx.search(r.text):
                    if do_it:
                        r.text = rx.sub((lambda m: m.group(1) + y) if keep_opener else y,
                                        r.text, count=1)
                    placed = True
                    break
            if placed:
                done += 1
            else:
                split.append((i, x))
        for r in p.runs:
            if "'" in r.text:
                done += r.text.count("'")
                if do_it:
                    r.text = r.text.replace("'", Q)
    return done, split


def verify(before, after):
    """Undo every contraction in the new text; it must then equal the old text.

    ⚠ DO NOT go back to matching diff hunks. A contraction merges two words into one, so
    the two sides never have the same word count, and one hunk can hold two adjacent
    replacements - both of which made the hunk version flag correct work and refuse to
    save. Expanding is exact.
    """
    bad = []
    for i, (a, b) in enumerate(zip(before, after)):
        if a == b:
            continue
        # ⚠ EXPAND BOTH SIDES, not just the new one. These documents already contained
        # contractions before this tool ran; expanding only the new text turns those into
        # differences that were never there, which made every document look damaged.
        def norm(t):
            t = t.replace(Q, "'")
            for long, short in sorted(ALLOWED.items(), key=lambda kv: -len(kv[1])):
                t = t.replace(short.replace(Q, "'"), long)
            return ' '.join(t.split())

        if norm(a) != norm(b):
            bad.append((i, a[:90], b[:90]))
    return bad


def main(argv):
    apply = '--apply' in argv
    frag = next((a for a in argv if not a.startswith('--')), None)
    paths = sorted(p for p in glob.glob(os.path.join(DOCS, '*.docx'))
                   if not os.path.basename(p).startswith('~$')
                   and (frag is None or frag.lower() in os.path.basename(p).lower()))
    stamp = datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')
    grand, docs, problems = 0, 0, []

    for path in paths:
        doc = D.open_doc(path)
        paras = D.body_paragraphs(doc)
        before = [p.text for p in paras]
        n, split = apply_to(paras, apply)
        if not n and not split:
            continue
        name = os.path.basename(path)
        note = f'   [{len(split)} span runs]' if split else ''
        print(f'  {n:5}  {name}{note}')
        grand += n
        docs += 1
        if apply:
            bad = verify(before, [p.text for p in paras])
            if bad:
                problems.append((name, bad))
                print(f'         REFUSING TO SAVE - {len(bad)} unexplained change(s)')
                continue
            shutil.copy2(path, os.path.join(DOCS, 'Doc Backups', f'{name[:-5]} {stamp}.docx'))
            D.save(doc, path)

    print(f'\n{grand} change(s) across {docs} document(s)'
          + ('' if apply else ' (dry run - pass --apply)'))
    for name, bad in problems:
        print(f'\n{name}:')
        for i, w, n_ in bad[:10]:
            print(f'   [{i}] {w!r} -> {n_!r}')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
