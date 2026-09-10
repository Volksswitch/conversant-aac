/* AAC Conversation Assistant — worldview questionnaire UI (Build Step 2)
 *
 * Renders the "About Me" questionnaire over the conversation screen. Reads and
 * writes through worldview.js (the Step 1 model). No LLM wiring here — that is
 * Build Step 3.
 *
 * Flow (Implementation-Plan §7):
 *   Home    — intro, "suggested next" (gaps-driven), module list with progress,
 *             and Restart.
 *   Module  — a chunk: every field in one module as an answerable card
 *             (answer / in my own words / prefer not to say / skip / edit).
 *
 * Per the resolved decisions: nothing is required, no fixed chunk size, every
 * answer optional and revisable. Each card carries an in-flow "Speak" control
 * (CLAUDE.md Build Step 2 design intent) — opt-in, never automatic.
 */

import * as wv from './worldview.js';
import * as rel from './relationships.js';
import * as places from './places.js';
import * as voiceProfile from './voice.js';
import { SOUND_CHECK_ITEMS, VERDICT, questionFor } from './sound-check-items.js';
import { REGISTER_DIMENSIONS, RELATIONSHIP_GOALS, goalText } from './partner-profile.js';
import * as voiceHarvest from './voice-harvest.js';
import * as controlPhrases from './control-phrases.js';
import * as placeholderPhrases from './placeholder-phrases.js';
import * as expressPanel from './express-panel.js';
import { speak } from './tts.js';
import * as storage from './storage.js';
import * as keyboard from './keyboard.js';
import { confirmDanger } from './confirm-dialog.js';

let contentEl;

// Scroll position of the People list captured when "Edit" is pressed, so that
// returning from the edit form (Save/Cancel) restores exactly where the list
// was rather than jumping to the top (Ken, June 19 2026). Consumed (and cleared)
// by the next non-editing renderPeople(); null means a fresh entry → top.
let peopleReturnScroll = null;
// Same for the Places list.
let placesReturnScroll = null;

// Move keyboard focus to the first answerable control within `scope`
// (a chip or a text input — whichever comes first in the card).
function focusFirstField(scope) {
    const first = (scope || contentEl).querySelector('.wv-card .wv-chip, .wv-card .wv-text');
    if (first) first.focus();
}

// --- tiny DOM helper --------------------------------------------------------

function el(tag, props = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v == null) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        // NOTE: no raw-HTML branch. Everything rendered through el() is set as
        // textContent, so user- and AI-derived strings can't inject markup (SEC-8).
        // If a static HTML fragment is ever genuinely needed, build it from real
        // elements rather than reintroducing an innerHTML sink here.
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else n.setAttribute(k, v);
    }
    for (const c of (Array.isArray(children) ? children : [children])) {
        if (c == null || c === false) continue;
        n.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return n;
}

// --- value formatting (display + speak) -------------------------------------

function formatValue(value) {
    if (value == null || value === '') return '';
    if (Array.isArray(value)) {
        return value.map((v) => (v && typeof v === 'object'
            ? Object.values(v).filter(Boolean).join(' — ')
            : v)).filter(Boolean).join(', ');
    }
    if (typeof value === 'object') return Object.values(value).filter(Boolean).join(' — ');
    return String(value);
}

// --- lifecycle --------------------------------------------------------------

export function init() {
    // About Me is now an ordinary Settings tab (Ken, July 2026) — it renders into
    // its tab-panel like every other tab, with no title bar and no "Done" button.
    // The Settings panel's shared "Close" button closes it and returns to the
    // conversation. So there's no separate overlay to show/hide/inert here.
    contentEl = document.getElementById('worldviewContent');
}

// Show the on-screen keyboard in the user's configured dock and keep it up for
// the whole About Me session (Ken, June 30 2026). A non-typing preview when no
// field is focused (the home/topic list); focusing a card's field upgrades it to
// a typing keyboard via the global focusin handler. No-op in physical-keyboard
// mode (previewShow guards on mode), so nothing shows there.
function showDockKeyboard() {
    if (storage.loadKeyboardMode() === 'onscreen') {
        keyboard.previewShow(storage.loadKeyboardDock());
    }
}

// Load the user-owned data + render the questionnaire into the About Me tab
// panel. Called by the Settings tab handler when the About Me tab is activated;
// safe to call again (re-renders home).
export async function open() {
    // Best-effort: make sure the user-owned data folder is restored so answers
    // persist to worldview.json (falls back to the localStorage cache if not).
    try { await storage.restoreDataFolder(); } catch { /* no stored handle yet */ }
    try {
        await wv.loadRegistry();
    } catch {
        contentEl.innerHTML = '<p class="wv-intro">Could not load the question set.</p>';
        return;
    }
    await wv.load();
    // If the folder was just restored and answers were cache-only, promote
    // them to the on-disk worldview.json.
    try { await wv.syncToFolder(); } catch { /* best-effort */ }
    // Relationship graph: load + reconcile so the People section is ready.
    try { await rel.load(); } catch { /* cache/empty graph */ }
    try { await rel.syncToFolder(); } catch { /* best-effort */ }
    // My Places: same, so the Places section is ready.
    try { await places.load(); } catch { /* cache/empty places */ }
    try { await places.syncToFolder(); } catch { /* best-effort */ }
    // How I Sound: same, so the section's answered count is right on first render.
    try { await voiceProfile.load(); } catch { /* cache/empty voice data */ }
    try { await voiceProfile.syncToFolder(); } catch { /* best-effort */ }
    renderHome();
}

// --- Home -------------------------------------------------------------------

// Shown on the About Me home when no data folder is assigned. Without a folder,
// answers live only in this browser's cache — they don't travel with the user
// and are lost if browser data is cleared. The button is a fresh user gesture
// (required by the File System Access picker), so we prompt here rather than
// auto-popping the picker from open() where the gesture would be consumed by
// the awaits before render.
function renderFolderPrompt() {
    const card = el('div', { class: 'wv-folder-prompt' }, [
        el('p', { class: 'wv-folder-prompt-text', text:
            'Your answers are being saved only in this browser. Choose a data folder '
            + 'to save them to a file you can back up and move between devices.' }),
        el('button', {
            class: 'wv-folder-prompt-btn',
            text: 'Choose data folder',
            onclick: async (e) => {
                e.currentTarget.disabled = true;
                try {
                    await storage.pickDataFolder();
                    // File-in-folder wins (v0.2.25): adopt an existing
                    // worldview.json, or promote cache-only answers to a new one.
                    try { await wv.syncToFolder(); } catch { /* best-effort */ }
                    renderHome();   // banner clears; progress reflects adopted data
                } catch (err) {
                    e.currentTarget.disabled = false;   // AbortError = user cancelled
                }
            }
        })
    ]);
    contentEl.append(card);
}

// Gaps-driven "Questions worth answering" (Ken, June 28 2026 — restores a
// surface for the progressive-profiling gaps log, which had no UI after v0.2.31
// removed the old "Suggested next" section). Distinct from the Topics list: it
// shows ONLY facts the AI actually needed but didn't have during real
// conversations (worldview.recordGaps from missing_facts), most-asked first, so
// answering these has the biggest payoff. Renders nothing when there are no
// open gaps (e.g. before any live-API conversations), so it never duplicates the
// topic pages.
function renderGaps() {
    const items = [];
    const seen = new Set();
    for (const g of wv.listGaps()) {
        if (wv.getState(g.key) !== 'unanswered') continue;   // answered since it was logged
        if (seen.has(g.key)) continue;
        const meta = wv.fieldMeta(g.key);
        if (!meta) continue;                                  // gap key not in the registry
        seen.add(g.key);
        items.push({ meta, count: g.count });
    }
    // Facts About Me has no question for at all. These are the ones that used to be
    // noticed every conversation and never recordable — see worldview.recordExtraGaps.
    const extras = wv.listOpenExtras();
    if (!items.length && !extras.length) return;

    contentEl.append(el('h3', { class: 'wv-section-title', text: 'Questions worth answering' }));
    contentEl.append(el('p', { class: 'wv-intro', text:
        'These came up in real conversations but I didn’t have the answer. Filling them in gives the biggest payoff.' }));
    const timesText = (n) => (n > 1 ? `Came up ${n} times` : 'Came up once');
    for (const { meta, count } of items) {
        contentEl.append(el('button', { class: 'wv-module-row',
            onclick: () => renderModule(meta.moduleId, meta.key) }, [
            el('div', { class: 'wv-module-main' }, [
                el('div', { class: 'wv-module-title', text: meta.q }),
                el('div', { class: 'wv-module-meta', text: `${timesText(count)} · ${meta.moduleTitle}` })
            ]),
            el('div', { class: 'wv-chevron', text: '›' })
        ]));
    }
    for (const e of extras) {
        contentEl.append(el('button', { class: 'wv-module-row',
            onclick: () => renderExtra(e.name) }, [
            el('div', { class: 'wv-module-main' }, [
                el('div', { class: 'wv-module-title', text: e.question }),
                // Says where it came from, because unlike every other row on this
                // screen the question was not one we wrote — the user should be able
                // to see that a conversation raised it.
                el('div', { class: 'wv-module-meta', text: `${timesText(e.count)} · from a conversation` })
            ]),
            el('div', { class: 'wv-chevron', text: '›' })
        ]));
    }
}

/* Every question the conversations have added, in one list. */
function renderExtras() {
    contentEl.scrollTop = 0;
    contentEl.innerHTML = '';
    showDockKeyboard();
    contentEl.append(el('button', { class: 'wv-back', text: '‹ Back', onclick: renderHome }));
    contentEl.append(el('h3', { class: 'wv-section-title', text: 'Other things about me' }));
    contentEl.append(el('p', { class: 'wv-intro', text:
        'These are not built-in questions — each one came up because somebody asked it in a conversation. '
        + 'Your answers are kept private: the AI uses them for context but never raises them on its own.' }));
    const all = wv.listAllExtras();
    if (!all.length) {
        contentEl.append(el('p', { class: 'wv-intro', text: 'Nothing yet.' }));
        return;
    }
    for (const e of all) {
        const meta = e.state === 'answered' && e.value ? formatValue(e.value)
            : e.state === 'declined' ? 'Prefer not to say' : 'Not answered yet';
        contentEl.append(el('button', { class: 'wv-module-row', onclick: () => renderExtra(e.name) }, [
            el('div', { class: 'wv-module-main' }, [
                el('div', { class: 'wv-module-title', text: e.question }),
                el('div', { class: 'wv-module-meta', text: meta })
            ]),
            el('div', { class: 'wv-chevron', text: '›' })
        ]));
    }
}

