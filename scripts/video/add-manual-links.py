"""Keep the how-to video links in the three User Manuals in step with the course.

    python scripts/video/add-manual-links.py           (shows what it would change)
    python scripts/video/add-manual-links.py --apply   (backs each manual up, then changes it)

Each manual carries a "Video:" line at the end of every section a video covers, and a
"Videos:" line in the Introduction linking the whole list (Ken, October 25 2026). MAP
below says which section gets which video. Run this after a video is added (put it in
MAP first) or renamed: it adds any link that is missing and puts the current title on
every link it finds, so a renamed video does not keep its old name in the manuals.

A link already in a manual is never added twice. A manual with tracked changes or
comments is left alone, because it is still under review. check-video-references.py
reports a manual link whose words are not its video's title.
"""
import datetime
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'doc-generators'))
import docx_safe as D                                     # noqa: E402
from docx.oxml.ns import qn                               # noqa: E402
from docx.text.paragraph import Paragraph                 # noqa: E402

course = json.load(open(os.path.join(ROOT, 'scripts', 'video', 'course.json'), encoding='utf-8'))
published = json.load(open(os.path.join(ROOT, 'scripts', 'wordpress', 'videos.json'),
                           encoding='utf-8'))['videos']
TITLE = {i['id']: i['title'] for g in course['groups'] for i in g['items'] if i.get('id')}
ALL_URL = 'https://volksswitch.org/index.php/conversant-videos/'
BACKUPS = os.path.join(ROOT, 'Documents', 'Doc Backups')

# Section heading (as it starts) -> videos, in the order they are listed. 'DEV' becomes
# the manual's own device version; 'ALL' is the link to the whole list.
MAP = [
    ('1.  Introduction', ['1.1-what-for', 'ALL']),
    ('2.4  ', ['1.5-speech-service', '1.6-deepgram']),
    ('3.1  Opening the App', ['1.2-install-DEV']),
    ('3.2  Entering Your API Key', ['1.3-ai-key']),
    ('4.  Your First Conversation', ['2.1-screen-tour', '2.3-first-conversation']),
    ('4.1  Starting a Conversation', ['2.6-start-and-end']),
    ('4.4  In My Own Words', ['2.5-own-words']),
    ('4.5  Keeping a Conversation Private', ['5.3-private']),
    ('4.7  When the Response Options Change', ['2.4-hears-wrong', '2.7-buying-time']),
    ('5.1  Opening About Me', ['3.1-about-me']),
    ('5.2  ', ['1.4-safe-DEV']),
    ('5.4  Adding People to Your Life', ['3.2-people']),
    ('5.5  Adding the Places You Go', ['3.3-places']),
    ('5.7  Setting Goals for Your Conversations', ['3.4-goals']),
    ('6.1  General Tab', ['4.3-one-tap-or-two', '5.2-backups']),
    ('6.2  Text & Color Tab', ['4.4-text-and-colors']),
    ('6.3  Speech Tab', ['3.8-your-voice']),
    ('6.4\tScreen Layout Tab', ['4.2-screen-layout', '4.1-bigger-buttons']),
    ('6.5  Conversation Tab', ['4.7-short-wording', '4.5-timing']),
    ('6.7  Practice Tab', ['2.2-practice']),
    ('6.8  Conversation Review Tab', ['3.10-looking-back']),
    ('6.9  Commands Tab', ['3.9-openers-goodbyes']),
    ('6.10  Keyguard Design Tab', ['4.6-keyguards']),
    ('6.11  Troubleshooting Tab', ['5.1-report-problem', '1.7-tester-name']),
    ('7.1  What Is on the Panel', ['3.6-panel-groups', '3.7-who-where-feel']),
    ('7.3  Setting Up the Express Panel', ['3.5-change-button']),
]

# Manual -> its device versions, and videos that do not belong in it. The Deepgram
# video is about hearing the other person on an iPad or Android, which a computer
# does for free.
MANUALS = [
    ('User Manual (Windows Chromebook Mac)', 'computer', ('1.6-deepgram',)),
    ('User Manual (iPad)', 'ipad', ()),
    ('User Manual (Android)', 'android', ()),
]


