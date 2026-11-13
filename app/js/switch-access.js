/* SWITCH ACCESS - the one scanner for every screen.
 *
 * Ken, November 12 2026: "implement the design". The design is Documents/Conversant AAC
 * Switch Access Design.docx; the behavior is the Switch Access Proposal's and the three
 * prototypes' (prototypes/switch-access*.html). The rules that decide the next stop
 * live in scan-rules.js, where tests can check them; this file reads the screen, draws
 * the highlight, listens to the switches and presses the buttons.
 *
 * HOW IT FINDS THE STOPS. It reads the page each time something changes, so a button
 * added later is scanned without anyone remembering to add it, and a hidden, switched
 * off or blank button is skipped. Each screen's regions are the page's own containers:
 * the response options (#responseArea), the Express Panel's rows (.ep-row), "In my own
 * words" (.ep-imow), the Command Bar (#listenControls), the keyboard's rows (.kbd-row),
 * Settings' tabs and sections, and any confirmation card.
 *
 * WHILE SWITCH ACCESS IS ON, TOUCH DOES NOTHING (Ken, November 12 2026: "commit to the
 * direct select vs switch access decision that the users make"). A mouse's buttons act
 * as switches 1, 2 and 3 unless turned off, which is how a supporter helps. The
 * scanner's own presses are let through by a counter, so nothing else can be.
 *
 * NOTHING MOVES. The highlight is an outline drawn inside the button and the "Leave"
 * outline is a separate box drawn over the region, so the layout - and the keyguard -
 * are the ones a touch user has.
 */

import * as storage from './storage.js';
import * as tapGuard from './tap-guard.js';
import * as keyboard from './keyboard.js';
import { createScanner } from './scan-rules.js';
import { keyMap, keyName, raceWait, STARTING_VALUES } from './switch-settings.js';

const $ = (id) => document.getElementById(id);

let count = 0;
let scan = { ...STARTING_VALUES[1] };
let map = {};
let mouseOn = true;
let on = false;
let scanner = null;
let screenId = '';
let pendingFocus = null;      // a stop to put the highlight on when the next screen appears
let synthetic = 0;            // >0 while the scanner itself is pressing a button
let autoTimer = null;
let raceTimer = null;
let inverseTimer = null;
let holdTimer = null;
let readingNext = false;      // the next automatic wait is the reading time for new options
let readOnOptions = false;    // options arrived elsewhere: read them when the scan gets there
let stayPending = false;      // after a key: one more stop on it, then back to the top
let heldOptions = null;       // a newer set of options waiting for the highlight to leave
let updateQueued = false;
let observer = null;
let frameEl = null;           // the "Leave" outline box
let listEl = null;            // a drop-down list opened for scanning
let listFor = null;
let capture = null;           // { n, done } while a switch's key is being set
let lastSetCode = '';
let lastAccept = -1e12;
const mkSw = () => ({ down: false, t: 0, minTimer: null, raceTimer: null, raced: false });
const sw = { 1: mkSw(), 2: mkSw(), 3: mkSw() };
const MOUSE = { 0: 1, 2: 2, 1: 3 };   // left, right, middle

// ---------------------------------------------------------------- reading the page

