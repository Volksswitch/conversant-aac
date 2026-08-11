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
 * Place items are picked from My Places (places.js) the same way, so a place button
 * always names a place the AI has recorded facts about.
 *
 * ONE BUTTON AT A TIME — the panel itself is the list (Ken, August 11 2026). The tab
 * used to show every item as a row: thirty-odd rows of input + respelling + seven
 * colour swatches + six tools, which "is too cumbersome and it doesn't behave well if
 * the tab width is too small" — on a narrow side dock the swatches and the tools
 * overlapped outright.
 *
 * The fix uses what is already on screen. The Express Panel is live beside Settings on
 * this tab, and tapping a button there already selects it, so the tab does not need to
 * re-list what the panel is showing. It shows an invitation until a button is tapped,
 * then that one button's properties and the actions that apply to it: add before, add
 * after, move up, move down, delete, done.
 *
 * ⚠ WHAT THIS GIVES UP, which Ken named when he asked for it: there is no way to keep
 * buttons "in waiting" — configured but not on the panel — because an item with no cell
 * has nothing to tap. Items past the last cell are therefore unreachable, so adding to
 * a full panel warns that the last button will be deleted (see insertAt) rather than
 * quietly pushing it out of reach, and the invitation offers to clear any that an older
 * layout left behind.
 *
 * Editing rules: structural changes (add / delete / reorder / pick a person)
 * re-render the editor; plain text edits commit WITHOUT re-rendering so the field
 * keeps focus while typing. Every change persists and calls onChange so the live
 * panel updates immediately.
 */

import * as expressPanel from './express-panel.js';
import * as relationships from './relationships.js';
import * as places from './places.js';
import * as keyboard from './keyboard.js';
import * as tts from './tts.js';
import { CATEGORIES, INFLUENCER_COLORS, FEELING_PRESETS, makeId, isEmptyItem, newEmptyItem } from './express-items.js';
import { confirmDanger } from './confirm-dialog.js';

let container = null;
let onChangeCb = null;
let current = [];
// How many cells the chosen layout offers. The list is mapped onto them one-for-one,
// so this is the hard ceiling on how many buttons can exist at all. Supplied by
// app.js because it depends on the dock and layout the user has chosen.
let cellCountFn = () => 0;
// A just-selected item to focus after the next render, so the user can type without
// hunting for the field.
let pendingFocusId = null;
// The cell the user last tapped in the panel. It STAYS marked — in the editor row
// and on the panel button itself — until they tap a different cell, switch tabs or
// close Settings (Ken, August 9 2026). A highlight that cleared itself would leave
// the user editing a row with nothing on screen tying it to the button they touched,
// which on a grid of thirty-odd near-identical cells is the whole question.
let pickedId = null;
let onPickCb = null;

export function init(el, opts = {}) {
    container = el;
    onChangeCb = opts.onChange || null;
    onPickCb = opts.onPick || null;
    if (typeof opts.cellCount === 'function') cellCountFn = opts.cellCount;
}

/** The cell currently being edited, for the panel to mark. */
export function getPickedId() { return pickedId; }

