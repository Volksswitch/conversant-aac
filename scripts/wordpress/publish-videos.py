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


def numbered(items, cfg):
    """Published items grouped by number, in course order: device versions of one
    video ("1.2 On an iPad", "1.2 On an Android device") share a number."""
    out = []
    for item in items:
        if item.get('id') not in cfg['videos']:
            continue
        if out and out[-1][0] == item['num']:
            out[-1][1].append(item)
        else:
            out.append((item['num'], [item]))
    return out


def device_word(item):
    # "On an Android device" -> "Android device", for short labels.
    v = item['version']
    for lead in ('On an ', 'On a ', 'On '):
        if v.startswith(lead):
            return v[len(lead):]
    return v


def build_page(cfg, course):
    out = ['<!-- wp:paragraph -->\n<p>Short videos, about two minutes each, that show you how to use '
           'Conversant AAC. Each has a one-page guide with the same steps. Each video opens in its '
           'own tab, and when it finishes you can go straight on to the next one.</p>\n<!-- /wp:paragraph -->']
    if cfg.get('courseMap'):
        out.append('<!-- wp:paragraph -->\n<p>New to Conversant? Start with "Getting started", then '
                   f'"Your first conversations", and watch those in order. After that, pick the ones you need. <a href="{html.escape(cfg["courseMap"]["url"])}" target="_blank" rel="noopener">'
                   'The full list (PDF)</a>.</p>\n<!-- /wp:paragraph -->')
    for g in course['groups']:
        rows = []
        for num, items in numbered(g['items'], cfg):
            first, e = items[0], html.escape
            if not first.get('version'):
                v = cfg['videos'][first['id']]
                rows.append(
                    f'<tr><td>{e(num)}</td>'
                    f'<td><a href="{e((v.get("page") or v["video"])["url"])}" target="_blank" rel="noopener">{e(first["title"])}</a> '
                    f'({length(v["seconds"])})</td>'
                    f'<td>{e(first["learn"])}</td>'
                    f'<td><a href="{e(v["guide"]["url"])}" target="_blank" rel="noopener">Guide (PDF)</a></td></tr>')
                continue
            # Device versions share one row: one link per device, and one guide each.
            vids = [(i, cfg['videos'][i['id']]) for i in items]
            links = '<br>'.join(
                f'<a href="{e((v.get("page") or v["video"])["url"])}" target="_blank" rel="noopener">{e(i["version"])}</a> '
                f'({length(v["seconds"])})' for i, v in vids)
            guides = '<br>'.join(
                f'<a href="{e(v["guide"]["url"])}" target="_blank" rel="noopener">Guide: {e(i["version"].replace("On ", "on ", 1))}</a>' for i, v in vids)
            rows.append(f'<tr><td>{e(num)}</td><td>{e(first["title"])}<br>{links}</td>'
                        f'<td>{e(first["learn"])}</td><td>{guides}</td></tr>')
        if not rows:
            continue
        heading = g['name'] + (' (watch these in order)' if g.get('path') else '')
        out.append(f'<!-- wp:heading -->\n<h2 class="wp-block-heading">{html.escape(heading)}</h2>\n<!-- /wp:heading -->')
        out.append('<!-- wp:table -->\n<figure class="wp-block-table"><table><thead><tr><th></th><th>Video</th>'
                   f'<th>What you will learn</th><th>Guide</th></tr></thead><tbody>{"".join(rows)}</tbody></table>'
                   '</figure>\n<!-- /wp:table -->')
    return '\n\n'.join(out)


def course_map_signature(cfg, course):
    listed = [(i['num'], i['title'], i['learn'], i.get('version')) for g in course['groups'] for i in g['items']
              if i.get('id') in cfg['videos']]
    # The map's own wording too (written by make-course-map.mjs), so a change to
    # its fixed text is published even when no video was added (October 28 2026).
    made = os.path.join(VIDEOS, MAP_PDF.replace('.pdf', '.json'))
    wording = json.load(open(made, encoding='utf-8'))['signature'] if os.path.exists(made) else None
    return hashlib.sha256(json.dumps([listed, wording] if wording else listed).encode()).hexdigest()


# One watch page per video, a child of the list page. The video plays in the page;
# when it ends, a "Next" button covers the player and goes straight to the next
# video's page, which tries to start playing at once (a browser may still ask for
# a tap; that is the browser's rule, not ours). The same link also sits below the
# player for anyone who wants it sooner. Pages are made public, like the list page,
# which is reachable only once the site links to it.
NL = chr(10)
WATCH_SLUG = 'video-{num}'


def watch_slug(item):
    slug = WATCH_SLUG.format(num=item['num'].replace('.', '-'))
    if item.get('version'):
        slug += '-' + device_word(item).split()[0].lower()   # video-1-2-ipad
    return slug


