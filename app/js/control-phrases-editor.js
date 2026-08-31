/* Control phrases editor (Settings → Controls) — Ken, June 28 2026
 *
 * Edits the spoken text behind the persistent override controls and the
 * opener / wind-down / closing cards (control-phrases.js). Every one of them is an
 * ordered list now: the "Ask them to repeat" phrases, the "Start conversation"
 * openers, the "Wind down" statements, the closings/goodbyes, and the "one more
 * thing" phrases. "Say again" has no editable phrase — it re-speaks the user's own
 * last words. "Hold on" has none either — it draws from the placeholder list, which
 * is edited on its own tab.
 *
 * Reuses the Express-editor (.ee-*) styles for rows/buttons. Plain text edits
 * commit WITHOUT re-rendering so the field keeps focus while typing; structural
 * changes (add / delete / reorder / reset) re-render. Every change persists via
 * the model and calls onChange so the engine re-reads the openers/closers.
 */

import * as model from './control-phrases.js';
import { confirmDanger } from './confirm-dialog.js';
import { makeCollapsible } from './sections.js';

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

// An ordered list of cards (openers / closers): rows with text + ↑ ↓ ✕, plus Add.
function listSection(title, key) {
    const sec = document.createElement('div');
    sec.className = 'setting-group cpe-section';
    // These headings are collapsible sections like every other Settings section, so the
    // spoken "?" has to reach them. They are built here rather than in index.html, so
    // the key is stamped here too — keyed by the phrase list it edits, and matched to a
    // "sections" entry in settings-help.json (tests/settings-help.test.mjs scans this
    // file for exactly these strings, so a new section cannot ship without its words).
    //   The fields inside carry no ids, so there is no control phrase for the group to
    // borrow: without this it would resolve to nothing and the heading would stay
    // silent.
    sec.dataset.help = key;
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

    // Both of these were single phrases until August 29 2026. They are lists for the
    // same reason the openers and goodbyes are: one fixed sentence, said every time
    // the button is pressed, is what makes an app sound like an app rather than like
    // the person using it.
    container.append(
        listSection('“Ask them to repeat” phrases', 'pardon'),
        listSection('Openers (Start conversation)', 'openers'),
        listSection('Wind-down statements (Wrap up)', 'windDowns'),
        listSection('Closings (goodbyes)', 'closings'),
        listSection('“One more thing” phrases', 'declineClosing'),
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

    // Each section here is exactly "a collection of controls with a single heading", so
    // it collapses like every other Settings section (Ken, August 11 2026). Done after
    // the whole tab is built, and the open/closed state survives a rebuild — this
    // editor re-renders itself on add / reorder / delete, and slamming every section
    // shut on the user mid-edit would be worse than not collapsing at all. Reset sits
    // outside the sections, so it stays reachable with everything closed.
    // ⚠ A SCOPE NAME OF ITS OWN, NOT THE TAB'S — the same trap the Express tab hit.
    // sections.js remembers open state by POSITION within a named scope, and the tab
    // itself now declares a section in index.html ("What the command buttons show"),
    // which the panel registers under the tab name. Sharing the scope would give that
    // section and this editor's first one the same key "controls#0", so opening one
    // would open the other on the next rebuild. Two containers, two scopes.
    makeCollapsible(container, 'controlPhrases');

    // Focus a just-added list row so the user can type immediately.
    if (pendingFocus) {
        const sel = `.ee-list`;
        const lists = container.querySelectorAll(sel);
        // The .ee-list order matches the order the sections are appended above.
        const order = { pardon: 0, openers: 1, windDowns: 2, closings: 3, declineClosing: 4 };
        const idx = order[pendingFocus.key] ?? 0;
        const rows = lists[idx]?.querySelectorAll('.ee-row input');
        const inp = rows && rows[pendingFocus.index];
        pendingFocus = null;
        if (inp) { inp.scrollIntoView({ block: 'nearest' }); inp.focus(); }
    }
}