function shown(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest('[hidden]')) return false;
    if (el.closest('[inert]') && !el.closest('dialog[open]')) return false;
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
}
function usable(el) {
    return shown(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}

// A key that survives a redraw: the element's id, or its position under the nearest
// ancestor that has one. The Express Panel and the keyboard redraw often, and a key
// tied to the element itself would lose the highlight's place every time.
function keyFor(el) {
    if (!el) return '';
    if (el.id) return '#' + el.id;
    const parts = [];
    let node = el;
    while (node && node.parentElement && !node.id) {
        parts.unshift([...node.parentElement.children].indexOf(node));
        node = node.parentElement;
    }
    return (node && node.id ? node.id : '') + '/' + parts.join('.');
}
function labelOf(el) {
    return (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

const ALWAYS_TWO = ['endConversationBtn', 'privacyBtn'];
function itemNode(el, extra = {}) {
    return { key: keyFor(el), kind: 'item', label: labelOf(el), el,
             needsTwo: ALWAYS_TWO.includes(el.id) || tapGuard.needsSecondTap(el), ...extra };
}
function groupNode(key, label, el, kids, extra = {}) {
    return { key, kind: 'group', label, el, kids, exitByPass: scan.exit === 'pass', ...extra };
}
function leaveNode(key, frame, label, extra = {}) {
    return { key, kind: 'leave', label, frame, ...extra };
}
const leaving = () => scan.exit === 'leave';

// ---------------------------------------------------------------- which screen

function topDialog() {
    const open = [...document.querySelectorAll('dialog[open]')].filter((d) => d.id !== 'settingsDialog');
    return open[open.length - 1] || null;
}
function keyboardShowing() {
    const k = $('appKeyboard');
    return !!k && !k.classList.contains('hidden') && shown(k);
}
function typingIn(container) {
    const a = document.activeElement;
    return keyboardShowing() && !!a && container.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName);
}
function prestart() {
    const main = document.querySelector('main');
    return !!main && main.classList.contains('disabled');
}
function composerOpen() {
    const c = $('composerOverlay');
    return !!c && !c.hidden;
}
function settingsOpen() {
    const d = $('settingsDialog');
    return !!d && d.open;
}

function currentScreen() {
    if (listEl) return 'list';
    const dlg = topDialog();
    if (dlg) return typingIn(dlg) ? 'kbd' : 'dialog';
    if (settingsOpen()) return typingIn($('settingsDialog')) ? 'kbd' : 'settings';
    if (prestart()) return 'prestart';
    if (composerOpen()) return 'composer';
    return 'conversation';
}

function buildRoot() {
    switch (currentScreen()) {
        case 'list': return listRoot();
        case 'dialog': return controlsIn(topDialog(), []);
        case 'kbd': return keyboardRoot();
        case 'settings': return settingsRoot();
        case 'prestart': return controlsIn($('startBlock'), []);
        case 'composer': return composerRoot();
        default: return conversationRoot();
    }
}

// ---------------------------------------------------------------- the conversation screen

function optionEls() {
    const box = $('responseOptions');
    if (!box) return [];
    return [...box.querySelectorAll('button.response-card:not(.response-card-empty)')].filter((el) => usable(el) && labelOf(el));
}
function expressRows(grid = $('epGrid')) {
    if (!grid) return [];
    const rows = [...grid.querySelectorAll('.ep-row')].map((row) => {
        let cells = [...row.querySelectorAll('.ep-btn')].filter((b) => usable(b)
            && !b.classList.contains('ep-imow') && !b.classList.contains('ep-undefined'));
        if (scan.moreFirst === 'first') {
            const more = cells.filter((b) => b.classList.contains('ep-more'));
            cells = more.concat(cells.filter((b) => !b.classList.contains('ep-more')));
        }
        return { row, cells, flex: !!row.querySelector('.ep-band-flex') };
    }).filter((r) => r.cells.length);
    if (scan.flexFirst) return rows.filter((r) => r.flex).concat(rows.filter((r) => !r.flex));
    return rows;
}
const rowGroup = (r, i) => groupNode('row' + i, `Row ${i + 1}`, r.row, () => expressRows(r.row.closest('#epGrid')).find((x) => x.row === r.row)?.cells.map((b) => itemNode(b)) || [],
                                    { exitByPass: true });
function commandEls() {
    const bar = $('listenControls');
    return bar ? [...bar.querySelectorAll('button')].filter(usable) : [];
}

function conversationRoot() {
    const new4 = $('regenerateBtn');
    const imow = document.querySelector('#epGrid .ep-imow');
    if (scan.pattern === 'items') {
        return [
            ...optionEls().map((el) => itemNode(el)),
            ...(optionEls().length && usable(new4) ? [itemNode(new4)] : []),
            ...expressRows().flatMap((r) => r.cells.map((b) => itemNode(b))),
            ...(usable(imow) ? [itemNode(imow)] : []),
            ...commandEls().map((b) => itemNode(b)),
        ];
    }
    const nodes = [];
    if (optionEls().length) {
        nodes.push(groupNode('options', 'Response options', $('responseArea'), () => [
            ...optionEls().map((el) => itemNode(el)),
            ...(usable($('regenerateBtn')) ? [itemNode($('regenerateBtn'))] : []),
            ...(leaving() ? [leaveNode('leave-options', $('responseArea'), 'Leave the response options')] : []),
        ]));
    }
    // The Express Panel is never a stop itself: the scan goes straight to its first row
    // (Ken, November 12 2026).
    if (expressRows().length) {
        nodes.push(groupNode('express', 'Express Panel', $('epGrid'), () => [
            ...expressRows().map(rowGroup),
            ...(leaving() ? [leaveNode('leave-express', $('epGrid'), 'Leave the Express Panel')] : []),
        ], { enterDirect: true }));
    }
    if (usable(imow)) nodes.push(itemNode(imow));
    if (commandEls().length) {
        nodes.push(groupNode('commands', 'Command Bar', $('listenControls'), () => [
            ...commandEls().map((b) => itemNode(b)),
            ...(leaving() ? [leaveNode('leave-commands', $('listenControls'), 'Leave the Command Bar')] : []),
        ]));
    }
    return nodes;
}

// ---------------------------------------------------------------- the keyboard

function keyRows() {
    const kbd = $('appKeyboard');
    if (!kbd) return [];
    return [...kbd.querySelectorAll('.kbd-row')].map((row) => ({
        row,
        keys: [...row.querySelectorAll('button.kbd-key')].filter((k) => usable(k)
            && !(k.classList.contains('kbd-suggest') && scan.suggest !== 'key')),
    })).filter((r) => r.keys.length);
}
const keyItem = (k) => itemNode(k, { after: 'key' });

// The word suggestion as its own stop: the text box itself is highlighted, and choosing
// it finishes the word and adds a space. Only when there is a suggestion.
function suggestionStop(field) {
    if (!field || !keyboard.suggestionWord() || !['first', 'last'].includes(scan.suggest)) return [];
    return [{ key: 'suggest', kind: 'item', label: 'Suggested word: ' + keyboard.suggestionWord(), el: field,
              act: () => { keyboard.acceptSuggestion(); return 'top'; } }];
}

function keyboardGroup(field, leaveAct) {
    const kbd = $('appKeyboard');
    const sug = suggestionStop(field);
    const kids = () => {
        const rows = keyRows();
        const body = scan.pattern === 'items'
            ? rows.flatMap((r) => r.keys.map(keyItem))
            : rows.map((r, i) => groupNode('krow' + i, labelOf(r.row).slice(0, 30), r.row,
                () => (keyRows()[i] ? keyRows()[i].keys.map(keyItem) : []), { exitByPass: true }));
        return [
            ...(scan.suggest === 'first' ? sug : []),
            ...body,
            ...(scan.suggest === 'last' ? sug : []),
            // "Leave keyboard" is always there, however the scan moves, and always last.
            leaveNode('leave-kbd', kbd, 'Leave keyboard', leaveAct ? { act: leaveAct } : {}),
        ];
    };
    // The keyboard never leaves on its own, and the scan goes straight inside it.
    return groupNode('kbd', 'Keyboard', kbd, kids, { enterDirect: true, exitByPass: false });
}

// "In my own words": the keyboard, then Speak / Reframe / Cancel, then the Command Bar.
function composerRoot() {
    const field = $('composerInput');
    const btns = ['speakBtn', 'reframeBtn', 'cancelComposerBtn'].map($).filter(usable);
    const nodes = [keyboardGroup(field, null)];
    if (scan.pattern === 'items') {
        nodes.push(...btns.map((b) => itemNode(b)), ...commandEls().map((b) => itemNode(b)));
        return nodes;
    }
    if (btns.length) nodes.push(groupNode('composerBtns', 'Speak, Reframe, Cancel', $('composerControls'),
        () => ['speakBtn', 'reframeBtn', 'cancelComposerBtn'].map($).filter(usable).map((b) => itemNode(b)), { exitByPass: true }));
    if (commandEls().length) nodes.push(groupNode('commands', 'Command Bar', $('listenControls'),
        () => commandEls().map((b) => itemNode(b)), { exitByPass: true }));
    return nodes;
}

// Typing in a box in Settings, About Me or a card: the keyboard alone, and leaving it
// puts the box down and the highlight back on it.
function keyboardRoot() {
    const field = document.activeElement;
    return [keyboardGroup(field, () => {
        const key = keyFor(field);
        field.blur();
        keyboard.hideKeyboard();
        pendingFocus = key;
        return 'stay';
    })];
}

// ---------------------------------------------------------------- Settings and cards

const CONTROL = 'button, select, textarea, summary, input, [role="button"], .settings-tab';
function isControl(el) {
    if (!el.matches(CONTROL)) return false;
    if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
    return true;
}
// A slider with − and + buttons beside it is reached through the buttons: on a slider
// the press itself would be the value.
function skipControl(el) {
    if (el.tagName === 'INPUT' && el.type === 'range') {
        return !!(el.parentElement && el.parentElement.querySelector('button'));
    }
    return false;
}

function controlNode(el, scope) {
    const node = itemNode(el, { scope, after: 'stay' });
    if (el.tagName === 'SELECT') {
        node.needsTwo = false;
        node.act = () => (scan.dropdown === 'cycle' ? cycleSelect(el) : openList(el));
    } else if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file)$/.test(el.type))) {
        node.act = () => { el.focus(); keyboard.showFor(el); return 'stay'; };
    } else if (el.tagName === 'INPUT' && el.type === 'range') {
        node.act = () => { stepRange(el); return 'stay'; };
    }
    return node;
}

