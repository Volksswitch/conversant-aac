"""Publish the user-facing documents to volksswitch.org - the last step of "sync docs".

    python scripts/wordpress/publish-documents.py            # show what would change
    python scripts/wordpress/publish-documents.py --apply    # do it

For every document in user-documents.json whose "Last updated" date differs from the
one already published (or that has never been published): export a fresh PDF through
Word, upload it into the "Conversant AAC > Documents" media folder, and point the page
at it. Then rebuild the page's two-column table (name linked to its PDF, date as it
appears in the document's byline) and save the page if it changed.

WHY CHANGE-DETECTION IS BY THE BYLINE DATE. The byline is updated on every sync, so an
unchanged date means an unchanged document. Re-uploading everything each time would
leave a new copy of every PDF in the media library per sync and change every link.

WHY OLD PDFS ARE NOT DELETED. The media library has no bin: deleting an attachment is
permanent, and permanent deletion is something this assistant does not do. Replaced
attachments are listed at the end so Ken can delete them in WordPress if he wants.

ORDER MATTERS, and it is chosen so a failure can never leave the page half-updated:
every upload happens first; the page is written once, at the end; the local list is
saved only after the page write succeeded.

Credentials: .wordpress-credentials at the project root (git-ignored).
"""
import base64, datetime, html, importlib.util, json, os, re, subprocess, sys, urllib.error, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LIST = os.path.join(os.path.dirname(__file__), 'user-documents.json')
DOCS = os.path.join(ROOT, 'Documents')
EXPORT = os.path.join(ROOT, 'scripts', 'doc-generators', 'export-pdf.ps1')

spec = importlib.util.spec_from_file_location('stamp', os.path.join(ROOT, 'scripts', 'doc-generators', 'stamp-doc-dates.py'))
stamp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stamp)

creds = json.load(open(os.path.join(ROOT, '.wordpress-credentials'), encoding='utf-8'))
API = creds['site'].rstrip('/')
AUTH = 'Basic ' + base64.b64encode(f"{creds['username']}:{creds['applicationPassword']}".encode()).decode()


def call(method, path, body=None, headers=None):
    # The host's firewall (Mod_Security) answers 406 to Python's default User-Agent.
    h = {'Authorization': AUTH, 'User-Agent': 'ConversantDocsPublisher/1.0'}
    if isinstance(body, (dict, list)):
        body = json.dumps(body).encode('utf-8')
        h['Content-Type'] = 'application/json'
    h.update(headers or {})
    req = urllib.request.Request(API + path, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise SystemExit(f'WordPress refused {method} {path}: {e.code} {e.read()[:300]!r}')


def long_date(d):
    return f'{d:%B} {d.day}, {d.year}'


def pdf_name(docx):
    stem = os.path.splitext(docx)[0]
    return re.sub(r'-+', '-', re.sub(r'[^A-Za-z0-9]+', '-', stem)).strip('-') + '.pdf'


def build_table(docs):
    rows = ''.join(
        f'<tr><td><a href="{html.escape(d["url"])}">{html.escape(d["title"])}</a></td>'
        f'<td>{long_date(datetime.date.fromisoformat(d["date"]))}</td></tr>'
        for d in docs)
    return ('<!-- wp:paragraph -->\n<p>These Conversant AAC documents are available as downloadable PDF files:</p>\n<!-- /wp:paragraph -->\n\n'
            '<!-- wp:table -->\n<figure class="wp-block-table"><table><thead><tr><th>Document</th><th>Last updated</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></figure>\n<!-- /wp:table -->')


def main():
    apply = '--apply' in sys.argv
    cfg = json.load(open(LIST, encoding='utf-8'))
    docs = cfg['documents']
    replaced, plan = [], []

    for d in docs:
        path = os.path.join(DOCS, d['file'])
        said = stamp.byline_date(path)
        if said is None:
            raise SystemExit(f'No "Last updated" date found in {d["file"]} - fix the byline first.')
        if d.get('mediaId') and d.get('date') == said.isoformat():
            continue
        plan.append((d, said, path))

    for d, said, _ in plan:
        print(f'  {"NEW" if not d.get("mediaId") else "UPDATE"}  {d["title"]}: {d.get("date")} -> {said}')

    if apply:
        for d, said, path in plan:
            r = subprocess.run(['powershell', '-ExecutionPolicy', 'Bypass', '-File', EXPORT, path], capture_output=True, text=True)
            print(r.stdout.rstrip())
            if r.returncode != 0:
                raise SystemExit(f'PDF export failed for {d["file"]}; nothing has been published.')
            pdf = os.path.splitext(path)[0] + '.pdf'
            with open(pdf, 'rb') as f:
                media = call('POST', '/wp/v2/media', f.read(), {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': f'attachment; filename="{pdf_name(d["file"])}"'})
            call('POST', f'/wp/v2/media/{media["id"]}', {
                'title': 'Conversant AAC ' + d['title'], 'media_folder': [cfg['mediaFolder']]})
            if d.get('mediaId'):
                replaced.append((d['title'], d['mediaId'], d['url']))
            d.update(date=said.isoformat(), mediaId=media['id'], url=media['source_url'])
            print(f'  UPLOADED {media["source_url"]}')

    page = call('GET', f'/wp/v2/pages?slug={cfg["page"]}&context=edit')[0]
    content = build_table(docs) if apply or not plan else None
    if content is None:
        print('Page not rebuilt in a dry run while documents are waiting to upload.')
    elif page['content']['raw'].strip() == content.strip():
        print('Page already up to date.')
    elif apply:
        call('POST', f'/wp/v2/pages/{page["id"]}', {'content': content})
        print(f'  PAGE UPDATED {page["link"]}')
    else:
        print('Page table would be rewritten. Run with --apply.')

    if apply:
        with open(LIST, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
            f.write('\n')
    for title, mid, url in replaced:
        print(f'  OLD COPY LEFT IN MEDIA LIBRARY: {title} (id {mid}) {url}')
    if not plan:
        print('No documents changed.')


main()
