/* Conversation Review — the screen and the Settings list.
 *
 * Design: "Conversant AAC Conversation Review.docx". This is the second controller for
 * the conversation screen (§13.4): the same markup, with the Command Bar rebound and the
 * Express Panel put into a mode where tapping MARKS instead of speaking. NOTHING ON THE
 * SCREEN MOVES - the response cards, the Command Bar and the panel keep their exact
 * geometry, because one keyguard has to fit both a conversation and its review. Every
 * mark here is paint (a class), never a box.
 *
 * The nine Command Bar buttons, by position:
 *   Listen -> Previous Turn      Start conversation -> Next Turn
 *   End conversation -> Play it back (not built yet, so shown unavailable)
 *   Repeat what I said -> Previous Word      Hold on -> Next Word
 *   Ask them to repeat -> Undo   Wrap up -> Redo   Don't save -> Hear it
 *   Settings -> Settings, which is also how the user leaves review (§5).
 *
 * The app.js half is deliberately thin and passed in through init(): this module owns
 * no conversation state and never touches the live conversation's.
 */

import * as ui from './ui.js';
import * as storage from './storage.js';
import * as keyboard from './keyboard.js';
import * as model from './review-model.js';
import * as wed from './word-editor.js';

let deps = null;
let active = false;
let conv = null;          // { id, data, turns, practice, partnerName }
let review = null;        // the review record (review-model)
let at = 0;               // which turn is outlined
let editing = null;       // null | { target: 'card', index } | { target: 'heard' }
let ed = null;            // word-editor state while editing
let history = model.createHistory();
let saveTimer = null;
let wordInput = null;
let lastComposed = null;  // what the panel was last drawn with: { items, bands }
let composerOpen = false;
let listShowsPractice = false;   // which list the Review tab shows

// The bar, in order. `id` is the Command Bar button whose position the action takes.
const BAR = [
    { id: 'listenBtn',          act: 'prevTurn', icon: 'prevTurn', label: 'Previous turn', face: 'Previous' },
    { id: 'initiateBtn',        act: 'nextTurn', icon: 'nextTurn', label: 'Next turn',     face: 'Next' },
    { id: 'endConversationBtn', act: 'play',     icon: 'play',     label: 'Play it back (not available yet)', face: 'Play' },
    { id: 'sayAgainBtn',        act: 'prevWord', icon: 'prevWord', label: 'Previous word', face: 'Prev word' },
    { id: 'holdOnBtn',          act: 'nextWord', icon: 'nextWord', label: 'Next word',     face: 'Next word' },
    { id: 'pardonBtn',          act: 'undo',     icon: 'undo',     label: 'Undo',          face: 'Undo' },
    { id: 'windDownBtn',        act: 'redo',     icon: 'redo',     label: 'Redo',          face: 'Redo' },
    { id: 'privacyBtn',         act: 'hear',     icon: 'speak',    label: 'Hear it',       face: 'Hear it' },
    { id: 'settingsBtn',        act: 'leave',    icon: 'settings', label: 'Settings - and the way out of review', face: 'Settings' },
];
const BAR_BY_ID = new Map(BAR.map((b) => [b.id, b]));

const CATEGORY_SLOTS = ['PREFERRED', 'DISPREFERRED', 'INITIATIVE', 'REPAIR'];

const $ = (id) => document.getElementById(id);
function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * deps (from app.js):
 *   drawExpressPanel(reviewOpts) -> composed   draw the panel with review overrides
 *   restoreConversationScreen()               put the live screen back as it was
 *   closeSettings()                           close the dialog for review to show
 *   openSettingsAt(tab)                       open Settings on a tab
 *   conversationBusy() -> bool                 a live conversation is under way
 *   speak(text)                               say it in the user's own voice
 *   goalButtons(partnerItem, placeItem)       the goals a panel would offer
 *   panelItems()                              every Express item, for finding a phrase
 */