// The stops inside a container, in page order. A closed section is its heading; an
// open section's controls take its heading's place (Ken, November 10 2026).
function controlsIn(container, scope) {
    const out = [];
    if (!container) return out;
    const walk = (el) => {
        for (const child of el.children) {
            if (child.hidden || child.id === 'appKeyboard' || child.id === 'predGhost' || child.id === 'scanFrame') continue;
            if (child.tagName === 'DETAILS') { out.push(...sectionNodes(child, scope)); continue; }
            if (isControl(child)) {
                if (usable(child) && !skipControl(child)) out.push(controlNode(child, scope));
                continue;
            }
            if (child.id === 'expressPanel') { out.push(...hostedPanel(child, scope)); continue; }
            walk(child);
        }
    };
    walk(container);
    return out;
}

function sectionNodes(details, scope) {
    const sum = details.querySelector(':scope > summary');
    if (!sum || !shown(sum)) return [];
    const k = keyFor(sum);
    if (!details.open) {
        return [itemNode(sum, { scope, needsTwo: false, act: () => { press(sum); return { focusFirstIn: details }; } })];
    }
    const sc = [...scope, 'sec:' + k];
    const inner = [];
    for (const child of details.children) {
        if (child === sum) continue;
        if (child.tagName === 'DETAILS') inner.push(...sectionNodes(child, sc));
        else if (isControl(child)) { if (usable(child) && !skipControl(child)) inner.push(controlNode(child, sc)); }
        else inner.push(...controlsIn(child, sc));
    }
    if (leaving()) {
        inner.push(leaveNode('leave-' + k, details, 'Leave this section', {
            scope: sc, act: () => { press(sum); return { focusKey: k }; } }));
    }
    return inner.length ? inner : [itemNode(sum, { scope, needsTwo: false })];
}

