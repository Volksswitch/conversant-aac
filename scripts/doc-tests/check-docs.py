"""A test suite for the documents, run by the trigger phrase "check docs".

A document is not done until it passes. Same idea as the code tests, and for the same
reason: these conventions were all agreed at some point and then broken again, one
paragraph at a time, because nothing checked them.

  python scripts/doc-tests/check-docs.py                 every document
  python scripts/doc-tests/check-docs.py "User Manual"   the ones whose name matches
  python scripts/doc-tests/check-docs.py --rule L2       one rule, everywhere
  python scripts/doc-tests/check-docs.py --list          what it checks and why
  python scripts/doc-tests/check-docs.py --errors-only   hide the REVIEW findings

⚠ SEVERITY IS HONEST ABOUT WHAT A MACHINE CAN DECIDE.
  ERROR  - unambiguous. The document is wrong.
  REVIEW - the word has innocent uses too, so a person reads the sentence. "Repair" is a
           category name AND an ordinary verb; "group" is a Settings Section AND a group
           of people; "card" is a development word AND a Partner Card. A checker that
           failed on these would be one people learn to bypass, which is worse than not
           having it at all.

⚠ WHEN TO RUN IT (Ken, August 26 2026): the FORMATTING rules must not be enforced until
the WORDING edits are finished. Inserting text is what breaks the formatting, so running
these against a half-edited document produces a wall of failures that all have one cause
and none of which is the point. Use --lang while editing, then the whole suite.

⚠ WHAT IT CANNOT CHECK, and this list matters as much as the rules. Nobody should read a
green run as "the document is good":
  - whether a sentence is TRUE of the app
  - whether the plain-language rule is met (jargon has a word list; clumsiness does not)
  - British vocabulary that is also good American vocabulary - "the surgery", "tablets",
    "a torch". Only a person reading the sentence catches those.
  - whether a figure shows what its caption says
"""
import sys, os, re, json, glob
import subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from docx_model import Doc, W

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONV = json.load(open(os.path.join(ROOT, 'writing-conventions.json'), encoding='utf-8'))
DOCS = os.path.join(ROOT, 'Documents')

RULES = []


def rule(rid, title, why, scope='all', severity='error'):
    """scope: 'all' every document, 'user' only the ones a user reads."""
    def deco(fn):
        fn.rid, fn.title, fn.why = rid, title, why
        fn.scope, fn.severity = scope, severity
        RULES.append(fn)
        return fn
    return deco


class F:
    def __init__(self, msg, para=None, snippet=None, severity=None):
        self.msg, self.para, self.snippet, self.severity = msg, para, snippet, severity


def snip(text, n=90):
    t = ' '.join((text or '').split())
    return t[:n] + ('...' if len(t) > n else '')


# ------------------------------------------------------------------ structure

@rule('S1', 'The file is something Word will open',
      'Word enforces the schema; python-docx and LibreOffice both open files Word '
      'refuses, so neither is an oracle. An empty table cell is the one that bit us: '
      'deleting the only paragraph in a cell leaves invalid markup and the manual will '
      'not open at all, while every other check stays green.')
def s1_valid(doc):
    out = []
    for tag, what in (('tc', 'table cell'), ('tr', 'table row'), ('tbl', 'table')):
        inner = {'tc': 'p', 'tr': 'tc', 'tbl': 'tr'}[tag]
        for el in doc.root.iter(W + tag):
            if el.find(W + inner) is None:
                out.append(F('empty %s - Word will refuse to open this file' % what))
    for el in doc.root.iter(W + 'hyperlink'):
        if el.find(W + 'r') is None:
            out.append(F('empty hyperlink'))
    names = doc.zip.namelist()
    if names and names[0] != '[Content_Types].xml':
        out.append(F('[Content_Types].xml must be the first entry in the file'))
    return out


@rule('S2', 'One blank line between paragraphs, never two',
      'Spacing comes from the paragraph style, so a hand-inserted second blank line is '
      'a gap that matches nothing else in the document.')
def s2_blanks(doc):
    out, run = [], 0
    for p in doc.paras:
        if p.blank and not p.in_table and p.container != 'sdt':
            run += 1
            if run == 2:
                out.append(F('two or more blank paragraphs in a row', p.i))
        else:
            run = 0
    return out


