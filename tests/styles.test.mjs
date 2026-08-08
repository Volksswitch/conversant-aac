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
    for (const decl of ['--ep-cell-w:', '--ep-cell-h:', '--ui-btn-min-w:', '--ui-btn-min-h:',
                        '--app-margin:', '--dock-sep:', '--grid-gap:', '--btn-min-dim:']) {
        assert.ok(css.includes(decl), `${decl} is not declared anywhere in styles.css`);
    }
    // --ep-cell-* must be defined for BOTH dock modes; one alone means the other
    // silently falls back to the 0px fallback and every derived size collapses.
    // Each mode has SEVERAL rules (--dock-w/-h is set in one of them), so this looks
    // for a block that sets --ep-cell-*, not merely the first block for that selector.
    for (const mode of ['body.conv-bottom', 'body.conv-side']) {
        const blocks = [];
        for (let at = css.indexOf(`${mode} {`); at >= 0; at = css.indexOf(`${mode} {`, at + 1)) {
            blocks.push(css.slice(at, css.indexOf('}', at)));
        }
        assert.ok(blocks.length, `no "${mode} {" rule at all — did a malformed comment eat it?`);
        assert.ok(blocks.some(b => /--ep-cell-[wh]:/.test(b)),
            `no "${mode}" rule sets --ep-cell-* — Express-derived button sizing has silently collapsed to its floor`);
    }
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