// The Express Panel shown beside the Express tab: its rows, to pick a button to edit.
function hostedPanel(panel, scope) {
    const grid = panel.querySelector('#epGrid');
    const rows = expressRows(grid);
    if (!rows.length) return [];
    return [groupNode('ep-settings', 'Express Panel', grid, () => expressRows(grid).map((r, i) =>
        groupNode('srow' + i, `Row ${i + 1}`, r.row, () => (expressRows(grid)[i] ? expressRows(grid)[i].cells.map((b) => itemNode(b, { after: 'stay', needsTwo: false })) : []),
                  { exitByPass: true })), { scope })];
}

// Settings is one cycle: the tabs, with the chosen tab's sections in its place, then
// the help and close buttons.
function settingsRoot() {
    const nodes = [];
    const tabs = [...document.querySelectorAll('#settingsTabs .settings-tab')].filter(shown);
    tabs.forEach((t, i) => {
        if (!t.classList.contains('active')) {
            nodes.push(itemNode(t, { needsTwo: false, act: () => { press(t); return { focusFirstIn: activePanel() }; } }));
            return;
        }
        const sc = ['tab:' + (t.dataset.tab || i)];
        const panel = activePanel();
        const inner = controlsIn(panel, sc);
        // On the Express tab the panel is shown beside Settings, hosted in the dialog.
        const hosted = $('settingsDialog').querySelector('#expressPanel');
        if (hosted && panel && !panel.contains(hosted)) inner.unshift(...hostedPanel(hosted, sc));
        nodes.push(...(inner.length ? inner : [itemNode(t, { needsTwo: false })]));
        if (leaving() && inner.length) {
            const next = tabs[i + 1] || $('closeSettingsBtn');
            nodes.push(leaveNode('leave-tab', panel, 'Leave this tab', { scope: sc, act: () => ({ focusKey: keyFor(next) }) }));
        }
    });
    for (const id of ['settingsHelpBtn', 'closeSettingsBtn']) if (usable($(id))) nodes.push(itemNode($(id), { needsTwo: false }));
    return nodes;
}
function activePanel() {
    return document.querySelector('#settingsContent .tab-panel.active');
}

