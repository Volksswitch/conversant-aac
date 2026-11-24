"""Build the ATIA deck version that carries the conversation-analysis video.

Usage: python build_deck.py SRC.pptx DST.pptx VIDEO.mp4 POSTER.png CHAPTERS.txt

All slide numbers below are the ORIGINAL deck's numbers; the new slide is added
and moved into place last.
"""
import copy
import sys

from pptx import Presentation
from pptx.util import Emu

SRC, DST, VIDEO, POSTER, CHAPTERS = sys.argv[1:6]
NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
A = '{%s}' % NS_A
P = '{%s}' % NS_P

prs = Presentation(SRC)
orig = list(prs.slides)


def sl(n):
    return orig[n - 1]


def shape(slide, name):
    for s in slide.shapes:
        if s.name == name:
            return s
    raise SystemExit(f'no shape {name!r} on slide')


def next_id(slide):
    ids = [int(x.get('id')) for x in slide.shapes._spTree.iter(P + 'cNvPr')]
    return max(ids) + 1


def clone(src_shape, slide, name):
    el = copy.deepcopy(src_shape._element)
    cnv = el.find('.//' + P + 'cNvPr')
    cnv.set('id', str(next_id(slide)))
    cnv.set('name', name)
    slide.shapes._spTree.append(el)
    return slide.shapes[-1]


def make_para(template_p, runs, size=None, italic=None, bold=None):
    """A paragraph with template_p's paragraph settings and first run's look.
    runs: list of (text, {'b':..,'i':..,'sz':..}) or plain strings."""
    p = copy.deepcopy(template_p)
    tmpl_rpr = p.find('.//' + A + 'rPr')
    for child in list(p):
        if child.tag != A + 'pPr':
            p.remove(child)
    for r in runs:
        text, opts = (r, {}) if isinstance(r, str) else r
        run = p.makeelement(A + 'r', {})
        rpr = copy.deepcopy(tmpl_rpr) if tmpl_rpr is not None else run.makeelement(A + 'rPr', {})
        for key, val in (('sz', size), ('i', italic), ('b', bold)):
            if val is not None:
                rpr.set(key, str(val))
        for key, val in opts.items():
            rpr.set(key, str(val))
        run.append(rpr)
        t = run.makeelement(A + 't', {})
        t.text = text
        run.append(t)
        p.append(run)
    return p


def set_paras(shp, paras):
    """Replace a shape's paragraphs. paras: list of (template_index, runs, kwargs)."""
    body = shp.text_frame._txBody
    old = body.findall(A + 'p')
    made = [make_para(old[min(i, len(old) - 1)], runs, **kw) for i, runs, kw in paras]
    for p in old:
        body.remove(p)
    for p in made:
        body.append(p)


def set_notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def notes(slide):
    return slide.notes_slide.notes_text_frame.text


# ---- Slide 13: say where the one-second finding comes from ----
s13 = sl(13)
tb = clone(shape(s13, 'TextBox 24'), s13, 'CA source')
tb.left, tb.top, tb.width, tb.height = Emu(1143000), Emu(5303520), Emu(8229600), Emu(400000)
# The existing "~1 s" label ran into the "~4 s" label beside it; narrow it.
shape(s13, 'TextBox 26').width = Emu(2560320)
set_paras(tb, [(0, ['The one-second finding comes from conversation analysis: the study of recorded everyday talk.'],
                dict(size=1400, italic=1, bold=0))])
n = notes(s13)
n = n.replace("At about four seconds, it becomes uncomfortable.",
              "At about four seconds, it becomes uncomfortable.\n\n"
              "That one-second finding comes from Gail Jefferson, one of the founders of conversation analysis:\n"
              "the study of recordings of everyday talk.\n"
              "You'll hear a lot more about that field in the second half.")
set_notes(s13, n)