@rule('S3', 'A heading stays with the paragraph under it',
      'Otherwise a heading can be left stranded at the foot of a page (comment 6).')
def s3_keepnext(doc):
    return [F('heading is not set to keep with the next paragraph', p.i, snip(p.text))
            for p in doc.paras if p.is_heading and p.text.strip() and not p.keep_next]


@rule('S4', 'House paragraph spacing',
      'Body prose 0 before / 160 after, list items 0 / 80, table cells 0 / 0. Anything '
      'at 240 or more is a deliberate break and is left alone.')
def s4_spacing(doc):
    st, out = CONV['style'], []
    thr = st['deliberateBreakThreshold']
    for p in doc.paras:
        if p.blank or p.is_heading or p.aligned == 'center' or p.has_drawing:
            continue
        if p.container == 'sdt':
            continue
        want = st['tableCell'] if p.in_table else (st['listItem'] if p.numbered else st['prose'])
        if p.after is not None and p.after >= thr:
            continue
        for key in ('before', 'after'):
            got = getattr(p, key)
            if got is not None and got != want[key]:
                out.append(F('spacing %s is %s, house style is %s'
                             % (key, got, want[key]), p.i, snip(p.text)))
    return out


@rule('S5', 'Nothing strays into the contents listing',
      'A paragraph placed inside the contents block is perfectly valid markup and '
      'renders as prose in the middle of the contents. Two did, in both manuals, and '
      'went unnoticed for three days because every other check was green.')
def s5_toc(doc):
    return [F('prose inside the contents listing (style %r)' % (p.style or ''), p.i, snip(p.text))
            for p in doc.paras
            if p.container == 'sdt' and p.text.strip()
            and not (p.style or '').startswith('TOC') and not p.is_heading]


@rule('S6', 'Numbered lists do not skip, and restart at a new section',
      'Each numbering counts on its own, so two numberings in one visual list reads as '
      '1, 3, 4, and one numbering shared across sections reads as 8, 9, 10.')
def s6_lists(doc):
    out, run = [], []

    def flush(r):
        if len(r) > 1 and len({p.num_id for p in r}) > 1:
            out.append(F('one visual list is built from %d different numberings, so it '
                         'will not count 1, 2, 3' % len({p.num_id for p in r}),
                         r[0].i, snip(r[0].text)))
    for p in doc.paras:
        if p.numbered:
            run.append(p)
        elif p.text.strip() or p.is_heading:
            flush(run)
            run = []
    flush(run)

    where, section = {}, 0
    for p in doc.paras:
        if p.is_heading:
            section += 1
        if p.numbered:
            where.setdefault(p.num_id, set()).add(section)
    for nid, secs in sorted(where.items()):
        if len(secs) > 1:
            out.append(F('numbering %s is shared by %d sections, so the later lists carry '
                         'on counting instead of restarting at 1' % (nid, len(secs))))
    return out


@rule('S7', 'Every table uses the one named house style',
      'All tables share one style - font size, bold, background color and borders '
      '(comment 4). ⚠ "They all agree" is NOT sufficient, and this is the trap: almost '
      'every table in the manuals carries NO style at all, which is unanimous and still '
      'wrong, because a table with no style has nothing to change when the house look '
      'changes. There must be a NAMED style and every table must use it. (The lone '
      '"Conversant" style in the Windows manual is an abandoned attempt at defining one '
      '- Ken - so it is the odd one out to remove, not the target to match.)')
def s7_tables(doc):
    styles = {}
    for n, t in enumerate(doc.tables):
        pr = t.find(W + 'tblPr')
        st = pr.find(W + 'tblStyle') if pr is not None else None
        styles.setdefault(st.get(W + 'val') if st is not None else '(no style)', []).append(n + 1)
    if not styles:
        return []
    out = []
    unstyled = styles.pop('(no style)', None)
    if unstyled:
        out.append(F('%d table(s) carry no style at all, so nothing about them can be '
                     'changed centrally: table %s'
                     % (len(unstyled), ', '.join(map(str, unstyled)))))
    if len(styles) > 1:
        out.append(F('the styled tables do not agree: ' + '; '.join(
            '%s on table %s' % (k, ', '.join(map(str, v))) for k, v in sorted(styles.items()))))
    return out


