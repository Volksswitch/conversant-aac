// The keyguard layout file: only layout settings travel, absent ones are cleared,
// hand-edited values are refused, and the device comparison says what matters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as kl from '../app/js/keyguard-layout.js';

const bundle = {
    keyboardDock: 'side', sideDockPosition: 'left', sideLayout: 'S1', bottomLayout: 'B11',
    convLayout: { side: { command: 0.1, response: 0.6, dock: 0.35 } },
    optionsArrangement: { side: 'grid', bottom: 'row' },
    buttonGapPos: 30, appMarginPos: 10, dockSepPos: 0, transcriptSepPos: 5,
    fullscreen: true,
    // Personal and look-only settings that must never travel:
    apiKey: 'sk-ant-secret', voiceURI: 'x', colorScheme: 'dark', responsesPerCategory: 2,
    spokenWords: [{ word: 'Siobhan', say: 'Shiv-awn' }], testerName: 'Ann',
};

test('only the layout settings go into the file, absent ones as null', () => {
    const f = kl.buildLayoutFile({ bundle, device: { model: 'iPad' }, openings: ['[ "a" ]'], appVersion: '1.0' });
    assert.deepEqual(Object.keys(f.settings).sort(), Object.keys(kl.LAYOUT_KEYS).sort());
    assert.equal(f.settings.screenOrientation, null);
    assert.equal(f.settings.buttonGapPos, 30);
    const text = JSON.stringify(f);
    for (const secret of ['sk-ant-secret', 'Siobhan', 'Ann', 'dark']) assert.ok(!text.includes(secret), secret);
    assert.ok(!('responsesPerCategory' in f.settings));
});

test('a file round-trips, null included', () => {
    const f = kl.buildLayoutFile({ bundle, device: { model: 'iPad Air', appWidth: 1180, appHeight: 788 } });
    const r = kl.parseLayoutFile(JSON.stringify(f));
    assert.deepEqual(r.settings, f.settings);
    assert.deepEqual(r.rejected, []);
    assert.equal(r.device.model, 'iPad Air');
});

test('other files are refused with a readable message', () => {
    assert.throws(() => kl.parseLayoutFile('not json'), /keyguard layout/);
    assert.throws(() => kl.parseLayoutFile(JSON.stringify({ kind: 'conversant-backup' })), /keyguard layout/);
    assert.throws(() => kl.parseLayoutFile(JSON.stringify({ kind: kl.LAYOUT_KIND, version: 99 })), /newer version/);
});

test('a hand-edited value is named and left out, the rest still apply', () => {
    const f = kl.buildLayoutFile({ bundle });
    f.settings.buttonGapPos = 5000;
    f.settings.keyboardDock = 'top';
    f.settings.convLayout = { side: { dock: 7 } };
    f.settings.apiKey = 'sk-ant-sneaky';
    const r = kl.parseLayoutFile(JSON.stringify(f));
    assert.ok(!('buttonGapPos' in r.settings));
    assert.ok(!('keyboardDock' in r.settings));
    assert.ok(!('convLayout' in r.settings));
    assert.ok(!('apiKey' in r.settings));
    assert.equal(r.settings.appMarginPos, 10);
    assert.deepEqual(r.rejected.sort(), ['Button spacing', 'How much of the screen each part gets', 'Where the keyboard sits']);
});

test('a setting missing from the file leaves this device alone', () => {
    const f = kl.buildLayoutFile({ bundle });
    delete f.settings.fullscreen;
    const r = kl.parseLayoutFile(JSON.stringify(f));
    assert.ok(!('fullscreen' in r.settings));
});

test('the device section keeps only known, checked fields', () => {
    const f = kl.buildLayoutFile({ bundle, device: { model: 'x'.repeat(500), appWidth: 10, evil: '<script>' } });
    const r = kl.parseLayoutFile(JSON.stringify(f));
    assert.equal(r.device.model.length, 120);
    assert.ok(!('evil' in r.device));
});

test('changedSettings names only what differs', () => {
    const f = kl.buildLayoutFile({ bundle });
    const here = { ...bundle, buttonGapPos: 0, fullscreen: undefined };
    assert.deepEqual(kl.changedSettings(f.settings, here).sort(), ['Button spacing', 'Use the whole screen']);
});

test('compareDevices: same app area matches; differences are said plainly', () => {
    const a = { appWidth: 1180, appHeight: 788, shell: 'app', pixelRatio: 2 };
    assert.equal(kl.compareDevices(a, { ...a }).match, true);
    const c = kl.compareDevices({ ...a, optionsPerCategory: 2 }, { appWidth: 1180, appHeight: 763, shell: 'tab', pixelRatio: 2 });
    assert.equal(c.match, false);
    assert.match(c.lines.join(' '), /1180 × 788/);
    assert.match(c.lines.join(' '), /browser tab/);
    assert.match(c.lines.join(' '), /two options per category/);
});
