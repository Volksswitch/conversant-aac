"""Whole-document term substitution that preserves formatting - and reports what it
could not safely do rather than guessing.

  python scripts/doc-generators/substitute-terms.py "<file.docx>" terms.json [--dry]

terms.json is a list of [from, to] pairs, applied in the order given (so put the longer
phrase first: "Response Palette" before "Palette").

⚠ WHY THIS IS NOT A WHOLE-PARAGRAPH REWRITE. Word splits a paragraph into runs at every
formatting boundary, and rewriting the paragraph as one run would flatten the bold
lead-ins the manuals use throughout. So the substitution happens INSIDE each run, which
keeps every boundary exactly where it was.

⚠ AND THE CASE THAT CANNOT BE DONE THAT WAY: a phrase whose letters are split across two
runs - which happens whenever part of it is bold, or when Word has left a spell-check
boundary mid-phrase. Those are REPORTED, never silently patched, because joining runs
would decide the formatting of the result on the author's behalf. Fix them by hand.

⚠ CASE IS RESPECTED, NOT NORMALIZED. "the cards" and "The cards" are different edits
with different replacements at the start of a sentence, so each pair is applied
literally and a capitalized variant is a separate pair.
"""
import sys, json, os, re
from docx import Document

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
XS = '{http://www.w3.org/XML/1998/namespace}space'


def para_text(p):
    return ''.join(t.text or '' for t in p.iter(W + 't'))


def apply(path, pairs, dry=False):
    doc = Document(path)
    root = doc.element
    made = {}
    split = []

    for i, p in enumerate(root.iter(W + 'p')):
        for frm, to in pairs:
            # ⚠ RE-READ THE PARAGRAPH FOR EVERY PAIR. Reading it once and reusing that
            # text made the "split across runs" report LIE: after "response cards" had
            # become "response options", the stale text still contained "response card",
            # so the next pair looked for it, failed to find it in any run, and reported
            # a split that did not exist - eight false alarms on a clean document. A
            # report nobody can trust is worse than no report.
            before_all = para_text(p)
            if frm not in before_all:
                continue
            hit = False
            for t in p.iter(W + 't'):
                if t.text and frm in t.text:
                    n = t.text.count(frm)
                    if not dry:
                        t.text = t.text.replace(frm, to)
                        t.set(XS, 'preserve')
                    made[frm] = made.get(frm, 0) + n
                    hit = True
            if not hit:
                # It is in the paragraph but in no single run: the phrase straddles a
                # formatting boundary. Report the paragraph so a person can decide.
                split.append((i, frm, ' '.join(before_all.split())[:100]))

    if not dry:
        doc.save(path)
    return made, split


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv
    pairs = json.load(open(args[1], encoding='utf-8'))
    made, split = apply(args[0], pairs, dry)
    print(('DRY RUN - ' if dry else '') + os.path.basename(args[0]))
    for frm, to in pairs:
        n = made.get(frm, 0)
        print('  %-34s -> %-34s %d' % ('"%s"' % frm, '"%s"' % to, n))
    if split:
        print('\n  SPLIT ACROSS RUNS - not changed, fix by hand:')
        for i, frm, txt in split:
            print('    para %-4d %-24s %s' % (i, '"%s"' % frm, txt))
