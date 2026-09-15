/* Express Panel SOUND buttons (Ken, September 14 2026).
 *
 * The rules that decide what a clip may be and what the record says, plus the part
 * that fails silently if it breaks: a clip must make the whole round trip through a
 * backup and come back byte for byte. That half drives the REAL storage module and the
 * REAL backup code against a directory that stores binary files, rather than handing
 * the backup code a hand-written package.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/* ── A directory handle that stores binary files ──────────────────────────── */

function makeDir(name = '') {
    const files = new Map();   // name -> Blob
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
                files.set(n, new Blob([]));
            }
            return {
                kind: 'file', name: n,
                async getFile() { return files.get(n); },
                async createWritable() {
                    const parts = [];
                    return {
                        async write(chunk) { parts.push(chunk); },
                        async seek() {},
                        async close() {
                            const type = parts.find((p) => p && p.type)?.type || '';
                            files.set(n, new Blob(parts, { type }));
                        },
                    };
                },
            };
        },
        async removeEntry(n) {
            if (!files.has(n) && !dirs.has(n)) throw new Error('NotFoundError');
            files.delete(n); dirs.delete(n);
        },
        async *entries() {
            for (const [k] of files) yield [k, { kind: 'file', name: k }];
            for (const [k, v] of dirs) yield [k, v];
        },
    };
}

const root = makeDir('root');
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
};
// No folder picker: storage.js adopts device storage, which needs no gesture.
globalThis.window = { dispatchEvent() { return true; } };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', storage: { getDirectory: async () => root } },
    configurable: true, writable: true,
});
globalThis.screen = { width: 1920, height: 1080 };
globalThis.indexedDB = undefined;

const audio = await import('../app/js/express-audio.js');
const storage = await import('../app/js/storage.js');
const dt = await import('../app/js/data-transfer.js');
const bands = await import('../app/js/express-bands.js');

/* ── The rules ────────────────────────────────────────────────────────────── */

test('only MP3 and M4A are accepted, and only up to 10 MB', () => {
    assert.equal(audio.checkAudioFile({ name: 'Song.MP3', size: 1000 }).ok, true);
    assert.equal(audio.checkAudioFile({ name: 'hello.m4a', size: 1000 }).type, 'audio/mp4');
    assert.equal(audio.checkAudioFile({ name: 'clip.wav', size: 1000 }).ok, false,
        'refused when it is added, not when it fails to play on an iPad');
    assert.equal(audio.checkAudioFile({ name: 'long.mp3', size: 11 * 1024 * 1024 }).ok, false);
    assert.equal(audio.checkAudioFile(null).ok, false);
});

test('the record never files somebody else\'s recording as the user speaking', () => {
    assert.equal(audio.transcriptText({ label: 'Hi Grandma', kind: 'mine' }), '(played my recorded message: Hi Grandma)');
    assert.equal(audio.transcriptText({ label: 'Mom says hi', kind: 'other' }), '(played a recording of someone else: Mom says hi)');
    assert.equal(audio.transcriptText({ label: 'Cheer', kind: 'sound' }), '(played a sound: Cheer)');
    assert.equal(audio.transcriptText({ label: '' }), '(played a sound: a recording)');
});

test('a stored clip name is safe, and a new file for the same button gets a new name', () => {
    const a = audio.audioFileName('fp1/../x', 'mp3', 1);
    const b = audio.audioFileName('fp1/../x', 'mp3', 2);
    assert.ok(audio.isSafeAudioName(a), a);
    assert.notEqual(a, b);
    assert.equal(audio.isSafeAudioName('../evil.mp3'), false);
    assert.equal(audio.isSafeAudioName('clip.wav'), false);
});

test('two sounds with the same label are still two buttons in the Flex band', () => {
    const flex = { [bands.flexKey(null, null)]: [
        { id: 's1', type: 'audio', label: 'Laugh', file: 's1-a.mp3' },
        { id: 's2', type: 'audio', label: 'Laugh', file: 's2-b.mp3' },
    ] };
    assert.equal(bands.flexFill(flex, null, null, 10).length, 2);
});

/* ── The round trip ───────────────────────────────────────────────────────── */

test('connecting the data folder makes the audio folder too', async () => {
    assert.equal(await storage.restoreDataFolder(), true);
    await root.getDirectoryHandle('audio');   // throws if it is not there
});

test('a clip survives a backup and restore byte for byte', async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
    await storage.writeAudioFile('s1-abc.mp3', new Blob([bytes], { type: 'audio/mpeg' }));

    const pkg = await dt.buildPackage('9.9.9');
    assert.equal(pkg.audio.length, 1);
    assert.ok(dt.summarize(pkg).includes('1 sound file'));

    await storage.deleteAudioFile('s1-abc.mp3');
    assert.equal(await storage.readAudioFile('s1-abc.mp3'), null);

    // Through the text form a real backup file has, not the object in memory.
    const restored = await dt.applyPackage(dt.parsePackage(JSON.stringify(pkg)));
    assert.equal(restored.audio, 1);
    const back = new Uint8Array(await (await storage.readAudioFile('s1-abc.mp3')).arrayBuffer());
    assert.deepEqual([...back], [...bytes]);
});

test('a backup cannot write a clip under a name the app did not make', async () => {
    const pkg = await dt.buildPackage('9.9.9');
    pkg.audio = [{ name: '../escape.mp3', type: 'audio/mpeg', data: 'AAE=' }];
    const restored = await dt.applyPackage(dt.parsePackage(JSON.stringify(pkg)));
    assert.equal(restored.audio, 0);
});
