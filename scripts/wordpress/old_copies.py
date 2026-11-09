"""Delete replaced documents and videos from the volksswitch.org media library, safely.

Ken, November 8 2026: old document copies are deleted as part of "sync docs" ("These
documents can always be regenerated from their backup equivalents"). Ken, November 9
2026: the same for the how-to videos, their guides and the course map ("delete all
out-of-date videos after replacement"). publish-documents.py and publish-videos.py
call delete_old() after their page has been rewritten to point at the new copies, and
after their list file has been saved.

    python scripts/wordpress/old_copies.py <media id> [<media id> ...]    # show what would go
    python scripts/wordpress/old_copies.py --apply <media id> [...]        # delete them
    python scripts/wordpress/old_copies.py --videos-folder [--apply]       # every unused file
                                                                           # in the Videos folder

SAFETY, because deleting media is permanent (the media library has no bin):
  - Never delete a file the documents list (user-documents.json) or the videos list
    (videos.json) still points at.
  - Never delete a file any page or post on the site still links to. Every page and
    post is read in full and searched for the file's address; one hit and that file is
    kept and named, so a link elsewhere on the site never breaks silently.
  - Only PDFs and MP4 videos are deleted. Anything else is refused.
"""
import json, os, sys

from wp import call

HERE = os.path.dirname(__file__)
DOC_LIST = os.path.join(HERE, 'user-documents.json')
VIDEO_LIST = os.path.join(HERE, 'videos.json')
KINDS = ('.pdf', '.mp4')


def _current_urls():
    """Every file the two lists say is in use now."""
    urls = set()
    if os.path.exists(DOC_LIST):
        urls |= {d.get('url') for d in json.load(open(DOC_LIST, encoding='utf-8'))['documents']}
    if os.path.exists(VIDEO_LIST):
        v = json.load(open(VIDEO_LIST, encoding='utf-8'))
        for rec in v.get('videos', {}).values():
            for part in ('video', 'guide'):
                if rec.get(part):
                    urls.add(rec[part].get('url'))
        if v.get('courseMap'):
            urls.add(v['courseMap'].get('url'))
    urls.discard(None)
    return urls


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
    """Delete each media id that nothing uses. Returns how many were (or would be) deleted."""
    if not ids:
        return 0
    current = _current_urls()
    content = _all_content()
    gone = 0
    for mid in ids:
        media = call('GET', f'/wp/v2/media/{mid}?context=edit')
        url = media['source_url']
        rel = url.split('/wp-content/', 1)[-1]   # matches absolute and relative links alike
        if not url.lower().endswith(KINDS):
            print(f'  KEPT (not a PDF or a video): id {mid} {url}')
            continue
        if url in current:
            print(f'  KEPT (still in use): id {mid} {url}')
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
        gone += 1
    return gone


def videos_folder_ids():
    """Every file in the Conversant AAC > Videos media folder."""
    folder = json.load(open(VIDEO_LIST, encoding='utf-8')).get('mediaFolder')
    if not folder:
        return []
    ids, page = [], 1
    while True:
        items = call('GET', f'/wp/v2/media?media_folder={folder}&per_page=100&page={page}')
        ids += [m['id'] for m in items]
        if len(items) < 100:
            break
        page += 1
    return ids


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    if '--videos-folder' in sys.argv:
        targets = videos_folder_ids()
    else:
        targets = [int(a) for a in sys.argv[1:] if not a.startswith('--')]
    n = delete_old(targets, apply)
    print(f'{n} {"deleted" if apply else "would be deleted"} of {len(targets)} checked.')
