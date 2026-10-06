/* Conversation Review — the reading half, the answer record, the word editor, and ONE
 * check that runs the whole chain (design document §13.5): a conversation written by
 * the real storage layer, read back, split into turns, a correction recorded, and the
 * correction read back off disk. Three checks that each exercised one layer would all
 * pass with the feature dead, which has happened in this app before.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../app/js/review-model.js';
import * as wed from '../app/js/word-editor.js';

/* ── A small conversation file, in the shape storage writes ─────────────────────── */

function sampleConversation() {
    const t = (s) => `2026-09-30T17:23:${String(s).padStart(2, '0')}.000Z`;
    return {
        id: '2026-09-30T17-23-00',
        started: t(0),
        exchanges: [
            { timestamp: t(0), role: 'context', trigger: 'start', partner: { id: 'p1', label: 'Mom' }, place: { id: 'h', label: 'Home' }, feeling: null, goals: null },
            { timestamp: t(1), role: 'event', kind: 'listen on' },
            { timestamp: t(2), role: 'partner', rawTranscript: 'how was your week', cleanedTranscript: 'How was your week?', revisions: [] },
            { timestamp: t(3), role: 'event', kind: 'generation requested', reason: 'reprompt' },
            { timestamp: t(4), role: 'offer', kind: 'ai', options: [
                { slot: 'PREFERRED', text: 'Pretty good, thanks.' },
                { slot: 'DISPREFERRED', text: 'Not my best week.' },
                { slot: 'INITIATIVE', text: 'Better now you are here.' },
                { slot: 'REPAIR', text: 'Sorry, say that again?' },
            ], outcome: 'card', selectedIndex: 0, shownMs: 3000 },
            { timestamp: t(7), role: 'user', selectedText: 'Pretty good, thanks.', selectedIndex: 0, allOptions: [], selectedSlot: 'PREFERRED', source: 'card' },
            { timestamp: t(8), role: 'event', kind: 'listen on' },
            { timestamp: t(10), role: 'partner', rawTranscript: 'what time works', cleanedTranscript: 'What time works?', revisions: [] },
            { timestamp: t(12), role: 'offer', kind: 'ai', options: [
                { slot: 'PREFERRED', text: 'Any time.' },
                { slot: 'DISPREFERRED', text: 'Not early.' },
                { slot: 'INITIATIVE', text: 'After lunch?' },
                { slot: 'REPAIR', text: 'Which day?' },
            ], outcome: 'regenerate', selectedIndex: null, shownMs: 2000 },
            { timestamp: t(13), role: 'event', kind: 'generation requested', reason: 'regenerate' },
            { timestamp: t(15), role: 'offer', kind: 'ai', options: [
                { slot: 'PREFERRED', text: 'Early afternoon.' },
                { slot: 'DISPREFERRED', text: 'It depends.' },
                { slot: 'INITIATIVE', text: 'You choose.' },
                { slot: 'REPAIR', text: 'How long?' },
            ], outcome: 'composer', selectedIndex: null, shownMs: 4000 },
            { timestamp: t(16), role: 'event', kind: 'composer opened' },
            { timestamp: t(25), role: 'user', selectedText: 'Two o clock is good.', selectedIndex: -1, allOptions: [], source: 'composed' },
            { timestamp: t(30), role: 'partner', rawTranscript: 'see you then', cleanedTranscript: 'See you then.', revisions: [] },
            { timestamp: t(32), role: 'user', selectedText: 'Thank you', selectedIndex: -1, allOptions: [], source: 'express' },
        ],
    };
}

/* ── Reading a conversation ─────────────────────────────────────────────────────── */

test('a conversation splits into one turn per exchange', () => {
    const turns = model.buildTurns(sampleConversation());
    assert.equal(turns.length, 3);
    assert.equal(turns[0].partnerText, 'How was your week?');
    assert.equal(turns[0].user.text, 'Pretty good, thanks.');
    assert.equal(turns[2].user.source, 'express');
});

test('a turn shows the set the user took a card from, and which card', () => {
    const [first] = model.buildTurns(sampleConversation());
    assert.equal(first.cards.length, 4);
    assert.equal(first.took, 0);
    assert.equal(first.cards[1].slot, 'DISPREFERRED');
});

