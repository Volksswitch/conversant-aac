"""Figure 1 of "Conversant AAC How Conversant Works": the path from the other person
speaking to the device speaking, with each step marked as happening on the device or at
an outside service.

Run:  python scripts/doc-generators/generate-how-it-works-figure.py
Writes scripts/doc-generators/hiw-fig1.png, which generate-how-it-works-doc.js embeds.
Every label is measured against its box and the script refuses to finish if one does
not fit, because a figure is drawn blind.
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'hiw-fig1.png')
FONTS = 'C:/Windows/Fonts/'

W, H = 1600, 950
INK = (33, 33, 33)
MUTED = (90, 90, 90)
DEVICE = ((227, 239, 250), (31, 78, 121))     # fill, edge
OUTSIDE = ((253, 238, 214), (168, 99, 0))
STORE = ((238, 238, 238), (96, 125, 139))


def font(size, bold=False):
    return ImageFont.truetype(FONTS + ('arialbd.ttf' if bold else 'arial.ttf'), size)


def wrap(d, text, fnt, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            if not cur:
                raise SystemExit('word too wide for its box: %r' % w)
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def box(d, x, y, w, h, colors, num, title, body, where):
    fill, edge = colors
    d.rounded_rectangle([x, y, x + w, y + h], radius=18, fill=fill, outline=edge, width=4)
    pad = 22
    fb, fr, fs = font(30, True), font(25), font(21, True)
    cy = y + pad
    lines = wrap(d, '%d.  %s' % (num, title), fb, w - 2 * pad)
    for ln in lines:
        d.text((x + pad, cy), ln, font=fb, fill=INK)
        cy += 38
    cy += 6
    for ln in wrap(d, body, fr, w - 2 * pad):
        d.text((x + pad, cy), ln, font=fr, fill=INK)
        cy += 32
    d.text((x + pad, y + h - pad - 24), where.upper(), font=fs, fill=edge)
    if cy > y + h - pad - 30:
        raise SystemExit('text overflows box %d' % num)


def arrow(d, p1, p2, color=MUTED):
    d.line([p1, p2], fill=color, width=6)
    (x1, y1), (x2, y2) = p1, p2
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    s = 22
    left = (x2 - s * math.cos(a - 0.45), y2 - s * math.sin(a - 0.45))
    right = (x2 - s * math.cos(a + 0.45), y2 - s * math.sin(a + 0.45))
    d.polygon([p2, left, right], fill=color)


img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)

BW, BH, GAP = 440, 270, 90
X = [60, 60 + BW + GAP, 60 + 2 * (BW + GAP)]
Y1, Y2 = 40, 400

box(d, X[0], Y1, BW, BH, STORE, 1, 'The other person speaks',
    'The microphone picks up what they say, and keeps listening through pauses.', 'In the room')
box(d, X[1], Y1, BW, BH, OUTSIDE, 2, 'Speech becomes text',
    'A hearing service turns their words into text: the browser’s own or a paid one.', 'Outside service')
box(d, X[2], Y1, BW, BH, DEVICE, 3, 'The words appear',
    'The user sees what was heard, so they can tell when it misheard.', 'On the device')
box(d, X[2], Y2, BW, BH, OUTSIDE, 4, 'The AI writes options',
    'Four replies, each a different kind, shaped by what the user has told the app.', 'Outside service')
box(d, X[1], Y2, BW, BH, DEVICE, 5, 'The user chooses',
    'One tap picks a reply. A short holding phrase covers the pause.', 'On the device')
box(d, X[0], Y2, BW, BH, DEVICE, 6, 'A voice says it',
    'The device’s own voice, or a paid voice service that sounds more natural.', 'Device, or outside service')

arrow(d, (X[0] + BW + 8, Y1 + BH // 2), (X[1] - 8, Y1 + BH // 2))
arrow(d, (X[1] + BW + 8, Y1 + BH // 2), (X[2] - 8, Y1 + BH // 2))
arrow(d, (X[2] + BW // 2, Y1 + BH + 8), (X[2] + BW // 2, Y2 - 8))
arrow(d, (X[2] - 8, Y2 + BH // 2), (X[1] + BW + 8, Y2 + BH // 2))
arrow(d, (X[1] - 8, Y2 + BH // 2), (X[0] + BW + 8, Y2 + BH // 2))

# What stays on the device, and what goes out with each request.
sx, sy, sw, sh = 60, 735, W - 120, 175
d.rounded_rectangle([sx, sy, sx + sw, sy + sh], radius=18, fill=STORE[0], outline=STORE[1], width=4)
fb, fr = font(28, True), font(25)
d.text((sx + 24, sy + 20), 'Kept on the device', font=fb, fill=INK)
cy = sy + 60
for ln in wrap(d, 'About Me answers, people, places, topics and their documents, Express Panel phrases, '
                  'settings and saved conversations. With each request for options, the app sends the AI '
                  'the conversation so far and the parts of this information that help. Nothing is kept on '
                  'a Volksswitch server, because there isn’t one.', fr, sw - 48):
    d.text((sx + 24, cy), ln, font=fr, fill=INK)
    cy += 32
if cy > sy + sh - 10:
    raise SystemExit('text overflows the storage box')

img.save(OUT)
print('wrote', OUT, img.size)