export function init(d) {
    deps = d;
    ensureWordInput();
    // ONE listener per surface, in the CAPTURE phase, so the live conversation's own
    // handlers never see a tap while review owns the screen. Registered once; each one
    // does nothing unless review is active.
    const bar = $('listenControls');
    if (bar) bar.addEventListener('click', onBarClick, true);
    const regen = $('regenerateBtn');
    if (regen) regen.addEventListener('click', onNewClick, true);
    const cards = $('responseOptions');
    if (cards) cards.addEventListener('click', onCardsClick, true);
    const log = $('transcriptLog');
    if (log) log.addEventListener('click', onPaneClick, true);
    const comp = $('composerOverlay');
    if (comp) comp.addEventListener('click', onComposerClick, true);
    // While a word is being edited, a tap on the bar, a card or the pane must not take
    // focus away from the word box, or the on-screen keyboard drops and comes back on
    // every press of Next Word.
    for (const id of ['listenControls', 'responsesSection', 'transcriptSection']) {
        const el = $(id);
        if (!el) continue;
        for (const ev of ['pointerdown', 'mousedown']) {
            el.addEventListener(ev, (e) => {
                if (!active || !editing) return;
                if (e.target === wordInput) return;
                if (e.target.closest && e.target.closest('#composerOverlay')) return;
                e.preventDefault();
            }, true);
        }
    }
}

export function isActive() { return active; }

function ensureWordInput() {
    if (wordInput) return;
    const host = $('responsesSection');
    if (!host) return;
    wordInput = document.createElement('input');
    wordInput.type = 'text';
    wordInput.id = 'reviewWordInput';
    wordInput.className = 'review-word-input';
    wordInput.autocomplete = 'off';
    wordInput.spellcheck = false;
    wordInput.setAttribute('data-no-predict', '');
    wordInput.setAttribute('aria-label', 'The highlighted word');
    wordInput.tabIndex = -1;
    host.appendChild(wordInput);
    wordInput.addEventListener('input', onWordInput);
    // Leaving the word box - a tap anywhere review does not keep focus - ends editing,
    // so the Express Panel comes back.
    wordInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (!active || !editing || document.activeElement === wordInput) return;
            stopEditing();
            render();
        }, 0);
    });
    wordInput.addEventListener('keydown', onWordKey);
}

// --- Entering and leaving ---------------------------------------------------------

export async function enter(entry) {
    if (!entry || !entry.id || !entry.data) return false;
    const turns = model.buildTurns(entry.data);
    if (!turns.length) return false;
    const raw = entry.review !== undefined ? entry.review : await storage.readReview(entry.id);
    conv = {
        id: entry.id,
        data: entry.data,
        turns,
        practice: model.isPractice(entry.data),
    };
    review = model.normalizeReview(raw, entry.id);
    // Opening it is looking at it: the list stops saying "not looked at".
    review = model.markReached(review, 0);
    scheduleSave();
    history = model.createHistory();
    at = 0;
    editing = null;
    ed = null;
    composerOpen = false;
    active = true;
    document.body.classList.add('reviewing');
    for (const id of ['liveTurn', 'coachLine', 'nowPlaying']) { const el = $(id); if (el) el.hidden = true; }
    render();
    return true;
}

async function leave() {
    if (!active) return;
    stopEditing();
    closeComposer();
    await flushSave();
    active = false;
    conv = null;
    review = null;
    lastComposed = null;
    document.body.classList.remove('reviewing');
    const regen = $('regenerateBtn');
    if (regen) regen.classList.remove('review-want');
    for (const b of BAR) { const el = $(b.id); if (el) { el.disabled = false; el.classList.remove('review-on'); } }
    deps.restoreConversationScreen();
    deps.openSettingsAt('review');
}

// --- Rendering --------------------------------------------------------------------

function turn() { return conv ? conv.turns[at] : null; }
function entry() { return model.getEntry(review, turn().key); }

function partnerName(t) {
    const p = t && t.context && t.context.partner;
    return p && !String(p).startsWith('Practice:') ? p : 'The other person';
}

function render() {
    if (!active) return;
    renderBar();
    renderPane();
    renderCards();
    renderPanel();
    renderNew();
    syncWordInput();
}

function renderBar() {
    const e = entry();
    const hearable = editing ? !!wed.editorText(ed) : !!answerText(e);
    const state = {
        prevTurn: at > 0,
        nextTurn: at < conv.turns.length - 1,
        play: false,                       // real-time playback is not built (§12)
        prevWord: !!editing,
        nextWord: !!editing,
        undo: history.canUndo(),
        redo: history.canRedo(),
        hear: hearable,
        leave: true,
    };
    for (const b of BAR) {
        ui.setCommandBarFace(b.id, b.icon, b.label, b.face);
        const el = $(b.id);
        if (!el) continue;
        el.disabled = !state[b.act];
        el.classList.remove('listening', 'private-on', 'ep-on');
        el.setAttribute('aria-pressed', 'false');
    }
}