/* One question a conversation raised, on its own page.
 *
 * Deliberately the same shape as an ordinary question card — same heading, same
 * private notice, same Speak button, same "Prefer not to say" — because to the user
 * it IS an ordinary question. The only difference on screen is the line saying where
 * it came from, and Delete, which a built-in question does not have.
 */
function renderExtra(name) {
    const e = wv.listAllExtras().find((x) => x.name === name);
    if (!e) { renderHome(); return; }
    contentEl.scrollTop = 0;
    contentEl.innerHTML = '';
    showDockKeyboard();

    contentEl.append(el('button', { class: 'wv-back', text: '‹ Back', onclick: renderHome }));

    const card = el('div', { class: 'wv-card' });
    const head = el('div', { class: 'wv-card-head' }, [el('div', { class: 'wv-question', text: e.question })]);
    if (e.state === 'answered') head.append(el('span', { class: 'wv-badge wv-badge-answered', text: '✓ Answered' }));
    else if (e.state === 'declined') head.append(el('span', { class: 'wv-badge wv-badge-declined', text: 'Prefer not to say' }));
    card.append(head);
    card.append(el('p', { class: 'wv-module-meta', text: 'This came up in a conversation — it is not one of the built-in questions.' }));
    // ALWAYS private: we did not write the question, so we do not know what the
    // answer holds. Same wording as a built-in private field, which is the point.
    card.append(el('p', { class: 'wv-private-note', text:
        `🔒 The AI uses this for context but won't raise it on its own — only if they ask, or you ask for it in "In my own words".` }));

    if (e.state === 'declined') {
        card.append(el('div', { class: 'wv-actions' }, [
            el('button', { class: 'wv-btn wv-btn-link', text: 'Undo — ask me this again',
                onclick: async () => { await wv.reopenExtra(name); renderExtra(name); } })
        ]));
        contentEl.append(card);
        return;
    }

    const input = el('input', { class: 'wv-text', type: 'text', value: e.value || '' });
    input.addEventListener('change', () => wv.setExtra(name, input.value.trim()));
    input.addEventListener('blur', () => wv.setExtra(name, input.value.trim()));
    card.append(input);

    const actions = el('div', { class: 'wv-actions' });
    const speakBtn = el('button', { class: 'wv-btn wv-btn-speak', text: '🔊 Speak my answer',
        onclick: () => { const v = input.value.trim(); if (v) speak(v); } });
    if (!(e.value || '').trim()) speakBtn.setAttribute('disabled', 'true');
    actions.append(speakBtn);
    actions.append(el('button', { class: 'wv-btn wv-btn-link', text: 'Prefer not to say',
        onclick: async () => { await wv.declineExtra(name); renderExtra(name); } }));
    // Confirmed, because it is not a question we can put back — it only exists
    // because a conversation raised it, and deleting loses the answer with it.
    actions.append(el('button', { class: 'wv-btn wv-btn-link', text: 'Delete this question',
        onclick: async () => {
            const ok = await confirmDanger({
                title: 'Delete this question?',
                body: `“${e.question}” and any answer you gave will be removed. If it comes up in another conversation it may be added again.`,
                confirmLabel: 'Delete it', cancelLabel: 'Keep it',
            });
            if (!ok) return;
            await wv.removeExtra(name);
            renderHome();
        } }));
    card.append(actions);
    contentEl.append(card);
    focusFirstField(card);
}

function renderHome() {
    // Keep the on-screen keyboard up the entire time the About Me tab is open (Ken,
    // June 30 2026), including on this home/topic list which has no text field, so
    // the user can enter/modify entries without it appearing and disappearing. The
    // Settings dialog reserves the dock region, so the keyboard just fills that
    // reserved band — it never covers the topic list. Leaving the tab / closing
    // Settings takes it down (handleSettingsTab / the Close button).
    showDockKeyboard();
    contentEl.scrollTop = 0;
    contentEl.innerHTML = '';

    contentEl.append(el('p', { class: 'wv-intro', text:
        'Answer as many or as few as you like, whenever you like. Nothing here is required, and you can change or remove any answer later.' }));

    if (!storage.hasDataFolder()) renderFolderPrompt();

    renderGaps();

    contentEl.append(el('h3', { class: 'wv-section-title', text: 'Topics' }));
    const registry = wv.getRegistry();
    for (const mod of wv.getModules()) {
        const pct = mod.total ? Math.round((mod.answered / mod.total) * 100) : 0;
        const meta = `${mod.answered} of ${mod.total} answered`
            + (mod.declined ? ` · ${mod.declined} skipped` : '');
        // Show a lock on modules where every field is private by default
        const fullMod = registry.modules.find((m) => m.id === mod.id);
        const allPrivate = fullMod && fullMod.fields.every((f) => f.defaultPrivacy === 'private');
        const titleText = mod.title + (allPrivate ? ' 🔒' : '');
        contentEl.append(el('button', { class: 'wv-module-row', onclick: () => renderModule(mod.id) }, [
            el('div', { class: 'wv-module-main' }, [
                el('div', { class: 'wv-module-title', text: titleText }),
                el('div', { class: 'wv-module-meta', text: meta }),
                el('div', { class: 'wv-progress' }, [
                    el('div', { class: 'wv-progress-fill', style: `width:${pct}%` })
                ])
            ]),
            el('div', { class: 'wv-chevron', text: '›' })
        ]));
    }

    // People & relationships — a graph, not Q&A, so it has its own editor
    // (relationships.js) rather than a questionnaire module.
    contentEl.append(el('h3', { class: 'wv-section-title', text: 'People & relationships' }));
    const n = rel.count();
    const peopleMeta = n
        ? `${n} ${n === 1 ? 'person' : 'people'} added`
        : 'Add family, friends, and pets';
    contentEl.append(el('button', { class: 'wv-module-row', onclick: renderPeople }, [
        el('div', { class: 'wv-module-main' }, [
            el('div', { class: 'wv-module-title', text: 'People in Your Life' }),
            el('div', { class: 'wv-module-meta', text: peopleMeta })
        ]),
        el('div', { class: 'wv-chevron', text: '›' })
    ]));

    // My Places — places + their arbitrary facts (places.js). Like People, this is
    // not questionnaire Q&A (every place wants different facts), so it gets its own
    // editor rather than a module.
    contentEl.append(el('h3', { class: 'wv-section-title', text: 'Places' }));
    const np = places.count();
    const placesMeta = np
        ? `${np} ${np === 1 ? 'place' : 'places'} added`
        : 'Add the places you go';
    contentEl.append(el('button', { class: 'wv-module-row', onclick: renderPlaces }, [
        el('div', { class: 'wv-module-main' }, [
            el('div', { class: 'wv-module-title', text: 'My Places' }),
            el('div', { class: 'wv-module-meta', text: placesMeta })
        ]),
        el('div', { class: 'wv-chevron', text: '›' })
    ]));

    // Goals for any conversation - the third source of a conversation goal, after the
    // person and the place. Its own row rather than a section of People or Places,
    // because it is precisely the list that belongs to NEITHER of them.
    contentEl.append(el('h3', { class: 'wv-section-title', text: 'Goals' }));
    const ng = rel.getGeneralGoals().length;
    const goalsMeta = ng
        ? `${ng} ${ng === 1 ? 'goal' : 'goals'} you can switch on with anyone`
        : 'Goals you can switch on with anyone, anywhere';
    contentEl.append(el('button', { class: 'wv-module-row', onclick: renderGeneralGoals }, [
        el('div', { class: 'wv-module-main' }, [
            el('div', { class: 'wv-module-title', text: 'Goals For Any Conversation' }),
            el('div', { class: 'wv-module-meta', text: goalsMeta })
        ]),
        el('div', { class: 'wv-chevron', text: '›' })
    ]));

    // How I Sound — the voice layer. Not questionnaire Q&A either: the user is not
    // reporting facts about themselves, they are picking between wordings, and the
    // sentence they pick is the answer (Sounds Like Me, Phase 1).
    // Questions the conversations added. Shown only once there are some, so a user
    // who has never met one is not given a section that explains nothing.
    const allExtras = wv.listAllExtras();
    if (allExtras.length) {
        const answeredExtras = allExtras.filter((e) => e.state === 'answered' && e.value).length;
        contentEl.append(el('h3', { class: 'wv-section-title', text: 'Other things about me' }));
        contentEl.append(el('button', { class: 'wv-module-row', onclick: renderExtras }, [
            el('div', { class: 'wv-module-main' }, [
                el('div', { class: 'wv-module-title', text: 'Questions that came up in conversations' }),
                el('div', { class: 'wv-module-meta',
                    text: `${answeredExtras} of ${allExtras.length} answered` })
            ]),
            el('div', { class: 'wv-chevron', text: '›' })
        ]));
    }

    contentEl.append(el('h3', { class: 'wv-section-title', text: 'How I sound' }));
    const answered = voiceProfile.answeredCount();
    const soundMeta = answered
        ? `${answered} of ${SOUND_CHECK_ITEMS.length} answered`
        : 'Help the app write suggestions in your words';
    contentEl.append(el('button', { class: 'wv-module-row', onclick: () => renderSoundCheck() }, [
        el('div', { class: 'wv-module-main' }, [
            el('div', { class: 'wv-module-title', text: 'How I Sound' }),
            el('div', { class: 'wv-module-meta', text: soundMeta }),
            el('div', { class: 'wv-progress' }, [
                el('div', { class: 'wv-progress-fill',
                    style: `width:${Math.round((answered / SOUND_CHECK_ITEMS.length) * 100)}%` })
            ])
        ]),
        el('div', { class: 'wv-chevron', text: '›' })
    ]));

    contentEl.append(el('div', { class: 'wv-home-footer' }, [
        el('button', { class: 'wv-btn wv-btn-danger', text: 'Restart — clear all answers', onclick: onRestart })
    ]));
}

