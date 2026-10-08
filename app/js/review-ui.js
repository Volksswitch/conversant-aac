/* Conversation Review — the screen and the Settings list.
 *
 * ONE ACTION: REWRITE A TURN (Ken, October 6 2026: "Let's simplify everything"). The
 * user steps through a conversation, picks a turn that did not sound like them, and the
 * Composition Pane opens with the words said at the time. They write the whole reply
 * they would rather have said and save it. That is all review records.
 *
 * Tested the same day (scripts/voice-eval/TEST-PLAN-instructions-and-review.md, and
 * TODO.md "Rebuild review around tapping"): rewriting every turn with one person
 * clearly changed how the app spoke with them; one rewrite per conversation barely did;
 * and the earlier answers (a closer response option, an Express button, New 4, the
 * context marks, the "wrong words" flag, a steer) changed nothing measurable. They are
 * gone, and so is the word-by-word editor.
 *
 * Turns where the user and the app struggled at the time - a different set asked for,
 * the Composition Pane opened, the AI steered - are marked in the pane, and Jump goes
 * to the next one.
 *
 * NOTHING ON THE SCREEN MOVES. The response cards, the Command Bar and the Express
 * Panel keep their exact geometry, because one keyguard has to fit both a conversation
 * and its review. Every mark here is paint (a class), never a box.
 *
 * The nine Command Bar buttons, by position:
 *   Listen -> Previous Turn      Start conversation -> Next Turn
 *   End conversation -> Jump: the next turn where you and the app struggled
 *   Repeat what I said, Hold on -> blank and unused (Ken, October 7 2026: a rewrite is
 *     opened by tapping the turn, its card or "In my own words", and Undo takes one
 *     back, so "Rewrite this turn" and "Clear this rewrite" were removed)
 *   Ask them to repeat -> Undo   Wrap up -> Redo   Don't save -> Hear it
 *   Settings -> Settings, which is also how the user leaves review.
 *
 * In the Composition Pane, Speak becomes Save and Reframe becomes Clear: the same two
 * boxes, so the keyguard still fits. While the pane is open, Undo and Redo step through
 * the typing in the box and Hear it says what is in the box; leaving it with unsaved
 * changes asks first.
 */

import * as ui from './ui.js';
import * as storage from './storage.js';
import * as keyboard from './keyboard.js';
import * as model from './review-model.js';
import { refreshVoiceHarvest } from './voice-refresh.js';
import { confirmDanger } from './confirm-dialog.js';

let deps = null;
let active = false;
let conv = null;          // { id, data, turns, practice }
let review = null;        // the review record (review-model)
let at = 0;               // which turn is outlined
let history = model.createHistory();
let saveTimer = null;
let composerOpen = false;
let listShowsPractice = false;   // which list the Review tab shows
// How far back the list goes, in days, or 'all'. Starts at a week every session (Ken,
// October 3 2026): most users review only now and then, and a short list is quicker
// to read and to open. A note below the list says when older ones are hidden.
let listRange = '7';

