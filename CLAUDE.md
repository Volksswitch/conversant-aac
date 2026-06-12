# AI-Enabled AAC — Project Context for Claude

## About Ken (the user)
Ken Hackbarth is President and Founder of Volksswitch.org. He has a three-decade background as a systems engineer at AT&T Bell Laboratories. He is **not** a developer or AI/AAC researcher — he is a product manager and systems thinker. He defines requirements, makes feature decisions, and recruits beta testers. Claude Code is the developer.

Published author: "Revolutionizing Augmentative and Alternative Communication with Generative Artificial Intelligence," ATOB Volume 18, Spring 2024 (pp. 100–123). This paper is the foundational vision document for this project and is stored as `ATOB_V18_Hackbarth.pdf` in this folder.

---

## Project Vision
Build an AI-enabled AAC system that gives non-speaking individuals access to **real-time conversation** — currently impossible with existing AAC devices. The core problem is not words-per-minute; it is the human aversion to awkward silence (~4 seconds). AAC users are locked into near-real-time or batch communication, which marginalizes them and restricts them to transactional rather than interactional communication.

**Mechanism:** Generative AI presents response options within seconds of a communication partner's utterance. The user selects one; the device speaks it. The system speaks *as* the user, not *for* them.

---

## Target User (Initial)
Literate, non-speaking individual with cerebral palsy (CP), 16+, using **direct select** (touch/pointer) as the access method. Vision is to expand to wider range of ages, literacy levels, and accessibility profiles over time.

---

## Architecture Components (from the paper)
1. **Situational Awareness** — GPS, face/voice recognition, calendar
2. **NLP In** — Speech-to-text
3. **Statement/Response Generation** — LLM (the linchpin)
4. **Statement/Response Shaping/Tuning** — worldview model, relationship modeling, conversation history
5. **NLP Out** — Text-to-speech

---

## Build Decisions (confirmed)

**Platform:** Static web app served from GitHub Pages (or similar). User points browser at a URL. App runs entirely in-browser. No backend server.

**Target hardware:** The File System Access API (FSA) is not supported on iOS or Android, and Apple does not make a tablet-class Mac. Therefore the device must be a Windows tablet running Microsoft Edge or Google Chrome. The Microsoft Surface is the primary candidate.

**Local data storage:** File System Access API — the app is granted permission to read/write a local folder on the user's machine. All worldview data, conversation history, and profile data stays on-device. No data sent to any server except the LLM API.

**Cross-device transfer:** Later feature — user manually exports a data package and moves it via iCloud, Google Drive, or OneDrive.

**AI vendor:** Claude API (Anthropic) first. Multi-vendor support added later. User creates their own Anthropic account; free tier supported, user upgrades as needed. API key stored locally.

**Speech-to-text transcript validation:** Displaying the transcript of what the partner said is **critical** — not optional. The user must be able to confirm the system heard correctly before selecting a response.

**End-of-utterance detection (continuous partner capture):** A silence period (the "Optional Responses silence period" setting) is a *checkpoint, not a stop*. Each time the partner pauses for that period, the speech collected so far is sent to the AI for response options and a placeholder is spoken; recording continues. Resumed speech is appended and the combined utterance is re-sent after the next pause, so each checkpoint yields a more complete option set. Recording stops only when the user selects a response, at which point the transcript is cleaned once and the exchange is stored. A "latest-wins" generation token discards superseded in-flight requests, and a persistent "Please repeat what you said." control discards a garbled capture and keeps listening. An **auto-resume-listening** setting (Settings → General; default **off**) turns partner recording back on automatically after a response is spoken, so the user need not tap Start Listening between exchanges. (Implemented June 2026; see `Continuous-Partner-Capture.docx` and Architecture Overview §9. This is the Phase 1 realization of the COMPLETE/INCOMPLETE/CONTINUING classifier and filler ladder above.)

**Voice/TTS:** Browser built-in TTS acceptable for MVP. Voice banking (personalized/cloned voice) is a valuable future feature.

**Communication partner:** Needs nothing. Entirely unaware of system internals. AR glasses are a future hardware form factor.

---

## Response Option Display

Response options shown to the user may appear in **compressed form** — a few words representing a fuller thought — to speed up reading. The system may also read the compressed hint aloud. The **trigger for the auditory hint is a user preference**: options include auto-playback as each option is highlighted in sequence, or on first tap (before a double-tap confirms selection). Additional triggers may be supported based on user feedback.

The user normally hears the **fully expanded response only when it is spoken** after selection. Whether the expanded text is displayed or read before confirmation may become a configurable option based on user feedback.

Position 1 in the options list is the AI's best guess. There is no special visual treatment to distinguish it — the design goal is simply that the first option is the best option, with that accuracy improving over time.

---

