"""Delete replaced document PDFs from the volksswitch.org media library, safely.

Ken, November 8 2026: old copies are deleted as part of "sync docs" ("These documents
can always be regenerated from their backup equivalents"). publish-documents.py calls
delete_old() after the documents page has been rewritten to point at the new copies.

    python scripts/wordpress/old_copies.py <media id> [<media id> ...]    # show what would go
    python scripts/wordpress/old_copies.py --apply <media id> [...]        # delete them

SAFETY, because deleting media is permanent (the media library has no bin):
  - Never delete a file the documents list (user-documents.json) still points at.
  - Never delete a file any page or post on the site still links to. Every page and
    post is read in full and searched for the file's address; one hit and that file is
    kept and named, so a link elsewhere on the site never breaks silently.
  - Only PDFs are deleted. Anything else is refused.
"""
import json, os, sys

from wp import call

LIST = os.path.join(os.path.dirname(__file__), 'user-documents.json')


def _all_content():
    """Every page and post's raw content (drafts and private ones too)."""
    texts = []
    for kind in ('pages', 'posts'):
        page = 1
        while True:
            items = call('GET', f'/wp/v2/{kind}?per_page=100&page={page}&context=edit'
                         '&status=publish,draft,private,pending,future')
            texts += [(i.get('link', ''), i['content']['raw']) for i in items]
            if len(items) < 100:
                break
            page += 1
    return texts


def delete_old(ids, apply):
    if not ids:
        return
    current = {d.get('url') for d in json.load(open(LIST, encoding='utf-8'))['documents']}
    content = _all_content()
    for mid in ids:
        media = call('GET', f'/wp/v2/media/{mid}?context=edit')
        url = media['source_url']
        rel = url.split('/wp-content/', 1)[-1]   # matches absolute and relative links alike
        if not url.lower().endswith('.pdf'):
            print(f'  KEPT (not a PDF): id {mid} {url}')
            continue
        if url in current:
            print(f'  KEPT (the documents list still uses it): id {mid} {url}')
            continue
        users = [link for link, raw in content if rel in raw]
        if users:
            print(f'  KEPT (still linked from {", ".join(users)}): id {mid} {url}')
            continue
        if apply:
            call('DELETE', f'/wp/v2/media/{mid}?force=true')
            print(f'  DELETED old copy: id {mid} {url}')
        else:
            print(f'  WOULD DELETE old copy: id {mid} {url}')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--apply']
    delete_old([int(a) for a in args], '--apply' in sys.argv)
