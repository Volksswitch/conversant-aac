// Does the colour-blind scheme actually help? (Ken, September 3 2026)
//
// WHY THIS EXISTS. "Colour-blind safe" is a claim about how the app looks to
// somebody whose eyes we do not have, so it is the one scheme that cannot be
// checked by looking. Contrast ratios say nothing about it — two colours can both
// be perfectly legible and be the same colour to a red-green viewer, which is
// exactly the fault in the default palette. So this simulates the three kinds of
// colour blindness and measures how far apart the four response categories land.
//
// WHAT IT FOUND, and it changed the design rather than confirming it: four
// categories CANNOT be well separated by hue alone under dichromacy while keeping
// colours that still mean what they should. A search allowed to ignore meaning
// reached a separation of 56, but only by making "declining" pure red — which the
// app deliberately avoids, because declining is normal and not an error. The
// colours below get the two COMMON types roughly double the separation Default
// gives them, and the left bar's STYLE (solid / double / dashed / dotted) carries
// the category for everyone else. That shape coding was going to be skipped as
// redundant; the measurement is what showed it is load-bearing.
//
// WHAT IT CANNOT CHECK: whether a real person with colour blindness finds it easy.
// Simulation is a model, and the thresholds here are a judgement. This says the
// scheme is better than Default by a stated amount, not that it is sufficient.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const css = readFileSync(new URL('../app/css/styles.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

function paletteAt(at, label) {
    assert.ok(at >= 0, `${label} is not in styles.css`);
    const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
    const out = {};
    for (const part of body.split(';')) {
        const i = part.indexOf('--');
        const c = part.indexOf(':', i);
        if (i < 0 || c < 0) continue;
        out[part.slice(i + 2, c).trim()] = part.slice(c + 1).trim();
    }
    return out;
}

const paletteOf = selector => paletteAt(css.indexOf(selector), selector);

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = c => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};

function channels(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}

const apply = (M, v) => M.map(row => row.reduce((s, m, i) => s + m * v[i], 0));

// Viénot, Brettel & Mollon (1999): convert to long/medium/short cone response,
// collapse the missing cone, convert back.
const RGB_TO_LMS = [[0.31399022, 0.63951294, 0.04649755],
                    [0.15537241, 0.75789446, 0.08670142],
                    [0.01775239, 0.10944209, 0.87256922]];
const LMS_TO_RGB = [[5.47221206, -4.6419601, 0.16963708],
                    [-1.1252419, 2.29317094, -0.1678952],
                    [0.02980165, -0.19318073, 1.16364789]];
const COLLAPSE = {
    // red cones missing — about 1% of men
    protanopia: [[0, 1.05118294, -0.05116099], [0, 1, 0], [0, 0, 1]],
    // green cones missing — about 6% of men, the commonest by far
    deuteranopia: [[1, 0, 0], [0.9513092, 0, 0.04866992], [0, 0, 1]],
    // blue cones missing — vanishingly rare, roughly 1 in 10,000
    tritanopia: [[1, 0, 0], [0, 1, 0], [-0.86744736, 1.86727089, 0]],
};

function simulate(hex, kind) {
    const lin = channels(hex).map(toLinear);
    if (!kind) return lin;
    return apply(LMS_TO_RGB, apply(COLLAPSE[kind], apply(RGB_TO_LMS, lin))).map(toSrgb).map(toLinear);
}

