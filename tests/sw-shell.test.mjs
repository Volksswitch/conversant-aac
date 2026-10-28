/* The service worker's offline list (app/sw.js SHELL).
 *
 * CR-055 and CR-073. SHELL is a hand-kept list, and a module missing from it makes the
 * installed app fail to start offline, with nothing reporting why. tap-guard.js was
 * missed exactly that way. These tests walk the real imports from app.js and compare.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const appDir = new URL('../app/', import.meta.url);
const sw = readFileSync(new URL('sw.js', appDir), 'utf8');
const shell = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));

test('every module app.js loads, directly or not, is in the offline list', () => {
    const seen = new Set();
    const walk = (rel) => {
        if (seen.has(rel)) return;
        seen.add(rel);
        const src = readFileSync(new URL(rel, appDir), 'utf8');
        for (const m of src.matchAll(/^\s*import\s[^'"]*['"](\.\/[^'"]+)['"]/gm)) {
            walk('js/' + m[1].slice(2));
        }
    };
    walk('js/app.js');
    const missing = [...seen].filter((f) => !shell.has(f));
    assert.deepEqual(missing, []);
});

test('every file in app/js is in the offline list', () => {
    const missing = readdirSync(new URL('js/', appDir)).filter((f) => f.endsWith('.js') && !shell.has('js/' + f));
    assert.deepEqual(missing, []);
});

test('the offline cache name carries the app version', () => {
    const app = readFileSync(new URL('js/app.js', appDir), 'utf8');
    const version = /const APP_VERSION = '([^']+)'/.exec(app)[1];
    assert.match(sw, new RegExp(`CACHE_VERSION = 'aac-v${version.replace(/\./g, '\\.')}-`));
});

// A release used to restart the app after the first Start tap, because the new worker
// took control seconds after the page had already loaded the new code (Ken, October 28
// 2026). The page now skips the reload when its build matches the worker's, which only
// works while the two name a build the same way - so check it after stamping, exactly
// as the deploy workflow does.
test('the page names its build the way the worker names its cache, once stamped', () => {
    const app = readFileSync(new URL('js/app.js', appDir), 'utf8');
    const version = /const APP_VERSION = '([^']+)'/.exec(app)[1];
    const stamp = /const BUILD_STAMP = '([^']+)'/.exec(app)[1];
    assert.match(app, /window\.__aacPageBuild = `aac-v\$\{APP_VERSION\}-\$\{BUILD_STAMP\}`;/);
    const cacheVersion = /const CACHE_VERSION = '([^']+)'/.exec(sw)[1];
    const stampIt = (s) => s.replace(/@@BUILD@@/g, 'abc1234');
    assert.equal(stampIt(`aac-v${version}-${stamp}`), stampIt(cacheVersion));
    assert.match(sw, /postMessage\(\{ cacheVersion: CACHE_VERSION \}\)/);
    const reg = readFileSync(new URL('js/sw-register.js', appDir), 'utf8');
    assert.match(reg, /e\.data\.cacheVersion === mine/);
});

// CR-282. A page's own files follow how the page itself loaded, so a slow link after an
// update cannot mix old and new files in one page.
test('a page served from the cache gets its files from the cache; a fresh one waits for the network', async () => {
    const { readFileSync } = await import('node:fs');
    const sw = readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8');
    assert.match(sw, /pagesFromCache\.has\(event\.clientId\)/);
    assert.match(sw, /networkFirst\(request, \{ noDeadline \}\)/);
    assert.match(sw, /if \(cached\) \{ servedFromCache\.add\(cached\); return cached; \}/);
});