function answerText(e) {
    const a = e && e.answer;
    if (!a) return '';
    return a.text || '';
}

function fromLabel(t) {
    const u = t.user;
    if (!u) return '';
    if (u.audio) return 'played a sound';
    switch (u.source) {
        case 'express': return 'tapped on your panel';
        case 'composed': return 'typed in the Composition Pane';
        case 'control': return 'a command button';
        default: return '';
    }
}

function wordsHtml() {
    return ed.words.map((w, i) => {
        const cls = 'review-word' + (i === ed.sel ? ' review-word-on' : '') + (w === '' ? ' review-word-hole' : '');
        return `<span class="${cls}" data-w="${i}">${esc(w === '' ? ' ' : w)}</span>`;
    }).join(' ');
}

function renderPane() {
    const log = $('transcriptLog');
    if (!log) return;
    const html = [];
    conv.turns.forEach((t, i) => {
        const here = i === at;
        const e = model.getEntry(review, t.key);
        const cur = here ? ' review-current' : '';
        if (t.partner) {
            const editingHeard = here && editing && editing.target === 'heard';
            const body = editingHeard ? wordsHtml() : esc(t.partnerText || '(nothing written down)');
            const title = here && !conv.practice
                ? `Tap again to say the app wrote down the wrong words`
                : 'Tap to go to this turn';
            html.push(`<div class="turn turn-partner review-line${cur}${editingHeard ? ' review-editing' : ''}" data-turn="${i}" data-part="partner" title="${esc(title)}">${body}</div>`);
            if (e.misheard) {
                const said = e.misheard.said
                    ? ` You say ${esc(partnerName(t))} said: “${esc(e.misheard.said)}”`
                    : '';
                html.push(`<div class="review-note review-note-left" data-turn="${i}">Your note: the app wrote down the wrong words.${said}</div>`);
            }
        }
        if (here) {
            const notes = [];
            if (t.regenerates) notes.push(`You asked for a different set ${t.regenerates === 1 ? 'once' : `${t.regenerates} times`}.`);
            if (t.contextRegens) notes.push(`Switching a button on brought ${t.contextRegens === 1 ? 'one new set' : `${t.contextRegens} new sets`}.`);
            if (t.flags.includes(model.FLAG.COMPOSER)) notes.push('You opened the Composition Pane after seeing the response options.');
            for (const s of t.steers) notes.push(`You steered the AI: “${esc(s)}”`);
            for (const a of t.abandoned) notes.push(`You typed and then left: “${esc(a)}”`);
            if (t.errors.length) notes.push(`The app had ${t.errors.length === 1 ? 'a problem' : `${t.errors.length} problems`} here.`);
            for (const n of notes) html.push(`<div class="review-note">${n}</div>`);
        }
        if (t.user) {
            const from = fromLabel(t);
            html.push(`<div class="turn turn-user review-line${cur}" data-turn="${i}" data-part="user" title="Tap to go to this turn">${esc(t.user.text)}${from ? `<span class="review-from"> (${esc(from)})</span>` : ''}</div>`);
        } else {
            html.push(`<div class="turn turn-user review-line review-none${cur}" data-turn="${i}" data-part="user">(nothing said)</div>`);
        }
        if (e.answer) html.push(`<div class="review-note review-note-right" data-turn="${i}">${esc(answerLine(e))}</div>`);
        if (e.reframers && e.reframers.length) {
            html.push(`<div class="review-note review-note-right" data-turn="${i}">The app should have known: ${esc(e.reframers.map((r) => r.label).join(', '))}.</div>`);
        }
        if (e.steer) html.push(`<div class="review-note review-note-right" data-turn="${i}">You would have steered the AI: “${esc(e.steer)}”</div>`);
    });
    log.innerHTML = html.join('');
    scrollToCurrent();
}

function answerLine(e) {
    const a = e.answer;
    switch (a.kind) {
        case 'card': return a.rewritten ? `You would rather have said: “${a.text}”` : `This response option would have suited you better: “${a.text}”`;
        case 'phrase': return `You would rather have tapped “${a.text}”${a.needed ? ` with ${a.needed.map((n) => n.label).join(' and ')} switched on` : ''}.`;
        case 'sound': return `You would rather have played “${a.text}”.`;
        case 'typed': return `You would rather have said: “${a.text}”`;
        case 'more': return 'You would have asked for a different set.';
        default: return '';
    }
}

