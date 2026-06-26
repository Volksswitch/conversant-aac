/* Express Panel editor (Settings → Express Panel) — June 26 2026
 *
 * Edits the single ORDERED, TYPED item list backing the Express Panel (Ken's
 * chosen model: one list, each item tagged phrase / partner / feeling; the item's
 * position = its slot in the panel grid, so reordering re-maps the layout). A
 * starting layout is provided (express-items.DEFAULT_ITEMS) and "Reset to default"
 * restores it. The list persists via the express-panel.js model (data folder +
 * cache), so customizations follow the user across devices.
 *
 * Partner items may be picked from People I Know (the relationship graph) or typed
 * free-form (Ken: partners "may be" known people but need not be). A picked person
 * carries their personId + name + nickname so the conversation can use their
 * preferred term of address.
 *
 * Editing rules: structural changes (add / delete / reorder / pick a person)
 * re-render the editor; plain text edits commit WITHOUT re-rendering so the field
 * keeps focus while typing. Every change persists and calls onChange so the live
 * panel updates immediately.
 */

import * as expressPanel from './express-panel.js';
import * as relationships from './relationships.js';
import { CATEGORIES, INFLUENCER_COLORS, FEELING_PRESETS, makeId } from './express-items.js';
import { confirmDanger } from './confirm-dialog.js';

let container = null;
let onChangeCb = null;
let current = [];

export function init(el, opts = {}) {
    container = el;
    onChangeCb = opts.onChange || null;
}

