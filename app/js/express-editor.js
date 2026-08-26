/* Settings → Express Panel — the band editor (rewritten August 23 2026)
 *
 * Three lists, one per band, in the order the user works through them: the Always
 * phrases, the Flex phrases for a chosen partner and place, then the Context buttons.
 * The live panel sits beside this tab and stays in step with every change; tapping a
 * button there selects its row here, which is how a phrase is edited in the position
 * the user actually wants it rather than typed into a list and then shuffled until it
 * lands there.
 *
 * ⚠ THIS IS A LIST AGAIN, AND THAT IS NOT A REGRESSION. August 2026 replaced the list
 * with an editor for one selected button, because every row carried seven color
 * swatches and six tools and at a narrow width the swatches painted over the tools.
 * Both causes are gone: color now comes from the BAND, so the swatches are deleted
 * outright, and the tools have left the rows for one fixed toolbar. A button that
 * stays put is far easier to hit than one that travels up and down with the item it
 * acts on — which is Ken's observation and the reason the toolbar is where it is.
 *
 * ⚠ THE SITUATION BEING EDITED MUST NEVER BE AMBIGUOUS. Two selection lists name the
 * partner and the place, each offering "Anyone" and "Anyplace", and together they read
 * as a sentence. Somebody who believes they are editing their clinic phrases and is in
 * fact editing everybody's has been misled — and the opposite mistake is worse,
 * because it is silent: they add a phrase, then wonder for weeks why it is missing
 * everywhere else.
 */

import * as expressPanel from './express-panel.js';
import * as relationships from './relationships.js';
import * as places from './places.js';
import { FEELING_PRESETS, makeId } from './express-items.js';
import {
    ANYONE, ANYPLACE, flexKey, parseFlexKey, composePanel, CONTEXT_ORDER,
} from './express-bands.js';
import { confirmDanger } from './confirm-dialog.js';
import { makeCollapsible } from './sections.js';
import * as tts from './tts.js';

let container = null;
let onChangeCb = null;
let onPickCb = null;
let layoutRowsFn = () => [];

// The row the user last tapped — in the panel or in a list. It STAYS marked until
// they tap a different one, switch tabs or close Settings (Ken, August 9 2026).
let pickedId = null;
// Which situation the Flex section is editing. Held here rather than in the model so
// that leaving the tab and coming back does not silently move the user somewhere else.
let flexPartner = ANYONE;
let flexPlace = ANYPLACE;
// Which section to force open after the next render, when something else has decided
// (a tap on a panel cell, or adding an item to a band). Ordinary open/closed state is
// NOT tracked here: sections.js owns it, keyed by position within this scope, which is
// what survives the rebuilds this editor does on add / delete / reorder.
let openAfterRender = null;

