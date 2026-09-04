/* Tier 2 — the REAL storage layer writing a REAL conversation file.
 *
 * WHY THIS EXISTS (Ken, August 21 2026). Every conversation-logging change here has
 * been signed off with the same caveat: "the on-disk write needs a granted data
 * folder, which the preview cannot produce." Ken pushed back on it — the folder was
 * never the obstacle. The File System Access API only hands a folder to the browser
 * through a native dialog nobody can click from automation, but that is not the only
 * way `storage.js` gets a root: with no folder picker present it adopts the
 * browser's own private filesystem instead, and that needs no gesture at all. That
 * is the iPad path, and it goes through exactly the same code.
 *
 * So the whole write path is exercised here: `startConversationLog`,
 * `logPartnerInterim`, `detachPendingPartnerTurn`, `finalizePartnerTurn` and the
 * flush, against a directory that behaves like the real thing. The file is then read
 * back and asserted — not the helper's return value, the bytes that were written.
 *
 * ⚠ THE POINT IS THE PARTS THE PURE TESTS CANNOT REACH: that a pending turn is
 * tracked across separate calls, that a flush writes valid JSON, that the private
 * conversation gate really does stop a write, and that the revision history survives
 * the round trip to storage rather than only existing in memory.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../app/js/usage-summary.js';

/* ── A directory handle that behaves like the browser's ───────────────────── */

function makeDir(name = '') {
    const files = new Map();
    const dirs = new Map();
    return {
        kind: 'directory', name,
        async getDirectoryHandle(n, opts = {}) {
            if (!dirs.has(n)) {
                if (!opts.create) throw new Error('NotFoundError');
                dirs.set(n, makeDir(n));
            }
            return dirs.get(n);
        },
        async getFileHandle(n, opts = {}) {
            if (!files.has(n)) {
                if (!opts.create) throw new Error('NotFoundError');
                files.set(n, { name: n, data: '' });
            }
            const rec = files.get(n);
            return {
                kind: 'file', name: n,
                async getFile() {
                    return { size: rec.data.length, text: async () => rec.data };
                },
                async createWritable({ keepExistingData = false } = {}) {
                    let buf = keepExistingData ? rec.data : '';
                    let pos = buf.length;
                    return {
                        async write(chunk) { buf = buf.slice(0, pos) + chunk; pos = buf.length; },
                        async seek(p) { pos = p; },
                        async close() { rec.data = buf; },
                    };
                },
            };
        },
        async removeEntry(n) { files.delete(n); dirs.delete(n); },
        async *entries() {
            for (const [k] of files) yield [k, { kind: 'file', name: k }];
            for (const [k, v] of dirs) yield [k, v];
        },
        _files: files, _dirs: dirs,
    };
}

/* ── The browser globals storage.js reaches for ───────────────────────────── */

const root = makeDir('root');
const store = new Map();

globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
// Deliberately WITHOUT showDirectoryPicker: that is what sends storage.js down the
// device-storage path, which is the one that needs no user gesture.
globalThis.window = { dispatchEvent() { return true; } };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
// Node 21+ defines navigator as a getter-only global, so it is redefined rather
// than assigned. storage.js only ever reads navigator.storage.
Object.defineProperty(globalThis, 'navigator', {
    value: { storage: { getDirectory: async () => root } },
    configurable: true, writable: true,
});
globalThis.indexedDB = undefined;   // only the picker path touches it

const storage = await import('../app/js/storage.js');

async function readLog(id) {
    const dir = await root.getDirectoryHandle('conversations');
    const fh = await dir.getFileHandle(`${id}.json`);
    return JSON.parse(await (await fh.getFile()).text());
}

/* ── The tests ────────────────────────────────────────────────────────────── */

