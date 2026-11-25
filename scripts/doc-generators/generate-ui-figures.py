# -*- coding: utf-8 -*-
"""Regenerates the Architecture Overview's UI figures (Section 12).

WHY THIS FILE EXISTS. CLAUDE.md said these figures were "generated with Python/Pillow,
regenerable on request" — but no generator was ever committed, so for months the honest
answer to "the figures are out of date" was "we cannot regenerate them," and two syncs
recorded that as a residual needing "an image toolchain this box does not have." Both
Pillow and puppeteer were installed the whole time; what was missing was this script.
An asset that claims to be regenerable must ship the thing that regenerates it.

WHAT IT DRAWS. The figures that Section 12's August 20 2026 rewrite made wrong — the
ones still showing the slot badge, the latency dot, the transcript-confirmation gate,
the old placeholder ladder, and three access renderers when only one exists:

    ui-fig1-anatomy.png     Fig 3  the shipped screen (bottom dock)
    ui-fig2-card.png        Fig 4  the shipped response card
    ui-fig3-modes.png       Fig 5  cards swap, frame does not
    ui-fig4-transcript.png  Fig 6  transcript states as shipped
    ui-fig5-ladder.png      Fig 7  placeholders, armed by silence
    ui-fig6-access.png      Fig 8  one screen, every access method (switch scanning reads it)

DIMENSIONS ARE FIXED. Each file keeps the pixel size the document already embeds: the
drawing XML carries its own extent, so a different aspect ratio stretches the picture
rather than resizing it. Asserted on write.

TEXT IS WIDTH-CHECKED, NOT EYEBALLED. These are drawn blind, and the failure mode is a
line quietly running out of its box or off the canvas — invisible unless someone opens
the PNG. Every text helper measures against its container and the run aborts on any
overflow, so a figure that builds is a figure that fits.

Multi-line labels use "|" as the line break, NOT a backslash escape: this file is
routinely edited through shell heredocs, which mangle the escape into a real newline
and split the string literal. The pipe survives that.

    python generate-ui-figures.py           # write the PNGs beside this script
    python generate-ui-figures.py --embed   # ...and swap them into the .docx
"""
import os
import sys
import zipfile
import shutil
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
DOCX = os.path.join(HERE, '..', '..', 'Documents', 'Conversant AAC Architecture Overview.docx')

WHITE = (255, 255, 255)
INK = (26, 26, 26)
GRAY = (122, 122, 122)
FRAME = (158, 158, 158)
LEAD = (150, 160, 168)

SLOT = {                        # border, fill — the app's own slot tokens
    'preferred':    ((46, 125, 50),  (232, 245, 233)),
    'dispreferred': ((191, 119, 14), (253, 240, 220)),
    'initiative':   ((21, 101, 192), (220, 233, 248)),
    'repair':       ((123, 31, 162), (243, 229, 245)),
    'persistent':   ((69, 90, 100),  (236, 239, 241)),
    'amber':        ((230, 168, 23), (254, 246, 224)),
    'red':          ((192, 57, 43),  (250, 232, 230)),
}

FONTS = 'C:/Windows/Fonts/'
NL = chr(10)
OVERFLOW = []


def font(size, weight=''):
    name = {'': 'arial.ttf', 'b': 'arialbd.ttf', 'i': 'ariali.ttf'}[weight]
    return ImageFont.truetype(FONTS + name, size)


def fits(label, s, fnt, maxw):
    bb = fnt.getbbox(s)
    if bb[2] - bb[0] > maxw:
        OVERFLOW.append('%-16s %4dpx > %4dpx  %r' % (label, bb[2] - bb[0], maxw, s[:58]))
    return s


def new(w, h):
    im = Image.new('RGB', (w, h), WHITE)
    return im, ImageDraw.Draw(im), w


def box(d, xy, key, width=4, radius=14, fill=True):
    b, f = SLOT[key]
    d.rounded_rectangle(xy, radius=radius, fill=(f if fill else WHITE), outline=b, width=width)


def left(d, x, y, s, fnt, cw, color=INK, label='left'):
    fits(label, s, fnt, cw - x - 24)
    d.text((x, y), s, font=fnt, fill=color, anchor='la')


