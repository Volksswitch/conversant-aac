/* Tier 1 — the document toolkit's own guarantees, run as part of `npm test`.
 *
 * ⚠ WHY THIS IS WIRED INTO npm test RATHER THAN LEFT AS A SCRIPT (Ken, September 8
 * 2026: "I want to kill these ongoing problems and never allow them to resurrect!").
 * The document tooling is the one part of this project with no automated gate, and it
 * is where the same faults kept coming back — helpers rewritten from scratch each
 * session, each rewrite re-earning the bugs the last one had already found. A guarantee
 * nobody runs is a guarantee nobody has.
 *
 * The Python file it drives is the real test; this is the wire that makes the suite
 * notice. `scripts/doc-generators/test_docx_safe.py` proves that docx_safe.save()
 * REFUSES each fault that has actually shipped — an emptied table cell, a duplicated
 * comment reference, an unbalanced field — and that the editing helpers do not create
 * them in the first place.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF_TEST = path.join(ROOT, 'scripts', 'doc-generators', 'test_docx_safe.py');

// Try the interpreters this machine actually has, rather than assuming one name.
function runPython(args) {
    for (const exe of ['python', 'python3', 'py']) {
        const r = spawnSync(exe, args, { cwd: ROOT, encoding: 'utf8' });
        if (!r.error) return r;
    }
    return null;
}

test('the document toolkit refuses to write a file Word would reject', () => {
    assert.ok(existsSync(SELF_TEST), 'the toolkit self-test is missing');

    const probe = runPython(['-c', 'import docx']);
    if (!probe) {
        // ⚠ SKIP LOUDLY, never silently. A silent skip is how a green run comes to mean
        // nothing — the same reasoning as the Word check in check-docs.py.
        console.warn('  ! SKIPPED: no Python interpreter found — the document toolkit '
                     + 'was NOT verified on this machine.');
        return;
    }
    if (probe.status !== 0) {
        console.warn('  ! SKIPPED: python-docx is not installed — the document toolkit '
                     + 'was NOT verified on this machine.');
        return;
    }

    const r = runPython([SELF_TEST]);
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    assert.equal(r.status, 0, `the document toolkit self-test failed:\n${out}`);
    // Guard against the self-test passing because it ran nothing at all.
    assert.match(out, /0 failure\(s\)/, `unexpected self-test output:\n${out}`);
    assert.ok((out.match(/^\s+ok\s/gm) || []).length >= 10,
        `expected the full self-test to run, got:\n${out}`);
});
