"""Builds Videos/Screenshots to Take.docx: the screens Ken captures on his iPad and
Android devices for the by-hand "Getting started" videos, with real screenshots
of the same moments on a computer to match.

    python scripts/video/make-screenshot-guide.py

The computer pictures come from scripts/video/capture-computer-samples.mjs.
"""
import datetime, os
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PICS = os.path.join(ROOT, 'Videos', 'screenshot-samples')
OUT = os.path.join(ROOT, 'Videos', 'Screenshots to Take.docx')
TODAY = datetime.date.today()
LONG = f'{TODAY:%B} {TODAY.day}, {TODAY.year}'

doc = Document()
st = doc.styles['Normal']
st.font.name = 'Arial'
st.font.size = Pt(11)
st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Arial')
for s in ('Title', 'Heading 1', 'Heading 2', 'Heading 3'):
    doc.styles[s].font.name = 'Arial'
    doc.styles[s].font.color.rgb = RGBColor(0x24, 0x3B, 0x53)
sec = doc.sections[0]
sec.left_margin = sec.right_margin = Inches(0.9)


def field(run, code):
    for kind, text in (('begin', None), (None, code), ('separate', None), ('end', None)):
        if kind:
            el = OxmlElement('w:fldChar'); el.set(qn('w:fldCharType'), kind); run._r.append(el)
        else:
            el = OxmlElement('w:instrText'); el.set(qn('xml:space'), 'preserve'); el.text = text; run._r.append(el)


foot = sec.footer.paragraphs[0]
foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
foot.add_run(f'Volksswitch.org | {TODAY:%B %Y} | For internal use | Page ')
field(foot.add_run(), 'PAGE')
foot.add_run(' of ')
field(foot.add_run(), 'NUMPAGES')
for r in foot.runs:
    r.font.size = Pt(9)


def para(text, bold_lead=None, style=None):
    p = doc.add_paragraph(style=style)
    if bold_lead:
        p.add_run(bold_lead).bold = True
    p.add_run(text)
    return p


def picture(name, caption):
    path = os.path.join(PICS, name + '.png')
    if not os.path.exists(path):
        raise SystemExit(f'Missing picture {name}.png - run capture-computer-samples.mjs first.')
    doc.add_picture(path, width=Inches(5.6))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    c = doc.add_paragraph(caption)
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in c.runs:
        r.italic = True
        r.font.size = Pt(9.5)


def step(n, text, note=None):
    # Numbered by hand, so each list starts at 1 (Word's shared list numbering
    # carried on from one list to the next).
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.35)
    p.paragraph_format.first_line_indent = Inches(-0.25)
    p.paragraph_format.space_after = Pt(3)
    p.add_run(f'{n}.	' + text)
    p.paragraph_format.tab_stops.add_tab_stop(Inches(0.35))
    if note:
        p.add_run(' ' + note).italic = True


doc.add_heading('Screenshots to Take', level=0)
by = doc.add_paragraph(f'Kenneth R. Hackbarth | Volksswitch.org | October 2026 | Last updated {LONG}')
by.runs[0].font.size = Pt(10)

doc.add_heading('What these are for', level=1)
para("These screens are outside Conversant: the browser, the device's Home Screen, and the file pickers. "
     "The video program can't capture them on an iPad or an Android device, so you take them and the program "
     "adds the narration, the voices and the orange rings.")
para("Each step below has a real screenshot of the same moment, taken on a computer. Use it as the target: "
     "the same moment, the same amount of the screen, nothing else in view. The iPad and Android screens "
     "will look different in their details, and that's fine.")

