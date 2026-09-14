"""Edit the Known Issues page on volksswitch.org IN PLACE.

    python scripts/wordpress/known-issues.py pull <file.html>
    python scripts/wordpress/known-issues.py push <file.html>            # show the changes
    python scripts/wordpress/known-issues.py push <file.html> --apply    # publish them

THE PAGE IS THE ONLY COPY, and this script is built so it stays that way. There is no
source file for it in the repo: "pull" fetches the live page into a scratch file, that
file is edited, and "push" puts it back. A generator from a repo copy would silently
overwrite anything Ken changed in WordPress - the arrangement that got the Known Issues
.docx retired.

⚠ PUSH REFUSES IF THE PAGE CHANGED SINCE THE PULL. The pull records the page's
last-modified time beside the file; if WordPress reports a different one at push time,
somebody (usually Ken) edited the page in between, and pushing would discard it. Pull
again and redo the change on top of the new version. WordPress keeps every revision,
so any mistaken publish can still be rolled back from the page's history.

What belongs on the page (Ken, Aug 9 2026) is recorded in DOC-SYNC.md's Known Issues
row: no roadmap, each item "Being worked on" or "Not changing for now", an item comes
off once its fix is released, public wording with no tester names.
"""
import difflib, json, sys

from wp import call

PAGE = 23303


def fetch():
    return call('GET', f'/wp/v2/pages/{PAGE}?context=edit')


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ('pull', 'push'):
        raise SystemExit(__doc__)
    cmd, path = sys.argv[1], sys.argv[2]
    stamp = path + '.modified'
    page = fetch()

    if cmd == 'pull':
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(page['content']['raw'])
        with open(stamp, 'w', encoding='utf-8') as f:
            f.write(page['modified'])
        print(f'Pulled page {PAGE} (last modified {page["modified"]}) into {path}')
        return

    try:
        pulled_at = open(stamp, encoding='utf-8').read().strip()
    except FileNotFoundError:
        raise SystemExit('No record of when this file was pulled. Pull first, then edit.')
    if pulled_at != page['modified']:
        raise SystemExit(f'The page was changed in WordPress at {page["modified"]}, after this '
                         f'file was pulled ({pulled_at}). Nothing published. Pull again and '
                         'redo the edit on the new version.')

    new = open(path, encoding='utf-8').read()
    old = page['content']['raw']
    if new.strip() == old.strip():
        print('No changes.')
        return
    for line in difflib.unified_diff(old.splitlines(), new.splitlines(), 'live page', 'edited', lineterm=''):
        print(line)
    if '--apply' not in sys.argv:
        print('\nNot published. Run again with --apply.')
        return
    saved = call('POST', f'/wp/v2/pages/{PAGE}', {'content': new})
    with open(stamp, 'w', encoding='utf-8') as f:
        f.write(saved['modified'])
    print(f'\nPUBLISHED {saved["link"]}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