async function onRestart() {
    const ok = await confirmDanger({
        title: 'Clear everything?',
        body: 'This permanently deletes every answer, all the people you have added, all the places you have added, and everything the app has learned about how you sound. This cannot be undone.',
        confirmLabel: 'Yes, clear it all',
        cancelLabel: 'Keep my answers'
    });
    if (!ok) return;
    await wv.resetAll();
    await rel.resetAll();
    await places.resetAll();
    await voiceProfile.resetAll();
    renderHome();
}

// --- How I Sound (voice) -----------------------------------------------------
//
// THE FRAMING COPY IS LOAD-BEARING, not decoration. The user is shown three ways of
// saying the same made-up thing and asked which sounds most like something they
// would say. If they read
// the candidates as being ABOUT THEM — "but my weekend wasn't quiet, so not that
// one" — they answer on truth instead of on wording, and the answers describe their
// life rather than their voice. Two things prevent that: this intro, and the
// per-item `stipulate` line that settles what is true BEFORE the candidates are
// read. Stipulating removes the reading; a warning would only ask the user to
// suppress it. (Ken, August 7 2026.)

function renderSoundCheck() {
    showDockKeyboard();
    contentEl.scrollTop = 0;
    contentEl.innerHTML = '';

    contentEl.append(el('button', { class: 'wv-back', text: '‹ All topics', onclick: renderHome }));
    contentEl.append(el('h3', { class: 'wv-page-title', text: 'How I Sound' }));

    contentEl.append(el('p', { class: 'wv-intro', text:
        'The app writes suggestions for you. These questions are how it learns to write them in your words instead of its own.' }));
    contentEl.append(el('p', { class: 'wv-intro', text:
        'Each one shows a few ways of saying the same thing. They all mean the same — only the wording is different. Pick whichever sounds most like something you would say.' }));
    contentEl.append(el('p', { class: 'wv-intro sc-disclaimer', text:
        'None of this is about you. The situations are made up, nobody is asking what you actually did, and nothing you pick is kept as a fact about your life. There are no right answers, and you can change any of them later.' }));

    // The bank has two kinds: replying to something, and starting something. Mark
    // where it changes, or the switch is silent and the first initiating item reads
    // as an item that forgot its partner turn.
    let seenInitiating = false;
    for (const item of SOUND_CHECK_ITEMS) {
        if (!item.partner && !seenInitiating) {
            seenInitiating = true;
            contentEl.append(el('h3', { class: 'wv-section-title', text: 'When you start things off' }));
            contentEl.append(el('p', { class: 'wv-intro', text:
                'These ones are not replies — nobody has said anything yet. They are for when you open a conversation, ask for something, or bring it to an end.' }));
        }
        contentEl.append(buildSoundCheckCard(item));
    }

    contentEl.append(buildHarvestSection());

    contentEl.append(el('h3', { class: 'wv-section-title', text: 'Things I never say' }));
    contentEl.append(el('p', { class: 'wv-intro', text:
        'Anything here is off limits for the app when it suggests responses — a word you dislike, swearing, saying sorry too much. Leave it empty if nothing comes to mind.' }));
    contentEl.append(buildNeverList());
}

function buildSoundCheckCard(item) {
    const saved = voiceProfile.getAnswer(item.id);
    const card = el('div', { class: 'wv-card sc-card', id: 'sc-' + item.id });

    const head = el('div', { class: 'wv-card-head' }, [
        el('div', { class: 'sc-stipulate', text: item.stipulate }),
    ]);
    if (saved) {
        const label = saved.verdict === VERDICT.CHOSE ? '✓ Answered'
            : saved.verdict === VERDICT.ALL_FINE ? 'All sound like me' : 'None of these';
        head.append(el('span', { class: 'wv-badge wv-badge-answered', text: label }));
    }
    card.append(head);

    if (item.partner) card.append(el('p', { class: 'sc-partner', text: `They said: "${item.partner}"` }));

    if (saved) {
        // Answered: show what they picked and let them redo it. Re-answering simply
        // overwrites, so there is no destructive step and no confirmation needed.
        card.append(el('p', { class: 'sc-chosen', text:
            saved.choice ? `You would say: "${saved.choice}"` : '(no preference recorded)' }));
        card.append(el('div', { class: 'wv-actions' }, [
            el('button', { class: 'wv-btn wv-btn-link', text: 'Change my answer',
                onclick: () => { voiceProfile.clearAnswer(item.id); refreshSoundCheckCard(item); } })
        ]));
        return card;
    }

    card.append(el('p', { class: 'sc-question', text: questionFor(item) }));

    for (const text of item.candidates) {
        card.append(el('div', { class: 'sc-choice-row' }, [
            el('button', { class: 'sc-choice', text,
                onclick: () => { voiceProfile.recordAnswer(item.id, VERDICT.CHOSE, text); refreshSoundCheckCard(item); } }),
            // Hearing a candidate spoken is how you judge whether you would say it —
            // this user's whole output channel is a synthesizer, so reading it on
            // screen is not the same test. Same idea as "Speak my answer" elsewhere.
            el('button', { class: 'wv-btn-speak sc-speak', text: '🔊', title: 'Hear this',
                onclick: () => speak(text) }),
        ]));
    }

    card.append(el('div', { class: 'wv-actions sc-escapes' }, [
        // The two escapes are NOT one option. "They're all fine" is a weak or absent
        // preference, recorded as such rather than as a spurious first-place vote;
        // "I wouldn't say any of these" is a negative constraint arriving unprompted,
        // and is at least as informative.
        el('button', { class: 'wv-btn', text: 'They all sound like me',
            onclick: () => { voiceProfile.recordAnswer(item.id, VERDICT.ALL_FINE); refreshSoundCheckCard(item); } }),
        el('button', { class: 'wv-btn', text: "I wouldn't say any of these",
            onclick: () => { voiceProfile.recordAnswer(item.id, VERDICT.NONE); refreshSoundCheckCard(item); } }),
    ]));

    return card;
}

// Replace one card in place. Re-rendering the whole page would lose the user's scroll
// position, which on a twelve-item list means hunting for where they were after every
// single tap.
function refreshSoundCheckCard(item) {
    const old = document.getElementById('sc-' + item.id);
    if (!old) return renderSoundCheck();
    old.replaceWith(buildSoundCheckCard(item));
}

// What reading the user's own past conversations concluded (Phase 2). Shown, and
// correctable: "here is what I think you sound like" cannot be a black box, least of
// all for people who have spent their lives having others speak on their behalf.
// Removing a line is permanent — a later re-read must not put it back.
function buildHarvestSection() {
    const wrap = el('div', { class: 'sc-harvest' });

    const removableRow = (label, onRemove, removeLabel) => el('div', { class: 'wv-entry' }, [
        el('span', { class: 'sc-harvest-text', text: label }),
        el('button', { class: 'wv-entry-remove', text: '×', title: 'Remove this',
            'aria-label': removeLabel, onclick: onRemove }),
    ]);

    const draw = () => {
        wrap.innerHTML = '';
        wrap.append(el('h3', { class: 'wv-section-title', text: 'What the app has picked up' }));

        const harvestResult = voiceProfile.getHarvest();
        const exemplars = voiceProfile.activeExemplars();
        const steers = voiceProfile.repeatedSteers();
        const lean = harvestResult && harvestResult.lengthLean;
        const anything = exemplars.length || steers.length || (lean && lean.lean !== 'neither');

        wrap.append(el('p', { class: 'wv-intro', text: anything
            ? 'Taken from your own conversations. Remove anything that does not belong — it will not come back.'
            : 'This fills up as you use the app: the words you type yourself, and any correction you find yourself asking for more than once. Nothing is read until you ask.' }));

        // Steers are recorded as they happen and do NOT depend on a harvest having
        // been run. Rendering them inside the harvest branch hid them completely
        // from anyone who had never pressed the button — found in testing.
        for (const st of steers) {
            wrap.append(removableRow(
                `You have asked for "${st.text}" ${st.count} times`,
                () => { voiceProfile.dismissExemplar(st.text); draw(); },
                `Stop using "${st.text}"`));
        }

        if (lean && lean.lean !== 'neither') {
            wrap.append(el('p', { class: 'sc-lean', text: lean.lean === 'shorter'
                ? `When you are offered a choice, you usually pick the shorter wording (${lean.shorter} times out of ${lean.shorter + lean.longer}).`
                : `When you are offered a choice, you usually pick the fuller wording (${lean.longer} times out of ${lean.shorter + lean.longer}).` }));
        }

        for (const text of exemplars) {
            wrap.append(removableRow(`"${text}"`,
                () => { voiceProfile.dismissExemplar(text); draw(); },
                `Remove "${text}"`));
        }

        wrap.append(el('button', {
            class: 'wv-btn',
            text: harvestResult ? 'Read my conversations again' : 'Read my conversations',
            onclick: async (e) => {
                e.currentTarget.disabled = true;
                try {
                    const logs = await storage.listConversationLogs();
                    voiceProfile.setHarvest(voiceHarvest.harvest(logs, {
                        // Needed to classify turns written before the source field
                        // existed: our own control phrases and the user's Express
                        // labels must not be mistaken for prose they composed.
                        // The placeholders join them: they are equally OUR words,
                        // and harvesting one as an example of how this person talks
                        // would be teaching the model its own stalling back to itself.
                        controlPhrases: [...controlPhrases.allPhrases(), ...placeholderPhrases.allPhrases()],
                        expressPhrases: expressPanel.allItems()
                            .filter((i) => i.type === 'phrase' && i.text).map((i) => i.text),
                    }));
                } catch { /* no folder, or nothing readable */ }
                draw();
            },
        }));
    };
    draw();
    return wrap;
}

