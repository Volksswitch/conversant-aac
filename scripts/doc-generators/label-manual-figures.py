"""Draw the callouts onto the two manual screenshots, from the boxes capture-manual-figures.js
recorded.

  python label-manual-figures.py

⚠ NOT A COORDINATE IS TYPED HERE. Every box comes from the running app's own
getBoundingClientRect, so a label cannot drift from the thing it points at when the
layout changes - re-run the capture and the labels follow. That is the whole reason the
capture emits JSON instead of the two scripts being one.

⚠ NUMBERED BADGES AND A LEGEND, NOT LEADER LINES. The regions tile the whole screen and
several are full-width, so arrows would cross each other and cross the regions they are
not pointing at. A badge sits inside the region it names and cannot be misread.

The annotation layer is BLACK AND WHITE on purpose: every color in this app carries a
meaning (green preferred, amber dispreferred, blue initiative, purple repair, and red
for an error), so a colored outline would look like part of the interface.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
INK, PAPER = (17, 17, 17), (255, 255, 255)
PAD_BOTTOM, MARGIN = 40, 24


def font(sz, bold=False):
    for name in (('arialbd.ttf', 'Arial Bold.ttf') if bold else ('arial.ttf', 'Arial.ttf')):
        for d in (r'C:\Windows\Fonts', '/Library/Fonts', '/usr/share/fonts/truetype/msttcorefonts'):
            p = os.path.join(d, name)
            if os.path.exists(p):
                return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


def outline(d, b, w=6):
    """A black rule with a white one just inside it, so the edge is visible over both
    the light panels and the dark buttons underneath."""
    x, y, x2, y2 = b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h']
    d.rectangle([x + w, y + w, x2 - w, y2 - w], outline=PAPER, width=w)
    d.rectangle([x, y, x2, y2], outline=INK, width=w)


def badge(d, b, n, f, taken, encloses, W, H):
    """Numbered disc, inset into the region's top-left corner.

    ⚠ REGIONS NEST, SO TWO BADGES CAN WANT THE SAME CORNER. The Conversation Log sits
    inside the Conversation Pane and starts within a few pixels of it, and the first
    run drew 1 and 2 on top of each other - unreadable, and the sort of thing only
    looking at the picture catches. Nudged down until it is clear of the ones already
    placed; `taken` accumulates across the figure."""
    r = 34
    # ⚠ AN ENCLOSING REGION PUTS ITS BADGE ON THE FAR CORNER. Regions nest here - the
    # Conversation Log sits inside the Conversation Pane - and the outer one's natural
    # corner is exactly where the inner one's CONTENT begins, so its badge landed on
    # top of the partner's first words. Moving the outer badge to the top right keeps
    # both clear of the content and reads correctly: the outer label sits on the outer
    # edge. Nudging is still needed for anything that collides after that.
    cx, cy = b['x'] + r + 16, b['y'] + r + 16
    if encloses:
        cx = b['x'] + b['w'] - r - 16
    # ⚠ ON A SMALL TARGET THE BADGE SITS ON THE CORNER, HALF OUTSIDE. These buttons are
    # icon-only (UI rule 12), so a badge placed inside one covers the glyph that is the
    # entire subject of the label - the first run hid the Cancel ✕ behind its own
    # number. Straddling the corner leaves only a quarter of the badge over the button.
    elif b['w'] < 26 * r or b['h'] < 6 * r:
        cx, cy = b['x'], b['y']
    if b.get('corner') == 'bl':
        cx, cy = b['x'] + r + 16, b['y'] + b['h'] - r - 16
    elif b.get('corner') == 'tr':
        cx, cy = b['x'] + b['w'] - r - 16, b['y'] + r + 16
    # ⚠ CLAMP INTO THE CANVAS. A corner-anchored badge on a box that starts at 0,0 -
    # the keyboard and the Speak button both do - is drawn half outside the image and
    # comes out sliced in two.
    cx = min(max(cx, r + 6), W - r - 6)
    cy = min(max(cy, r + 6), H - r - 6)
    while any(abs(cx - px) < 2 * r + 10 and abs(cy - py) < 2 * r + 10 for px, py in taken):
        cy += 2 * r + 16
    taken.append((cx, cy))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK, outline=PAPER, width=4)
    t = str(n)
    tw = d.textbbox((0, 0), t, font=f)
    d.text((cx - (tw[2] - tw[0]) / 2, cy - (tw[3] - tw[1]) / 2 - tw[1]), t, font=f, fill=PAPER)


def render(src, boxes, out):
    im = Image.open(src).convert('RGB')
    fb, fl = font(40, bold=True), font(34)
    line_h = 52
    canvas = Image.new('RGB', (im.width, im.height + PAD_BOTTOM + line_h * len(boxes) + MARGIN), PAPER)
    canvas.paste(im, (0, 0))
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, im.width - 1, im.height - 1], outline=(160, 160, 160), width=2)
    def contains(a, c):
        return (a['x'] <= c['x'] and a['y'] <= c['y']
                and a['x'] + a['w'] >= c['x'] + c['w'] and a['y'] + a['h'] >= c['y'] + c['h']
                and (a['w'] * a['h']) > (c['w'] * c['h']))

    taken = []
    for i, b in enumerate(boxes, 1):
        outline(d, b)
        badge(d, b, i, fb, taken, any(contains(b, o) for o in boxes if o is not b), im.width, im.height)
    y = im.height + PAD_BOTTOM
    for i, b in enumerate(boxes, 1):
        d.ellipse([MARGIN, y + 4, MARGIN + 36, y + 40], fill=INK)
        n = str(i)
        nb = d.textbbox((0, 0), n, font=fl)
        d.text((MARGIN + 18 - (nb[2] - nb[0]) / 2, y + 22 - (nb[3] - nb[1]) / 2 - nb[1]), n, font=fl, fill=PAPER)
        d.text((MARGIN + 56, y + 4), b['label'], font=fl, fill=INK)
        # A label running off the edge would be silently cut - the figures are drawn
        # blind, so refuse rather than emit one.
        if MARGIN + 56 + d.textlength(b['label'], font=fl) > canvas.width - MARGIN:
            sys.exit('REFUSING - legend line %d is wider than the figure: %s' % (i, b['label']))
        y += line_h
    canvas.save(out)
    print('%s  %dx%d  %d labels' % (os.path.basename(out), canvas.width, canvas.height, len(boxes)))


data = json.load(open(os.path.join(HERE, 'um-figures.json'), encoding='utf8'))
for key, name in (('fig1', 'um-fig1'), ('fig2', 'um-fig2')):
    render(os.path.join(HERE, name + '.png'), data[key], os.path.join(HERE, name + '-labeled.png'))
