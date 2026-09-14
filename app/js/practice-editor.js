/* Settings → Practice: choose a scenario, make one your own, or build a new one
 * (Ken, September 13 2026; spec: Documents/Conversant AAC Practice Scenarios.docx,
 * sections 4 and 6).
 *
 * Three views, one at a time:
 *   list    — the built-ins (each with "Make a copy"), the user's own (Edit / Delete),
 *             and New scenario (describe it in a sentence, or fill in a blank form)
 *   edit    — an EXISTING scenario of the user's; every change saves as it is made,
 *             ending in Done (the People/Places rule, September 10 2026: a screen that
 *             shows a thing as saved has promised it is)
 *   create  — a blank form, which cannot save as you go because there is nothing to
 *             write into yet; it ends in "Add scenario" or Cancel
 *
 * Spoken help: every group carries a data-help key stamped through helpGroup(), and
 * tests/settings-help.test.mjs reads this file for exactly those calls, so a new group
 * cannot ship without its words.
 */

import * as library from './practice-library.js';
import { SCENARIOS as BUILT_IN } from './practice-scenarios.js';
import * as llm from './llm.js';
import { confirmDanger } from './confirm-dialog.js';

let container = null;
let hooks = {};
let view = { mode: 'list' };

export function init(el, opts = {}) {
    container = el;
    hooks = opts;
}

export function render() {
    if (!container) return;
    container.textContent = '';
    if (hooks.isPracticing && hooks.isPracticing()) return renderActive();
    if (view.mode === 'edit') {
        const s = library.getScenario(view.id);
        if (s) return renderForm(s, false);
        view = { mode: 'list' };
    }
    if (view.mode === 'create') return renderForm(view.draft, true);
    renderList();
}

// --- small builders ------------------------------------------------------------

function el(tag, props = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'text') n.textContent = v;
        else if (k === 'class') n.className = v;
        else if (k === 'onclick') n.addEventListener('click', v);
        else n[k] = v;
    }
    for (const c of children) if (c) n.appendChild(c);
    return n;
}

function button(label, onclick, cls = '') {
    return el('button', { type: 'button', text: label, class: cls, onclick });
}

// A group the spoken "?" can explain. The key is matched to a "sections" entry in
// settings-help.json.
function helpGroup(parent, key, heading) {
    const g = el('div', { class: 'setting-group practice-group' });
    g.dataset.help = key;
    if (heading) g.appendChild(el('label', { text: heading }));
    parent.appendChild(g);
    return g;
}

function status(text) {
    return el('p', { class: 'setting-status practice-status', text, role: 'status' });
}

function card(scenario, onclick) {
    return el('button', { type: 'button', class: 'practice-card', onclick }, [
        el('span', { class: 'practice-cat', text: scenario.category }),
        el('span', { class: 'practice-name', text: scenario.title || '(untitled)' }),
        scenario.description ? el('span', { class: 'practice-desc', text: scenario.description }) : null,
    ]);
}

function goTo(next) {
    view = next;
    render();
    container.scrollIntoView?.({ block: 'start' });
}

// --- views ---------------------------------------------------------------------

function renderActive() {
    container.appendChild(el('p', { class: 'practice-active', text: `Practicing: ${hooks.currentTitle()}` }));
    container.appendChild(button('End practice', () => hooks.onEnd(), 'practice-end'));
}

function renderList() {
    // ⚠ THE KEY GATE IS PER-SCENARIO, NOT PER-TAB: the controls tour is scripted and
    // needs no key, so it stays offered to the person on their first day whose key is
    // not working yet. Everything else here needs the AI.
    const hasKey = hooks.hasKey();
    if (!hasKey) {
        container.appendChild(el('p', { class: 'practice-note', text: 'Practicing a conversation needs a Claude API key — the AI plays the other person and suggests your responses. Add one on the General tab, then come back. The tour of the buttons below works without one.' }));
        container.appendChild(button('Go to the General tab', () => hooks.onGoToKey(), 'practice-add-key'));
    }

    const builtIn = helpGroup(container, 'practiceBuiltIn', hasKey ? 'Choose something to practice' : 'What you can do without a key');
    const list = el('div', { class: 'practice-list' });
    for (const s of BUILT_IN) {
        const scripted = Array.isArray(s.steps) && s.steps.length > 0;
        if (!hasKey && !scripted) continue;
        const row = el('div', { class: 'practice-row' }, [card(s, () => hooks.onStart(s))]);
        if (hasKey && s.partnerPersona) {
            row.appendChild(el('div', { class: 'practice-tools' }, [
                button('Make a copy', async () => {
                    const id = await library.copyScenario(s);
                    if (id) goTo({ mode: 'edit', id });
                }),
            ]));
        }
        list.appendChild(row);
    }
    builtIn.appendChild(list);
    if (!hasKey) return;

    const mine = library.listScenarios();
    if (mine.length) {
        const yours = helpGroup(container, 'practiceYours', 'Your scenarios');
        const ylist = el('div', { class: 'practice-list' });
        for (const s of mine) {
            ylist.appendChild(el('div', { class: 'practice-row' }, [
                card(s, () => hooks.onStart(s)),
                el('div', { class: 'practice-tools' }, [
                    button('Edit', () => goTo({ mode: 'edit', id: s.id })),
                    button('Make a copy', async () => {
                        const id = await library.copyScenario(s);
                        if (id) goTo({ mode: 'edit', id });
                    }),
                    button('Delete', async () => {
                        const ok = await confirmDanger({
                            title: 'Delete this scenario?',
                            body: `“${s.title}” and everything written in it will be deleted. Conversations you already practiced with it are kept.`,
                            confirmLabel: 'Delete',
                            cancelLabel: 'Keep it',
                        });
                        if (!ok) return;
                        await library.removeScenario(s.id);
                        render();
                    }, 'practice-delete'),
                ]),
            ]));
        }
        yours.appendChild(ylist);
    }

    const fresh = helpGroup(container, 'practiceNew', 'New scenario');
    const sentence = el('textarea', {
        rows: 3,
        placeholder: 'Describe the conversation in a sentence. For example: “I need to tell my landlord the heating has been broken for two weeks.”',
        autocomplete: 'off',
    });
    const note = status('');
    const writeBtn = button('Write it for me', async () => {
        const text = sentence.value.trim();
        if (!text) { note.textContent = 'Type a sentence about the conversation first.'; return; }
        writeBtn.disabled = true;
        note.textContent = 'Writing it…';
        try {
            const draft = await llm.draftScenario(text);
            if (!draft) { note.textContent = 'That did not come back as something usable. Try again, or fill it in yourself.'; return; }
            const id = await library.addScenario(draft);
            goTo({ mode: 'edit', id });
        } catch {
            note.textContent = 'Could not reach the AI. Check your API key and internet, then try again.';
        } finally {
            writeBtn.disabled = false;
        }
    });
    fresh.append(sentence, el('div', { class: 'practice-tools' }, [
        writeBtn,
        button('Fill it in yourself', () => goTo({ mode: 'create', draft: library.emptyScenario() })),
    ]), note);
}

