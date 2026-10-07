/* Conversation Review — the reading half, the answer record (one rewrite per turn), and ONE
 * check that runs the whole chain (design document §13.5): a conversation written by
 * the real storage layer, read back, split into turns, a correction recorded, and the
 * correction read back off disk. Three checks that each exercised one layer would all
 * pass with the feature dead, which has happened in this app before.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../app/js/review-model.js';

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

/* ── The review record: one rewrite per turn (Ken, October 6 2026) ─────────────── */

test('a rewrite is recorded with the moment it belongs to', () => {
    const [first] = model.buildTurns(sampleConversation());
    const r = model.setRewrite(model.emptyReview('c'), first, 'Long, honestly. Glad it is over.');
    const a = model.getEntry(r, first.key).answer;
    assert.equal(a.kind, 'rewrite');
    assert.equal(a.text, 'Long, honestly. Glad it is over.');
    assert.equal(a.moment.partner, 'Mom');
    assert.equal(a.moment.partnerId, 'p1');
    assert.equal(a.moment.place, 'Home');
    assert.equal(a.moment.partnerText, 'How was your week?');
    assert.equal(a.moment.spokenSlot, 'PREFERRED');
});

test('writing back what was said at the time records nothing; clearing takes a rewrite back', () => {
    const [first] = model.buildTurns(sampleConversation());
    let r = model.setRewrite(model.emptyReview('c'), first, 'Pretty good, thanks.');
    assert.equal(model.touchedCount(r), 0);
    r = model.setRewrite(r, first, 'Good, but tiring.');
    assert.equal(model.touchedCount(r), 1);
    r = model.clearAnswer(r, first);
    assert.equal(model.touchedCount(r), 0);
});

test('the review never carries the conversation\'s own record, only the turn key', () => {
    const [first] = model.buildTurns(sampleConversation());
    const r = model.setRewrite(model.emptyReview('c'), first, 'Good, but tiring.');
    assert.deepEqual(Object.keys(r.turns), [first.key]);
    const back = model.normalizeReview(JSON.parse(JSON.stringify(r)), 'c');
    assert.deepEqual(back.turns, r.turns);
});

test('undo steps back one action at a time, and redo puts it back', () => {
    const [first] = model.buildTurns(sampleConversation());
    const h = model.createHistory();
    let r = model.emptyReview('c');
    h.push(r, first.key); r = model.setRewrite(r, first, 'Not my best week.');
    h.push(r, first.key); r = model.setRewrite(r, first, 'Not my best week, honestly.');
    let u = h.undo(r, first.key); r = u.state;
    assert.equal(model.getEntry(r, first.key).answer.text, 'Not my best week.');
    u = h.undo(r, first.key); r = u.state;
    assert.equal(model.touchedCount(r), 0);
    assert.equal(h.undo(r, first.key), null);
    r = h.redo(r, first.key).state;
    assert.equal(model.getEntry(r, first.key).answer.text, 'Not my best week.');
});

test('what the other person was doing is read from the saved set of options', () => {
    const data = sampleConversation();
    data.exchanges.find((e) => e.role === 'offer').partnerAction = 'QUESTION';
    const [first] = model.buildTurns(data);
    assert.equal(first.partnerAction, 'QUESTION');
    assert.equal(model.buildTurns(sampleConversation())[0].partnerAction, null, 'older files have none');
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
    await storage.logOffer({ kind: 'ai', options: offer, partnerAction: 'QUESTION' });
    await storage.finalizeOffer({ outcome: 'card', selectedIndex: 0, shownMs: 1200 });
    const handle = storage.detachPendingPartnerTurn();
    await storage.finalizePartnerTurn(handle, { rawTranscript: 'how was your week', cleanedTranscript: 'How was your week?' });
    await storage.logUserResponse({ selectedText: 'Pretty good.', selectedIndex: 0, allOptions: offer.map((o) => o.text), selectedSlot: 'PREFERRED', source: 'card', partner: { id: 'p-mom', label: 'Mom' } });
    const id = storage.getConversationId();
    storage.resetConversationId();

    // Read it back the way the Review tab does, and render a turn from it.
    let logs = await storage.listConversationLogs();
    assert.equal(logs.length, 1);
    const turns = model.buildTurns(logs[0].data);
    assert.equal(turns.length, 1);
    assert.equal(turns[0].partnerText, 'How was your week?');
    assert.equal(turns[0].took, 0);

    // Record a rewrite and write it where review writes it.
    let review = model.normalizeReview(await storage.readReview(id), id);
    review = model.setRewrite(review, turns[0], 'Not great, if I am honest.');
    assert.ok(await storage.writeReview(id, review));

    // Off disk again: the rewrite is there, the conversation file is untouched, and
    // the review file is never mistaken for a conversation.
    const back = model.normalizeReview(await storage.readReview(id), id);
    const e = model.getEntry(back, turns[0].key);
    assert.equal(e.answer.text, 'Not great, if I am honest.');
    assert.equal(e.answer.moment.partnerId, 'p-mom');
    logs = await storage.listConversationLogs();
    assert.equal(logs.length, 1, 'the review file must not appear as a second conversation');
    assert.equal(logs[0].data.exchanges.some((x) => x.answer), false, 'the record of what happened is never rewritten');
    assert.equal(model.getEntry(model.normalizeReview(logs[0].review, id), turns[0].key).answer.text, 'Not great, if I am honest.', 'a backup carries the review with its conversation');

    // An import puts both back.
    const files = root._dirs.get('conversations')._files;
    files.clear();
    assert.ok(await storage.writeConversationLog(id, logs[0].data, logs[0].review));
    assert.ok(files.has(`${id}.json`) && files.has(`${id}.review.json`));

    // And on to the AI (Ken, October 6 2026): the rewrite read back off disk becomes a
    // pair kept for Mom, through the same listing, the same voice profile and the same
    // block builder the app uses - and nothing for anyone else.
    const { harvest } = await import('../app/js/voice-harvest.js');
    const result = harvest(await storage.listConversationLogs());
    assert.deepEqual(result.exemplars, [], 'a sentence written for Mom is not shared with everyone');
    const voiceProfile = await import('../app/js/voice.js');
    await voiceProfile.setHarvest(result);
    const block = voiceProfile.buildReviewBlock('Mom', voiceProfile.reviewPairsFor('p-mom'));
    assert.match(block, /Mom asked a question: "How was your week\?" This user would rather have said: "Not great, if I am honest\."/);
    assert.equal(voiceProfile.buildReviewBlock('Devon', voiceProfile.reviewPairsFor('p-devon')), '');

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
    assert.match(src.slice(at, at + 900), /closeComposer\(\);/);
});


