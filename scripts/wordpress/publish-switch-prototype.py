"""Publish the switch access prototypes as pages on volksswitch.org.

    python scripts/wordpress/publish-switch-prototype.py            (shows what it would do)
    python scripts/wordpress/publish-switch-prototype.py --apply    (makes or updates the pages)
    python scripts/wordpress/publish-switch-prototype.py --apply --only switch-control
        (only the pages whose address contains that text; the others are left as they are)

Three prototype pages, each linking to the other two:
  prototypes/switch-access.html          -> /conversant-switch-access-prototype/
  prototypes/switch-access-settings.html -> /conversant-switch-access-settings-prototype/
  prototypes/switch-access-composer.html -> /conversant-switch-access-composer-prototype/
and one test of Apple's Switch Control, not a prototype:
  prototypes/switch-control-screen-test.html -> /conversant-switch-control-screen-test/
and a test of showing every Settings tab without scrolling:
  prototypes/settings-tabs-test.html -> /conversant-settings-tabs-test/

Ken, November 9 2026: "add it to the website", then "publish it" for the Settings one,
for the speech and language therapists.

WHY A PAGE AND NOT AN UPLOADED FILE. Uploading the .html to the media library works,
but the site strips every <script> from it on the way in (measured: 38 KB went up,
13 KB came back, no script), so the prototype loads and does nothing. Page content
keeps scripts for this account, as the video watch pages already rely on. An upload
also takes the slug a page wants, which is how the first page briefly became "-2".

WHY AN IFRAME. The prototypes style body, header and * - inside the theme those rules
would restyle the whole site page, and the theme's rules would restyle the prototype.
srcdoc keeps the two apart and needs no second file. The whole document is escaped
into the attribute, so nothing in it can end the WordPress block early.
"""
import html, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from wp import call, ROOT

SITE = 'https://volksswitch.org/index.php/'
NL = '\n'
PAGES = [
    {'slug': 'conversant-switch-access-prototype', 'title': 'Conversant AAC Switch Access Prototype',
     'file': 'switch-access.html', 'height': 2400,
     'intro': ('This page lets you try how someone using one, two or three switches might use Conversant AAC. '
               'Anywhere in the prototype except its settings panel, the <strong>left mouse button is switch 1</strong> '
               'and the <strong>right mouse button is switch 2</strong>; Space and Enter do the same. '
               'With three switches, the <strong>middle mouse button (the wheel) is switch 3</strong>, which moves the highlight back; keys 1, 2 and 3 also work as the three switches. '
               'Nothing here uses the real AI: the partner and the response options are made up. '
               'It works best on a computer with a mouse and a wide window.'),
     'other': [('conversant-switch-access-settings-prototype', 'Scanning the Settings panel has its own prototype.'),
               ('conversant-switch-access-composer-prototype', 'Typing in “In my own words” has its own prototype.')]},
    {'slug': 'conversant-switch-access-settings-prototype', 'title': 'Conversant AAC Switch Access Prototype: Settings',
     'file': 'switch-access-settings.html', 'height': 1750,
     'intro': ('This page lets you try how someone using one, two or three switches might change Conversant AAC’s settings. '
               'It shows seven of the real Settings tabs and nine tasks to time. '
               'Anywhere in the prototype except the panel on its right, the <strong>left mouse button is switch 1</strong> '
               'and the <strong>right mouse button is switch 2</strong>; Space and Enter do the same. '
               'With three switches, the <strong>middle mouse button (the wheel) is switch 3</strong>, which moves the highlight back; keys 1, 2 and 3 also work as the three switches. '
               'Nothing here changes the real app. It works best on a computer with a mouse and a wide window.'),
     'other': [('conversant-switch-access-prototype', 'The conversation screen has its own prototype.'),
               ('conversant-switch-access-composer-prototype', 'Typing in “In my own words” has its own prototype.')]},
    {'slug': 'conversant-switch-access-composer-prototype', 'title': 'Conversant AAC Switch Access Prototype: In My Own Words',
     'file': 'switch-access-composer.html', 'height': 1650,
     'intro': ('This page lets you try how someone using one, two or three switches might type in Conversant AAC’s “In my own words” window. '
               'It copies the app’s text box, buttons and keyboard, and has five tasks to time. '
               'Anywhere in the prototype except the panel on its right, the <strong>left mouse button is switch 1</strong> '
               'and the <strong>right mouse button is switch 2</strong>; Space and Enter do the same. '
               'With three switches, the <strong>middle mouse button (the wheel) is switch 3</strong>, which moves the highlight back; keys 1, 2 and 3 also work as the three switches. '
               'Nothing here uses the real AI. It works best on a computer with a mouse and a wide window.'),
     'other': [('conversant-switch-access-prototype', 'The conversation screen has its own prototype.'),
               ('conversant-switch-access-settings-prototype', 'Scanning the Settings panel has its own prototype.')]},
    # Not a prototype of Conversant's own scanning: a test of how Apple's Switch Control
    # notices a screen change (Ken, November 18 2026). Best opened on an iPad.
    {'slug': 'conversant-switch-control-screen-test', 'title': 'Conversant AAC Switch Control Screen Test',
     # 1000, not 900: test H is 852 tall at the site's 702 px width (November 23 2026),
     # close to 900, and a frame that scrolled would put a second scrolling box around H's.
     'file': 'switch-control-screen-test.html', 'height': 1000,
     'intro': ('This page tests how Apple’s Switch Control on an iPad notices that a new panel has opened. '
               'Turn on Switch Control, then open each of the seven “Settings” buttons in turn and note whether the '
               'highlight moves into the panel at once or keeps going around the buttons behind it. '
               'Buttons A to E change the page that is showing; F and G load a new page, and F loads this whole page again. '
               '“Scroll test H” is a second problem: a box of tabs that scrolls, with buttons right below it, '
               'to see whether Switch Control can reach tabs that are scrolled out of view. '
               '<a href="' + SITE + 'conversant-switch-control-screen-test/?sctest=H">Open test H directly</a>. '
               'Nothing here is the real app.'),
     'other': []},
    # Every Settings tab on screen, no scrolling (Ken, November 26 2026). 'full': the
    # frame breaks out of the site's 702 px column and is one screen tall, because the
    # test is only meaningful at the size the app itself would have on the iPad.
    {'slug': 'conversant-settings-tabs-test', 'title': 'Conversant AAC Settings Tabs Test',
     'file': 'settings-tabs-test.html', 'full': True,
     'intro': ('This page tests a new layout for Conversant AAC’s Settings tabs on an iPad. '
               'Scroll down until the gray Settings title bar is at the top of the screen. '
               '“One column, as today” shows the problem: the lower tabs are hidden behind the phrase buttons. '
               '“Columns as needed” puts every tab on screen. '
               'With Switch Control on, check that the highlight never goes behind the phrase buttons. '
               'Nothing here is the real app.'),
     'other': []},
]