@rule('S8', 'The footer carries "Page m of n"', 'House convention since June 2026.')
def s8_pages(doc):
    f = doc.footers
    return [] if ('PAGE' in f and 'NUMPAGES' in f) else [F('footer has no "Page m of n"')]


@rule('S9', 'The byline says when it was last updated',
      'The creation date alone tells a reader nothing about whether the material is '
      'current, which is the only question they actually have.')
def s9_updated(doc):
    if 'Partner Card' in os.path.basename(doc.path):
        return []          # a print-and-cut card has no reader for a date
    head = '\n'.join(p.text for p in doc.paras[:15])
    return [] if 'Last updated' in head else [F('no "Last updated" on the byline')]


@rule('S10', 'Notes and Tips share one format',
      'Bold black label, italic black body (comment 222). The Windows manual had '
      'THIRTEEN shapes across thirty-one notes - blue labels, green labels, black '
      'labels, bodies italic and not. Nothing was wrong with any one of them; what was '
      'wrong is that a reader cannot tell whether a difference in appearance means a '
      'difference in kind. It does not, so they should look alike.')
def s10_notes(doc):
    out = []
    for p in doc.paras:
        s = (p.text or '').lstrip()
        label = next((l for l in ('Note:', 'Tip:') if s.startswith(l)), None)
        if not label:
            continue
        runs = []
        for r in p_runs(doc, p):
            rPr = r.find(W + 'rPr')
            bold = rPr is not None and rPr.find(W + 'b') is not None
            ital = rPr is not None and rPr.find(W + 'i') is not None
            col = rPr.find(W + 'color') if rPr is not None else None
            runs.append((bold, ital, col.get(W + 'val') if col is not None else 'auto'))
        want = [(True, False, 'auto'), (False, True, 'auto')]
        if runs != want:
            out.append(F('%s does not use the house format (bold black label, italic '
                         'black body)' % label, p.i, snip(p.text)))
    return out


def p_runs(doc, para):
    """The <w:r> elements of a paragraph, found by its index in the same single walk
    every rule uses - so an index here means what it means everywhere else."""
    for n, el in enumerate(doc.root.iter(W + 'p')):
        if n == para.i:
            return [r for r in el.findall(W + 'r') if r.find(W + 't') is not None]
    return []


# ------------------------------------------------------------------- language

def _hits(doc, pattern, flags=re.I):
    rx = re.compile(pattern, flags)
    for p in doc.paras:
        for m in rx.finditer(p.text or ''):
            yield p, m


@rule('L1', 'American spelling and vocabulary', 'American English only, since June 2026.',
      scope='all')
def l1_spelling(doc):
    exempt = [re.compile(r['source'], re.I if 'i' in r['flags'] else 0)
              for r in CONV['properNounExemptions']]
    pairs = CONV['britishSpellings'] + CONV['britishVocabulary']
    out = []
    for brit, amer in pairs:
        if brit.endswith('e'):
            alts = ['%s(?:s|d)?' % brit, '%s(?:ing|ed|es)' % brit[:-1]]
        else:
            alts = ['%s(?:s|es|d|ed|ing|ful|ly)?' % brit]
        for p, m in _hits(doc, r'\b(?:%s)\b' % '|'.join(alts)):
            if any(x.search(p.text) for x in exempt):
                continue
            out.append(F('"%s" -> "%s"' % (m.group(0), amer), p.i, snip(p.text)))
    return out


@rule('L2', 'No banned terms', 'Words a user would not know, or that name something we '
      'have decided not to expose.', scope='user')
def l2_banned(doc):
    out = []
    for b in CONV['bannedTerms']:
        for p, m in _hits(doc, r'\b%s\b' % re.escape(b['term']) + ('s?' if ' ' not in b['term'] else '')):
            out.append(F('"%s" - use %s (%s)' % (m.group(0), b['use'], b['why']),
                         p.i, snip(p.text), severity=b['severity']))
    return out


@rule('L3', 'No retired names', 'A name we have replaced must not survive anywhere a '
      'user reads, or two documents describe two different products.', scope='user')
def l3_retired(doc):
    out = []
    for old, new in CONV['retiredNames']:
        for p, m in _hits(doc, r'\b%s\b' % re.escape(old)):
            out.append(F('"%s" -> "%s"' % (m.group(0), new), p.i, snip(p.text)))
    return out


