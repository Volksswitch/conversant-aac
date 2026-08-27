"""Put quotation marks round every name a user reads off the screen.

  python scripts/doc-generators/quote-screen-names.py "<file.docx>" [--dry]

The convention (Ken, August 26 2026): button, setting and section names are contained in
double quotes, whatever the number of words in them. Only the first word of a name is
capitalized, so without quotes there is no telling where the name ends and the sentence
resumes - and a rule the reader can state in one line beats one justified case by case.

It finds the names the same way the checker does (harvested from app/index.html at run
time, never hand-listed) so the two cannot disagree about what a name is.

⚠ FOUR THINGS IT MUST NOT QUOTE, each of which it did before being told not to:

  1. AN OFFICIAL REGION NAME. Those are capitalized instead - "the Express Panel", not
     "the "Express Panel"". Ken's one deliberate exception to the convention.

  2. A NAME THAT IS ALREADY QUOTED, including one whose harvested label carries the
     quote marks itself, as "In my own words" does.

  3. A NAME REACHED THROUGH THE ARROW NOTATION. "Settings > Conversation" already says
     where the name ends; quotes would be clutter on top of a working convention.

  4. ⚠ THE LABEL COLUMN OF A SETTINGS TABLE. That cell IS the setting - it is the entry
     being defined, not a reference to it in a sentence - and quoting it would be like
     quoting the headword in a dictionary. This is the one exclusion that is about
     POSITION rather than about the words, which is why it needs the table structure
     rather than the text.
"""
import sys, os, re
from docx import Document

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
XS = '{http://www.w3.org/XML/1998/namespace}space'
LQ, RQ = '“', '”'

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                '..', 'doc-tests'))
import json
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONV = json.load(open(os.path.join(ROOT, 'writing-conventions.json'), encoding='utf-8'))


def screen_names():
    names = set()
    html = open(os.path.join(ROOT, 'app', 'index.html'), encoding='utf-8').read()
    for m in re.finditer(r'aria-label="([^"]{3,40})"', html):
        names.add(m.group(1).strip())
    for m in re.finditer(r'<label[^>]*>([^<]{3,40})</label>', html):
        names.add(m.group(1).strip())
    for m in re.finditer(r'<button[^>]*>([A-Za-z][^<]{2,30})</button>', html):
        names.add(m.group(1).strip())
    official = set(CONV['officialNames'])
    out = []
    for n in names:
        bare = n.strip(LQ + RQ + '"')
        if not bare or bare in official or bare in AMBIGUOUS:
            continue
        out.append(bare)
    return sorted(set(out), key=len, reverse=True)


# ⚠ NAMES THIS TOOL WILL NOT DECIDE, LEFT FOR A PERSON. Every one is a real button or
# tab name, and by the convention every one should be quoted where it refers to that
# button - so this is NOT an exemption from the rule, it is an admission that the tool
# cannot tell which occurrence is the button.
#
# They fail in two ways. Some are ALSO region names, where the convention says capitalize
# instead: "Settings" is a button and the Settings Panel, "Conversation" is a tab and
# lives inside Conversation Pane, Conversation Log and Conversation Analysis. Others are
# ordinary words the document uses constantly in a plain sense: Start, Listening, Voice,
# Close, Larger, Smaller. Quoting all 43 occurrences of "Settings" would produce
# the "Settings" panel throughout, which is worse than leaving it alone.
#
# The checker still reports them, at REVIEW severity, which is where they belong.
AMBIGUOUS = {
    'Settings', 'Conversation', 'Start', 'Listening', 'Voice', 'Close',
    'Larger', 'Smaller', 'Default', 'Largest', 'Response options', 'Layout',
    'Where it sits', 'Which side',
}


def is_heading(p):
    """⚠ A HEADING IS NOT A REFERENCE TO A CONTROL, it is a title. Quoting inside one
    produced "3.2 Entering Your "API Key"", which reads as a mistake rather than as a
    convention. Word also rebuilds the contents listing from these, so a stray quote
    mark propagates there too."""
    pPr = p.find(W + 'pPr')
    st = pPr.find(W + 'pStyle') if pPr is not None else None
    return st is not None and (st.get(W + 'val') or '').startswith(('Heading', 'TOC', 'Title'))