def mid(d, cx, y, s, fnt, maxw, color=INK, label='mid'):
    fits(label, s, fnt, maxw)
    d.text((cx, y), s, font=fnt, fill=color, anchor='ma')


def block(d, cx, y, lines, fnt, maxw, color=INK, label='block', spacing=10):
    for ln in lines.split('|'):
        fits(label, ln, fnt, maxw)
    d.multiline_text((cx, y), lines.replace('|', NL), font=fnt, fill=color,
                     anchor='mm', align='center', spacing=spacing)


def pill(d, xy, text, key, fnt):
    b, _ = SLOT[key]
    d.rounded_rectangle(xy, radius=(xy[3] - xy[1]) // 2, fill=b)
    fits('pill', text, fnt, xy[2] - xy[0] - 16)
    d.text(((xy[0] + xy[2]) / 2, (xy[1] + xy[3]) / 2), text, font=fnt, fill=WHITE, anchor='mm')


def tag(d, x, y, letter, fnt, r=26):
    d.ellipse((x - r, y - r, x + r, y + r), fill=(69, 79, 87))
    d.text((x, y), letter, font=fnt, fill=WHITE, anchor='mm')


def leader(d, p1, p2):
    d.line([p1, p2], fill=LEAD, width=2)
    d.ellipse((p1[0] - 5, p1[1] - 5, p1[0] + 5, p1[1] + 5), fill=LEAD)


def note(d, x, y, head, body, cw):
    left(d, x, y, head, font(27, 'b'), cw, INK, 'note/head')
    left(d, x, y + 36, body, font(25), cw, GRAY, 'note/body')


def cap(d, x, y, s, cw):
    left(d, x, y, s, font(26, 'i'), cw, GRAY, 'caption')


# --- Fig 4 — the shipped response card --------------------------------------
def fig_card():
    im, d, cw = new(1600, 820)
    box(d, (90, 150, 950, 620), 'initiative')
    mid(d, 520, 300, '“Could we do Saturday instead?”', font(46, 'b'), 830, INK, 'card/full')
    mid(d, 520, 430, 'Saturday instead?', font(28), 830, GRAY, 'card/hint')

    leader(d, (700, 336), (1000, 250))
    note(d, 1010, 215, 'Full utterance — the card’s primary',
         'text, at reading size. What TTS will say.', cw)
    leader(d, (640, 452), (1000, 470))
    note(d, 1010, 435, 'Hint — the model’s short label for',
         'the move. A setting picks what shows.', cw)

    cap(d, 90, 660, 'No slot badge, no format tag, no latency dot: the category is carried by POSITION', cw)
    cap(d, 90, 698, 'and COLOR. A screen reader hears the full wording, not a category name, and the', cw)
    cap(d, 90, 736, 'color-blind scheme also marks the category by the style of the left edge.', cw)
    cap(d, 90, 782, 'Choosing the card speaks it, after a second tap if “One tap or two” asks for one.', cw)
    return im


# --- Fig 3 — the shipped screen ---------------------------------------------
def fig_anatomy():
    im, d, cw = new(1600, 1000)
    fletter = font(30, 'b')
    d.rounded_rectangle((36, 30, 1564, 968), radius=22, outline=FRAME, width=6)

    box(d, (86, 66, 1516, 236), 'amber', width=3)
    left(d, 112, 86, 'PARTNER SAID', font(22, 'b'), cw, (176, 122, 12), 'A/label')
    left(d, 112, 124, '“Want to come to dinner Friday?”', font(38, 'b'), cw, INK, 'A/quote')
    left(d, 112, 186, 'no confirm step — generation already began on the pause',
         font(22, 'i'), cw, GRAY, 'A/note')
    tag(d, 70, 76, 'A', fletter)

    left(d, 112, 262, '♪ “I’m thinking about that.”', font(26, 'b'), cw, (69, 90, 100), 'np/line')
    left(d, 560, 266, 'what the app is saying for the user, shown as it plays',
         font(22, 'i'), cw, GRAY, 'np/note')

    tag(d, 70, 336, 'B', fletter)
    cards = [('preferred', '“I’d love to — what time?”', 'Love to — what time?', 86, 326),
             ('dispreferred', '“I wish I could, but I have PT.”', 'Wish I could — PT Friday', 810, 326),
             ('initiative', '“Could we do Saturday instead?”', 'Saturday instead?', 86, 522),
             ('repair', '“Sorry — dinner where?”', 'Dinner where?', 810, 522)]
    for key, full, hint, cx, cy in cards:
        box(d, (cx, cy, cx + 706, cy + 172), key, width=3)
        mid(d, cx + 353, cy + 40, full, font(30, 'b'), 670, INK, 'B/full')
        mid(d, cx + 353, cy + 100, hint, font(23), 670, GRAY, 'B/hint')

    tag(d, 70, 746, 'C', fletter)
    labels = ['Listen', 'Start', 'End', 'Say again', 'Hold on', 'What?',
              'Wrap up', 'Don’t save', 'Settings']
    bw, gap = 152, 8
    for i, lab in enumerate(labels):
        x = 86 + i * (bw + gap)
        box(d, (x, 736, x + bw, 812), 'persistent', width=3, radius=10)
        fits('C/label', lab, font(21, 'b'), bw - 12)
        d.text((x + bw / 2, 774), lab, font=font(21, 'b'), fill=(69, 90, 100), anchor='mm')
    left(d, 86, 822,
         'Command Bar — icons by default, or these short words; fixed positions, every mode',
         font(21, 'i'), cw, GRAY, 'C/cap')

    tag(d, 70, 876, 'D', fletter)
    box(d, (86, 852, 1516, 924), 'persistent', width=3, radius=10, fill=False)
    cells = ['Yes', 'No', 'Okay', 'Please', 'Thank you', 'Sorry', 'Hi', 'Bye', 'Wait', 'Help',
             'In my own|words']
    cellw = (1430 - 10 * 6) / 11
    for i, lab in enumerate(cells):
        x = 92 + i * (cellw + 6)
        d.rounded_rectangle((x, 858, x + cellw, 918), radius=8, outline=(176, 190, 197), width=2)
        block(d, x + cellw / 2, 888, lab, font(19), cellw - 10, (69, 90, 100), 'D/cell', 4)
    left(d, 86, 930,
         'Express Panel at rest — the on-screen keyboard fills this same grid while composing',
         font(21, 'i'), cw, GRAY, 'D/cap')
    return im


# --- Fig 5 — cards swap, the frame does not ---------------------------------
def fig_modes():
    im, d, cw = new(1840, 860)
    fchip, fcard = font(20, 'b'), font(24, 'b')
    panels = [('RESPONDING', 'initiative',
               [('preferred', 'Love to —|what time?'), ('dispreferred', 'Wish I could|— PT Friday'),
                ('initiative', 'Saturday|instead?'), ('repair', 'Dinner|where?')]),
              ('REPAIR-OF-SELF', 'repair',
               [('repair', 'Say it|again'), ('repair', 'Say it|differently'),
                ('repair', 'Say more|about it'), ('persistent', '(same|frame)')]),
              ('PRE-CLOSING', 'persistent',
               [('persistent', 'I should|get going'), ('persistent', 'Good talking|to you'),
                ('persistent', 'Bye|for now'), ('initiative', 'Actually,|before you go')])]
    for n, (title, chipkey, cards) in enumerate(panels):
        ox = 40 + n * 590
        d.rounded_rectangle((ox, 60, ox + 550, 700), radius=16, outline=FRAME, width=4)
        mid(d, ox + 275, 100, title, fchip, 500, GRAY, 'modes/title')
        for i, (key, label) in enumerate(cards):
            cx, cy = ox + 24 + (i % 2) * 258, 180 + (i // 2) * 250
            box(d, (cx, cy, cx + 244, cy + 224), key, width=3)
            block(d, cx + 122, cy + 112, label, fcard, 224, INK, 'modes/card')
    cap(d, 40, 740,
        'The cards change; the frame does not. Same geometry, same four positions, same Command', cw)
    cap(d, 40, 778, 'Bar, in every mode — which is what a physical keyguard depends on.', cw)
    cap(d, 40, 824, 'No badges and no mode label on screen (the titles are for this figure only).', cw)
    return im


# --- Fig 6 — transcript states, as shipped ----------------------------------
def fig_transcript():
    im, d, cw = new(1600, 760)
    # As shipped the state is a colored LEFT EDGE on the partner's live line, not a
    # labeled banner: amber while heard, blue while the AI is asked, none once ready.
    rows = [('amber', 'HEARD', SLOT['amber'][0],
             'The recognizer has delivered. Generation has ALREADY begun — a display, not a gate.'),
            ('initiative', 'GENERATING', SLOT['initiative'][0],
             'The AI is being asked and a placeholder may be playing; what plays is shown on screen.'),
            ('preferred', 'OPTIONS READY', None,
             'The options are live. The line stays up for reference while the user chooses.')]
    y = 50
    for key, label, edge, desc in rows:
        left(d, 80, y, label, font(22, 'b'), cw, SLOT[key][0], 'T/label')
        d.rectangle((80, y + 38, 1520, y + 112), fill=(245, 247, 248))
        if edge:
            d.rectangle((80, y + 38, 92, y + 112), fill=edge)
        left(d, 112, y + 56, '“Want to come to dinner Friday?”', font(30, 'b'), cw, INK, 'T/quote')
        left(d, 80, y + 124, desc, font(22, 'i'), cw, GRAY, 'T/desc')
        y += 180

    cap(d, 80, 606, 'There is no confirmation step: generation fires on the partner’s pause, and a garbled', cw)
    cap(d, 80, 644, 'capture is handled afterwards by “Ask them to repeat”, not by a gate.', cw)
    cap(d, 80, 694, 'Two states not shown: if the AI cannot be reached, the line turns blue and italic, and', cw)
    cap(d, 80, 726, 'a faint red wash over the box marks that something went wrong this conversation.', cw)
    return im


# --- Fig 7 — placeholders, armed by silence ---------------------------------
def fig_ladder():
    im, d, cw = new(1600, 640)
    d.line([(120, 250), (1480, 250)], fill=LEAD, width=4)
    marks = [(120, 'partner|stops', None),
             (430, '2s', '“I’m thinking|about that.”'),
             (900, '+10s', '“Still thinking|it through.”'),
             (1330, 'user selects', 'ladder stops')]
    for x, top, bottom in marks:
        d.ellipse((x - 11, 239, x + 11, 261), fill=(69, 90, 100))
        block(d, x, 178, top, font(26, 'b'), 300, INK, 'ladder/top', 6)
        if bottom:
            block(d, x, 322, bottom, font(23), 300, GRAY, 'ladder/bottom', 6)

    block(d, 430, 78, 'the AI may not have answered yet|— it does not matter',
          font(22, 'i'), 460, SLOT['initiative'][0], 'ladder/note', 6)
    d.line([(430, 118), (430, 150)], fill=LEAD, width=2)

    cap(d, 120, 420, 'The clock is started by the partner’s SILENCE, not by the generation round trip.', cw)
    cap(d, 120, 462, 'Every phrase is neutral and works after any kind of turn, because the app does not', cw)
    cap(d, 120, 494, 'yet know what kind of turn it was. A phrase already playing always finishes.', cw)
    cap(d, 120, 544, 'The user sets both delays, the most per turn, and how much longer to wait each exchange.', cw)
    cap(d, 120, 582, 'Everything spoken is displayed as it plays: nothing is said on the user’s behalf unseen.', cw)
    return im


# --- Fig 8 — one screen, every access method ----------------------------------
# As built (0.15.0): the palette descriptor feeds ONE renderer, the screen layout.
# Switch scanning does not render the descriptor; it reads the screen as drawn
# (switch-access.js), decides the next stop by region (scan-rules.js), and presses
# the highlighted button with a tap.
def fig_access():
    im, d, cw = new(1840, 880)
    d.rounded_rectangle((560, 30, 1280, 130), radius=14, outline=SLOT['persistent'][0], width=4,
                        fill=SLOT['persistent'][1])
    mid(d, 920, 46, 'One palette descriptor', font(30, 'b'), 690, INK, 'access/title')
    mid(d, 920, 90, 'slots · priority · droppable — emitted by the engine', font(23), 690,
        GRAY, 'access/sub')

    d.line([(920, 130), (920, 180)], fill=LEAD, width=3)
    box(d, (380, 180, 1460, 300), 'preferred', width=4, fill=False)
    mid(d, 920, 196, 'Direct-select renderer: the one screen layout', font(30, 'b'), 1000,
        INK, 'access/renderer')
    mid(d, 920, 248, 'response options in a row or two by two, as the user chooses',
        font(22), 1000, GRAY, 'access/renderer-sub')

    cols = [(110, 'Touch and pointer', 'preferred', 'BUILT',
             ['A finger or a mouse works the screen',
              'as drawn. Eye gaze and head tracking',
              'arrive here too: in pointer-emulation',
              'mode they are just a pointer.']),
            (700, 'Switch scanning', 'preferred', 'BUILT',
             ['Reads the screen as drawn, not the',
              'descriptor, and scans it by region:',
              'response options, Express Panel,',
              '“In my own words”, Command Bar.',
              'A press taps the highlighted button.']),
            (1290, 'Purpose-built gaze grid', 'red', 'NOT BUILT',
             ['A large-target renderer is future work.',
              'Gaze users are served today by the',
              'screen above, with button size and',
              'spacing as the tuning surface.'])]
    for x, title, key, badge, lines in cols:
        d.line([(920, 300), (x + 220, 360)], fill=LEAD, width=2)
        box(d, (x, 360, x + 440, 680), key, width=4, fill=False)
        mid(d, x + 220, 384, title, font(30, 'b'), 400, INK, 'access/col')
        pill(d, (x + 130, 434, x + 310, 478), badge, key, font(21, 'b'))
        for i, ln in enumerate(lines):
            mid(d, x + 220, 498 + i * 33, ln, font(21), 410, GRAY, 'access/body')

    cap(d, 120, 712, 'The engine emits one descriptor and one renderer draws it. Every access method then', cw)
    cap(d, 120, 750, 'works that same screen, so the layout and the keyguard do not change with the method.', cw)
    cap(d, 120, 796, 'Switch scanning does not use the descriptor’s priority or paging. It scans the screen', cw)
    cap(d, 120, 834, 'in region order, and newer options wait while the highlight is in the response options.', cw)
    return im


FIGURES = [
    ('ui-fig1-anatomy.png', (1600, 1000), fig_anatomy, 'word/media/image3.png'),
    ('ui-fig2-card.png', (1600, 820), fig_card, 'word/media/image4.png'),
    ('ui-fig3-modes.png', (1840, 860), fig_modes, 'word/media/image5.png'),
    ('ui-fig4-transcript.png', (1600, 760), fig_transcript, 'word/media/image6.png'),
    ('ui-fig5-ladder.png', (1600, 640), fig_ladder, 'word/media/image7.png'),
    ('ui-fig6-access.png', (1840, 880), fig_access, 'word/media/image8.png'),
]


def main():
    written = {}
    for name, size, fn, part in FIGURES:
        im = fn()
        if im.size != size:
            print('ABORT — %s is %s, must be %s (the document embeds a fixed extent, so a '
                  'different aspect ratio stretches the picture)' % (name, im.size, size))
            sys.exit(1)
        path = os.path.join(HERE, name)
        im.save(path)
        written[name] = (path, part)
        print('wrote %-24s %s' % (name, size))

    if OVERFLOW:
        print(NL + 'ABORT — text does not fit its container:')
        for o in OVERFLOW:
            print('   ' + o)
        sys.exit(1)

    if '--embed' not in sys.argv:
        print(NL + 'All text fits. PNGs only — re-run with --embed to swap them into the document.')
        return

    doc = os.path.abspath(DOCX)
    with zipfile.ZipFile(doc) as z:
        infos = z.infolist()
        parts = {i.filename: z.read(i.filename) for i in infos}
    for name, (path, part) in written.items():
        if part not in parts:
            print('ABORT — %s missing from the document' % part)
            sys.exit(1)
        parts[part] = open(path, 'rb').read()
    tmp = doc + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
        for i in infos:                      # preserve entry order
            out.writestr(i.filename, parts[i.filename])
    shutil.move(tmp, doc)
    print(NL + 'embedded %d figures into %s' % (len(written), os.path.basename(doc)))


main()
