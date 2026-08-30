"""Reading a .docx into something the rules can ask questions of.

⚠ TWO THINGS THIS GETS RIGHT THAT ARE EASY TO GET WRONG, both learned the hard way
in this project (see CLAUDE.md, "sync docs"):

  1. WALK THE XML, NOT python-docx's `document.paragraphs` - that skips paragraphs
     inside tables, and the two iterations disagree by hundreds on the manuals (589 vs
     358). Every index a rule reports has to mean the same thing as every other, so
     there is ONE walk and everything is numbered by it.

  2. RECORD THE CONTAINER. A paragraph's parent decides whether a rule applies to it:
     prose spacing differs from list spacing differs from cell spacing, and a paragraph
     that has strayed into the table-of-contents block is a fault all of its own (that
     one shipped in both manuals for three days because nothing looked at containers).
"""
import zipfile
from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


class Para:
    __slots__ = ('i', 'style', 'text', 'container', 'keep_next', 'before', 'after',
                 'num_id', 'ilvl', 'aligned', 'has_drawing', 'table_index')

    def __init__(self, **kw):
        for k in self.__slots__:
            setattr(self, k, kw.get(k))

    @property
    def blank(self):
        return not (self.text or '').strip()

    @property
    def is_heading(self):
        return (self.style or '').startswith('Heading')

    @property
    def in_table(self):
        return self.container == 'tc'

    @property
    def numbered(self):
        return self.num_id is not None


def _twips(pPr, name):
    if pPr is None:
        return None
    sp = pPr.find(W + 'spacing')
    if sp is None:
        return None
    v = sp.get(W + name)
    return int(v) if v is not None and v.lstrip('-').isdigit() else None


class Doc:
    def __init__(self, path):
        self.path = path
        self.zip = zipfile.ZipFile(path)
        self.root = etree.fromstring(self.zip.read('word/document.xml'))
        self.body = self.root.find(W + 'body')
        self.paras = []
        self.tables = []
        self._walk(self.body, container='body', table_index=None)
        self.text = '\n'.join(p.text for p in self.paras)

    @property
    def bullet_nums(self):
        """numIds that draw a BULLET rather than a number.

        ⚠ A bulleted sub-list inside a numbered list is legitimate and common - the
        four color explanations under step 3 of Practice Exchange 1 are exactly that.
        It is a different numbering by construction, so a rule that only counts
        numberings reports a real document as broken. Bullets count nothing, so they
        can never make a numbered list skip.
        """
        if getattr(self, '_bullets', None) is None:
            self._bullets = set()
            try:
                root = etree.fromstring(self.zip.read('word/numbering.xml'))
            except KeyError:
                return self._bullets
            fmt = {}
            for a in root.findall(W + 'abstractNum'):
                lvl = a.find(W + 'lvl')
                f = lvl.find(W + 'numFmt') if lvl is not None else None
                fmt[a.get(W + 'abstractNumId')] = f.get(W + 'val') if f is not None else None
            for n in root.findall(W + 'num'):
                aid = n.find(W + 'abstractNumId')
                if aid is not None and fmt.get(aid.get(W + 'val')) == 'bullet':
                    self._bullets.add(n.get(W + 'numId'))
        return self._bullets

    def part(self, name):
        try:
            return self.zip.read(name).decode('utf-8', 'replace')
        except KeyError:
            return ''

    @property
    def footers(self):
        return '\n'.join(self.part(n) for n in self.zip.namelist()
                         if n.startswith('word/footer'))

    def _walk(self, node, container, table_index):
        for ch in node:
            tag = ch.tag
            if tag == W + 'p':
                pPr = ch.find(W + 'pPr')
                style = ''
                num_id = ilvl = None
                keep = False
                aligned = None
                if pPr is not None:
                    st = pPr.find(W + 'pStyle')
                    style = st.get(W + 'val') if st is not None else ''
                    keep = pPr.find(W + 'keepNext') is not None
                    jc = pPr.find(W + 'jc')
                    aligned = jc.get(W + 'val') if jc is not None else None
                    np = pPr.find(W + 'numPr')
                    if np is not None:
                        n = np.find(W + 'numId')
                        lv = np.find(W + 'ilvl')
                        num_id = n.get(W + 'val') if n is not None else None
                        ilvl = lv.get(W + 'val') if lv is not None else '0'
                self.paras.append(Para(
                    i=len(self.paras), style=style, container=container,
                    text=''.join(t.text or '' for t in ch.iter(W + 't')),
                    keep_next=keep, before=_twips(pPr, 'before'), after=_twips(pPr, 'after'),
                    num_id=num_id, ilvl=ilvl, aligned=aligned,
                    has_drawing=ch.find('.//' + W.replace('wordprocessingml/2006/main',
                                                          'drawingml/2006/wordprocessingDrawing') + 'anchor') is not None
                                or ch.find('.//{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}inline') is not None,
                    table_index=table_index))
            elif tag == W + 'tbl':
                idx = len(self.tables)
                self.tables.append(ch)
                self._walk(ch, container='tbl', table_index=idx)
            elif tag == W + 'tr':
                self._walk(ch, container='tr', table_index=table_index)
            elif tag == W + 'tc':
                self._walk(ch, container='tc', table_index=table_index)
            elif tag == W + 'sdt':
                self._walk(ch, container='sdt', table_index=table_index)
            elif tag == W + 'sdtContent':
                self._walk(ch, container=container, table_index=table_index)
