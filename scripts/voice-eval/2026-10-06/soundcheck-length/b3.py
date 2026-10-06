import glob, os, re, docx, sys
sys.stdout.reconfigure(encoding='utf-8')
from docx.oxml.ns import qn
root = r"C:\Users\ken\OneDrive\4 T-Z\Volksswitch\AI-driven AAC\Documents\Doc Backups"
latest = {}
for f in sorted(glob.glob(os.path.join(root, "Worldview-Test-Persona-*.docx"))):
    latest[re.match(r".*Worldview-Test-Persona-(.+?) 2026", f).group(1)] = f
for name, f in latest.items():
    d = docx.Document(f)
    ps = [''.join(t.text or '' for t in p.iter(qn('w:t'))) for p in d.element.body.iter(qn('w:p'))]
    i = next(k for k,p in enumerate(ps) if p.startswith('B3'))
    print("=====", name)
    for p in ps[i:i+16]:
        if p.strip(): print("  ", p)