// CIE L*a*b*, so "how different do these look" is a perceptual number rather than
// an arithmetic one. A difference of about 2.3 is the smallest a person can see;
// the thresholds below are far above that.
function lab(linear) {
    const [r, g, b] = linear;
    const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
    const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(Math.max(X, 0) / 0.95047), fy = f(Math.max(Y, 0)), fz = f(Math.max(Z, 0) / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function distance(a, b, kind) {
    const A = lab(simulate(a, kind)), B = lab(simulate(b, kind));
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

const SLOTS = ['slot-preferred', 'slot-dispreferred', 'slot-initiative', 'slot-repair'];

function closestPair(palette, kind) {
    let worst = { d: Infinity, a: '', b: '' };
    for (let i = 0; i < SLOTS.length; i++) {
        for (let j = i + 1; j < SLOTS.length; j++) {
            const d = distance(palette[SLOTS[i]], palette[SLOTS[j]], kind);
            if (d < worst.d) worst = { d, a: SLOTS[i], b: SLOTS[j] };
        }
    }
    return worst;
}

// By INDEX, not by re-searching for ':root' — there is more than one, and the first
// holds only the root font size. Searching for the string found that one and read a
// palette with no colours in it at all.
function lightPalette() {
    const at = css.indexOf('--surface-page:');
    return paletteAt(css.lastIndexOf(':root', at), 'the default palette');
}

test('the four response kinds stay apart for the COMMON kinds of colour blindness', () => {
    // Protanopia and deuteranopia together are about 8% of men — nearly all colour
    // blindness. 25 is a comfortable margin: about ten times the smallest visible
    // difference, and roughly double what the default palette manages.
    const cb = paletteOf(':root[data-theme="cb"]');
    for (const kind of ['protanopia', 'deuteranopia']) {
        const { d, a, b } = closestPair(cb, kind);
        assert.ok(d >= 25,
            `under ${kind} the closest pair is ${d.toFixed(1)} apart (${a} vs ${b}); 25 is the bar`);
    }
});

test('the colour-blind scheme is a real improvement on the default palette', () => {
    // The point of the scheme, stated as a comparison rather than an absolute — if
    // a future palette change made Default better, this should stop claiming credit.
    const light = lightPalette();
    const cb = paletteOf(':root[data-theme="cb"]');
    for (const kind of ['protanopia', 'deuteranopia']) {
        const before = closestPair(light, kind).d;
        const after = closestPair(cb, kind).d;
        assert.ok(after > before * 1.4,
            `under ${kind} the scheme separates the categories by ${after.toFixed(1)} against ` +
            `Default's ${before.toFixed(1)} — not enough of a difference to be worth a scheme`);
    }
});

test('the category is ALSO carried by the shape of the bar, not colour alone', () => {
    // Load-bearing, not decorative. Colour cannot separate four categories under
    // tritanopia or total colour blindness, so the bar's style is what covers those
    // — and it must be four DIFFERENT styles or it says nothing.
    const styles = new Map();
    for (const slot of SLOTS) {
        const at = css.indexOf(`:root[data-theme="cb"] .response-card.${slot}`);
        assert.ok(at >= 0, `the colour-blind scheme sets no bar style for .${slot}`);
        const body = css.slice(at, css.indexOf('}', at));
        const m = body.match(/border-left-style:\s*([a-z]+)/);
        assert.ok(m, `.${slot} has no border-left-style in the colour-blind scheme`);
        styles.set(slot, m[1]);
    }
    assert.equal(new Set(styles.values()).size, SLOTS.length,
        `the four categories must use four different bar styles, not ${[...styles.values()].join('/')}`);
});

test('the bar style never changes the bar WIDTH', () => {
    // A wider bar is a wider card is a moved keyguard hole. `double` draws two lines
    // inside the same 6px and `dashed` breaks the same 6px up, so style is free where
    // width is not — but only as long as nobody adds a width here.
    for (const slot of SLOTS) {
        const at = css.indexOf(`:root[data-theme="cb"] .response-card.${slot}`);
        const body = css.slice(at, css.indexOf('}', at));
        assert.ok(!/width/.test(body),
            `.${slot} sets a width in the colour-blind scheme — that moves every hole after it`);
    }
});

test('the bar style is scoped to the CARD, not to the slot class', () => {
    // ⚠ The half that actually bit. The slot class sits on the response CELL too, and
    // a cell has no border: border-left-style is `none`. Naming the slot class alone
    // gave the cell a style, which let the browser's default `medium` width take
    // effect — 0px none became 3px solid — and every card shifted 3px right and lost
    // 3px of width. Setting a border STYLE on something whose width you have not set
    // IS a width change. Measured in the browser; invisible to the width check above.
    for (const slot of SLOTS) {
        const bare = `:root[data-theme="cb"] .${slot}`;
        const scoped = `:root[data-theme="cb"] .response-card.${slot}`;
        assert.ok(css.includes(scoped), `the bar style for .${slot} must be scoped to .response-card`);
        // The bare form must not appear anywhere except as the start of the scoped one.
        let at = css.indexOf(bare);
        while (at >= 0) {
            const isScoped = css.startsWith(scoped, css.lastIndexOf(':root', at));
            assert.ok(isScoped,
                `":root[data-theme=\"cb\"] .${slot}" is unscoped — it matches the response CELL ` +
                `as well as the card, which gives the cell a 3px border and moves every keyguard hole`);
            at = css.indexOf(bare, at + 1);
        }
    }
});
