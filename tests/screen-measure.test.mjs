// screen-measure.js — millimetres for the spacing settings (Ken, November 27 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as sm from '../app/js/screen-measure.js';

const ipad10 = sm.findTablet('iPad 10th generation');

test('the tablet list came from the keyguard designer and reads sensibly', () => {
    assert.ok(sm.TABLETS.length > 100);
    for (const t of sm.TABLETS) {
        assert.ok(t.short > 0 && t.long >= t.short, t.name);
        assert.ok(t.mmPerPx > 0.03 && t.mmPerPx < 0.4, t.name);
    }
    assert.ok(!sm.findTablet('blank') && !sm.findTablet('other tablet'));
    // 264 pixels per inch is 0.0962 mm per pixel.
    assert.equal(ipad10.mmPerPx, 0.0962);
});

test('matching ignores orientation and small rounding, and catches a different tablet', () => {
    assert.ok(sm.matchTablet(ipad10, { w: 2360, h: 1640 }).ok);
    assert.ok(sm.matchTablet(ipad10, { w: 1640, h: 2360 }).ok);
    assert.ok(sm.matchTablet(ipad10, { w: 2358, h: 1641 }).ok);
    assert.ok(!sm.matchTablet(ipad10, { w: 2736, h: 1824 }).ok);   // a Surface Pro 7
    assert.ok(!sm.matchTablet(ipad10, { w: 0, h: 0 }).ok);
});

test('a listed tablet gives mm per CSS pixel that does not depend on display scaling', () => {
    const choice = { kind: 'tablet', name: 'Surface Pro 7' };
    const screen = { w: 2736, h: 1824 };
    // At 200% a CSS pixel is two device pixels; at 150% it is one and a half.
    assert.equal(sm.mmPerCssPx(choice, 2, screen), 0.0951 * 2);
    assert.equal(sm.mmPerCssPx(choice, 1.5, screen), 0.0951 * 1.5);
    // A gap of 20 CSS px at 200% is the same physical distance as 26.67 at 150%.
    const a = 20 * sm.mmPerCssPx(choice, 2, screen);
    const b = (40 / 1.5) * sm.mmPerCssPx(choice, 1.5, screen);
    assert.ok(Math.abs(a - b) < 1e-9);
});

test('the screen size is snapped to a known size when the scaling rounds it', () => {
    // Ken's screen, November 27 2026: 1920 x 1080 at 115%, reported as 1670 x 940.
    assert.deepEqual(sm.screenSize(1670, 940, 1.149999976158142), { long: 1920, short: 1080, exact: true });
    // 125% on a 2256 x 1504 Surface Laptop: 1804.8 x 1203.2, reported 1805 x 1204.
    assert.deepEqual(sm.screenSize(1805, 1204, 1.25), { long: 2256, short: 1504, exact: true });
    // Upright, the same answer.
    assert.deepEqual(sm.screenSize(940, 1670, 1.15), { long: 1920, short: 1080, exact: true });
    // A whole-number ratio has no rounding to undo, so it is exact as reported.
    assert.deepEqual(sm.screenSize(1180, 820, 2), { long: 2360, short: 1640, exact: true });
    // An unknown screen at an odd scaling: the calculated figure, marked as not exact.
    assert.deepEqual(sm.screenSize(1000, 700, 1.15), { long: 1150, short: 805, exact: false });
});

test('no two known screen sizes are close enough to be mistaken for each other', () => {
    const all = [...sm.COMMON_SCREENS, ...sm.TABLETS.map(t => [t.long, t.short])];
    const uniq = [...new Map(all.map(s => [s.join('x'), s])).values()];
    // The widest rounding error allowed for is 3 pixels (at 300%), so any two sizes
    // must differ by more than 6 on at least one side.
    for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
            const [a, b] = uniq[i], [c, d] = uniq[j];
            assert.ok(Math.abs(a - c) > 6 || Math.abs(b - d) > 6, `${a}x${b} and ${c}x${d}`);
        }
    }
});

test('a tablet that does not match this screen gives no millimetres', () => {
    assert.equal(sm.mmPerCssPx({ kind: 'tablet', name: 'iPad 10th generation' }, 2, { w: 1920, h: 1080 }), null);
    assert.equal(sm.mmPerCssPx({ kind: 'tablet', name: 'No such tablet' }, 2, null), null);
    assert.equal(sm.mmPerCssPx(null, 2, null), null);
});

test('a card measurement is trusted only at the scaling it was taken at', () => {
    const c = sm.cardChoice(280, 2);
    assert.ok(Math.abs(c.mmPerCssPx - sm.CARD_SHORT_MM / 280) < 1e-12);
    assert.equal(sm.mmPerCssPx(c, 2), c.mmPerCssPx);
    assert.equal(sm.mmPerCssPx(c, 1.5), null);
    assert.equal(sm.cardChoice(0, 2), null);
});

test('the stored choice is checked before use', () => {
    assert.ok(sm.isValidChoice(null));
    assert.ok(sm.isValidChoice({ kind: 'tablet', name: 'iPad 10th generation' }));
    assert.ok(sm.isValidChoice({ kind: 'card', mmPerCssPx: 0.19, dpr: 2 }));
    assert.ok(!sm.isValidChoice({ kind: 'card', mmPerCssPx: -1, dpr: 2 }));
    assert.ok(!sm.isValidChoice({ kind: 'other' }));
    assert.ok(!sm.isValidChoice([]));
});

test('the reading shows millimetres and screen pixels, or only pixels when unknown', () => {
    assert.equal(sm.describeDistance(16, 2, 0.1924), '3.1 mm (32 screen pixels)');
    assert.equal(sm.describeDistance(16, 2, null), '32 screen pixels');
    assert.equal(sm.describeDistance(0, 2, 0.19), '0.0 mm (0 screen pixels)');
    assert.equal(sm.describeDistance(0.5, 2, null), '1 screen pixel');
});

test('the tablet choice stays with the screen it describes', async () => {
    const { SCREEN_BOUND } = await import('../app/js/platform.js');
    assert.ok(SCREEN_BOUND.screenScale);
});

test('the border circles take their size from the real pixel size, not CSS mm', () => {
    const css = fs.readFileSync(new URL('../app/css/styles.css', import.meta.url), 'utf8');
    const rule = css.slice(css.indexOf('.layout-handle {'), css.indexOf('}', css.indexOf('.layout-handle {')));
    assert.match(rule, /width:\s*var\(--handle-d/);
    assert.match(rule, /height:\s*var\(--handle-d/);
});
