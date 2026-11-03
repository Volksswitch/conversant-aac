// The license (Ken, November 3 2026): Apache 2.0 with a NOTICE crediting Volksswitch.
// Fails if a package arrives under a license nobody has looked at, or if the deployed
// app starts loading scripts from elsewhere, which would need their licenses carried too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ALLOWED = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'Python-2.0',
    '(MIT OR GPL-3.0-or-later)', '(MIT AND Zlib)', 'BlueOak-1.0.0', '(MIT OR CC0-1.0)']);

test('LICENSE is Apache 2.0 and names the copyright holder', () => {
    const t = readFileSync('LICENSE', 'utf8');
    assert.match(t, /Apache License\s+Version 2\.0/);
    assert.match(t, /Grant of Patent License/);
    assert.match(t, /Copyright 2026 Volksswitch, LLC/);
});

test('NOTICE requires the credit to Conversant by Volksswitch', () => {
    assert.match(readFileSync('NOTICE', 'utf8'), /based on, Conversant AAC by Volksswitch/);
});

test('every package is under a license already checked', () => {
    const pkgs = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages;
    const bad = Object.entries(pkgs).filter(([k, v]) => k && !ALLOWED.has(v.license))
        .map(([k, v]) => `${k}: ${v.license}`);
    assert.deepEqual(bad, []);
});

test('the deployed app loads scripts only from itself', () => {
    const html = readFileSync('app/index.html', 'utf8');
    assert.match(html, /script-src 'self';/);
    assert.equal(/<script[^>]+src="https?:/.test(html), false);
});