def build(pg):
    proto = open(os.path.join(ROOT, 'prototypes', pg['file']), encoding='utf-8').read()
    # Stamp the version the copied report shows: the last commit that changed this file.
    stamp = subprocess.run(['git', 'log', '-1', '--format=%h, %cd', '--date=format:%B %d %Y %H:%M', '--',
                            os.path.join('prototypes', pg['file'])], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    proto = proto.replace('@@PROTO_VERSION@@', 'published from ' + (stamp or 'an uncommitted copy'))
    intro = f'<p>{pg["intro"]}</p>' + ''.join(
        NL + f'<p>{html.escape(text)} <a href="{SITE}{slug}/">Open it</a>.</p>' for slug, text in pg['other'])
    style = ''
    if pg.get('full'):
        # The theme pins its menu bar to the top of the screen once the page scrolls, which
        # would cover the top of a one-screen-tall frame. Hidden on this page only.
        style = '<style>.navigation-top{display:none !important;}</style>' + NL
        size = ('display:block;width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);'
                'height:100vh;height:100dvh;border:0;')
    else:
        size = f'width:100%;height:{pg["height"]}px;border:1px solid #b9c2ca;border-radius:6px;'
    frame = (f'<iframe title="{html.escape(pg["title"])}" '
             'allow="clipboard-write" '
             f'style="{size}" '
             f'srcdoc="{html.escape(proto, quote=True)}"></iframe>')
    return '<!-- wp:html -->' + NL + style + intro + NL + frame + NL + '<!-- /wp:html -->'


def publish(pg, apply):
    content = build(pg)
    found = call('GET', f'/wp/v2/pages?slug={pg["slug"]}&status=publish,draft,private&context=edit')
    if found:
        page = found[0]
        if page['content']['raw'] == content:
            print('UNCHANGED: ' + page['link']); return
        if apply:
            call('POST', f'/wp/v2/pages/{page["id"]}', {'title': pg['title'], 'content': content})
        print(('UPDATED: ' if apply else 'WOULD UPDATE: ') + page['link'])
    elif apply:
        page = call('POST', '/wp/v2/pages', {'title': pg['title'], 'slug': pg['slug'], 'status': 'publish', 'content': content})
        print('MADE: ' + page['link'])
        if page.get('slug') != pg['slug']:
            print(f'  WARNING: WordPress gave it the address "{page["slug"]}"; something else holds "{pg["slug"]}".')
    else:
        print('WOULD MAKE a published page at slug ' + pg['slug'])


def main():
    apply = '--apply' in sys.argv
    only = None
    if '--only' in sys.argv:
        i = sys.argv.index('--only')
        if i + 1 >= len(sys.argv):
            raise SystemExit('--only needs part of a page address, for example: --only switch-control')
        only = sys.argv[i + 1]
    chosen = [pg for pg in PAGES if not only or only in pg['slug']]
    if not chosen:
        raise SystemExit(f'No page address contains "{only}".')
    for pg in chosen:
        publish(pg, apply)


if __name__ == '__main__':
    main()
