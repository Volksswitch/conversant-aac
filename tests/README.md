# Conversant AAC — test harness

Deterministic tests for the app's core logic, plus an optional live smoke test
against the real Claude API. Built with Node's **built-in** test runner
(`node --test`) — no test framework, no dependencies, no build step.

## Running

```bash
npm test            # Tiers 1 + 2 (deterministic). Tier 3 auto-skips if no key.
npm run test:live   # Tier 3 only (needs an API key)
npm run test:watch  # re-run on file changes

# coverage for the deterministic tiers:
node --test --experimental-test-coverage tests/engine.test.mjs tests/stt.test.mjs \
  tests/llm.test.mjs tests/conversation-logic.test.mjs tests/keyboard-layouts.test.mjs \
  tests/express-items.test.mjs tests/whats-new.test.mjs tests/control-phrases.test.mjs \
  tests/worldview.test.mjs tests/relationships.test.mjs tests/prediction.test.mjs \
  tests/placeholders.test.mjs
```

## Not automated — the on-device layer

Real hardware/browser behavior (mic, spoken audio + timing, the echo loop, touch,
the keyguard fit, the File System Access folder, the service-worker auto-update, the
live AI) can't be unit-tested. It has its own procedure: **`MANUAL-TEST-PLAN.md`**,
with a **Repeatable setup** section that resets to a known baseline using the seed
fixtures in **`fixtures/`**. Run those on the target tablet.

Node LTS is on the dev box at `C:\Program Files\nodejs\`. A terminal launched
before that install won't have `node` on PATH — open a fresh one, or call the full
path `"C:\Program Files\nodejs\node.exe" --test tests/`.

## The three tiers

| Tier | File(s) | Needs API key? | What it covers |
|------|---------|----------------|----------------|
| 1 — pure logic | `engine`, `stt`, `conversation-logic`, `worldview`, `relationships`, `control-phrases`, `placeholders`, `whats-new`, `prediction`, `keyboard-layouts`, `express-items` `.test.mjs` | no | The Conversation Engine; the STT layer (checkpoint, echo filter, "app speaking" guard, restart/error); the generateOptions decision logic + silent-dead-end tripwires (`conversation-logic`); the three-level privacy withholding (`worldview`/`relationships`); the seeded-watermark reconciliation (`control-phrases`); placeholder sequencing/cap/gate; semver + notes (`whats-new`); word prediction; layout/symbols-page geometry; Express Panel item data. |
| 2 — data path | `llm.test.mjs` | no (fetch mocked) | `llm.js` parsing (`generateResponses`/`generateStatements`/`repairOptions`/`cleanupTranscript`/`repairSelf`) across structured, legacy-array, legacy-`options`, prose-wrapped, and malformed cases; request-body shaping (steer / avoid / perCategory / role mapping); and a mocked result flowing **through the engine** to a palette. |
| 3 — live | `live.test.mjs` | **yes** | A curated set of real conversation openings hitting the actual model, asserting structural properties. The only tier that exercises real classification. Non-deterministic; a smoke test, not a gate. |

Coverage of the deterministic logic sits at ~80–100% line for every module above;
the low-coverage remainder (`storage.js` file I/O, `tts.js` real speech, and the DOM
modules `ui`/`keyboard`/editors/`worldview-ui`) is the browser-bound layer that
`MANUAL-TEST-PLAN.md` covers instead.

## The API key (Tier 3)

Tier 3 reads the key from, in order:

1. the `ANTHROPIC_API_KEY` environment variable, or
2. a file named **`.anthropic-key`** at the repo root, containing just the key.

Both are **gitignored** and are read only — the key is never printed or written by
the tests. If neither is present, every Tier-3 scenario skips (so `npm test` still
runs Tiers 1 and 2 unattended).

Recommended: use a **dedicated, revocable** Anthropic key with a low spend limit
for this — a full Tier-3 run is a handful of calls (a few cents).

To set up the file:

```bash
echo "sk-ant-…your-key…" > .anthropic-key
```

## Why this harness exists

It was built after a July 2026 bug where a **user-started** conversation went
silent: the partner's short go-ahead reply was misclassified as an incomplete turn,
and the engine's false-TRP guard suppressed the whole response palette — with no
error logged. Stubbed preview checks never caught it because a stub always returns a
clean `COMPLETE` classification; only the live model on a real short phrasing
reproduces it. So:

- **Tier 1** locks in the fix — see the `REGRESSION:` test in `engine.test.mjs`
  (user-leading + `INCOMPLETE`/`CONTINUING` must still produce the lead palette).
- **Tier 2** guards the llm→engine seam without spending tokens.
- **Tier 3** is the only thing that would have *discovered* it — it hits the real
  model with exactly that opening.

## Adding tests

Each `*.test.mjs` is discovered automatically and runs in its own process (globals
never leak between files). Import `./env.mjs` **first** in any file that loads a
module needing browser globals — it installs `window.SpeechRecognition`,
`localStorage`, and `window.speechSynthesis`, and provides `mockFetch`,
`mockFetchFromDisk` (serves the real `app/data/*.json`), `resetLocalStorage`,
`setSetting`, `spokenTexts`, and `loadApiKey`. `stt.js` and `placeholders.js` are
singletons — reset them per test (a cache-busting import `'../app/js/stt.js?b='+n`,
or `placeholders.stop()` + `resetLocalStorage()`), as those files show.

Still browser-bound (covered by `MANUAL-TEST-PLAN.md`, not unit tests): the DOM
render modules (`ui`, `keyboard`, `worldview-ui`, the editors, `viewport`), the
actual FSA/IndexedDB writes in `storage.js`, and real `speechSynthesis` timing. The
natural next tier for the DOM-flow cases is a headless-browser E2E harness
(Playwright/Puppeteer) driving the real app with a fake recognizer + stubbed
`fetch` — see the "revisit a Playwright UI-E2E tier" to-do in CLAUDE.md.
