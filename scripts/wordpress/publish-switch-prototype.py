"""Publish prototypes/switch-access.html as a page on volksswitch.org.

    python scripts/wordpress/publish-switch-prototype.py            (shows what it would do)
    python scripts/wordpress/publish-switch-prototype.py --apply    (makes or updates the page)

Ken, November 9 2026: "add it to the website", for the speech and language therapists.

WHY A PAGE AND NOT AN UPLOADED FILE. Uploading the .html to the media library works,
but the site strips every <script> from it on the way in (measured: 38 KB went up,
13 KB came back, no script), so the prototype loads and does nothing. Page content
keeps scripts for this account, as the video watch pages already rely on.

WHY AN IFRAME. The prototype styles body, header and * - inside the theme those rules
would restyle the whole site page, and the theme's rules would restyle the prototype.
srcdoc keeps the two apart and needs no second file. The whole document is escaped
into the attribute, so nothing in it can end the WordPress block early.
"""
import html, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from wp import call, ROOT

SLUG = 'conversant-switch-access-prototype'
TITLE = 'Conversant AAC Switch Access Prototype'
NL = '\n'


def build():
    proto = open(os.path.join(ROOT, 'prototypes', 'switch-access.html'), encoding='utf-8').read()
    intro = ('<p>This page lets you try how someone using one or two switches might use '
             'Conversant AAC. Inside the screen area, the <strong>left mouse button is switch 1</strong> '
             'and the <strong>right mouse button is switch 2</strong>; Space and Enter do the same. '
             'Nothing here uses the real AI: the partner and the response options are made up. '
             'It works best on a computer with a mouse and a wide window.</p>')
    frame = ('<iframe title="Conversant AAC switch access prototype" '
             'style="width:100%;height:2400px;border:1px solid #b9c2ca;border-radius:6px;" '
             f'srcdoc="{html.escape(proto, quote=True)}"></iframe>')
    return '<!-- wp:html -->' + NL + intro + NL + frame + NL + '<!-- /wp:html -->'


def main():
    apply = '--apply' in sys.argv
    content = build()
    found = call('GET', f'/wp/v2/pages?slug={SLUG}&status=publish,draft,private&context=edit')
    if found:
        page = found[0]
        if page['content']['raw'] == content:
            print('UNCHANGED: ' + page['link']); return
        if apply:
            call('POST', f'/wp/v2/pages/{page["id"]}', {'title': TITLE, 'content': content})
        print(('UPDATED: ' if apply else 'WOULD UPDATE: ') + page['link'])
    else:
        if apply:
            page = call('POST', '/wp/v2/pages', {'title': TITLE, 'slug': SLUG, 'status': 'publish', 'content': content})
            print('MADE: ' + page['link'])
        else:
            print('WOULD MAKE a published page at slug ' + SLUG)


if __name__ == '__main__':
    main()
