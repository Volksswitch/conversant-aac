/* Placeholder editor (Settings → Placeholders) — Ken, August 25 2026
 *
 * Edits the two pools of floor-holding phrases (placeholder-phrases.js): the one
 * said first, and the ones said if the user is still choosing. Same shape as the
 * Controls editor — a text field per phrase with reorder and delete, an Add at the
 * foot of each list, and one Reset outside the sections so it stays reachable with
 * everything closed.
 *
 * ORDER IS NOT PRIORITY HERE, unlike the openers and goodbyes. A phrase is picked
 * at random from its pool (avoiding whatever was said last), so moving a row up
 * makes it no likelier to be heard. The arrows are for grouping and reading, and
 * the tab says so — a user who expects "first in the list is said first" would
 * otherwise spend effort on an ordering that does nothing.
 *
 * Each row carries a speaker. The whole point of a placeholder is how it SOUNDS
 * coming out of this user's voice a second after the other person stops talking,
 * and reading it on screen is not that test — the same reasoning that put a 🔊 on
 * the Express Panel rows and on the About Me answers.
 *
 * Plain text edits commit WITHOUT re-rendering so the field keeps focus while
 * typing; structural changes (add / delete / reorder / reset) re-render.
 */

import * as model from './placeholder-phrases.js';
import * as tts from './tts.js';
import { confirmDanger } from './confirm-dialog.js';
import { makeCollapsible } from './sections.js';

let container = null;
let data = null;            // working copy { acknowledgment: [], thinking: [] }
let pendingFocus = null;    // { key, index } of a just-added row to focus

export function init(el) {
    container = el;
}

function commit(rerender) {
    model.setPools(data);
    if (rerender) render();
}

function mkBtn(label, cls, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
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

// One pool: rows of text + 🔊 ↑ ↓ ✕, plus Add.
function poolSection(title, key) {
    const sec = document.createElement('div');
    sec.className = 'setting-group cpe-section';
    // Built here rather than in index.html, so the spoken "?" key is stamped here
    // too — keyed by the pool it edits, and matched to a "sections" entry in
    // settings-help.json. The fields inside carry no ids, so without this the
    // heading would resolve to nothing and stay silent.
    // (tests/settings-help.test.mjs scans this file for exactly these strings, so a
    // new section cannot ship without its words.)
    sec.dataset.help = key;
    sec.appendChild(Object.assign(document.createElement('label'), { textContent: title }));

    const list = document.createElement('div');
    list.className = 'ee-list';
    const arr = data[key];
    arr.forEach((text, i) => {
        const row = document.createElement('div');
        row.className = 'ee-row ee-phrase';
        row.appendChild(textInput(text, 'What to say', (v) => { arr[i] = v; commit(false); }));

        const tools = document.createElement('div');
        tools.className = 'ee-tools';
        // Reads the LIVE field rather than the value captured when the row was
        // drawn, so it speaks what has just been typed and not what was there
        // before. Deliberately not disabled on an empty field: text commits without
        // a re-render, so a disabled state set at build time would still say
        // "empty" after the user had typed into it.
        const hear = mkBtn('🔊', 'ee-hear', 'Hear this phrase');
        hear.addEventListener('click', () => {
            const said = (row.querySelector('input')?.value || '').trim();
            if (said) tts.speak(said);
        });
        const up = mkBtn('↑', '', 'Move up'); up.disabled = i === 0;
        up.addEventListener('click', () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; commit(true); });
        const down = mkBtn('↓', '', 'Move down'); down.disabled = i === arr.length - 1;
        down.addEventListener('click', () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; commit(true); });
        // Never leave a pool empty. An empty pool is not "no placeholders" — that is
        // what "Maximum per turn: 0" is for, and it is the honest way to say it.
        // Emptying the list instead would fall back to the other pool at speaking
        // time, so the user would have deleted every phrase and still hear phrases.
        const del = mkBtn('✕', 'ee-del', 'Delete');
        del.disabled = arr.length <= 1;
        del.addEventListener('click', () => { arr.splice(i, 1); commit(true); });
        tools.append(hear, up, down, del);
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
    data = model.getPools();
    container.innerHTML = '';

    container.append(
        poolSection('What it says first', 'acknowledgment'),
        poolSection('What it says while you are still choosing', 'thinking'),
    );

    const reset = mkBtn('Reset to default', 'ee-reset');
    reset.addEventListener('click', async () => {
        const ok = await confirmDanger({
            title: 'Reset the placeholder phrases?',
            body: 'This restores the wording the app came with for both lists. Your own phrases will be lost.',
            confirmLabel: 'Reset to default',
            cancelLabel: 'Keep mine',
        });
        if (!ok) return;
        model.resetPools();
        render();
    });
    container.appendChild(reset);

    // Each section is exactly "a collection of controls with a single heading", so it
    // collapses like every other Settings section (Rule 18). Done after the tab is
    // built; the open/closed state survives a rebuild, because this editor re-renders
    // itself on add / reorder / delete and slamming both sections shut mid-edit would
    // be worse than not collapsing at all.
    //
    // ⚠ THE SCOPE NAME MUST NOT BE THE TAB NAME. Open state is remembered by POSITION
    // within a scope, and this tab has sections from two places: "Timing and count" is
    // declared in index.html and wrapped under the tab's own name, while these two are
    // built here. Sharing a name makes position 0 mean both "Timing and count" and the
    // first pool at once, so opening one reopens the other and a rebuilt section comes
    // back in the wrong state. The Express tab hit this first and answered it the same
    // way ('expressBands' beside the 'express' tab).
    makeCollapsible(container, 'placeholderPools');

    // Focus a just-added row so the user can type immediately.
    if (pendingFocus) {
        const lists = container.querySelectorAll('.ee-list');
        const order = { acknowledgment: 0, thinking: 1 };
        const rows = lists[order[pendingFocus.key] ?? 0]?.querySelectorAll('.ee-row input');
        const inp = rows && rows[pendingFocus.index];
        pendingFocus = null;
        if (inp) { inp.scrollIntoView({ block: 'nearest' }); inp.focus(); }
    }
}
