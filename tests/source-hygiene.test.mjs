/* Tier 1 — source hygiene. Guards a class of damage that is INVISIBLE by construction.
 *
 * ⚠ WHY THIS EXISTS (Ken, September 8 2026: "I want to kill these ongoing problems and
 * never allow them to resurrect!"). Writing a file through a shell heredoc puts the text
 * through several quoting layers, and each one may consume a backslash escape. A regex
 * written as `\bRelease` arrives in the file as a literal BACKSPACE byte followed by
 * "Release". The file still parses, the script still runs, and the pattern silently
 * matches NOTHING — so a check built that way reports everything clean while testing
 * nothing at all. That happened twice in one session, in the two scripts written to stop
 * documents rotting, which is the worst possible place for a check that only pretends to
 * run.
 *
 * The knowledge was already recorded and did not prevent it, twice. So it is enforced
 * here instead: a stray control byte can no longer reach a commit, whatever anyone
 * remembers. This is the whole point — the failure is not that the byte gets written, it
 * is that nothing downstream ever notices.
 *
 * THE RULE FOR WRITING FILES: content containing a backslash (any regex, any escape, any
 * Windows path) goes through the Write tool, not a heredoc. Where a heredoc is genuinely
 * unavoidable, build the backslash as `chr(92)` / `bytes([92])` so no quoting layer can
 * touch it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Text files git is actually tracking. Using git's own list means generated artifacts,
// node_modules and the git-ignored .docx are all out of scope for free, and a new
// directory is covered the moment it is committed rather than when someone remembers.
function trackedTextFiles() {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
    const exts = new Set(['.mjs', '.js', '.py', '.json', '.md', '.html', '.css', '.ps1',
                          '.yml', '.yaml', '.txt', '.gs', '.sh', '.bat']);
    return out.split('\0')
        .filter(Boolean)
        .filter((f) => exts.has(path.extname(f).toLowerCase()));
}

// Bytes that have no business in source. TAB (9), LF (10) and CR (13) are legitimate;
// FF (12) appears as a deliberate page break in some old text files, so it is allowed
// too. Everything else in the C0 range arrived by accident — a consumed escape.
function strayControlBytes(buf) {
    const bad = [];
    for (let i = 0; i < buf.length; i++) {
        const b = buf[i];
        if (b < 32 && b !== 9 && b !== 10 && b !== 12 && b !== 13) {
            bad.push({ offset: i, byte: b });
        }
    }
    return bad;
}

test('no source file contains a stray control byte from a consumed escape', () => {
    const files = trackedTextFiles();
    assert.ok(files.length > 100, `expected a real file list, got ${files.length}`);

    const offenders = [];
    for (const rel of files) {
        const buf = readFileSync(path.join(ROOT, rel));
        const bad = strayControlBytes(buf);
        if (!bad.length) continue;
        const { offset, byte } = bad[0];
        // Show the neighbourhood, because "byte 8 at offset 31402" is not actionable and
        // the surrounding text names the broken regex immediately.
        const near = buf.slice(Math.max(0, offset - 40), offset + 20)
            .toString('latin1').replace(/[\x00-\x1f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
        offenders.push(`${rel}: ${bad.length} stray byte(s), first 0x${byte.toString(16).padStart(2, '0')} near "${near}"`);
    }

    assert.deepEqual(offenders, [],
        'A control byte in source is almost always a backslash escape eaten by a shell '
        + 'quoting layer (\\b -> 0x08). The file still parses and the regex silently '
        + 'matches nothing. Write files containing backslashes with the Write tool.\n  '
        + offenders.join('\n  '));
});

// The guard above is only worth having if it would actually fire, and a scan that
// silently matches nothing is the exact failure it exists to catch — so it is tested
// against the real byte rather than trusted.
test('the scan detects the byte that caused this — \\b eaten to 0x08', () => {
    const damaged = Buffer.from(`m = re.search(r'${String.fromCharCode(8)}Release', line)`, 'latin1');
    const found = strayControlBytes(damaged);
    assert.equal(found.length, 1, 'the planted backspace must be found');
    assert.equal(found[0].byte, 8);

    const healthy = Buffer.from("m = re.search(r'\\bRelease', line)\n\t# tabs and newlines are fine\r\n");
    assert.deepEqual(strayControlBytes(healthy), [], 'tab, LF and CR must not be flagged');
});