/** Drop the mark — on a tab switch or when Settings closes. */
export function clearPicked() {
    if (!pickedId) return;
    pickedId = null;
    if (container) container.querySelectorAll('.ee-row-picked').forEach((r) => r.classList.remove('ee-row-picked'));
    if (onPickCb) onPickCb();
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

function newItem(type) {
    if (type === 'partner') return { id: makeId(), type: 'partner', name: '', nickname: '' };
    if (type === 'feeling') return { id: makeId(), type: 'feeling', text: '' };
    if (type === 'place') return { id: makeId(), type: 'place', name: '' };
    return { id: makeId(), type: 'phrase', text: '', cat: 'back' };
}

function labelOf(item) {
    if (!item) return '';
    return (item.text || item.nickname || item.name || '').trim();
}

// Is every cell taken by a real button?
//
// Inserting pushes every later button along by one, and the list maps onto the
// layout's cells one-for-one, so when the panel is full the button on the end is pushed
// OFF it — and off the end is not "in reserve", it is invisible and unreachable, with
// no cell to tap and no row to find it in now that the panel is the list.
//
// Two shapes have somewhere for the shift to go, and the panel draws them identically
// as an empty outline: the list is shorter than the layout, so the cells past its end
// are undefined; or the list fills the layout but its last item is an undefined slot.
function panelIsFull() {
    const cap = cellCountFn() || 0;
    if (!cap) return false;                      // layout unknown — do not stand in the way
    if (current.length < cap) return false;
    return !isEmptyItem(current[current.length - 1]);
}

// Insert an UNDEFINED slot at `at` and select it, so the next thing the user sees is
// the one question that matters — what goes here. Same shape as tapping a blank cell.
//
// ⚠ ON A FULL PANEL THIS DELETES THE LAST BUTTON, so it says so first and names it
// (Ken, August 11 2026, changing the earlier rule that greyed Add out instead): the
// buttons stay live and the cost is stated at the moment it is about to be paid, rather
// than the user being left to work out why two controls are dead.
async function insertAt(at) {
    if (panelIsFull()) {
        const last = current[current.length - 1];
        const name = labelOf(last);
        const ok = await confirmDanger({
            title: 'Make room for a new button?',
            body: `The panel is full, so everything after the new button shifts along one place and the last one drops off the end. ${name ? `"${name}" will be deleted.` : 'The last button will be deleted.'}`,
            confirmLabel: 'Add it',
            cancelLabel: 'Cancel',
        });
        if (!ok) return;
        // Removed BEFORE the insert, not trimmed after: "add after the last button"
        // puts the new slot at the very end, and trimming afterwards would throw away
        // the new slot instead of the button we just warned about.
        current.pop();
        if (at > current.length) at = current.length;
    }
    const item = newEmptyItem();
    current.splice(at, 0, item);
    // A trailing undefined slot absorbs the shift, so nothing is pushed off the end.
    const cap = cellCountFn() || 0;
    while (cap && current.length > cap && isEmptyItem(current[current.length - 1])) current.pop();
    pickedId = item.id;
    pendingFocusId = item.id;
    commit(true);
    if (onPickCb) onPickCb();
}

// The invitation, shown until a button is tapped. Ken's wording: "tap a button to edit
// or move that button".
function buildPrompt() {
    const wrap = document.createElement('div');
    wrap.className = 'ee-prompt';

    const p = document.createElement('p');
    p.className = 'setting-hint';
    p.textContent = 'Tap a button in the Express Panel to edit or move it. Tap an empty one to add a button there.';
    wrap.appendChild(p);

    // Buttons an older layout left beyond the last cell. They cannot be tapped, so
    // this is the only place they can be dealt with at all.
    const cap = cellCountFn() || 0;
    const extra = cap ? current.length - cap : 0;
    if (extra > 0) {
        const note = document.createElement('p');
        note.className = 'setting-hint';
        note.textContent = `${extra} button${extra === 1 ? '' : 's'} won't fit on the panel with this layout, so ${extra === 1 ? 'it is' : 'they are'} not shown and cannot be tapped.`;
        wrap.appendChild(note);

        const trim = mkBtn(`Remove the ${extra} that won't fit`, 'ee-reset');
        trim.addEventListener('click', async () => {
            const ok = await confirmDanger({
                title: 'Remove the buttons that do not fit?',
                body: `This deletes the ${extra} button${extra === 1 ? '' : 's'} past the end of the panel. There is no other way to reach ${extra === 1 ? 'it' : 'them'}, but ${extra === 1 ? 'it is' : 'they are'} gone for good.`,
                confirmLabel: 'Remove them',
                cancelLabel: 'Leave them',
            });
            if (!ok) return;
            current.length = cap;
            commit(true);
        });
        wrap.appendChild(trim);
    }

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
        pickedId = null;
        if (onChangeCb) onChangeCb();
        if (onPickCb) onPickCb();
        render();
    });
    wrap.appendChild(reset);
    return wrap;
}

function textInput(value, placeholder, oninput, cls) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value || '';
    inp.placeholder = placeholder || '';
    inp.autocomplete = 'off';
    if (cls) inp.className = cls;
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