function scrollToCurrent() {
    const box = $('transcript');
    if (!box) return;
    const marks = box.querySelectorAll('.review-current');
    if (!marks.length) return;
    const first = marks[0];
    const last = marks[marks.length - 1];
    const br = box.getBoundingClientRect();
    const top = box.scrollTop + (first.getBoundingClientRect().top - br.top);
    const bottom = box.scrollTop + (last.getBoundingClientRect().bottom - br.top);
    // Both halves of the exchange have to be visible: cutting the user's own reply in
    // half reads as a rendering fault rather than as scrolling.
    let want = Math.max(0, top - 12);
    if (bottom - want > box.clientHeight) want = Math.max(0, bottom - box.clientHeight + 12);
    box.scrollTop = want;
}

// The set the user saw, as palette entries the ordinary renderer understands. Older
// files know the category of the chosen card only; four cards from those were always
// offered in category order, so the order stands in for the category.
function paletteFor(t) {
    const cards = t.cards || [];
    const allKnown = cards.length && cards.every((c) => c.slot);
    return cards.map((c, i) => ({
        slot: allKnown ? c.slot : (cards.length === 4 ? CATEGORY_SLOTS[i] : 'OPENER'),
        text: c.text,
        hint: c.text,
        latency: 'instant',
    }));
}

function renderCards() {
    const t = turn();
    const palette = paletteFor(t);
    if (palette.length) ui.showResponses(palette, () => {});
    else ui.clearResponseOptions();
    const e = entry();
    const answerIdx = e.answer && e.answer.kind === 'card' ? e.answer.index : -1;
    const box = $('responseOptions');
    if (!box) return;
    box.querySelectorAll('.response-card[data-index]').forEach((card) => {
        const i = Number(card.dataset.index);
        const spoken = i === t.took;
        // Solid means "this one"; the card spoken at the time turns dashed once anything
        // else has been chosen in its place (Ken, October 1 2026).
        card.classList.toggle('review-spoken', spoken);
        card.classList.toggle('review-spoken-replaced', spoken && !!e.answer && answerIdx !== i);
        card.classList.toggle('review-want', i === answerIdx && !spoken);
        const text = card.querySelector('.response-text');
        if (editing && editing.target === 'card' && editing.index === i && text) {
            card.classList.add('review-editing');
            text.innerHTML = wordsHtml();
        } else if (text && answerIdx === i && e.answer.rewritten) {
            text.textContent = e.answer.text;
        }
        const bits = [card.getAttribute('aria-label') || ''];
        if (spoken) bits.push('(you said this)');
        if (i === answerIdx && !spoken) bits.push('(would have suited you better)');
        card.setAttribute('aria-label', bits.join(' ').trim());
        card.title = editing && editing.target === 'card' && editing.index === i
            ? 'Tap a word to change it, or tap the card to finish'
            : i === selectedCard()
            ? 'Tap again to change its words'
            : 'Tap to say this one would have suited you better';
    });
}

function renderNew() {
    const e = entry();
    const regen = $('regenerateBtn');
    if (regen) regen.classList.toggle('review-want', !!(e.answer && e.answer.kind === 'more'));
}

// The Express Panel, drawn with this turn's marks. Lit buttons are what the user marked
// "should have been on"; the Flex band fills from them exactly as it would have.
function renderPanel() {
    if (!active) return;
    const t = turn();
    const e = entry();
    const marked = (kind) => (e.reframers || []).find((r) => r.kind === kind) || null;
    const partner = marked('partner');
    const place = marked('place');
    const feeling = marked('feeling');
    const goalIds = (e.reframers || []).filter((r) => r.kind === 'goal').map((r) => r.id);
    const usedId = t.user && t.user.source === 'express' ? findItemId(t.user.text) : null;
    const wantId = e.answer && (e.answer.kind === 'phrase' || e.answer.kind === 'sound') ? e.answer.itemId : null;
    lastComposed = deps.drawExpressPanel({
        partner, place, feeling, goalIds,
        reviewMarks: { usedId, wantId },
        onPhrase: (item) => answerWithPhrase(item, false),
        onAudio: (item) => answerWithPhrase(item, true),
        onTogglePartner: (item) => toggleMark('partner', item),
        onTogglePlace: (item) => toggleMark('place', item),
        onToggleFeeling: (item) => toggleMark('feeling', item),
        onToggleGoal: (item) => toggleMark('goal', item),
        onInMyOwnWords: openComposer,
    });
}

