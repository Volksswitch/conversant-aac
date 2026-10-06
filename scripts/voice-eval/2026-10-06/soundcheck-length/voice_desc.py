import glob, os, re, docx
root = r"C:\Users\ken\OneDrive\4 T-Z\Volksswitch\AI-driven AAC\Documents\Doc Backups"
files = sorted(glob.glob(os.path.join(root, "Worldview-Test-Persona-*.docx")))
latest = {}
for f in files:
    name = re.match(r".*Worldview-Test-Persona-(.+?) 2026", f).group(1)
    latest[name] = f  # sorted, so last wins
def all_paras(d):
    from docx.oxml.ns import qn
    body = d.element.body
    for p in body.iter(qn('w:p')):
        yield ''.join(t.text or '' for t in p.iter(qn('w:t')))
for name, f in latest.items():
    d = docx.Document(f)
    ps = list(all_paras(d))
    print("=====", name, os.path.basename(f))
    # quick read section
    i = next(k for k,p in enumerate(ps) if p.startswith('Who ') and 'quick read' in p)
    j = next(k for k in range(i+1, len(ps)) if ps[k].startswith('Tier A'))
    for p in ps[i+1:j]:
        if p.strip(): print("QR:", p)
    # B3 register / voice / style rows
    for k,p in enumerate(ps):
        if re.search(r'B3|Register|register|How .* talk|style|short|brief|terse|wordy|chatty|long', p) and k>j and len(p)<400:
            print(f"  [{k}] {p}")
