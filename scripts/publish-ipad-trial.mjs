#!/usr/bin/env node
/*
 * publish-ipad-trial.mjs — copy the current build of `app/` to the iPad trial
 * repository and publish it.
 *
 * WHY THIS EXISTS. The iPad trial is served from its own GitHub Pages repo so it
 * has a URL separate from the app testers are using. That means every build has to
 * be copied across by hand — and on July 30 2026 the copy silently drifted three
 * commits behind, which cost an afternoon diagnosing a build Ken had never
 * actually been running. A hand-copy that is only *usually* performed is worse
 * than no copy at all, because the trial keeps serving something plausible.
 *
 * The guards matter more than the copying. The project's standing rule is ONE
 * codebase on `main`, published to both places (CLAUDE.md, July 30 2026), so this
 * refuses to publish anything that is not exactly what production is serving:
 * a dirty tree, or a HEAD that has not been pushed, would put a build on the iPad
 * that exists nowhere else and that no commit sha describes.
 *
 *   node scripts/publish-ipad-trial.mjs              publish
 *   node scripts/publish-ipad-trial.mjs --dry-run    show what would happen
 *   node scripts/publish-ipad-trial.mjs --no-verify  skip the post-deploy check
 *
 * The build stamp is applied EXACTLY as .github/workflows does it for production
 * (sed @@BUILD@@ → short sha over js/app.js and sw.js), so the two deployments
 * carry identical stamps and a bug report naming a build is unambiguous about
 * which of the two it came from only by its URL — never by differing code.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// Overridable so the publish path itself can be exercised against a throwaway
// local repo. A script whose only untested branch is "push to a public site" is
// not much better than doing it by hand.
const TRIAL_REMOTE = process.env.CONVERSANT_TRIAL_REMOTE
    || 'https://github.com/Volksswitch/conversant-aac-ipad.git';
const TRIAL_URL = process.env.CONVERSANT_TRIAL_URL
    || 'https://volksswitch.github.io/conversant-aac-ipad/';
// Files in the trial repo that are ITS OWN and must survive the wipe. Everything
// else in the root is a copy of app/ and is replaced wholesale, so that a file
// deleted from app/ also disappears from the trial rather than lingering.
const TRIAL_OWN_FILES = new Set(['.git', 'README.md']);
// Stamped by the deploy workflow; asserted here so a renamed placeholder fails
// loudly instead of publishing a build that reports itself as "dev".
const STAMPED_FILES = ['js/app.js', 'sw.js'];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const verify = !args.has('--no-verify');

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const say = (m) => process.stdout.write(m + '\n');
const die = (m) => { process.stderr.write('\n✗ ' + m + '\n'); process.exit(1); };

// --- Guards: only ever publish exactly what production is serving ---------------

if (!existsSync(APP)) die(`No app/ directory at ${APP}. Run this from the project.`);

// SCOPED TO app/, deliberately. What is published is app/, so that is what HEAD
// has to describe; uncommitted work elsewhere in the repo (CLAUDE.md, DOC-SYNC.md,
// scratch generator scripts) does not change a byte of the build, and refusing on
// it would mean the script declined to run during the ordinary state of this
// project — which is how a safety check turns into something you route around.
const dirtyApp = git(ROOT, 'status', '--porcelain', '--untracked-files=no', '--', 'app');
if (dirtyApp) {
    die('app/ has uncommitted changes:\n' +
        dirtyApp.split('\n').map((l) => '    ' + l).join('\n') + '\n' +
        '  The trial commit names a source commit, so publishing now would put a build\n' +
        '  on the iPad that no sha describes. Commit (or stash) first.');
}
// Untracked files inside app/ are worse still: they would be copied and served
// while existing in no commit at all, so the build could not be reproduced.
const untrackedInApp = git(ROOT, 'ls-files', '--others', '--exclude-standard', '--', 'app');
if (untrackedInApp) {
    die('app/ contains files that are not committed:\n' +
        untrackedInApp.split('\n').map((f) => '    ' + f).join('\n') + '\n' +
        '  They would be published but exist in no commit, so the build could not be\n' +
        '  reproduced. Commit them, or delete them if they are scratch.');
}

const branch = git(ROOT, 'rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== 'main') {
    die(`On branch "${branch}", not main.\n` +
        '  There is one branch by design — main is what both sites deploy from.');
}

say('Fetching origin to check this build is public…');
try {
    git(ROOT, 'fetch', '--quiet', 'origin', 'main');
} catch {
    die('Could not reach origin. A network connection is needed to confirm the\n' +
        '  build has been pushed before copying it to the trial.');
}

// The test is whether app/ MATCHES ORIGIN/MAIN — not whether HEAD equals it.
// Local-only commits are this project's normal state: the release rule is that
// committing saves work and pushing releases, so CLAUDE.md and doc commits
// routinely sit unpushed. None of them change the build. What must never happen is
// the trial serving app code that production is not.
let appDiffers = true;
try {
    execFileSync('git', ['diff', '--quiet', 'origin/main', 'HEAD', '--', 'app'], { cwd: ROOT });
    appDiffers = false;
} catch { /* non-zero exit means the trees differ */ }
if (appDiffers) {
    const files = git(ROOT, 'diff', '--name-only', 'origin/main', 'HEAD', '--', 'app');
    die('app/ differs from origin/main — these are committed but not pushed:\n' +
        files.split('\n').map((f) => '    ' + f).join('\n') + '\n' +
        '  Push to main first. That is what deploys production, and the trial is meant\n' +
        '  to be the same code; publishing now would make the iPad the only place this\n' +
        '  build exists.');
}

