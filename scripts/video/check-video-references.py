"""Check every place OUTSIDE the videos that points at them.

    python scripts/video/check-video-references.py            (also reads the live web pages)
    python scripts/video/check-video-references.py --offline  (files on this computer only)

The videos page, the watch pages, the companion pages and the course map are all
rebuilt from scripts/video/course.json, so they cannot go stale. Everything else
that names or links a video is written by hand, and this script checks it:

  - BETA-EMAILS.md, the master of the beta emails, and the Word copies made from it
  - the hand-edited pages on volksswitch.org (the Conversant home page and others)
  - every document in Documents/ (none links a video today; this keeps it so)

What it checks, for each link to a watch page:
  1. the page exists - the video is in course.json and has been published;
  2. the link's words, where they are a video title, are the title of THAT video;
  3. a sentence like "Watch the six Getting Started videos. Together they take
     about four minutes" still matches the videos linked beside it.
It also checks that the Word copies of the emails are newer than BETA-EMAILS.md,
that a quoted title in a sentence ("The "Adding Your AI Key" video") is a real
title, and that every published watch page is still in the course.

ERROR means a reader would be sent somewhere wrong or told something untrue.
CHECK means a person should read the sentence. The script changes nothing.
"""
import json, os, re, sys, urllib.request, zipfile, glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
COURSE = os.path.join(ROOT, 'scripts', 'video', 'course.json')
PUBLISHED = os.path.join(ROOT, 'scripts', 'wordpress', 'videos.json')
EMAILS_MD = os.path.join(ROOT, 'BETA-EMAILS.md')
EMAILS_DIR = os.path.join(ROOT, 'Other', 'Beta Testing', 'Emails')
DOCS_DIR = os.path.join(ROOT, 'Documents')
SITE = 'https://volksswitch.org/index.php/'
LIST_PAGE = SITE + 'conversant-videos/'
# Hand-edited pages on the site. The videos page and the watch pages are built
# from course.json and are not listed here.
WEB_PAGES = ['conversant', 'conversant-beta', 'beta-test-plan',
             'conversant-aac-known-issues', 'conversant-documents']

NUMBERS = {w: i for i, w in enumerate(
    'zero one two three four five six seven eight nine ten eleven twelve'.split())}

findings = []
def report(level, where, what):
    findings.append((level, where, what))


def norm(s):
    return re.sub(r'\s+', ' ', s.replace('“', '').replace('”', '').replace('"', '')).strip().lower()


def load():
    course = json.load(open(COURSE, encoding='utf-8'))
    items = [x for g in course['groups'] for x in g['items'] if x.get('id')]
    pub = json.load(open(PUBLISHED, encoding='utf-8')).get('videos', {})
    by_url = {}
    for x in items:
        rec = pub.get(x['id'])
        if rec and rec.get('page', {}).get('url'):
            by_url[rec['page']['url']] = dict(x, seconds=rec.get('seconds', 0))
    titles = {norm(x['title']) for x in items}
    # The choose-your-device page at a plain number (video-1-2) is a real page too;
    # a link to it is right when its words are that video's title.
    for num, rec in json.load(open(PUBLISHED, encoding='utf-8')).get('choosers', {}).items():
        first = next((x for x in items if x['num'] == num), None)
        if first and rec.get('url'):
            by_url[rec['url']] = dict(first, seconds=0, chooser=True)
    for vid in pub:
        if vid not in {x['id'] for x in items}:
            report('ERROR', 'website', f'the watch page for "{vid}" is still published but the video is no longer in the course; '
                   'point anything that links it elsewhere, then unpublish it in WordPress')
    return by_url, titles


def check_links(where, links, by_url, titles):
    """links: list of (text, url). Returns the videos linked, in order."""
    linked = []
    for text, url in links:
        if 'conversant-videos' not in url:
            continue
        u = url if url.endswith('/') else url + '/'
        if u == LIST_PAGE:
            continue
        x = by_url.get(u)
        if not x:
            report('ERROR', where, f'"{text}" links to {u}, which is not a published video')
            continue
        if not x.get('chooser'):
            linked.append(x)
        t = norm(text)
        if t in titles and t != norm(x['title']):
            report('ERROR', where, f'"{text}" links to video {x["num"]}, which is called "{x["title"]}"')
    return linked