/** Called by app.js whenever something would normally redraw the panel. */
export function refreshPanel() { renderPanel(); }

function findItemId(text) {
    const want = String(text || '').trim().toLowerCase();
    if (!want) return null;
    const items = (lastComposed && lastComposed.items) || deps.panelItems() || [];
    const hit = items.find((it) => it && (it.text || it.label || '').trim().toLowerCase() === want);
    return hit ? hit.id : null;
}

function bandOf(itemId) {
    if (!lastComposed || !itemId) return null;
    const i = lastComposed.items.findIndex((it) => it && it.id === itemId);
    return i >= 0 ? lastComposed.bands[i] : null;
}

// --- Saving -----------------------------------------------------------------------

// Stored as the user writes, so there is nothing to save and no way out to look for
// (§5). A short delay folds a run of keystrokes into one write.
function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; void writeNow(); }, 400);
}
async function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; await writeNow(); }
}
async function writeNow() {
    if (!conv || !review) return;
    const out = { ...review, updated: new Date().toISOString() };
    await storage.writeReview(conv.id, out);
}

function change(next) {
    history.push(review, turn().key);
    review = next;
    scheduleSave();
}

// --- The Command Bar --------------------------------------------------------------

function onBarClick(e) {
    if (!active) return;
    const btn = e.target.closest && e.target.closest('button');
    if (!btn) return;
    const def = BAR_BY_ID.get(btn.id);
    if (!def) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (btn.disabled) return;
    switch (def.act) {
        case 'prevTurn': goTo(at - 1); break;
        case 'nextTurn': goTo(at + 1); break;
        case 'prevWord': if (ed) { ed = wed.moveWord(ed, -1); afterEdit(false); } break;
        case 'nextWord': if (ed) { ed = wed.moveWord(ed, 1); afterEdit(false); } break;
        case 'undo': stepHistory('undo'); break;
        case 'redo': stepHistory('redo'); break;
        case 'hear': hear(); break;
        case 'leave': void leave(); break;
        default: break;
    }
}

function goTo(i) {
    if (!conv || i < 0 || i >= conv.turns.length || i === at) return;
    stopEditing();
    closeComposer();
    at = i;
    review = model.markReached(review, i);
    scheduleSave();
    render();
}

function stepHistory(which) {
    const got = which === 'undo' ? history.undo(review, turn().key) : history.redo(review, turn().key);
    if (!got) return;
    // Undo takes back an answer, never how far the user has got.
    review = { ...got.state, reached: Math.max(got.state.reached ?? -1, review.reached ?? -1) };
    stopEditing();
    const i = conv.turns.findIndex((t) => t.key === got.turnKey);
    if (i >= 0) at = i;
    review = model.markReached(review, at);
    scheduleSave();
    render();
}

function hear() {
    const text = editing ? wed.editorText(ed) : answerText(entry());
    if (text) deps.speak(text);
}

// New 4 in review fetches nothing: it records that the user would have asked for a
// different set (§5).
function onNewClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    stopEditing();
    change(model.toggleMoreOptions(review, turn()));
    render();
}

// --- Cards ------------------------------------------------------------------------

function onCardsClick(e) {
    if (!active) return;
    const card = e.target.closest && e.target.closest('.response-card[data-index]');
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!card) return;
    const i = Number(card.dataset.index);
    const word = e.target.closest('[data-w]');
    if (word && editing && editing.target === 'card' && editing.index === i) {
        ed = wed.selectWord(ed, Number(word.dataset.w));
        afterEdit(false);
        return;
    }
    // The card being edited: a tap anywhere but a word finishes editing and brings the
    // Express Panel back. The keyboard on this screen has no Hide key, so this is the
    // way out besides moving to another turn.
    if (editing && editing.target === 'card' && editing.index === i) {
        stopEditing();
        render();
        return;
    }
    // With "two taps" on, the first tap never reaches here: tap-guard.js arms the card
    // and swallows it, for this screen as for the rest of the app.
    if (selectedCard() === i) startCardEdit(i);
    else chooseCard(i);
}

// Which card counts as chosen right now: the one the user picked in review, or, until
// they pick another answer, the one they spoke at the time.
function selectedCard() {
    const e = entry();
    if (e.answer) return e.answer.kind === 'card' ? e.answer.index : -1;
    return turn().took;
}