test('the app adopts device storage when there is no folder to pick', async () => {
    const ok = await storage.restoreDataFolder();
    assert.equal(ok, true);
    assert.equal(storage.hasDataFolder(), true);
    // And it knows this is not a folder the user can see, so the UI does not offer
    // to open one.
    assert.equal(storage.supportsUserChosenFolder(), false);
});

test('connecting the data folder creates all three subfolders, before anything is saved', async () => {
    // (!) WHY THIS IS ASSERTED ON DISK RATHER THAN BY CALLING THE GETTERS: the point
    // of the change is that the folders exist BEFORE anything asks for one. Ken's
    // reason is moving a file between devices - copying a settings profile or a
    // backup across should mean dropping it into a folder that is already sitting
    // there and pressing Load, not hunting for somewhere to put it. Asking a getter
    // to make the folder and then finding it there would prove nothing.
    //
    // restoreDataFolder() has already run in the first test, so this reads the state
    // it left behind: no conversation has been saved, no profile written, no backup
    // taken, and all three must be present regardless.
    const names = [...root._dirs.keys()].sort();
    assert.deepEqual(names, ['backups', 'conversations', 'settings']);
});

test('reconnecting a folder that already has the subfolders changes nothing', async () => {
    // It runs on EVERY connection, not just the first pick - which is the half that
    // reaches devices whose folder was chosen months ago. Creating a folder that is
    // already there has to be a no-op, and must not disturb what is in it.
    const dir = await root.getDirectoryHandle('backups');
    await (await dir.getFileHandle('keep-me.json', { create: true }))
        .createWritable().then(w => w.write('{"a":1}').then(() => w.close()));

    await storage.restoreDataFolder();

    assert.deepEqual([...root._dirs.keys()].sort(), ['backups', 'conversations', 'settings']);
    const again = await root.getDirectoryHandle('backups');
    const fh = await again.getFileHandle('keep-me.json');
    assert.equal(await (await fh.getFile()).text(), '{"a":1}', 'reconnecting must not wipe a backup');
});

test('a partner turn is written to disk with its revision history', async () => {
    storage.setConversationSaving(true);
    storage.setSttBackend('browser');
    await storage.startConversationLog();
    const id = storage.getConversationId();
    assert.ok(id, 'a conversation id is minted at the start, not at the first turn');

    // Three pauses in one partner turn — the case that used to be flattened.
    await storage.logPartnerInterim({ rawTranscript: 'so how have you' });
    await storage.logPartnerInterim({ rawTranscript: 'so how have you been' });
    await storage.logPartnerInterim({ rawTranscript: 'so how have you been keeping' });

    const log = await readLog(id);
    const partner = log.exchanges.filter(e => e.role === 'partner');
    assert.equal(partner.length, 1, 'one turn, not three');
    assert.equal(partner[0].rawTranscript, 'so how have you been keeping');
    assert.deepEqual(partner[0].revisions.map(r => r.text), [
        'so how have you', 'so how have you been', 'so how have you been keeping',
    ], 'and the file itself carries what was heard at each pause');
    assert.ok(partner[0].revisions.every(r => typeof r.at === 'string' && r.at.length),
        'each revision is stamped with the pause it belongs to');
    assert.equal(partner[0].stt, 'browser', 'and which recogniser heard it');
});

test('finalizing fills the cleaned line in place, keeping the turn before the user', async () => {
    const id = storage.getConversationId();
    const handle = storage.detachPendingPartnerTurn();
    await storage.finalizePartnerTurn(handle, {
        rawTranscript: 'so how have you been keeping',
        cleanedTranscript: 'So how have you been keeping?',
    });
    const log = await readLog(id);
    const partner = log.exchanges.filter(e => e.role === 'partner');
    assert.equal(partner.length, 1);
    assert.equal(partner[0].cleanedTranscript, 'So how have you been keeping?');
    assert.equal(partner[0].revisions.length, 3, 'finalizing added nothing — the text was unchanged');
});

