# Releasing Conversant AAC

This is the formal release process for Conversant AAC. It is intentionally the
**same shape** as the process for the other Volksswitch projects (the Keyguard
Designer `.scad` and the Keyguard Designer web app): *work locally, log each
user-visible change to `## Unreleased` in plain language, and say "bump Conversant"
to cut a release.* Only the mechanics (semver version numbers, GitHub Actions
deploy) differ.

## Environment model

- **The PC is the development environment.** All day-to-day work is committed to
  the local `main` branch on the PC. **These commits are NOT pushed.** They are
  backed up and synced across your machines by OneDrive, which syncs the whole
  project folder including the `.git` directory.
- **GitHub is the release environment.** The repository is
  <https://github.com/Volksswitch/conversant-aac>. A GitHub Actions workflow
  (`.github/workflows/deploy.yml`) deploys the `app/` folder to GitHub Pages
  **on every push to `main`.** Therefore:

  > **Commit to local `main` = save your work.
  > Push `main` = release to users.**

  These are two different acts. Everything you commit piles up locally, invisible
  to users, until you choose to release. **Any push to `main` redeploys the app**
  (even a docs-only commit redeploys whatever is in `app/` at that commit), so we
  do not push between releases — not even documentation.

There is one branch: `main`. There is no separate `dev` or release branch.

## Between releases (the dev cycle)

- **Claude commits; Ken does not run git.** As each change is completed, Claude
  commits it to local `main`. No pushing.
- **Changelog-as-you-go (mandatory).** `CHANGELOG.md` is kept in lockstep with the
  code. The moment a change lands that a **user** could see or do differently (a new
  feature or a visible fix), add or edit the matching plain-English bullet under the
  topmost **`## Unreleased (next release)`** heading, **in the same commit as the
  code**. Write it the way a *target user* would read it — not engineering language
  — matching the voice of the existing entries. Exclude internal-only work (tests,
  tooling, refactors with no visible effect); when in doubt, ask Ken. If a change is
  later backed out, delete its bullet in the same commit. **Ken's own edits to
  `CHANGELOG.md` are authoritative** — preserve his wording; make only surgical edits.
- The app announces its own new release: after the app auto-updates itself, the
  bundled "What's new" notes (generated from `CHANGELOG.md`) are shown in-app. See
  the "What's new" section of `CLAUDE.md`.

## Version numbers

Two constants carry the version, and they move together:

- **`APP_VERSION`** in `app/js/app.js` — shown on Settings → About and in bug reports.
- **`CACHE_VERSION`** in `app/sw.js` — the service-worker cache key that makes clients
  pick up the new build.

Format is **`major.minor.patch`** (e.g. `0.5.63`):

- **patch** (`o`) — the default: fixes, refinements, small self-contained additions.
- **minor** (`m`) — bumped when a **significant new capability** has been added, still
  within the same phase.
- **major / phase** (`n`) — roughly one phase. **`n = 0` until the first public
  release.** Moving `n` (including the eventual `0.x → 1.0`) is **Ken's call alone.**

**Pre-bump (so you always know which build you're testing).** At the *end* of each
release, the local dev copy is immediately pre-bumped to the **next patch** (e.g.
release `0.5.63` → dev copy becomes `0.5.64`). The dev build's About screen therefore
always reads a number **higher than the last public release**, so when you test dev
changes you can tell at a glance you're on a dev build. This pre-bumped number is
**provisional** — it lives only on the PC (unpushed) and is not final until release.

Because the digit (patch vs. minor vs. phase) often depends on how a cycle turns out,
the pre-bump is always a **patch**; the **final digit is decided at release**, when
Ken issues the bump (see below). If the cycle turned out to add a significant
capability, the patch is promoted to a minor then; a phase bump is Ken's explicit call.

Both numbers only ever **increase.**

## Releasing — trigger phrase "bump Conversant"

Ken says **"bump Conversant"** (or an obvious variant — "release Conversant"). Ken
issues this only **after he has verified the `CHANGELOG.md` contents.** That single
command authorizes the entire ritual below **through the push** — Claude runs it end
to end, printing the release summary and the new version as it goes, and does **not**
pause for a second confirmation before pushing.

The ritual:

1. **Finalize the version.** Decide the release number for this cycle:
   - Default: keep the pre-bumped **patch** (`0.5.64`).
   - Significant new capability this cycle → promote to a **minor** (`0.6.0`).
   - New phase → Ken's explicit call (`1.0.0`, etc.).

   Set both `APP_VERSION` (`app/js/app.js`) and `CACHE_VERSION` (`app/sw.js`) to the
   final number. (If keeping the patch, they already read it from the pre-bump.)
2. **Finalize the changelog.** Rename the topmost **`## Unreleased (next release)`**
   heading to **`## Version <final>`**, and add a fresh empty
   `## Unreleased (next release)` section above it for the next cycle.
3. **Regenerate the bundled "What's new" notes:**

   ```
   node scripts/apply-release-notes.mjs
   ```

   (Reads `APP_VERSION`; injects the notes into `app/js/whats-new.js`. Confirm it
   reports the release number you're shipping.)
4. **Add the CLAUDE.md version-table row** for `<final>` (a one-line engineering
   summary — this table is released-versions-only).
5. **Commit** the release (`app/js/app.js`, `app/sw.js`, `CHANGELOG.md`,
   `app/js/whats-new.js`, `CLAUDE.md`).
6. **Push `origin main`.** GitHub Actions redeploys `app/` to Pages within ~1 minute.
   Users get the new app on their next reload (the service worker swaps it in on one
   load and serves it on the next).
7. **Start the next cycle — pre-bump.** Immediately bump `APP_VERSION` and
   `CACHE_VERSION` to the next **patch** (`<final>` + 1 patch), commit that locally,
   and **do not push.** The dev copy now leads public by one patch again.

## Invariants — do not break these

- **Never push to `main` except as step 6 of "bump Conversant".** Any push to `main`
  deploys `app/` to users — including a docs-only push. Between releases, everything
  stays as local commits.
- **The pre-bumped dev version stays local (unpushed) until it is released.** GitHub
  `main` always equals the last **public** release.
- **`APP_VERSION` and `CACHE_VERSION` move together and only ever increase** (never
  reused, never lowered). A lowered `CACHE_VERSION` can strand clients on a stale cache.
- **`CHANGELOG.md` is authored as-you-go**, in target-user language; nothing is
  authored at release except the `## Unreleased` → `## Version <final>` rename.
- **Ken verifies `CHANGELOG.md` before issuing "bump Conversant";** the command then
  runs through the push without a second confirmation.

## Rolling back a bad release

Revert the release commit on `main`, then bump `CACHE_VERSION`/`APP_VERSION` **up**
again (e.g. `0.5.64` → `0.5.65`, never back to `0.5.63`), and push:

```
git revert <release-commit-sha>
# hand-edit app/js/app.js + app/sw.js: bump the version UP by one more patch
git commit --amend --no-edit
git push origin main
```

Users roll back to the previous app on their next reload, same as a forward release.