function buildNeverList() {
    const wrap = el('div', { class: 'wv-entry-list sc-never' });
    // A local DRAFT, because voiceProfile.setNever() drops blanks — which is right
    // for the stored rule ("" is not something you never say) and fatal for an
    // editor, since a freshly added row would be filtered away before it could be
    // typed into. The draft holds the transient blank; only non-blanks are persisted.
    let draft = voiceProfile.getNever();
    const persist = () => voiceProfile.setNever(draft);

    const draw = () => {
        wrap.innerHTML = '';
        draft.forEach((value, i) => {
            wrap.append(el('div', { class: 'wv-entry' }, [
                el('input', {
                    class: 'wv-text', type: 'text', value,
                    'aria-label': 'Something I never say',
                    placeholder: 'e.g. swearing',
                    oninput: (e) => { draft[i] = e.target.value; },
                    onchange: persist,
                    onblur: persist,
                }),
                el('button', {
                    class: 'wv-entry-remove', text: '×', title: 'Remove',
                    'aria-label': `Remove "${value || 'this entry'}"`,
                    onclick: () => { draft.splice(i, 1); persist(); draw(); },
                }),
            ]));
        });
        const add = el('button', {
            class: 'wv-entry-add', text: '+ Add something',
            onclick: () => { draft = [...draft, '']; draw(); focusLastNeverInput(wrap); },
        });
        wrap.append(add);
    };
    draw();
    return wrap;
}

function focusLastNeverInput(wrap) {
    const inputs = wrap.querySelectorAll('input');
    const last = inputs[inputs.length - 1];
    if (last) last.focus();   // focusin brings up the on-screen keyboard if enabled
}

// --- People (relationship graph) --------------------------------------------

// People are nodes + edges (relationships.js), not questionnaire answers, so
// they get a dedicated editor. The UI edits me->person relationships; the data
// model also supports person<->person edges for later.
function renderPeople(editingId = null) {
    contentEl.innerHTML = '';

    contentEl.append(el('button', { class: 'wv-back', text: '‹ All topics', onclick: renderHome }));
    contentEl.append(el('h3', { class: 'wv-page-title', text: 'People in Your Life' }));
    contentEl.append(el('p', { class: 'wv-intro', text:
        'Add the people (and pets) who matter to you — name, how they relate to you, '
        + 'and anything worth knowing. Mark someone private and the assistant still knows about them, '
        + 'but won\'t raise them on its own: it will only offer them if the person you\'re talking to asks, '
        + 'or if you ask for it yourself in "In my own words" and tap Reframe.' }));

    const people = rel.listPeople();
    for (const p of people) {
        contentEl.append(editingId === p.id ? buildPersonForm(p) : buildPersonCard(p));
    }

    contentEl.append(el('h3', { class: 'wv-section-title', text: 'Add someone' }));
    contentEl.append(buildPersonForm(null));

    // No bottom "back to topics" button — the "‹ All topics" link at the top of
    // the page is the single, unambiguous way back (Ken, July 3 2026).

    // Restore scroll after the rebuild:
    //  - editing: bring the edit form into view (the user just tapped Edit);
    //  - returning from an edit (Save/Cancel): go back to where the list was
    //    when Edit was pressed (heights match — the form became a card again);
    //  - fresh entry from the home screen: top.
    if (editingId) {
        const form = document.getElementById('wvpersonform-' + editingId);
        if (form) form.scrollIntoView({ block: 'center' });
    } else if (peopleReturnScroll != null) {
        contentEl.scrollTop = peopleReturnScroll;
        peopleReturnScroll = null;
    } else {
        contentEl.scrollTop = 0;
    }
}

function buildPersonCard(p) {
    const card = el('div', { class: 'wv-card', id: 'wvperson-' + p.id });

    // Title line: "Name" or "Name "nickname" (Relationship)"
    const titleParts = [p.name || '(unnamed)'];
    if (p.nickname) titleParts.push(`"${p.nickname}"`);
    if (p.relationship) titleParts.push(`(${p.relationship})`);

    const head = el('div', { class: 'wv-card-head' }, [
        el('div', { class: 'wv-question', text: titleParts.join(' ') })
    ]);
    if (p.private) head.append(el('span', { class: 'wv-badge wv-badge-private', text: '🔒 Private' }));
    card.append(head);

    // Attribute tags (lives with me, etc.)
    if (p.livesWithMe) {
        card.append(el('div', { class: 'wv-person-tags' }, [
            el('span', { class: 'wv-person-tag wv-person-tag-lives', text: '🏠 Lives with me' })
        ]));
    }

    if (p.about) card.append(el('p', { class: 'wv-person-about', text: p.about }));

    card.append(el('div', { class: 'wv-actions' }, [
        el('button', { class: 'wv-btn wv-btn-link', text: 'Edit',
            onclick: () => { peopleReturnScroll = contentEl.scrollTop; renderPeople(p.id); } }),
        el('button', { class: 'wv-btn wv-btn-link', text: 'Remove',
            onclick: async () => {
                const ok = await confirmDanger({
                    title: `Remove ${p.name || 'this person'}?`,
                    body: 'This removes them and your relationship from your profile. This cannot be undone.',
                    confirmLabel: 'Remove',
                    cancelLabel: 'Cancel'
                });
                if (!ok) return;
                await rel.removePerson(p.id);
                renderPeople();
            } })
    ]));
    return card;
}

