/* The guard that refuses Bash heredocs with a backslash in them (Ken, November 23 2026:
 * "This happens every time but continues to come as a surprise").
 *
 * Run the way Claude Code runs it: the script is started with the tool call as JSON on
 * its input, and the exit code decides (2 refuses, 0 lets the command run). Backslashes
 * here are built with String.fromCharCode(92), so this file cannot be damaged by the
 * very thing it guards against.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GUARD = fileURLToPath(new URL('../scripts/hooks/heredoc-backslash-guard.mjs', import.meta.url));
const BS = String.fromCharCode(92);
const NL = String.fromCharCode(10);

function run(payload) {
    const r = spawnSync(process.execPath, [GUARD], { input: typeof payload === 'string' ? payload : JSON.stringify(payload), encoding: 'utf8' });
    return { code: r.status, err: r.stderr };
}
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });

test('a heredoc with a backslash in it is refused, with the way round it', () => {
    const cmd = ["python - <<'EOF'", `print('a${BS}nb')`, 'EOF'].join(NL);
    const r = run(bash(cmd));
    assert.equal(r.code, 2);
    assert.match(r.err, /heredoc \(<<\) with a backslash/);
    assert.match(r.err, /Write or Edit tool/);
});

test('the November 23 2026 case is refused: a backslash-n inside a Python string in a heredoc', () => {
    const cmd = ["cd x && python - <<'EOF'", `s = '''input=\${inputs}${BS}${BS}n'''`, 'EOF'].join(NL);
    assert.equal(run(bash(cmd)).code, 2);
});

test('a heredoc without a backslash runs, so ordinary commit messages are untouched', () => {
    const cmd = ["git commit -q -F - <<'EOF'", 'Release 0.15.25', '', 'Co-Authored-By: someone', 'EOF'].join(NL);
    assert.equal(run(bash(cmd)).code, 0);
});

test('a backslash with no heredoc runs (a grep pattern, say)', () => {
    assert.equal(run(bash(`grep -c 'a${BS}|b' app/js/app.js`)).code, 0);
});

test('a backslash only BEFORE the heredoc does not count', () => {
    const cmd = [`grep -c 'a${BS}|b' f && cat <<'EOF'`, 'plain text', 'EOF'].join(NL);
    assert.equal(run(bash(cmd)).code, 0);
});

test('other tools, and input it cannot read, are let through', () => {
    assert.equal(run({ tool_name: 'Write', tool_input: { content: `<<${BS}` } }).code, 0);
    assert.equal(run('not json').code, 0);
    assert.equal(run('').code, 0);
});