@rule('L4', 'No product history', 'A user document describes the product as it is now '
      '(comment 247). How it used to behave makes a working feature read as unreliable, '
      'and belongs in the changelog.', scope='user', severity='review')
def l4_history(doc):
    out = []
    for phrase in CONV['historyPhrases']:
        for p, m in _hits(doc, r'\b%s\b' % re.escape(phrase)):
            out.append(F('"%s" reads as product history' % m.group(0), p.i, snip(p.text)))
    return out


@rule('L5', 'Plain language', 'Ken does not read programmer vocabulary - a paragraph he '
      'skips is a decision made without the information in it.', scope='user',
      severity='review')
def l5_jargon(doc):
    out = []
    for word in CONV['devJargon']:
        for p, m in _hits(doc, r'\b%s\b' % re.escape(word)):
            out.append(F('"%s" is programmer vocabulary' % m.group(0), p.i, snip(p.text)))
    return out


@rule('L6', 'No commas in a document name',
      'Word replaces each comma with the two characters ^J when it saves a PDF to cloud '
      'storage, so a name with commas produces a mangled file every time.')
def l6_commas(doc):
    out = []
    if ',' in os.path.basename(doc.path):
        out.append(F('this document\'s own filename contains a comma'))
    # ⚠ MATCH A DOCUMENT NAME, NOT ANY SENTENCE THAT OPENS WITH THE PRODUCT NAME. The
    # first version flagged "Conversant AAC is a free, open-source web application",
    # which is prose, not a reference. A real reference is one of two shapes: quoted, or
    # containing a word that names a kind of document.
    kinds = r'(?:Manual|Overview|Plan|Design|Card|Assessment|Model|Guide|Scenarios)'
    for p, m in _hits(doc, r'[“"]([^”"]*Conversant AAC[^”"]*)[”"]'):
        if ',' in m.group(1):
            out.append(F('a document name with a comma in it', p.i, snip(m.group(1))))
    for p, m in _hits(doc, r'Conversant AAC [A-Za-z(][^.;:“”"]*?' + kinds + r'[^.;:“”"]*'):
        if ',' in m.group(0):
            out.append(F('a document name with a comma in it', p.i, snip(m.group(0))))
    return out


@rule('L7', 'Anything read off the screen is in quotes',
      'Buttons, tabs, settings and their values. Only the first word is capitalized, so '
      'without quotes there is no telling where the name ends and the sentence resumes '
      '(comment 51).', scope='user', severity='review')
def l7_quotes(doc):
    # ⚠ THREE THINGS THIS RULE MUST NOT FLAG, all of which it did on its first run:
    #   - an OFFICIAL REGION NAME. Those are capitalized, not quoted (Ken, August 26
    #     2026), so "the Express Panel" is correct as it stands. Rule L8 covers them.
    #   - a name that is ALREADY quoted, including one whose own label carries the
    #     quote marks - "In my own words" is stored with them and so never matched.
    #   - a name reached through the arrow notation. "Settings > Conversation" is
    #     already unambiguous about where the name ends; quotes would only add clutter.
    # ⚠ EVERY NAME, WHATEVER ITS LENGTH (Ken, August 26 2026, overruling a narrowing of
    # mine). I had restricted this to multi-word names on the grounds that comment 51
    # describes an ambiguity - not being able to tell where a name ENDS - that a one-word
    # name cannot have. Ken: "this is a convention... Button/setting/section names are
    # contained in double quotes irregardless of the number of words that make up the
    # name." He is right, and the reason is worth keeping: a rule the reader can state
    # in one line beats a rule that is individually justified case by case. A document
    # where "Wind down" is quoted and "Reframe" is not looks like an oversight, and the
    # reader has to reconstruct the reasoning to know it was not.
    #
    # The cost is a long list on a document that has never followed the convention, which
    # is the true state of it and not noise. Region names stay OUT because they are
    # capitalized instead - the one genuine exception, also Ken's.
    official = set(CONV['officialNames'])
    names = [n for n in _screen_names() if n.strip('“”"') not in official]
    out = []
    for p in doc.paras:
        text = p.text or ''
        if not text.strip():
            continue
        for name in names:
            bare = name.strip('“”"')
            if not bare or bare in official:
                continue
            for m in re.finditer(r'(?<![“"\w])%s(?![”"\w])' % re.escape(bare), text):
                before = text[max(0, m.start() - 1):m.start()]
                after = text[m.end():m.end() + 1]
                if before in '“"' or after in '”"':
                    continue
                if re.search(r'(?:→|->)\s*$', text[:m.start()]):
                    continue
                out.append(F('"%s" is a name on screen and is not in quotes' % bare,
                             p.i, snip(text)))
                break
    return out