// CHOOSING a card is one step and EDITING it is another (Ken, October 1 2026): opening
// the editor on the first tap hid the Express Panel under the keyboard before the user
// had asked to type anything, with no obvious way back. Choosing the card spoken at the
// time puts the turn back as it was.
function chooseCard(i) {
    stopEditing();
    const t = turn();
    if (i === t.took) change(model.clearAnswer(review, t));
    else change(model.setCardAnswer(review, t, i, (t.cards[i] && t.cards[i].text) || ''));
    render();
}

// A second tap on the chosen card makes its words editable where they are (§6.2).
// Editing the card that was spoken, and leaving it unchanged, records nothing.
function startCardEdit(i) {
    const t = turn();
    const e = entry();
    const keep = e.answer && e.answer.kind === 'card' && e.answer.index === i;
    const text = keep ? e.answer.text : (t.cards[i] && t.cards[i].text) || '';
    change(model.setCardAnswer(review, t, i, text));
    editing = { target: 'card', index: i };
    ed = wed.createWordEditor(text);
    render();
}

function stopEditing() {
    editing = null;
    ed = null;
    if (wordInput && document.activeElement === wordInput) wordInput.blur();
}

// --- The pane ---------------------------------------------------------------------

// One rule for the whole screen: tap the thing you want to say something about. A tap
// on a line from another turn moves the outline there; a tap on the other person's line
// of the turn already showing opens it for correction (§6.4).
function onPaneClick(e) {
    if (!active) return;
    const line = e.target.closest && e.target.closest('[data-turn]');
    if (!line) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const i = Number(line.dataset.turn);
    if (i !== at) { goTo(i); return; }
    if (line.dataset.part !== 'partner') return;
    // Nothing can have been misheard in practice: the app spoke those lines itself.
    if (conv.practice) return;
    const word = e.target.closest('[data-w]');
    if (word && editing && editing.target === 'heard') {
        ed = wed.selectWord(ed, Number(word.dataset.w));
        afterEdit(false);
        return;
    }
    if (editing && editing.target === 'heard') return;
    const t = turn();
    const prior = entry().misheard;
    // The flag first, on its own; the words are optional and come after it, so somebody
    // who only remembers that a line was wrong can still say so.
    change(model.setMisheard(review, t, prior && prior.said ? prior.said : t.partnerText));
    editing = { target: 'heard' };
    ed = wed.createWordEditor(prior && prior.said ? prior.said : t.partnerText);
    render();
}

// --- The word editor's input --------------------------------------------------------

function syncWordInput() {
    if (!wordInput) return;
    if (!editing || !ed) return;
    if (ed.fresh) {
        wordInput.value = wed.currentWord(ed);
    }
    if (document.activeElement !== wordInput) {
        try { wordInput.focus({ preventScroll: true }); } catch { wordInput.focus(); }
        keyboard.showFor(wordInput);
    }
    if (ed.fresh) {
        try { wordInput.setSelectionRange(0, wordInput.value.length); } catch { /* not focusable yet */ }
    }
}

let wordSnapshotTaken = false;

function onWordInput() {
    if (!active || !ed) return;
    // Undo steps back a WORD, not a letter: one snapshot when a word starts changing.
    if (ed.fresh && !wordSnapshotTaken) { history.push(review, turn().key); wordSnapshotTaken = true; }
    ed = wed.typeInto(ed, wordInput.value);
    afterEdit(true);
}

function onWordKey(e) {
    if (!active || !ed) return;
    if (e.key === 'Backspace') {
        const next = wed.backspace(ed);
        if (next === null) return;            // part way through a word: delete a letter
        e.preventDefault();
        history.push(review, turn().key);
        ed = next;
        afterEdit(true);
        return;
    }
    // Enter is a key like any other here: typing never moves the highlight (Ken).
    if (e.key === 'Enter') { e.preventDefault(); return; }
    if (e.key === 'ArrowRight' && wordInput.selectionStart === wordInput.value.length) {
        e.preventDefault(); ed = wed.moveWord(ed, 1); afterEdit(false); return;
    }
    if (e.key === 'ArrowLeft' && wordInput.selectionStart === 0) {
        e.preventDefault(); ed = wed.moveWord(ed, -1); afterEdit(false);
    }
}