// Stamp with ORIGIN/MAIN's sha, which is what the production workflow stamps
// (GITHUB_SHA of the pushed commit). app/ is identical either way, so this makes
// the two deployments report the same build id — the point of the whole exercise,
// since a bug report quoting a build must not be ambiguous about which site it is.
const sha = git(ROOT, 'rev-parse', '--short=7', 'origin/main');
const subject = git(ROOT, 'log', '-1', '--format=%s', 'origin/main');
say(`Publishing ${sha} — ${subject}`);

// --- Working clone of the trial repo --------------------------------------------

const clone = join(tmpdir(), 'conversant-aac-ipad-trial');
// The cached clone is reused across runs, so it MUST be confirmed to point at the
// remote we are publishing to. Otherwise one run against a different remote (a
// sandbox, via CONVERSANT_TRIAL_REMOTE) silently leaves the cache aimed there and
// the next real run publishes to, or resets from, the wrong repository.
let cachedOrigin = null;
if (existsSync(join(clone, '.git'))) {
    try { cachedOrigin = git(clone, 'remote', 'get-url', 'origin'); } catch { /* unusable */ }
    if (cachedOrigin !== TRIAL_REMOTE) {
        say(`Cached clone points at a different remote (${cachedOrigin || 'unknown'}) — re-cloning`);
        rmSync(clone, { recursive: true, force: true });
    }
}
if (existsSync(join(clone, '.git'))) {
    say(`Updating existing clone at ${clone}`);
} else {
    say(`Cloning the trial repo to ${clone}`);
    rmSync(clone, { recursive: true, force: true });
    execFileSync('git', ['clone', '--quiet', TRIAL_REMOTE, clone], { stdio: 'inherit' });
}
// BOTH paths then land explicitly on origin/main. Never assume a fresh clone
// checked it out: git follows the remote's HEAD, so a remote whose default branch
// is anything else leaves the clone on another branch — or, if HEAD points at a
// branch that does not exist, on an unborn one. Committing there and pushing to
// main builds a second, unrelated history and the push is rejected as
// non-fast-forward (observed in a sandbox). Reset rather than pull, because this
// clone is scratch staging and a half-finished earlier run must never end up in
// what gets published.
git(clone, 'fetch', '--quiet', 'origin', 'main');
git(clone, 'checkout', '--quiet', '-B', 'main', 'origin/main');
git(clone, 'reset', '--hard', '--quiet', 'origin/main');
git(clone, 'clean', '-qfd');