// Turn an undefined slot into a real item of `type`, IN PLACE — the position is
// what the user chose by tapping that cell, so it must not move. A fresh id (rather
// than the placeholder's) so provenance stamps it as the user's addition.
function defineAt(i, type) {
    const item = newItem(type);
    current[i] = item;
    pickedId = item.id;
    pendingFocusId = item.id;
    commit(true);
    if (onPickCb) onPickCb();
}

// The one selected button: what it is, what it says, and what can be done to it.
function buildRow(item, i) {
    const row = document.createElement('div');
    row.className = `ee-row ee-card ee-${item.type}`;
    row.dataset.id = item.id;

    // Which button this is. A live fact, not per-control help (Rule 14): on a grid of
    // thirty-odd near-identical cells, "which one am I editing?" is the question, and
    // the mark on the panel button is only half the answer.
    const head = document.createElement('div');
    head.className = 'ee-card-head';
    const badge = document.createElement('span');
    badge.className = `ee-badge ee-badge-${item.type}`;
    badge.textContent = isEmptyItem(item) ? 'empty' : item.type;
    head.appendChild(badge);
    const pos = document.createElement('span');
    pos.className = 'ee-card-pos';
    pos.textContent = `Button ${i + 1}`;
    head.appendChild(pos);
    row.appendChild(head);

    // Type-specific fields.
    const fields = document.createElement('div');
    fields.className = 'ee-fields';

    if (isEmptyItem(item)) {
        // An undefined slot: it exists only to hold this position in the grid, so
        // the row asks the one question left — what goes here. Choosing a type
        // replaces it where it stands.
        const label = document.createElement('span');
        label.className = 'ee-empty-label';
        label.textContent = 'Not set yet —';
        fields.appendChild(label);
        [['Phrase', 'phrase'], ['Partner', 'partner'], ['Feeling', 'feeling'], ['Place', 'place']].forEach(([text, type]) => {
            const b = mkBtn(text, 'ee-add');
            b.addEventListener('click', () => defineAt(i, type));
            fields.appendChild(b);
        });
    } else if (item.type === 'phrase') {
        fields.appendChild(textInput(item.text, 'Phrase to speak', (v) => { item.text = v; commit(false); }));
        // How to SAY it, when the button's own words are not what the voice should
        // read out — a respelling for a name it gets wrong ("Folks-switch"), or an
        // abbreviation that should be spoken in full. Blank means "say the label",
        // which is what every phrase does until someone decides otherwise.
        //   The button face and the transcript always show the LABEL; only the
        // synthesiser sees this. Empty strings are dropped rather than stored, so a
        // field the user typed into and then cleared leaves no trace.
        fields.appendChild(textInput(item.speak || '', 'How to say it — only if different',
            (v) => {
                const t = v.trim();
                if (t) item.speak = v; else delete item.speak;
                commit(false);
            }, 'ee-speakas'));
        // The category only sets the button color, and its names ("Affirm / deny"…)
        // mean nothing to the user (Ken) — so pick by COLOR, not by category name.
        fields.appendChild(colorControl(item));
    } else if (item.type === 'partner') {
        // Pick from People I Know. The button in the panel shows their nickname if
        // set, their name if not. Name and nickname come entirely from the selection.
        const sel = document.createElement('select');
        sel.className = 'ee-name-select';
        const customOpt = document.createElement('option');
        customOpt.value = ''; customOpt.textContent = '— Choose a person —';
        sel.appendChild(customOpt);
        relationships.listPeople().forEach((p) => {
            const o = document.createElement('option');
            o.value = p.id;
            o.textContent = p.name + (p.nickname ? ` (${p.nickname})` : '');
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
                item.name = '';
                item.nickname = '';
            }
            commit(false);
        });
        fields.appendChild(sel);
        fields.appendChild(colorControl(item)); // fixed color for this type, shown
    } else if (item.type === 'place') {
        // Pick from My Places (places.js), exactly as a partner is picked from People
        // I Know — so the button always names a place the AI actually has facts about.
        // The placeId is what the situation block resolves; the name is carried for
        // the button face so the panel still renders if the place is later removed.
        const sel = document.createElement('select');
        sel.className = 'ee-name-select';
        const noneOpt = document.createElement('option');
        noneOpt.value = ''; noneOpt.textContent = '— Choose a place —';
        sel.appendChild(noneOpt);
        places.listPlaces().forEach((p) => {
            const o = document.createElement('option');
            o.value = p.id;
            o.textContent = p.name || '(unnamed)';
            if (p.id === item.placeId) o.selected = true;
            sel.appendChild(o);
        });
        sel.addEventListener('change', () => {
            if (sel.value) {
                const p = places.getPlace(sel.value);
                item.placeId = p.id;
                item.name = p.name;
            } else {
                delete item.placeId;
                item.name = '';
            }
            commit(false);
        });
        fields.appendChild(sel);
        fields.appendChild(colorControl(item)); // fixed color for this type, shown
    } else { // feeling
        const inp = textInput(item.text, 'Feeling (e.g. Happy)', (v) => { item.text = v; commit(false); });
        inp.setAttribute('list', 'ee-feeling-presets');
        fields.appendChild(inp);
        fields.appendChild(colorControl(item)); // fixed color for this type, shown
    }
    row.appendChild(fields);

    // The actions that apply to this button (Ken's list): add before, add after, move
    // up, move down, delete, done — plus Hear, which a phrase has always had.
    //
    // TEXT LABELS, NOT ICONS, and that is deliberate: Rule 12's icon-only rule governs
    // the keyguard-backed conversation surface, and its scope note keeps text buttons
    // on the supporter-assisted Settings overlays for readability. Text also WRAPS,
    // which the old fixed row of icon tools did not — that is what broke on a narrow
    // side dock.
    const tools = document.createElement('div');
    tools.className = 'ee-tools';
    // Hear the phrase, in the user's own voice, before committing to it. The reason
    // is the one already recorded for Sound Check's per-candidate speaker: this
    // user's whole output channel is a synthesizer, so reading a phrase on screen is
    // not the same test as hearing it — a phrase can look right and land wrong, and
    // the voice mispronounces things the eye cannot predict.
    //   PHRASES ONLY: partner, feeling and place buttons are TOGGLES whose labels are
    // never spoken aloud, so a speaker on those rows would offer to play something
    // the app will never say.
    //   Deliberately not disabled when the field is empty: text commits on input
    // WITHOUT re-rendering (so the field keeps focus while typing), so a disabled
    // state set at build time would still say "empty" after the user had typed. It
    // no-ops instead, and reads the live value rather than a stale copy.
    const hear = mkBtn('🔊', 'ee-hear');
    hear.title = 'Hear this phrase';
    hear.setAttribute('aria-label', 'Hear this phrase');
    hear.hidden = item.type !== 'phrase';
    hear.addEventListener('click', () => {
        // `speak` is the spoken form where the display text differs from it.
        const text = (item.speak || item.text || '').trim();
        if (text) tts.speak(text);
    });
    // Always live. On a full panel they warn and name the button that will be deleted
    // (see insertAt) rather than greying out — the user finds out what it costs at the
    // moment they ask for it, and can still go ahead.
    const addBefore = mkBtn('Add before', 'ee-add');
    addBefore.addEventListener('click', () => insertAt(i));
    const addAfter = mkBtn('Add after', 'ee-add');
    addAfter.addEventListener('click', () => insertAt(i + 1));

    const up = mkBtn('Move up');
    up.disabled = i === 0;
    up.addEventListener('click', () => { [current[i - 1], current[i]] = [current[i], current[i - 1]]; commit(true); });
    const down = mkBtn('Move down');
    down.disabled = i === current.length - 1;
    down.addEventListener('click', () => { [current[i + 1], current[i]] = [current[i], current[i + 1]]; commit(true); });

    // Confirmed, unlike the old ✕: deleting does not merely lose one phrase, it pulls
    // every button after it up a cell, so the positions the user has learned all move.
    //
    // OFF for an undefined slot (Ken, August 11 2026): "an empty button should grey out
    // the Delete button since it's already deleted". Nothing to lose there, so the
    // button would only offer to shuffle the panel for no gain.
    //   The way to be rid of an empty slot is therefore Move down until it reaches the
    // end, where it is indistinguishable from the cells past the end of the list — the
    // panel draws both as an empty outline.
    const del = mkBtn('Delete', 'ee-del');
    del.disabled = isEmptyItem(item);
    del.addEventListener('click', async () => {
        const label = (item.text || item.nickname || item.name || '').trim();
        const ok = await confirmDanger({
            title: 'Delete this button?',
            body: `${label ? `"${label}" is removed` : 'This button is removed'} and every button after it moves up one place.`,
            confirmLabel: 'Delete it',
            cancelLabel: 'Keep it',
        });
        if (!ok) return;
        const at = current.findIndex((it) => it.id === item.id);   // may have moved while the card was open
        if (at < 0) return;
        current.splice(at, 1);
        pickedId = null;
        commit(true);
        if (onPickCb) onPickCb();
    });

    // Finished with this button: back to the invitation, and the on-screen keyboard
    // comes down so the panel is visible again. Edits have already been saved on every
    // keystroke, so this is "I'm done", not "save" — which is why the old Save button
    // is gone rather than sitting beside it.
    const done = mkBtn('Done', 'ee-done');
    done.addEventListener('click', () => {
        commit(false);
        keyboard.hideKeyboard();
        clearPicked();
        render();
    });

    tools.append(hear, addBefore, addAfter, up, down, del, done);
    row.appendChild(tools);
    return row;
}

