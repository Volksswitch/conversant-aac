/* Control phrases editor (Settings → Controls) — Ken, June 28 2026
 *
 * Edits the spoken text behind the persistent override controls and the
 * opener / wind-down / closing cards (control-phrases.js): the "Hold on" and
 * "Pardon?" phrases (single strings) and the "Start conversation" openers, the
 * "Wind down" statements, and the closings/goodbyes (ordered lists). "Say again"
 * has no editable phrase — it re-speaks the user's own last words — so it's shown
 * as a read-only note.
 *
 * Reuses the Express-editor (.ee-*) styles for rows/buttons. Plain text edits
 * commit WITHOUT re-rendering so the field keeps focus while typing; structural
 * changes (add / delete / reorder / reset) re-render. Every change persists via
 * the model and calls onChange so the engine re-reads the openers/closers.
 */

import * as model from './control-phrases.js';
import { confirmDanger } from './confirm-dialog.js';

let container = null;
let onChangeCb = null;
let data = null;            // working copy { holdOn, pardon, openers, windDowns, closings }
let pendingFocus = null;    // { key, index } of a just-added list row to focus

export function init(el, opts = {}) {
    container = el;
    onChangeCb = opts.onChange || null;
}

function commit(rerender) {
    model.setPhrases(data);
    if (onChangeCb) onChangeCb();
    if (rerender) render();
}

function mkBtn(label, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    return b;
}

function textInput(value, placeholder, oninput) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value || '';
    inp.placeholder = placeholder || '';
    inp.autocomplete = 'off';
    inp.addEventListener('input', () => oninput(inp.value));
    return inp;
}

// A single-phrase control (Hold on / Pardon?): label + one text field.
function singleSection(title, key) {
    const sec = document.createElement('div');
    sec.className = 'setting-group cpe-section';
    sec.appendChild(Object.assign(document.createElement('label'), { textContent: title }));
    const row = document.createElement('div');
    row.className = 'ee-row ee-phrase';
    row.appendChild(textInput(data[key], 'What to say', (v) => { data[key] = v; commit(false); }));
    sec.appendChild(row);
    return sec;
}

// An ordered list of cards (openers / closers): rows with text + ↑ ↓ ✕, plus Add.
function listSection(title, key) {
    const sec = document.createElement('div');
    sec.className = 'setting-group cpe-section';
    sec.appendChild(Object.assign(document.createElement('label'), { textContent: title }));

    const list = document.createElement('div');
    list.className = 'ee-list';
    const arr = data[key];
    arr.forEach((text, i) => {
        const row = document.createElement('div');
        row.className = 'ee-row ee-phrase';
        row.appendChild(textInput(text, 'Card text', (v) => { arr[i] = v; commit(false); }));

        const tools = document.createElement('div');
        tools.className = 'ee-tools';
        const up = mkBtn('↑'); up.disabled = i === 0;
        up.addEventListener('click', () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; commit(true); });
        const down = mkBtn('↓'); down.disabled = i === arr.length - 1;
        down.addEventListener('click', () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; commit(true); });
        const del = mkBtn('✕', 'ee-del');
        del.disabled = arr.length <= 1; // never leave the list empty (no cards to show)
        del.addEventListener('click', () => { arr.splice(i, 1); commit(true); });
        tools.append(up, down, del);
        row.appendChild(tools);
        list.appendChild(row);
    });
    sec.appendChild(list);

    const add = mkBtn('+ Add', 'ee-add');
    add.addEventListener('click', () => { arr.push(''); pendingFocus = { key, index: arr.length - 1 }; commit(true); });
    sec.appendChild(add);
    return sec;
}

export function render() {
    if (!container) return;
    data = model.getPhrases();
    container.innerHTML = '';

    container.append(
        singleSection('“Hold on” phrase', 'holdOn'),
        singleSection('“Ask them to repeat” phrase', 'pardon'),
        listSection('Openers (Start conversation)', 'openers'),
        listSection('Wind-down statements (Wind down)', 'windDowns'),
        listSection('Closings (goodbyes)', 'closings'),
        singleSection('“One more thing” phrase', 'declineClosing'),
    );


    const reset = mkBtn('Reset to default', 'ee-reset');
    reset.addEventListener('click', async () => {
        const ok = await confirmDanger({
            title: 'Reset control phrases?',
            body: 'This restores the default wording for Hold on, Pardon?, the openers, the wind-down statements and the closings. Your edits will be lost.',
            confirmLabel: 'Reset to default',
            cancelLabel: 'Keep mine',
        });
        if (!ok) return;
        model.resetPhrases();
        if (onChangeCb) onChangeCb();
        render();
    });
    container.appendChild(reset);

    // Focus a just-added list row so the user can type immediately.
    if (pendingFocus) {
        const sel = `.ee-list`;
        const lists = container.querySelectorAll(sel);
        // The .ee-list order matches the listSection order: openers, windDowns, closings.
        const order = { openers: 0, windDowns: 1, closings: 2 };
        const idx = order[pendingFocus.key] ?? 0;
        const rows = lists[idx]?.querySelectorAll('.ee-row input');
        const inp = rows && rows[pendingFocus.index];
        pendingFocus = null;
        if (inp) { inp.scrollIntoView({ block: 'nearest' }); inp.focus(); }
    }
}
