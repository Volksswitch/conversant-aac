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

let writeDelayMs = 0;

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
                    // Real createWritable is genuinely asynchronous; a test can make
                    // it slow to open the window a race needs (CR-001).
                    if (writeDelayMs) await new Promise(r => setTimeout(r, writeDelayMs));
                    let buf = keepExistingData ? rec.data : '';
                    let pos = buf.length;
                    return {
                        async write(chunk) { buf = buf.slice(0, pos) + chunk; pos = buf.length; },
                        async seek(p) { pos = p; },
                        async close() { if (writeDelayMs) await new Promise(r => setTimeout(r, writeDelayMs)); rec.data = buf; },
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

test('connecting the data folder creates all four subfolders, before anything is saved', async () => {
    // (!) WHY THIS IS ASSERTED ON DISK RATHER THAN BY CALLING THE GETTERS: the point
    // of the change is that the folders exist BEFORE anything asks for one. Ken's
    // reason is moving a file between devices - copying a settings profile or a
    // backup across should mean dropping it into a folder that is already sitting
    // there and pressing Load, not hunting for somewhere to put it. Asking a getter
    // to make the folder and then finding it there would prove nothing.
    //
    // restoreDataFolder() has already run in the first test, so this reads the state
    // it left behind: no conversation has been saved, no profile written, no backup
    // taken, and all four must be present regardless. (The fourth, audio, holds the
    // clips behind Express Panel sound buttons - September 14 2026.)
    const names = [...root._dirs.keys()].sort();
    assert.deepEqual(names, ['audio', 'backups', 'conversations', 'settings']);
});

test('reconnecting a folder that already has the subfolders changes nothing', async () => {
    // It runs on EVERY connection, not just the first pick - which is the half that
    // reaches devices whose folder was chosen months ago. Creating a folder that is
    // already there has to be a no-op, and must not disturb what is in it.
    const dir = await root.getDirectoryHandle('backups');
    await (await dir.getFileHandle('keep-me.json', { create: true }))
        .createWritable().then(w => w.write('{"a":1}').then(() => w.close()));

    await storage.restoreDataFolder();

    assert.deepEqual([...root._dirs.keys()].sort(), ['audio', 'backups', 'conversations', 'settings']);
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

test('a private conversation keeps the error but not the AI\'s unreadable reply', async () => {
    // The reply is words about the conversation, exactly like the partner's speech
    // beside it, so the same privacy backstop has to remove both.
    storage.setConversationSaving(false);
    const entry = storage.logError('generateOptions', 'Could not parse responses from API',
        { partner: 'my results came back', reply: 'Card, please.' });
    storage.setConversationSaving(true);
    assert.ok(entry, 'the error itself is still recorded');
    assert.ok(!entry.extra || (!('partner' in entry.extra) && !('reply' in entry.extra)),
        'neither the partner\'s words nor the AI\'s reply survive');
    const kept = storage.loadErrorLog().at(-1);
    assert.ok(!JSON.stringify(kept).includes('Card, please'), 'and the stored copy carries neither');
});

// CR-193. Log text is plain ASCII in every sink, and that includes the extra fields:
// the AI's reply and the recognizer's text often carry dashes and curly quotes.
test('error extras are written as plain text, keeping accented letters', async () => {
    const entry = storage.logError('generateOptions', 'x', { reply: 'a — “b”…', partner: 'José' });
    const stored = JSON.stringify(storage.loadErrorLog().at(-1));
    for (const ch of ['—', '“', '”', '…']) {
        assert.ok(!JSON.stringify(entry).includes(ch) && !stored.includes(ch), ch);
    }
    assert.equal(entry.extra.partner, 'José', 'a name is not stripped');
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

test('turning "Don\'t save" on part-way marks the saved turns private, without deleting them (CR-074)', async () => {
    storage.detachPendingPartnerTurn();   // a fresh partner turn (CR-214 holds back one heard in private)
    await storage.logPartnerInterim({ rawTranscript: 'the diagnosis was not what we hoped' });
    const id = storage.getConversationId();
    storage.setConversationSaving(false);
    await storage.whenLogWritten();
    const log = await readLog(id);
    assert.equal(log.private, true, 'the file says it is private');
    assert.ok(JSON.stringify(log).includes('diagnosis'), 'the earlier turn is not deleted');
    storage.setConversationSaving(true);
    // Saving is back on, so only the persistent marks can still say so - which is what a
    // report built after the conversation has ended relies on.
    assert.equal(storage.isConversationPrivate(id, null), true, 'remembered by id');
    assert.equal(storage.isConversationPrivate(id, log), true, 'and by the file');
    assert.equal(storage.isConversationPrivate('some-other-id', null), false);
    // The report checks privacy BEFORE it prints the transcript on disk.
    const app = (await import('node:fs')).readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
    const body = app.slice(app.indexOf('async function buildErrorReport'));
    assert.ok(body.indexOf('isConversationPrivate') < body.indexOf("out.push('Transcript:')"));
    assert.match(body, /e\.extra && !isPrivate/);
});

test('a card picked after going private is not recorded (CR-076)', async () => {
    await storage.logOffer({ options: [{ text: 'first' }, { text: 'second' }] });
    const id = storage.getConversationId();
    storage.setConversationSaving(false);
    assert.equal(storage.hasPendingOffer(), false);
    await storage.finalizeOffer({ outcome: 'card', selectedIndex: 1 });
    await storage.whenLogWritten();
    const offers = (await readLog(id)).exchanges.filter((e) => e.role === 'offer');
    const last = offers[offers.length - 1];
    assert.equal(last.outcome ?? null, null);
    assert.equal(last.selectedIndex ?? null, null);
    storage.setConversationSaving(true);
});

// CR-214. The partner's words arrive as the whole turn so far, so a turn heard partly
// while the conversation was private must not be written out complete once saving
// resumes - neither at the next pause nor when the user answers.
test('words heard while private never reach the file after saving resumes (CR-214)', async () => {
    storage.detachPendingPartnerTurn();
    await storage.logPartnerInterim({ rawTranscript: 'my test results came back' });
    const id = storage.getConversationId();
    storage.setConversationSaving(false);
    await storage.logPartnerInterim({ rawTranscript: 'my test results came back and it is serious' });
    storage.setConversationSaving(true);
    await storage.logPartnerInterim({ rawTranscript: 'my test results came back and it is serious but treatable' });
    const h = storage.detachPendingPartnerTurn();
    await storage.finalizePartnerTurn(h, { rawTranscript: 'my test results came back and it is serious but treatable',
        cleanedTranscript: 'My test results came back and it is serious but treatable.' });
    await storage.whenLogWritten();
    const text = JSON.stringify(await readLog(id));
    assert.ok(text.includes('my test results came back'), 'what was saved before stays');
    assert.ok(!text.includes('serious'), 'nothing heard in private is written');
    // The next turn records normally.
    await storage.logPartnerInterim({ rawTranscript: 'see you next week' });
    await storage.whenLogWritten();
    assert.ok(JSON.stringify(await readLog(id)).includes('see you next week'));
});

test('a turn that never reached the file before going private is not appended whole (CR-214)', async () => {
    storage.detachPendingPartnerTurn();
    const id = storage.getConversationId();
    storage.setConversationSaving(false);
    storage.setConversationSaving(true);
    const h = storage.detachPendingPartnerTurn();
    await storage.finalizePartnerTurn(h, { rawTranscript: 'something private', cleanedTranscript: 'Something private.' });
    await storage.whenLogWritten();
    assert.ok(!JSON.stringify(await readLog(id)).includes('omething private'));
});

// CR-216. Two errors at the same moment both reach errors.log, in order: appends used
// to start from the same copy of the file, and the last close discarded the first line.
test('two errors logged together both reach errors.log, in order', async () => {
    writeDelayMs = 5;
    try {
        storage.logError('first', 'ALPHA_ERROR');
        storage.logError('second', 'BETA_ERROR');
        await new Promise((r) => setTimeout(r, 80));
    } finally { writeDelayMs = 0; }
    const text = await (await (await root.getFileHandle('errors.log')).getFile()).text();
    assert.ok(text.includes('ALPHA_ERROR') && text.includes('BETA_ERROR'), text);
    assert.ok(text.indexOf('ALPHA_ERROR') < text.indexOf('BETA_ERROR'));
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
test('a profile or a backup cannot turn automatic reports back on (CR-075)', async () => {
    await storage.restoreDataFolder();
    await storage.saveSettingsProfile('before opting out');   // saved with the switch untouched
    storage.saveWeeklySendEnabled(false);
    await storage.applySettingsProfile('before opting out');
    assert.equal(storage.loadWeeklySendEnabled(), false, 'loading an older profile');
    storage.applyPortableSettings({ weeklySendEnabled: true });
    assert.equal(storage.loadWeeklySendEnabled(), false, 'restoring a backup');
    await storage.saveSettingsProfile('after opting out');
    const dir = await root.getDirectoryHandle('settings');
    const saved = JSON.parse(await (await (await dir.getFileHandle('after opting out.json')).getFile()).text());
    assert.equal('weeklySendEnabled' in saved.settings, false);
    assert.equal(storage.reportableSettings().weeklySendEnabled, false, 'still visible in a problem report');
    storage.saveWeeklySendEnabled(true);
});

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

/* ── SEC-6: a speech key must never leave this device ─────────────────────── */

test('NO API KEY reaches a settings profile, a backup, or a problem report', async () => {
    // ⚠ ASSERTED ON THE BYTES, not on an exclusion list, and asserted for EVERY key
    // rather than the one just added. The failure this guards is silent by
    // construction: the app works perfectly with a key sitting in a file, and the file
    // is one that gets copied to a cloud drive (a settings profile, a backup) or mailed
    // to us (a problem report). Nothing would ever surface it.
    //
    // It is written as a loop over storage.SECRET_KEYS rather than as three named
    // checks, so a fourth credential is covered the moment it is added to that list —
    // which is the whole reason the list exists.
    await storage.restoreDataFolder();
    // Every secret gets a DISTINCT value, so a leak names which one leaked.
    // ⚠ SET FROM storage.SECRET_KEYS ITSELF rather than from a hand-written list: the
    // point of this test is that a new credential is covered the moment it joins that
    // list, and a fixed list of three setters here would have quietly stopped covering
    // the sixth. Adding a service means adding one line to SETTERS below, and the
    // assertion at the end fails until you do.
    const SETTERS = {
        apiKey: (v) => storage.saveApiKey(v),
        deepgramKey: (v) => storage.saveDeepgramKey(v),
        azureKey: (v) => storage.saveAzureKey(v),
        openaiKey: (v) => storage.saveServiceKey('openai', v),
        googleKey: (v) => storage.saveServiceKey('google', v),
        elevenlabsKey: (v) => storage.saveServiceKey('elevenlabs', v),
    };
    const secrets = {};
    for (const k of storage.SECRET_KEYS) {
        assert.ok(SETTERS[k], `no setter in this test for the secret "${k}" — add one`);
        secrets[k] = `secret-value-for-${k}`;
        SETTERS[k](secrets[k]);
    }
    // The region is NOT a secret and must travel, so a restored setup asks only for
    // the key. Losing it would leave a good key pointed at the wrong service.
    storage.saveAzureRegion('westeurope');

    assert.ok(storage.SECRET_KEYS.includes('azureKey'), 'the Azure key is declared a secret');

    await storage.saveSettingsProfile('with keys');
    const dir = await root.getDirectoryHandle('settings');
    const fh = await dir.getFileHandle('with keys.json');
    const text = await (await fh.getFile()).text();
    const saved = JSON.parse(text);

    for (const k of storage.SECRET_KEYS) {
        assert.equal(k in saved.settings, false, `${k} must not be written to a profile`);
    }
    // Belt and braces: the VALUES must not appear anywhere in the file, whatever key
    // they might have been stored under.
    for (const secret of Object.values(secrets)) {
        assert.equal(text.includes(secret), false, `the file must not contain ${secret}`);
    }
    assert.equal(saved.settings.azureRegion, 'westeurope', 'the region does travel');

    // A problem report gets pasted into messages and mailed around, so it reports only
    // whether a key is SET — which is the diagnostic value — and never the key.
    const report = storage.reportableSettings();
    for (const k of storage.SECRET_KEYS) {
        assert.equal(report[k], '(set - not included)', `${k} must be redacted in a report`);
    }
    assert.equal(report.azureRegion, 'westeurope', 'but the region is reportable');

    // And a backup arriving from another device cannot plant a key on this one.
    storage.applyPortableSettings({ azureKey: 'someone-elses-key',
                                    openaiKey: 'someone-elses-openai-key',
                                    azureRegion: 'japaneast' });
    assert.equal(storage.loadAzureKey(), secrets.azureKey, 'the local key is untouched');
    assert.equal(storage.loadServiceKey('openai'), secrets.openaiKey,
                 'a catalog service key is untouched too');
    assert.equal(storage.loadAzureRegion(), 'japaneast', 'but the region is adopted');
});

test('the goals in force are written onto a user turn, and none is written as null', async () => {
    // ⚠ THE FAULT THIS GUARDS IS SILENT AND SHIPPED ONCE (Ken, September 10 2026): a
    // goal he had switched on before starting never appeared in the suggestions, and
    // the conversation file could not say whether it had been in force, because every
    // turn stamped who / how they felt / where they were and NOT what they were aiming
    // for. logUserResponse's signature is a whitelist, so the stamp app.js builds is
    // dropped here unless this list names it - the app carries on working perfectly
    // and the record is simply missing the one field the question needed.
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();

    const aiming = [
        { id: 'plans', text: 'Make plans together', source: 'partner' },
        { id: 'text:make breakfast together', text: 'Make breakfast together', source: 'general' },
    ];
    await storage.logUserResponse({
        selectedText: 'How about we make breakfast together?',
        selectedIndex: 0, allOptions: ['How about we make breakfast together?'],
        partner: { id: 'p1', label: 'Mom' }, goals: aiming,
    });
    // A turn with nothing switched on must stay null rather than an empty list, so a
    // reader can tell "no goals" from "goals were never recorded on this build".
    await storage.logUserResponse({
        selectedText: 'Sounds good.', selectedIndex: 0, allOptions: ['Sounds good.'],
        partner: { id: 'p1', label: 'Mom' },
    });

    const data = await readLog(id);
    const turns = data.exchanges.filter((e) => e.role === 'user');
    assert.equal(turns.length, 2);
    assert.deepEqual(turns[0].goals, aiming,
        'the goals reached disk, in order, with their text and where each came from');
    assert.equal(turns[1].goals, null, 'no goals switched on stays null, not []');
});

test('a set of cards nobody picked from is still written, with how it ended', async () => {
    // ⚠ THE BIAS THIS REMOVES (Ken, September 10 2026): a set the user picked from was
    // saved with all its options; a set that FAILED was thrown away. So the corpus for
    // judging suggestion quality held only the successes. His two cases are the
    // sharpest form of it - pressing "New 4" and turning to "In my own words" are the
    // user saying the set was not good enough, and we kept the complaint and binned
    // the evidence.
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();

    const set = (a, b) => ([{ slot: 'PREFERRED', text: a }, { slot: 'DISPREFERRED', text: b }]);

    // Offered, then the user asked for different options.
    await storage.logOffer({ kind: 'ai', options: set('Lunch somewhere?', 'Not today.') });
    await storage.finalizeOffer({ outcome: 'regenerate', shownMs: 4200 });
    // Offered again, and this time the other person carried on talking.
    await storage.logOffer({ kind: 'ai', options: set('Sounds good.', 'I would rather not.') });
    await storage.finalizeOffer({ outcome: 'superseded', shownMs: 900 });
    // Offered a third time and taken.
    await storage.logOffer({ kind: 'ai', options: set('Breakfast together?', 'Maybe not.') });
    await storage.finalizeOffer({ outcome: 'card', selectedIndex: 0, shownMs: 7800 });

    const data = await readLog(id);
    const offers = data.exchanges.filter((e) => e.role === 'offer');
    assert.equal(offers.length, 3, 'every set reached disk, not just the one taken');
    assert.deepEqual(offers.map((o) => o.outcome), ['regenerate', 'superseded', 'card'],
        'each carries HOW it ended - an offer without that is much weaker evidence');
    assert.equal(offers[0].options[0].text, 'Lunch somewhere?',
        'the words the user rejected are on disk, which is the whole point');
    assert.equal(offers[0].options[0].slot, 'PREFERRED',
        'and the slot, since "which kind got rejected" is its own question');
    assert.equal(offers[2].selectedIndex, 0, 'the taken one says which');
    assert.equal(offers[0].selectedIndex, null, 'and a rejected one says none');
    assert.equal(offers[1].shownMs, 900, 'how long it was up survives');

    // Time order: an offer sits before whatever followed it, like an error entry.
    const roles = data.exchanges.map((e) => e.role);
    assert.deepEqual(roles, ['offer', 'offer', 'offer'], 'interleaved in the exchanges array');
});

test('"Don\'t save this conversation" stops offers being written too', async () => {
    // The promise both manuals make covers what was SUGGESTED as well as what was said
    // - a rejected set is still four sentences about a private conversation.
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();
    storage.setConversationSaving(false);

    await storage.logOffer({ kind: 'ai', options: [{ slot: 'PREFERRED', text: 'Nothing private here.' }] });
    await storage.finalizeOffer({ outcome: 'superseded' });

    const data = await readLog(id);
    assert.equal(data.exchanges.filter((e) => e.role === 'offer').length, 0,
        'no offer is written for a conversation the user asked not to save');
    storage.setConversationSaving(true);
});

test('time zero carries whatever was already selected, and later changes are their own events', async () => {
    // ⚠ KEN'S RULE (September 10 2026): *"time zero is when the listen button or the
    // start conversation button is pressed. Any context selected prior to that is
    // simply recorded as if it had been selected simultaneously with the conversation
    // starting buttons."* So a partner tapped while the app sat idle needs no timestamp
    // of its own - it is part of the state the conversation began in.
    let live = { partner: { id: 'p1', label: 'Mom' }, feeling: null, place: null, goals: null };
    storage.setContextProvider(() => live);
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();

    // Mid-conversation the user says how they feel, then switches a goal on.
    live = { ...live, feeling: { id: 'f1', text: 'Happy' } };
    await storage.logContext('feeling');
    live = { ...live, goals: [{ id: 'plans', text: 'Make plans together', source: 'partner' }] };
    await storage.logContext('goal');

    const data = await readLog(id);
    const ctx = data.exchanges.filter((e) => e.role === 'context');
    assert.equal(data.exchanges[0].role, 'context',
        'the snapshot is entry ONE of the conversation, whatever created the log');
    assert.equal(ctx[0].trigger, 'start');
    assert.equal(ctx[0].partner.label, 'Mom',
        'selected before time zero, recorded as if selected with the start');
    assert.deepEqual(ctx.map((c) => c.trigger), ['start', 'feeling', 'goal']);
    assert.equal(ctx[2].partner.label, 'Mom',
        'each entry carries the FULL state, so a reader never accumulates');
    assert.equal(ctx[2].goals[0].id, 'plans');
    storage.setContextProvider(null);
});

test('a placeholder the app spoke aloud is in the record', async () => {
    // ⚠ THE MOST SERIOUS HOLE FOUND WHILE AUDITING "can this be recreated to the
    // second": the app says these in the USER'S OWN voice and the other person hears
    // them, and nothing wrote them down - so a replay was silent exactly where the app
    // had been talking.
    storage.setContextProvider(null);
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();

    await storage.logPlaceholder({ text: "I'm thinking about that.", n: 1, ttsUsed: { provider: 'browser', voice: null } });
    await storage.logPlaceholder({ text: 'Working that out.', n: 2 });

    const data = await readLog(id);
    const said = data.exchanges.filter((e) => e.role === 'placeholder');
    assert.deepEqual(said.map((x) => x.text), ["I'm thinking about that.", 'Working that out.']);
    assert.equal(said[0].n, 1, 'which rung of the ladder it was');
    assert.equal(said[0].tts.provider, 'browser', 'and in which voice it was actually said');
    assert.equal(said[1].tts, null, 'null rather than invented when the caller did not know');
    // NOT a user turn: a placeholder is the app holding the floor, not the user
    // choosing to say something.
    assert.equal(data.exchanges.filter((e) => e.role === 'user').length, 0);
});

test('a private conversation records no context and no placeholder', async () => {
    storage.setContextProvider(() => ({ partner: { id: 'p1', label: 'Mom' } }));
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();
    storage.setConversationSaving(false);
    await storage.logContext('partner');
    await storage.logPlaceholder({ text: 'I am thinking about that.' });
    const data = await readLog(id);
    assert.equal(data.exchanges.filter((e) => e.role === 'placeholder').length, 0);
    // The time-zero snapshot was written while saving was still on, so only the
    // mid-conversation one is refused - which is the correct behaviour.
    assert.equal(data.exchanges.filter((e) => e.role === 'context').length, 1);
    storage.setConversationSaving(true);
    storage.setContextProvider(null);
});

test('the microphone, the request moment and the composer are all in the record', async () => {
    // ⚠ KEN'S PRINCIPLE, and it is the reason these are recorded at all rather than
    // waiting for somebody to prove a need (September 10 2026): *"I'd rather have it
    // available than assume that it isn't and will never be important."* Said of the
    // replay feature, and it settles the default for every question of this kind.
    storage.setContextProvider(null);
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();

    await storage.logEvent('listen on');
    await storage.logEvent('generation requested', { reason: 'reprompt' });
    await storage.logEvent('composer opened');
    await storage.logEvent('composer canceled', { text: 'i wanted to say something else' });
    await storage.logEvent('reframe', { text: 'mention that I am lactose intolerant' });
    await storage.logEvent('listen off');

    const data = await readLog(id);
    const ev = data.exchanges.filter((e) => e.role === 'event');
    assert.deepEqual(ev.map((e) => e.kind),
        ['listen on', 'generation requested', 'composer opened', 'composer canceled',
            'reframe', 'listen off'],
        'one entry type for all of them - a role per gesture would make the file sprout '
        + 'a shape for every button ever added');
    assert.equal(ev[1].reason, 'reprompt',
        'WHY a set was asked for, so the wait can be split into the silence period and '
        + 'the round trip');
    assert.equal(ev[3].text, 'i wanted to say something else',
        'the words abandoned, not just that the composer was canceled');
    assert.equal(ev[4].text, 'mention that I am lactose intolerant',
        'and the steer itself - the sharpest statement of what the cards missed');
});

test('a private conversation records no events either', async () => {
    storage.setContextProvider(null);
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();
    storage.setConversationSaving(false);
    await storage.logEvent('reframe', { text: 'nothing private here' });
    const data = await readLog(id);
    assert.equal(data.exchanges.filter((e) => e.role === 'event').length, 0);
    storage.setConversationSaving(true);
});

test('ending a conversation mid-write cannot overwrite its file with "null" (CR-001)', async () => {
    // The order terminateConversation used to produce: a write started and not awaited
    // (clearPalette -> finalizeOffer), then the log dropped in the same tick. The
    // suspended write re-read the log after its await and wrote "null".
    storage.setContextProvider(null);
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();
    await storage.logOffer({ kind: 'closings', options: [{ slot: 'CLOSING', text: 'Bye!' }] });
    writeDelayMs = 5;
    try {
        storage.finalizeOffer({ outcome: 'cleared' });   // deliberately not awaited
        storage.logEvent('listen off');                   // deliberately not awaited
        storage.resetConversationId();
        await new Promise(r => setTimeout(r, 60));
    } finally { writeDelayMs = 0; }
    const data = await readLog(id);
    assert.ok(data && Array.isArray(data.exchanges), 'the file still holds the conversation');
    const offers = data.exchanges.filter(e => e.role === 'offer');
    assert.equal(offers.at(-1).outcome, 'cleared', 'and the last write is the newest one');
});

test('a new conversation starting mid-write cannot land in the old file (CR-001)', async () => {
    storage.setContextProvider(null);
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const oldId = storage.getConversationId();
    await storage.logOffer({ kind: 'ai', options: [{ slot: 'PREFERRED', text: 'Hello there.' }] });
    const RealDate = Date;
    writeDelayMs = 5;
    try {
        storage.finalizeOffer({ outcome: 'cleared' });
        storage.resetConversationId();
        // The opener starts the next conversation a few seconds later by the clock.
        globalThis.Date = class extends RealDate {
            constructor(...a) { super(...(a.length ? a : [RealDate.now() + 3000])); }
            static now() { return RealDate.now() + 3000; }
        };
        await storage.startConversationLog();
        await new Promise(r => setTimeout(r, 60));
    } finally { globalThis.Date = RealDate; writeDelayMs = 0; }
    assert.notEqual(storage.getConversationId(), oldId, 'the next conversation got its own id');
    const old = await readLog(oldId);
    assert.equal(old.id, oldId, 'the old file still belongs to the old conversation');
    assert.equal(old.exchanges.filter(e => e.role === 'offer').length, 1,
        'and still holds what was said in it');
});

test('an offer whose wording arrives late is rewritten in place (CR-022)', async () => {
    storage.setContextProvider(null);
    storage.resetConversationId();
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();
    await storage.logOffer({ kind: 'repair', options: [{ slot: 'REPAIR', text: 'Say it again' }, { slot: 'REPAIR', text: '' }] });
    await storage.reviseOffer([{ slot: 'REPAIR', text: 'Say it again' }, { slot: 'REPAIR', text: 'I said I would be late.' }]);
    const offer = (await readLog(id)).exchanges.filter((e) => e.role === 'offer').at(-1);
    assert.equal(offer.options[1].text, 'I said I would be late.');
});

test('device storage can be reconnected with no permission prompt (CR-036)', async () => {
    assert.equal(await storage.folderReadableWithoutPrompt(), true);
});

test('an error between conversations starts no conversation file (CR-048)', async () => {
    storage.setContextProvider(null);
    storage.resetConversationId();
    storage.setConversationSaving(true);
    const dir = await root.getDirectoryHandle('conversations');
    const before = [...dir._files.keys()].length;
    storage.logError('export', 'something failed in Settings');
    await new Promise((r) => setTimeout(r, 30));
    assert.equal([...dir._files.keys()].length, before, 'no file was created');
    assert.equal(storage.getConversationId(), null, 'and no id was minted');
});

test('a profile saved on another kind of device leaves device-bound settings alone (CR-067)', async () => {
    const dir = await root.getDirectoryHandle('settings', { create: true });
    const fh = await dir.getFileHandle('Laptop.json', { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify({ name: 'Laptop', device: { os: 'ios', shell: 'app', screen: '1x1' },
        settings: { sttProvider: 'builtin', colorScheme: 'dark' } }));
    await w.close();
    storage.saveSttProvider('deepgram');
    storage.saveColorScheme('default');
    await storage.applySettingsProfile('Laptop');
    assert.equal(storage.loadSttProvider(), 'deepgram', 'how the app hears stays as it is here');
    assert.equal(storage.loadColorScheme(), 'dark', 'an ordinary setting comes across');
});

// CR-154. A profile copied in with a name the app would not have chosen can still be
// loaded, updated and deleted by the name it is listed under.
test('a profile named with an accent can be loaded and deleted', async () => {
    await storage.restoreDataFolder();
    const dir = await root.getDirectoryHandle('settings', { create: true });
    const fh = await dir.getFileHandle('José.json', { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify({ name: 'José', settings: { voiceURI: 'Karen' } }));
    await w.close();
    assert.ok((await storage.listSettingsProfiles()).includes('José'));
    await storage.applySettingsProfile('José');
    assert.equal(storage.getPortableSettings().voiceURI, 'Karen');
    await storage.saveSettingsProfile('José');
    assert.deepEqual((await storage.listSettingsProfiles()).filter((n) => /Jos/.test(n)), ['José'], 'updated in place');
    await storage.deleteSettingsProfile('José');
    assert.ok(!(await storage.listSettingsProfiles()).includes('José'));
});

// CR-155. The speaking model and the hearing model are separate settings.
test('a speaking model and a hearing model are stored apart', () => {
    storage.saveServiceTtsModel('openai', 'gpt-4o-mini-tts');
    assert.equal(storage.loadServiceSttModel('openai'), null);
    storage.saveServiceSttModel('openai', 'gpt-4o-transcribe');
    assert.equal(storage.loadServiceTtsModel('openai'), 'gpt-4o-mini-tts');
});

// CR-173. Two conversations started in the same second keep separate files.
test('two conversations started in the same second do not share a file', async () => {
    await storage.restoreDataFolder();
    storage.resetConversationId();
    await storage.startConversationLog();
    const first = storage.getConversationId();
    await storage.logUserResponse({ selectedText: 'one', selectedIndex: -1, allOptions: [] });
    await storage.whenLogWritten();
    storage.resetConversationId();
    await storage.startConversationLog();
    const second = storage.getConversationId();
    await storage.whenLogWritten();
    assert.notEqual(first, second);
    assert.ok(second.startsWith(first.slice(0, 19)), 'still starts with the date and time');
    const kept = await readLog(first);
    assert.ok(kept.exchanges.some((e) => e.selectedText === 'one'), 'the first file was not overwritten');
});

// CR-220. When the restore wins, the grace timer is cleared rather than left running.
test('settleRestore clears its timer when the restore finishes first', async () => {
    await storage.restoreDataFolder();
    const realClear = globalThis.clearTimeout;
    let cleared = 0;
    globalThis.clearTimeout = (id) => { cleared++; return realClear(id); };
    try {
        const started = Date.now();
        const p = storage.restoreDataFolder();
        await storage.settleRestore(60000);
        await p;
        assert.ok(Date.now() - started < 5000);
        assert.ok(cleared >= 1, 'the grace timer was cleared');
    } finally { globalThis.clearTimeout = realClear; }
});

// CR-296. Starting the log from two places at once writes the starting situation once.
test('two starts at the same moment give one starting situation', async () => {
    storage.resetConversationId();
    storage.setContextProvider(() => ({ partner: { id: 'p', label: 'Sam' }, feeling: null, place: null, goals: null }));
    try {
        await Promise.all([
            storage.startConversationLog(),
            storage.logUserResponse({ selectedText: 'Hello', selectedIndex: -1, allOptions: [] }),
            storage.startConversationLog(),
        ]);
        await storage.whenLogWritten();
        const log = await readLog(storage.getConversationId());
        assert.equal(log.exchanges.filter((e) => e.role === 'context').length, 1);
        assert.equal(log.exchanges[0].role, 'context', 'and it is still the first entry');
    } finally {
        storage.setContextProvider(null);
    }
});

// CR-288. Choosing a different folder in the middle of a conversation moves the
// conversation, whole, into the new folder; the old one gets nothing more.
// (Last in this file: it leaves the module pointed at the second folder.)
test('the conversation in progress follows a change of folder, whole', async () => {
    storage.detachPendingPartnerTurn();
    await storage.logPartnerInterim({ rawTranscript: 'before the move' });
    const id = storage.getConversationId();
    await storage.whenLogWritten();
    const oldText = JSON.stringify(await readLog(id));

    const root2 = makeDir('root2');
    Object.defineProperty(globalThis, 'navigator', {
        value: { storage: { getDirectory: async () => root2 } }, configurable: true, writable: true,
    });
    assert.ok(await storage.restoreDataFolder());
    await new Promise((r) => setTimeout(r, 30));
    await storage.logUserResponse({ selectedText: 'after the move', selectedIndex: -1, allOptions: [] });
    await storage.whenLogWritten();

    const dir2 = await root2.getDirectoryHandle('conversations');
    const moved = JSON.parse(await (await (await dir2.getFileHandle(`${id}.json`)).getFile()).text());
    const text2 = JSON.stringify(moved);
    assert.ok(text2.includes('before the move') && text2.includes('after the move'), 'the new folder has it all');
    assert.equal(JSON.stringify(await readLog(id)), oldText, 'the old folder got nothing more');
});

// CR-289 / CR-290.
test('an event keeps its own kind and time; the usage log is one file a month', async () => {
    assert.equal(storage.metricsFileName(new Date('2026-10-06T12:00:00Z')), 'metrics-2026-10.log');
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../app/js/storage.js', import.meta.url), 'utf8');
    assert.match(src, /\.\.\.extra,\s*timestamp: new Date\(\)\.toISOString\(\),\s*role: 'event',\s*kind,/);
});

// Ken, October 8 2026: "when the user presses the button, the entire conversation is
// expunged." Asserted against the folder, because the promise is about what is left on it.
test('"Don\'t save" mid-conversation deletes the whole conversation from the folder', async () => {
    // A folder of its own, so what is left on it can be read directly.
    const root3 = makeDir('root3');
    Object.defineProperty(globalThis, 'navigator', {
        value: { storage: { getDirectory: async () => root3 } }, configurable: true, writable: true,
    });
    storage.resetConversationId();
    assert.ok(await storage.restoreDataFolder());
    storage.setConversationSaving(true);
    await storage.startConversationLog();
    const id = storage.getConversationId();
    await storage.logPartnerInterim({ rawTranscript: 'the biopsy came back positive' });
    storage.logError('generateOptions', 'API error 529', { partner: 'the biopsy came back positive' });
    await new Promise(r => setTimeout(r, 30));
    await storage.whenLogWritten();
    const conv = await root3.getDirectoryHandle('conversations');
    assert.ok(conv._files.has(`${id}.json`), 'the file was there before the press');

    storage.setConversationSaving(false);
    await storage.expungeCurrentConversation();

    assert.ok(!conv._files.has(`${id}.json`), 'the conversation file is gone');
    const mine = storage.loadErrorLog().filter(e => e.conversation === id);
    assert.ok(mine.length, 'the error itself is still listed');
    assert.ok(!JSON.stringify(mine).includes('biopsy'), 'but not the words in it');
    const errorsLog = root3._files.get('errors.log')?.data || '';
    assert.ok(errorsLog.includes(`conv=${id}`), 'errors.log still has the line');
    assert.ok(!errorsLog.includes('biopsy'), 'without the words');
    assert.equal(storage.isConversationPrivate(id, null), true, 'and it stays marked private');

    // Turning saving back on starts again from there - the words heard before are not
    // written back, and the turn that was in progress is not finished in the new file.
    storage.setConversationSaving(true);
    await storage.logPartnerInterim({ rawTranscript: 'the biopsy came back positive, so' });
    storage.detachPendingPartnerTurn();
    await storage.logPartnerInterim({ rawTranscript: 'anyway, lunch?' });
    await storage.whenLogWritten();
    const fresh = JSON.parse(await (await (await conv.getFileHandle(`${id}.json`)).getFile()).text());
    assert.ok(!JSON.stringify(fresh).includes('biopsy'), 'nothing from before comes back');
    assert.ok(JSON.stringify(fresh).includes('lunch'), 'what is said afterwards is saved');
});

test('the Don\'t save button deletes the conversation, and asks first', async () => {
    const app = (await import('node:fs')).readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
    const body = app.slice(app.indexOf('async function handlePrivacyToggle'), app.indexOf('async function handlePrivacyToggle') + 1500);
    assert.ok(body.indexOf('confirmDanger') >= 0, 'it asks before deleting');
    assert.ok(body.indexOf('applyPrivacyState') < body.indexOf('expungeCurrentConversation'),
        'recording stops before the file is deleted, so nothing writes it back');
});
