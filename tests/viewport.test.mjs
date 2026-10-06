/* CR-201: the problem report's layoutViewport is the box the page lays out against
 * (documentElement's client box), not window.innerWidth, which follows the visual
 * viewport in Safari under zoom - the one case this reading exists to diagnose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('layoutViewport reads the client box, not innerWidth', async () => {
    const saved = { window: globalThis.window, document: globalThis.document, screen: globalThis.screen, matchMedia: globalThis.matchMedia };
    try {
        globalThis.window = { innerWidth: 600, innerHeight: 400, outerWidth: 1180, outerHeight: 820, devicePixelRatio: 2, visualViewport: { width: 600, height: 400, scale: 2 } };
        globalThis.document = { documentElement: { clientWidth: 1180, clientHeight: 763 } };
        globalThis.screen = { width: 1180, height: 820, availWidth: 1180, availHeight: 820, orientation: { type: 'landscape-primary' } };
        globalThis.matchMedia = () => ({ matches: false });
        const { getMetrics } = await import('../app/js/viewport.js?t=' + Math.random());
        const m = getMetrics();
        assert.deepEqual(m.layoutViewport, { w: 1180, h: 763 });
        assert.deepEqual(m.innerWindow, { w: 600, h: 400 });
        assert.equal(m.aspect, +(1180 / 763).toFixed(3));
    } finally {
        Object.assign(globalThis, saved);
    }
});