// Standard relationships offered in the People editor, grouped for scanning.
// "Other…" reveals a free-text field. One relationship per person for now
// (the data model stores a single me->person edge); multiple relationships
// with one person — e.g. "cousin" + "wife" — is a deliberate later refinement.
const REL_GROUPS = [
    { label: 'Family', items: ['Mother', 'Father', 'Sister', 'Brother', 'Daughter', 'Son', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Cousin', 'Niece', 'Nephew'] },
    { label: 'Partner', items: ['Wife', 'Husband', 'Partner'] },
    { label: 'Friends & social', items: ['Friend', 'Close friend', 'Best friend', 'Roommate', 'Neighbor', 'Classmate', 'Coworker'] },
    { label: 'Care & support', items: ['Caregiver', 'Support worker', 'Teacher', 'Boss', 'Doctor', 'Therapist'] },
    { label: 'Pet', items: ['Pet'] }
];
const REL_KNOWN = new Set(REL_GROUPS.flatMap((g) => g.items.map((s) => s.toLowerCase())));
const OTHER = '__other__';

/**
 * "How I talk with them" — the per-partner profile (Phase 3), collapsed by default.
 *
 * Collapsed because it is optional depth on a form that already has seven fields:
 * someone adding a person should not have to scroll past register dimensions to
 * reach Save. Everything in here defaults to neutral/empty, so a person whose
 * section is never opened behaves exactly as before.
 *
 * Returns { node, read } — `read` is called by the form's Save so the profile is
 * written in the same action, including for a person who does not exist yet.
 */
/**
 * THE GOAL LIST EDITOR, shared by the three places a goal list is kept: a person
 * (About Me → People), a place (My Places) and the general list (About Me → Goals).
 *
 * One editor because they are one kind of thing. Every goal is equivalent, ordered by
 * the user, and more than one can be switched on at once (Ken, September 10 2026) - so
 * there is nothing about a person's goals that makes them edited differently from a
 * place's, and three copies of an add/reorder/remove list would drift.
 *
 * ⚠ A LIST EDITOR HERE, AND A TEXTAREA FOR THE PHRASE LISTS, WHICH LOOKS INCONSISTENT
 * AND IS NOT. Phrases are free text, so one per line gives add, remove and reorder for
 * nothing. A goal is a MENU pick - chosen from twelve, fast, which is the whole reason
 * the menu exists for this user - and a textarea would throw the menu away. So the
 * weight of add/move/remove is earned here and is not earned there.
 *
 * Returns { node, read }. `read()` builds the list on demand; `opts.onChange` is how a
 * caller COMMITS it, and every caller now passes one.
 *
 * ⚠ ADDING A GOAL MUST SAVE IT, because the row that appears looks saved (Ken,
 * September 10 2026: *"I add several goals and those should automatically save as I add
 * them"*). A goal arrives as a numbered entry in a list - which is the appearance of a
 * list you have added to - and it used to live only in this object until somebody
 * pressed a Save button further down the form. **The button's position was the smaller
 * half of that fault**: pinned at the top it would still have left the screen saying
 * "added" about something that was not, which is a false affordance rather than a
 * discovery problem, and no placement fixes a false affordance.
 */
function buildGoalEditor(saved, opts = {}) {
    const placeholder = opts.placeholder || 'What you want';
    // Every mutation goes through this, so a caller wires ONE callback rather than
    // six - and a seventh kind of mutation added later cannot forget to save.
    const changed = () => { if (opts.onChange) opts.onChange(); };
    let goals = Array.isArray(saved) ? saved.map((g) => ({ ...g })) : [];
    const goalList = el('div', { class: 'wv-goal-list' });

    const goalAdd = el('select', { class: 'wv-select' });
    const fillAdd = () => {
        goalAdd.textContent = '';
        goalAdd.append(el('option', { value: '' }, 'Add a goal…'));
        for (const g of RELATIONSHIP_GOALS) {
            // Already chosen? Leave it out rather than showing it and refusing: an
            // option that does nothing when picked reads as the control being broken.
            if (goals.some((x) => x.id === g.id)) continue;
            goalAdd.append(el('option', { value: g.id }, g.text));
        }
        goalAdd.append(el('option', { value: OTHER }, 'Something else…'));
    };

    const goalOther = el('input', { type: 'text', class: 'wv-text', placeholder });
    const goalOtherAdd = el('button', { type: 'button', class: 'wv-btn' }, 'Add');
    const goalOtherWrap = el('div', { class: 'wv-rel-other' }, [goalOther, goalOtherAdd]);
    const syncOther = () => { goalOtherWrap.style.display = goalAdd.value === OTHER ? '' : 'none'; };

    const renderGoals = () => {
        goalList.textContent = '';
        goals.forEach((g, i) => {
            const up = el('button', { type: 'button', class: 'wv-icon-btn',
                'aria-label': 'Move up' }, '↑');
            const down = el('button', { type: 'button', class: 'wv-icon-btn',
                'aria-label': 'Move down' }, '↓');
            const del = el('button', { type: 'button', class: 'wv-icon-btn',
                'aria-label': 'Remove this goal' }, '✕');
            // Disabled at the ends rather than a no-op: a button that does nothing
            // when pressed is indistinguishable from one that is not working.
            if (i === 0) up.disabled = true;
            if (i === goals.length - 1) down.disabled = true;
            up.addEventListener('click', () => {
                [goals[i - 1], goals[i]] = [goals[i], goals[i - 1]];
                renderGoals(); changed();
            });
            down.addEventListener('click', () => {
                [goals[i + 1], goals[i]] = [goals[i], goals[i + 1]];
                renderGoals(); changed();
            });
            del.addEventListener('click', () => {
                goals.splice(i, 1);
                fillAdd(); syncOther(); renderGoals(); changed();
            });
            const cells = [
                // The number is what makes the order visible as an order. Without it
                // this is a list whose sequence the user cannot see the point of.
                el('span', { class: 'wv-goal-rank', 'aria-hidden': 'true', text: (i + 1) + '.' }),
                el('span', { class: 'wv-goal-text', text: goalText(g) }),
            ];
            // A BUTTON FACE, AND ONLY FOR A GOAL THE USER TYPED. The twelve carry
            // their own short label in code, so asking for one would be asking the
            // user to rename something already named - and a wording change in a
            // later release would never reach a name they had typed over it.
            //
            // A typed goal has no label at all, and the face falls back to the whole
            // sentence, which an Express Panel cell cannot hold: on a three-column
            // side dock a cell is about nine characters wide. So this is the box that
            // makes a typed goal usable as a button rather than as an ellipsis.
            //
            // Committed on every keystroke and NOT re-rendered, so the field keeps
            // focus while it is typed in - the same arrangement as the phrase fields.
            if (!g.id) {
                const face = el('input', { type: 'text', class: 'wv-text wv-goal-label',
                    placeholder: 'Button label', 'aria-label': 'Short label for this goal\'s button' });
                face.value = g.label || '';
                face.addEventListener('input', () => { g.label = face.value; });
                // Committed when the field is LEFT, not on every keystroke: this is
                // the one control here that is typed rather than picked, and writing
                // the whole graph per character would be a file write per character.
                // Done commits as well, so a label typed and never blurred still lands.
                face.addEventListener('change', changed);
                cells.push(face);
            }
            cells.push(up, down, del);
            goalList.append(el('div', { class: 'wv-goal-row' }, cells));
        });
    };

    const addGoal = (g) => {
        goals.push(g);
        goalAdd.value = '';
        fillAdd(); syncOther(); renderGoals(); changed();
    };
    goalAdd.addEventListener('change', () => {
        const v = goalAdd.value;
        if (!v) return;
        if (v === OTHER) { syncOther(); goalOther.focus(); return; }
        addGoal({ id: v });
    });
    goalOtherAdd.addEventListener('click', () => {
        const t = goalOther.value.trim();
        if (!t) return;
        goalOther.value = '';
        addGoal({ id: '', text: t });
    });

    fillAdd();
    syncOther();
    renderGoals();

    return {
        node: el('div', { class: 'wv-goal-editor' }, [goalList, goalAdd, goalOtherWrap]),
        count: () => goals.length,
        read: () => {
            // A goal typed but not added is taken anyway, at the end. Losing something
            // the user has visibly typed because they did not press the right button is
            // the worse failure of the two.
            const pending = goalOther.value.trim();
            return pending ? goals.concat([{ id: '', text: pending }]) : goals.slice();
        },
    };
}

function buildPartnerProfileSection(existing, opts = {}) {
    const saved = existing ? rel.getPartnerProfile(existing.id) : null;
    // As above: one callback for the whole section. A select or a checkbox commits the
    // moment it changes; anything typed commits when the field is left.
    const changed = () => { if (opts.onChange) opts.onChange(); };

    // Register: one select per dimension, each relative to the user's own baseline.
    // "Same as usual" is the default and emits nothing at all downstream.
    const dimSelects = new Map();
    const dimRows = REGISTER_DIMENSIONS.map((dim) => {
        const sel = el('select', { class: 'wv-select wv-dim-select' });
        sel.append(el('option', { value: '' }, 'Same as usual'));
        sel.append(el('option', { value: dim.low.value }, dim.low.label));
        sel.append(el('option', { value: dim.high.value }, dim.high.label));
        if (saved && saved.register && saved.register[dim.key]) sel.value = saved.register[dim.key];
        sel.addEventListener('change', changed);
        dimSelects.set(dim.key, sel);
        return el('label', { class: 'wv-dim-row' }, [
            el('span', { class: 'wv-dim-label', text: dim.label }), sel
        ]);
    });

    // Standing relationship goals — what they want from the relationship over time,
    // not from one conversation. The list editor is shared with the other two places
    // a goal list is kept (a place, and the general list) - see buildGoalEditor.
    const goalEd = buildGoalEditor(saved && saved.goals, {
        placeholder: 'What you want from this relationship',
        onChange: changed,
    });

    const noteIn = el('input', { type: 'text', class: 'wv-text',
        placeholder: 'Anything else about how you talk with them (optional)',
        value: saved ? saved.note : '' });
    noteIn.addEventListener('change', changed);

    // Their own starters and closings. One per line rather than a full list editor:
    // these ADD to the global lists and are usually one or two phrases, so the
    // weight of an add/reorder/delete editor is not earned here. The global lists
    // keep theirs on Settings -> Controls.
    const linesOf = (arr) => (arr || []).join('\n');
    const openersIn = el('textarea', { class: 'wv-text wv-phrase-lines', rows: '2',
        placeholder: 'Conversation starters for them — one per line' });
    openersIn.value = saved ? linesOf(saved.openers) : '';
    const windIn = el('textarea', { class: 'wv-text wv-phrase-lines', rows: '2',
        placeholder: 'Ways to wind down with them — one per line' });
    windIn.value = saved ? linesOf(saved.windDowns) : '';
    const closeIn = el('textarea', { class: 'wv-text wv-phrase-lines', rows: '2',
        placeholder: 'Goodbyes for them — one per line' });
    closeIn.value = saved ? linesOf(saved.closings) : '';
    for (const box of [openersIn, windIn, closeIn]) box.addEventListener('change', changed);

    const splitLines = (v) => v.split('\n').map((s) => s.trim()).filter(Boolean);

    // The summary has to LOOK like something that opens. It did not: `display: flex`
    // on a <summary> removes the browser's own disclosure triangle, so this was bold
    // text with no affordance of any kind, and everything inside it — including the
    // per-person conversation starters — was invisible to anyone who did not already
    // know it was there (Ken went looking for them and could not find them, August 9
    // 2026). So the marker is here an element we draw ourselves rather than the one
    // the UA drops.
    //
    // NO SECOND LINE explaining what is inside (Ken, August 11 2026): that is
    // per-control help text on screen, which Rule 14 sends to the manuals, and the
    // spoken "?" is what says what a section is for.
    // ⚠ GOALS GET THEIR OWN SECTION (Ken, September 10 2026: "Conversational goals are
    // now buried in the 'How I talk to them' section. I'd like you to raise the
    // visibility of goals to its own section").
    //
    // They had been one control among ten inside a closed disclosure, which put the
    // one thing that steers WHAT the user says behind the same triangle as the things
    // that steer how it is worded. Making it a list of its own made that worse rather
    // than better: it grew from a single dropdown to a list with its own buttons,
    // deeper inside a section about something else.
    //
    // TITLED FOR THE RELATIONSHIP, NOT FOR "GOALS", and the reason is a distinction
    // worth keeping visible: what is built here is the STANDING goal - what the user
    // wants from knowing this person over time. The per-conversation goal is a
    // separate, unbuilt thing that will want its own control, and a section called
    // "My goals" would leave no room to tell them apart.
    const goalsNode = el('details', { class: 'wv-partner-profile' }, [
        el('summary', { class: 'wv-disclosure' }, [
            el('span', { class: 'wv-disclosure-mark', 'aria-hidden': 'true', text: '›' }),
            el('span', { class: 'wv-disclosure-title', text: 'What I want from this relationship' }),
        ]),
        goalEd.node
    ]);

    const node = el('details', { class: 'wv-partner-profile' }, [
        el('summary', { class: 'wv-disclosure' }, [
            el('span', { class: 'wv-disclosure-mark', 'aria-hidden': 'true', text: '›' }),
            el('span', { class: 'wv-disclosure-title', text: 'How I talk with them' }),
        ]),
        el('div', { class: 'wv-dim-grid' }, dimRows),
        noteIn,
        openersIn, windIn, closeIn
    ]);

    // Open on edit when there is something inside, so a saved profile is not invisible
    // behind a closed triangle. Judged PER SECTION now that there are two: opening the
    // wording section because a goal is set would put the user in front of the wrong
    // controls, and leaving the goals section shut because only wording is set would
    // hide the goals again.
    if (saved && saved.goals.length) goalsNode.open = true;
    if (saved && (Object.keys(saved.register).length || saved.note ||
        saved.openers.length || saved.windDowns.length || saved.closings.length)) {
        node.open = true;
    }

    const read = () => {
        const register = {};
        for (const [key, sel] of dimSelects) if (sel.value) register[key] = sel.value;
        return {
            register, goals: goalEd.read(),
            note: noteIn.value.trim(),
            openers: splitLines(openersIn.value),
            windDowns: splitLines(windIn.value),
            closings: splitLines(closeIn.value)
        };
    };

    return { goalsNode, node, read };
}

// Edit form for an existing person, or the blank "add someone" form when
// `existing` is null.
function buildPersonForm(existing) {
    const card = el('div', { class: 'wv-card wv-person-form',
        id: existing ? 'wvpersonform-' + existing.id : null });

    const nameIn = el('input', { type: 'text', class: 'wv-text', placeholder: 'Name',
        value: existing ? existing.name : '' });

    const nicknameIn = el('input', { type: 'text', class: 'wv-text',
        placeholder: 'What you call them — optional (Mom, J.J., Grandpa…)',
        value: existing ? existing.nickname : '' });

    // How the voice should SAY the name, when it gets it wrong. Respelling it works
    // (measured on the paid voice, August 8 2026): "Shiv-awn" for Siobhan.
    //   The 🔊 is not optional decoration — you cannot tune a respelling you cannot
    // hear, so the field and the ear have to sit together.
    //   Name and nickname are separate because they are separate words, and the
    // NICKNAME is the one spoken more often: the conversation openers use it in
    // preference to the name.
    //
    // ⚠ AN EMPTY BOX FALLS BACK TO THE WORD IT IS ABOUT (Ken, August 25 2026), and
    // that is what makes the button useful BEFORE anything has been typed rather than
    // only after. It used to speak the respelling and nothing else, so on an empty box
    // it did nothing at all — which is exactly the moment you need it: you have to
    // hear the voice get the name wrong to know whether a respelling is worth writing.
    // So each row asks its own question in turn: "say it this way if I have told you
    // how, otherwise just say it" — the name row falls back to the name, the
    // nickname row to the nickname. Each falls back to its OWN word, never across, or
    // the nickname button would answer a question nobody asked.
    //   Both read the LIVE fields rather than values captured when the form was drawn,
    // so a name typed a moment ago is what you hear.
    const sayAs = (getValue, getFallback, placeholder, initial) => {
        // data-no-predict: a respelling is a deliberate misspelling, so completing it
        // to a real word is the opposite of helpful. See predictionOff in keyboard.js.
        const inp = el('input', { type: 'text', class: 'wv-text wv-say-as',
            'data-no-predict': '', placeholder, value: initial || '' });
        const hear = el('button', { class: 'wv-btn-speak wv-say-as-hear', text: '🔊',
            title: 'Hear it said', 'aria-label': 'Hear it said',
            onclick: () => {
                const v = getValue().trim() || getFallback().trim();
                if (v) speak(v);
            } });
        return { row: el('div', { class: 'wv-say-as-row' }, [inp, hear]), inp };
    };

    const namePron = sayAs(() => namePron.inp.value, () => nameIn.value,
        'How to say the name — only if the voice gets it wrong',
        existing ? existing.pronunciation : '');
    const nickPron = sayAs(() => nickPron.inp.value, () => nicknameIn.value,
        'How to say what you call them — only if needed',
        existing ? existing.nicknamePronunciation : '');

    // Relationship — standard list + "Other…" (free text).
    const relSelect = el('select', { class: 'wv-select' });
    relSelect.append(el('option', { value: '' }, 'Relationship…'));
    for (const g of REL_GROUPS) {
        const og = el('optgroup', { label: g.label });
        for (const it of g.items) og.append(el('option', { value: it }, it));
        relSelect.append(og);
    }
    relSelect.append(el('option', { value: OTHER }, 'Other…'));

    const otherIn = el('input', { type: 'text', class: 'wv-text', placeholder: 'Relationship (your words)' });
    const otherWrap = el('div', { class: 'wv-rel-other' }, [otherIn]);
    const syncOther = () => { otherWrap.style.display = relSelect.value === OTHER ? '' : 'none'; };
    relSelect.addEventListener('change', syncOther);

    if (existing && existing.relationship) {
        const r = existing.relationship;
        if (REL_KNOWN.has(r.toLowerCase())) {
            relSelect.value = REL_GROUPS.flatMap((g) => g.items).find((s) => s.toLowerCase() === r.toLowerCase());
        } else {
            relSelect.value = OTHER;
            otherIn.value = r;
        }
    }
    syncOther();
    const getRelationship = () => (relSelect.value === OTHER ? otherIn.value.trim() : relSelect.value);

    const aboutIn = el('input', { type: 'text', class: 'wv-text', placeholder: 'Anything worth knowing (optional)',
        value: existing ? existing.about : '' });

    const livesId = 'wvlives-' + (existing ? existing.id : 'new');
    const livesCheck = el('input', { type: 'checkbox', id: livesId });
    if (existing && existing.livesWithMe) livesCheck.checked = true;
    const livesRow = el('label', { class: 'wv-person-checkbox-row', for: livesId }, [
        livesCheck, el('span', { text: 'Lives with me' })
    ]);

    const privId = 'wvpriv-' + (existing ? existing.id : 'new');
    const privCheck = el('input', { type: 'checkbox', id: privId });
    if (existing && existing.private) privCheck.checked = true;
    const privRow = el('label', { class: 'wv-person-checkbox-row', for: privId }, [
        privCheck, el('span', { text: 'Private — AI knows but won\'t bring them up unprompted' })
    ]);

    /**
     * EDITING AN EXISTING PERSON SAVES AS YOU GO; ADDING ONE STILL HAS A BUTTON
     * (Ken, September 10 2026: *"why is there a Save button at all"*).
     *
     * The button existed because ONE form serves both jobs, and on the create path
     * there is genuinely nothing to write into until the record exists. That reason
     * belongs to the create path and was only ever BORROWED by the edit path, which
     * is where it stopped being a reason - so the edit path gives it back.
     *
     * ⚠ WHAT IS GIVEN UP, STATED ONCE: Cancel. On an edit it used to discard
     * everything typed, and it cannot survive saving as you go. Judged worth it
     * because the rest of the app already works this way - the Express Panel editor
     * commits on every keystroke and offers Done, and every About Me card saves
     * itself - so this makes People and Places agree with the app instead of being
     * the two screens that do not. The edits are also trivially redone, and the one
     * genuinely destructive action here (Remove person) still asks first.
     *
     * ⚠ AND THE ONE THING AUTO-SAVE MUST NOT DO: blank a name. Walking away from an
     * emptied name box would otherwise erase it, which is deleting a person's
     * identity by accident. A rename still works, because the new name commits when
     * it is typed; deleting a person is what Remove is for.
     */
    async function commitNow() {
        if (!existing) return;
        const name = nameIn.value.trim();
        const relationship = getRelationship();
        if (!name && !relationship) return;   // nothing to save yet
        await rel.updatePerson(existing.id, {
            name: name || existing.name,
            relationship,
            about: aboutIn.value.trim(),
            nickname: nicknameIn.value.trim(),
            pronunciation: namePron.inp.value.trim(),
            nicknamePronunciation: nickPron.inp.value.trim(),
            livesWithMe: livesCheck.checked,
            isPrivate: privCheck.checked
        });
        await rel.setPartnerProfile(existing.id, profile.read());
    }

    const profile = buildPartnerProfileSection(existing, { onChange: commitNow });

    // Discrete controls commit at once; typed fields commit when they are left. Done
    // commits again, so nothing typed and never blurred is lost either way.
    if (existing) {
        for (const box of [nameIn, nicknameIn, aboutIn, otherIn, namePron.inp, nickPron.inp]) {
            box.addEventListener('change', commitNow);
        }
        for (const c of [relSelect, livesCheck, privCheck]) c.addEventListener('change', commitNow);
    }

    // Each "how to say it" sits directly under the field it corrects, so there is
    // never a question about which name it applies to.
    card.append(el('div', { class: 'wv-person-fields' },
        [nameIn, namePron.row, nicknameIn, nickPron.row, relSelect, otherWrap, aboutIn, livesRow, privRow]));
    card.append(profile.goalsNode, profile.node);

    const save = el('button', { class: 'wv-btn wv-btn-primary', text: existing ? 'Done' : 'Add person',
        onclick: async () => {
            if (existing) {
                await commitNow();
                renderPeople();
                return;
            }
            const name = nameIn.value.trim();
            const relationship = getRelationship();
            if (!name && !relationship) return;   // nothing to save
            // A new person has no id until they exist, so the profile is written
            // second — the section is read from the DOM either way, so nothing
            // typed into it is lost by the ordering.
            const id = await rel.addPerson({
                name, relationship,
                about: aboutIn.value.trim(),
                nickname: nicknameIn.value.trim(),
                pronunciation: namePron.inp.value.trim(),
                nicknamePronunciation: nickPron.inp.value.trim(),
                livesWithMe: livesCheck.checked,
                isPrivate: privCheck.checked
            });
            await rel.setPartnerProfile(id, profile.read());
            renderPeople();
        } });

    // NO CANCEL ON EITHER PATH NOW. On an edit there is nothing left for it to
    // discard, and a Cancel that cannot undo anything is worse than none - it
    // promises a way back that does not exist. And it does not move to the create
    // form: that one is a permanent blank form at the foot of the list rather than
    // something you enter, so there is nothing to cancel out of - which is why it
    // never had one.
    card.append(el('div', { class: 'wv-actions' }, [save]));
    return card;
}

// --- My Places (places + arbitrary facts) -----------------------------------

// Places are a name plus ARBITRARY NAMED FACTS (places.js), not questionnaire
// answers: what is worth knowing about a coffee shop, a clinic and a cousin's house
// have almost nothing in common, so there is no fixed field set to ask about. The
// editor is therefore a name + as many key/value rows as the user wants.
//
// Suggested fact names only — offered through a datalist so they are quick to pick
// and equally quick to ignore. Ken's own example ("Location: 123 Main Street") leads,
// with the note that it belongs only when the place is one specific branch.
const FACT_SUGGESTIONS = [
    'Location', 'Address', 'What I usually order', 'Who I go with', 'How I get there',
    'People I know there', 'What I do there', 'Best time to go', 'Parking', 'Notes'
];

/**
 * THE GENERAL GOAL LIST - goals the user can switch on with anyone, anywhere.
 *
 * The third source of a conversation goal, and the one neither the person nor the
 * place can supply: somebody the user has never met, a counter they will not see
 * again, or simply what they came to this conversation to do. Without it, a goal
 * button could only ever appear for a person already in About Me - which leaves the
 * transactional half of the user's life, the half this app was built to widen, with
 * no way to say what the exchange is for.
 *
 * Saved on every change rather than behind a Save button, because there is no other
 * field on this screen for a Save button to belong to.
 */
function renderGeneralGoals() {
    contentEl.innerHTML = '';
    contentEl.append(el('button', { class: 'wv-back', text: '‹ All topics', onclick: renderHome }));
    contentEl.append(el('h3', { class: 'wv-page-title', text: 'Goals For Any Conversation' }));
    contentEl.append(el('p', { class: 'wv-intro', text:
        'These appear as buttons in the Express Panel whichever person or place you '
        + 'have picked - or none at all. Tap one during a conversation and the app '
        + 'suggests responses with that goal in mind. Nothing here is ever said out loud.' }));

    const card = el('div', { class: 'wv-card' });
    // ⚠ THE COMMENT ABOVE SAID THIS ALREADY AND THE CODE DID NOT: there was a Save
    // button here, on a screen the comment itself says has nothing for one to belong
    // to. Now it does what it always claimed - and the status line stays, because with
    // no button to press it is the only thing that says the goal was kept.
    const status = el('div', { class: 'wv-module-meta', 'aria-live': 'polite' });
    const ed = buildGoalEditor(rel.getGeneralGoals(), {
        placeholder: 'What you want out of a conversation',
        onChange: async () => {
            await rel.setGeneralGoals(ed.read());
            status.textContent = 'Saved.';
        },
    });
    card.append(ed.node);
    card.append(status);
    contentEl.append(card);
}

function renderPlaces(editingId = null) {
    contentEl.innerHTML = '';

    contentEl.append(el('button', { class: 'wv-back', text: '‹ All topics', onclick: renderHome }));
    contentEl.append(el('h3', { class: 'wv-page-title', text: 'My Places' }));
    contentEl.append(el('p', { class: 'wv-intro', text:
        'Add the places you go, and anything worth knowing about each one. In a conversation '
        + 'you can tap a place in the Express Panel to say "I\'m here right now", and the assistant '
        + 'will suggest responses that fit where you are. Mark a place private and the assistant '
        + 'still knows about it, but won\'t raise it on its own: it will only offer it if the person '
        + 'you\'re talking to asks, or if you ask for it yourself in "In my own words" and tap Reframe.' }));

    // Shared datalist of suggested fact names for every row on the page.
    const dl = el('datalist', { id: 'wv-fact-suggestions' });
    for (const s of FACT_SUGGESTIONS) dl.append(el('option', { value: s }));
    contentEl.append(dl);

    for (const p of places.listPlaces()) {
        contentEl.append(editingId === p.id ? buildPlaceForm(p) : buildPlaceCard(p));
    }

    contentEl.append(el('h3', { class: 'wv-section-title', text: 'Add a place' }));
    contentEl.append(buildPlaceForm(null));

    // Same scroll discipline as the People list: editing brings the form into view,
    // returning from an edit restores where the list was, a fresh entry starts at top.
    if (editingId) {
        const form = document.getElementById('wvplaceform-' + editingId);
        if (form) form.scrollIntoView({ block: 'center' });
    } else if (placesReturnScroll != null) {
        contentEl.scrollTop = placesReturnScroll;
        placesReturnScroll = null;
    } else {
        contentEl.scrollTop = 0;
    }
}

function buildPlaceCard(p) {
    const card = el('div', { class: 'wv-card', id: 'wvplace-' + p.id });

    const head = el('div', { class: 'wv-card-head' }, [
        el('div', { class: 'wv-question', text: p.name || '(unnamed place)' })
    ]);
    if (p.private) head.append(el('span', { class: 'wv-badge wv-badge-private', text: '🔒 Private' }));
    card.append(head);

    if (p.facts.length) {
        const list = el('div', { class: 'wv-fact-list' });
        for (const f of p.facts) {
            list.append(el('div', { class: 'wv-fact' }, [
                el('span', { class: 'wv-fact-key', text: f.key }),
                el('span', { class: 'wv-fact-value', text: f.value })
            ]));
        }
        card.append(list);
    }

    card.append(el('div', { class: 'wv-actions' }, [
        el('button', { class: 'wv-btn wv-btn-link', text: 'Edit',
            onclick: () => { placesReturnScroll = contentEl.scrollTop; renderPlaces(p.id); } }),
        el('button', { class: 'wv-btn wv-btn-link', text: 'Remove',
            onclick: async () => {
                const ok = await confirmDanger({
                    title: `Remove ${p.name || 'this place'}?`,
                    body: 'This removes the place and everything you recorded about it. This cannot be undone.',
                    confirmLabel: 'Remove',
                    cancelLabel: 'Cancel'
                });
                if (!ok) return;
                await places.removePlace(p.id);
                renderPlaces();
            } })
    ]));
    return card;
}

// Edit form for an existing place, or the blank "add a place" form when
// `existing` is null. Fact rows are added and removed live; the current field
// values are read back into the draft before every rebuild so nothing typed is lost
// when a row is added or removed mid-entry.
function buildPlaceForm(existing) {
    const card = el('div', { class: 'wv-card wv-place-form',
        id: existing ? 'wvplaceform-' + existing.id : null });

    const nameIn = el('input', { type: 'text', class: 'wv-text', placeholder: 'Place (e.g. Starbucks)',
        value: existing ? existing.name : '' });

    // How to say the place, when the voice gets it wrong — same shape as a person's
    // name, and for the same reason: place names are exactly the kind of word a
    // synthesiser mangles (local, foreign, or a coined brand). Blank means "say it as
    // written", and the 🔊 is what makes a respelling tunable.
    const pronIn = el('input', { type: 'text', class: 'wv-text wv-say-as',
        'data-no-predict': '',
        placeholder: 'How to say it — only if the voice gets it wrong',
        value: existing ? existing.pronunciation : '' });
    // Empty box falls back to the place name, for the same reason as a person's
    // (Ken, August 25 2026): you have to hear the voice get it wrong before you know
    // whether writing a respelling is worth the effort, and until you have written one
    // there is nothing for this button to say.
    const pronHear = el('button', { class: 'wv-btn-speak wv-say-as-hear', text: '🔊',
        title: 'Hear it said', 'aria-label': 'Hear it said',
        onclick: () => {
            const v = pronIn.value.trim() || nameIn.value.trim();
            if (v) speak(v);
        } });
    const pronRow = el('div', { class: 'wv-say-as-row' }, [pronIn, pronHear]);

    // One blank row to start, so the first fact costs no extra tap.
    let draft = existing && existing.facts.length
        ? existing.facts.map((f) => ({ ...f }))
        : [{ key: '', value: '' }];

    const factsWrap = el('div', { class: 'wv-facts' });

    // Read what is currently typed back into the draft, so add/remove never discards it.
    const syncDraft = () => {
        const rows = factsWrap.querySelectorAll('.wv-fact-row');
        draft = [...rows].map((row) => ({
            key: row.querySelector('.wv-fact-key-input').value,
            value: row.querySelector('.wv-fact-value-input').value
        }));
    };

    const renderFacts = () => {
        factsWrap.innerHTML = '';
        draft.forEach((f, i) => {
            const keyIn = el('input', { type: 'text', class: 'wv-text wv-fact-key-input',
                placeholder: 'What (e.g. favorite drink)', value: f.key, list: 'wv-fact-suggestions' });
            const valIn = el('input', { type: 'text', class: 'wv-text wv-fact-value-input',
                placeholder: 'Is (e.g. mocha latte)', value: f.value });
            const del = el('button', { class: 'wv-fact-del', text: '✕',
                'aria-label': 'Remove this fact', title: 'Remove this fact',
                onclick: async () => {
                    syncDraft(); draft.splice(i, 1);
                    if (!draft.length) draft.push({ key: '', value: '' });
                    renderFacts(); await commitPlaceNow();
                } });
            // Typed, so committed when the field is left rather than per character.
            if (existing) for (const b of [keyIn, valIn]) b.addEventListener('change', commitPlaceNow);
            factsWrap.append(el('div', { class: 'wv-fact-row' }, [keyIn, valIn, del]));
        });
    };
    renderFacts();

    const addFact = el('button', { class: 'wv-btn wv-btn-link', text: '+ Add a fact',
        onclick: () => { syncDraft(); draft.push({ key: '', value: '' }); renderFacts();
            factsWrap.querySelector('.wv-fact-row:last-child .wv-fact-key-input')?.focus(); } });

    // WHAT THIS VISIT IS FOR - the transactional half of the conversation-goal layer.
    // At a pharmacy, a clinic or a counter the other person is present as a ROLE
    // rather than as somebody the user knows, so the goal comes from what the place is
    // for and there is no relationship to hang it on (Ken + Claude, August 5 2026).
    //
    // Collapsed, like the per-partner profile and for the same reason: it is optional
    // depth on a form somebody may only want to put a name into.
    // Saved as it is edited, exactly as a person is - see the long note on
    // commitNow in buildPersonForm for why, and for what that gives up.
    async function commitPlaceNow() {
        if (!existing) return;
        syncDraft();
        const name = nameIn.value.trim();
        await places.updatePlace(existing.id, {
            // A place with no name cannot be shown or referred to, so an emptied box
            // keeps the name it had rather than erasing it. Renaming still works.
            name: name || existing.name,
            pronunciation: pronIn.value.trim(),
            facts: draft,
            goals: goalEd.read(),
            isPrivate: privCheck.checked
        });
    }

    const goalEd = buildGoalEditor(existing && existing.goals, {
        placeholder: 'What you are usually here to do',
        onChange: commitPlaceNow,
    });
    const goalsNode = el('details', { class: 'wv-partner-profile' }, [
        el('summary', { class: 'wv-disclosure' }, [
            el('span', { class: 'wv-disclosure-mark', 'aria-hidden': 'true', text: '›' }),
            el('span', { class: 'wv-disclosure-title', text: 'What I come here to do' }),
        ]),
        goalEd.node
    ]);
    if (existing && existing.goals && existing.goals.length) goalsNode.open = true;

    const privId = 'wvplacepriv-' + (existing ? existing.id : 'new');
    const privCheck = el('input', { type: 'checkbox', id: privId });
    if (existing && existing.private) privCheck.checked = true;
    const privRow = el('label', { class: 'wv-person-checkbox-row', for: privId }, [
        privCheck, el('span', { text: 'Private — AI knows but won\'t bring it up unprompted' })
    ]);

    card.append(el('div', { class: 'wv-person-fields' },
        [nameIn, pronRow, factsWrap, addFact, goalsNode, privRow]));

    if (existing) {
        for (const box of [nameIn, pronIn]) box.addEventListener('change', commitPlaceNow);
        privCheck.addEventListener('change', commitPlaceNow);
    }

    const save = el('button', { class: 'wv-btn wv-btn-primary', text: existing ? 'Done' : 'Add place',
        onclick: async () => {
            if (existing) {
                await commitPlaceNow();
                renderPlaces();
                return;
            }
            syncDraft();
            const name = nameIn.value.trim();
            if (!name) return;   // a place with no name can't be shown or referred to
            await places.addPlace({
                name,
                pronunciation: pronIn.value.trim(),
                facts: draft,          // places.js drops the blank rows
                goals: goalEd.read(),
                isPrivate: privCheck.checked
            });
            renderPlaces();
        } });

    // See buildPersonForm: nothing left for a Cancel to discard on an edit, and the
    // create form is the permanent blank one at the foot of the list.
    card.append(el('div', { class: 'wv-actions' }, [save]));
    return card;
}

// --- Module (a chunk of cards) ----------------------------------------------

function renderModule(moduleId, focusKey = null) {
    const mod = wv.getRegistry().modules.find((m) => m.id === moduleId);
    if (!mod) return renderHome();

    contentEl.scrollTop = 0;
    contentEl.innerHTML = '';

    contentEl.append(el('button', { class: 'wv-back', text: '‹ All topics', onclick: renderHome }));
    contentEl.append(el('h3', { class: 'wv-page-title', text: mod.title }));

    // Show module-level note if present (e.g. the "Private by default" notice on A5)
    if (mod.note) {
        contentEl.append(el('p', { class: 'wv-module-note', text: '🔒 ' + mod.note }));
    }

    for (const field of mod.fields) {
        contentEl.append(buildCard(field));
    }
    // No bottom "back to topics" button — the "‹ All topics" link at the top of
    // the page is the single, unambiguous way back (Ken, July 3 2026).

    // Deep-link from the gaps section: jump to a specific field's card and focus
    // it, rather than the module's first field.
    if (focusKey) {
        const card = document.getElementById('wvcard-' + focusKey);
        if (card) {
            card.scrollIntoView({ block: 'center' });
            focusFirstField(card);
            return;
        }
    }
    focusFirstField();
}

function refreshCard(field) {
    const old = document.getElementById('wvcard-' + field.key);
    if (old) old.replaceWith(buildCard(field));
}

// --- Card -------------------------------------------------------------------

function buildCard(field) {
    const state = wv.getState(field.key);
    const card = el('div', { class: 'wv-card', id: 'wvcard-' + field.key });

    const head = el('div', { class: 'wv-card-head' }, [
        el('div', { class: 'wv-question', text: field.q })
    ]);
    if (state === 'answered') head.append(el('span', { class: 'wv-badge wv-badge-answered', text: '✓ Answered' }));
    else if (state === 'declined') head.append(el('span', { class: 'wv-badge wv-badge-declined', text: 'Prefer not to say' }));
    card.append(head);

    // Show a private notice on fields whose value is sent to the AI for context but
    // which it must not raise on its own initiative. The note names what DOES bring
    // it out (Ken, August 3 2026) — saying only "won't be volunteered" leaves the
    // user with no way to ever use the answer they just typed in.
    if (field.defaultPrivacy === 'private') {
        card.append(el('p', { class: 'wv-private-note', text:
            '🔒 The AI uses this for context but won\'t raise it on its own — only if they ask, or you ask for it in "In my own words".' }));
    }

    if (state === 'declined') {
        // Undo restores the prior answer if there was one (decline never destroys
        // it), otherwise it just re-opens the question (Ken, July 2026).
        const hadAnswer = wv.hasStashedAnswer(field.key);
        card.append(el('div', { class: 'wv-actions' }, [
            el('button', { class: 'wv-btn wv-btn-link',
                text: hadAnswer ? 'Undo — bring my answer back' : 'Undo — ask me this again',
                onclick: async () => { await wv.undeclineField(field.key); refreshCard(field); } })
        ]));
        return card;
    }

    card.append(buildInput(field));

    const actions = el('div', { class: 'wv-actions' });
    const current = wv.getField(field.key);
    const speakBtn = el('button', {
        class: 'wv-btn wv-btn-speak',
        text: '🔊 Speak my answer',
        onclick: () => { const v = formatValue(wv.getField(field.key)); if (v) speak(v); }
    });
    if (!formatValue(current)) speakBtn.setAttribute('disabled', 'true');
    actions.append(speakBtn);
    actions.append(el('button', { class: 'wv-btn wv-btn-link', text: 'Prefer not to say',
        onclick: async () => { await wv.declineField(field.key); refreshCard(field); } }));
    card.append(actions);

    return card;
}

// Build the type-appropriate input region and wire saving.
function buildInput(field) {
    const current = wv.getField(field.key);
    const hasOptions = Array.isArray(field.options) && field.options.length > 0;

    if (field.type === 'choice') return buildChoice(field, current);
    if (field.type === 'multi' && hasOptions) return buildMultiChips(field, current);
    if (field.type === 'multi') return buildFreeMulti(field, current);
    if (field.type === 'repeat') return buildRepeat(field, current);
    return buildTextish(field, current);   // text | number
}

function saveAndRefresh(field, value) {
    return wv.setField(field.key, value).then(() => refreshCard(field));
}

// choice — single select chips + "in my own words"
function buildChoice(field, current) {
    const wrap = el('div', { class: 'wv-input' });
    const chips = el('div', { class: 'wv-chips' });
    for (const opt of field.options) {
        chips.append(el('button', {
            class: 'wv-chip' + (current === opt ? ' wv-chip-on' : ''),
            text: opt,
            onclick: () => saveAndRefresh(field, opt)
        }));
    }
    wrap.append(chips);

    // free-text alternative (also shows the current value if it is custom)
    const isCustom = current != null && !field.options.includes(current);
    const input = el('input', { type: 'text', class: 'wv-text', placeholder: 'In my own words…',
        value: isCustom ? current : '' });
    const save = el('button', { class: 'wv-btn wv-btn-primary', text: 'Save',
        onclick: () => { const v = input.value.trim(); if (v) saveAndRefresh(field, v); } });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
    wrap.append(el('div', { class: 'wv-own' }, [input, save]));
    return wrap;
}

// multi with a fixed option list — toggle chips + add your own
function buildMultiChips(field, current) {
    const selected = Array.isArray(current) ? [...current] : [];
    const wrap = el('div', { class: 'wv-input' });
    const chips = el('div', { class: 'wv-chips' });
    const all = [...field.options, ...selected.filter((s) => !field.options.includes(s))];
    for (const opt of all) {
        chips.append(el('button', {
            class: 'wv-chip' + (selected.includes(opt) ? ' wv-chip-on' : ''),
            text: opt,
            onclick: () => {
                const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
                if (next.length) saveAndRefresh(field, next);
                else wv.resetField(field.key).then(() => refreshCard(field));
            }
        }));
    }
    wrap.append(chips);

    const input = el('input', { type: 'text', class: 'wv-text', placeholder: 'Add your own…' });
    const add = el('button', { class: 'wv-btn wv-btn-primary', text: 'Add',
        onclick: () => { const v = input.value.trim(); if (v && !selected.includes(v)) saveAndRefresh(field, [...selected, v]); } });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add.click(); });
    wrap.append(el('div', { class: 'wv-own' }, [input, add]));
    return wrap;
}