# ---- Slide 16: name the losses as conversation-analysis structures ----
s16 = sl(16)
tb = clone(shape(s16, 'TextBox 5'), s16, 'CA note')
tb.left, tb.top, tb.width, tb.height = Emu(6995160), Emu(5029200), Emu(4050791), Emu(640080)
set_paras(tb, [(1, ['Each loss is a structure that conversation analysis describes.'],
                dict(size=1800, italic=1, bold=1))])
body = tb.text_frame._txBody
ppr = body.find(A + 'p').find(A + 'pPr')
for tag in ('buFont', 'buChar'):
    el = ppr.find(A + tag)
    if el is not None:
        ppr.remove(el)
ppr.set('marL', '0')
ppr.set('indent', '0')
ppr.append(ppr.makeelement(A + 'buNone', {}))
set_notes(s16, notes(s16).rstrip() + "\n\n"
          "One more thing about this list.\n"
          "Each item on it is a structure that conversation analysis describes:\n"
          "who takes the initiative, how people decline, how they repair, how they open and close,\n"
          "and how they shape what they say for the person listening.\n"
          "Hold on to that. It's the key to the second half.")

# ---- Slide 22: hand off to the new slide ----
s22 = sl(22)
set_notes(s22, notes(s22).replace(
    "So if the idea is this clear, why hasn't anyone shipped it?",
    "Let me say more about that foundation, because it's the part I left out of the article."))

# ---- Slide 24: say what comes next ----
s24 = sl(24)
set_notes(s24, notes(s24).rstrip() + "\n\n"
          "[After Meet Conversant AAC comes the video, about ten minutes. It replaces the live demo\n"
          "and the detail slides that followed it, which are hidden, not deleted.]")

# ---- Slide 26: the video replaces the live demo ----
s26 = sl(26)
for name in ('Rounded Rectangle 5', 'TextBox 6', 'TextBox 7'):
    el = shape(s26, name)._element
    el.getparent().remove(el)