// Write the sentence as it now stands into the review, then redraw only what shows it.
function afterEdit(textChanged) {
    if (ed && ed.fresh) wordSnapshotTaken = false;
    if (textChanged) {
        const text = wed.editorText(ed);
        const t = turn();
        if (editing && editing.target === 'card') review = model.setCardAnswer(review, t, editing.index, text);
        else if (editing && editing.target === 'heard') review = model.setMisheard(review, t, text);
        scheduleSave();
    }
    renderBar();
    if (editing && editing.target === 'heard') renderPane();
    else renderCards();
    if (textChanged) renderPane();
    syncWordInput();
}

// --- The Express Panel --------------------------------------------------------------

// A phrase tapped in review says "I would rather have said this" (§6). Tapping it again
// takes it back. A Flex phrase only exists because a person or a place is on, so the
// answer records what had to be switched on to reach it.
function answerWithPhrase(item, sound) {
    if (!item) return;
    stopEditing();
    const e = entry();
    if (e.answer && (e.answer.kind === 'phrase' || e.answer.kind === 'sound') && e.answer.itemId === item.id) {
        change(model.clearAnswer(review, turn()));
    } else {
        const needed = bandOf(item.id) === 'flex'
            ? (e.reframers || []).filter((r) => r.kind === 'partner' || r.kind === 'place')
            : null;
        change(model.setPhraseAnswer(review, turn(), {
            itemId: item.id,
            text: sound ? (item.label || 'Sound') : (item.text || ''),
            sound,
            needed,
        }));
    }
    render();
}

// Partner, place, feeling and goal buttons say what the app SHOULD HAVE BEEN TOLD, not
// what the user would have said, so they sit alongside any answer.
function toggleMark(kind, item) {
    if (!item) return;
    stopEditing();
    const label = kind === 'partner' ? (item.label || item.nickname || item.name || 'Partner')
        : kind === 'place' ? (item.name || 'Place')
            : kind === 'feeling' ? (item.text || 'Feeling')
                : (item.label || item.text || 'Goal');
    change(model.toggleReframer(review, turn(), {
        kind, id: item.id, label,
        ...(item.personId ? { personId: item.personId } : {}),
        ...(item.placeId ? { placeId: item.placeId } : {}),
    }));
    render();
}

// --- My own words -------------------------------------------------------------------

// The Composition Pane opens as it always does. Speak records the sentence as what the
// user would have said; Reframe records the direction they would have steered the AI
// in. Neither speaks, and neither asks the AI for anything.
function openComposer() {
    if (!active) return;
    stopEditing();
    const e = entry();
    composerOpen = true;
    ui.showComposerOverlay();
    ui.setComposerText(e.answer && e.answer.kind === 'typed' ? e.answer.text : (e.steer || ''));
}

function closeComposer() {
    if (!composerOpen) return;
    composerOpen = false;
    ui.clearComposer();
    ui.hideComposerOverlay();
    keyboard.hideKeyboard();
}

