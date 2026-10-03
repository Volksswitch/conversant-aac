/* Build (or reset) the TEST DATA FOLDER — trigger phrase "reset test data".
 *
 *   node scripts/make-test-data-folder.mjs
 *
 * Ken, October 3 2026: "I'm not comfortable pointing to my actual data folder." A copy
 * of the app run from serve.bat (http://localhost:8000) keeps its own settings, so it
 * needs a data folder of its own, and testing writes into whatever folder it is given.
 * This makes one inside the project, at `test-data-folder/`, holding a lived-in user:
 * Marc Delgado, the demo persona, with About Me answered, people, places, an Express
 * Panel, a voice profile, and about three weeks of conversations.
 *
 * - The conversations are MOVED FORWARD so the newest one was yesterday. The demo is
 *   authored on fixed August/September dates, and the Conversation Review list shows
 *   the last week by default, so without this the test list would always be empty.
 * - One recent conversation comes with a review already part done, so Conversation
 *   Review has something to show besides "not looked at".
 * - Running it again WIPES the folder and rebuilds it: that is the reset. It only ever
 *   deletes a folder carrying its own marker file, so it cannot remove anything else.
 *
 * The folder is git-ignored. Its contents change as you test; the source of truth is
 * the demo builder (scripts/make-demo-import.mjs), which this runs fresh each time so
 * the data always matches the app's current file formats.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import * as reviewModel from '../app/js/review-model.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'test-data-folder');
const MARKER = '.conversant-test-data';
const DAY = 86400000;

// 1. A fresh demo backup, built by the same script the demo import uses.
const scratch = mkdtempSync(join(tmpdir(), 'conversant-test-data-'));
const pkgPath = join(scratch, 'demo.json');
execFileSync(process.execPath, [join(ROOT, 'scripts', 'make-demo-import.mjs'), '--out', pkgPath], { stdio: 'ignore' });
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
rmSync(scratch, { recursive: true, force: true });

// 2. Move every date forward by whole days, so the newest conversation was yesterday
//    and each conversation keeps its time of day.
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const newestId = pkg.conversations.map((c) => c.id).sort().at(-1);
const newest = Date.parse(newestId.slice(0, 10) + 'T00:00:00Z');
const yesterday = Date.parse(new Date(Date.now() - DAY).toISOString().slice(0, 10) + 'T00:00:00Z');
const shift = yesterday - newest;
const moveDate = (s) => new Date(Date.parse(s) + shift).toISOString();
function moveAll(v) {
    if (typeof v === 'string') return ISO.test(v) ? moveDate(v) : v;
    if (Array.isArray(v)) return v.map(moveAll);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, moveAll(x)]));
    return v;
}
const moveId = (id) => moveDate(id.slice(0, 10) + 'T' + id.slice(11).replace(/-/g, ':') + '.000Z')
    .replace(/[:.]/g, '-').slice(0, 19);

// 3. Wipe the old folder - only if it is ours.
if (existsSync(TARGET)) {
    if (!existsSync(join(TARGET, MARKER))) {
        console.error(`${TARGET} exists but is not a test data folder this script made. Nothing was changed.`);
        process.exit(1);
    }
    rmSync(TARGET, { recursive: true, force: true });
}
mkdirSync(join(TARGET, 'conversations'), { recursive: true });
writeFileSync(join(TARGET, MARKER), 'Made by scripts/make-test-data-folder.mjs. Safe to delete.\n');

// 4. The user's own files, exactly as the app writes them.
for (const [file, value] of Object.entries(pkg.data)) {
    writeFileSync(join(TARGET, file), JSON.stringify(moveAll(value), null, 2));
}

// 5. The conversations, with one recent real one part reviewed.
let reviewed = null;
const convos = pkg.conversations
    .map((c) => ({ id: moveId(c.id), data: moveAll(c.data) }))
    .sort((a, b) => a.id.localeCompare(b.id));
for (const c of convos) {
    writeFileSync(join(TARGET, 'conversations', `${c.id}.json`), JSON.stringify(c.data, null, 2));
}
// Newest first, and one with a marked turn ahead of one without, so the review bar's
// Jump button has somewhere to go.
const candidates = convos.slice().reverse()
    .filter((c) => !reviewModel.isPractice(c.data))
    .sort((a, b) => (reviewModel.summarize(b.id, b.data)?.flagged ? 1 : 0)
        - (reviewModel.summarize(a.id, a.data)?.flagged ? 1 : 0));
for (const c of candidates) {
    const turns = reviewModel.buildTurns(c.data);
    const t = turns.find((x) => x.cards.length >= 2 && x.took >= 0);
    if (!t || turns.length < 3) continue;
    let review = reviewModel.emptyReview(c.id);
    const other = t.took === 0 ? 1 : 0;
    review = reviewModel.setCardAnswer(review, t, other);
    review = reviewModel.markReached(review, Math.min(t.index + 1, turns.length - 2));
    review.updated = new Date().toISOString();
    writeFileSync(join(TARGET, 'conversations', `${c.id}.review.json`), JSON.stringify(review, null, 2));
    reviewed = c.id;
    break;
}

writeFileSync(join(TARGET, 'README.txt'), [
    'Conversant AAC - test data folder',
    '',
    'Point the copy of the app you run from serve.bat (http://localhost:8000) at this',
    'folder: Settings > General > Data Folder. It holds Marc Delgado, a made-up user,',
    'so testing never touches your real data.',
    '',
    'Testing changes what is in here. To put it back the way it started, ask Claude to',
    '"reset test data". That deletes this folder and builds it again.',
    '',
].join('\r\n'));

const first = convos[0].id.slice(0, 10);
const last = convos.at(-1).id.slice(0, 10);
console.log(`Test data folder ready: ${TARGET}`);
console.log(`  ${Object.keys(pkg.data).length} data files, ${convos.length} conversations from ${first} to ${last}`);
console.log(`  part-reviewed conversation: ${reviewed || 'none found'}`);