// The bar, in order. `id` is the Command Bar button whose position the action takes.
const BAR = [
    { id: 'listenBtn',          act: 'prevTurn', icon: 'prevTurn', label: 'Previous turn', face: 'Previous' },
    { id: 'initiateBtn',        act: 'nextTurn', icon: 'nextTurn', label: 'Next turn',     face: 'Next' },
    { id: 'endConversationBtn', act: 'nextFlag', icon: 'nextFlag', label: 'Next turn where you and the app struggled', face: 'Jump' },
    { id: 'sayAgainBtn',        act: 'none' },
    { id: 'holdOnBtn',          act: 'none' },
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
 *   panelItems()                              every Express item, for finding a phrase
 */
export function init(d) {
    deps = d;
    // ONE listener per surface, in the CAPTURE phase, so the live conversation's own
    // handlers never see a tap while review owns the screen. Registered once; each one
    // does nothing unless review is active.
    const bar = $('listenControls');
    if (bar) bar.addEventListener('click', onBarClick, true);
    const regen = $('regenerateBtn');
    if (regen) regen.addEventListener('click', swallow, true);
    const cards = $('responseOptions');
    if (cards) cards.addEventListener('click', onCardsClick, true);
    const log = $('transcriptLog');
    if (log) log.addEventListener('click', onPaneClick, true);
    const comp = $('composerOverlay');
    if (comp) comp.addEventListener('click', onComposerClick, true);
    const input = $('composerInput');
    if (input) input.addEventListener('input', onDraftInput);
}

export function isActive() { return active; }

// New 4 does nothing in review: there is no set to fetch, and review no longer records
// "I would have asked for a different set".
function swallow(e) {
    if (!active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
}

// --- Entering and leaving ---------------------------------------------------------

export async function enter(entry) {
    if (!entry || !entry.id || !entry.data) return false;
    const turns = model.buildTurns(entry.data);
    if (!turns.length) return false;
    // Always read fresh (CR-295): the list's copy can be older than a save that
    // finished after the list was drawn.
    const raw = await storage.readReview(entry.id);
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
    composerOpen = false;
    active = true;
    document.body.classList.add('reviewing');
    // Review redraws the pane on every change, so it must not be a live region here or
    // the whole conversation is re-read each time (CR-119).
    $('transcriptLog')?.setAttribute('aria-live', 'off');
    for (const id of ['liveTurn', 'coachLine', 'nowPlaying']) { const el = $(id); if (el) el.hidden = true; }
    render();
    return true;
}

async function leave() {
    if (!active) return;
    if (!(await okToLeaveComposer())) return;
    closeComposer();
    await flushSave();
    // The review only counts if the voice examples are rebuilt from it. Not awaited:
    // reading every conversation must not hold the user on a screen they asked to leave.
    void refreshVoiceHarvest();
    active = false;
    conv = null;
    review = null;
    document.body.classList.remove('reviewing');
    $('transcriptLog')?.setAttribute('aria-live', 'polite');
    // Review made every bar button a toggle; outside Review most are not, so the
    // attribute goes - the three real toggles get theirs back from their own setters
    // in restoreConversationScreen (CR-118).
    for (const b of BAR) {
        const el = $(b.id);
        if (el) { el.disabled = false; el.classList.remove('review-on'); el.removeAttribute('aria-pressed'); }
    }
    deps.restoreConversationScreen();
    deps.openSettingsAt('review');
}

// --- Rendering --------------------------------------------------------------------

function turn() { return conv ? conv.turns[at] : null; }
function entry() { return model.getEntry(review, turn().key); }
function rewriteOf(t) {
    const a = model.getEntry(review, t.key).answer;
    return a && a.kind === 'rewrite' ? a.text : '';
}
// A turn can be rewritten only where the user said something, or was offered something.
function rewritable(t) { return !!(t && (t.user || t.cards.length || t.partner)); }

function render() {
    if (!active) return;
    renderBar();
    renderPane();
    renderCards();
    renderPanel();
}

function renderBar() {
    // While the Composition Pane is open, Undo and Redo work on the typing in the box.
    const state = {
        prevTurn: at > 0,
        nextTurn: at < conv.turns.length - 1,
        nextFlag: nextFlagged() >= 0,
        undo: composerOpen ? draft.back.length > 0 : history.canUndo(),
        redo: composerOpen ? draft.fwd.length > 0 : history.canRedo(),
        hear: !!hearText(),
        leave: true,
        none: false,
    };
    for (const b of BAR) {
        const el = $(b.id);
        if (b.act === 'none') blankButton(el);
        else ui.setCommandBarFace(b.id, b.icon, b.label, b.face);
        if (!el) continue;
        el.disabled = !state[b.act];
        el.classList.remove('listening', 'private-on', 'ep-on');
        el.setAttribute('aria-pressed', 'false');
    }
}

// A Command Bar button review does not use: an empty face, disabled. The box is left
// exactly as it is, so no keyguard hole moves.
function blankButton(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.remove('cmd-worded');
    ['-webkit-line-clamp', 'display', '-webkit-box-orient', 'align-items']
        .forEach((p) => el.style.removeProperty(p));
    el.setAttribute('aria-label', 'Not used in review');
    el.title = '';
}

function fromLabel(t) {
    const u = t.user;
    if (!u) return '';
    if (u.audio) return 'played a sound';
    switch (u.source) {
        case 'express': return 'tapped on your Express Panel';
        case 'composed': return 'typed in the Composition Pane';
        case 'control': return 'a command button';
        default: return '';
    }
}

function renderPane() {
    const log = $('transcriptLog');
    if (!log) return;
    const html = [];
    conv.turns.forEach((t, i) => {
        const here = i === at;
        const cur = here ? ' review-current' : '';
        // The turns where the user and the app struggled at the time get a mark that
        // shows on every line of the turn, not only on the one outlined (Ken, October 6
        // 2026: "there's still value in highlighting the turns where the user/AI
        // struggled").
        const hard = t.flags.length ? ' review-struggled' : '';
        if (t.partner) {
            html.push(`<div class="turn turn-partner review-line${cur}${hard}" data-turn="${i}" data-part="partner" title="Tap to go to this turn">${esc(t.partnerText || '(nothing written down)')}</div>`);
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
        const title = here ? 'Tap to rewrite this turn' : 'Tap to go to this turn';
        if (t.user) {
            const from = fromLabel(t);
            html.push(`<div class="turn turn-user review-line${cur}${hard}" data-turn="${i}" data-part="user" title="${title}">${esc(t.user.text)}${from ? `<span class="review-from"> (${esc(from)})</span>` : ''}</div>`);
        } else {
            html.push(`<div class="turn turn-user review-line review-none${cur}${hard}" data-turn="${i}" data-part="user" title="${title}">(nothing said)</div>`);
        }
        const rw = rewriteOf(t);
        if (rw) html.push(`<div class="review-note review-note-right" data-turn="${i}">You would rather have said: “${esc(rw)}”</div>`);
    });
    log.innerHTML = html.join('');
    scrollToCurrent();
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

// The cards are shown as they were, to look at. The one spoken at the time is marked,
// dashed once the turn has a rewrite, and is the only one a tap opens the rewrite from
// (Ken, October 7 2026): only what was said can be rewritten, so the others are
// disabled and washed out. A turn answered some other way has every card disabled.
function renderCards() {
    const t = turn();
    const palette = paletteFor(t);
    if (palette.length) ui.showResponses(palette, () => {});
    else ui.clearResponseOptions();
    const replaced = !!rewriteOf(t);
    const box = $('responseOptions');
    if (!box) return;
    box.querySelectorAll('.response-card[data-index]').forEach((card) => {
        const i = Number(card.dataset.index);
        const spoken = i === t.took;
        card.classList.toggle('review-spoken', spoken);
        card.classList.toggle('review-spoken-replaced', spoken && replaced);
        const bits = [card.getAttribute('aria-label') || ''];
        if (spoken) bits.push('(you said this)');
        card.setAttribute('aria-label', bits.join(' ').trim());
        // A disabled button receives no click, so neither the tap guard nor
        // onCardsClick ever sees a tap on one.
        card.disabled = !spoken;
        card.classList.toggle('review-not-spoken', !spoken);
        card.title = spoken ? 'Tap to rewrite this turn' : '';
    });
}

// The Express Panel is drawn as it stands, to keep the screen the same shape, and only
// its "In my own words" key does anything: it opens the rewrite. The button tapped at
// the time is marked, dashed once the turn has a rewrite.
function renderPanel() {
    if (!active) return;
    const t = turn();
    const usedText = t.user && t.user.source === 'express' ? t.user.text : null;
    const usedId = usedText ? findItemId(usedText) : null;
    const none = () => {};
    deps.drawExpressPanel({
        partner: null, place: null, feeling: null, goalIds: [],
        reviewMarks: {
            usedId,
            usedText,
            wantId: null,
            usedReplaced: !!rewriteOf(t),
            composeUsed: !!(t.user && t.user.source === 'composed'),
            composeWant: !!rewriteOf(t),
        },
        onPhrase: none,
        onAudio: none,
        onTogglePartner: none,
        onTogglePlace: none,
        onToggleFeeling: none,
        onToggleGoal: none,
        onInMyOwnWords: openComposer,
        reveal: [{ id: usedId, text: usedText }],
        onMore: none,
    });
}

/** Called by app.js whenever something would normally redraw the panel. */
export function refreshPanel() { renderPanel(); }

function findItemId(text) {
    const want = String(text || '').trim().toLowerCase();
    if (!want) return null;
    const items = deps.panelItems() || [];
    const hit = items.find((it) => it && (it.text || it.label || '').trim().toLowerCase() === want);
    return hit ? hit.id : null;
}

// --- Saving -----------------------------------------------------------------------

// Stored as the user writes, so there is nothing to save and no way out to look for.
// A short delay folds a run of changes into one write.
function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; void writeNow(); }, 400);
}
// A save already under way is waited for too (CR-295): flushSave used to wait only for
// one still pending, so leaving during a write let the list - and a quick reopen -
// read the older review, which was then saved back over the newer one.
let writing = null;
async function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; await writeNow(); }
    if (writing) await writing;
}
function writeNow() {
    if (!conv || !review) return Promise.resolve();
    const id = conv.id;
    const out = { ...review, updated: new Date().toISOString() };
    // A save that fails is said, not swallowed (CR-172); nothing of what was written
    // goes in the message.
    const job = (async () => {
        const ok = await storage.writeReview(id, out);
        if (!ok) storage.logError('review save', `could not write the review for ${id}`);
    })();
    const tracked = job.finally(() => { if (writing === tracked) writing = null; });
    writing = tracked;
    return job;
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
        case 'prevTurn': void goTo(at - 1); break;
        case 'nextTurn': void goTo(at + 1); break;
        case 'nextFlag': void goTo(nextFlagged()); break;
        case 'undo': if (composerOpen) stepDraft('undo'); else stepHistory('undo'); break;
        case 'redo': if (composerOpen) stepDraft('redo'); else stepHistory('redo'); break;
        case 'hear': hear(); break;
        case 'leave': void leave(); break;
        default: break;
    }
    // The box keeps the caret, so the user carries on typing after Undo, Redo or Hear it.
    if (composerOpen && ['undo', 'redo', 'hear'].includes(def.act)) refocusComposer();
}

