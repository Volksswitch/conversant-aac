/* "Typing suggestions" (Settings > Express Panel and Keyboard, Ken, October 25 2026).
 *
 * The words the keyboard suggests first because the user has typed them, shown as a
 * list they can see and change: add a word they want suggested from the start, remove
 * one they do not (a typo learned twice, or a word planted by somebody else's backup),
 * or clear the lot. Until now the list was invisible and permanent.
 *
 * Names the app already knows - About Me, My Places, "Words the voice gets wrong" - are
 * suggested too, but they are read from those places on every prediction rather than
 * kept here, so they are not in this list and are changed where they live.
 *
 * Words are labels, not text boxes (UI Layout Rule 3): a learned word is the user's
 * typing, and the only change that makes sense is removing it.
 */
import { setIconButton } from './icons.js';
import * as prediction from './prediction.js';
import { confirmDanger } from './confirm-dialog.js';

/**
 * The names the suggestions offer from the start, from what the app already holds. Pure,
 * so the privacy rule is tested: a person or place marked Private, or one of the user's
 * own names they marked private, is left out, because a suggestion is shown on screen
 * while someone else may be watching. Respellings are never passed in - only the words
 * as written. Returns a list of texts; prediction.js splits them into words.
 */
export function namesForTyping({ people = [], places = [], ownNames = [], spokenWords = [] } = {}) {
    const out = [];
    for (const p of people) if (p && !p.private) out.push(p.name, p.nickname);
    for (const pl of places) if (pl && !pl.private) out.push(pl.name);
    for (const n of ownNames) if (n && !n.private) out.push(n.value);
    for (const w of spokenWords) if (w) out.push(w.word);
    return out.filter((t) => typeof t === 'string' && t.trim());
}

let container = null;
let statusEl = null;
let clearBtn = null;
let input = null;
let addBtn = null;

export function init({ list, status, clear, addInput, add }) {
    container = list;
    statusEl = status;
    clearBtn = clear;
    input = addInput;
    addBtn = add;
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
    if (addBtn) addBtn.addEventListener('click', addTyped);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTyped(); }
        });
    }
}

function say(text) {
    if (statusEl) statusEl.textContent = text;
}

function countLine(n) {
    return n ? `Words on your list: ${n}.` : 'Your list is empty.';
}

function addTyped() {
    if (!input) return;
    const { added, skipped } = prediction.addWords(input.value);
    if (!added.length && !skipped.length) return;
    input.value = '';
    render();
    const bits = [];
    if (added.length) bits.push(`Added: ${added.join(', ')}.`);
    if (skipped.length) bits.push(`Not added, because a word needs two letters or more: ${skipped.join(', ')}.`);
    say(bits.join(' '));
}

async function clearAll() {
    const n = prediction.listLearned().length;
    if (!n) return;
    if (!(await confirmDanger({
        title: 'Clear the whole list?',
        body: `This removes all ${n} word${n === 1 ? '' : 's'} on the list, including any you added. ` +
              'Suggestions keep working, and start learning your words again as you type. ' +
              'Names from About Me and My Places are still suggested. Nothing you have written ' +
              'or said is changed.\n\nThis cannot be undone.',
        confirmLabel: 'Clear the list',
    }))) return;
    prediction.clearLearned();
    render();
}

export function render() {
    if (!container) return;
    const words = prediction.listLearned();
    say(countLine(words.length));
    if (clearBtn) clearBtn.disabled = words.length === 0;
    container.innerHTML = '';
    for (const { word } of words) {
        const row = document.createElement('div');
        row.className = 'ee-row ee-phrase';
        const label = document.createElement('span');
        label.className = 'learned-word';
        label.textContent = word;
        const tools = document.createElement('div');
        tools.className = 'ee-tools';
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'ee-del';
        setIconButton(del, 'close', `Remove "${word}"`);
        del.addEventListener('click', () => {
            prediction.removeWord(word);
            render();
            say(`Removed: ${word}. ${countLine(prediction.listLearned().length)}`);
        });
        tools.appendChild(del);
        row.append(label, tools);
        container.appendChild(row);
    }
}
