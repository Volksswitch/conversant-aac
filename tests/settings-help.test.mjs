// Spoken Settings help: coverage of the panel, and that the bundled copy matches the
// source. Both exist so the two failure modes this feature has cannot ship quietly —
// a new setting with no spoken help, and an edit to settings-help.json that was never
// run through the generator.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { decideTap, ACTION } from '../app/js/help-mode.js';
import { lookup, raw } from '../app/js/settings-help.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = JSON.parse(readFileSync(join(root, 'settings-help.json'), 'utf8'));
const html = readFileSync(join(root, 'app', 'index.html'), 'utf8');

// The Settings panel's markup, from #settingsContent to the end of the dialog.
function settingsMarkup() {
    const start = html.indexOf('id="settingsContent"');
    assert.ok(start > 0, '#settingsContent not found in index.html');
    const end = html.indexOf('</dialog>', start);
    assert.ok(end > start, 'end of the settings dialog not found');
    return html.slice(start, end);
}

// Slider steppers are excluded on purpose: a - / + button has no meaning apart from
// the slider it belongs to, and resolveTap redirects a tap on one to that slider.
const IGNORED_IDS = /class="[^"]*slider-step/;

function controlIdsInSettings() {
    return [...settingsMarkup().matchAll(/<(?:input|select|textarea|button)\b[^>]*\bid="([^"]+)"[^>]*>/g)]
        .filter(m => !IGNORED_IDS.test(m[0]))
        .map(m => m[1]);
}

function radioGroupNames() {
    return [...new Set([...settingsMarkup().matchAll(/type="radio"[^>]*\bname="([^"]+)"/g)].map(m => m[1]))];
}

function tabNames() {
    return [...html.matchAll(/class="settings-tab[^"]*"\s+data-tab="([^"]+)"/g)].map(m => m[1]);
}

function sectionKeys() {
    return [...settingsMarkup().matchAll(/data-help="([^"]+)"/g)].map(m => m[1]);
}

test('every Settings control has spoken help', () => {
    const missing = controlIdsInSettings().filter(id => !lookup(`control:${id}`));
    assert.deepEqual(missing, [], `controls with no spoken help: ${missing.join(', ')}`);
});

test('every radio group, tab and section has spoken help', () => {
    const missingRadios = radioGroupNames().filter(n => !lookup(`radio:${n}`));
    assert.deepEqual(missingRadios, [], `radio groups with no help: ${missingRadios.join(', ')}`);

    const missingTabs = tabNames().filter(t => !lookup(`tab:${t}`));
    assert.deepEqual(missingTabs, [], `tabs with no help: ${missingTabs.join(', ')}`);

    const missingSections = sectionKeys().filter(s => !lookup(`section:${s}`));
    assert.deepEqual(missingSections, [], `data-help groups with no entry: ${missingSections.join(', ')}`);
});

test('no orphan entries — every phrase points at something that exists', () => {
    const ids = new Set(controlIdsInSettings());
    const orphans = Object.keys(raw().controls || {}).filter(k => !ids.has(k));
    assert.deepEqual(orphans, [], `help for controls that are gone: ${orphans.join(', ')}`);

    const tabs = new Set(tabNames());
    const orphanTabs = Object.keys(raw().tabs || {}).filter(k => !tabs.has(k));
    assert.deepEqual(orphanTabs, [], `help for tabs that are gone: ${orphanTabs.join(', ')}`);

    const sections = new Set(sectionKeys());
    const orphanSections = Object.keys(raw().sections || {}).filter(k => !sections.has(k));
    assert.deepEqual(orphanSections, [], `sections with no data-help group: ${orphanSections.join(', ')}`);
});

test('the bundled copy matches settings-help.json (generator was run)', () => {
    for (const bucket of ['tabs', 'controls', 'radioGroups', 'sections']) {
        const want = {};
        for (const [k, v] of Object.entries(source[bucket] || {})) want[k] = v.trim();
        assert.deepEqual(raw()[bucket] || {}, want,
            `${bucket} differs — run: node scripts/apply-settings-help.mjs`);
    }
});

test('phrases are written for listening, not reading', () => {
    const tooLong = [];
    for (const bucket of ['tabs', 'controls', 'radioGroups', 'sections']) {
        for (const [k, v] of Object.entries(source[bucket] || {})) {
            const words = v.trim().split(/\s+/).length;
            if (words > 35) tooLong.push(`${bucket}.${k} (${words} words)`);
        }
    }
    // A listener cannot skim or re-read. 35 is a generous ceiling on a 15-25 target;
    // anything past it is manual prose that slipped in.
    assert.deepEqual(tooLong, [], `too long to be heard comfortably: ${tooLong.join(', ')}`);
});

// --- the interaction model ------------------------------------------------------

const idle = { armed: false, speaking: false };
const armed = { armed: true, speaking: false };
const speaking = { armed: false, speaking: true };
const tap = (o = {}) => ({ isHelpButton: false, key: null, sameGroup: false, isRange: false, ...o });

test('help off: taps behave normally', () => {
    assert.equal(decideTap(idle, tap({ key: 'control:voiceSelect' })).action, ACTION.ALLOW);
});

test('the "?" always toggles, from any state', () => {
    for (const s of [idle, armed, speaking]) {
        assert.equal(decideTap(s, tap({ isHelpButton: true })).action, ACTION.TOGGLE);
    }
});

test('armed: a resolvable tap speaks and never reaches the control', () => {
    const d = decideTap(armed, tap({ key: 'control:voiceSelect' }));
    assert.equal(d.action, ACTION.SPEAK);
    assert.equal(d.key, 'control:voiceSelect');
});

test('armed: a tap on nothing explainable is swallowed, not passed through', () => {
    // The safety property: while armed, nothing can be changed by a stray tap.
    assert.equal(decideTap(armed, tap({ key: null })).action, ACTION.SWALLOW);
});

test('speaking: tapping elsewhere aborts and eats the tap', () => {
    assert.equal(decideTap(speaking, tap({ key: 'control:other', sameGroup: false })).action,
        ACTION.ABORT_AND_SWALLOW);
});

test('speaking: tapping the SAME group aborts and lets the action through', () => {
    // Ken's exception — the tap you can trust is the one that already landed on
    // target deliberately, so it is the one allowed to act.
    assert.equal(decideTap(speaking, tap({ key: 'control:voiceSelect', sameGroup: true })).action,
        ACTION.ABORT_AND_PASS);
});

test('speaking: the same-group exception does NOT apply to a slider', () => {
    // On a range the tap coordinate IS the value, so "stop talking" and "set this to
    // 90%" are the same gesture; passing it through would silently mis-set it.
    assert.equal(decideTap(speaking, tap({ key: 'control:buttonSizeSlider', sameGroup: true, isRange: true })).action,
        ACTION.ABORT_AND_SWALLOW);
});

test('speaking: a stepper in the slider\'s group still passes through', () => {
    // Which is why excluding ranges costs nothing: - / + are discrete.
    assert.equal(decideTap(speaking, tap({ key: 'control:buttonSizeSlider', sameGroup: true, isRange: false })).action,
        ACTION.ABORT_AND_PASS);
});