// multi without options — comma-separated free text
function buildFreeMulti(field, current) {
    const wrap = el('div', { class: 'wv-input' });
    const value = Array.isArray(current) ? current.join(', ') : '';
    const input = el('input', { type: 'text', class: 'wv-text', placeholder: 'Separate with commas…', value });
    const save = el('button', { class: 'wv-btn wv-btn-primary', text: 'Save',
        onclick: () => {
            const parts = input.value.split(',').map((s) => s.trim()).filter(Boolean);
            if (parts.length) saveAndRefresh(field, parts);
            else wv.resetField(field.key).then(() => refreshCard(field));
        } });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
    wrap.append(el('div', { class: 'wv-own' }, [input, save]));
    return wrap;
}

// text | number
function buildTextish(field, current) {
    const wrap = el('div', { class: 'wv-input' });
    const input = el('input', {
        type: field.type === 'number' ? 'text' : 'text',
        class: 'wv-text',
        placeholder: 'Type your answer…',
        value: current != null ? String(current) : ''
    });
    const save = el('button', { class: 'wv-btn wv-btn-primary', text: 'Save',
        onclick: () => { const v = input.value.trim(); if (v) saveAndRefresh(field, v); else wv.resetField(field.key).then(() => refreshCard(field)); } });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
    wrap.append(el('div', { class: 'wv-own' }, [input, save]));
    return wrap;
}

