"""Publish the how-to videos and their guides to volksswitch.org - the last step of "sync videos".

    python scripts/wordpress/publish-videos.py                    # show what would change
    python scripts/wordpress/publish-videos.py --apply 2.1-screen-tour 2.2-practice
                                                                  # upload those, rebuild the page

Normally run by scripts/video/sync-videos.mjs --publish, which works out which videos
changed and passes their ids. Each video named is uploaded (its .mp4 and its one-page
.pdf guide) into the "Conversant AAC > Videos" media folder, and the videos page is
rebuilt from scripts/video/course.json, listing every video published so far.

THE PAGE IS CREATED AS A DRAFT. The first run makes the page but does not make it
public; Ken looks at it and publishes it in WordPress. After that its status is left
alone, so a later run never un-publishes or re-publishes it.

The site cannot stream video, so each row offers the file to download and play. Files
must therefore stay small: the renderer's are about 2 MB per minute.

OLD COPIES ARE NOT DELETED, for the same reason as the documents publisher: deleting
media is permanent. Replaced files are listed at the end so Ken can delete them.

ORDER: uploads first, page once at the end, local list saved only after the page write.

Credentials: .wordpress-credentials at the project root (git-ignored).
"""
import hashlib, html, json, os, sys

from wp import ROOT, call

LIST = os.path.join(os.path.dirname(__file__), 'videos.json')
VIDEOS = os.path.join(ROOT, 'Videos')
COURSE = os.path.join(ROOT, 'scripts', 'video', 'course.json')
MAP_PDF = 'Learning Conversant.pdf'

DEFAULT = {
    '_about': ('The how-to videos published on the page named here. Written by '
               'scripts/wordpress/publish-videos.py; do not edit the recorded ids and '
               'addresses by hand. "parentFolder" is the Conversant AAC media folder; the '
               'Videos folder inside it is made on the first run.'),
    'page': 'conversant-videos',
    'pageTitle': 'Conversant AAC How-To Videos',
    'parentFolder': 101,
    'mediaFolder': None,
    'videos': {},
    'courseMap': None,
}


