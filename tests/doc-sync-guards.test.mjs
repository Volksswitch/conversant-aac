/* Tier 1 — the guards that decide whether a document may be synced at all.
 *
 * These assert that the CHECKS EXIST AND ARE WIRED IN, not that documents are clean:
 * the .docx are git-ignored OneDrive artifacts, so a test cannot depend on their
 * contents (the same reason the American-spelling test covers the app and not the
 * documents). What it can do is stop the rules being quietly unplugged, which is the
 * way every previous documentation rule decayed — it was written down, and then nothing
 * ran it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

/* Ken, September 8 2026: "There also shouldn't be any MS Word tracking records in any
 * docs when doc-sync is run. No 'added/deleted text' and no comments. If you encounter
 * those artifacts it means that that document is not a candidate for synching."
 *
 * It is load-bearing rather than tidy: the Architecture Overview carried 27 revisions
 * and 14 comments, a sync appended to a paragraph ending in a comment anchor, the
 * anchor was duplicated, and Word refused the file while every other check passed. */
test('the tracking-artifact rule exists and covers every kind of revision markup', () => {
    const p = 'scripts/doc-tests/check-tracking-artifacts.py';
    assert.ok(existsSync(path.join(ROOT, p)), `${p} is missing — the rule has no teeth`);
    const src = read(p);

    // Inserted and deleted text are the obvious two; the rest are what a reader skims
    // past, and a formatting revision is an unaccepted decision exactly like an edit.
    for (const tag of ['ins', 'del', 'moveFrom', 'moveTo', 'rPrChange', 'pPrChange']) {
        assert.match(src, new RegExp(`'${tag}'`),
            `revision type ${tag} is not detected`);
    }
    assert.match(src, /comments\.xml/, 'comments are not detected');
    assert.match(src, /commentReference/, 'comment anchors are not detected');
    // Tracking switched on with no changes yet is its own trap: the NEXT edit silently
    // becomes a revision, so an automated pass would fill the document with them.
    assert.match(src, /trackChanges/, 'track-changes-enabled is not detected');
});

test('check docs runs the tracking rule, and reports it before anything else', () => {
    const src = read('scripts/doc-tests/check-docs.py');
    // Match the CALL, not the definition: asserting on the bare name passes while the
    // rule sits defined and never invoked, which is precisely the silent failure being
    // guarded against (this test let exactly that mutation through on its first run).
    assert.match(src, /blocked\s*=\s*tracking_artifacts\(/,
        'check docs defines the tracking rule but no longer CALLS it');
    assert.match(src, /NOT CANDIDATES FOR SYNCING/,
        'check docs no longer reports blocked documents');
    // One implementation, not two: a second copy of the rule inside check-docs would
    // drift from the standalone script, which is the failure this project keeps paying
    // for. Delegation is the point.
    assert.match(src, /check-tracking-artifacts\.py/,
        'the rule must delegate rather than reimplement the detection');

    const blockedAt = src.indexOf('NOT CANDIDATES FOR SYNCING');
    const wordAt = src.indexOf('WORD WILL NOT OPEN');
    assert.ok(blockedAt > 0 && wordAt > 0 && blockedAt < wordAt,
        'blocked documents must be reported before the Word result — their presence '
        + 'changes what the rest of the run means');
});

test('both places that govern a sync carry the rule', () => {
    for (const file of ['CLAUDE.md', 'DOC-SYNC.md']) {
        assert.match(read(file), /NOT a candidate for syncing/i,
            `${file} does not state the tracked-changes rule`);
    }
    assert.match(read('CLAUDE.md'), /check-tracking-artifacts\.py/,
        'CLAUDE.md does not say how to check');
    // Accepting Ken's changes is accepting his decisions; deleting a comment discards a
    // question he asked. Neither is ours to do to unblock our own work.
    assert.match(read('CLAUDE.md'), /Do not run that script to unblock a sync/,
        'CLAUDE.md must forbid auto-accepting revisions to clear the block');
});
