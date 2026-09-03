// The two themes (Ken, September 3 2026 — "do the naming work and ship light and dark").
//
// WHY THIS FILE EXISTS. Light and dark are the SAME token names with different
// values, so the way this breaks is not an error. A colour quietly stays light in
// the dark theme and the result is one unreadable label on one panel — which nobody
// notices until a user reports that a screen "went blank". The same shape as the
// dropped CSS rule and the false storage timeout: the screen looks fine and the
// thing that should complain says nothing. So the ratios are recomputed here rather
// than trusted to the comments beside them.
//
// WHAT IT CANNOT CHECK, stated so a green run is never read as "the theme is good":
// whether the dark palette is pleasant, whether two hues that both pass are
// nonetheless confusable, and whether a colour that passes on a token pair is
// actually used on that pair in the app. The live sweep in a browser covers the
// last of those; the first two need eyes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const rawCss = readFileSync(new URL('../app/css/styles.css', import.meta.url), 'utf8');

// Blank out comment BODIES while keeping every character position, so prose about a
// token is never read as a declaration of it and reported line numbers still point
// at the real file. Newlines are kept so the line count is unchanged. (Found the
// hard way: the first version of these tests reported "--edge-strong has no dark
// value" because it had parsed the sentence explaining --edge-strong.)
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g,
    m => m.replace(/[^\n]/g, ' '));

function lineOf(index) {
    return css.slice(0, index).split('\n').length;
}