export function render() {
    if (!container) return;
    current = expressPanel.getItems();
    // A button deleted from under the selection takes the mark with it, so the panel
    // does not keep highlighting a cell whose item no longer exists.
    if (pickedId && !current.some((it) => it.id === pickedId)) pickedId = null;
    container.innerHTML = '';

    // datalist of suggested feelings, used by a feeling card.
    const dl = document.createElement('datalist');
    dl.id = 'ee-feeling-presets';
    FEELING_PRESETS.forEach((f) => { const o = document.createElement('option'); o.value = f; dl.appendChild(o); });
    container.appendChild(dl);

    const i = pickedId ? current.findIndex((it) => it.id === pickedId) : -1;
    container.appendChild(i >= 0 ? buildRow(current[i], i) : buildPrompt());

    markPickedRow();

    // Focus + reveal a just-selected card so the user can type in place.
    if (pendingFocusId) {
        const id = pendingFocusId;
        pendingFocusId = null;
        revealRow(id);
    }
}

// Scroll a row into view and put the cursor in its first field. An undefined slot
// has no field — only the four type buttons — so focus the first of those instead,
// which is the question that row is actually asking.
function revealRow(id) {
    if (!container || !id) return null;
    const row = container.querySelector(`.ee-row[data-id="${CSS.escape(String(id))}"]`);
    if (!row) return null;
    row.scrollIntoView({ block: 'nearest' });
    const field = row.querySelector('.ee-fields input, .ee-fields select, .ee-fields button');
    if (field) field.focus();
    return row;
}

/**
 * Show `id`'s card — how a tap on a panel cell lands the user on that button. The
 * selection IS what the tab shows now, so this always re-renders; the panel is told
 * too, so the tapped button stays marked and the user can see which of thirty-odd
 * cells their tap chose.
 */
export function focusItem(id) {
    if (!container || !id) return;
    pickedId = id;
    pendingFocusId = id;
    render();
    if (onPickCb) onPickCb();
}

// Re-applied after every render, not only on the tap: the editor rebuilds its whole
// list on any edit, so a class set once would vanish the moment the user typed a
// character into the row it was marking.
function markPickedRow() {
    if (!container) return;
    container.querySelectorAll('.ee-row-picked').forEach((r) => r.classList.remove('ee-row-picked'));
    if (!pickedId) return;
    const row = container.querySelector(`.ee-row[data-id="${CSS.escape(String(pickedId))}"]`);
    if (row) row.classList.add('ee-row-picked');
}