export function init(el, opts = {}) {
    container = el;
    onChangeCb = opts.onChange || null;
    onPickCb = opts.onPick || null;
    if (typeof opts.layoutRows === 'function') layoutRowsFn = opts.layoutRows;
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

/** A tap on a DEFINED panel button: select its row and open the section holding it. */
export function focusItem(id) {
    if (!id) return;
    pickedId = id;
    const m = expressPanel.getModel();
    if (m.always.some((x) => x.id === id)) openAfterRender = 'always';
    else if (m.context.some((x) => x.id === id)) openAfterRender = 'context';
    else {
        for (const [key, list] of Object.entries(m.flex)) {
            if (list.some((x) => x.id === id)) {
                const { partnerId, placeId } = parseFlexKey(key);
                flexPartner = partnerId; flexPlace = placeId; openAfterRender = 'flex';
                break;
            }
        }
    }
    render();
    const row = container && container.querySelector('.ee-row-picked');
    if (row) row.scrollIntoView({ block: 'nearest' });
}

/** A tap on an UNDEFINED panel cell: add an entry to the band that owns that cell. */
export function addToBand(band) {
    const key = band === 'context' ? 'context' : band === 'flex' ? 'flex' : 'always';
    openAfterRender = key;
    if (key === 'context') addContext('feeling');
    else if (key === 'flex') addPhrase('flex');
    else addPhrase('always');
}

// ---------------------------------------------------------------- model helpers

function bandList(band) {
    const m = expressPanel.getModel();
    if (band === 'always') return m.always;
    if (band === 'context') return m.context;
    return m.flex[flexKey(flexPartner, flexPlace)] || [];
}

function saveBand(band, list) {
    if (band === 'flex') expressPanel.setFlexList(flexPartner, flexPlace, list);
    else expressPanel.setBand(band, list);
    if (onChangeCb) onChangeCb();
}

function addPhrase(band) {
    const list = bandList(band).slice();
    const item = { id: makeId(), type: 'phrase', text: '' };
    const at = list.findIndex((x) => x.id === pickedId);
    if (at >= 0) list.splice(at + 1, 0, item); else list.push(item);
    pickedId = item.id;
    saveBand(band, list);
    render();
    const inp = container && container.querySelector('.ee-row-picked input');
    if (inp) inp.focus();
}

function addContext(type) {
    const list = bandList('context').slice();
    const item = type === 'partner' ? { id: makeId(), type: 'partner', name: '' }
        : type === 'place' ? { id: makeId(), type: 'place', name: '' }
            : { id: makeId(), type: 'feeling', text: '' };
    list.push(item);
    pickedId = item.id;
    saveBand('context', list);   // setBand re-sorts into partners, places, feelings
    render();
}

function move(band, dir) {
    const list = bandList(band).slice();
    const i = list.findIndex((x) => x.id === pickedId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    // Within the Context band the three kinds are kept in their runs, so a move that
    // would jump a boundary is refused rather than silently re-sorted back.
    if (band === 'context' && list[i].type !== list[j].type) return;
    [list[i], list[j]] = [list[j], list[i]];
    saveBand(band, list);
    render();
}

async function removePicked(band) {
    const list = bandList(band).slice();
    const i = list.findIndex((x) => x.id === pickedId);
    if (i < 0) return;
    const label = labelOf(list[i]) || 'this button';
    // Deleting does not merely lose a phrase - it pulls every button after it up a
    // cell, so the positions the user has learned all move. Squarely the "significant
    // work" bar (standing rule, Ken, June 15 2026).
    if (!(await confirmDanger({
        title: 'Delete this button?',
        body: `"${label}" will be removed, and every button after it moves up one place.`,
        confirmLabel: 'Delete it',
    }))) return;
    list.splice(i, 1);
    pickedId = null;
    saveBand(band, list);
    render();
}

/**
 * ⚠ PICKING A ROW MUST NOT RE-RENDER THE EDITOR, and the reason is the same one the
 * Controls editor already records: a rebuild replaces the very field the user just
 * touched, so the tap's focus lands on an element that no longer exists and the
 * on-screen keyboard never appears. It looks like the field is dead. Only the
 * highlight changes here; the panel beside the tab is told separately.
 */
function markPicked(row, id) {
    if (pickedId === id) return;
    pickedId = id;
    if (container) container.querySelectorAll('.ee-row-picked').forEach((r) => r.classList.remove('ee-row-picked'));
    row.classList.add('ee-row-picked');
    if (onPickCb) onPickCb();
}

function labelOf(item) {
    if (!item) return '';
    // A partner's face is resolved live from About Me, so the list here reads the same
    // as the panel beside it - and keeps up the moment somebody is renamed there.
    if (item.type === 'partner') return relationships.displayName(item.personId, item.name);
    return String(item.text || item.name || '').trim();
}

// ---------------------------------------------------------------- small builders

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
}

function mkBtn(label, cls, onClick, title) {
    const b = el('button', cls, label);
    b.type = 'button';
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    if (onClick) b.addEventListener('click', onClick);
    return b;
}

function textInput(value, placeholder, oninput) {
    const i = document.createElement('input');
    i.type = 'text';
    i.value = value || '';
    i.placeholder = placeholder || '';
    i.className = 'ee-input';
    // Committed on every keystroke WITHOUT a re-render, so the field keeps focus and
    // the panel beside the tab updates as the user types.
    i.addEventListener('input', () => oninput(i.value));
    return i;
}

/**
 * One list row. Deliberately thin: the words, how they should be SAID, and a speaker.
 * Everything else is on the one toolbar above the list.
 */
function phraseRow(band, item) {
    const row = el('div', 'ee-row');
    if (item.id === pickedId) row.classList.add('ee-row-picked');
    row.addEventListener('pointerdown', () => markPicked(row, item.id));

    row.appendChild(textInput(item.text, 'What the button says', (v) => {
        const list = bandList(band).slice();
        const at = list.findIndex((x) => x.id === item.id);
        if (at < 0) return;
        list[at] = { ...list[at], text: v };
        saveBand(band, list);
    }));

    // How it should be SAID. The app has been able to use this for months and there
    // has never been anywhere to type it. It needs the speaker beside it to be usable
    // at all - a respelling nobody can hear is a guess.
    row.appendChild(textInput(item.speak, 'How to say it (optional)', (v) => {
        const list = bandList(band).slice();
        const at = list.findIndex((x) => x.id === item.id);
        if (at < 0) return;
        const next = { ...list[at] };
        if (v.trim()) next.speak = v; else delete next.speak;
        list[at] = next;
        saveBand(band, list);
    }));

    // Reads the LIVE value rather than one captured at build time, so it speaks what
    // is in the field now and not what was there when the row was drawn.
    row.appendChild(mkBtn('🔊', 'ee-hear', () => {
        const inputs = row.querySelectorAll('input');
        const said = (inputs[1] && inputs[1].value.trim()) || (inputs[0] && inputs[0].value.trim());
        if (said) tts.speak(said);
    }, 'Hear this phrase'));
    return row;
}

function contextRow(item) {
    const row = el('div', 'ee-row');
    if (item.id === pickedId) row.classList.add('ee-row-picked');
    row.addEventListener('pointerdown', () => markPicked(row, item.id));
    row.appendChild(el('span', 'ee-kind', item.type === 'partner' ? 'Partner'
        : item.type === 'place' ? 'Place' : 'Feeling'));

    const save = (patch) => {
        const list = bandList('context').slice();
        const at = list.findIndex((x) => x.id === item.id);
        if (at < 0) return;
        list[at] = { ...list[at], ...patch };
        saveBand('context', list);
    };

    if (item.type === 'partner') {
        // ONE control: WHO this button is for. What to call them is not asked here
        // (Ken, August 25 2026) - it is already answered on the About Me tab, and
        // asking a second time let the two disagree with nothing to say which was
        // right. The button's face comes from relationships.displayName.
        row.appendChild(pickerFor(relationships.listPeople().map((p) => ({ id: p.id, name: p.name })),
            item.personId, item.name, (id, name) => save({ personId: id, name })));
    } else if (item.type === 'place') {
        row.appendChild(pickerFor(places.listPlaces().map((p) => ({ id: p.id, name: p.name })),
            item.placeId, item.name, (id, name) => save({ placeId: id, name })));
    } else {
        // A REAL dropdown, plus "Something else..." for the user's own word (Ken,
        // August 25 2026). It was a text box carrying a `list` of suggestions, and the
        // browser draws its own arrow on one of those - so it looked exactly like a
        // dropdown and was not one. Two reasons the arrow had to go one way or the
        // other rather than being left ambiguous: the popup it opens is browser chrome,
        // which cannot be sized or positioned for a direct-select user on a
        // keyguard-backed screen; and every other picker in this app is a real select,
        // so one control that merely resembled them taught the wrong lesson about all
        // of them.
        //   The same shape as the People editor's Relationship field, deliberately -
        // a fixed list is faster to tap, and "Something else..." keeps a feeling that
        // is nobody's preset but this person's.
        row.append(...feelingPicker(item.text, (v) => save({ text: v })));
    }
    return row;
}

/** A select over the people or places the user has entered, plus a free-text name. */
function pickerFor(options, currentId, currentName, onPick) {
    const sel = document.createElement('select');
    sel.className = 'ee-name-select';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— choose —';
    sel.appendChild(none);
    for (const o of options) {
        const op = document.createElement('option');
        op.value = o.id;
        op.textContent = o.name;
        if (o.id === currentId || (!currentId && o.name === currentName)) op.selected = true;
        sel.appendChild(op);
    }
    sel.addEventListener('change', () => {
        const hit = options.find((o) => o.id === sel.value);
        onPick(hit ? hit.id : null, hit ? hit.name : '');
    });
    return sel;
}

/**
 * The feeling control: a select over the suggested feelings, plus "Something else..."
 * which reveals a text box.
 *
 * Returns BOTH elements so the caller appends them side by side in the row; the text
 * box hides itself unless it is being used, so an ordinary row is one control wide.
 * A feeling already recorded that is not one of the suggestions selects
 * "Something else..." and prefills the box, so nothing anybody typed is lost or
 * silently rewritten to the nearest preset.
 */
function feelingPicker(current, onChange) {
    const OTHER = '__other__';
    const value = String(current || '').trim();
    const preset = FEELING_PRESETS.find((f) => f.toLowerCase() === value.toLowerCase());

    const sel = document.createElement('select');
    sel.className = 'ee-name-select';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— choose —';
    sel.appendChild(none);
    for (const f of FEELING_PRESETS) {
        const op = document.createElement('option');
        op.value = f;
        op.textContent = f;
        sel.appendChild(op);
    }
    const other = document.createElement('option');
    other.value = OTHER;
    other.textContent = 'Something else…';
    sel.appendChild(other);

    // ⚠ THE BOX HAS TO BE CAUGHT UP BEFORE IT IS SHOWN, and this is the whole
    // subtlety of the control. A committed edit does NOT re-render the row (so the
    // field being typed into keeps focus), so the box still holds whatever the row was
    // built with. Pick "Grateful" from the list, then reach for "Something else..." to
    // adjust it, and without this the box would open on the word from before the pick
    // and commit THAT - quietly undoing a choice the user had just made and watched
    // take effect. So the last committed value is tracked here and written into the
    // box at the moment it appears: what you open for editing is what the button says
    // right now.
    let committed = value;
    const free = textInput(value, 'A feeling, in your words', (v) => { committed = v; onChange(v); });
    const sync = () => { free.style.display = sel.value === OTHER ? '' : 'none'; };

    if (preset) sel.value = preset;
    else if (value) sel.value = OTHER;
    sync();

    sel.addEventListener('change', () => {
        if (sel.value === OTHER) free.value = committed;
        sync();
        // Choosing a preset commits it; choosing "Something else..." commits the word
        // already on the button, so opening the box cannot blank a feeling by itself.
        committed = sel.value === OTHER ? free.value : sel.value;
        onChange(committed);
        if (sel.value === OTHER) free.focus();
    });

    return [sel, free];
}

// ---------------------------------------------------------------- sections

/**
 * A band's section. Emitted as a plain .setting-group with a <label> heading and then
 * handed to sections.js, exactly as the Settings tabs and the Controls editor do, so
 * the three bands get the same arrow, the same heading styling, the same session
 * memory and the same one-open-at-a-time behavior as every other section in the app.
 * Hand-rolling the <details> here made them LOOK like plain blocks rather than
 * sections, which is what Ken was seeing.
 */
function section(key, title, build) {
    const wrap = el('div', 'setting-group ee-section');
    wrap.dataset.band = key;
    wrap.appendChild(el('label', null, title));
    build(wrap);
    return wrap;
}

/** The one toolbar. Fixed above the list, so it never travels with the item. */
function toolbar(band, extra) {
    const bar = el('div', 'ee-toolbar');
    bar.appendChild(mkBtn('▲', 'ee-tool', () => move(band, -1), 'Move the selected button up'));
    bar.appendChild(mkBtn('▼', 'ee-tool', () => move(band, 1), 'Move the selected button down'));
    bar.appendChild(mkBtn('✕', 'ee-tool', () => removePicked(band), 'Delete the selected button'));
    (extra || []).forEach((b) => bar.appendChild(b));
    return bar;
}

/**
 * The line that says where the panel runs out. Everything below it is stored and
 * reachable later - a smaller Context band or a different layout brings it back - but
 * is not showing now. The user finds this out at the moment they add the phrase,
 * which is not the same moment as noticing it later while changing the layout.
 */
function cutLine(hidden, what) {
    if (hidden <= 0) return null;
    return el('p', 'ee-cut', `${hidden} ${what}${hidden === 1 ? ' below this point is' : 's below this point are'} not showing — the panel has run out of room.`);
}

function alwaysSection(composed) {
    return section('always', 'Always — the words that never move', (body) => {
        body.appendChild(toolbar('always', [
            mkBtn('Add a phrase', 'ee-add', () => addPhrase('always')),
            mkBtn('Reset to the app’s phrases', 'ee-reset', resetAlways),
        ]));
        const list = el('div', 'ee-list');
        const items = bandList('always');
        items.forEach((it, i) => {
            if (i === composed.counts.always) {
                const cut = cutLine(items.length - composed.counts.always, 'phrase');
                if (cut) list.appendChild(cut);
            }
            list.appendChild(phraseRow('always', it));
        });
        if (!items.length) list.appendChild(el('p', 'ee-empty', 'No phrases yet.'));
        body.appendChild(list);
    });
}

function flexSection(composed) {
    return section('flex', 'Flex — phrases that suit who you are with and where you are', (body) => {
        const pickRow = el('div', 'ee-scope');
        pickRow.appendChild(el('span', 'ee-scope-lead', 'Editing the Flex band for'));

        const people = relationships.listPeople();
        const spots = places.listPlaces();
        pickRow.appendChild(scopeSelect(
            [{ id: ANYONE, name: 'Anyone' }, ...people.map((p) => ({ id: p.id, name: p.name }))],
            flexPartner, (v) => { flexPartner = v; render(); }));
        pickRow.appendChild(el('span', 'ee-scope-lead', 'at'));
        pickRow.appendChild(scopeSelect(
            [{ id: ANYPLACE, name: 'Anyplace' }, ...spots.map((p) => ({ id: p.id, name: p.name }))],
            flexPlace, (v) => { flexPlace = v; render(); }));
        body.appendChild(pickRow);

        // What has already been made. Without it there is no screen anywhere that says
        // which situations exist, and after a month there may be fifteen.
        const made = expressPanel.flexSituations();
        if (made.length) {
            const box = el('div', 'ee-situations');
            box.appendChild(el('span', 'ee-scope-lead', 'Already set up:'));
            made.map((key) => ({ key, ...parseFlexKey(key) }))
                .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
                .forEach(({ key, partnerId, placeId }) => {
                    const b = mkBtn(situationName(partnerId, placeId), 'ee-situation', () => {
                        flexPartner = partnerId; flexPlace = placeId; render();
                    });
                    if (partnerId === flexPartner && placeId === flexPlace) b.classList.add('ee-situation-on');
                    box.appendChild(b);
                });
            body.appendChild(box);
        }

        body.appendChild(toolbar('flex', [
            mkBtn('Add a phrase', 'ee-add', () => addPhrase('flex')),
            mkBtn('Delete this situation', 'ee-reset', deleteSituation),
        ]));
        const list = el('div', 'ee-list');
        const items = bandList('flex');
        items.forEach((it) => list.appendChild(phraseRow('flex', it)));
        if (!items.length) {
            list.appendChild(el('p', 'ee-empty',
                'No phrases for this situation yet. Whatever you do not fill is taken from the more general lists.'));
        }
        body.appendChild(list);
        const spare = composed.counts.flex;
        body.appendChild(el('p', 'ee-note',
            `The Flex band has ${spare} button${spare === 1 ? '' : 's'} right now. Phrases are filled in from the most specific list to the least: this partner in this place, then this partner anywhere, then anyone in this place, then Anyone at Anyplace.`));
    });
}

function nameOf({ partnerId, placeId }) { return situationName(partnerId, placeId); }

function situationName(partnerId, placeId) {
    const person = relationships.listPeople().find((p) => p.id === partnerId);
    const spot = places.listPlaces().find((p) => p.id === placeId);
    const who = partnerId === ANYONE ? 'Anyone' : (person ? person.name : 'Someone');
    const where = placeId === ANYPLACE ? 'Anyplace' : (spot ? spot.name : 'somewhere');
    return `${who} at ${where}`;
}

function contextSection(composed) {
    return section('context', 'Context — describing the conversation context', (body) => {
        body.appendChild(el('p', 'ee-note',
            'Partners, places and feelings, always in that order. This is also where the choices the other person offers appear, at the far end, for one exchange.'));
        body.appendChild(toolbar('context', [
            mkBtn('Add a partner', 'ee-add', () => addContext('partner')),
            mkBtn('Add a place', 'ee-add', () => addContext('place')),
            mkBtn('Add a feeling', 'ee-add', () => addContext('feeling')),
        ]));
        const list = el('div', 'ee-list');
        const items = bandList('context');
        items.forEach((it, i) => {
            if (i === composed.counts.context) {
                const cut = cutLine(items.length - composed.counts.context, 'button');
                if (cut) list.appendChild(cut);
            }
            list.appendChild(contextRow(it));
        });
        if (!items.length) list.appendChild(el('p', 'ee-empty', 'No context buttons yet.'));
        body.appendChild(list);
    });
}

// ---------------------------------------------------------------- destructive paths

/**
 * ⚠ THE WARNING SAYS "THE APP'S SET", NOT "WHAT YOU HAD BEFORE" (Ken, August 23 2026).
 * Reset restores what the app SHIPS, which is not the same thing as undoing this
 * session's edits — somebody who reads it as an undo would tap it expecting to get
 * back a phrase they deleted an hour ago and instead lose every phrase they have ever
 * written. Saying which set is coming back is the whole job of the message.
 */
async function resetAlways() {
    const mine = bandList('always').length;
    if (!(await confirmDanger({
        title: 'Replace the Always phrases?',
        body: `All ${mine} phrase${mine === 1 ? '' : 's'} in the Always band will be replaced with the set the app comes with. This is not an undo: it does not restore what you had before you started editing, and any phrase you have written yourself will be gone.`,
        confirmLabel: 'Replace them',
    }))) return;
    expressPanel.resetBand('always');
    pickedId = null;
    if (onChangeCb) onChangeCb();
    render();
}

async function deleteSituation() {
    const key = flexKey(flexPartner, flexPlace);
    const list = bandList('flex');
    if (!list.length) return;
    if (!(await confirmDanger({
        title: 'Delete this situation?',
        body: `The ${list.length} phrase${list.length === 1 ? '' : 's'} you have written for ${situationName(flexPartner, flexPlace)} will be removed.`,
        confirmLabel: 'Delete them',
    }))) return;
    expressPanel.removeFlexList(key);
    pickedId = null;
    if (onChangeCb) onChangeCb();
    render();
}

function scopeSelect(options, current, onPick) {
    const sel = document.createElement('select');
    sel.className = 'ee-scope-select';
    for (const o of options) {
        const op = document.createElement('option');
        op.value = o.id;
        op.textContent = o.name;
        if (o.id === current) op.selected = true;
        sel.appendChild(op);
    }
    sel.addEventListener('change', () => onPick(sel.value));
    return sel;
}

// ---------------------------------------------------------------- render

export function render() {
    if (!container) return;
    container.innerHTML = '';
    const composed = composePanel(layoutRowsFn(), expressPanel.getModel(),
        { partnerId: null, placeId: null });

    container.appendChild(alwaysSection(composed));
    container.appendChild(flexSection(composed));
    container.appendChild(contextSection(composed));
    // ⚠ A SCOPE NAME OF ITS OWN, NOT THE TAB'S. sections.js remembers which sections
    // are open by POSITION within a named scope, and the Express tab registers its own
    // sections under the tab name - so with both called "express", the tab's second
    // section (Band sizes) and the editor's second section (Flex) shared the key
    // "express#1". Changing the unit of measure re-renders the editor, which then read
    // Band sizes' open state as Flex's: Band sizes closed and Flex opened, apparently
    // at random. Two containers, two scopes.
    makeCollapsible(container, 'expressBands');

    if (openAfterRender) {
        const det = container.querySelector(`.setting-group[data-band="${openAfterRender}"] details`);
        openAfterRender = null;
        if (det && !det.open) det.open = true;   // fires toggle, which closes the others
    }
}

/** Which band's section is open right now, read from the DOM rather than remembered. */
export function openBand() {
    if (!container) return null;
    const det = container.querySelector('.setting-group[data-band] details[open]');
    return det ? det.closest('.setting-group').dataset.band : null;
}

export { CONTEXT_ORDER };