## Worldview Model
- Minimum viable version: a carefully selected "getting to know you" questionnaire (~100 questions)
- Questions are completed entirely at the user's own pace; none are required
- The system provides meaningful functionality even with zero worldview questions answered
- Info gathering must be **chunked** — physically draining for CP users
- Many real-time exchanges need zero worldview context ("Hi, how are you?" needs no personalization)
- RAG will reduce token overhead as the profile grows over time
- Designing the specific questionnaire content is part of the work ahead

---

## Rollout Sequence

**Phase 1 — Core Conversation Loop (Proof of Concept)**
STT → display transcript → placeholder utterance auto-spoken → LLM generates response options → user selects → TTS speaks full response. No worldview shaping, no situational awareness.

Key Phase 1 features:
- **3 response options** by default (configurable)
- **Conversation context:** rolling window of the current session only
- **Placeholder/filler utterances** (e.g., "Just a second…", "Let me think about that") automatically generated and spoken while the user is selecting; customization supported
- **Conversation initiation:** via a set of canned conversation starters (pre-configured phrases the user can select to open a conversation); later refined by situational awareness in Phase 2
- **Compressed display / expanded speech** for response options (see above)
- **Minimal identity seed (name + "About You"):** Settings → General has a **Your Name** field and an optional short **About You** free-text field. These are injected into the response-generation system prompt so the assistant speaks *as* the user (first person) and can answer with the real name instead of emitting a `[Name]` placeholder. Even with both blank, the prompt forbids bracketed placeholders like `[Name]`/`[city]` and tells the model to phrase around any unknown detail. This is the smallest precursor to the Phase 3 worldview model, not a replacement for it. Stored locally in `aac_settings`; sent to the Claude API only as part of generating responses. (Implemented June 2026.)
- **Offline review/feedback mode:** deferred — too complex even in rudimentary form
- **Response option UI layout:** requires a design discussion on how much of the screen is allocated to traditional AAC vocabulary vs. AI-facilitated response options; ultimately user-configurable

**Phase 2 — Situational Awareness**
Add location context (GPS), communication partner recognition (face/voice), and calendar integration. Canned conversation starters become contextually suggested based on location and partner identity.

**Phase 3 — Worldview Shaping and Tuning**
Integrate the worldview model. Responses shaped to reflect the individual user's personality and goals. RAG employed to manage profile size. Offline feedback/review mode introduced here.

---

## Advanced Future Capability: Streaming Response Generation
The long-term vision is for the system to begin generating and refining response options *while the communication partner is still speaking* — using partial STT transcripts as they arrive. Options would be continuously updated and narrowed as the utterance becomes clearer. This eliminates virtually all post-utterance latency. This capability requires significant design thought and is not targeted for Phase 1 or 2.

---

## Strategic Context
Prior attempts at AI-enabled AAC have been shelved when funding ran out. Ken's architecture avoids this by:
- **No server infrastructure** the project must pay for
- **User-funded AI** — users bring their own API key, pay only for what they use

Ken has screenshots of and has presented live demos of a prior team's shelved product. The goal is to share this architecture with those developers as a more sustainable path forward.

**First deliverable:** A high-level architecture document suitable for sharing with those prior developers — not code.

---

## Conversation Analysis Design Layer (June 2026)