// The form. `creating` is the blank-form path; otherwise `scenario` is stored and every
// change is saved as it is made.
function renderForm(scenario, creating) {
    const draft = { ...scenario };
    const note = status('');

    const save = async (fields) => {
        Object.assign(draft, fields);
        if (!creating) await library.updateScenario(draft.id, fields);
    };

    const textField = (helpKey, heading, prop, multiline = false, placeholder = '') => {
        const g = helpGroup(container, helpKey, heading);
        const f = multiline
            ? el('textarea', { rows: 4, value: draft[prop] || '', placeholder, autocomplete: 'off' })
            : el('input', { type: 'text', value: draft[prop] || '', placeholder, autocomplete: 'off' });
        f.addEventListener('input', () => { draft[prop] = f.value; });
        f.addEventListener('change', () => save({ [prop]: f.value }));
        g.appendChild(f);
        return f;
    };

    const selectField = (helpKey, heading, prop, options, onPick) => {
        const g = helpGroup(container, helpKey, heading);
        const sel = el('select');
        for (const [value, label] of options) sel.appendChild(el('option', { value, text: label }));
        sel.value = draft[prop];
        sel.addEventListener('change', async () => {
            await save({ [prop]: sel.value });
            if (onPick) onPick(sel.value);
        });
        g.appendChild(sel);
        return g;
    };

    container.appendChild(el('h3', { class: 'practice-title', text: creating ? 'A new scenario' : 'Make it your own' }));

    textField('practiceName', 'Name', 'title');
    selectField('practiceKind', 'Kind', 'category', library.CATEGORIES.map((c) => [c, c]));
    textField('practiceSummary', 'One-line summary', 'description');
    selectField('practiceOpens', 'Who speaks first', 'opensWith', [['partner', 'They do'], ['user', 'I do']]);
    textField('practicePersona', 'Who they are', 'partnerPersona', true,
        'Who they are to you, what they want from this conversation, and how they normally come across.');
    textField('practiceRegister', 'The kind of encounter', 'register', false,
        'For example: a relaxed chat between friends, or a formal hearing');

    const behaviorGroup = selectField('practiceBehavior', 'How they are behaving', 'behavior',
        library.BEHAVIORS.map((b) => [b.id, b.label]),
        (value) => { custom.hidden = value !== 'custom'; if (value === 'custom') custom.focus(); });
    const custom = el('input', { type: 'text', value: draft.behaviorText || '', placeholder: 'Describe how they are being', autocomplete: 'off' });
    custom.hidden = draft.behavior !== 'custom';
    custom.addEventListener('input', () => { draft.behaviorText = custom.value; });
    custom.addEventListener('change', () => save({ behaviorText: custom.value }));
    behaviorGroup.appendChild(custom);

    textField('practiceDetails', 'Details for this practice', 'details', true,
        'Dr. Alvarez, my rheumatologist. I am there about my right knee, which has been worse since March. I want to ask about changing the medication because it makes me tired all day.');

    const tools = el('div', { class: 'practice-tools practice-form-tools' });
    if (creating) {
        tools.append(
            button('Add scenario', async () => {
                if (!draft.title.trim() || !draft.partnerPersona.trim()) {
                    note.textContent = 'A scenario needs a name and a description of who they are.';
                    return;
                }
                const id = await library.addScenario(draft);
                goTo({ mode: 'edit', id });
            }),
            button('Cancel', () => goTo({ mode: 'list' })),
        );
    } else {
        tools.append(
            button('Practice this', async () => {
                await library.updateScenario(draft.id, draft);   // a field still being typed in
                const saved = library.getScenario(draft.id);
                view = { mode: 'list' };
                hooks.onStart(saved);
            }),
            button('Done', async () => {
                await library.updateScenario(draft.id, draft);
                goTo({ mode: 'list' });
            }),
        );
    }
    container.append(tools, note);
}