// repeat — rows of sub-fields (e.g. name + relationship)
function buildRepeat(field, current) {
    const entries = Array.isArray(current) ? [...current] : [];
    const subs = field.fields && field.fields.length ? field.fields : ['value'];
    const wrap = el('div', { class: 'wv-input' });

    if (entries.length) {
        const list = el('div', { class: 'wv-entry-list' });
        entries.forEach((entry, i) => {
            list.append(el('div', { class: 'wv-entry' }, [
                el('span', { text: formatValue(entry) }),
                el('button', { class: 'wv-entry-remove', text: '✕', 'aria-label': 'Remove',
                    onclick: () => {
                        const next = entries.filter((_, j) => j !== i);
                        if (next.length) saveAndRefresh(field, next);
                        else wv.resetField(field.key).then(() => refreshCard(field));
                    } })
            ]));
        });
        wrap.append(list);
    }

    const inputs = subs.map((s) => el('input', { type: 'text', class: 'wv-text wv-text-sub', placeholder: s }));
    const add = el('button', { class: 'wv-btn wv-btn-primary', text: 'Add',
        onclick: () => {
            const obj = {};
            subs.forEach((s, i) => { obj[s] = inputs[i].value.trim(); });
            if (Object.values(obj).some(Boolean)) saveAndRefresh(field, [...entries, obj]);
        } });
    wrap.append(el('div', { class: 'wv-entry-add' }, [...inputs, add]));
    return wrap;
}
