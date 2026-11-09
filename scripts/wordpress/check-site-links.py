"""Check that every link on volksswitch.org, and in the published documents, still works.

Trigger phrase: "check site links".

    python scripts/wordpress/check-site-links.py              # every published page and post
    python scripts/wordpress/check-site-links.py --conversant # only pages whose address says conversant

Reads every published page and post through the WordPress API and every hyperlink in
the documents listed in user-documents.json (the .docx files in Documents/), then
fetches each distinct address once. Written November 9 2026, when the video publisher
started deleting replaced files: a deletion that broke a link must be found by this,
not by a tester.

A link counts as working when the address answers with a page or a file (any status
below 400). Addresses on other sites that refuse automated checks (401, 403, 405, 429)
are listed separately, because the link may well work in a browser. Mail and phone
links, and links within a page (#...), are not fetched.
"""
import concurrent.futures as cf
import html
import json
import os
import re
import subprocess
import sys

from wp import ROOT, call

HERE = os.path.dirname(__file__)
SITE = 'https://volksswitch.org'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
LINK = re.compile(r'''(?:href|src)\s*=\s*["']([^"'#][^"']*)["']''', re.I)
REFUSES_ROBOTS = {401, 403, 405, 429}


def published(kind, conversant_only):
    out, page = [], 1
    while True:
        items = call('GET', f'/wp/v2/{kind}?per_page=100&page={page}&status=publish')
        for i in items:
            if conversant_only and 'conversant' not in i['link'].lower():
                continue
            out.append((i['link'], i['content']['rendered']))
        if len(items) < 100:
            break
        page += 1
    return out


def doc_links():
    """Hyperlinks in the published documents, from their .docx files."""
    import docx
    found = []
    for d in json.load(open(os.path.join(HERE, 'user-documents.json'), encoding='utf-8'))['documents']:
        path = os.path.join(ROOT, 'Documents', d['file'])
        if not os.path.exists(path):
            continue
        rels = docx.Document(path).part.rels.values()
        for r in rels:
            if r.reltype.endswith('/hyperlink') and r.is_external:
                found.append((d['title'], r.target_ref))
    return found


def normalize(url):
    url = html.unescape(url.strip())
    if url.startswith('//'):
        return 'https:' + url
    if url.startswith('/'):
        return SITE + url
    if re.match(r'^[a-z]+:', url, re.I):
        return url
    if re.match(r'^[\w.-]+\.(org|com|net|edu|gov)(/|$)', url, re.I):
        return 'https://' + url
    return None


def fetch(url):
    """Ask the way a browser does, through curl. Python's own requests were answered
    "not found" by WordPress's image service (i0.wp.com) for pictures curl and a browser
    receive fine, which reported 3,500 working links as broken on the first run
    (November 9 2026); the service appears to judge the connection, not the request.
    -r 0-0 asks for the first byte only, so a video is not downloaded to check it.
    One retry, because a busy server sometimes drops a request."""
    result = 'no answer'
    for _ in range(2):
        try:
            r = subprocess.run(['curl', '-s', '-o', os.devnull, '-L', '-r', '0-0', '-A', UA,
                                '--max-time', '25', '-w', '%{http_code}', url],
                               capture_output=True, text=True, timeout=40)
            code = int((r.stdout or '0').strip() or 0)
        except Exception as e:
            result = f'no answer ({type(e).__name__})'
            continue
        if code == 0:
            result = 'no answer'
            continue
        result = code
        if code not in (429, 500, 502, 503, 504):
            return result
    return result


def main():
    only = '--conversant' in sys.argv
    where = {}
    pages = published('pages', only) + published('posts', only)
    for link, content in pages:
        for raw in LINK.findall(content):
            url = normalize(raw)
            if url and url.startswith(('http://', 'https://')):
                where.setdefault(url, set()).add(link)
    for title, raw in doc_links():
        url = normalize(raw)
        if url and url.startswith(('http://', 'https://')):
            where.setdefault(url, set()).add(f'document: {title}')
    print(f'{len(pages)} pages and posts, {len(where)} distinct links.')

    with cf.ThreadPoolExecutor(6) as pool:
        status = dict(zip(where, pool.map(fetch, where)))

    broken = {u: s for u, s in status.items() if not (isinstance(s, int) and s < 400)}
    robots = {u: s for u, s in broken.items() if s in REFUSES_ROBOTS and not u.startswith(SITE)}
    for u in robots:
        broken.pop(u)
    if broken:
        print(f'\nBROKEN ({len(broken)}):')
        for u, s in sorted(broken.items()):
            print(f'  {s}  {u}')
            for w in sorted(where[u]):
                print(f'        on {w}')
    if robots:
        print(f'\nOther sites refused the checker; open these in a browser to be sure ({len(robots)}):')
        for u, s in sorted(robots.items()):
            print(f'  {s}  {u}   (on {", ".join(sorted(where[u]))})')
    if not broken:
        print('\nEvery link works.' + (' (Apart from the sites listed above.)' if robots else ''))
    sys.exit(1 if broken else 0)


if __name__ == '__main__':
    main()