@rule('L8', 'Every official name is in the Glossary',
      'The region names have to mean one thing across every document, and the Glossary '
      'is where a reader settles what that is (comment 39).', scope='user')
def l8_glossary(doc):
    if 'User Manual' not in os.path.basename(doc.path):
        return []
    body = doc.text
    start = body.find('Glossary')
    gloss = body[start:] if start >= 0 else ''
    out = []
    for name in CONV['officialNames']:
        if name in body and name not in gloss:
            out.append(F('"%s" is used but is not in the Glossary' % name))
    return out


@rule('L9', 'Cross-references point at a section that exists',
      'A pointer to a section that was renumbered is worse than no pointer.',
      scope='user')
def l9_refs(doc):
    nums = set()
    for p in doc.paras:
        if p.is_heading:
            m = re.match(r'\s*(\d+(?:\.\d+)?)', p.text or '')
            if m:
                nums.add(m.group(1))
    out = []
    for p, m in _hits(doc, r'Section\s+(\d+(?:\.\d+)?)'):
        if p.container == 'sdt':
            continue
        # ⚠ A REFERENCE TO ANOTHER DOCUMENT'S SECTION IS NOT A BROKEN ONE. The Beta Test
        # Plan points a tester at the manual - "the manual's section 6.3" - and every one
        # of those numbers was correct while this rule called all five of them broken.
        # A rule that cries wolf on correct text is worse than no rule, because the real
        # ones stop being read. Only a reference with no other document named near it is
        # taken as internal.
        # The whole paragraph, not a window around the match: a bullet often carries two
        # or three references and names the document once.
        if re.search(r'manual|Overview|document', p.text or '', re.I):
            continue
        if m.group(1) not in nums:
            out.append(F('points at Section %s, which does not exist' % m.group(1),
                         p.i, snip(p.text)))
    return out


def _screen_names():
    """Button, tab and setting names harvested from the app, so the list cannot go stale.

    Harvested rather than hand-listed for the same reason the word lists are shared: a
    second copy of the app's own vocabulary would drift from the app within a release.
    """
    names = set()
    try:
        html = open(os.path.join(ROOT, 'app', 'index.html'), encoding='utf-8').read()
    except OSError:
        return []
    for m in re.finditer(r'aria-label="([^"]{3,40})"', html):
        names.add(m.group(1).strip())
    for m in re.finditer(r'<label[^>]*>([^<]{3,40})</label>', html):
        names.add(m.group(1).strip())
    for m in re.finditer(r'<button[^>]*>([A-Za-z][^<]{2,30})</button>', html):
        names.add(m.group(1).strip())
    # Words too ordinary to be worth flagging when they appear in a sentence.
    stop = {'Close', 'Test', 'Paste', 'Copy', 'Clear', 'Send', 'Load', 'Update',
            'Delete', 'Save', 'Reset', 'Refresh', 'Start', 'Voice', 'Layout',
            'Which side', 'Where it sits'}
    return sorted((n for n in names if n not in stop and len(n.split()) <= 5),
                  key=len, reverse=True)


# --------------------------------------------------------------------- runner

def documents(patterns):
    paths = sorted(glob.glob(os.path.join(DOCS, '*.docx')))
    paths = [p for p in paths if not os.path.basename(p).startswith('~$')]
    if patterns:
        paths = [p for p in paths
                 if any(pat.lower() in os.path.basename(p).lower() for pat in patterns)]
    return paths


