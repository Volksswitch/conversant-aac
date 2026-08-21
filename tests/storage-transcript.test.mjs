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
