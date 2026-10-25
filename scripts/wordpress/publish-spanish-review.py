"""Put the Spanish review page on volksswitch.org (Ken, October 25 2026).

The page is built by scripts/spanish-review/build-review-page.mjs from the newest
Spanish evaluation, and lives at .../index.php/conversant-spanish-review/. It is not
linked from anywhere; Ken sends the address to the reviewer.

UNLIKE THE HOME PAGE, THIS PAGE IS GENERATED, NOT HAND-EDITED: running again replaces
its content with the newest build. Change the wording in build-review-page.mjs.

A NEW page is made as a DRAFT. Ken publishes it in WordPress once the Sheet script has
been redeployed (the page will not send to an older one). After that its status is
left alone.

Run: python scripts/wordpress/publish-spanish-review.py [<date>]           (shows what it would do)
     python scripts/wordpress/publish-spanish-review.py [<date>] --apply   (makes or updates it)
"""
import os, sys, glob
sys.path.insert(0, os.path.dirname(__file__))
from wp import call, ROOT

SLUG = 'conversant-spanish-review'
TITLE = 'Conversant AAC: Spanish Review'

args = [a for a in sys.argv[1:] if a != '--apply']
apply = '--apply' in sys.argv
if args:
    path = os.path.join(ROOT, 'Reports', f'spanish-review-{args[0]}.block.html')
else:
    found = sorted(glob.glob(os.path.join(ROOT, 'Reports', 'spanish-review-*.block.html')))
    if not found:
        raise SystemExit('No review page built. Run scripts/spanish-review/build-review-page.mjs first.')
    path = found[-1]
content = '<!-- wp:html -->\n' + open(path, encoding='utf-8').read() + '\n<!-- /wp:html -->'
print(f'From {os.path.basename(path)}')

pages = call('GET', f'/wp/v2/pages?slug={SLUG}&status=publish,draft,private&context=edit')
if pages:
    page = pages[0]
    if page['content']['raw'].strip() == content.strip():
        print(f'Unchanged ({page["status"]}): {page["link"]}')
    else:
        print(f'{"UPDATED" if apply else "Would update"} ({page["status"]}): {page["link"]}')
        if apply:
            call('POST', f'/wp/v2/pages/{page["id"]}', {'content': content})
else:
    print(f'{"MADE" if apply else "Would make"} a DRAFT page: {TITLE}')
    if apply:
        made = call('POST', '/wp/v2/pages', {'title': TITLE, 'slug': SLUG, 'status': 'draft', 'content': content})
        print(f'  Draft id {made["id"]}. Publish it in WordPress once the Sheet script is redeployed.')
        print(f'  Preview: {made["link"]}')