test('a turn the user turned away from shows the LAST set on screen, with nothing marked spoken', () => {
    const second = model.buildTurns(sampleConversation())[1];
    assert.equal(second.cards[0].text, 'Early afternoon.');
    assert.equal(second.took, -1);
});

test('only the three deliberate signals mark a turn (§11)', () => {
    const [first, second, third] = model.buildTurns(sampleConversation());
    assert.deepEqual(first.flags, []);
    assert.ok(second.flags.includes(model.FLAG.ASKED_DIFFERENT));
    assert.ok(second.flags.includes(model.FLAG.COMPOSER));
    assert.equal(second.regenerates, 1);
    assert.deepEqual(third.flags, []);
});

test('events after the user spoke belong to the next turn, not the one just finished', () => {
    const [first] = model.buildTurns(sampleConversation());
    // The "listen on" after the first reply must not count against the first turn.
    assert.equal(first.contextRegens, 0);
    assert.equal(first.key, '2026-09-30T17:23:02.000Z');
});

test('the list row says who, where, how long, and how many turns carry a mark', () => {
    const s = model.summarize('x', sampleConversation());
    assert.equal(s.who, 'Mom');
    assert.equal(s.where, 'Home');
    assert.equal(s.practice, false);
    assert.equal(s.flagged, 1);
    assert.equal(s.durationMs, 32000);
    assert.equal(model.durationLabel(s.durationMs), '32 sec');
});

test('a practice conversation is recognized from its stamp and named for its scenario', () => {
    const data = sampleConversation();
    data.exchanges.push({ timestamp: '2026-09-30T17:24:00.000Z', role: 'user', selectedText: 'Bye', partner: { id: null, label: 'Practice: Ordering coffee' }, source: 'card' });
    const s = model.summarize('x', data);
    assert.equal(s.practice, true);
    assert.equal(s.who, 'Ordering coffee');
    assert.equal(s.where, 'Practice');
});

test('an older file with only allOptions still shows its cards and the one taken', () => {
    const turns = model.buildTurns({ exchanges: [
        { timestamp: 'a', role: 'partner', cleanedTranscript: 'Hi' },
        { timestamp: 'b', role: 'user', selectedText: 'Hello', selectedIndex: 1, allOptions: ['Hi there', 'Hello', 'Hey', 'What?'], selectedSlot: 'DISPREFERRED' },
    ] });
    assert.equal(turns[0].cards.length, 4);
    assert.equal(turns[0].took, 1);
    assert.equal(turns[0].cards[1].slot, 'DISPREFERRED');
});

test('a file with nothing in it gives no turns and no row', () => {
    assert.deepEqual(model.buildTurns({ exchanges: [] }), []);
    assert.equal(model.summarize('x', { exchanges: [{ role: 'context' }] }), null);
    assert.deepEqual(model.buildTurns(null), []);
});

/* ── The review record ──────────────────────────────────────────────────────────── */

test('leaving the spoken card as it was records nothing (§6.1)', () => {
    const [first] = model.buildTurns(sampleConversation());
    let r = model.emptyReview('c');
    r = model.setCardAnswer(r, first, 0, 'Pretty good, thanks.');
    assert.equal(model.touchedCount(r), 0);
});

test('a different card, or new words, is recorded', () => {
    const [first] = model.buildTurns(sampleConversation());
    let r = model.setCardAnswer(model.emptyReview('c'), first, 1, 'Not my best week.');
    assert.equal(model.getEntry(r, first.key).answer.index, 1);
    assert.equal(model.getEntry(r, first.key).answer.rewritten, false);
    r = model.setCardAnswer(r, first, 0, 'Pretty good, but tiring.');
    assert.equal(model.getEntry(r, first.key).answer.rewritten, true);
});

