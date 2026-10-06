/* CR-222. Markup built from a value must escape that value.
 *
 * Most templates assigned to innerHTML pass every ${...} through escapeHtml (ui.js) or
 * esc (review-ui.js). Two did not, and both put FILE names from the data folder into
 * the page as markup (CR-221) - a crafted name could run code in the app, where the
 * API keys live. This fails on any ${...} inside a template assigned to innerHTML
 * unless it is escaped or named below with the reason it is safe.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../app/js/', import.meta.url);

// Expressions that are safe without escaping, each with its reason.
const ALLOW = [
    ['slot', 'a number the app computes (ui.js choice-button placeholder)'],
    ["on ? (sortAscending ? ' ▲' : ' ▼') : ''", 'fixed arrow characters (review-ui.js sort button)'],
    ['who', 'markup built just above from a fixed badge and esc(r.who) (review-ui.js)'],
    ['flag', 'markup built just above from a fixed phrase and a count (review-ui.js)'],
    ['r.progress.state', 'one of a fixed set of words from review-model.js, used as a class name'],
];
const SAFE_CALL = /^(escapeHtml|esc)\(/;

/** Every template literal assigned to innerHTML, with the line it starts on. */
function templatesAssigned(src) {
    const out = [];
    const re = /\.innerHTML\s*\+?=\s*/g;
    let m;
    while ((m = re.exec(src))) {
        // The right-hand side, up to the end of the statement.
        let i = m.index + m[0].length;
        let depth = 0; let inTpl = false; let start = -1; let nest = 0;
        for (; i < src.length; i++) {
            const ch = src[i];
            if (inTpl) {
                if (ch === '\\') { i++; continue; }
                if (ch === '`' && depth === 0) { out.push({ at: start, text: src.slice(start, i + 1) }); inTpl = false; continue; }
                if (ch === '$' && src[i + 1] === '{') { depth++; i++; continue; }
                if (ch === '}' && depth > 0) { depth--; continue; }
                continue;
            }
            if (ch === '`') { inTpl = true; start = i; depth = 0; continue; }
            // A semicolon inside a callback body is not the end of the statement.
            if (ch === '(' || ch === '{' || ch === '[') { nest++; continue; }
            if (ch === ')' || ch === '}' || ch === ']') { if (nest === 0) break; nest--; continue; }
            if (ch === ';' && nest === 0) break;
        }
    }
    return out;
}

/** The ${...} expressions directly inside a template (nested templates are scanned too). */
function expressions(tpl) {
    const out = [];
    for (let i = 0; i < tpl.length; i++) {
        if (tpl[i] === '$' && tpl[i + 1] === '{') {
            let depth = 1; let j = i + 2;
            for (; j < tpl.length && depth; j++) {
                if (tpl[j] === '{') depth++;
                else if (tpl[j] === '}') depth--;
            }
            out.push(tpl.slice(i + 2, j - 1).trim());
            i = j - 1;
        }
    }
    return out;
}

/** Unescaped values in a template, looking inside any template nested in a value. */
function valuesIn(tpl) {
    const out = [];
    for (const e of expressions(tpl)) {
        if (SAFE_CALL.test(e) || ALLOW.some(([x]) => x === e)) continue;
        if (e.includes('`')) {
            // A nested template (a .map callback, a ternary): its own values are what
            // reach the page, so those are checked; anything outside it is code.
            for (const inner of nestedTemplates(e)) out.push(...valuesIn(inner));
            continue;
        }
        out.push(e);
    }
    return out;
}

function nestedTemplates(code) {
    const out = [];
    for (let i = 0; i < code.length; i++) {
        if (code[i] !== '`') continue;
        let depth = 0; let j = i + 1;
        for (; j < code.length; j++) {
            if (code[j] === '\\') { j++; continue; }
            if (code[j] === '$' && code[j + 1] === '{') { depth++; j++; continue; }
            if (code[j] === '}' && depth > 0) { depth--; continue; }
            if (code[j] === '`' && depth === 0) break;
        }
        out.push(code.slice(i, j + 1));
        i = j;
    }
    return out;
}

test('every value put into markup through innerHTML is escaped', () => {
    const bad = [];
    for (const f of readdirSync(DIR).filter((n) => n.endsWith('.js'))) {
        const src = readFileSync(new URL(f, DIR), 'utf8');
        for (const t of templatesAssigned(src)) {
            const line = src.slice(0, t.at).split('\n').length;
            for (const e of valuesIn(t.text)) bad.push(`${f}:${line}: \${${e}}`);
        }
    }
    assert.deepEqual(bad, [], 'wrap the value in escapeHtml(...), build the element with textContent, '
        + 'or add it to ALLOW with the reason it is safe');
});