# ⚠ A ONE-WORD NAME IS ONLY QUOTED WHERE THE SENTENCE IS POINTING AT THE CONTROL.
# Nearly every single-word button name is also an ordinary verb, and the tool cannot
# tell them apart from the word alone: "Copy the key immediately" is an instruction
# about somebody else's website, "tap Copy" is our button. Requiring a cue right before
# it - or the word "button" right after - is what separates them, and it is how these
# names actually appear in instructions anyway. Multi-word names are distinctive enough
# to quote wherever they appear.
CUES = r'(?:tap|taps|tapping|press|presses|pressing|click|clicks|clicking|choose|'        r'chooses|choosing|select|selects|selecting|use|uses|using|the)\s+$'


def wants_quotes(name, src, start, end):
    if len(name.split()) > 1:
        return True
    before = src[:start]
    after = src[end:]
    return bool(re.search(CUES, before, re.I)) or re.match(r'\s*button', after, re.I)


def is_label_cell(p):
    """True when this paragraph is the FIRST cell of a table row - the entry itself."""
    cell = p.getparent()
    if cell is None or cell.tag != W + 'tc':
        return False
    row = cell.getparent()
    if row is None or row.tag != W + 'tr':
        return False
    cells = row.findall(W + 'tc')
    return bool(cells) and cells[0] is cell


def run(path, dry=False):
    doc = Document(path)
    root = doc.element
    names = screen_names()
    made, split = {}, []

    for i, p in enumerate(root.iter(W + 'p')):
        if is_label_cell(p) or is_heading(p):
            continue
        whole = ''.join(t.text or '' for t in p.iter(W + 't'))
        if not whole.strip():
            continue
        for name in names:
            if name not in whole:
                continue
            pat = re.compile(r'(?<![%s"\w])%s(?![%s"\w])' % (LQ, re.escape(name), RQ))
            # ⚠ FOUND is not the same as QUOTED. Declining to quote (an ordinary-word
            # use of a one-word name) must not be reported as "split across runs" - that
            # made the report cry wolf on every correct decision it took.
            found = False
            for t in p.iter(W + 't'):
                if not t.text or name not in t.text:
                    continue
                found = True

                def wrap(m, txt=None):
                    s, e = m.start(), m.end()
                    src = m.string
                    if src[max(0, s - 1):s] in (LQ, '"') or src[e:e + 1] in (RQ, '"'):
                        return m.group(0)
                    if re.search(r'(?:→|->)\s*$', src[:s]):
                        return m.group(0)
                    if not wants_quotes(name, src, s, e):
                        return m.group(0)
                    return LQ + m.group(0) + RQ

                new = pat.sub(wrap, t.text)
                if new != t.text:
                    made[name] = made.get(name, 0) + new.count(LQ + name + RQ) - t.text.count(LQ + name + RQ)
                    if not dry:
                        t.text = new
                        t.set(XS, 'preserve')
            whole = ''.join(t.text or '' for t in p.iter(W + 't'))
            if not found and pat.search(whole):
                split.append((i, name, ' '.join(whole.split())[:90]))

    if not dry:
        doc.save(path)
    return made, split


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    made, split = run(args[0], '--dry' in sys.argv)
    total = sum(made.values())
    print(('DRY RUN - ' if '--dry' in sys.argv else '') + os.path.basename(args[0]))
    for n in sorted(made, key=lambda k: -made[k]):
        print('  %-38s %d' % ('"%s"' % n, made[n]))
    print('  %d name(s) quoted in total' % total)
    if split:
        print('\n  SPLIT ACROSS RUNS - not changed, fix by hand:')
        for i, n, txt in split:
            print('    para %-4d %-26s %s' % (i, '"%s"' % n, txt))