def check_sentences(where, text, linked):
    """Counts and running times stated next to a list of links, and quoted titles."""
    m = re.search(r'the (\w+) Getting Started videos?', text, re.I)
    if m and linked:
        firsts = {x['num'] for x in linked if x['num'].startswith('1.')}
        said = NUMBERS.get(m.group(1).lower())
        if said is not None and said != len(firsts):
            report('ERROR', where, f'says "the {m.group(1)} Getting Started videos" but links {len(firsts)}')
        mins = re.search(r'about (\w+) minutes', text[m.start():m.start() + 300], re.I)
        if mins:
            seen, secs = set(), 0
            for x in linked:
                if x['num'].startswith('1.') and x['num'] not in seen:
                    seen.add(x['num']); secs += x['seconds']
            said_m = NUMBERS.get(mins.group(1).lower())
            real = secs / 60
            if said_m is not None and abs(said_m - real) >= 1:
                report('CHECK', where, f'says the videos take "about {mins.group(1)} minutes"; they add up to {real:.1f} minutes')
    for q in re.findall(r'[Tt]he ["“]([^"”]+)["”] video', text):
        if norm(q) not in TITLES:
            report('ERROR', where, f'names a video "{q}", and no video has that title')


def md_sections():
    text = open(EMAILS_MD, encoding='utf-8').read()
    parts = re.split(r'^## ', text, flags=re.M)[1:]
    for p in parts:
        name = p.splitlines()[0].strip()
        yield name, p


def docx_links(path):
    z = zipfile.ZipFile(path)
    rels = z.read('word/_rels/document.xml.rels').decode('utf-8', 'ignore')
    rmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    rmap.update({a: b for b, a in re.findall(r'Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})
    doc = z.read('word/document.xml').decode('utf-8', 'ignore')
    links = []
    for rid, inner in re.findall(r'<w:hyperlink[^>]*r:id="([^"]+)"[^>]*>(.*?)</w:hyperlink>', doc, re.S):
        links.append((''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', inner)), rmap.get(rid, '')))
    plain = ' '.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', doc))
    return links, plain


def fetch(slug):
    req = urllib.request.Request(SITE + slug + '/', headers={'User-Agent': 'Mozilla/5.0 Conversant-check'})
    body = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
    i = body.find('entry-content')
    return body[i:] if i > 0 else body


def main():
    global TITLES
    offline = '--offline' in sys.argv
    by_url, TITLES = load()

    # 1. The master of the emails.
    for name, sec in md_sections():
        where = f'BETA-EMAILS.md, email {name}'
        links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', sec)
        linked = check_links(where, links, by_url, TITLES)
        check_sentences(where, re.sub(r'\s+', ' ', sec), linked)

    # 2. The Word copies: they must be made after the master was last changed.
    md_time = os.path.getmtime(EMAILS_MD)
    for f in sorted(glob.glob(os.path.join(EMAILS_DIR, '*.docx'))):
        if os.path.basename(f).startswith('~$'):
            continue
        where = os.path.relpath(f, ROOT)
        if os.path.getmtime(f) < md_time - 2:
            report('ERROR', where, 'is older than BETA-EMAILS.md; run python scripts/make-beta-emails.py')
        try:
            links, plain = docx_links(f)
        except OSError:
            report('CHECK', where, 'could not be read (open in Word?); close it and run this again')
            continue
        check_links(where, links, by_url, TITLES)

    # 3. Documents: none links a video today, and a new link should be checked like the rest.
    for f in sorted(glob.glob(os.path.join(DOCS_DIR, '*.docx'))):
        if os.path.basename(f).startswith('~$'):
            continue
        try:
            links, plain = docx_links(f)
        except (OSError, KeyError, zipfile.BadZipFile):
            continue
        where = os.path.relpath(f, ROOT)
        linked = check_links(where, links, by_url, TITLES)
        if linked:
            check_sentences(where, plain, linked)

    # 4. The hand-edited web pages.
    if not offline:
        for slug in WEB_PAGES:
            where = f'web page {SITE}{slug}/'
            try:
                body = fetch(slug)
            except Exception as e:
                report('CHECK', where, f'could not be read ({e})')
                continue
            links = [(re.sub(r'<[^>]+>', '', t), u) for u, t in
                     re.findall(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', body, re.S)]
            linked = check_links(where, links, by_url, TITLES)
            check_sentences(where, re.sub(r'<[^>]+>', ' ', body), linked)

    errors = [f for f in findings if f[0] == 'ERROR']
    if not findings:
        print('Every link to a video, and every sentence about them, matches the course.')
    for level, where, what in findings:
        print(f'{level:5}  {where}\n       {what}')
    sys.exit(1 if errors else 0)


TITLES = set()
if __name__ == '__main__':
    main()
