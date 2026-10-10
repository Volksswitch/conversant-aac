/* SEC-3 (October 9 2026): the page's Content Security Policy.
 *
 * A service missing from connect-src fails SILENTLY - the request is refused by the
 * browser, which reads exactly like a bad key or a dropped connection. So every web
 * address the app's code names must be allowed, unless it is only ever opened as a
 * page for the user to read (a sign-up link), which the policy does not govern.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const policy = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
const directive = (name) => ((policy.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) || '')
    .split(/\s+/).slice(1));

// Links the user is SENT to (sign-up pages, our website). Navigation, not a connection.
const LINKS_ONLY = new Set(['volksswitch.org', 'www.volksswitch.org', 'signup.live.com',
    'portal.azure.com', 'azure.microsoft.com']);

function allowed(scheme, host) {
    return directive('connect-src').some((src) => {
        const m = src.match(/^(https|wss):\/\/(.+)$/);
        if (!m || m[1] !== scheme) return false;
        return m[2].startsWith('*.') ? host.endsWith(m[2].slice(1)) : host === m[2];
    });
}

test('the page carries a policy and has no inline scripts', () => {
    assert.ok(policy, 'no Content-Security-Policy meta');
    assert.deepEqual(directive('script-src'), ["'self'"]);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'an inline <script> would be refused');
    assert.ok(directive('object-src').includes("'none'"));
});

test('every service the code talks to is allowed to be reached', () => {
    const dir = new URL('../app/js/', import.meta.url);
    const missing = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
        const src = readFileSync(new URL(f, dir), 'utf8');
        for (const m of src.matchAll(/(https|wss):\/\/([A-Za-z0-9.-]+)/g)) {
            const [, scheme, host] = m;
            if (LINKS_ONLY.has(host) || host === 'example.com') continue;
            if (!allowed(scheme, host)) missing.push(`${scheme}://${host} (${f})`);
        }
    }
    // Azure builds its address from the region, so check the two shapes it makes.
    for (const h of ['eastus.tts.speech.microsoft.com', 'westeurope.stt.speech.microsoft.com']) {
        if (!allowed('https', h)) missing.push(h);
    }
    // The weekly report is answered from a second Google address after a redirect.
    if (!allowed('https', 'script.googleusercontent.com')) missing.push('script.googleusercontent.com');
    assert.deepEqual(missing, []);
});

test('the scripts moved out of the page are cached for offline use', () => {
    const sw = readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8');
    for (const f of ['theme-init.js', 'sw-register.js']) {
        assert.match(html, new RegExp(`<script src="js/${f}"></script>`));
        assert.match(sw, new RegExp(`'\\./js/${f}'`));
    }
});
