/* AAC Conversation Assistant — app virtual keyboard (June 2026)
 *
 * The on-screen keyboard the user types with when they choose
 * Settings → "Keyboard for typing" → "On-screen keyboard (app's own)".
 *
 * Why this exists (CLAUDE.md "In My Own Words" / keyboard-selection spec):
 * on a Surface, Windows shows no keyboard with the type cover in laptop
 * position but auto-pops its own when the cover is folded back/detached.
 * The browser exposes no reliable signal for that posture, so a user-set
 * Settings parameter decides. When the mode is 'onscreen' we (a) set
 * inputmode="none" on the in-scope fields so the Windows keyboard never
 * pops, and (b) show this keyboard, which inserts into the focused field.
 *
 * Scope: the "In your own words" composer (#composerInput) and the
 * "About Me" questionnaire inputs (.wv-text). Settings' own fields stay on
 * the OS/physical keyboard (Setup-tier, rare, often supporter-entered).
 *
 * Access-method note: this is just the direct-select renderer of text
 * entry. It keeps focus on the target field (keys act on pointerdown +
 * preventDefault) so the caret never moves and no field blurs mid-type.
 */

import { LAYOUTS, SYMBOLS } from './keyboard-layouts.js';
import { setIconButton } from './icons.js';
import * as prediction from './prediction.js';

// Fields the app keyboard handles. Includes the Settings API-key field so the
// Windows keyboard is suppressed there too and the app's own (side-docked)
// keyboard is used instead (Ken, June 14 2026 — resolves the OS-vs-app keyboard
// question for Settings in favor of the app keyboard).
const IN_SCOPE = '#composerInput, .wv-text, #apiKeyInput';

// Controls that must NOT dismiss the keyboard when tapped, even though tapping
// them blurs the composer textarea. The composer (unlike About Me / Settings)
// has no serving panel, so without this its Speak/Clear buttons trip the
// focusout → hide() path, which reflows the layout out from under the finger and
// steals the first click — so Speak only worked on the second press (Ken, June
// 19 2026). Keeping the keyboard up keeps the layout stable so the tap lands.
const KEEP_OPEN_CONTROLS = '#speakBtn, #reframeBtn, #cancelComposerBtn';

// The element under the most recent pointerdown. On touch a tapped <button> is
// frequently NOT reported as focusout.relatedTarget, so relatedTarget alone
// can't tell us the blur was caused by tapping a keep-open control — this can.
let lastPointerDownEl = null;

let mode = 'physical';          // 'physical' | 'onscreen'
let rootEl = null;              // the keyboard panel
let activeField = null;         // the input/textarea currently being typed into
let predWrap = null;            // the word-prediction button container in the toolbar
const PRED_COUNT = 3;           // number of prediction slots

// Selected layouts per dock + which side the side dock sits on (user Settings).
let sideLayoutId = 'S1';
let bottomLayoutId = 'B1';
let sideDockPosition = 'right'; // 'left' | 'right'
let keyboardDock = 'bottom';    // 'side' | 'bottom' — the user's single choice
let currentDock = 'bottom';     // the dock currently applied
// Settings "layout preview": the keyboard is shown for previewing a layout
// without a focused field (so it doesn't vanish when you leave a text field to
// change layouts on the Speech & Input tab).
let previewing = false;

// Shift state machine (CLAUDE.md keyboard spec, June 2026):
//   'off'   — lowercase
//   'shift' — one-shot: next letter is uppercase, then auto-reverts to 'off'
//   'lock'  — caps lock: stays uppercase until shift is tapped again
// A single tap toggles off↔shift; a double tap (within SHIFT_DOUBLE_TAP_MS)
// engages 'lock'. A non-touch-typing user gets a Caps-Lock-style sticky shift
// without having to hold a key.
let shiftState = 'off';
let lastShiftTap = 0;
const SHIFT_DOUBLE_TAP_MS = 300;