Ken collected Conversation Analysis (CA) literature and had it synthesized into `CA-Concepts-for-AAC-Architecture.docx` (on Ken's Desktop). Three design documents in this folder map those concepts to the system. **All project decisions are recorded here in CLAUDE.md** (Ken's preference — this folder syncs across machines; Claude's machine-local memory does not).

**Documents** (all Word, styled like Ken's papers — Arial, "Volksswitch.org | June 2026 | For internal use" footer; figures `ui-fig1..7.png` alongside, generated with Python/Pillow, regenerable on request):
1. `Conversation-Engine-Design.docx` — CA concepts → programmatic flow
2. `UI-Design.docx` — presentation layer and dynamic UI
3. `Configuration-Model.docx` — user-owned settings registry and experimentation loop

### Settled decisions — Conversation Engine

- **Sequence stack, not turn alternation**: conversation state is a stack of open sequences (adjacency pairs); repair sequences nest on top; the original obligation is restored automatically when they resolve.
- **Four-slot move palette**: PREFERRED / DISPREFERRED (hedge + account) / INITIATIVE / REPAIR — structurally distinct conversational moves, positionally stable for motor automaticity. (Refines the earlier "3 response options" default: the palette is typed by move, not just counted; option count remains configurable.)
- **Five modes**: LISTENING, RESPONDING, REPAIR-OF-SELF, INITIATING, PRE-CLOSING/CLOSING.
- **Access method independent of conversation logic**: engine emits a typed, prioritized palette descriptor; renderers (direct select now; scanning/eye gaze later) present it. Consistent with the direct-select initial target while keeping the expansion path clean.
- **System infers mode, user overrides** via persistent buttons (default set: Say again / Hold on / Pardon? / Wind down).
- **Single combined LLM call** classifies the partner's action (FPP type) AND generates options; classification is emitted first in structured output so it is inspectable. LLM stateless; app injects state.
- **Filler ladder** (refines the placeholder mechanism and the old 4 s initial delay): rung 1 acknowledgment token ≤1 s after end-of-utterance (no LLM — this is what makes transcript validation affordable), rung 2 projection filler ~2.5 s covering the confirm window, rung 3 periodic re-fill. CA: silence becomes meaningful past ~1 s.
- **Backchannels/continuers deferred**; end-of-utterance classification schema reserves COMPLETE | INCOMPLETE | CONTINUING so they slot in later without rework.
- **Highest-leverage near-term item**: REPAIR-OF-SELF mode — partner says "What?" → re-speak / rephrase / expand the user's last utterance.

### Settled decisions — UI

- Four screen regions: transcript (with mode chip), move palette, persistent controls, composer access. Geometry never reflows on mode change — "the cards changed," never "the screen changed."
- Move card anatomy: glanceable hint (primary reading target; names the action, not a truncation), full TTS text, slot badge, format tag, latency dot (filled = instant, hollow = generation round-trip).
- **Triple coding**: slot identity = position + color + text badge; never color alone. Defaults: green preferred, amber dispreferred, blue initiative, purple repair.
- Transcript is a three-state gate: amber UNCONFIRMED → blue CONFIRMED·GENERATING → green OPTIONS READY. Options are never generated from an unconfirmed transcript (default; auto-confirm above a confidence threshold is configurable).
- **Nothing is spoken on the user's behalf invisibly** — every filler/token is displayed as it plays.
- **Palette updates queue until a selection boundary**: options never change under a user mid-selection (mandatory for future scanning/dwell renderers).
- Engine→UI contract is a versioned palette-descriptor JSON with `priority` and `droppable` per move; renderers drop/page by priority, never by move type.

### Configurability philosophy (overarching)

- **As many decisions as possible are user-determined and configurable.** This population is made up of unique individuals; the user experiments with a flow and adjusts from experience. Behavioral statements in the design docs are *defaults of the standard profile*, not rules.
- **Invariants are guaranteed capabilities, not fixed behaviors**: a repair path, a floor-holding path, a closing path, free composition, visibility of system speech, and revertibility must always exist; how they manifest is configurable. Config validation enforces "at least one path" rules at save time, with explanation — never silent correction.
- Three settings tiers by *when* a change is safe — Quick (mid-conversation) / Profile (between conversations) / Setup (rare, may be supporter-assisted) — all user-owned; nothing locked away from the user.
- Experimentation loop: named profiles (bindable to Practice Mode scenarios), automatic change journal, session review metrics (descriptive, local, private — inform the user, never score them), guided trials, one-tap revert. Revertibility is the one absolute.

---

## Versioning

Format: **major.minor** (e.g., `0.1`, `0.2`). All pre-release versions use major `0`. The decision to increment to `1.0` or beyond is made jointly by Ken and Claude Code based on maturity and readiness.

**Release publishing is always public.** GitHub releases for this project are public by standing decision — Claude Code is authorized to push tags and publish releases publicly without pausing for confirmation. (Ken, June 2026.)

Phase-to-version mapping (update as releases are tagged):

| Version | Phase | Notes |
|---------|-------|-------|
| 0.1     | 1     | Core conversation loop proof of concept |
| 0.2     | 1     | Continuous partner capture; persistent "Please repeat" control; auto-resume-listening setting |

---

## Open Questions (remaining)
- Response option UI layout: `UI-Design.docx` now specifies the four-region layout and move palette; remaining question is screen allocation between traditional AAC vocabulary and the AI-facilitated regions (composer-access region is the integration point; ultimately user-configurable per the Configuration Model)
- Worldview questionnaire: what specific questions to include and how to structure chunked sessions
- Placeholder utterances: currently drawn randomly from a static JSON file (app/data/placeholders.json). Predictable fillers will become a joke to communication partners over time. LLM-generated contextual fillers would sound more natural and could acknowledge the topic, but must be evaluated against token cost impact. The architecture already supports user-funded API keys, so any added cost is borne by the user. *Design now specified:* the filler ladder in `Conversation-Engine-Design.docx` §6 (rung 1 static token ≤1 s, rung 2 static-or-contextual, rung 3 re-fill); contextual fillers are the rung-2 LLM option in the Configuration Model. Remaining work is implementation and the token-cost evaluation.
- TTS inflection: browser TTS has limited control (pitch, rate, volume on SpeechSynthesisUtterance). Natural-sounding placeholder delivery matters — monotone fillers will sound robotic. Voice banking / cloned voices (future) would give much better inflection control. Evaluate whether pitch/rate tweaks on fillers can improve naturalness in the near term.