async function goTo(i) {
    if (!conv || i < 0 || i >= conv.turns.length || i === at) return;
    if (!(await okToLeaveComposer())) return;
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
    // As goTo does: an open typing box would otherwise file its sentence under the
    // turn Undo just moved to (CR-047).
    closeComposer();
    const i = conv.turns.findIndex((t) => t.key === got.turnKey);
    if (i >= 0) at = i;
    review = model.markReached(review, at);
    scheduleSave();
    render();
}

function hear() {
    const text = hearText();
    if (text) deps.speak(text);
}

// What Hear it says: what is in the box while the Composition Pane is open (Ken,
// October 7 2026); otherwise the rewrite, or what was said at the time when there is
// none. Never a sound button's NAME (CR-258), which would read a label out as though
// the user said it.
function hearText() {
    const t = turn();
    if (!t) return '';
    if (composerOpen) return ui.getComposerText();
    const rw = rewriteOf(t);
    if (rw) return rw;
    if (!t.user || t.user.audio) return '';
    return t.user.text || '';
}

// The next turn, after the one outlined, where the user and the app struggled: -1 when
// none is left, which disables the button.
function nextFlagged() {
    if (!conv) return -1;
    for (let i = at + 1; i < conv.turns.length; i++) if (conv.turns[i].flags.length) return i;
    return -1;
}