s26.shapes.title.text = 'Video: Conversant AAC in Conversation'
H = 3749040
W = int(H * 16 / 9)
s26.shapes.add_movie(VIDEO, Emu((prs.slide_width - W) // 2), Emu(2103120), Emu(W), Emu(H),
                     poster_frame_image=POSTER, mime_type='video/mp4')
with open(CHAPTERS, encoding='utf-8') as f:
    chapters = f.read().strip()
set_notes(s26,
          "Rather than tell you, I'll show you.\n\n"
          "This video runs about ten minutes.\n"
          "It follows Marc through two conversations: one at a coffee shop, with a barista he has never met,\n"
          "and one at his comic shop, with Ramon, who knows him well.\n"
          "Along the way it walks through five principles from conversation analysis,\n"
          "and shows what each one changed in Conversant.\n\n"
          "[Click the video to play. Each chapter opens on a title card, a natural place to pause and comment.]\n\n"
          "Chapters:\n" + chapters + "\n\n"
          "[Slides 27 to 37, the live-demo backup and the detail slides, are hidden, not deleted.\n"
          "Unhide any of them if you want to show it after the video.]")

# ---- Hide the slides the video now covers (27-37) ----
for n in range(27, 38):
    sl(n)._element.set('show', '0')

# ---- Slide 38: the demo is now a video ----
s38 = sl(38)
set_notes(s38, notes(s38).replace(
    "That's exactly why the demo used Practice Mode.",
    "That's exactly why the partners in the video are recorded voices, not a live microphone."))

# ---- Slide 45: the conversation-analysis sources ----
s45 = sl(45)
refs = shape(s45, 'TextBox 8')
body = refs.text_frame._txBody
paras = body.findall(A + 'p')
new_refs = {
    'Pomerantz': 'Pomerantz, A. (1984). Agreeing and disagreeing with assessments: Some features of preferred/dispreferred turn shapes. In J. M. Atkinson & J. Heritage (Eds.), Structures of social action. Cambridge University Press.',
    'Sacks': 'Sacks, H., Schegloff, E. A., & Jefferson, G. (1974). A simplest systematics for the organization of turn-taking for conversation. Language, 50(4), 696–735.',
    'Schegloff1977': 'Schegloff, E. A., Jefferson, G., & Sacks, H. (1977). The preference for self-correction in the organization of repair in conversation. Language, 53(2), 361–382.',
    'Schegloff1973': 'Schegloff, E. A., & Sacks, H. (1973). Opening up closings. Semiotica, 8(4), 289–327.',
}
texts = [''.join(t.text or '' for t in p.iter(A + 't')) for p in paras]
# Alphabetical by author list, as APA orders them (Schegloff, Jefferson before
# Schegloff & Sacks, which a plain sort gets backwards because of the "&").
merged = sorted(texts + list(new_refs.values()), key=lambda s: s.lower().replace('& ', ''))
for p in paras:
    body.remove(p)
for t in merged:
    body.append(make_para(paras[0], [t], size=900))
for p in body.findall(A + 'p'):
    sp = p.find(A + 'pPr').find(A + 'spcAft/' + A + 'spcPts')
    if sp is not None:
        sp.set('val', '100')
refs.top = Emu(1920240)

# ---- New slide after 22: what the article missed ----
new = prs.slides.add_slide(s16.slide_layout)
for s in list(new.shapes):
    s._element.getparent().remove(s._element)
for el in list(s16.shapes._spTree)[2:]:
    if el.find('.//' + P + 'cNvPr') is not None and el.find('.//' + P + 'cNvPr').get('name') == 'CA note':
        continue
    new.shapes._spTree.append(copy.deepcopy(el))
new.shapes.title.text = 'What the Article Missed: Conversation Analysis'
lst = shape(new, 'TextBox 5')
principles = [
    ('Turn-taking', 'who speaks next, and when silence means something'),
    ('Preference', 'yes is plain; no comes softened, with a reason'),
    ('Repair', 'trouble gets fixed right away, by either person'),
    ('Recipient design', 'we shape what we say for the listener'),
    ('Openings and closings', 'conversations begin and end in steps'),
]
set_paras(lst, [(1, [(f'{a}: ', {'b': 1}), (b, {'b': 0})], dict(size=2000)) for a, b in principles])
box = shape(new, 'Rounded Rectangle 6')
set_paras(box, [
    (0, ['“Is it mild, moderate, or severe?”'], dict(size=2200, italic=1)),
    (0, ['An early version offered four ways to say “mild.” It had no rule that the choices themselves were what was due next.'],
     dict(size=1800, italic=0)),
    (1, ['Found in testing, 2026'], {}),
])
new.notes_slide.notes_text_frame.text = (
    "In the article, I left conversation analysis out entirely.\n"
    "I found it when I started building.\n\n"
    "Conversation analysis is decades of research built on recordings of everyday talk.\n"
    "It describes the structure underneath conversation, the part none of us notice until it goes wrong.\n"
    "Five parts of it shaped Conversant.\n\n"
    "<read the list>\n\n"
    "Here's what happens without it, in the box on the right.\n"
    "An early version of the app had no rule for questions that offer choices.\n"
    "In testing, a doctor asked, \"Is it mild, moderate, or severe?\",\n"
    "and all four options were ways of saying \"mild.\"\n"
    "The language model wrote good sentences. It just didn't know what was due next.\n\n"
    "The video in the second half walks through each of these five, and shows what each one changed.\n\n"
    "So if the idea is this clear, why hasn't anyone shipped it?")
# Move it to just after original slide 22.
lst_el = prs.slides._sldIdLst
ids = list(lst_el)
new_id = ids[-1]
lst_el.remove(new_id)
pos = list(lst_el).index(lst_el[orig.index(s22)])
lst_el.insert(pos + 1, new_id)

prs.save(DST)
print('saved', DST, 'slides', len(prs.slides))