def watch_title(item):
    return f'{item["num"]} {item["title"]}' + (f' ({item["version"]})' if item.get('version') else '')


def build_watch(item, v, nxt, url_of, list_url):
    """nxt is the list of items for the next number: one item, or one per device
    version. Each device version gets its own button, and the viewer picks theirs."""
    e = html.escape
    if not nxt:
        heading, choices = None, [('Back to all the videos', list_url)]
    elif nxt[0].get('version'):
        heading = f'Next: {nxt[0]["num"]} {nxt[0]["title"]}'
        choices = [(n['version'], url_of[n['id']] + '?play=1') for n in nxt]
    else:
        heading, choices = None, [(f'Next: {nxt[0]["num"]} {nxt[0]["title"]} →', url_of[nxt[0]['id']] + '?play=1')]
    style = ('background:#ff6d00;color:#fff;font-size:1.3em;font-weight:bold;'
             'padding:14px 24px;border-radius:10px;text-decoration:none;')
    buttons = ''.join(
        f'<a{" id=" + chr(34) + "cv-next" + chr(34) if n == 0 else ""} href="{e(t)}" style="{style}">{e(text)}</a>'
        for n, (text, t) in enumerate(choices))
    end_heading = f'<div style="color:#fff;font-size:1.3em;font-weight:bold;">{e(heading)}</div>' if heading else ''
    below = (f'{e(heading)}: ' if heading else '') + ' | '.join(f'<a href="{e(t)}">{e(text)}</a>' for text, t in choices)
    return ('<!-- wp:html -->' + NL +
            '<div id="cv-wrap" style="position:relative;max-width:960px;">'
            f'<video id="cv-video" src="{e(v["video"]["url"])}" controls playsinline preload="metadata" '
            'style="width:100%;display:block;background:#000;"></video>'
            # Hidden by display:none, NOT the hidden attribute: an inline display
            # value overrides that attribute, so the button showed before the video
            # had even started (Ken, October 24 2026).
            '<div id="cv-end" style="position:absolute;inset:0;background:rgba(20,30,45,0.88);'
            'display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;">'
            f'{end_heading}<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">{buttons}</div>'
            '<button id="cv-again" type="button" style="font-size:1.1em;padding:10px 20px;border-radius:8px;">'
            'Watch this one again</button></div></div>' + NL +
            f'<p>{e(item["learn"])} ({length(v["seconds"])})</p>' + NL +
            f'<p><a href="{e(v["guide"]["url"])}" target="_blank" rel="noopener">The guide for this video (PDF)</a></p>' + NL +
            f'<p>{below} &nbsp;|&nbsp; <a href="{e(list_url)}">All the videos</a></p>' + NL +
            ('<script>(function(){var v=document.getElementById("cv-video"),end=document.getElementById("cv-end");'
            'v.addEventListener("ended",function(){end.style.display="flex";'
            'document.getElementById("cv-next").focus();});'
            'document.getElementById("cv-again").addEventListener("click",function(){'
            'end.style.display="none";v.currentTime=0;v.play();});'
            'if(/[?&]play=1/.test(location.search)){var p=v.play();if(p&&p.catch)p.catch(function(){});}'
            '})();</script>') + NL +
            '<!-- /wp:html -->')


def update_watch_pages(cfg, course, list_page, apply):
    items = [i for g in course['groups'] for i in g['items'] if i.get('id') in cfg['videos']]
    base = list_page['link'].rstrip('/') + '/'
    url_of = {i['id']: base + watch_slug(i) + '/' for i in items}
    for n, item in enumerate(items):
        v = cfg['videos'][item['id']]
        # The next video is the next NUMBER: the other device versions of this one
        # are skipped, and all the versions of the next one are offered.
        later = [i for i in items[n + 1:] if i['num'] != item['num']]
        nxt = [i for i in later if i['num'] == later[0]['num']] if later else None
        content = build_watch(item, v, nxt, url_of, list_page['link'])
        title = watch_title(item)
        page = v.get('page')
        if page:
            current = call('GET', f'/wp/v2/pages/{page["id"]}?context=edit')
            if current['content']['raw'].strip() == content.strip() and current['title']['raw'] == title:
                continue
            print(f'  WATCH PAGE {"UPDATED" if apply else "would be updated"}: {title}')
            if apply:
                call('POST', f'/wp/v2/pages/{page["id"]}', {'title': title, 'content': content})
        else:
            print(f'  WATCH PAGE {"MADE" if apply else "would be made"}: {title}')
            if apply:
                made = call('POST', '/wp/v2/pages', {'title': title, 'slug': watch_slug(item),
                                                     'parent': list_page['id'], 'status': 'publish',
                                                     'content': content})
                v['page'] = {'id': made['id'], 'url': made['link']}
                if made['link'] != url_of[item['id']]:
                    raise SystemExit(f'The page for {title} landed at {made["link"]}, not {url_of[item["id"]]}; '
                                     "the Next links on the pages beside it would be wrong. Nothing more has been changed.")
    update_chooser_pages(cfg, items, url_of, list_page, apply)