def main(argv):
    only = None
    errors_only = lang_only = False
    pats = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--list':
            for r in RULES:
                print('%-4s [%-6s %-4s] %s\n      %s\n' %
                      (r.rid, r.severity, r.scope, r.title, r.why))
            return 0
        elif a == '--rule':
            i += 1
            only = argv[i]
        elif a == '--errors-only':
            errors_only = True
        elif a == '--lang':
            lang_only = True
        elif a == '--no-word':
            pass          # handled at the end; listed here so it is not read as a filename
        else:
            pats.append(a)
        i += 1

    paths = documents(pats)
    if not paths:
        print('No documents matched.')
        return 1

    user_facing = set(CONV['userFacingDocuments'])
    totals = {'error': 0, 'review': 0}
    for path in paths:
        base = os.path.basename(path)
        try:
            doc = Doc(path)
        except Exception as e:
            print('\n%s\n  COULD NOT READ: %s' % (base, e))
            totals['error'] += 1
            continue
        # ⚠ COMPARED WITHOUT COMMAS, because the manuals are mid-rename: the list holds
        # the comma-free names they are moving to, while the files on disk still carry
        # the old ones. Without this the manual quietly drops to "internal" and every
        # rule that matters most to it is skipped - a green run that checked almost
        # nothing, which is the worst outcome a test suite can produce.
        nc = lambda x: x.replace(',', '')
        is_user = nc(base) in {nc(u) for u in user_facing}
        lines = []
        for r in RULES:
            if only and r.rid != only:
                continue
            if lang_only and not r.rid.startswith('L'):
                continue
            if r.scope == 'user' and not is_user:
                continue
            try:
                found = r(doc)
            except Exception as e:
                found = [F('rule crashed: %s' % e)]
            for f in found:
                sev = f.severity or r.severity
                if errors_only and sev != 'error':
                    continue
                totals[sev] = totals.get(sev, 0) + 1
                where = ('para %d' % f.para) if f.para is not None else '-'
                lines.append('  %-6s %-3s %-9s %s' % (sev.upper(), r.rid, where, f.msg))
                if f.snippet:
                    lines.append('              %s' % f.snippet)
        print('\n%s%s' % (base, '' if is_user else '   (internal)'))
        if lines:
            print('\n'.join(lines))
        else:
            print('  clean')

    print('\n%s\n%d error(s), %d to review across %d document(s).'
          % ('-' * 70, totals['error'], totals['review'], len(paths)))
    # The last word, and it overrides everything above: a document Word will not open
    # is not clean with a caveat, it is broken, whatever the rules said.
    word_bad, why = (None, 'skipped') if ('--no-word' in argv) else word_opens(paths)
    if why:
        print('WORD CHECK NOT RUN (%s) - a green result above does NOT mean they open.' % why)
    elif word_bad:
        print()
        print('%d document(s) WORD WILL NOT OPEN: %s' % (len(word_bad), ', '.join(word_bad)))
        if not totals['error']:
            print('Everything above passed anyway, which is exactly why this check exists.')
        return 1
    else:
        print('Word opens all %d.' % len(paths))
    return 1 if totals['error'] else 0


def word_opens(paths):
    """The only check that has ever been right: ask Word to open the file.

    Three separate times a .docx has been produced that Word refuses - xml.etree
    rewriting the namespace prefixes, an emptied table cell, and a numbering list used
    but never declared - and every single time EVERY OTHER CHECK PASSED. It unzipped,
    every part parsed, python-docx read all the text back, LibreOffice converted it
    without complaint, and the rules above called the document clean.

    The lesson written down after the second time - assert what the CONSUMER requires,
    not what the parser accepts - was right, and was implemented as a list of the two
    faults already known, which by construction could not catch a third. This asks the
    consumer instead of guessing what it wants.

    Skipped LOUDLY where Word is unavailable. A silent skip puts us straight back to a
    green run on a file nobody can open.
    """
    if os.name != 'nt':
        return None, 'not Windows'
    ps = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'doc-generators', 'open-in-word.ps1')
    if not os.path.exists(ps):
        return None, 'open-in-word.ps1 is missing'
    # ⚠ ONE Word for the whole batch. Starting it per document took over two minutes
    # across the document set and seconds this way.
    r = subprocess.run(['powershell', '-ExecutionPolicy', 'Bypass', '-File', ps] + list(paths),
                       capture_output=True, text=True)
    bad = [ln.split('  ->')[0].replace('WORD REFUSES', '').strip()
           for ln in (r.stdout or '').splitlines() if 'WORD REFUSES' in ln]
    if r.returncode != 0 and not bad:
        return None, 'the Word check itself failed: %s' % ((r.stderr or r.stdout or '').strip()[:120])
    return bad, None

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