// --- Picking a turn ---------------------------------------------------------------

// A tap on a card of the outlined turn opens its rewrite. With "two taps" on, the
// first tap never reaches here: tap-guard.js arms the card and swallows it.
function onCardsClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const card = e.target.closest && e.target.closest('.response-card[data-index]');
    if (card) openComposer();
}

// One rule for the pane: a tap on another turn moves the outline there; a tap on the
// outlined turn opens its rewrite.
function onPaneClick(e) {
    if (!active) return;
    const line = e.target.closest && e.target.closest('[data-turn]');
    if (!line) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const i = Number(line.dataset.turn);
    if (i !== at) { void goTo(i); return; }
    openComposer();
}

// --- The rewrite ------------------------------------------------------------------

// The Composition Pane opens with the words said at the time, or with the rewrite
// already made, and Clear empties it. Save records the whole reply; it speaks nothing
// and asks the AI for nothing.
function openComposer() {
    // Already open: a second tap on the turn must not throw away what is being typed.
    if (!active || composerOpen || !rewritable(turn())) return;
    const t = turn();
    composerOpen = true;
    ui.showComposerOverlay();
    // Same two boxes, new jobs: Speak saves, Reframe clears. Drawn in the user's own
    // choice of pictures or words, like every other button. Save is a disk, not a
    // check mark: a check reads as "already saved" (Ken, October 7 2026).
    ui.setCommandBarFace('speakBtn', 'save', 'Save this as what I would rather have said', 'Save');
    ui.setCommandBarFace('reframeBtn', 'erase', 'Clear the box', 'Clear');
    const start = rewriteOf(t) || (t.user && !t.user.audio ? t.user.text : '') || '';
    ui.setComposerText(start);
    resetDraft(start);
    // Undo, Redo and Hear it are pressed while typing, so tapping them must not take
    // the on-screen keyboard down.
    keyboard.setExtraKeepOpen('#pardonBtn, #windDownBtn, #privacyBtn');
    refocusComposer();
    renderBar();
}

