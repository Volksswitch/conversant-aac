"""Rewrite the text of ONE RUN inside a paragraph, leaving every other run alone.

  python set-run-text.py "<file.docx>" ops.json
  ops.json: [{"i": <paragraph index>, "run": <run index>, "text": "..."},
             {"i": <paragraph index>, "run": <run index>, "drop": true}]

⚠ WHY NOT edit-docx.py's "set". That collapses a paragraph to a single run, which is
right for plain prose and WRONG for anything whose formatting varies inside the
paragraph. The manual's Notes and Tips are bold label + italic body, enforced by
documentation rule S10, so rewriting one through "set" would silently make the whole
note bold and fail the check that was added to stop exactly that drift.

Paragraph indices are in the same basis as edit-docx.py: root.iter(w:p), which includes
paragraphs inside tables.
"""
import sys, json, os
from docx import Document

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
XS = '{http://www.w3.org/XML/1998/namespace}space'

doc = Document(sys.argv[1])
ops = json.load(open(sys.argv[2], encoding='utf8'))
ps = list(doc.element.iter(W + 'p'))
# Apply high indices first so dropping a run cannot shift a later op in the same paragraph.
for op in sorted(ops, key=lambda o: (-o['i'], -o.get('run', 0))):
    runs = ps[op['i']].findall(W + 'r')
    r = runs[op['run']]
    if op.get('drop'):
        r.getparent().remove(r)
        print('  dropped run %d of paragraph %d' % (op['run'], op['i']))
        continue
    ts = r.findall(W + 't')
    for extra in ts[1:]:
        r.remove(extra)
    t = ts[0] if ts else None
    if t is None:
        raise SystemExit('run %d of paragraph %d has no text node' % (op['run'], op['i']))
    t.text = op['text']
    t.set(XS, 'preserve')
    print('  set run %d of paragraph %d' % (op['run'], op['i']))
doc.save(sys.argv[1])
print('%d edit(s) -> %s' % (len(ops), os.path.basename(sys.argv[1])))