test('a later partner turn appends rather than overwriting the finalized one', async () => {
    const id = storage.getConversationId();
    await storage.logPartnerInterim({ rawTranscript: 'and the knee' });
    const log = await readLog(id);
    const partner = log.exchanges.filter(e => e.role === 'partner');
    assert.equal(partner.length, 2);
    assert.equal(partner[1].rawTranscript, 'and the knee');
    assert.equal(partner[1].revisions.length, 1);
});

test('an error is interleaved into the conversation file in time order', async () => {
    const id = storage.getConversationId();
    storage.logError('generateOptions', 'API error 429: rate limited');
    await new Promise(r => setTimeout(r, 20));   // the write is fire-and-forget
    const log = await readLog(id);
    const errs = log.exchanges.filter(e => e.role === 'error');
    assert.equal(errs.length, 1);
    assert.equal(errs[0].context, 'generateOptions');
    assert.match(errs[0].message, /429/);
});

test('"Don\'t save this conversation" really does stop the write', async () => {
    // ⚠ The gate is asserted against the FILE, not against a return value: this is
    // the promise both manuals make, and the only proof is that nothing landed.
    storage.setConversationSaving(false);
    const before = await readLog(storage.getConversationId());
    await storage.logPartnerInterim({ rawTranscript: 'my results came back from the clinic' });
    const after = await readLog(storage.getConversationId());
    assert.deepEqual(after.exchanges.length, before.exchanges.length,
        'nothing was appended while the conversation was private');
    assert.ok(!JSON.stringify(after).includes('clinic'), 'and none of it reached the file');
    storage.setConversationSaving(true);
});

test('the written file is valid JSON with the shape a later reader expects', async () => {
    const log = await readLog(storage.getConversationId());
    assert.equal(typeof log.started, 'string');
    assert.ok(Array.isArray(log.exchanges));
    for (const e of log.exchanges) assert.ok(e.role, 'every entry says what it is');
});

/* ── The hearing measure, end to end (Ken, August 27 2026) ─────────────────────
 *
 * ⚠ THE CHECK THAT CROSSES THE LAYERS, and it belongs here rather than beside the
 * summary's own tests for exactly the reason the standing rule gives: those tests
 * FABRICATE the records they count, so they prove the counter and nothing about
 * whether the app ever writes a record it can count. Here the real storage layer
 * writes the file and the summary reads back what it wrote.
 *
 * Same shape as the number-button failure: the parser was fine, the renderer was
 * fine, and the field was dropped in the one link nothing ran.
 */
test('a doubted word survives to disk and reaches the summary, with who and where', async () => {
    // Its own conversation file: startConversationLog is idempotent by design, so
    // without this it would append to the one the tests above built.
    storage.resetConversationId();
    storage.setConversationSaving(true);
    storage.setSttBackend('browser');
    await storage.startConversationLog();
    const id = storage.getConversationId();

    const who = { id: 'p1', label: 'Mom' };
    const where = { id: 'l1', label: 'The cafe' };
    const say = async (text, uncertain) => {
        await storage.logPartnerInterim({ rawTranscript: text });
        await storage.finalizePartnerTurn(storage.detachPendingPartnerTurn(), {
            rawTranscript: text, cleanedTranscript: text, partner: who, place: where, uncertain,
        });
    };
    await say('i can make it on saturday', ['can']);
    await say('that sounds good to me', []);
    await say('see you there then', []);

    const data = await readLog(id);
    const partnerTurns = data.exchanges.filter(e => e.role === 'partner');
    assert.equal(partnerTurns.length, 3);
    assert.deepEqual(partnerTurns[0].uncertain, ['can'], 'the flag is on disk, not just in memory');
    assert.deepEqual(partnerTurns[1].uncertain, [], 'and an empty list is written, not omitted');
    assert.equal(partnerTurns[0].place.label, 'The cafe',
        'the partner turn carries WHERE — the half a per-room reading has to come from');

    const s = summarize([{ id, data }]);
    assert.equal(s.hearing.recorded, 3);
    assert.equal(s.hearing.flagged, 1);
    assert.equal(s.hearingByPartner.Mom.flagged, 1);
    assert.equal(s.hearingByPlace['The cafe'].turns, 3);
    assert.equal(s.hearingByRecognizer.browser.flagged, 1);

    // ⚠ AND THE WORD ITSELF STAYS OUT OF WHAT GETS SENT, asserted again on a summary
    // built from a file the app actually wrote.
    assert.ok(!JSON.stringify(s).includes('saturday'));
});

