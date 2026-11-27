// keyguard-design.js - the file "Save keyguard design" writes (Ken, November 27 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDesign, otherTabletSizes, titleBarPx, designName, OTHER_TABLET_GENERAL } from '../app/js/keyguard-design.js';
import { DESIGNER_DEFAULTS } from '../app/js/keyguard-defaults.js';

const openings = [
    '[ "Transcript", "r", 300, 1500, 10, 800, 200, 0, "C", "T", 0, 0, [], [] ],',
    '[ "Yes", "r", 120, 200, 12, 300, 1200, 0, "C", "T", 0, 0, [], [] ],',
];
const date = new Date(2026, 10, 27);
const read = (d) => JSON.parse(d.json).parameterSets[d.name];

test('a listed tablet: the defaults with the tablet, orientation and openings filled in', () => {
    const d = buildDesign({ choice: { kind: 'tablet', name: 'iPad 10th generation' }, landscape: false,
        openings, screen: { long: 2360, short: 1640 }, date });
    assert.equal(d.fileName, 'iPad 10th generation - Conversant keyguard - 2026-11-27.json');
    const p = read(d);
    assert.equal(p.type_of_tablet, 'iPad 10th generation');
    assert.equal(p.orientation, 'portrait');
    assert.equal(p.number_of_rows, '0');
    assert.equal(p.number_of_columns, '0');
    assert.equal(p.cell_edge_chamfer, '0.6');
    // Each line keeps its comma, the last one included (the designer ignores it).
    assert.equal(p.my_screen_openings, openings.join('\n'));
    assert.ok(p.my_screen_openings.endsWith('],'));
    // Everything else is the default, untouched.
    assert.equal(p.case_width, DESIGNER_DEFAULTS.case_width);
    assert.equal(p.other_tablet_general_sizes, '');
    assert.equal(Object.keys(p).length, Object.keys(DESIGNER_DEFAULTS).length);
    for (const v of Object.values(p)) assert.equal(typeof v, 'string');
});

test('the settings inside carry the same name as the file', () => {
    const d = buildDesign({ choice: { kind: 'tablet', name: 'Surface Pro 7' }, landscape: true,
        openings, screen: { long: 2736, short: 1824 }, date });
    const file = JSON.parse(d.json);
    assert.deepEqual(Object.keys(file.parameterSets), ['Surface Pro 7 - Conversant keyguard - 2026-11-27']);
    assert.equal(file.fileFormatVersion, '1');
});

test('the defaults are not changed by building a design', () => {
    buildDesign({ choice: { kind: 'tablet', name: 'Surface Pro 7' }, landscape: true,
        openings, screen: { long: 2736, short: 1824 }, date });
    assert.equal(DESIGNER_DEFAULTS.type_of_tablet, 'iPad 9th generation');
    assert.equal(DESIGNER_DEFAULTS.number_of_rows, '3');
});

test('a measured tablet: "other tablet", with the screen worked out from the measurement', () => {
    const d = buildDesign({ choice: { kind: 'card' }, landscape: true,
        openings, screen: { long: 1920, short: 1080 }, mmPerPx: 0.1166, date });
    assert.equal(d.fileName, 'other tablet - Conversant keyguard - 2026-11-27.json');
    const p = read(d);
    assert.equal(p.type_of_tablet, 'other tablet');
    // Landscape HEIGHT first, as the designer reads it (its example is 1000,1500,0.100).
    assert.equal(p.other_tablet_pixel_sizes, '1080,1920,0.1166');
    const g = p.other_tablet_general_sizes.split(',').map(Number);
    assert.equal(g.length, 21);
    assert.equal(g[3], 223.87);              // 1920 x 0.1166
    assert.equal(g[4], 125.93);              // 1080 x 0.1166
    assert.equal(g[0], 263.87);              // screen + left and right borders
    assert.equal(g[1], 165.93);              // screen + top and bottom borders
    // The rest are Ken's values.
    assert.deepEqual(g.slice(5), OTHER_TABLET_GENERAL.slice(5));
    assert.equal(g[2], OTHER_TABLET_GENERAL[2]);
});

test('the tablet in the "other tablet" sizes is always bigger than its screen', () => {
    const s = otherTabletSizes({ long: 2560, short: 1600 }, 0.09);
    const g = s.general.split(',').map(Number);
    assert.ok(g[0] > g[3] && g[1] > g[4]);
});

test('no design without a tablet, or without a usable measurement', () => {
    assert.throws(() => buildDesign({ choice: null, landscape: true, openings, screen: { long: 1, short: 1 } }));
    assert.throws(() => buildDesign({ choice: { kind: 'tablet', name: 'Nope' }, landscape: true, openings, screen: { long: 1, short: 1 } }));
    assert.throws(() => buildDesign({ choice: { kind: 'card' }, landscape: true, openings, screen: { long: 1920, short: 1080 }, mmPerPx: null }));
});

test('the bar above the app is the screen height less the app height, never negative', () => {
    // A maximized window on a 1920 x 1080 screen, app 1032 pixels tall: 48 above it.
    assert.equal(titleBarPx({ long: 1920, short: 1080 }, true, 1032), 48);
    // Upright, the long side is the height.
    assert.equal(titleBarPx({ long: 2360, short: 1640 }, false, 2360), 0);
    assert.equal(titleBarPx({ long: 1920, short: 1080 }, true, 1080), 0);
    assert.equal(titleBarPx({ long: 1920, short: 1080 }, true, 1090), 0);
});

test('a file name never carries a character Windows refuses', () => {
    assert.equal(designName('A/B: C?', date), 'A-B- C- - Conversant keyguard - 2026-11-27');
});