test('one answer per turn: a phrase replaces a card, New 4 replaces a phrase', () => {
    const [first] = model.buildTurns(sampleConversation());
    let r = model.setCardAnswer(model.emptyReview('c'), first, 2, 'Better now you are here.');
    r = model.setPhraseAnswer(r, first, { itemId: 'e1', text: 'Thank you' });
    assert.equal(model.getEntry(r, first.key).answer.kind, 'phrase');
    r = model.toggleMoreOptions(r, first);
    assert.equal(model.getEntry(r, first.key).answer.kind, 'more');
    r = model.toggleMoreOptions(r, first);
    assert.equal(model.touchedCount(r), 0);
});

test('reframers sit alongside an answer, and partner/place/feeling are one at a time', () => {
    const [first] = model.buildTurns(sampleConversation());
    let r = model.setTypedAnswer(model.emptyReview('c'), first, 'I am tired today.');
    r = model.toggleReframer(r, first, { kind: 'feeling', id: 'f1', label: 'Happy' });
    r = model.toggleReframer(r, first, { kind: 'feeling', id: 'f2', label: 'Tired' });
    r = model.toggleReframer(r, first, { kind: 'goal', id: 'g1', label: 'Make plans' });
    r = model.toggleReframer(r, first, { kind: 'goal', id: 'g2', label: 'Stay close' });
    const e = model.getEntry(r, first.key);
    assert.equal(e.answer.kind, 'typed');
    assert.deepEqual(e.reframers.map((x) => x.label), ['Tired', 'Make plans', 'Stay close']);
});

test('switching off the person a Flex phrase needed takes the phrase answer with it', () => {
    const [first] = model.buildTurns(sampleConversation());
    let r = model.toggleReframer(model.emptyReview('c'), first, { kind: 'partner', id: 'mom', label: 'Mom' });
    r = model.setPhraseAnswer(r, first, { itemId: 'x', text: 'Love you', needed: [{ kind: 'partner', id: 'mom', label: 'Mom' }] });
    assert.equal(model.getEntry(r, first.key).answer.kind, 'phrase');
    r = model.toggleReframer(r, first, { kind: 'partner', id: 'mom', label: 'Mom' });
    assert.equal(model.getEntry(r, first.key).answer, null);
});

test('a mishearing is a flag first; the words are optional', () => {
    const [first] = model.buildTurns(sampleConversation());
    let r = model.setMisheard(model.emptyReview('c'), first, first.partnerText);
    assert.deepEqual(model.getEntry(r, first.key).misheard, { heard: 'How was your week?', said: null });
    r = model.setMisheard(r, first, 'How was your weekend?');
    assert.equal(model.getEntry(r, first.key).misheard.said, 'How was your weekend?');
});

test('the review never carries the conversation\'s own record, only the turn key', () => {
    const [first] = model.buildTurns(sampleConversation());
    const r = model.setMisheard(model.emptyReview('c'), first, 'How was your weekend?');
    assert.deepEqual(Object.keys(r.turns), [first.key]);
    const back = model.normalizeReview(JSON.parse(JSON.stringify(r)), 'c');
    assert.deepEqual(back.turns, r.turns);
});

test('undo steps back one action at a time, and redo puts it back', () => {
    const [first] = model.buildTurns(sampleConversation());
    const h = model.createHistory();
    let r = model.emptyReview('c');
    h.push(r, first.key); r = model.setCardAnswer(r, first, 1, 'Not my best week.');
    h.push(r, first.key); r = model.setCardAnswer(r, first, 1, 'Not my best week, honestly.');
    let u = h.undo(r, first.key); r = u.state;
    assert.equal(model.getEntry(r, first.key).answer.text, 'Not my best week.');
    u = h.undo(r, first.key); r = u.state;
    assert.equal(model.touchedCount(r), 0);
    assert.equal(h.undo(r, first.key), null);
    r = h.redo(r, first.key).state;
    assert.equal(model.getEntry(r, first.key).answer.text, 'Not my best week.');
});

/* ── The word editor ────────────────────────────────────────────────────────────── */

test('typing over an untouched word replaces it', () => {
    let ed = wed.createWordEditor('Pretty good thanks');
    ed = wed.typeInto(ed, 'R');
    ed = wed.typeInto(ed, 'Really');
    assert.equal(wed.editorText(ed), 'Really good thanks');
});

