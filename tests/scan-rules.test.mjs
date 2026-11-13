// The rules that decide the next switch-scanning stop (app/js/scan-rules.js), checked
// without a browser. Each screen is a made-up tree shaped like the real one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScanner } from '../app/js/scan-rules.js';

const item = (key, extra = {}) => ({ key, kind: 'item', label: key, ...extra });
const group = (key, kids, extra = {}) => ({ key, kind: 'group', label: key, kids: () => kids, ...extra });
const leave = (key) => ({ key, kind: 'leave', label: 'Leave' });

// The conversation screen by region: options (with New 4), the Express Panel (entered
// directly, rows inside), In my own words, the Command Bar.
function conversation({ exit = 'pass', options = true } = {}) {
    const lv = (k) => (exit === 'leave' ? [leave('leave-' + k)] : []);
    return () => [
        ...(options ? [group('options', [item('opt0'), item('opt1'), item('new4'), ...lv('options')], { exitByPass: exit === 'pass' })] : []),
        group('express', [group('row0', [item('yes'), item('no')]), group('row1', [item('hi'), item('bye')]), ...lv('express')],
              { enterDirect: true, exitByPass: exit === 'pass' }),
        item('imow'),
        group('commands', [item('listen'), item('end', { needsTwo: true }), ...lv('commands')], { exitByPass: exit === 'pass' }),
    ];
}
const stop = (s) => (s.current() || {}).key;

test('the Express Panel is never a stop: reaching it goes straight to its first row', () => {
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass' } });
    s.reset();
    assert.equal(stop(s), 'options');
    s.advance();
    assert.equal(stop(s), 'row0');
    assert.equal(s.depth(), 2);
});

test('with no options the scan starts inside the Express Panel', () => {
    const s = createScanner({ build: conversation({ options: false }), cfg: { exit: 'pass' } });
    s.reset();
    assert.equal(stop(s), 'row0');
});

test('a group is left after a full pass with no press, onto the stop after it', () => {
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass' } });
    s.reset();
    assert.equal(s.choose().type, 'entered');
    assert.deepEqual([stop(s)], ['opt0']);
    s.advance(); s.advance();          // opt1, new4
    assert.equal(stop(s), 'new4');
    const r = s.advance();             // a full pass: out of the options
    assert.ok(r.left);
    assert.equal(stop(s), 'row0');     // and straight into the Express Panel
});

test('with a Leave stop, the group is left only through it', () => {
    const s = createScanner({ build: conversation({ exit: 'leave' }), cfg: { exit: 'leave' } });
    s.reset();
    s.choose();
    const seen = [];
    for (let i = 0; i < 8; i++) { seen.push(stop(s)); s.advance(); }
    assert.ok(seen.every((k) => ['opt0', 'opt1', 'new4', 'leave-options'].includes(k)), seen.join());
    // Go to the Leave stop and choose it.
    while (stop(s) !== 'leave-options') s.advance();
    assert.equal(s.choose().type, 'left');
    assert.equal(stop(s), 'row0');
});

test('back from the first stop of a group leaves it and stays on the group', () => {
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass' } });
    s.reset();
    s.choose();                        // into the options
    s.retreat();
    assert.equal(s.depth(), 1);
    assert.equal(stop(s), 'options');
});

test('back from the Express Panel first row goes to the stop before the panel', () => {
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass' } });
    s.reset();
    s.advance();                       // row0, inside the panel
    s.retreat();
    assert.equal(s.depth(), 1);
    assert.equal(stop(s), 'options');
});

test('back onto the Express Panel from after it lands on its last stop', () => {
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass' } });
    s.reset({ focusKey: 'imow' });
    assert.equal(stop(s), 'imow');
    s.retreat();
    assert.equal(stop(s), 'row1');
});

test('a button that needs two presses is held, then pressed by the second', () => {
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass' } });
    s.reset({ focusKey: 'end' });
    assert.equal(stop(s), 'end');
    assert.equal(s.choose().type, 'hold');
    const r = s.choose();
    assert.equal(r.type, 'act');
    assert.equal(r.node.key, 'end');
    assert.ok(r.confirmed);
});

test('moving on cancels a held press', () => {
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass' } });
    s.reset({ focusKey: 'end' });
    s.choose();
    s.advance();
    assert.equal(s.held(), null);
});

test('a late press is forgiven: it counts for the stop just left', () => {
    let t = 0;
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass', method: 'auto', forgiveMs: 300 }, now: () => t });
    s.reset();
    s.choose();                        // into the options, on opt0
    t = 1000; s.advance();             // opt1
    t = 1200;                          // 200 ms later: within the 300 ms
    const r = s.choose();
    assert.equal(r.node.key, 'opt0');
});