function luminance(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

function ratio(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Read the `--name: value` pairs out of one rule. Hand-parsed rather than by regex:
// a doubled backslash has been eaten by a shell heredoc in this repo before, which
// turned a working pattern into one that silently matched nothing.
function paletteBlock(startIndex, label) {
    assert.ok(startIndex >= 0, `no ${label} rule in styles.css`);
    const open = css.indexOf('{', startIndex);
    const close = css.indexOf('}', open);
    const out = {};
    for (const line of css.slice(open + 1, close).split(';')) {
        const i = line.indexOf('--');
        if (i < 0) continue;
        const c = line.indexOf(':', i);
        if (c < 0) continue;
        out[line.slice(i + 2, c).trim()] = line.slice(c + 1).trim();
    }
    return out;
}

// The light values share a :root with the layout tokens, so the block is found by a
// colour it must contain rather than by counting :root rules.
function lightPalette() {
    const at = css.indexOf('--surface-page:');
    assert.ok(at >= 0, '--surface-page is not declared — has the palette moved?');
    return paletteBlock(css.lastIndexOf(':root', at), 'the light palette');
}

function darkPalette() {
    return paletteBlock(css.indexOf(':root[data-theme="dark"]'), 'the dark theme');
}

// ⚠ WHETHER A TOKEN NEEDS A DARK VALUE IS DECIDED BY ITS VALUE, NEVER BY ITS NAME.
// The first version of this test carried a list of name prefixes and let SIX real
// colours through, because they predated the palette and were not called what the
// list expected: --header, --state-unconfirmed, --state-generating, --state-ready,
// --pred-ghost-color and --pred-ghost-bg. A name list excuses whatever nobody
// thought to add to it; "does this hold a colour?" cannot be forgotten.
//
// A token holding a var() reference is exempt and that is the point of it: --state-
// unconfirmed now says var(--slot-dispreferred), so it has one definition and
// follows the theme without needing a second value of its own.
const holdsLiteralColour = value => /#[0-9a-fA-F]{3,8}|rgba?\(/.test(value);

test('every colour is defined in BOTH themes', () => {
    const light = lightPalette();
    const dark = darkPalette();
    const lightColours = Object.keys(light).filter(n => holdsLiteralColour(light[n]));

    const missingInDark = lightColours.filter(n => !(n in dark));
    const strayInDark = Object.keys(dark).filter(n => !(n in light));

    assert.deepEqual(missingInDark, [],
        `these colours have no dark value, so they stay LIGHT in dark mode: ${missingInDark.join(', ')}`);
    assert.deepEqual(strayInDark, [],
        `the dark theme sets colours the light theme never declares: ${strayInDark.join(', ')}`);
    assert.ok(lightColours.length > 60,
        `only ${lightColours.length} colours found — did the palette move?`);
});

test('the dark theme declares color-scheme, so native controls follow', () => {
    // Without it the parts the stylesheet does not paint — native scrollbars,
    // checkboxes, radio buttons, select menus, the controls inside dialogs — stay
    // light, and the panel looks half converted rather than dark.
    const at = css.indexOf(':root[data-theme="dark"]');
    const body = css.slice(at, css.indexOf('}', at));
    assert.ok(/color-scheme:\s*dark/.test(body),
        'the dark theme must set color-scheme: dark');
    const lightAt = css.indexOf('--surface-page:');
    const lightBody = css.slice(css.lastIndexOf(':root', lightAt), lightAt);
    assert.ok(/color-scheme:\s*light/.test(lightBody),
        'the light theme must set color-scheme: light, or a device in dark mode restyles the form controls');
});

// [what it is, foreground token, background token, the ratio it must clear]
// 4.5 for anything read as words, 3 for a boundary or any other non-text meaning.
const PAIRS = [
    ['body text', 'ink', 'surface-page', 4.5],
    ['body text on a card', 'ink', 'surface-raised', 4.5],
    ['body text on the settings panel', 'ink', 'surface-panel', 4.5],
    ['body text on the dock', 'ink', 'surface-sunken', 4.5],
    ['a heading', 'ink-strong', 'surface-panel', 4.5],
    ['a heading on a card', 'ink-strong', 'surface-raised', 4.5],
    ['muted text', 'ink-muted', 'surface-raised', 4.5],
    ['muted text on the panel', 'ink-muted', 'surface-panel', 4.5],
    ['faint text', 'ink-faint', 'surface-raised', 4.5],
    ['text on the emphasis button', 'accent-ink', 'accent', 4.5],
    ['a link', 'link', 'surface-raised', 4.5],
    ['a link on the page', 'link', 'surface-page', 4.5],
    ['danger text on its panel', 'danger-ink', 'danger-tint', 4.5],
    ['warning text on its panel', 'warn-ink', 'warn-tint', 4.5],
    ['confirmation text on its panel', 'ok-ink', 'ok-tint', 4.5],
    ['information text on its panel', 'info-ink', 'info-tint', 4.5],
    ['indigo text on its panel', 'indigo-ink', 'indigo-tint', 4.5],
    ['what the partner said', 'speaker-partner-ink', 'speaker-partner-bg', 4.5],
    ['what the user said', 'speaker-user-ink', 'speaker-user-bg', 4.5],
    ['a response on the preferred card', 'ink', 'slot-preferred-tint', 4.5],
    ['a response on the dispreferred card', 'ink', 'slot-dispreferred-tint', 4.5],
    ['a response on the initiative card', 'ink', 'slot-initiative-tint', 4.5],
    ['a response on the repair card', 'ink', 'slot-repair-tint', 4.5],
    ['a phrase in the Always band', 'ink', 'band-always-tint', 4.5],
    ['a phrase in the Context band', 'ink', 'band-context-tint', 4.5],
    ['a phrase in the Flex band', 'ink', 'band-flex-tint', 4.5],
    ['an edge on the page', 'edge', 'surface-page', 3],
    ['an edge on a card', 'edge', 'surface-raised', 3],
    ['an edge on the dock', 'edge', 'surface-sunken', 3],
    ['an edge on the panel', 'edge', 'surface-panel', 3],
    ['an edge on an off-white surface', 'edge', 'surface-raised-alt', 3],
    ['a strong edge on the page', 'edge-strong', 'surface-page', 3],
    ['a strong edge on a card', 'edge-strong', 'surface-raised', 3],
    ['a strong edge on the preferred tint', 'edge-strong', 'slot-preferred-tint', 3],
    ['a strong edge on the dispreferred tint', 'edge-strong', 'slot-dispreferred-tint', 3],
    ['a strong edge on the initiative tint', 'edge-strong', 'slot-initiative-tint', 3],
    ['a strong edge on the repair tint', 'edge-strong', 'slot-repair-tint', 3],
    ['the scrollbar thumb', 'edge-strong', 'surface-track', 3],
    ['the emphasis button against the page', 'accent', 'surface-page', 3],
    ['the partner bubble outline', 'speaker-partner-edge', 'surface-page', 3],
    ['the user bubble outline', 'speaker-user-edge', 'surface-page', 3],
    ['the preferred bar', 'slot-preferred', 'slot-preferred-tint', 3],
    ['the dispreferred bar', 'slot-dispreferred', 'slot-dispreferred-tint', 3],
    ['the initiative bar', 'slot-initiative', 'slot-initiative-tint', 3],
    ['the repair bar', 'slot-repair', 'slot-repair-tint', 3],
    ['a command button outline', 'slot-persistent', 'surface-page', 3],
    ['the Always band outline', 'band-always', 'band-always-tint', 3],
    ['the Context band outline', 'band-context', 'band-context-tint', 3],
    ['the Flex band outline', 'band-flex', 'band-flex-tint', 3],
    ['the partner mark', 'infl-partner', 'band-context-tint', 3],
    ['the feeling mark', 'infl-feeling', 'band-context-tint', 3],
    ['the place mark', 'infl-place', 'band-context-tint', 3],
    ['a choice button on the dock', 'choice', 'surface-sunken', 3],
    ['a danger fill on a card', 'danger', 'surface-raised', 3],
    ['a warning fill on a card', 'warn', 'surface-raised', 3],
    ['a confirmation fill on a card', 'ok', 'surface-raised', 3],
    ['an information fill on a card', 'info', 'surface-raised', 3],
    ['a card against the page', 'surface-raised', 'surface-page', 1.08],
];

test('both themes clear the contrast bars', () => {
    const themes = { light: lightPalette(), dark: darkPalette() };
    const bad = [];
    for (const [name, palette] of Object.entries(themes)) {
        for (const [what, fg, bg, min] of PAIRS) {
            const a = palette[fg], b = palette[bg];
            assert.ok(a && b, `${name}: --${fg} or --${bg} is not defined`);
            const r = ratio(a, b);
            if (r < min) {
                bad.push(`${name}: ${what} is ${r.toFixed(2)}:1, needs ${min} (--${fg} ${a} on --${bg} ${b})`);
            }
        }
    }
    assert.deepEqual(bad, [], `contrast below the bar:\n  ${bad.join('\n  ')}`);
});

test('no rule carries a raw colour — every colour comes from the palette', () => {
    // The durable half of the naming pass, and the one that keeps paying. A literal
    // cannot be themed, so one added later is a colour that stays put when the
    // lights go out, with nothing on screen to say so. Only the two palette blocks
    // may hold values; everything below them names one.
    const darkAt = css.indexOf(':root[data-theme="dark"]');
    assert.ok(darkAt >= 0, 'the dark theme block is missing');
    const offset = css.indexOf('}', css.indexOf('{', darkAt));
    const rest = css.slice(offset);

    // ⚠ A CUSTOM PROPERTY BELOW THE PALETTE COUNTS TOO, and skipping them is how the
    // first version of this test passed over a real bug. `.ep-btn.ep-band-always`
    // set `--band-tint: #e8eaf6` in its own rule; that is a colour like any other,
    // it was never themed, and in dark mode the Express Panel came out as pale
    // buttons with pale text on them — every phrase invisible. The test said
    // nothing, because it treated anything starting with `--` as a palette entry.
    // Only the two palette blocks may hold values, wherever the declaration sits.
    // ⚠ A CSS KEYWORD IS A COLOUR TOO. `background: white` is not a hex and not an
    // rgb(), and eight of them sat in this stylesheet through the first pass — which
    // is how the About Me screen came out as white panels with white text on them in
    // dark mode while every test was green. Keywords are matched as whole words and
    // only in a colour-carrying property, so `border-style: solid` and a token named
    // --indigo are not mistaken for one.
    const KEYWORDS = ['white', 'black', 'red', 'green', 'blue', 'yellow', 'orange',
        'purple', 'pink', 'brown', 'gray', 'grey', 'silver', 'navy', 'teal', 'olive',
        'maroon', 'lime', 'aqua', 'fuchsia', 'cyan', 'magenta', 'violet', 'gold',
        'crimson', 'coral', 'ivory', 'beige', 'tan', 'plum', 'khaki', 'salmon',
        'whitesmoke', 'gainsboro', 'lightgray', 'lightgrey', 'darkgray', 'darkgrey',
        'dimgray', 'dimgrey', 'lightblue', 'darkblue', 'lightgreen', 'darkgreen'];
    const keyword = new RegExp('(^|[^-\\w])(' + KEYWORDS.join('|') + ')([^-\\w]|$)', 'i');
    const carriesColour = p => /color/.test(p) || /^(background|border|outline|box-shadow|fill|stroke)/.test(p);

    const bad = [];
    const decl = /(?:^|[;{\n])[ \t]*([-a-zA-Z]+)[ \t]*:([^;{}]*)/g;
    for (const m of rest.matchAll(decl)) {
        const prop = m[1], value = m[2];
        const literals = value.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g) || [];
        // Strip var(--name) first, so a token called --indigo is not read as the
        // keyword `indigo` sitting in the value.
        const bare = value.replace(/var\([^)]*\)/g, ' ');
        const named = carriesColour(prop) && keyword.test(bare);
        if (literals.length || named) {
            bad.push(`line ${lineOf(offset + m.index)}: ${prop}:${value.trim()}`);
        }
    }
    assert.deepEqual(bad, [],
        `raw colours outside the palette — give each one a name instead:\n  ${bad.join('\n  ')}`);
});

test('the Express Panel hands CSS references, not colours', () => {
    // express-items.js sets these as inline custom properties, and a custom property
    // resolves where it is USED -- so a var() reference follows the theme and a hex
    // literal does not. This is the one place JS could silently pin a colour.
    const js = readFileSync(new URL('../app/js/express-items.js', import.meta.url), 'utf8');
    for (const name of ['INFLUENCER_COLORS', 'CHOICE_COLOR']) {
        const at = js.indexOf('export const ' + name);
        assert.ok(at >= 0, `${name} is missing from express-items.js`);
        const body = js.slice(at, js.indexOf(';', js.indexOf('}', at)) + 1);
        const literals = body.match(/#[0-9a-fA-F]{3,8}/g) || [];
        assert.deepEqual(literals, [],
            `${name} carries hex colours (${literals.join(', ')}) — these are rendered ` +
            `into the panel and would stay light in dark mode. Use var(--token) instead.`);
    }
});