function closeComposer() {
    if (!composerOpen) return;
    composerOpen = false;
    keyboard.setExtraKeepOpen('');
    resetDraft('');
    // Every button's usual face comes back; review redraws its own bar straight after.
    ui.applyControlIcons();
    ui.clearComposer();
    ui.hideComposerOverlay();
    keyboard.hideKeyboard();
}

function refocusComposer() {
    const box = $('composerInput');
    if (!box) return;
    try { box.focus({ preventScroll: true }); } catch { box.focus(); }
    keyboard.showFor(box);
}

// The typing in the box has its own Undo and Redo while the pane is open. A step is a
// word, not a letter: a new step starts when a word starts, when typing turns into
// deleting or back, on a paste or an accepted prediction, and after a pause.
const draft = { back: [], fwd: [], last: '', start: '', kind: 0, at: 0 };
function resetDraft(text) {
    draft.back = []; draft.fwd = []; draft.last = text; draft.start = text; draft.kind = 0; draft.at = 0;
}
function onDraftInput() {
    if (!active || !composerOpen) return;
    const now = $('composerInput').value;
    if (now === draft.last) return;
    const grew = now.length - draft.last.length;
    const kind = grew > 0 ? 1 : -1;
    const newWord = grew === 1 && /\s$/.test(draft.last) && !/\s$/.test(now);
    if (draft.kind === 0 || kind !== draft.kind || Math.abs(grew) > 1 || newWord
        || Date.now() - draft.at > 1500) {
        draft.back.push(draft.last);
        if (draft.back.length > 100) draft.back.shift();
        draft.fwd = [];
    }
    draft.last = now;
    draft.kind = kind;
    draft.at = Date.now();
    renderBar();
}
function setDraftText(text) {
    ui.setComposerText(text);
    draft.last = text;
    draft.kind = 0;
    renderBar();
}
function stepDraft(which) {
    const from = which === 'undo' ? draft.back : draft.fwd;
    const to = which === 'undo' ? draft.fwd : draft.back;
    if (!from.length) return;
    to.push($('composerInput').value);
    setDraftText(from.pop());
}