test('a press after the forgiving time counts for the stop showing', () => {
    let t = 0;
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass', method: 'auto', forgiveMs: 300 }, now: () => t });
    s.reset();
    s.choose();
    t = 1000; s.advance();
    t = 1500;
    assert.equal(s.choose().node.key, 'opt1');
});

test('after a choice in a row, the highlight goes back to the region\'s first row', () => {
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass', pattern: 'regions' } });
    s.reset();
    s.advance();                       // row0
    s.advance();                       // row1
    s.choose();                        // into row1
    s.advance();                       // bye
    assert.equal(s.choose().node.key, 'bye');
    s.afterAct('region');
    assert.equal(s.depth(), 2);
    assert.equal(stop(s), 'row0');
});

test('one line, no groups: after a choice the scan starts again at the top', () => {
    const flat = () => [item('a'), item('b'), item('c')];
    const s = createScanner({ build: flat, cfg: { pattern: 'items' } });
    s.reset(); s.advance(); s.advance();
    s.choose();
    s.afterAct('region');
    assert.equal(stop(s), 'a');
});

test('a rebuild keeps the highlight on the same stop', () => {
    let kids = [item('x'), item('y'), item('z')];
    const s = createScanner({ build: () => [group('g', null, { kids: () => kids }), item('after')], cfg: {} });
    s.reset();
    s.choose(); s.advance();           // y
    kids = [item('new'), item('x'), item('y'), item('z')];
    s.refresh();
    assert.equal(stop(s), 'y');
});

test('a group that disappears is left', () => {
    let showing = true;
    const s = createScanner({ build: () => [...(showing ? [group('g', [item('x')])] : []), item('after')], cfg: {} });
    s.reset();
    s.choose();
    showing = false;
    s.refresh();
    assert.equal(s.depth(), 1);
    assert.equal(stop(s), 'after');
});

// Settings' one flat cycle: the chosen tab's sections take its place, an open section's
// controls take its heading's place (Ken, November 10 2026).
function settings() {
    return () => [
        item('tab-general'),
        item('head-a', { scope: ['tab:speech'] }),
        item('ctl-b1', { scope: ['tab:speech', 'sec:b'] }),
        item('ctl-b2', { scope: ['tab:speech', 'sec:b'] }),
        { key: 'leave-sec-b', kind: 'leave', scope: ['tab:speech', 'sec:b'], act: () => {} },
        item('head-c', { scope: ['tab:speech'] }),
        { key: 'leave-tab', kind: 'leave', scope: ['tab:speech'], act: () => {} },
        item('tab-about'),
        item('close'),
    ];
}

test('Settings with a Leave stop: the scan goes round the open section only', () => {
    const s = createScanner({ build: settings(), cfg: { exit: 'leave' } });
    s.reset({ focusKey: 'ctl-b1' });
    const seen = [];
    for (let i = 0; i < 6; i++) { seen.push(stop(s)); s.advance(); }
    assert.deepEqual(seen, ['ctl-b1', 'ctl-b2', 'leave-sec-b', 'ctl-b1', 'ctl-b2', 'leave-sec-b']);
});

test('Settings with leaving after a pass: the scan carries on through the cycle', () => {
    const s = createScanner({ build: settings(), cfg: { exit: 'pass' } });
    s.reset({ focusKey: 'ctl-b2' });
    s.advance(); s.advance();
    assert.equal(stop(s), 'head-c');
});

test('Settings Leave stops are handed to the driver to act on', () => {
    const s = createScanner({ build: settings(), cfg: { exit: 'leave' } });
    s.reset({ focusKey: 'leave-sec-b' });
    const r = s.choose();
    assert.equal(r.type, 'act');
    assert.equal(r.node.key, 'leave-sec-b');
});

test('Settings back within a scope wraps to the scope\'s last stop', () => {
    const s = createScanner({ build: settings(), cfg: { exit: 'leave' } });
    s.reset({ focusKey: 'ctl-b1' });
    s.retreat();
    assert.equal(stop(s), 'leave-sec-b');
});

test('an empty group is not entered', () => {
    const s = createScanner({ build: () => [group('g', []), item('x')], cfg: {} });
    s.reset();
    assert.equal(s.choose(), null);
    assert.equal(s.depth(), 1);
});

test('afterAct with a key puts the highlight on that stop', () => {
    const s = createScanner({ build: conversation(), cfg: { exit: 'pass' } });
    s.reset();
    s.afterAct({ focusKey: 'imow' });
    assert.equal(stop(s), 'imow');
});
