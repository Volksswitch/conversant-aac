import sys
sys.path.insert(0, 'scripts/doc-tests')
from docx_model import Doc
d = Doc(sys.argv[1])
want = set()
for a in sys.argv[2:]:
    if '-' in a:
        lo, hi = a.split('-'); want.update(range(int(lo), int(hi)+1))
    else: want.add(int(a))
for p in d.paras:
    if p.i in want and (p.text or '').strip():
        print('%4d %-4s %s\n' % (p.i, p.container, p.text))