// --- Replace the payload ---------------------------------------------------------

for (const entry of readdirSync(clone)) {
    if (TRIAL_OWN_FILES.has(entry)) continue;
    rmSync(join(clone, entry), { recursive: true, force: true });
}
cpSync(APP, clone, { recursive: true });

for (const rel of STAMPED_FILES) {
    const file = join(clone, rel);
    const before = readFileSync(file, 'utf8');
    if (!before.includes('@@BUILD@@')) {
        die(`${rel} has no @@BUILD@@ placeholder.\n` +
            '  The production workflow asserts the same thing. Without it the build would\n' +
            '  report itself as "dev" and no bug report could identify it.');
    }
    writeFileSync(file, before.split('@@BUILD@@').join(sha));
}
say(`Stamped build ${sha} into ${STAMPED_FILES.join(' and ')}`);

// --- Commit and push -------------------------------------------------------------

const changed = git(clone, 'status', '--porcelain');
if (!changed) {
    say(`\n✓ The trial is already serving ${sha}. Nothing to publish.`);
    process.exit(0);
}
say('\nFiles changing in the trial:');
say(changed.split('\n').map((l) => '  ' + l).join('\n'));

if (dryRun) {
    say(`\n(dry run — nothing committed or pushed. Clone left at ${clone})`);
    process.exit(0);
}

// Match the identity used by the previous trial commits rather than inheriting
// whatever a scratch clone would default to (which has produced "Author identity
// unknown" and a hostname-derived address).
git(clone, 'config', 'user.name', git(ROOT, 'log', '-1', '--format=%an'));
git(clone, 'config', 'user.email', git(ROOT, 'log', '-1', '--format=%ae'));

const message = `Publish conversant-aac ${sha}\n\n${subject}\n\n` +
    `Source: Volksswitch/conversant-aac@${sha}\n` +
    `Copied by scripts/publish-ipad-trial.mjs.\n`;
git(clone, 'add', '-A');
try {
    git(clone, 'commit', '--quiet', '-m', message);
    git(clone, 'push', '--quiet', 'origin', 'main:main');
} catch (err) {
    // A raw execFileSync stack trace here is unreadable and buries the one line
    // that matters, so surface git's own stderr and say what to do.
    die('git rejected the publish:\n' +
        String(err.stderr || err.message).trim().split('\n').map((l) => '    ' + l).join('\n') + '\n' +
        '  If someone else pushed to the trial repo since this clone was refreshed,\n' +
        '  just re-run — every run resets to origin/main before copying.');
}
say(`\n✓ Pushed ${sha} to the trial repo.`);

// --- Confirm the deployment actually serves it -----------------------------------
//
// Pages takes a little while, and a green push is not evidence the site changed —
// the drift this script exists to prevent would have been caught by exactly this
// check, so it runs by default.

if (!verify) {
    say(`  Skipped the deploy check. ${TRIAL_URL}`);
    process.exit(0);
}

say('\nWaiting for GitHub Pages to serve the new build…');
const deadline = Date.now() + 180_000;
let served = null;
while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    try {
        const res = await fetch(`${TRIAL_URL}js/app.js`, { cache: 'no-store' });
        const text = await res.text();
        const m = text.match(/BUILD_STAMP = '([^']*)'/);
        served = m ? m[1] : null;
        if (served === sha) {
            say(`\n✓ ${TRIAL_URL} is serving ${sha}.`);
            say('  On the iPad, Settings → About should read the same. If it does not,');
            say('  use Settings → About → Reload the app.');
            process.exit(0);
        }
        process.stdout.write(`  serving ${served || 'unknown'}…\n`);
    } catch {
        process.stdout.write('  not reachable yet…\n');
    }
}
say(`\n! Pushed, but ${TRIAL_URL} was still serving ${served || 'an unknown build'} after 3 minutes.`);
say('  Pages is probably just slow — re-check before testing on the iPad.');
process.exit(1);
