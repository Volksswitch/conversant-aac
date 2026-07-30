import test from 'node:test';
import assert from 'node:assert/strict';

import { namespaceForPath, key, dataSubdir, NAMESPACE, isTrial } from '../app/js/namespace.js';

/*
 * The stake here is asymmetric. Failing to namespace the TRIAL means an
 * experimental build shares data with the app testers are evaluating. Wrongly
 * namespacing PRODUCTION means every existing tester's worldview profile, people,
 * Express Panel and settings silently vanish, because the app would start reading
 * keys nothing has ever written. The second is far worse, so most of these tests
 * guard that direction.
 */

test('production paths are never namespaced', () => {
    for (const path of [
        '/',                             // local dev at the site root
        '',                              // defensive: empty
        '/conversant-aac/',              // the production GitHub Pages deployment
        '/conversant-aac/index.html',
        '/conversant-aac/deep/nested/page.html',
        '/index.html',
    ]) {
        assert.equal(namespaceForPath(path), '', `expected no namespace for ${path || '(empty)'}`);
    }
});

test('other Volksswitch projects on the same origin are untouched', () => {
    // These share the origin but are not Conversant; they must not be given a
    // Conversant namespace, nor accidentally match the trial.
    for (const path of ['/keyguard-designer-web/', '/bliss-tactile-symbols-web/', '/keyguard/']) {
        assert.equal(namespaceForPath(path), '');
    }
});

test('the trial deployment gets its own namespace', () => {
    assert.equal(namespaceForPath('/conversant-aac-ipad/'), 'ipad');
    assert.equal(namespaceForPath('/conversant-aac-ipad/index.html'), 'ipad');
    assert.equal(namespaceForPath('/conversant-aac-ipad/js/app.js'), 'ipad');
});

test('matching is on the whole first segment, not a prefix', () => {
    // '/conversant-aac/' must not match the trial entry by being a prefix of it,
    // and a look-alike path must not be swept in.
    assert.equal(namespaceForPath('/conversant-aac/'), '');
    assert.equal(namespaceForPath('/conversant-aac-ipad-old/'), '');
    assert.equal(namespaceForPath('/not-conversant-aac-ipad/'), '');
});

test('malformed input degrades to production behavior rather than throwing', () => {
    for (const bad of [undefined, null, 123, {}]) {
        assert.equal(namespaceForPath(bad), '');
    }
});

test('key() is an identity function when unprefixed', () => {
    // Under Node there is no location, so NAMESPACE is '' — the production case.
    assert.equal(NAMESPACE, '');
    assert.equal(isTrial(), false);
    assert.equal(dataSubdir(), null);
    for (const k of ['aac_settings', 'aac_worldview', 'aac_relationships',
                     'aac_control_phrases', 'aac_express_items', 'aac_word_freq', 'aac-db']) {
        assert.equal(key(k), k, `${k} must be untouched in production`);
    }
});