test('typing never moves the highlight, a space included (Ken, October 1 2026)', () => {
    let ed = wed.createWordEditor('Let me think about it.');
    ed = wed.selectWord(ed, 1);
    ed = wed.typeInto(ed, 'need ');
    assert.equal(ed.sel, 1);
    ed = wed.typeInto(ed, 'need to');
    assert.equal(ed.sel, 1);
    assert.equal(wed.editorText(ed), 'Let need to think about it.');
});

test("Ken's case: 'Let me think' becomes 'I need to think', and the new words split apart afterwards", () => {
    let ed = wed.createWordEditor('Let me think about it.');
    ed = wed.typeInto(ed, 'I');                 // "Let" -> "I"
    ed = wed.moveWord(ed, 1);
    ed = wed.typeInto(ed, 'need to');           // "me" -> "need to"
    assert.equal(wed.editorText(ed), 'I need to think about it.');
    ed = wed.moveWord(ed, 1);
    assert.deepEqual(ed.words, ['I', 'need', 'to', 'think', 'about', 'it.']);
    assert.equal(wed.currentWord(ed), 'think');
    ed = wed.moveWord(ed, -1);
    assert.equal(wed.currentWord(ed), 'to');
});

test('tapping a later word after typing two words lands on the word that was tapped', () => {
    let ed = wed.createWordEditor('Let me think about it.');
    ed = wed.selectWord(ed, 1);
    ed = wed.typeInto(ed, 'need to');
    ed = wed.selectWord(ed, 3);                 // "about", as it was on screen
    assert.equal(wed.currentWord(ed), 'about');
});

test('three backspaces take out three words, going the way backspace goes', () => {
    let ed = wed.createWordEditor('one two three four');
    ed = wed.selectWord(ed, 3);
    ed = wed.backspace(ed);
    ed = wed.backspace(ed);
    ed = wed.backspace(ed);
    assert.equal(wed.editorText(ed), 'one');
    // ...and the highlight sits on the gap, so the next word typed goes into it.
    assert.equal(wed.currentWord(ed), '');
    ed = wed.typeInto(ed, 'more');
    assert.equal(wed.editorText(ed), 'one more');
});

test('backspace part way through a word deletes a letter, not the word', () => {
    let ed = wed.createWordEditor('cat');
    ed = wed.typeInto(ed, 'dogs');
    assert.equal(wed.backspace(ed), null);
});

test('stepping past the end opens a slot to add a word, and an unused slot collapses', () => {
    let ed = wed.createWordEditor('Hi there');
    ed = wed.moveWord(ed, 1);
    ed = wed.moveWord(ed, 1);
    assert.equal(ed.words.length, 3);
    assert.equal(wed.currentWord(ed), '');
    ed = wed.moveWord(ed, -1);
    assert.deepEqual(ed.words, ['Hi', 'there']);
});

test('pasting several words over one puts them all in', () => {
    let ed = wed.createWordEditor('a b');
    ed = wed.typeInto(ed, 'x y z');
    assert.equal(wed.editorText(ed), 'x y z b');
    ed = wed.moveWord(ed, 1);
    assert.equal(wed.currentWord(ed), 'b');
});

/* ── The whole chain, through the REAL storage layer ────────────────────────────── */

function makeDir(name = '') {
    const files = new Map();
    const dirs = new Map();
    const fileHandle = (n) => {
        const rec = files.get(n);
        return {
            kind: 'file', name: n,
            async getFile() { return { size: rec.data.length, text: async () => rec.data }; },
            async createWritable() {
                let buf = '';
                return { async write(c) { buf += c; }, async close() { rec.data = buf; } };
            },
        };
    };
    return {
        kind: 'directory', name,
        async getDirectoryHandle(n, opts = {}) {
            if (!dirs.has(n)) { if (!opts.create) throw new Error('NotFoundError'); dirs.set(n, makeDir(n)); }
            return dirs.get(n);
        },
        async getFileHandle(n, opts = {}) {
            if (!files.has(n)) { if (!opts.create) throw new Error('NotFoundError'); files.set(n, { data: '' }); }
            return fileHandle(n);
        },
        async removeEntry(n) { files.delete(n); dirs.delete(n); },
        async *entries() {
            for (const [k] of files) yield [k, fileHandle(k)];
            for (const [k, v] of dirs) yield [k, v];
        },
        _files: files, _dirs: dirs,
    };
}