doc.add_heading('How to take them', level=1)
for lead, text in [
    ('One screenshot per screen, ', 'in the order listed. If a new user would see an extra screen in between, take that one too.'),
    ("Don't crop or mark them up. ", 'The program adds the rings.'),
    ('Keep private things out. ', 'Check for your email address, notifications from other apps, and your own file and folder names. '
     'Use a plain wallpaper if you can. In a file picker, start in an empty place, such as a new folder.'),
    ('Name them in order ', '(01.png, 02.png and so on) and put them in the folder named under each heading, inside Videos\\screenshots.'),
    ('Add a line for each one ', 'to a notes.txt file in the same folder, saying what you tapped next. That tells the program where to put the ring.'),
]:
    para(text, bold_lead=lead, style='List Bullet')

doc.add_heading('1.2 Installing Conversant', level=1)
doc.add_heading('The computer pictures, to match', level=2)
picture('1.2-computer-01-site-open', 'Figure 1. The site open in Chrome. The Install button is at the right end of the address bar.')
picture('1.2-computer-03-install-box', 'Figure 2. Chrome asks whether to install Conversant.')
picture('1.2-computer-04-own-window', 'Figure 3. Conversant open in its own window, with no address bar.')
para("Not captured on the computer: Conversant's icon in the Start menu or on the taskbar. "
     "That needs a click in Windows itself, which the program doesn't make. You can take it, or skip it.")

doc.add_heading('On an iPad (Safari): folder 1.2-ipad', level=2)
step(1, 'conversant.volksswitch.org open in Safari, before installing.', '(Compare Figure 1.)')
step(2, 'The Share button tapped, with its menu showing "Add to Home Screen."', '(Compare the Install button in Figure 1.)')
step(3, 'The "Add to Home Screen" screen, with the name filled in.', '(Compare Figure 2.)')
step(4, 'The Home Screen with the Conversant icon on it.')
step(5, 'Conversant open from that icon, filling the screen.', '(Compare Figure 3.)')

doc.add_heading('On an Android device (Chrome): folder 1.2-android', level=2)
step(1, 'conversant.volksswitch.org open in Chrome.', '(Compare Figure 1.)')
step(2, 'The Chrome menu open, showing "Install app" or "Add to Home screen."')
step(3, 'The box asking whether to install.', '(Compare Figure 2.)')
step(4, 'The home screen with the Conversant icon on it.')
step(5, 'Conversant open from that icon.', '(Compare Figure 3.)')

doc.add_heading('1.4 Keeping your information safe', level=1)
para('The parts inside Conversant (Settings, the Data Folder section, the Backup button) are made by the program. '
     'Only the screens in between are needed from you. On a computer, these come before them:')
doc.add_heading('The computer pictures, to match', level=2)
picture('1.4-computer-00-choose-folder-button', 'Figure 4. Settings, General, Data Folder, with the Choose Folder button.')
picture('1.4-computer-01-before-you-choose', 'Figure 5. Conversant explains what the folder holds, then "Choose a folder" opens the picker.')
picture('1.4-computer-02-folder-picker', "Figure 6. The Windows folder picker. Everything but its title is blurred here, because it showed the computer's own folder names.")
para('Not captured on the computer: a new folder made and selected, and the browser asking to let Conversant use it. '
     'Those need clicks in the picker and in Chrome itself, which the program does not make.')

doc.add_heading('On an Android device: folder 1.4-android', level=2)
step(1, 'The Android folder picker that opens after tapping "Choose a folder."', '(Compare Figure 6.)')
step(2, 'A new folder made and selected, before confirming. Name it something like "Conversant data."')
step(3, "Android's question asking to let Chrome use the folder, and the button you tapped.")
step(4, "The question Android asks again the next time Conversant opens. It asks every time on Android.")

doc.add_heading('On an iPad: folder 1.4-ipad', level=2)
step(1, 'The box that opens after tapping "Backup settings," asking whether to download the backup file.')
step(2, 'The file in the Files app, showing where it went.')

doc.add_heading('Not needed', level=1)
para('Videos 1.1, 1.3 and 1.5 happen entirely inside Conversant, so the program makes them without screenshots.')

doc.save(OUT)
print(os.path.relpath(OUT, ROOT))
