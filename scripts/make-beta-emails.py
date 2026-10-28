"""Make the Outlook copies of the beta emails from BETA-EMAILS.md.

    python scripts/make-beta-emails.py

BETA-EMAILS.md is the master; this rewrites every .msg in Other/Beta Testing/Emails.
Each "## <id>. <name>" section becomes one unsent Outlook message: the subject line
goes in the subject, the quoted lines become the body. The when/to notes above the
quote are for Ken and are not put in the message. Markdown handled: **bold**,
*italic*, [text](url) as a clickable link, and "1. " numbered items, with indented
paragraphs kept under their numbered step.

The body uses the layout Ken settled on in the first real welcome email (October
28 2026): Arial 11pt, 1.15 line spacing, 10pt after each paragraph, keys and
tester names in bold indented under their step. Welcome emails carry the Beta
Tester Responsibilities PDF from Documents/ as an attachment.

The messages are made by classic Outlook through scripts/make-outlook-messages.ps1,
so this only runs on a Windows machine with Outlook installed.
"""
import html, json, os, re, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'BETA-EMAILS.md')
OUT = os.path.join(ROOT, 'Other', 'Beta Testing', 'Emails')
PS = os.path.join(ROOT, 'scripts', 'make-outlook-messages.ps1')
ATTACH = os.path.join(ROOT, 'Documents', 'Conversant AAC Beta Tester Responsibilities.pdf')

TOKEN = re.compile(r'(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))')
FONT = 'font-family:Arial,sans-serif;font-size:11.0pt;line-height:115%'
P = f'margin:0 0 10.0pt 0;{FONT}'
STEP_P = f'margin:0 0 10.0pt 0;{FONT}'
UNDER_P = f'margin:0 0 10.0pt .25in;{FONT}'


def inline(s):
    out = []
    for part in TOKEN.split(s):
        if not part:
            continue
        m = re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', part)
        if m:
            out.append(f'<a href="{html.escape(m.group(2))}"><span style="color:#0563C1">'
                       f'{html.escape(m.group(1))}</span></a>')
        elif part.startswith('**'):
            out.append(f'<b>{html.escape(part[2:-2])}</b>')
        elif part.startswith('*'):
            out.append(f'<i>{html.escape(part[1:-1])}</i>')
        else:
            out.append(html.escape(part))
    return ''.join(out)


def blocks(body):
    """Split the quoted email into (kind, text) blocks: 'p', 'step' or 'under'."""
    out, buf, kind = [], [], None

    def flush():
        nonlocal buf, kind
        if buf:
            text = ' '.join(buf)
            if kind == 'step':
                text = re.sub(r'^\d+\.\s+', '', text)
            out.append((kind or 'p', text))
        buf, kind = [], None

    for raw in body:
        ln = raw.strip()
        if not ln:
            flush(); continue
        if re.match(r'\d+\. ', ln):
            flush(); kind = 'step'; buf = [ln]
        elif buf and buf[-1].endswith(',') and len(buf[-1]) < 40 and kind is None:
            # a sign-off ("Thanks again," / "Ken") stays one paragraph, on two lines
            buf[-1] += '\n'; buf.append(ln)
        elif buf:
            buf.append(ln)
        else:
            buf = [ln]; kind = 'under' if raw.startswith('   ') else None
    flush()
    return out


def render(body):
    parts, in_list = [], False
    for kind, text in blocks(body):
        h = inline(text).replace('\n ', '<br>')
        if kind == 'step':
            if not in_list:
                parts.append('<ol style="margin-top:0;margin-bottom:0">'); in_list = True
            else:
                parts.append('</li>')
            parts.append(f'<li style="{FONT}"><p style="{STEP_P}">{h}</p>')
        elif kind == 'under' and in_list:
            parts.append(f'<p style="{UNDER_P}">{h}</p>')
        else:
            if in_list:
                parts.append('</li></ol>'); in_list = False
            parts.append(f'<p style="{P}">{h}</p>')
    if in_list:
        parts.append('</li></ol>')
    return '<html><body>' + ''.join(parts) + '</body></html>'


def message(num, title, lines):
    body = [ln[2:] if ln.startswith('> ') else ln[1:] for ln in lines if ln.startswith('>')]
    subject = ''
    if body and body[0].startswith('Subject:'):
        subject = body[0][len('Subject:'):].strip()
        body = body[1:]
    return {
        'path': os.path.join(OUT, f'Beta email {num} - {title}.msg'),
        'subject': subject,
        'html': render(body),
        'attach': ATTACH if num.startswith('1') else '',
    }


def variant(lines, helper):
    """The lines of one welcome email for a tester with or without a copied helper.

    A quoted paragraph whose first line starts with {helper} appears only in the
    helper version; {to-helper} in the notes becomes the matching address note."""
    out, skipping = [], False
    for ln in lines:
        ln = ln.replace('{to-helper}', ', and copy their helper' if helper else ' only')
        if ln.startswith('> {helper}'):
            if helper:
                ln = '> ' + ln[len('> {helper}'):]
            else:
                skipping = True
        if skipping:
            if ln.strip() == '>':
                skipping = False
            continue
        out.append(ln)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    if not os.path.exists(ATTACH):
        sys.exit(f'Missing attachment: {ATTACH}')
    text = open(SRC, encoding='utf-8').read()
    msgs = []
    for sec in re.split(r'^## ', text, flags=re.M)[1:]:
        head, *lines = sec.splitlines()
        m = re.match(r'(\d+[a-z]?)\. (.+)', head)
        if not m or not any(l.startswith('>') for l in lines):
            continue
        title = m.group(2).replace(' - ', ', ').replace('The kind decline', 'Decline')
        if '{helper}' in sec:
            msgs.append(message(m.group(1), title + ', with helper', variant(lines, True)))
            msgs.append(message(m.group(1), title + ', no helper', variant(lines, False)))
        else:
            msgs.append(message(m.group(1), title, lines))

    for old in os.listdir(OUT):
        if old.startswith('Beta email ') and old.endswith(('.docx', '.msg')):
            try:
                os.remove(os.path.join(OUT, old))
            except PermissionError:
                sys.exit(f'Could not remove "{old}" - it is open, probably in Outlook or Word. '
                         'Close it and run this again.')

    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(msgs, f)
        manifest = f.name
    try:
        subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass',
                        '-File', PS, manifest], check=True)
    finally:
        os.remove(manifest)


main()
