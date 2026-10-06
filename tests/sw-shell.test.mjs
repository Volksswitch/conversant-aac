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
    assert.match(sw, new RegExp(`CACHE_VERSION = 'aac-v${version.replace(/\./g, '\.')}-`));
});