def upload(path, filename, mime, title, folder):
    # A form upload: the host's firewall refuses a raw-body upload (see publish-documents.py).
    boundary = 'ConversantBoundary7f3a9c'
    with open(path, 'rb') as f:
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; '
                f'filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'
                ).encode() + f.read() + f'\r\n--{boundary}--\r\n'.encode()
    media = call('POST', '/wp/v2/media', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
    call('POST', f'/wp/v2/media/{media["id"]}', {'title': title, 'media_folder': [folder]})
    return {'id': media['id'], 'url': media['source_url']}


def length(seconds):
    m, s = divmod(int(seconds), 60)
    return f'{m}:{s:02d}'


def safe_name(text):
    out = ''.join(c if c.isalnum() else '-' for c in text)
    while '--' in out:
        out = out.replace('--', '-')
    return out.strip('-')


def build_page(cfg, course):
    out = ['<!-- wp:paragraph -->\n<p>Short videos, about two minutes each, that show you how to use '
           'Conversant AAC. Each has a one-page guide with the same steps. The videos download to '
           'your device and play there.</p>\n<!-- /wp:paragraph -->']
    if cfg.get('courseMap'):
        out.append('<!-- wp:paragraph -->\n<p>New to Conversant? Start with "Your first conversations" and '
                   f'watch those in order. <a href="{html.escape(cfg["courseMap"]["url"])}">'
                   'The full list (PDF)</a>.</p>\n<!-- /wp:paragraph -->')
    for g in course['groups']:
        rows = []
        for item in g['items']:
            v = cfg['videos'].get(item.get('id') or '')
            if not v:
                continue
            rows.append(
                f'<tr><td>{html.escape(item["num"])}</td>'
                f'<td><a href="{html.escape(v["video"]["url"])}">{html.escape(item["title"])}</a> '
                f'({length(v["seconds"])})</td>'
                f'<td>{html.escape(item["learn"])}</td>'
                f'<td><a href="{html.escape(v["guide"]["url"])}">Guide (PDF)</a></td></tr>')
        if not rows:
            continue
        heading = g['name'] + (' (watch these in order)' if g.get('path') else '')
        out.append(f'<!-- wp:heading -->\n<h2 class="wp-block-heading">{html.escape(heading)}</h2>\n<!-- /wp:heading -->')
        out.append('<!-- wp:table -->\n<figure class="wp-block-table"><table><thead><tr><th></th><th>Video</th>'
                   f'<th>What you will learn</th><th>Guide</th></tr></thead><tbody>{"".join(rows)}</tbody></table>'
                   '</figure>\n<!-- /wp:table -->')
    return '\n\n'.join(out)


def course_map_signature(cfg, course):
    listed = [(i['num'], i['title'], i['learn']) for g in course['groups'] for i in g['items']
              if i.get('id') in cfg['videos']]
    return hashlib.sha256(json.dumps(listed).encode()).hexdigest()


def main():
    apply = '--apply' in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]
    cfg = json.load(open(LIST, encoding='utf-8')) if os.path.exists(LIST) else dict(DEFAULT)
    course = json.load(open(COURSE, encoding='utf-8'))
    known = {i['id'] for g in course['groups'] for i in g['items'] if i.get('id')}
    replaced = []

    for vid in ids:
        if vid not in known:
            raise SystemExit(f'{vid} is not in course.json; nothing has been published.')
        for ext in ('mp4', 'pdf', 'json'):
            if not os.path.exists(os.path.join(VIDEOS, f'{vid}.{ext}')):
                raise SystemExit(f'Videos/{vid}.{ext} is missing; make the video first. Nothing has been published.')
        print(f'  {"UPDATE" if vid in cfg["videos"] else "NEW"}  {vid}')

    if apply and ids:
        if not cfg.get('mediaFolder'):
            folder = call('POST', '/wp/v2/media_folder', {'name': 'Videos', 'parent': cfg['parentFolder']})
            cfg['mediaFolder'] = folder['id']
            print(f'  MADE MEDIA FOLDER Conversant AAC > Videos (id {folder["id"]})')
        titles = {i['id']: i for g in course['groups'] for i in g['items'] if i.get('id')}
        for vid in ids:
            item = titles[vid]
            made = json.load(open(os.path.join(VIDEOS, f'{vid}.json'), encoding='utf-8'))
            base = safe_name(f'Conversant {item["num"]} {item["title"]}')
            video = upload(os.path.join(VIDEOS, f'{vid}.mp4'), base + '.mp4', 'video/mp4',
                           f'Conversant AAC video {item["num"]}: {item["title"]}', cfg['mediaFolder'])
            guide = upload(os.path.join(VIDEOS, f'{vid}.pdf'), base + '-Guide.pdf', 'application/pdf',
                           f'Conversant AAC video {item["num"]} guide: {item["title"]}', cfg['mediaFolder'])
            old = cfg['videos'].get(vid)
            if old:
                replaced += [old['video'], old['guide']]
            cfg['videos'][vid] = {'signature': made['signature'], 'seconds': made['seconds'],
                                  'video': video, 'guide': guide}
            print(f'  UPLOADED {video["url"]}')

    # The course map changes only when the list of published videos does.
    sig = course_map_signature(cfg, course)
    map_changed = (cfg.get('courseMap') or {}).get('signature') != sig
    if map_changed:
        print('  The course map (Learning Conversant.pdf) will be uploaded.')
        if apply:
            if not os.path.exists(os.path.join(VIDEOS, MAP_PDF)):
                raise SystemExit('Videos/Learning Conversant.pdf is missing; run make-course-map.mjs.')
            up = upload(os.path.join(VIDEOS, MAP_PDF), 'Learning-Conversant.pdf', 'application/pdf',
                        'Conversant AAC: Learning Conversant (the list of how-to videos)', cfg['mediaFolder'])
            if cfg.get('courseMap'):
                replaced.append(cfg['courseMap'])
            cfg['courseMap'] = {'signature': sig, **up}

    content = build_page(cfg, course)
    pages = call('GET', f'/wp/v2/pages?slug={cfg["page"]}&status=publish,draft,private&context=edit')
    if not pages:
        print(f'  The page "{cfg["pageTitle"]}" does not exist yet; it will be made as a DRAFT.')
        if apply:
            page = call('POST', '/wp/v2/pages', {'title': cfg['pageTitle'], 'slug': cfg['page'],
                                                 'status': 'draft', 'content': content})
            print(f'  PAGE MADE (draft): {page["link"]}')
    elif pages[0]['content']['raw'].strip() == content.strip():
        print('  Page already up to date.')
    elif apply:
        call('POST', f'/wp/v2/pages/{pages[0]["id"]}', {'content': content})
        print(f'  PAGE UPDATED ({pages[0]["status"]}): {pages[0]["link"]}')
    else:
        print('  The page would be rewritten. Run with --apply.')

    if apply:
        with open(LIST, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
            f.write('\n')
    for m in replaced:
        print(f'  OLD COPY LEFT IN MEDIA LIBRARY: id {m["id"]} {m["url"]}')


main()
