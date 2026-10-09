/* "Words the voice gets wrong" (Settings > Speech, Ken, October 9 2026).
 *
 * One list of word -> how to say it, applied by pronunciation.js to everything the app
 * speaks: Express phrases, the Commands phrases, and the AI's suggestions. Chosen over a
 * "How to say it" box on every Commands phrase because what the voice gets wrong is
 * usually one word, and a box on one phrase would fix it in that phrase only.
 *
 * Same shape as the Commands editor: typing commits without redrawing, so the box keeps
 * its focus; adding or removing a row redraws.
 */
import { setIconButton } from './icons.js';
import * as storage from './storage.js';
import * as tts from './tts.js';

let container = null;
let pendingFocus = -1;

export function init(el) { container = el; }

function mkBtn(cls, title) {
    const b = document.createElement('button');
    b.type = 'button';
    if (cls) b.className = cls;
    b.title = title;
    b.setAttribute('aria-label', title);
    return b;
}

function box(value, label, oninput, noPredict) {
    const i = document.createElement('input');
    i.type = 'text';
    i.value = value || '';
    i.placeholder = label;
    i.setAttribute('aria-label', label);
    i.autocomplete = 'off';
    if (noPredict) i.dataset.noPredict = '';   // a respelling must not be word-completed
    i.addEventListener('input', () => oninput(i.value));
    return i;
}

export function render() {
    if (!container) return;
    const list = storage.loadSpokenWords();
    container.innerHTML = '';
    const rows = document.createElement('div');
    rows.className = 'ee-list';
    list.forEach((w, i) => {
        const row = document.createElement('div');
        row.className = 'ee-row ee-phrase';
        const save = () => storage.saveSpokenWords(list);
        const word = box(w.word, 'The word', (v) => { list[i].word = v; save(); });
        const say = box(w.say, 'How to say it', (v) => { list[i].say = v; save(); }, true);
        row.append(word, say);
        const tools = document.createElement('div');
        tools.className = 'ee-tools';
        // Hear it: says the word as the app now will - the respelling if one is typed.
        const hear = mkBtn(null, 'Hear this word'); setIconButton(hear, 'speak', 'Hear this word');
        hear.addEventListener('click', () => {
            const shown = word.value.trim();
            const said = say.value.trim() || shown;
            if (said) tts.speak(said, shown && shown !== said ? { display: shown } : {});
        });
        const del = mkBtn('ee-del', 'Delete this word'); setIconButton(del, 'close', 'Delete this word');
        del.addEventListener('click', () => { list.splice(i, 1); storage.saveSpokenWords(list); render(); });
        tools.append(hear, del);
        row.appendChild(tools);
        rows.appendChild(row);
    });
    container.appendChild(rows);
    const add = mkBtn('ee-add', 'Add a word');
    add.textContent = '+ Add a word';
    add.addEventListener('click', () => {
        list.push({ word: '', say: '' });
        storage.saveSpokenWords(list);
        pendingFocus = list.length - 1;
        render();
    });
    container.appendChild(add);
    if (pendingFocus >= 0) {
        const inp = rows.querySelectorAll('.ee-row')[pendingFocus]?.querySelector('input');
        pendingFocus = -1;
        if (inp) { inp.scrollIntoView({ block: 'nearest' }); inp.focus(); }
    }
}
