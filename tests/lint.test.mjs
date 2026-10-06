/* A static check over the app's own code (CR-072).
 *
 * app.js cannot be loaded by a unit test, so a name used but never defined there is
 * invisible to every other test: the suite stays green and the first user to reach that
 * handler gets a crash. One rule catches that class; the other few are correctness
 * rules that found nothing and so cost no noise. Stylistic rules are deliberately left
 * off - the code uses `x && x.method()` on purpose and they would bury real findings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const bin = fileURLToPath(new URL('../node_modules/eslint/bin/eslint.js', import.meta.url));

test('the app code uses no undefined names', (t) => {
    if (!existsSync(bin)) {
        t.skip('eslint is not installed - run npm install. THIS CHECK DID NOT RUN.');
        return;
    }
    const r = spawnSync(process.execPath, [bin, '--no-eslintrc', '-c', 'tests/eslint-app.json',
        '--format', 'unix', 'app/js', 'app/sw.js'], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
});