function onComposerClick(e) {
    if (!active || !composerOpen) return;
    const btn = e.target.closest && e.target.closest('button');
    if (!btn || !['speakBtn', 'reframeBtn', 'cancelComposerBtn'].includes(btn.id)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const text = ui.getComposerText();
    if (btn.id === 'speakBtn') {
        // A turn where nothing gets typed records nothing (§6.2).
        if (text) change(model.setTypedAnswer(review, turn(), text));
    } else if (btn.id === 'reframeBtn') {
        if (text) change(model.setSteer(review, turn(), text));
    }
    closeComposer();
    render();
}

// --- The Settings tab: choosing a conversation ------------------------------------

/**
 * Draw the list into the Review tab. Real conversations or practice ones, never both
 * (§4), newest first, each row saying when, who, where and how long - with a mark on
 * one holding a turn where the user asked for something different at the time.
 */
export async function renderList(panel) {
    if (!panel) return;
    panel.innerHTML = '';
    const status = document.createElement('p');
    status.className = 'setting-hint';
    status.id = 'reviewListStatus';
    status.setAttribute('role', 'status');

    // Real or practice, never both (§4): a practice conversation and a real one with a
    // family member are different things to go back over. The two radio buttons are
    // in the page markup, like every other Settings choice.
    document.querySelectorAll('input[name="reviewListKind"]').forEach((r) => {
        r.checked = (r.value === 'practice') === listShowsPractice;
        r.onchange = () => { listShowsPractice = r.value === 'practice'; void renderList(panel); };
    });

    const wrap = document.createElement('div');
    wrap.className = 'review-table-wrap';
    panel.appendChild(wrap);
    panel.appendChild(status);

    if (!storage.hasDataFolder()) {
        status.textContent = 'Saved conversations live in your data folder, and none is connected. Choose one on the General tab.';
        return;
    }
    status.textContent = 'Reading your saved conversations…';
    let logs = [];
    try { logs = await storage.listConversationLogs(); } catch { logs = []; }
    const rows = [];
    for (const c of logs) {
        const s = model.summarize(c.id, c.data);
        if (!s || s.practice !== listShowsPractice) continue;
        const p = model.progressOf(model.normalizeReview(c.review, c.id), s.turns);
        rows.push({ ...s, progress: p, progressRank: p.rank, entry: c });
    }
    if (!rows.length) {
        status.textContent = listShowsPractice ? 'No saved practice conversations yet.' : 'No saved conversations yet.';
        return;
    }
    status.textContent = '';
    drawTable(wrap, rows, status);
}

// The columns of Figure 1. Tapping a heading sorts by it; tapping it again reverses.
const COLUMNS = [
    { key: 'when', label: 'When', newestFirst: true },
    { key: 'who', label: 'Who' },
    { key: 'where', label: 'Where' },
    { key: 'length', label: 'How long', newestFirst: true },
    { key: 'progress', label: 'Where you got to' },
];
let sortColumn = 'when';
let sortAscending = false;   // newest first, until the user picks another order

function drawTable(wrap, rows, status) {
    wrap.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'review-table';
    table.id = 'reviewTable';
    const head = document.createElement('thead');
    const hr = document.createElement('tr');
    for (const col of COLUMNS) {
        const th = document.createElement('th');
        th.scope = 'col';
        const on = col.key === sortColumn;
        th.setAttribute('aria-sort', on ? (sortAscending ? 'ascending' : 'descending') : 'none');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'review-sort' + (on ? ' review-sort-on' : '');
        b.dataset.sort = col.key;
        b.innerHTML = `${esc(col.label)}<span class="review-sort-arrow" aria-hidden="true">${on ? (sortAscending ? ' ▲' : ' ▼') : ''}</span>`;
        b.setAttribute('aria-label', `Sort by ${col.label}`);
        b.addEventListener('click', () => {
            if (sortColumn === col.key) sortAscending = !sortAscending;
            else { sortColumn = col.key; sortAscending = !col.newestFirst; }
            drawTable(wrap, rows, status);
        });
        th.appendChild(b);
        hr.appendChild(th);
    }
    head.appendChild(hr);
    table.appendChild(head);

    const body = document.createElement('tbody');
    for (const r of model.sortRows(rows, sortColumn, sortAscending)) {
        const tr = document.createElement('tr');
        tr.className = 'review-row' + (r.practice ? ' review-row-practice' : '');
        tr.tabIndex = 0;
        const when = r.started ? new Date(r.started).toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        }) : r.id;
        const length = `${model.durationLabel(r.durationMs)}, ${r.replies} ${r.replies === 1 ? 'reply' : 'replies'}`;
        const flag = r.flagged
            ? `<span class="review-row-flag">${r.flagged} ${r.flagged === 1 ? 'turn' : 'turns'} you asked for something else</span>`
            : '';
        const who = r.practice
            ? `<span class="review-practice-badge">Practice</span>${esc(r.who || '')}`
            : esc(r.who || 'Someone');
        tr.innerHTML = `<td class="review-cell-when">${esc(when)}</td>`
            + `<td>${who}</td>`
            + `<td>${esc(r.where || '')}</td>`
            + `<td>${esc(length)}</td>`
            + `<td>${flag}<span class="review-progress review-progress-${r.progress.state}">${esc(r.progress.label)}</span></td>`;
        tr.setAttribute('aria-label', `${when}, ${r.who || 'someone'}${r.where ? `, ${r.where}` : ''}, ${length}. ${r.progress.label}. Open to review.`);
        const open = async () => {
            if (deps.conversationBusy()) {
                status.textContent = 'A conversation is under way. End it first, then come back to review.';
                return;
            }
            deps.closeSettings();
            const ok = await enter(r.entry);
            if (!ok) {
                deps.openSettingsAt('review');
                status.textContent = 'That conversation has nothing in it to review.';
            }
        };
        tr.addEventListener('click', open);
        tr.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void open(); }
        });
        body.appendChild(tr);
    }
    table.appendChild(body);
    wrap.appendChild(table);
}
