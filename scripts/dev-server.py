"""Local web server for the app, used by serve.bat.

Python's built-in server sends no caching instructions, so the browser decides for
itself how long a file stays fresh, and keeps serving yesterday's copy of a script
after it has changed on disk. A page built from a mix of old and new files fails in
ways that look like real bugs (October 3 2026: the Conversation Review tab showing
nothing, with nothing wrong in the code). This server tells the browser never to keep
a copy, so every load reads what is on disk now.

Usage: python scripts/dev-server.py [port]   (serves the app folder, default port 8000)
"""

import functools
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(NoCacheHandler, directory=os.path.abspath(ROOT))
    with http.server.ThreadingHTTPServer(('', port), handler) as httpd:
        print(f'Serving {os.path.abspath(ROOT)} at http://localhost:{port} (no caching)')
        httpd.serve_forever()


if __name__ == '__main__':
    main()