// A drop-down list, two ways (a setting): each press moves to the next choice, or a
// press opens the list and the choices are scanned.
function cycleSelect(el) {
    const n = el.options.length;
    if (!n) return 'stay';
    let i = el.selectedIndex;
    for (let step = 0; step < n; step++) {
        i = (i + 1) % n;
        if (!el.options[i].disabled) break;
    }
    el.selectedIndex = i;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return 'stay';
}
function openList(el) {
    closeList();
    listFor = el;
    listEl = document.createElement('div');
    listEl.id = 'scanList';
    listEl.setAttribute('role', 'listbox');
    const r = el.getBoundingClientRect();
    listEl.style.left = `${Math.max(4, r.left)}px`;
    listEl.style.top = `${Math.max(4, Math.min(r.bottom, window.innerHeight * 0.4))}px`;
    listEl.style.minWidth = `${r.width}px`;
    [...el.options].forEach((o, i) => {
        if (o.disabled) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'scan-list-item' + (i === el.selectedIndex ? ' scan-list-current' : '');
        b.textContent = o.textContent;
        b.dataset.index = String(i);
        listEl.appendChild(b);
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'scan-list-item scan-list-cancel';
    cancel.textContent = 'Close the list';
    listEl.appendChild(cancel);
    (el.closest('dialog[open]') || document.body).appendChild(listEl);
    pendingFocus = keyFor(listEl.children[Math.max(0, [...listEl.children].findIndex((c) => c.classList.contains('scan-list-current')))]);
    return 'stay';
}
function closeList() {
    if (listEl) listEl.remove();
    listEl = null;
}
function listRoot() {
    return [...listEl.querySelectorAll('button')].map((b) => itemNode(b, { needsTwo: false, act: () => {
        const sel = listFor;
        if (b.dataset.index !== undefined && sel) {
            sel.selectedIndex = Number(b.dataset.index);
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closeList();
        pendingFocus = sel ? keyFor(sel) : null;
        return 'stay';
    } }));
}
function stepRange(el) {
    const step = Number(el.step) || 1;
    const max = Number(el.max || 100), min = Number(el.min || 0);
    let v = Number(el.value) + step;
    if (v > max) v = min;
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------------------------------------------------------------- pressing a button

// A complete touch, start and end: some buttons act at the start of a touch (the
// keyboard keys), so a click alone would not do (Design section 2.2).
function press(el, opts = {}) {
    if (!el || !el.isConnected) return;
    synthetic++;
    try {
        if (opts.confirmed || tapGuard.needsSecondTap(el)) tapGuard.letNextThrough(true);
        const o = { bubbles: true, cancelable: true, composed: true, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, pointerId: 1 };
        el.dispatchEvent(new PointerEvent('pointerdown', o));
        if (el.isConnected) el.dispatchEvent(new MouseEvent('mousedown', o));
        if (el.isConnected) el.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
        if (el.isConnected) el.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
        if (el.isConnected) el.click();
    } finally {
        tapGuard.letNextThrough(false);
        synthetic--;
    }
}

function perform(effect) {
    const n = effect.node;
    markChosen(n.el || n.frame);
    let how = n.after || 'region';
    if (n.act) {
        const r = n.act();
        if (r) how = r;
    } else if (n.el) {
        press(n.el, { confirmed: effect.confirmed });
    }
    if (how === 'key') {
        if (scan.stayKey) { stayPending = true; scanner.afterAct('stay'); }
        else scanner.afterAct(scan.pattern === 'items' ? 'top' : 'region');
    } else if (how && typeof how === 'object' && how.focusFirstIn) {
        const first = firstKeyIn(how.focusFirstIn);
        scanner.afterAct(first ? { focusKey: first } : 'stay');
    } else {
        scanner.afterAct(how);
    }
    // The screen may have changed under the press; the next update catches up.
    queueUpdate();
}

function firstKeyIn(container) {
    if (!container) return null;
    const keys = [];
    const walkNodes = (nodes) => { for (const n of nodes) { if (n.el && container.contains(n.el)) { keys.push(n.key); return; } } };
    walkNodes(buildRoot());
    return keys[0] || null;
}

// ---------------------------------------------------------------- moving and choosing

function move(dir) {
    if (!scanner) return;
    // The reading time is for the wait on the options themselves. Any move makes a
    // pending one stale, or it would surface later as one long, unexplained pause.
    readingNext = false;
    if (stayPending) {
        stayPending = false;
        scanner.afterAct(scan.pattern === 'items' ? 'top' : 'region');
    } else if (dir > 0) {
        scanner.advance();
    } else {
        scanner.retreat();
    }
    afterMove();
}
function afterMove() {
    const n = scanner.current();
    // Options that arrived while the user was elsewhere get their reading time now.
    if (readOnOptions && n && n.key === 'options') { readingNext = true; readOnOptions = false; }
    releaseHeldOptions();
    draw();
    schedule();
}

function choose() {
    if (!scanner) return;
    const effect = scanner.choose();
    stayPending = false;
    clearTimeout(holdTimer);
    if (!effect) { draw(); schedule(); return; }
    if (effect.type === 'hold') {
        // Waiting for the second press, for as long as "Time allowed between the two
        // taps" allows; then the scan carries on.
        holdTimer = setTimeout(() => { scanner.cancelHold(); draw(); schedule(); }, storage.loadDoubleTapMs());
        clearTimeout(autoTimer);
        draw();
        return;
    }
    if (effect.type === 'act') perform(effect);
    releaseHeldOptions();
    draw();
    schedule();
}

function schedule() {
    clearTimeout(autoTimer);
    if (!on || scan.method !== 'auto' || !scanner || scanner.held()) return;
    const wait = (readingNext ? scan.reading : scan.speed) * 1000;
    readingNext = false;
    autoTimer = setTimeout(() => move(1), Math.max(200, wait));
}

// ---------------------------------------------------------------- the switches

function stopRace() { clearTimeout(raceTimer); raceTimer = null; }
function race(dir, k = 1) {
    move(dir);
    raceTimer = setTimeout(() => race(dir, k + 1), raceWait(k, scan) * 1000);
}
function rawDown(n) {
    lightTest(n, true);
    if (!on || n > count) return;   // a switch the user doesn't have does nothing
    const s = sw[n];
    if (s.down) return;
    s.down = true; s.t = performance.now(); s.raced = false;
    // Inverse: hold switch 1 and the highlight moves; let go to choose.
    if (n === 1 && scan.method === 'inverse') {
        if (!scanner.held()) { clearInterval(inverseTimer); clearTimeout(autoTimer); inverseTimer = setInterval(() => move(1), scan.speed * 1000); }
        return;
    }
    // Hold to move: hold to move, let go to stop, tap to choose.
    if (n === 1 && scan.method === 'hold') {
        if (!scanner.held()) s.raceTimer = setTimeout(() => {
            if (!s.down) return;
            s.raced = true; move(1);
            raceTimer = setTimeout(() => race(1, 2), raceWait(1, scan) * 1000);
        }, scan.tapMs);
        return;
    }
    // Step: holding a switch that moves races once the press is a hold.
    if (scan.method === 'step' && n !== 2) {
        s.raceTimer = setTimeout(() => { if (!s.down || scanner.held()) return; s.raced = true; race(n === 1 ? 1 : -1); }, scan.tapMs);
    }
    if (scan.actOn === 'press') {
        if (scan.minMs > 0) s.minTimer = setTimeout(() => { if (s.down) accept(n); }, scan.minMs);
        else accept(n);
    }
}
function rawUp(n) {
    lightTest(n, false);
    const s = sw[n];
    if (!s.down) return;
    s.down = false;
    clearTimeout(s.minTimer); clearTimeout(s.raceTimer);
    if (s.raced) stopRace();
    if (!on) return;
    if (n === 1 && scan.method === 'inverse') { clearInterval(inverseTimer); accept(1); return; }
    if (n === 1 && scan.method === 'hold') { if (!s.raced && performance.now() - s.t >= scan.minMs) accept(1); return; }
    if (scan.actOn === 'release' && !s.raced && performance.now() - s.t >= scan.minMs) accept(n);
}
function accept(n) {
    const now = performance.now();
    if (now - lastAccept < scan.repeatMs) return;   // a quick repeat is a bounce
    lastAccept = now;
    if (scan.method === 'step') {
        if (n === 1) move(1);
        else if (n === 3) move(-1);
        else choose();
        return;
    }
    choose();
}

// The line on the Switch Access tab that lights up when a switch is pressed.
function lightTest(n, lit) {
    const el = $('switchTest' + n);
    if (el) el.classList.toggle('switch-test-lit', !!lit);
}

// ---------------------------------------------------------------- drawing

function ensureFrame(host) {
    if (!frameEl) {
        frameEl = document.createElement('div');
        frameEl.id = 'scanFrame';
        frameEl.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'scan-frame-label';
        frameEl.appendChild(label);
    }
    if (frameEl.parentNode !== host) host.appendChild(frameEl);
    return frameEl;
}
function clearMarks() {
    document.querySelectorAll('.scan-hl, .scan-held, .scan-in, .scan-chosen').forEach((e) => e.classList.remove('scan-hl', 'scan-held', 'scan-in'));
    if (frameEl) frameEl.hidden = true;
}
function draw() {
    clearMarks();
    if (!on || !scanner) { flush(); return; }
    const n = scanner.current();
    if (!n) { flush(); return; }
    for (const g of scanner.path()) if (g.el) g.el.classList.add('scan-in');
    if (n.kind === 'leave') {
        const target = n.frame;
        if (target) {
            const f = ensureFrame(target.closest('dialog[open]') || document.body);
            const r = target.getBoundingClientRect();
            Object.assign(f.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
            f.firstChild.textContent = n.label;
            f.hidden = false;
        }
    } else if (n.el) {
        n.el.classList.add(scanner.held() ? 'scan-held' : 'scan-hl');
        try { n.el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { /* ignore */ }
    }
    flush();
}
function markChosen(el) {
    if (!el || !el.classList) return;
    el.classList.remove('scan-chosen');
    void el.offsetWidth;
    el.classList.add('scan-chosen');
    setTimeout(() => el.classList.remove('scan-chosen'), 900);
}
// Our own class changes must not count as the screen changing.
function flush() { if (observer) observer.takeRecords(); }

// ---------------------------------------------------------------- keeping up with the screen

function queueUpdate() {
    if (updateQueued || !on) return;
    updateQueued = true;
    requestAnimationFrame(() => { updateQueued = false; update(); });
}
function update() {
    if (!on || !scanner) return;
    const id = currentScreen();
    if (id !== screenId) {
        screenId = id;
        stayPending = false;
        scanner.reset();
        if (pendingFocus) { scanner.afterAct({ focusKey: pendingFocus }); pendingFocus = null; }
        releaseHeldOptions();
        draw();
        schedule();
        return;
    }
    // The same screen, changed: keep the highlight where it is and the timer running.
    // Rescheduling here would freeze the scan while anything on screen keeps changing.
    scanner.refresh();
    if (pendingFocus) { scanner.afterAct({ focusKey: pendingFocus }); pendingFocus = null; schedule(); }
    releaseHeldOptions();
    draw();
}

// ---------------------------------------------------------------- new options

/**
 * New options while the user is scanning them (Proposal section 3.4): with "hold", the
 * newer set waits until the highlight leaves the options, so the cards do not change
 * under a press. Returns true when the caller should NOT show them yet; `render` is
 * called when they can be.
 */
export function holdOptions(render) {
    if (!on || scan.newOpts !== 'hold' || !scanner || currentScreen() !== 'conversation') return false;
    const inOptions = scanner.path().some((g) => g.key === 'options');
    if (!inOptions) return false;
    heldOptions = render;
    return true;
}
/** Drop a held set (the conversation moved on, so it is stale). */
export function dropHeldOptions() { heldOptions = null; }
function releaseHeldOptions() {
    if (!heldOptions || !scanner) return;
    if (scanner.path().some((g) => g.key === 'options')) return;
    const r = heldOptions;
    heldOptions = null;
    r();
}

/**
 * A new set of options is on screen. When the highlight is not inside a group, it
 * goes to the whole response options region for the reading time, and a press then
 * enters it; otherwise the reading time waits until the scan gets there.
 */
export function optionsArrived() {
    if (!on || !scanner) return;
    requestAnimationFrame(() => {
        if (currentScreen() !== 'conversation' || scan.pattern !== 'regions') return;
        scanner.refresh();
        if (!scanner.path().some((g) => g.key === 'options') && scanner.focus('options')) {
            readingNext = true; draw(); schedule(); return;
        }
        readOnOptions = true;
    });
}

// ---------------------------------------------------------------- input wiring

let installed = false;
function install() {
    if (installed) return;
    installed = true;
    // While switch access is on, touch does nothing and a mouse is a set of switches.
    const block = (e) => {
        if (!on || synthetic) return;
        if (e.type === 'pointerdown' && e.pointerType === 'mouse' && mouseOn && MOUSE[e.button]) rawDown(MOUSE[e.button]);
        if (e.type === 'pointerup' && e.pointerType === 'mouse' && mouseOn && MOUSE[e.button]) rawUp(MOUSE[e.button]);
        e.preventDefault();
        e.stopImmediatePropagation();
    };
    for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'touchstart', 'touchend']) {
        window.addEventListener(t, block, { capture: true, passive: false });
    }
    window.addEventListener('keydown', (e) => {
        if (capture) {
            e.preventDefault(); e.stopImmediatePropagation();
            if (e.repeat) return;
            const c = capture; capture = null;
            if (e.code !== 'Escape') { lastSetCode = e.code; c.done(e.code); }
            else c.done(null);
            return;
        }
        if (!on) return;
        const n = map[e.code];
        if (!n) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (!e.repeat) rawDown(n);
    }, true);
    window.addEventListener('keyup', (e) => {
        if (e.code && e.code === lastSetCode) { lastSetCode = ''; e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (!on) return;
        const n = map[e.code];
        if (!n) return;
        e.preventDefault(); e.stopImmediatePropagation();
        rawUp(n);
    }, true);
    observer = new MutationObserver(() => queueUpdate());
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['class', 'hidden', 'disabled', 'open', 'inert', 'aria-disabled'] });
    window.addEventListener('resize', () => queueUpdate());
}

/** Read the settings from storage and turn scanning on or off to match. */
export function configure() {
    count = storage.loadSwitchCount();
    scan = storage.loadSwitchScan(count);
    map = keyMap(storage.loadSwitchKeys());
    mouseOn = storage.loadMouseSwitches();
    const wasOn = on;
    on = count > 0;
    document.body.classList.toggle('switch-access-on', on);
    clearTimeout(autoTimer); autoTimer = null;
    readingNext = false; readOnOptions = false;
    clearInterval(inverseTimer); stopRace();
    for (const s of Object.values(sw)) { s.down = false; clearTimeout(s.minTimer); clearTimeout(s.raceTimer); }
    if (!on) { heldOptions = null; closeList(); clearMarks(); return; }
    install();
    if (!scanner) scanner = createScanner({ build: buildRoot, cfg: () => scan, now: () => performance.now() });
    if (!wasOn) { screenId = currentScreen(); scanner.reset(); }
    else scanner.refresh();
    draw();
    schedule();
}

export function init() { configure(); }
export function isOn() { return on; }
export function switchCount() { return count; }

/** Wait for the next key and hand it to `done(code)` (null on Escape): setting a switch's key. */
export function captureKey(done) {
    capture = { done };
}
export function keyLabel(code) { return keyName(code); }

/** Show which keys each switch answers to. */
export function keysFor(n) {
    return Object.keys(map).filter((c) => map[c] === n).map(keyName);
}

/*
 * THE FIRST-LAUNCH QUESTION (Switch Access Design section 2.7). On the very first
 * launch the start screen asks once: touch, one switch, two or three. A touch user taps
 * "Touch". For a switch user the choices are highlighted in turn and switch 1, on one
 * of the starting keys, picks the highlighted one. Switch access is not on yet, so
 * touch works here; the keys are listened to directly.
 */
export function runChooser(buttons, onPick) {
    let i = 0;
    let timer = null;
    const paint = () => buttons.forEach((b, k) => b.classList.toggle('scan-hl', k === i));
    const tick = () => { i = (i + 1) % buttons.length; paint(); timer = setTimeout(tick, STARTING_VALUES[1].speed * 1000); };
    const keyHandler = (e) => {
        if (!['Space', 'Digit1', 'Numpad1', 'Enter', 'NumpadEnter'].includes(e.code)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.repeat) return;
        finish(buttons[i].dataset.count);
    };
    const finish = (n) => {
        clearTimeout(timer);
        window.removeEventListener('keydown', keyHandler, true);
        buttons.forEach((b) => b.classList.remove('scan-hl'));
        onPick(Number(n) || 0);
    };
    buttons.forEach((b) => b.addEventListener('click', () => finish(b.dataset.count), { once: true }));
    window.addEventListener('keydown', keyHandler, true);
    paint();
    timer = setTimeout(tick, STARTING_VALUES[1].speed * 1000);
}
