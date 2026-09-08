// Structural sanity checks on styles.css.
//
// WHY THIS EXISTS: on August 2 2026 an edit closed a comment and then left two more
// prose lines ending in a second `*/`. CSS has no nested comments, so the parser read
// `…that axis. */ body.conv-bottom` as one invalid selector and DROPPED THE WHOLE
// RULE. That rule defined --ep-cell-w/h, so the Express-derived button sizing (Rule
// 15) silently reverted to its floor everywhere — no error, no console warning, and
// the app looked entirely normal. It was found only because a button measured 56px
// when it should have been 100px.
//
// A dropped CSS rule is invisible by construction, which is exactly why it is worth a
// test. These checks are deliberately cheap and syntactic — this is not a CSS parser,
// it is a tripwire for the mistakes that cost an afternoon.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(root, 'app', 'css', 'styles.css'), 'utf8');

function lineOf(index) {
    return css.slice(0, index).split('\n').length;
}

test('comments are well formed — no stray or unclosed markers', () => {
    const stray = [];
    let i = 0, open = -1;
    while (i < css.length) {
        const nextOpen = css.indexOf('/*', i);
        const nextClose = css.indexOf('*/', i);
        if (open < 0) {
            if (nextClose >= 0 && (nextOpen < 0 || nextClose < nextOpen)) {
                // A `*/` with no comment open: the bug described above.
                stray.push(`line ${lineOf(nextClose)}: "*/" with no open comment`);
                i = nextClose + 2;
                continue;
            }
            if (nextOpen < 0) break;
            open = nextOpen;
            i = nextOpen + 2;
        } else {
            if (nextClose < 0) {
                stray.push(`line ${lineOf(open)}: comment opened and never closed`);
                break;
            }
            open = -1;
            i = nextClose + 2;
        }
    }
    assert.deepEqual(stray, [], `malformed comments (a rule after one of these is silently dropped):\n  ${stray.join('\n  ')}`);
});

test('braces balance', () => {
    let depth = 0, badAt = null;
    for (let i = 0; i < css.length; i++) {
        // Skip comment bodies so a brace inside prose does not count.
        if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? css.length : e + 1; continue; }
        if (css[i] === '{') depth++;
        else if (css[i] === '}') { depth--; if (depth < 0 && badAt === null) badAt = lineOf(i); }
    }
    assert.equal(badAt, null, `unmatched "}" at line ${badAt}`);
    assert.equal(depth, 0, `${depth} unclosed "{"`);
});

test('the tokens the layout is built on are still defined', () => {
    // Each of these is load-bearing and each failed silently when its rule was
    // dropped: the layout still renders, just at the wrong size.
    for (const decl of ['--ep-cell-h:', '--app-margin:', '--dock-sep:',
                        '--grid-gap:', '--btn-min-dim:']) {
        assert.ok(css.includes(decl), `${decl} is not declared anywhere in styles.css`);
    }
    // --ep-cell-h must be defined for BOTH dock modes; one alone means the other
    // silently falls back and the compose icon collapses to its floor. Each mode has
    // SEVERAL rules (--dock-w/-h is set in one of them), so this looks for a block
    // that sets --ep-cell-h, not merely the first block for that selector.
    for (const mode of ['body.conv-bottom', 'body.conv-side']) {
        const blocks = [];
        for (let at = css.indexOf(`${mode} {`); at >= 0; at = css.indexOf(`${mode} {`, at + 1)) {
            blocks.push(css.slice(at, css.indexOf('}', at)));
        }
        assert.ok(blocks.length, `no "${mode} {" rule at all — did a malformed comment eat it?`);
        assert.ok(blocks.some(b => /--ep-cell-h:/.test(b)),
            `no "${mode}" rule sets --ep-cell-h — the compose icon has silently collapsed to its floor`);
    }
});

test('the removed sizing tokens have not crept back', () => {
    // --ui-btn-min-w/h made every Settings button inherit a size from the Express
    // Panel, and --gap-min was a second spacing control that only ever duplicated the
    // first. Both were removed in September 2026 (see the notes in styles.css). A
    // half-restored version of either is worse than either state: a token declared and
    // read in one place while everything else has moved on is exactly the kind of
    // silent size change this file exists to catch.
    for (const gone of ['--ui-btn-min-w', '--ui-btn-min-h', '--gap-min', '--ep-cell-w']) {
        assert.ok(!css.includes(gone),
            `${gone} is back in styles.css — it was deliberately removed; see the note on --ep-cell-h`);
    }
});