function commit(rerender) {
    expressPanel.setItems(current);
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

function buildToolbar() {
    const bar = document.createElement('div');
    bar.className = 'ee-toolbar';

    const addItem = (label, factory) => {
        const b = mkBtn(label, 'ee-add');
        b.addEventListener('click', () => {
            current.push({ id: makeId(), ...factory() });
            commit(true);
        });
        bar.appendChild(b);
    };
    addItem('+ Phrase', () => ({ type: 'phrase', text: '', cat: 'back' }));
    addItem('+ Partner', () => ({ type: 'partner', name: '', nickname: '' }));
    addItem('+ Feeling', () => ({ type: 'feeling', text: '' }));

    const reset = mkBtn('Reset to default', 'ee-reset');
    reset.addEventListener('click', async () => {
        const ok = await confirmDanger({
            title: 'Reset the Express Panel?',
            body: 'This replaces your edited list with the default starting layout. Your customizations will be lost.',
            confirmLabel: 'Reset to default',
            cancelLabel: 'Keep mine',
        });
        if (!ok) return;
        expressPanel.resetItems();
        if (onChangeCb) onChangeCb();
        render();
    });
    bar.appendChild(reset);
    return bar;
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

// Color control. A phrase's color is the only effect of its "category", so the
// user picks the BUTTON COLOR directly (the category names are hidden — they mean
// nothing to the user). Partner and Feeling have one fixed color per type, shown
// as a single, non-editable swatch so the available color is still visible.
function colorControl(item) {
    const wrap = document.createElement('div');
    wrap.className = 'ee-swatches';
    if (item.type === 'phrase') {
        Object.keys(CATEGORIES).forEach((key, idx) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'ee-swatch' + (item.cat === key ? ' ee-swatch-on' : '');
            b.style.background = CATEGORIES[key].color;
            b.title = 'Button color';
            b.setAttribute('aria-label', `Button color ${idx + 1}`);
            b.setAttribute('aria-pressed', String(item.cat === key));
            b.addEventListener('click', () => {
                item.cat = key;
                wrap.querySelectorAll('.ee-swatch').forEach((s) => {
                    s.classList.remove('ee-swatch-on');
                    s.setAttribute('aria-pressed', 'false');
                });
                b.classList.add('ee-swatch-on');
                b.setAttribute('aria-pressed', 'true');
                commit(false); // save + live-update the panel; no editor re-render
            });
            wrap.appendChild(b);
        });
    } else {
        const c = INFLUENCER_COLORS[item.type] || {};
        const sw = document.createElement('span');
        sw.className = 'ee-swatch ee-swatch-static';
        sw.style.background = c.color || '#888';
        sw.title = `Button color (fixed for ${item.type})`;
        sw.setAttribute('aria-label', 'Button color (fixed)');
        wrap.appendChild(sw);
    }
    return wrap;
}

function buildRow(item, i) {
    const row = document.createElement('div');
    row.className = `ee-row ee-${item.type}`;

    // Type badge.
    const badge = document.createElement('span');
    badge.className = `ee-badge ee-badge-${item.type}`;
    badge.textContent = item.type;
    row.appendChild(badge);

    // Type-specific fields.
    const fields = document.createElement('div');
    fields.className = 'ee-fields';

    if (item.type === 'phrase') {
        fields.appendChild(textInput(item.text, 'Phrase to speak', (v) => { item.text = v; commit(false); }));
        // The category only sets the button color, and its names ("Affirm / deny"…)
        // mean nothing to the user (Ken) — so pick by COLOR, not by category name.
        fields.appendChild(colorControl(item));
    } else if (item.type === 'partner') {
        // Pick from People I Know, or type a name (Custom).
        const sel = document.createElement('select');
        const customOpt = document.createElement('option');
        customOpt.value = ''; customOpt.textContent = '— Type a name —';
        sel.appendChild(customOpt);
        relationships.listPeople().forEach((p) => {
            const o = document.createElement('option');
            o.value = p.id;
            o.textContent = p.name + (p.relationship ? ` (${p.relationship})` : '');
            if (p.id === item.personId) o.selected = true;
            sel.appendChild(o);
        });
        sel.addEventListener('change', () => {
            if (sel.value) {
                const p = relationships.getPerson(sel.value);
                item.personId = p.id;
                item.name = p.name;
                item.nickname = p.nickname || '';
            } else {
                delete item.personId;
            }
            commit(true); // refresh the name/nickname fields below
        });
        fields.appendChild(sel);
        fields.appendChild(textInput(item.name, 'Name', (v) => { item.name = v; commit(false); }));
        fields.appendChild(textInput(item.nickname, 'What I call them (optional)', (v) => { item.nickname = v; commit(false); }));
        fields.appendChild(colorControl(item)); // fixed color for this type, shown
    } else { // feeling
        const inp = textInput(item.text, 'Feeling (e.g. Happy)', (v) => { item.text = v; commit(false); });
        inp.setAttribute('list', 'ee-feeling-presets');
        fields.appendChild(inp);
        fields.appendChild(colorControl(item)); // fixed color for this type, shown
    }
    row.appendChild(fields);

    // Reorder + delete.
    const tools = document.createElement('div');
    tools.className = 'ee-tools';
    const up = mkBtn('↑'); up.disabled = i === 0;
    up.addEventListener('click', () => { [current[i - 1], current[i]] = [current[i], current[i - 1]]; commit(true); });
    const down = mkBtn('↓'); down.disabled = i === current.length - 1;
    down.addEventListener('click', () => { [current[i + 1], current[i]] = [current[i], current[i + 1]]; commit(true); });
    const del = mkBtn('✕', 'ee-del');
    del.addEventListener('click', () => { current.splice(i, 1); commit(true); });
    tools.append(up, down, del);
    row.appendChild(tools);

    return row;
}

export function render() {
    if (!container) return;
    current = expressPanel.getItems();
    container.innerHTML = '';
    container.appendChild(buildToolbar());

    // datalist of suggested feelings (shared by all feeling rows).
    const dl = document.createElement('datalist');
    dl.id = 'ee-feeling-presets';
    FEELING_PRESETS.forEach((f) => { const o = document.createElement('option'); o.value = f; dl.appendChild(o); });
    container.appendChild(dl);

    const list = document.createElement('div');
    list.className = 'ee-list';
    if (!current.length) {
        const p = document.createElement('p');
        p.className = 'setting-hint';
        p.textContent = 'No items yet — add a phrase, partner, or feeling above.';
        list.appendChild(p);
    } else {
        current.forEach((item, i) => list.appendChild(buildRow(item, i)));
    }
    container.appendChild(list);
}