# A video made in one version per device also gets a page at its plain number
# (video-1-2), asking which device. Two reasons: links made before 1.2 and 1.4 were
# split into device versions point at the plain number, and the site no longer
# guesses at an unknown address (Ken installed "Disable URL Autocorrect Guessing",
# October 25 2026), so without this page those links would say "not found". It
# also gives an email that doesn't know the reader's device one address to use.
def build_chooser(versions, url_of, list_url):
    e = html.escape
    style = ('display:inline-block;background:#ff6d00;color:#fff;font-size:1.2em;font-weight:bold;'
             'padding:12px 22px;border-radius:10px;text-decoration:none;margin:0 10px 10px 0;')
    buttons = ''.join(f'<a href="{e(url_of[v["id"]])}" style="{style}">{e(v["version"])}</a>' for v in versions)
    return ('<!-- wp:html -->' + NL +
            f'<p>{e(versions[0]["learn"])}</p>' + NL +
            '<p>This video comes in a version for each kind of device. Choose yours:</p>' + NL +
            f'<p>{buttons}</p>' + NL +
            f'<p><a href="{e(list_url)}">All the videos</a></p>' + NL +
            '<!-- /wp:html -->')


def update_chooser_pages(cfg, items, url_of, list_page, apply):
    choosers = cfg.setdefault('choosers', {})
    nums = []
    for i in items:
        if i.get('version') and i['num'] not in nums:
            nums.append(i['num'])
    for num in nums:
        versions = [i for i in items if i['num'] == num]
        slug = WATCH_SLUG.format(num=num.replace('.', '-'))
        title = f'{num} {versions[0]["title"]}'
        content = build_chooser(versions, url_of, list_page['link'])
        rec = choosers.get(num)
        if not rec:
            found = call('GET', f'/wp/v2/pages?slug={slug}&parent={list_page["id"]}&status=publish,draft,private&context=edit')
            if found:
                rec = choosers[num] = {'id': found[0]['id'], 'url': found[0]['link']}
        if rec:
            current = call('GET', f'/wp/v2/pages/{rec["id"]}?context=edit')
            if current['content']['raw'].strip() == content.strip() and current['title']['raw'] == title:
                continue
            print(f'  CHOOSE-YOUR-DEVICE PAGE {"UPDATED" if apply else "would be updated"}: {title}')
            if apply:
                call('POST', f'/wp/v2/pages/{rec["id"]}', {'title': title, 'content': content})
        else:
            print(f'  CHOOSE-YOUR-DEVICE PAGE {"MADE" if apply else "would be made"}: {title}')
            if apply:
                made = call('POST', '/wp/v2/pages', {'title': title, 'slug': slug, 'parent': list_page['id'],
                                                     'status': 'publish', 'content': content})
                choosers[num] = {'id': made['id'], 'url': made['link']}
                print(f'    {made["link"]}')


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
            # Device versions share a number and a title, so the device goes in the name.
            label = item['title'] + (f' ({item["version"]})' if item.get('version') else '')
            base = safe_name(f'Conversant {item["num"]} {item["title"]}'
                             + (f' {device_word(item)}' if item.get('version') else ''))
            video = upload(os.path.join(VIDEOS, f'{vid}.mp4'), base + '.mp4', 'video/mp4',
                           f'Conversant AAC video {item["num"]}: {label}', cfg['mediaFolder'])
            guide = upload(os.path.join(VIDEOS, f'{vid}.pdf'), base + '-Guide.pdf', 'application/pdf',
                           f'Conversant AAC video {item["num"]} guide: {label}', cfg['mediaFolder'])
            old = cfg['videos'].get(vid)
            if old:
                replaced += [old['video'], old['guide']]
            # Keep the watch page: it belongs to the video, not to this upload. Losing
            # it made the publisher try to create the page again (October 24 2026).
            cfg['videos'][vid] = {'signature': made['signature'], 'seconds': made['seconds'],
                                  'video': video, 'guide': guide, 'page': (old or {}).get('page')}
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

    pages = call('GET', f'/wp/v2/pages?slug={cfg["page"]}&status=publish,draft,private&context=edit')
    if pages:
        # Watch pages first, so the list page can link to them.
        update_watch_pages(cfg, course, pages[0], apply)
    content = build_page(cfg, course)
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