test('the tidy-up is gone: a committed partner turn is stored exactly as heard', async () => {
    const data = await readLog(storage.getConversationId());
    const first = data.exchanges.find(e => e.role === 'partner');
    // The field is KEPT — every reader of an older conversation still expects it, and
    // files written while the tidy-up existed genuinely hold a different value.
    assert.equal(first.cleanedTranscript, first.rawTranscript);
});

/* ── The tester name survives everything that replaces settings ───────────── */

/* (!) WHY THESE EXIST (Ken, September 4 2026). He described the field sequence that
 * breaks it, and it is an ordinary one: set the UI up, save a profile, THEN type the
 * tester name, and later reload that profile to undo a setting you regret. The reload
 * used to blank the name, because a profile replaces the whole bundle with whatever it
 * happens to carry — and nobody looks afterwards, because they set it once and assume
 * it stuck. Everything they send from then on is anonymous.
 *
 * ⚠ THE SECOND TEST IS THE IMPORTANT ONE, and it is the case that decided the fix: a
 * name in a BACKUP is not blanked, it is INHERITED. Two backups in Ken's own folder an
 * hour apart carry 'Ken - Laptop' and 'Ken - Desktop'. Restoring one onto the other
 * machine makes it report under the wrong name, and a starter backup handed to a new
 * tester would make their device report as Ken. A plausible wrong name is never
 * questioned, where a missing one shows up as '(not set)' and gets chased.
 *
 * Driven through the real profile writer and reader against a real folder, because the
 * bug lived in the merge between them and not in either end. */
test('reloading a settings profile cannot blank the tester name', async () => {
    await storage.restoreDataFolder();
    // The sequence Ken described: settings saved as a profile BEFORE the name is typed.
    storage.saveSilenceThreshold(2000);
    await storage.saveSettingsProfile('before naming');
    storage.saveTesterName('SLP 2 - iPad');

    await storage.applySettingsProfile('before naming');
    assert.equal(storage.loadTesterName(), 'SLP 2 - iPad');
    // The profile still did its actual job.
    assert.equal(storage.loadSilenceThreshold(), 2000);

    // And a profile written now carries no name at all, so it cannot revive a stale
    // one later either — nor leak a tester's name into a file they share.
    await storage.saveSettingsProfile('after naming');
    const dir = await root.getDirectoryHandle('settings');
    const fh = await dir.getFileHandle('after naming.json');
    const saved = JSON.parse(await (await fh.getFile()).text());
    assert.equal('testerName' in saved.settings, false);
});

test('importing a backup cannot rename this device to somebody else', async () => {
    await storage.restoreDataFolder();
    storage.saveTesterName('SLP 2 - iPad');
    // A backup made on a different machine, of the kind handed to a new tester.
    storage.applyPortableSettings({ testerName: 'Ken - Laptop', silenceThreshold: 1500 });
    assert.equal(storage.loadTesterName(), 'SLP 2 - iPad');
    assert.equal(storage.loadSilenceThreshold(), 1500);

    // A device that has never been named stays visibly unnamed rather than borrowing
    // one. '(not set)' in the Sheet is a question somebody asks; a wrong name is not.
    storage.saveTesterName('');
    storage.applyPortableSettings({ testerName: 'Ken - Laptop' });
    assert.equal(storage.loadTesterName(), '');
});