// Which page is showing: 'letters' or 'symbols'. Numbers and special
// characters live on the symbols page (toggled with the 123 / ABC key) so
// the letters page stays uncluttered. Comma, period, space and backspace stay
// on the letters page per Ken's spec; space, backspace and enter are repeated
// on the symbols page because editing is impossible without them.
let page = 'letters';

// Layout is ALPHABETICAL (QWERTY dropped). The specific arrangement is a user
// Setting — twenty layouts live in keyboard-layouts.js (S1–S10 side, B1–B10
// bottom), one chosen per dock. The active letters page = the selected layout
// for the current dock; the 123 key flips to a dock-appropriate symbols page.

// Returns the rows to render right now (active layout's letters, or symbols).
function currentRows() {
    if (page === 'symbols') return SYMBOLS[currentDock] || SYMBOLS.bottom;
    const id = currentDock === 'side' ? sideLayoutId : bottomLayoutId;
    return (LAYOUTS[id] || LAYOUTS[currentDock === 'side' ? 'S1' : 'B1']).rows;
}

// --- field helpers ----------------------------------------------------------

function isScoped(node) {
    return node instanceof Element && node.matches(IN_SCOPE);
}

function applyInputMode(node) {
    // inputmode="none" is the reliable Edge/Chrome switch that stops the
    // Windows touch keyboard from appearing on focus.
    node.inputMode = mode === 'onscreen' ? 'none' : '';
}

function applyInputModeAll() {
    document.querySelectorAll(IN_SCOPE).forEach(applyInputMode);
}

// --- typing into the active field ------------------------------------------

function insert(text) {
    const f = activeField;
    if (!f) return;
    const start = f.selectionStart ?? f.value.length;
    const end = f.selectionEnd ?? f.value.length;
    f.value = f.value.slice(0, start) + text + f.value.slice(end);
    const pos = start + text.length;
    f.setSelectionRange(pos, pos);
    f.dispatchEvent(new Event('input', { bubbles: true }));
    // Keep the cursor visible as text grows past the field width (the keyboard
    // narrows inputs compared to the full-width OS layout).
    requestAnimationFrame(() => { if (f.isConnected && f.tagName === 'INPUT') f.scrollLeft = f.scrollWidth; });
}

function backspace() {
    const f = activeField;
    if (!f) return;
    let start = f.selectionStart ?? f.value.length;
    const end = f.selectionEnd ?? f.value.length;
    if (start === end) {
        if (start === 0) return;
        start -= 1;
    }
    f.value = f.value.slice(0, start) + f.value.slice(end);
    f.setSelectionRange(start, start);
    f.dispatchEvent(new Event('input', { bubbles: true }));
}