test('the whole chain: a conversation saved by storage, reviewed, and the correction read back off disk', async () => {
    const root = makeDir('root');
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
    globalThis.window = { dispatchEvent() { return true; } };
    globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
    Object.defineProperty(globalThis, 'navigator', {
        value: { storage: { getDirectory: async () => root } },
        configurable: true, writable: true,
    });
    const storage = await import('../app/js/storage.js');
    await storage.restoreDataFolder();
    assert.ok(storage.hasDataFolder(), 'the device folder should be adopted');

    // A real conversation, written by the same calls the app makes.
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    await storage.logPartnerInterim({ rawTranscript: 'how was your week' });
    const offer = [
        { slot: 'PREFERRED', text: 'Pretty good.' },
        { slot: 'DISPREFERRED', text: 'Not great.' },
        { slot: 'INITIATIVE', text: 'Better now.' },
        { slot: 'REPAIR', text: 'Say again?' },
    ];
    await storage.logOffer({ kind: 'ai', options: offer });
    await storage.finalizeOffer({ outcome: 'card', selectedIndex: 0, shownMs: 1200 });
    const handle = storage.detachPendingPartnerTurn();
    await storage.finalizePartnerTurn(handle, { rawTranscript: 'how was your week', cleanedTranscript: 'How was your week?' });
    await storage.logUserResponse({ selectedText: 'Pretty good.', selectedIndex: 0, allOptions: offer.map((o) => o.text), selectedSlot: 'PREFERRED', source: 'card' });
    const id = storage.getConversationId();
    storage.resetConversationId();

    // Read it back the way the Review tab does, and render a turn from it.
    let logs = await storage.listConversationLogs();
    assert.equal(logs.length, 1);
    const turns = model.buildTurns(logs[0].data);
    assert.equal(turns.length, 1);
    assert.equal(turns[0].partnerText, 'How was your week?');
    assert.equal(turns[0].took, 0);

    // Record a correction and write it where review writes it.
    let review = model.normalizeReview(await storage.readReview(id), id);
    review = model.setCardAnswer(review, turns[0], 1, 'Not great, if I am honest.');
    review = model.setMisheard(review, turns[0], 'How was your weekend?');
    assert.ok(await storage.writeReview(id, review));

    // Off disk again: the correction is there, the conversation file is untouched, and
    // the review file is never mistaken for a conversation.
    const back = model.normalizeReview(await storage.readReview(id), id);
    const e = model.getEntry(back, turns[0].key);
    assert.equal(e.answer.text, 'Not great, if I am honest.');
    assert.equal(e.misheard.said, 'How was your weekend?');
    logs = await storage.listConversationLogs();
    assert.equal(logs.length, 1, 'the review file must not appear as a second conversation');
    assert.equal(logs[0].data.exchanges.some((x) => x.misheard || x.answer), false, 'the record of what happened is never rewritten');
    assert.equal(model.getEntry(model.normalizeReview(logs[0].review, id), turns[0].key).answer.index, 1, 'a backup carries the review with its conversation');

    // An import puts both back.
    const files = root._dirs.get('conversations')._files;
    files.clear();
    assert.ok(await storage.writeConversationLog(id, logs[0].data, logs[0].review));
    assert.ok(files.has(`${id}.json`) && files.has(`${id}.review.json`));

    // And on to the voice (Ken, October 3 2026): the reworded card read back off disk
    // becomes a voice example, through the same listing the app uses.
    const { harvest } = await import('../app/js/voice-harvest.js');
    const voice = harvest(await storage.listConversationLogs());
    assert.deepEqual(voice.exemplars, ['Not great, if I am honest.']);

    // The list's date range: an old conversation is skipped by its name, unopened, and
    // counted, while one with no date in its name is always read.
    await storage.writeConversationLog('2025-01-01T09-00-00', { exchanges: [] });
    await storage.writeConversationLog('imported-without-a-date', { exchanges: [] });
    const recent = await storage.listConversationLogs({ since: '2026-01-01' });
    assert.deepEqual(recent.map((c) => c.id).sort(), [id, 'imported-without-a-date'].sort());
    assert.equal(recent.older, 1);
    assert.equal((await storage.listConversationLogs()).length, 3, 'with no range, everything is read');
});

