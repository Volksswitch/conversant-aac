# Conversant AAC — test harness

Deterministic tests for the app's core logic, plus an optional live smoke test
against the real Claude API. Built with Node's **built-in** test runner
(`node --test`) — no test framework, no dependencies, no build step.

## Running

```bash
npm test            # Tiers 1 + 2 (deterministic). Tier 3 auto-skips if no key.
npm run test:live   # Tier 3 only (needs an API key)
npm run test:watch  # re-run on file changes
```

Node LTS is on the dev box at `C:\Program Files\nodejs\`. A terminal launched
before that install won't have `node` on PATH — open a fresh one, or call the full
path `"C:\Program Files\nodejs\node.exe" --test tests/`.

## The three tiers

| Tier | File(s) | Needs API key? | What it covers |
|------|---------|----------------|----------------|
| 1 — pure logic | `engine.test.mjs`, `stt.test.mjs` | no | The Conversation Engine (sequence stack, modes/floor, four-slot palette, repair-of-self, openers/closers + `{name}`) and the STT layer (silence checkpoint, TTS-echo filter, the "app is speaking" guard). Deterministic, milliseconds. |
| 2 — data path | `llm.test.mjs` | no (fetch mocked) | `llm.js` parsing (`generateResponses`/`generateStatements`/`repairOptions`) across the structured, legacy-array, legacy-`options`, prose-wrapped, and malformed cases; request-body shaping (steer / avoid / perCategory / role mapping); and a mocked result flowing **through the engine** to a palette — the exact llm→engine seam that failed. |
| 3 — live | `live.test.mjs` | **yes** | A curated set of real conversation openings hitting the actual model, asserting structural properties. The only tier that exercises real classification. Non-deterministic; a smoke test, not a gate. |

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
module needing browser globals (it installs a fake `window.SpeechRecognition` and
provides `mockFetch`/`loadApiKey`). The engine and llm adapters import no browser
globals, so they're trivial to extend. `stt.js` is a singleton — import a fresh copy
per test with a cache-busting query (`'../app/js/stt.js?b=' + n`) to isolate its
internal state, as `stt.test.mjs` does.

Modules not yet covered (worldview, relationships, control-phrases, placeholders)
pull in `storage.js`; they follow the same pattern once `storage.js` is shimmed for
IndexedDB / the File System Access API.