function enter() {
    // TODO (Ken, June 2026 — to discuss/revisit): Enter may need to behave
    // differently per context (newline vs. save vs. speak), and the keyboard
    // likely needs a formal "close/done" key rather than relying on Enter or a
    // focus-out to dismiss it. Current behavior: newline in a textarea, save in
    // a single-line field. See CLAUDE.md "App virtual keyboard" notes.
    const f = activeField;
    if (!f) return;
    if (f.tagName === 'TEXTAREA') {
        insert('\n');
    } else {
        // Single-line fields (composer is a textarea; worldview inputs are
        // text) save on Enter — fire the keydown their handlers listen for.
        f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
}

function applyShiftVisual() {
    if (!rootEl) return;
    rootEl.classList.toggle('kbd-shift-on', shiftState === 'shift');
    rootEl.classList.toggle('kbd-caps', shiftState === 'lock');
    const upper = shiftState !== 'off';
    rootEl.querySelectorAll('.kbd-key[data-char]').forEach((k) => {
        const ch = k.dataset.char;
        if (/[a-z]/i.test(ch)) k.textContent = upper ? ch.toUpperCase() : ch.toLowerCase();
    });
}

function onShift() {
    const now = Date.now();
    if (now - lastShiftTap < SHIFT_DOUBLE_TAP_MS) {
        shiftState = 'lock';                                  // double tap → caps lock
    } else {
        shiftState = shiftState === 'off' ? 'shift' : 'off';  // single tap toggles
    }
    lastShiftTap = now;
    applyShiftVisual();
}

// One-shot shift reverts to lowercase after a single character; caps lock stays.
function consumeShift() {
    if (shiftState === 'shift') { shiftState = 'off'; applyShiftVisual(); }
}

// --- clipboard (cut / copy / paste toolbar) --------------------------------
// A fixed Cut/Copy/Paste strip above the keys, the same for every layout. The
// app keyboard suppresses the OS keyboard, so these give back the clipboard
// affordances the OS keyboard would have provided (notably paste for the API
// key). Buttons act on pointerdown + preventDefault so the field keeps focus
// and its selection. localhost and https are secure contexts, so the async
// Clipboard API is available.

function selectedText() {
    const f = activeField;
    if (!f) return '';
    return f.value.slice(f.selectionStart ?? 0, f.selectionEnd ?? 0);
}

function deleteSelection() {
    const f = activeField;
    if (!f) return;
    const s = f.selectionStart ?? 0;
    const e = f.selectionEnd ?? 0;
    if (s === e) return;
    f.value = f.value.slice(0, s) + f.value.slice(e);
    f.setSelectionRange(s, s);
    f.dispatchEvent(new Event('input', { bubbles: true }));
}

// Explicitly dismiss the keyboard (the toolbar's Hide button) while leaving any
// open panel (e.g. Settings) in place. Blurs the field so a later tap re-opens
// it; ends preview mode so it stays down until re-triggered.
function dismiss() {
    previewing = false;
    const f = activeField;
    hide();                       // clears activeField + hides
    if (f) { try { f.blur(); } catch { /* ignore */ } }
    // Hide runs on pointerdown; the tap's trailing CLICK fires afterwards.
    // Hiding frees the keyboard's reserved space, so the page reflows and
    // another control (e.g. About Me's "Done" button) can slide under the
    // pointer — the ghost click would then hit it (closing About Me). Swallow
    // that one click.
    suppressNextClick();
}

function suppressNextClick() {
    const onClick = (e) => { e.stopPropagation(); e.preventDefault(); cleanup(); };
    const cleanup = () => { document.removeEventListener('click', onClick, true); clearTimeout(timer); };
    const timer = setTimeout(cleanup, 400);   // in case no click follows (e.g. keyboard nav)
    document.addEventListener('click', onClick, true);   // capture: intercept before it reaches the moved control
}

async function handleTool(tool) {
    if (tool === 'hide') { dismiss(); return; }
    if (!activeField) return;
    if (tool === 'copy' || tool === 'cut') {
        const text = selectedText();
        if (!text) return;
        try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
        if (tool === 'cut') deleteSelection();
    } else if (tool === 'paste') {
        try {
            const text = await navigator.clipboard.readText();
            if (text) insert(text);   // insert() replaces any selection at the caret
        } catch { /* clipboard read blocked/denied */ }
    }
}

// --- key handling -----------------------------------------------------------

function handleKey(keyEl) {
    const action = keyEl.dataset.action;
    if (action === 'shift') { onShift(); return; }
    if (action === 'page') { page = page === 'symbols' ? 'letters' : 'symbols'; renderRows(); return; }
    if (action === 'backspace') { backspace(); updatePredictions(); return; }
    // Space / Enter close a word — learn it before the boundary, then refresh.
    if (action === 'space') { learnCurrentWord(); insert(' '); consumeShift(); updatePredictions(); return; }
    if (action === 'enter') { learnCurrentWord(); enter(); updatePredictions(); return; }

    const ch = keyEl.dataset.char;
    if (ch == null) return;
    const upper = shiftState !== 'off';
    insert(upper && /[a-z]/i.test(ch) ? ch.toUpperCase() : ch);
    consumeShift();
    updatePredictions();
}

// --- word prediction (local; see prediction.js) ----------------------------

// The partial word immediately before the caret (letters/apostrophe). Empty for
// the API-key field (a key is not natural-language) and when not on a word.
function currentWordPrefix() {
    const f = activeField;
    if (!f || f.id === 'apiKeyInput') return '';
    const caret = f.selectionStart ?? f.value.length;
    const m = f.value.slice(0, caret).match(/[A-Za-z']+$/);
    return m ? m[0] : '';
}

function learnCurrentWord() {
    const w = currentWordPrefix();
    if (w) prediction.learn(w);
}

// Fill the toolbar's prediction buttons from the current prefix; hide the spare
// slots. Called after every text change.
function updatePredictions() {
    if (!predWrap) return;
    const prefix = currentWordPrefix();
    const preds = prefix ? prediction.predict(prefix, PRED_COUNT) : [];
    predWrap.querySelectorAll('.kbd-pred-btn').forEach((b, i) => {
        const w = preds[i];
        if (w) { b.textContent = w; b.dataset.word = w; b.hidden = false; }
        else { b.textContent = ''; delete b.dataset.word; b.hidden = true; }
    });
}

// Replace the partial word at the caret with the chosen prediction + a space,
// matching the typed prefix's capitalization, then learn it.
function applyPrediction(word) {
    const f = activeField;
    if (!f) return;
    const caret = f.selectionStart ?? f.value.length;
    const before = f.value.slice(0, caret);
    const m = before.match(/[A-Za-z']+$/);
    const start = m ? caret - m[0].length : caret;
    let out = word;
    if (m && m[0][0] === m[0][0].toUpperCase()) out = word.charAt(0).toUpperCase() + word.slice(1);
    f.value = f.value.slice(0, start) + out + ' ' + f.value.slice(caret);
    const pos = start + out.length + 1;
    f.setSelectionRange(pos, pos);
    f.dispatchEvent(new Event('input', { bubbles: true }));
    prediction.learn(word);
    updatePredictions();
    if (f.tagName === 'INPUT') requestAnimationFrame(() => { if (f.isConnected) f.scrollLeft = f.scrollWidth; });
}

// --- DOM build --------------------------------------------------------------

function build() {
    rootEl = document.createElement('div');
    rootEl.id = 'appKeyboard';
    rootEl.className = 'hidden';
    rootEl.setAttribute('role', 'group');
    rootEl.setAttribute('aria-label', 'On-screen keyboard');

    // Act on pointerdown and preventDefault so the target field keeps focus
    // and the caret never moves (the standard on-screen-keyboard trick).
    rootEl.addEventListener('pointerdown', (e) => {
        const tool = e.target.closest('.kbd-tool');
        if (tool) { e.preventDefault(); handleTool(tool.dataset.tool); return; }
        const pred = e.target.closest('.kbd-pred-btn');
        if (pred) { e.preventDefault(); if (pred.dataset.word) applyPrediction(pred.dataset.word); return; }
        const keyEl = e.target.closest('.kbd-key');
        if (!keyEl) return;
        e.preventDefault();
        handleKey(keyEl);
    });

    // Persistent toolbar above the keys (layout-independent): Cut/Copy/Paste,
    // plus a Hide button (pushed right) that dismisses the keyboard while
    // leaving any open panel — e.g. Settings — in place.
    const toolbar = document.createElement('div');
    toolbar.className = 'kbd-toolbar';
    // Icon-only toolbar buttons (Rule 4); the accessible name is kept via
    // aria-label/title. Converting from text labels frees the row's horizontal
    // space, which the word-prediction buttons now fill.
    const makeTool = (tool, label, icon) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kbd-tool';
        if (tool === 'hide') btn.classList.add('kbd-tool-hide');
        btn.dataset.tool = tool;
        setIconButton(btn, icon, label);
        return btn;
    };
    toolbar.appendChild(makeTool('cut', 'Cut', 'cut'));
    toolbar.appendChild(makeTool('copy', 'Copy', 'copy'));
    toolbar.appendChild(makeTool('paste', 'Paste', 'paste'));
    // Word-prediction buttons (local, no AI — see prediction.js) fill the
    // reclaimed toolbar space. They show predicted words as TEXT (content —
    // exempt from the icon-only rule) and stay hidden until there's a prefix.
    predWrap = document.createElement('div');
    predWrap.className = 'kbd-preds';
    for (let i = 0; i < PRED_COUNT; i++) {
        const pb = document.createElement('button');
        pb.type = 'button';
        pb.className = 'kbd-pred-btn';
        pb.hidden = true;
        predWrap.appendChild(pb);
    }
    toolbar.appendChild(predWrap);
    toolbar.appendChild(makeTool('hide', 'Hide the keyboard', 'hide'));
    rootEl.appendChild(toolbar);

    renderRows();
    document.body.appendChild(rootEl);
}

// (Re)builds the key buttons for the current page. The pointerdown handler is
// delegated on rootEl, so swapping the inner rows on a page/layout change is
// safe. Each cell's `span` becomes its flex weight, so a row of any width fills
// the keyboard and wide keys (space, etc.) keep their proportions.
function renderRows() {
    if (!rootEl) return;
    // Clear only the key rows — the Cut/Copy/Paste toolbar persists.
    rootEl.querySelectorAll('.kbd-row').forEach((el) => el.remove());
    for (const row of currentRows()) {
        const rowEl = document.createElement('div');
        rowEl.className = 'kbd-row';
        for (const cell of row) {
            const span = cell.span || 1;
            if (cell.kind === 'blank' || cell.kind === 'pred') {
                // Inert filler / future prediction slot — no key, just holds space.
                const filler = document.createElement('div');
                filler.className = 'kbd-key kbd-' + cell.kind;
                filler.style.flex = `${span} 1 0`;
                rowEl.appendChild(filler);
                continue;
            }
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'kbd-key';
            btn.style.flex = `${span} 1 0`;
            if (cell.kind === 'char') {
                btn.dataset.char = cell.char;
                btn.textContent = cell.char;
                if (/[a-z]/i.test(cell.char)) btn.classList.add('kbd-letter');
                else btn.classList.add('kbd-char');
            } else {
                btn.dataset.action = cell.action;
                btn.textContent = cell.label;
                btn.classList.add('kbd-' + cell.action);
            }
            rowEl.appendChild(btn);
        }
        rootEl.appendChild(rowEl);
    }
    applyShiftVisual();
}

// --- show / hide ------------------------------------------------------------

// Docking is now a single USER CHOICE applied to every typing context (Ken,
// June 21 2026 — replaces the old context-based rule where About Me/Settings
// were side and the conversation composer was bottom). Whichever dock the user
// picked in Settings is used wherever the keyboard appears.
function dockFor(/* field */) {
    return keyboardDock;
}

let lastDockKey = '';

function setDock(dock) {
    currentDock = dock;
    const side = dock === 'side';
    const left = side && sideDockPosition === 'left';
    const right = side && sideDockPosition === 'right';
    for (const el of [rootEl, document.body]) {
        el.classList.toggle('kbd-dock-side', side);
        el.classList.toggle('kbd-dock-bottom', !side);
        el.classList.toggle('kbd-side-left', left);
        el.classList.toggle('kbd-side-right', right);
    }
    // Notify listeners (the Settings panel re-snaps clear of the keyboard) only
    // when the effective dock/side actually changes — not on every re-show.
    const key = side ? (left ? 'side-left' : 'side-right') : 'bottom';
    if (key !== lastDockKey) {
        lastDockKey = key;
        document.dispatchEvent(new CustomEvent('kbd-dock-change', { detail: { dock: key } }));
    }
}

function visible() {
    return rootEl && !rootEl.classList.contains('hidden');
}

// Is a panel the keyboard serves (About Me / Settings) currently open? Used to
// keep the keyboard up when an in-panel button (Save, etc.) blurs the field —
// see the focusout handler. Robust where `relatedTarget` isn't the button.
function servingPanelOpen() {
    const dlg = document.getElementById('settingsDialog');
    const wv = document.getElementById('worldviewScreen');
    return !!((dlg && dlg.open) || (wv && !wv.classList.contains('hidden')));
}

function show(field) {
    activeField = field;
    // Start each field in one-shot Shift so the first letter is capitalized
    // (proper nouns in About Me — Carl, Chicago, Mom — and sentence starts in
    // the composer). One-shot reverts to lowercase after that first character.
    // The API key is case-sensitive and lowercase ("sk-ant-…"), so leave it off.
    shiftState = field.id === 'apiKeyInput' ? 'off' : 'shift';
    setDock(dockFor(field));
    // A modal <dialog> (Settings) lives in the top layer and renders above —
    // and makes inert — anything in normal flow. So when the focused field is
    // inside an open modal dialog, host the keyboard inside that dialog so it's
    // in the same top layer and stays interactive. The keyboard is
    // position:fixed (viewport-relative) and the dialog sets no containing
    // block (no transform), so it still docks to the screen edge and isn't
    // clipped by the dialog's overflow.
    const host = field.closest('dialog[open]') || document.body;
    if (rootEl.parentNode !== host) host.appendChild(rootEl);
    renderRows();
    rootEl.classList.remove('hidden');
    document.body.classList.add('kbd-open');
    updatePredictions(); // seed predictions for any text already in the field
    // Keep the focused field clear of the keyboard. The content area reserves
    // viewport-relative padding (CSS) so the field can scroll above a
    // bottom dock; centring it lands it in the visible band above the keys.
    requestAnimationFrame(() => {
        try { field.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* ignore */ }
        // Scroll the input so the end of any existing text stays visible after
        // the keyboard opens and potentially narrows the field.
        if (field.tagName === 'INPUT') field.scrollLeft = field.scrollWidth;
    });
}

function hide() {
    activeField = null;
    // Reset to a clean slate for the next field: lowercase, letters page.
    shiftState = 'off';
    page = 'letters';
    renderRows();
    updatePredictions(); // clears the prediction buttons (no active field)
    if (rootEl) rootEl.classList.add('hidden');
    document.body.classList.remove('kbd-open', 'kbd-dock-side', 'kbd-dock-bottom', 'kbd-side-left', 'kbd-side-right');
}

// --- public API -------------------------------------------------------------

export function init() {
    build();
    prediction.load(); // bundled word list + personalized frequencies (async)

    // Track the last pointerdown target so focusout can tell whether the blur
    // was caused by tapping a keep-open control (Speak/Clear), even on touch
    // where the button isn't reported as relatedTarget. Capture phase so we see
    // it before the keyboard's own handlers / the focusout fire.
    document.addEventListener('pointerdown', (e) => {
        lastPointerDownEl = e.target instanceof Element ? e.target : null;
    }, true);

    document.addEventListener('focusin', (e) => {
        if (mode !== 'onscreen') return;
        if (isScoped(e.target)) {
            applyInputMode(e.target);   // just-in-time guard for fresh fields
            show(e.target);
        }
    });

    document.addEventListener('focusout', (e) => {
        // Hide unless focus is moving to another in-scope field (handled by the
        // next focusin) — keys preventDefault, so typing never fires this.
        const next = e.relatedTarget;
        if (next && (isScoped(next) || (rootEl && rootEl.contains(next)))) return;
        // Keep the keyboard up while a panel it serves (About Me / Settings) is
        // still open. Tapping an in-panel button (Save, etc.) blurs the field,
        // but on many browsers — especially touch — the button does NOT become
        // `relatedTarget`, so we can't rely on it. Keeping the keyboard whenever
        // the serving panel is open is robust and matches the desired behavior:
        // - it must not hide on Save (Ken's bug 2), and
        // - it must not reflow the layout out from under the tap, which steals
        //   the first click and forces a second Save press (Ken's bug 3).
        // The panels' explicit close paths (worldview close(), Settings
        // Close/Escape, renderHome) and the Hide button take it down.
        if (servingPanelOpen()) return;
        if (previewing) return;   // keep the Settings layout-preview keyboard up
        // Keep up when the blur was caused by tapping a composer control (Speak /
        // Clear) so the reflow doesn't steal the tap. relatedTarget covers
        // desktop; lastPointerDownEl covers touch where the button isn't reported.
        const tapTarget = next || lastPointerDownEl;
        if (tapTarget && tapTarget.closest && tapTarget.closest(KEEP_OPEN_CONTROLS)) return;
        hide();
    });

    // Worldview cards are (re)built dynamically; tag any new in-scope field so
    // the Windows keyboard is suppressed before its first focus.
    const dynamicRoot = document.getElementById('worldviewContent');
    if (dynamicRoot) {
        new MutationObserver((records) => {
            if (mode !== 'onscreen') return;
            for (const rec of records) {
                for (const node of rec.addedNodes) {
                    if (!(node instanceof Element)) continue;
                    if (node.matches?.(IN_SCOPE)) applyInputMode(node);
                    node.querySelectorAll?.(IN_SCOPE).forEach(applyInputMode);
                }
            }
        }).observe(dynamicRoot, { childList: true, subtree: true });
    }
}

export function setMode(next) {
    mode = next === 'onscreen' ? 'onscreen' : 'physical';
    applyInputModeAll();
    if (mode === 'physical') { previewing = false; hide(); }
}

// --- Settings layout preview ------------------------------------------------
// Show the keyboard as a non-typing preview in the given dock (no focused
// field) so layouts can be tried on the Speech & Input tab without the keyboard
// vanishing. Hosted in the open Settings dialog so it shares the modal's top
// layer. previewHide() takes it down again (unless a real field is focused).

export function previewShow(dock) {
    if (!rootEl || mode !== 'onscreen') return;
    previewing = true;
    activeField = null;
    page = 'letters';
    shiftState = 'off';
    setDock(dock);
    const dlg = document.getElementById('settingsDialog');
    const host = (dlg && dlg.open) ? dlg : document.body;
    if (rootEl.parentNode !== host) host.appendChild(rootEl);
    renderRows();
    rootEl.classList.remove('hidden');
    document.body.classList.add('kbd-open');
}

export function previewHide() {
    if (!previewing) return;
    previewing = false;
    if (!activeField) hide();
}

// Programmatically dismiss the keyboard (used by a panel's close path, where we
// keep the keyboard up when focus moves to in-panel buttons but must take it
// down once the panel itself closes). Unlike the toolbar Hide button this does
// not suppress the next click — the caller is already closing the panel.
export function hideKeyboard() {
    previewing = false;
    hide();
}

export function getMode() {
    return mode;
}

// --- layout / dock-position settings (live-applied from Settings) -----------

export function setSideLayout(id) {
    if (!LAYOUTS[id]) return;
    sideLayoutId = id;
    if (visible() && currentDock === 'side' && page === 'letters') renderRows();
}

export function setBottomLayout(id) {
    if (!LAYOUTS[id]) return;
    bottomLayoutId = id;
    if (visible() && currentDock === 'bottom' && page === 'letters') renderRows();
}

export function setSideDockPosition(pos) {
    sideDockPosition = pos === 'left' ? 'left' : 'right';
    if (visible() && currentDock === 'side') setDock('side');
}

// The user's single dock choice ('side' | 'bottom'), applied to every typing
// context. If the keyboard is showing a real field, re-dock it live.
export function setKeyboardDock(dock) {
    keyboardDock = dock === 'side' ? 'side' : 'bottom';
    if (visible() && activeField) { setDock(keyboardDock); renderRows(); }
}
