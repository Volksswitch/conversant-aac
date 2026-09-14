"""Shared WordPress REST client for the volksswitch.org scripts in this folder.

Credentials: .wordpress-credentials at the project root (git-ignored), holding the
"Claude" editor account's application password. Revocable from that user's profile.

Two traps this file exists to absorb, so no script has to rediscover them:
  - The REST base is .../index.php/wp-json/ - the bare /wp-json/ is a 404 on this site.
  - The host's firewall (Mod_Security) answers 406 "Not Acceptable" to Python's and
    curl's default User-Agent. That reads like a permissions failure and is not one.
"""
import base64, json, os, urllib.error, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

_creds = json.load(open(os.path.join(ROOT, '.wordpress-credentials'), encoding='utf-8'))
API = _creds['site'].rstrip('/')
_AUTH = 'Basic ' + base64.b64encode(
    f"{_creds['username']}:{_creds['applicationPassword']}".encode()).decode()


def call(method, path, body=None, headers=None):
    h = {'Authorization': _AUTH, 'User-Agent': 'ConversantDocsPublisher/1.0'}
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