test('the credential rows are styled by class, never by a list of ids', () => {
    // ⚠ THIS FAULT HAS SHIPPED THREE TIMES IN ONE SECTION, and each time it looked like
    // harmless duplication rather than a bug: the rule existed only for the services
    // somebody had remembered to list, so adding a service silently produced an
    // unstyled one. The credential rows stacked vertically (September 8 2026); the
    // voice pickers would have stayed on screen beside the one in use; and the redacted
    // key showed in monospace for two services and the proportional font for four -
    // "the fonts used in the 6 Keys for paid services boxes are not consistent."
    //
    // A service must be a block of markup and nothing else, so nothing here may key off
    // a service's id. Adding one now fails the build instead of the eye.
    // ⚠ COMMENTS ARE STRIPPED FIRST. Every one of these fixes explains itself by
    // QUOTING the selector it replaced, so scanning the raw file makes the fix trip the
    // guard that exists because of it - which is how this test failed on its first run.
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

    // ⚠ THE LIST USED TO BE THE FIVE SERVICE NAMES, AND THAT IS WHY IT MISSED ONE. The
    // Anthropic key row is the same control — a key field, "Paste", "Test" — and it was
    // styled by id under a name no service list contains, so it kept a Paste button a
    // point smaller than every other one and a different background, and the guard
    // written the day before said nothing. A rule that only covers the names somebody
    // listed has the very defect it is checking for.
    //
    // So it now covers every id that names a CREDENTIAL OR VOICE CONTROL, whatever the
    // service is called.
    const idsInRules = rules.match(/#[A-Za-z][A-Za-z0-9_-]*/g) || [];
    const credentialish = /(Key|Voice|Partner)(Row|Input|Btn|Select|Status)$|Row$/;
    // Genuinely per-control, and named rather than pattern-matched so each is a decision:
    //   azureRegionRow  - narrower, because a region name is about ten characters
    //   apiKeyPrompt/folderPrompt - pre-start cards, not credential rows at all
    const allowed = new Set(['#azureRegionRow', '#apiKeyPrompt', '#folderPrompt',
                             '#folderPromptRow', '#storageDurabilityRow', '#dataFolderRow',
                             '#usageBreakdown', '#errorLogActions', '#usageSummaryActions',
                             '#systemInfoActions', '#problemReportActions', '#folderBackupRow']);
    const offenders = [...new Set(idsInRules)]
        .filter((id) => credentialish.test(id) && !allowed.has(id));
    assert.deepEqual(offenders, [],
        'these controls are styled by id: ' + offenders.join(', ')
        + ' — style them against .key-row / .voice-row / .key-redacted instead. An id '
        + 'list only reaches the controls somebody remembered, so the next one added '
        + 'silently misses the rule; that has now happened four times in this section.');
    assert.match(rules, /^\.key-redacted\s*\{/m,
        'the redacted-key font must hang off the bare class');
});

test('a blank Express cell holds the same box as a button (keyguard alignment)', () => {
    // Under box-sizing: border-box a flex item's basis:0 is floored at its own
    // padding + border, so a blank cell WITHOUT them resolves narrower than the
    // button beside it and every cell after it shifts along -- measured 129px vs
    // 146px before this was fixed. Matching `flex` alone is not enough, which is
    // exactly why this reads the box properties rather than trusting the flex value.
    const css = readFileSync(new URL('../app/css/styles.css', import.meta.url), 'utf8');
    const at = css.indexOf('.ep-cell-blank {');
    assert.ok(at >= 0, '.ep-cell-blank rule is missing entirely');
    const block = css.slice(at, css.indexOf('}', at));
    for (const prop of ['padding:', 'border:', 'border-left:']) {
        assert.ok(block.includes(prop),
            `.ep-cell-blank must declare ${prop} to match .ep-btn's box, or blank cells misalign the keyguard`);
    }
});

test('an undefined Express cell changes only colour, never its box', () => {
    // Same keyguard hazard from the other direction. An undefined cell inherits
    // .ep-btn's box by BEING an .ep-btn, so the rule may restyle it but must never
    // touch a property that changes its measured size -- most temptingly the 5px
    // left bar, which has to stay 5px wide and merely lose its colour.
    const css = readFileSync(new URL('../app/css/styles.css', import.meta.url), 'utf8');
    const at = css.indexOf('.ep-btn.ep-undefined {');
    assert.ok(at >= 0, '.ep-btn.ep-undefined rule is missing entirely');
    const block = css.slice(at, css.indexOf('}', at));
    for (const prop of ['padding', 'border-width', 'border-left-width', 'border:', 'border-left:', 'min-width', 'min-height', 'font-size']) {
        assert.ok(!block.includes(prop),
            `.ep-btn.ep-undefined must not set ${prop} -- it would resize the cell and move every keyguard hole after it`);
    }
});

test('the two response-card text sizes are wired to separate scales', () => {
    // The full response and the AI's short label are sized apart (Ken, August 25
    // 2026), and each scale follows its FORM OF WORDS rather than the slot it sits
    // in -- so "the short version" is the same size whether it is the small line
    // under the response or the large line above it. A hint rule left on
    // --response-font-scale would make one of the four card modes ignore the
    // setting, which nothing on screen would announce.
    const css = readFileSync(new URL('../app/css/styles.css', import.meta.url), 'utf8');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    for (const [, selector, body] of rules) {
        if (!/font-size/.test(body)) continue;
        const sel = selector.trim();
        if (/\.response-hint\s*(,|$)/.test(sel) || /\.response-hint\b[^,]*$/.test(sel)) {
            assert.ok(!/--response-font-scale/.test(body),
                `${sel} sizes the short label, so it must use --hint-font-scale`);
        }
        if (/\.response-text\b[^,]*$/.test(sel)) {
            assert.ok(!/--hint-font-scale/.test(body),
                `${sel} sizes the full response, so it must use --response-font-scale`);
        }
    }
    assert.ok(/--hint-font-scale/.test(css), '--hint-font-scale is not used anywhere');
});

// --- The EDGE layer (Ken, September 3 2026) ------------------------------------
//
// WHY THESE EXIST: before this, 26 of the 29 boundaries in the app failed the 3:1
// that a user-interface boundary needs -- a response card's outline stood out from
// the page by 1.14:1 -- while every piece of TEXT was comfortably above the bar. The
// failure is invisible in the worst way: nothing is missing, nothing errors, the
// screen looks tidy, and a person with reduced contrast sensitivity sees one grey
// field instead of four cards. So the ratios are recomputed here rather than trusted
// to the comments beside them, and a new too-light border trips the second test.

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
function token(name) {
    // Read the declaration by hand rather than building a regex: this ran once as
    // `--edge:s*(...)` after a shell heredoc ate a backslash, matched nothing, and
    // reported a token that was plainly there as missing.
    const at = css.indexOf(name + ':');
    assert.ok(at >= 0, `${name} is not declared in styles.css`);
    const value = css.slice(at + name.length + 1, css.indexOf(';', at)).trim();
    assert.ok(/^#[0-9a-fA-F]{3,6}$/.test(value),
        `${name} is "${value}" — these tests can only check a plain hex colour`);
    return value;
}

// Every background an edge is actually drawn against. An edge only has to clear the
// bar on the surfaces it appears on -- but these are all of them, and the point of
// listing them is that a grey light enough to look right on white fails on the dock.
const SURFACES = {
    'the page': '#f0f0f0',
    'white (cards, inputs, panels)': '#ffffff',
    'the dock': '#e9edf0',
    'a settings panel': '#eceff1',
    'the settings tab column': '#f4f5f6',
    'the preferred card tint': '#eef6ef',
    'the dispreferred card tint': '#fbf2e6',
    'the initiative card tint': '#eaf1fa',
    'the repair card tint': '#f4ecf8',
};

test('--edge and --edge-strong are visible on every surface in the app', () => {
    for (const name of ['--edge', '--edge-strong']) {
        const colour = token(name);
        for (const [where, bg] of Object.entries(SURFACES)) {
            const r = ratio(colour, bg);
            assert.ok(r >= 3,
                `${name} (${colour}) measures ${r.toFixed(2)}:1 against ${where} (${bg}) — a boundary needs 3:1`);
        }
    }
});

test('--edge-strong is at least as strong as --edge', () => {
    // The two are a pair: --edge-strong outlines the things you act on. If a change
    // ever inverted them the names would lie and the emphasis would be backwards.
    const weak = ratio(token('--edge'), '#f0f0f0');
    const strong = ratio(token('--edge-strong'), '#f0f0f0');
    assert.ok(strong >= weak,
        `--edge-strong (${strong.toFixed(2)}:1) is weaker than --edge (${weak.toFixed(2)}:1) against the page`);
});

test('no border is drawn in a colour too light to be seen on a light surface', () => {
    // The tripwire. A literal in a border declaration that clears neither 3:1 against
    // the page nor near-white is the mistake this whole pass was undoing: it cannot
    // be a boundary anywhere in a light interface. Near-white IS allowed — a white
    // border on a dark or saturated fill is a real thing the app does (a chosen
    // colour swatch, a pressed key).
    const EXEMPT = new Set([
        // The scrollbar thumb's border is deliberately TRACK-coloured: it insets the
        // thumb rather than outlining it, so it is padding, not a boundary.
        '#e2e6ea',
    ]);
    const decl = /border(?:-(?:top|right|bottom|left))?(?:-color)?\s*:[^;{}]*?(#[0-9a-fA-F]{3,6})/g;
    const bad = [];
    for (const m of css.matchAll(decl)) {
        const colour = m[1];
        if (EXEMPT.has(colour.toLowerCase())) continue;
        if (luminance(colour) >= 0.85) continue;            // near-white, deliberate
        const r = ratio(colour, '#f0f0f0');
        if (r < 3) bad.push(`line ${lineOf(m.index)}: ${colour} is ${r.toFixed(2)}:1 against the page`);
    }
    assert.deepEqual(bad, [],
        `border colours too light to read as a boundary — use var(--edge) or var(--edge-strong):\n  ${bad.join('\n  ')}`);
});