/* ── The table on the Conversation Review tab ──────────────────────────────────── */

test('where you got to: not looked at, part way through, finished', () => {
    let r = model.emptyReview('c');
    assert.equal(model.progressOf(r, 6).label, 'not looked at');
    r = model.markReached(r, 1);
    assert.equal(model.progressOf(r, 6).label, 'part way through — 4 of 6 left');
    r = model.markReached(r, 0);              // going back does not undo progress
    assert.equal(r.reached, 1);
    r = model.markReached(r, 5);
    assert.equal(model.progressOf(r, 6).label, 'finished');
    // It survives being saved and read back.
    assert.equal(model.normalizeReview(JSON.parse(JSON.stringify(r)), 'c').reached, 5);
});

test('the table sorts by any column, both ways, with newest first breaking ties', () => {
    const rows = [
        { id: 'a', started: '2026-09-20T10:00:00Z', who: 'Marcus', where: 'Diner', durationMs: 900000, progressRank: 1 },
        { id: 'b', started: '2026-09-22T10:00:00Z', who: 'Mom', where: 'Home', durationMs: 300000, progressRank: 0 },
        { id: 'c', started: '2026-09-21T10:00:00Z', who: 'Dr. Ruiz', where: 'Clinic', durationMs: 600000, progressRank: 2 },
        { id: 'd', started: '2026-09-23T10:00:00Z', who: 'Mom', where: 'Clinic', durationMs: 60000, progressRank: 0 },
    ];
    const ids = (col, asc) => model.sortRows(rows, col, asc).map((r) => r.id).join('');
    assert.equal(ids('when', false), 'dbca');
    assert.equal(ids('when', true), 'acbd');
    assert.equal(ids('who', true), 'cadb');      // Dr. Ruiz, Marcus, then both Moms newest first
    assert.equal(ids('where', true), 'dcab');
    assert.equal(ids('length', false), 'acbd');
    assert.equal(ids('progress', true), 'dbac');
});

// CR-047. Undo/Redo closes the typing box, as moving to another turn does.
test('undo and redo close the composition pane', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../app/js/review-ui.js', import.meta.url), 'utf8');
    const at = src.indexOf('function stepHistory(');
    assert.match(src.slice(at, at + 900), /stopEditing\(\);[\s\S]{0,300}closeComposer\(\);/);
});

// CR-258. A phrase answer keeps its own respelling, so Hear it says it as the panel
// does; a sound answer never carries one.
test('a phrase answer keeps its respelling; a sound answer does not', () => {
    const [first] = model.buildTurns(sampleConversation());
    let r = model.setPhraseAnswer(model.emptyReview('c'), first, { itemId: 'v', text: 'Volksswitch', speak: 'Folks-switch' });
    assert.equal(model.getEntry(r, first.key).answer.speak, 'Folks-switch');
    r = model.setPhraseAnswer(r, first, { itemId: 's', text: 'Birthday song', sound: true, speak: 'x' });
    assert.equal(model.getEntry(r, first.key).answer.speak, null);
    r = model.setPhraseAnswer(r, first, { itemId: 'p', text: 'Yes', speak: 'Yes' });
    assert.equal(model.getEntry(r, first.key).answer.speak, null, 'the same words need no respelling');
});

// CR-259. The "misheard" note can be taken back, and a turn with nothing else on it
// then leaves the review file entirely.
test('clearing the misheard note drops an otherwise empty entry', () => {
    const [first] = model.buildTurns(sampleConversation());
    let r = model.setMisheard(model.emptyReview('c'), first, 'something');
    assert.ok(model.getEntry(r, first.key).misheard);
    r = model.clearMisheard(r, first);
    const e = model.getEntry(r, first.key);
    assert.ok(!e || !e.misheard);
});
