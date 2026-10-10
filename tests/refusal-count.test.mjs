/* An AI refusal is counted on its own, never as an ordinary failure (Ken, October 9 2026).
 * app.js cannot be loaded by a test, so the decision is checked at source level, and
 * the reading end is driven for real.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EV } from '../app/js/metrics.js';

const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n').replace(/^\s*\/\/.*$/gm, '');

test('a refusal has its own event name', () => {
    assert.equal(EV.AI_REFUSED, 'ai_refused');
});

test('both generation failure paths go through the one classifier', () => {
    assert.match(app, /if \(isRefusal\(err\)\) return metrics\.EV\.AI_REFUSED;/);
    assert.match(app, /err\.stopReason === 'refusal'/);
    const direct = app.match(/metrics\.event\(metrics\.EV\.GENERATION_FAILED/g) || [];
    assert.equal(direct.length, 0, 'a failure path bypasses failureEvent');
    assert.ok((app.match(/metrics\.event\(failureEvent\(err\)/g) || []).length >= 2);
});

test('evaluate beta reads and reports refusals', async () => {
    const agg = readFileSync(new URL('../scripts/beta-eval/aggregate.mjs', import.meta.url), 'utf8');
    const ren = readFileSync(new URL('../scripts/beta-eval/render.mjs', import.meta.url), 'utf8');
    assert.match(agg, /aiRefused: num\(ev\.ai_refused\)/);
    assert.match(ren, /totals\.aiRefused/);
});
