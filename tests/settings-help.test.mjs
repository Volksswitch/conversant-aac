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

// ⚠ NOT EVERY SECTION IS DECLARED IN index.html. The Controls editor builds its six
// sections at runtime and stamps their keys with `sec.dataset.help = key`, so a scan of
// the markup alone misses them — which is exactly how all six shipped silent: their
// headings resolved to no phrase and the "?" said nothing on that whole tab.
function sectionKeys() {
    const fromHtml = [...settingsMarkup().matchAll(/data-help="([^"]+)"/g)].map(m => m[1]);
    return [...fromHtml, ...runtimeSectionKeys()];
}

// The runtime-built editors' keys, read from their source the same way the markup is
// read. Each passes the list key straight through as the help key, so the section
// names ARE the arguments of its section builders.
//
// ⚠ AN EDITOR ADDED HERE WITHOUT BEING ADDED TO THIS LIST IS NOT COVERED, which is a
// silent hole: its headings simply say nothing under the "?" and no test notices.
function runtimeSectionKeys() {
    const sources = [
        ['control-phrases-editor.js', /(?:single|list)Section\([^,]+,\s*'([^']+)'\)/g],
        ['placeholder-editor.js', /poolSection\([^,]+,\s*'([^']+)'\)/g],
    ];
    return sources.flatMap(([file, re]) => {
        const src = readFileSync(join(root, 'app', 'js', file), 'utf8');
        return [...src.matchAll(re)].map(m => m[1]);
    });
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

// Every setting group with a heading is a collapsible section (makeGroupsCollapsible
// in app.js), and its heading is what the user taps to ask what the section is for.
// resolveTap answers that from the group's data-help, or — when the group holds one
// idea, a slider with its steppers or a single radio group — from its controls,
// because the control's own phrase already says it.
//
// THE FAILURE THIS CATCHES IS SILENT: add a second, unrelated control to a group
// without giving the group a data-help, and its header simply stops speaking. Nothing
// errors; the "?" appears not to work on that one section.
// Groups NEST — a section can hold sub-sections — so this walks div depth to find each
// group's true extent and then subtracts its sub-sections. Splitting on the opening tag
// was enough while they were flat and is actively wrong now: it would attribute a loose
// control that follows a sub-section (the Reset button) to that sub-section instead of
// to its parent.
function settingGroups() {
    const markup = settingsMarkup();
    const OPEN_GROUP = /<div class="setting-group\b/g;
    const starts = [...markup.matchAll(OPEN_GROUP)].map(m => m.index);

    // Where the <div> opened at `start` closes, by counting divs.
    const extentOf = (start) => {
        let depth = 0;
        const tag = /<(\/?)div\b/g;
        tag.lastIndex = start;
        let m;
        while ((m = tag.exec(markup))) {
            depth += m[1] ? -1 : 1;
            if (depth === 0) return m.index;
        }
        return markup.length;
    };

    return starts.map((start) => {
        const end = extentOf(start);
        const head = markup.slice(start, markup.indexOf('>', start));
        const full = markup.slice(start, end);
        // This group's own markup: everything inside it that is not inside a sub-section.
        const subs = starts.filter(s => s > start && s < end)
            .filter(s => !starts.some(o => o > start && o < s && extentOf(o) > s));   // direct children only
        let own = '';
        let cursor = start;
        for (const s of subs) { own += markup.slice(cursor, s); cursor = extentOf(s); }
        own += markup.slice(cursor, end);

        // The HEADING is read from the group's own markup — a sub-section's label must
        // not be mistaken for its parent's. The KEYS are read from the whole extent,
        // sub-sections included, because that is what resolveTap sees: it collects
        // every control under the .setting-group it landed in. So a section holding
        // sub-sections has many keys, does not resolve, and needs its own data-help.
        const headingM = /<label(?![^>]*class="(?:checkbox|radio)-label")[^>]*>([^<]*)</.exec(own);
        const keys = new Set();
        for (const m of full.matchAll(/<(input|select|textarea|button)\b([^>]*)>/g)) {
            const attrs = m[2];
            if (/class="[^"]*slider-step/.test(attrs)) continue;   // means its slider
            if (/type="radio"/.test(attrs)) {
                const n = /\bname="([^"]+)"/.exec(attrs);
                keys.add(n ? `radio:${n[1]}` : '?');
            } else {
                const id = /\bid="([^"]+)"/.exec(attrs);
                keys.add(id ? `control:${id[1]}` : '?');
            }
        }
        const dataHelp = /data-help="([^"]+)"/.exec(head);
        return { name: headingM ? headingM[1].trim() : '(no heading)', hasHeading: !!headingM,
                 hasSubSections: subs.length > 0,
                 dataHelp: dataHelp ? dataHelp[1] : null, keys: [...keys] };
    });
}

test('every setting group has a heading, so no control sits outside a section', () => {
    // Ken, August 11 2026: "all controls should be included in a section. If no other
    // section makes sense then create one just for that control." A group with no
    // heading is not collapsible, so its controls would sit loose between the sections
    // — and it would have nothing for the "?" to speak either.
    const headless = settingGroups().filter(g => !g.hasHeading)
        .map(g => g.keys.join(', ') || '(no controls)');
    assert.deepEqual(headless, [],
        `setting groups with no heading label: ${headless.join(' | ')}`);
});

test('every collapsible section heading resolves to a spoken phrase', () => {
    const silent = settingGroups()
        .filter(g => g.hasHeading && !g.dataHelp)
        .filter(g => !(g.keys.length === 1 && lookup(g.keys[0])))
        .map(g => `${g.name} (controls: ${g.keys.join(', ') || 'none'})`);
    assert.deepEqual(silent, [],
        `section headings that would say nothing — give the group a data-help entry: ${silent.join(' | ')}`);
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