// Unsaved work in the box is asked about before it is thrown away (Ken, October 7
// 2026): a rewrite can be a lot of typing.
function composerDirty() {
    return composerOpen && ui.getComposerText() !== draft.start.trim();
}
async function okToLeaveComposer() {
    if (!composerDirty()) return true;
    const ok = await confirmDanger({
        title: 'Leave without saving?',
        body: 'What you have written in the box has not been saved. If you leave now, it is lost.',
        confirmLabel: 'Leave without saving',
        cancelLabel: 'Keep writing',
    });
    if (!ok && composerOpen) refocusComposer();
    return ok;
}

async function onComposerClick(e) {
    if (!active || !composerOpen) return;
    const btn = e.target.closest && e.target.closest('button');
    if (!btn || !['speakBtn', 'reframeBtn', 'cancelComposerBtn'].includes(btn.id)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (btn.id === 'reframeBtn') {
        // Clear is one step Undo can take back.
        const now = $('composerInput').value;
        if (now) { draft.back.push(now); draft.fwd = []; }
        setDraftText('');
        $('composerInput')?.focus();
        return;
    }
    if (btn.id === 'cancelComposerBtn') {
        if (!(await okToLeaveComposer())) return;
    } else {
        // Saving what was said at the time, or an empty box, records nothing.
        change(model.setRewrite(review, turn(), ui.getComposerText()));
    }
    closeComposer();
    render();
}

// --- The Settings tab: choosing a conversation ------------------------------------

/**
 * Draw the list into the Review tab. Real conversations or practice ones, never both
 * (§4), newest first, each row saying when, who, where and how long - with a mark on
 * one holding a turn where the user and the app struggled at the time.
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

    const range = document.getElementById('reviewListRange');
    if (range) {
        range.value = listRange;
        range.onchange = () => { listRange = range.value; void renderList(panel); };
    }

    const wrap = document.createElement('div');
    wrap.className = 'review-table-wrap';
    panel.appendChild(wrap);
    panel.appendChild(status);
    const olderNote = document.createElement('p');
    olderNote.className = 'setting-hint review-older';
    olderNote.hidden = true;
    panel.appendChild(olderNote);

    if (!storage.hasDataFolder()) {
        status.textContent = 'Saved conversations live in your data folder, and none is connected. Choose one on the General tab.';
        return;
    }
    status.textContent = 'Reading your saved conversations…';
    let logs = [];
    const since = listRange === 'all' ? null : new Date(Date.now() - Number(listRange) * 86400000);
    try { logs = await storage.listConversationLogs({ since }); } catch { logs = []; }
    // Older conversations are hidden, not gone, so the list says so and offers them.
    // The count covers real and practice together, because telling them apart would
    // mean opening every old file, which is the work the range exists to avoid.
    // Named after the period picked, and without a count: the count could not say how
    // many of them were practice, and under the practice list it read as though it did
    // (CR-260).
    const rangeText = range && range.selectedIndex >= 0
        ? range.options[range.selectedIndex].text.toLowerCase() : 'this period';
    if (logs.older) {
        olderNote.hidden = false;
        olderNote.textContent = `Conversations from before ${rangeText} are not shown.`;
        // A sibling of the note rather than inside it, or it takes the note's smaller
        // lettering (CR-261).
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'review-older-more';
        more.textContent = 'Show conversations from any time';
        more.onclick = () => { listRange = 'all'; void renderList(panel); };
        olderNote.after(more);
    }
    const rows = [];
    for (const c of logs) {
        const s = model.summarize(c.id, c.data);
        if (!s || s.practice !== listShowsPractice) continue;
        const p = model.progressOf(model.normalizeReview(c.review, c.id), s.turns);
        rows.push({ ...s, progress: p, progressRank: p.rank, entry: c });
    }
    if (!rows.length) {
        status.textContent = logs.older
            ? (listShowsPractice ? `No practice conversations from ${rangeText}.` : `No conversations from ${rangeText}.`)
            : (listShowsPractice ? 'No saved practice conversations yet.' : 'No saved conversations yet.');
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
            ? `<span class="review-row-flag">${r.flagged} ${r.flagged === 1 ? 'turn' : 'turns'} where you and the app struggled</span>`
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
