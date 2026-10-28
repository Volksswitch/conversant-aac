/* The page is hidden until app.js has laid it out (Ken, October 28 2026), so a launch
 * no longer shows the stylesheet's bare layout and then jumps to the real one.
 *
 * The hiding and the showing live in three files, and losing any one of them fails
 * quietly: no reveal means a blank screen for eight seconds on every launch, and no
 * safety net means a blank screen for good when app.js cannot load. These check the
 * pieces are all still there; the frame-by-frame behavior was measured in a browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../app/${p}`, import.meta.url), 'utf8');

test('the early script hides the page and carries its own safety nets', () => {
    const init = read('js/theme-init.js');
    assert.match(init, /document\.documentElement\.classList\.add\('booting'\)/);
    assert.match(init, /setTimeout\(window\.__aacReveal, \d+\)/);
    assert.match(init, /window\.addEventListener\('error', window\.__aacReveal, true\)/);
});

test('the stylesheet hides with visibility, so the layout can still be measured', () => {
    assert.match(read('css/styles.css'), /html\.booting body > \* \{ visibility: hidden; \}/);
});

test('app.js shows the page after initApp, and when start-up fails', () => {
    const app = read('js/app.js');
    const afterInit = app.slice(app.indexOf("reportStartupFailure('initApp', err);"));
    assert.match(afterInit.slice(0, 600), /if \(window\.__aacReveal\) window\.__aacReveal\(\);/);
    const fail = app.slice(app.indexOf('function reportStartupFailure'));
    assert.match(fail.slice(0, 1200), /window\.__aacReveal\(\)/);
});
