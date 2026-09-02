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
import { REGISTER_DIMENSIONS, RELATIONSHIP_GOALS } from './partner-profile.js';
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
    if (!items.length) return;

    contentEl.append(el('h3', { class: 'wv-section-title', text: 'Questions worth answering' }));
    contentEl.append(el('p', { class: 'wv-intro', text:
        'These came up in real conversations but I didn’t have the answer. Filling them in gives the biggest payoff.' }));
    for (const { meta, count } of items) {
        const note = count > 1 ? `Came up ${count} times` : 'Came up once';
        contentEl.append(el('button', { class: 'wv-module-row',
            onclick: () => renderModule(meta.moduleId, meta.key) }, [
            el('div', { class: 'wv-module-main' }, [
                el('div', { class: 'wv-module-title', text: meta.q }),
                el('div', { class: 'wv-module-meta', text: `${note} · ${meta.moduleTitle}` })
            ]),
            el('div', { class: 'wv-chevron', text: '›' })
        ]));
    }
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

    // How I Sound — the voice layer. Not questionnaire Q&A either: the user is not
    // reporting facts about themselves, they are picking between wordings, and the
    // sentence they pick is the answer (Sounds Like Me, Phase 1).
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
function buildPartnerProfileSection(existing) {
    const saved = existing ? rel.getPartnerProfile(existing.id) : null;

    // Register: one select per dimension, each relative to the user's own baseline.
    // "Same as usual" is the default and emits nothing at all downstream.
    const dimSelects = new Map();
    const dimRows = REGISTER_DIMENSIONS.map((dim) => {
        const sel = el('select', { class: 'wv-select wv-dim-select' });
        sel.append(el('option', { value: '' }, 'Same as usual'));
        sel.append(el('option', { value: dim.low.value }, dim.low.label));
        sel.append(el('option', { value: dim.high.value }, dim.high.label));
        if (saved && saved.register && saved.register[dim.key]) sel.value = saved.register[dim.key];
        dimSelects.set(dim.key, sel);
        return el('label', { class: 'wv-dim-row' }, [
            el('span', { class: 'wv-dim-label', text: dim.label }), sel
        ]);
    });

    // Standing relationship goal — what they want from the relationship over time,
    // not from one conversation. Curated menu plus free text (Ken, June 15 2026):
    // fast to pick, which matters for this user, but still their own words if none
    // of the twelve fit.
    const goalSelect = el('select', { class: 'wv-select' });
    goalSelect.append(el('option', { value: '' }, 'No particular goal'));
    for (const g of RELATIONSHIP_GOALS) goalSelect.append(el('option', { value: g.id }, g.text));
    goalSelect.append(el('option', { value: OTHER }, 'Something else…'));
    const goalOther = el('input', { type: 'text', class: 'wv-text', placeholder: 'What you want from this relationship' });
    const goalOtherWrap = el('div', { class: 'wv-rel-other' }, [goalOther]);
    const syncGoal = () => { goalOtherWrap.style.display = goalSelect.value === OTHER ? '' : 'none'; };
    goalSelect.addEventListener('change', syncGoal);
    if (saved && saved.goal) {
        if (saved.goal.id && RELATIONSHIP_GOALS.some((g) => g.id === saved.goal.id)) {
            goalSelect.value = saved.goal.id;
        } else if (saved.goal.text) {
            goalSelect.value = OTHER;
            goalOther.value = saved.goal.text;
        }
    }
    syncGoal();

    const noteIn = el('input', { type: 'text', class: 'wv-text',
        placeholder: 'Anything else about how you talk with them (optional)',
        value: saved ? saved.note : '' });

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
    const node = el('details', { class: 'wv-partner-profile' }, [
        el('summary', { class: 'wv-disclosure' }, [
            el('span', { class: 'wv-disclosure-mark', 'aria-hidden': 'true', text: '›' }),
            el('span', { class: 'wv-disclosure-title', text: 'How I talk with them' }),
        ]),
        el('div', { class: 'wv-dim-grid' }, dimRows),
        goalSelect, goalOtherWrap, noteIn,
        openersIn, windIn, closeIn
    ]);

    // Open it on edit when there is something in it, so a saved profile is not
    // invisible behind a closed triangle.
    if (saved && (Object.keys(saved.register).length || saved.goal || saved.note ||
        saved.openers.length || saved.windDowns.length || saved.closings.length)) {
        node.open = true;
    }

    const read = () => {
        const register = {};
        for (const [key, sel] of dimSelects) if (sel.value) register[key] = sel.value;
        const goalId = goalSelect.value;
        let goal = null;
        if (goalId === OTHER) {
            const t = goalOther.value.trim();
            if (t) goal = { id: '', text: t };
        } else if (goalId) {
            goal = { id: goalId };
        }
        return {
            register, goal,
            note: noteIn.value.trim(),
            openers: splitLines(openersIn.value),
            windDowns: splitLines(windIn.value),
            closings: splitLines(closeIn.value)
        };
    };

    return { node, read };
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

    const profile = buildPartnerProfileSection(existing);

    // Each "how to say it" sits directly under the field it corrects, so there is
    // never a question about which name it applies to.
    card.append(el('div', { class: 'wv-person-fields' },
        [nameIn, namePron.row, nicknameIn, nickPron.row, relSelect, otherWrap, aboutIn, livesRow, privRow]));
    card.append(profile.node);

    const save = el('button', { class: 'wv-btn wv-btn-primary', text: existing ? 'Save' : 'Add person',
        onclick: async () => {
            const name = nameIn.value.trim();
            const relationship = getRelationship();
            if (!name && !relationship) return;   // nothing to save
            let id;
            if (existing) {
                id = existing.id;
                await rel.updatePerson(id, {
                    name, relationship,
                    about: aboutIn.value.trim(),
                    nickname: nicknameIn.value.trim(),
                    pronunciation: namePron.inp.value.trim(),
                    nicknamePronunciation: nickPron.inp.value.trim(),
                    livesWithMe: livesCheck.checked,
                    isPrivate: privCheck.checked
                });
            } else {
                // A new person has no id until they exist, so the profile is written
                // second — the section is read from the DOM either way, so nothing
                // typed into it is lost by the ordering.
                id = await rel.addPerson({
                    name, relationship,
                    about: aboutIn.value.trim(),
                    nickname: nicknameIn.value.trim(),
                    pronunciation: namePron.inp.value.trim(),
                    nicknamePronunciation: nickPron.inp.value.trim(),
                    livesWithMe: livesCheck.checked,
                    isPrivate: privCheck.checked
                });
            }
            await rel.setPartnerProfile(id, profile.read());
            renderPeople();
        } });

    const actions = el('div', { class: 'wv-actions' }, [save]);
    if (existing) {
        actions.append(el('button', { class: 'wv-btn wv-btn-link', text: 'Cancel', onclick: () => renderPeople() }));
    }
    card.append(actions);
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
                onclick: () => { syncDraft(); draft.splice(i, 1); if (!draft.length) draft.push({ key: '', value: '' }); renderFacts(); } });
            factsWrap.append(el('div', { class: 'wv-fact-row' }, [keyIn, valIn, del]));
        });
    };
    renderFacts();

    const addFact = el('button', { class: 'wv-btn wv-btn-link', text: '+ Add a fact',
        onclick: () => { syncDraft(); draft.push({ key: '', value: '' }); renderFacts();
            factsWrap.querySelector('.wv-fact-row:last-child .wv-fact-key-input')?.focus(); } });

    const privId = 'wvplacepriv-' + (existing ? existing.id : 'new');
    const privCheck = el('input', { type: 'checkbox', id: privId });
    if (existing && existing.private) privCheck.checked = true;
    const privRow = el('label', { class: 'wv-person-checkbox-row', for: privId }, [
        privCheck, el('span', { text: 'Private — AI knows but won\'t bring it up unprompted' })
    ]);

    card.append(el('div', { class: 'wv-person-fields' }, [nameIn, pronRow, factsWrap, addFact, privRow]));

    const save = el('button', { class: 'wv-btn wv-btn-primary', text: existing ? 'Save' : 'Add place',
        onclick: async () => {
            syncDraft();
            const name = nameIn.value.trim();
            if (!name) return;   // a place with no name can't be shown or referred to
            const facts = draft;  // places.js drops the blank rows
            const pronunciation = pronIn.value.trim();
            if (existing) {
                await places.updatePlace(existing.id, { name, pronunciation, facts, isPrivate: privCheck.checked });
            } else {
                await places.addPlace({ name, pronunciation, facts, isPrivate: privCheck.checked });
            }
            renderPlaces();
        } });

    const actions = el('div', { class: 'wv-actions' }, [save]);
    if (existing) {
        actions.append(el('button', { class: 'wv-btn wv-btn-link', text: 'Cancel', onclick: () => renderPlaces() }));
    }
    card.append(actions);
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