def is_heading(el):
    if el.tag != qn('w:p'):
        return False
    ppr = el.find(qn('w:pPr'))
    st = ppr.find(qn('w:pStyle')) if ppr is not None else None
    return st is not None and st.get(qn('w:val'), '').lower().startswith('heading')


def text_of(el, doc):
    return Paragraph(el, doc).text if el.tag == qn('w:p') else ''


def under_review(doc):
    body = doc.element.body
    for tag in ('w:ins', 'w:del', 'w:commentRangeStart', 'w:commentReference'):
        if next(body.iter(qn(tag)), None) is not None:
            return True
    return False


def wanted(device, skip):
    """(heading, url, lead, words) for every link this manual should carry."""
    out = []
    for heading, vids in MAP:
        for v in vids:
            if v in skip:
                continue
            if v == 'ALL':
                out.append((heading, ALL_URL, 'Videos:  ', 'Every how-to video, in order'))
                continue
            vid = v.replace('DEV', device)
            if vid not in TITLE:
                raise LookupError('%s is in MAP but not in course.json' % vid)
            if vid not in published:
                raise LookupError('%s has no published watch page yet; publish it first' % vid)
            out.append((heading, published[vid]['page']['url'], 'Video:  ', TITLE[vid]))
    return out


def fix_words(doc, words_for):
    """Put the current title on every link to a watch page. Returns how many changed."""
    changed = 0
    rels = doc.part.rels
    for link in doc.element.body.iter(qn('w:hyperlink')):
        rid = link.get(qn('r:id'))
        if rid not in rels or not rels[rid].is_external:
            continue
        words = words_for.get(rels[rid].target_ref)
        if words is None:
            continue
        runs = link.findall(qn('w:r'))
        if not runs or ''.join(t.text or '' for t in link.iter(qn('w:t'))) == words:
            continue
        D._set_run_text(runs[0], words)
        for extra in runs[1:]:
            link.remove(extra)
        changed += 1
    return changed


def run(name, device, skip, apply):
    path = os.path.join(ROOT, 'Documents', 'Conversant AAC %s.docx' % name)
    doc = D.open_doc(path)
    if under_review(doc):
        print('%-38s SKIPPED: it has tracked changes or comments' % name)
        return
    links = wanted(device, skip)
    renamed = fix_words(doc, {url: words for _h, url, _l, words in links})
    have = {r.target_ref for r in doc.part.rels.values() if r.is_external}
    body = list(doc.element.body.iterchildren())
    template = next((el for el in body if el.tag == qn('w:p')
                     and text_of(el, doc).startswith(('Video:', 'Note:'))
                     and Paragraph(el, doc).runs and Paragraph(el, doc).runs[0].bold), None)
    if template is None:
        raise LookupError('%s: no bold "Note:" paragraph to copy the look from' % name)
    added = []
    for heading, url, lead, words in links:
        if url in have:
            continue
        body = list(doc.element.body.iterchildren())
        starts = [i for i, el in enumerate(body) if is_heading(el) and text_of(el, doc).startswith(heading)]
        if len(starts) != 1:
            raise LookupError('%s: %d headings start with %r' % (name, len(starts), heading))
        nxt = next(i for i in range(starts[0] + 1, len(body)) if is_heading(body[i]))
        before = body[nxt]
        prev = body[nxt - 1]
        if (prev.tag == qn('w:p') and not text_of(prev, doc).strip()
                and prev.find('.//' + qn('w:drawing')) is None):
            before = prev                         # keep the blank line above the next heading
        D.insert_link_para_before(doc, before, template, lead, words, url)
        have.add(url)
        added.append(words)
    print('%-38s %d to add, %d to rename' % (name, len(added), renamed))
    for w in added:
        print('    add: ' + w)
    if not apply or not (added or renamed):
        return
    stamp = datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')
    shutil.copy2(path, os.path.join(BACKUPS, 'Conversant AAC %s %s.docx' % (name, stamp)))
    D.save(doc, path)
    print('    saved (backup taken first)')


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    for name, device, skip in MANUALS:
        run(name, device, skip, apply)
    if not apply:
        print('Nothing changed. Run with --apply to make these changes.')
