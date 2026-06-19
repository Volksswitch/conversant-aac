// Generator for Conversation-Engine-Design.docx (the detailed CA->software
// design doc). This is the new source of truth for that document: edit the
// `blocks` content array below and re-run. Matches the house style (Arial,
// blue headings, "Page m of n" footer). American English.
//
// Content was reconstructed from the previously hand-authored docx, with two
// deliberate changes (see CONTENT NOTES at the build call): §9.3's six bullets
// (empty in the old file) are filled with the actual system-prompt obligations,
// and the standard footer (absent before) is added. Figures engine-fig1..6.png
// are produced by capture-engine-diagrams.js from Engine-Diagrams.html.
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, ImageRun,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// --- inline run helper: R("text", {b:1,i:1}); plain strings are plain runs ---
const R = (t, o = {}) => ({ t, b: !!o.b, i: !!o.i });
function mkRuns(runs) {
    const arr = Array.isArray(runs) ? runs : [runs];
    return arr.map(x => typeof x === 'string'
        ? new TextRun({ text: x })
        : new TextRun({ text: x.t, bold: x.b, italics: x.i }));
}

// --- block constructors ---
const h1 = (t) => ({ k: 'h1', t });
const h2 = (t) => ({ k: 'h2', t });
const p  = (runs) => ({ k: 'p', runs });
const bul = (runs) => ({ k: 'bul', runs });
const code = (lines) => ({ k: 'code', lines });
const tbl = (headers, rows, widths) => ({ k: 'tbl', headers, rows, widths });
const fig = (file, caption, width = 580) => ({ k: 'fig', file, caption, width });
const sp = () => ({ k: 'sp' });

function pngSize(file) {
    const b = fs.readFileSync(file);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// --- renderers ---
function renderFigure(file, caption, maxWidth) {
    const { w, h } = pngSize(file);
    const scale = Math.min(1, maxWidth / w);
    const width = Math.round(w * scale), height = Math.round(h * scale);
    return [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 60 },
            children: [new ImageRun({ type: "png", data: fs.readFileSync(file), transformation: { width, height } })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
            children: [new TextRun({ text: caption, italics: true, color: "595959", size: 18 })] }),
    ];
}

function renderCode(lines) {
    // Monospace block with light shading; spaces -> non-breaking so indentation
    // and column alignment are preserved exactly.
    return lines.map((line, i) => new Paragraph({
        spacing: { before: i === 0 ? 60 : 0, after: i === lines.length - 1 ? 160 : 0 },
        shading: { type: ShadingType.CLEAR, fill: "F4F4F4" },
        indent: { left: 120 },
        children: [new TextRun({ text: line.replace(/ /g, ' ') || ' ',
            font: "Consolas", size: 18 })]
    }));
}

function renderTable(headers, rows, widths) {
    const headerCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "D5E8F0" }, margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: true, size: 20 })] })]
    });
    const bodyCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA }, margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, size: 20 })] })]
    });
    return new Table({ width: { size: 9360, type: WidthType.DXA }, borders,
        rows: [
            new TableRow({ tableHeader: true, children: headers.map((hh, i) => headerCell(hh, widths[i])) }),
            ...rows.map(r => new TableRow({ children: r.map((c, i) => bodyCell(c, widths[i])) }))
        ] });
}

function renderBlock(b) {
    switch (b.k) {
        case 'h1': return [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(b.t)] })];
        case 'h2': return [new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(b.t)] })];
        case 'p':  return [new Paragraph({ spacing: { before: 0, after: 160 }, children: mkRuns(b.runs) })];
        case 'bul':return [new Paragraph({ numbering: { reference: "bullets", level: 0 },
            spacing: { before: 0, after: 80 }, children: mkRuns(b.runs) })];
        case 'code': return renderCode(b.lines);
        case 'tbl': return [renderTable(b.headers, b.rows, b.widths)];
        case 'fig': return renderFigure(b.file, b.caption, b.width);
        case 'sp': return [new Paragraph({ children: [] })];
        default: return [];
    }
}

// ====================== CONTENT ======================
const blocks = [
    h1("1.  Purpose and Scope"),
    p([ "The current architecture models conversation as simple turn alternation: the communication partner speaks, the AAC user responds, with placeholder utterances allowing the user to hold their place. The companion CA Concepts document identifies why this model is incomplete. This document specifies ", R("how", {i:1}), " the richer model becomes software: concrete data structures, state machines, timing rules, and an LLM contract that together give the AAC user a full palette of conversational moves — not just answers." ]),
    p([ R("Note on configurability: ", {b:1}), "the behavioral specifics in this document — filler timings, mode switching, slot composition, confirmation gates — are the defaults of the standard profile, not fixed rules. The companion ", R("Configuration Model", {i:1}), " document reclassifies them as user-owned settings: this population is made up of individuals with unique abilities and needs, and the user is expected to experiment with a flow and adjust it from experience. Only guaranteed capabilities (a repair path, a floor-holding path, a closing path, free composition, visibility of system speech, and revertibility) are invariant; every behavior that delivers them is configurable." ]),
    p("Four design decisions, settled in review, anchor everything that follows:"),
    bul([ R("Access-method independence. ", {b:1}), "The Conversation Engine knows nothing about touch, switch scanning, or eye gaze. It emits typed, prioritized moves; a separate Presentation Layer renders them per the user's configured access method." ]),
    bul([ R("System infers, user overrides. ", {b:1}), "The engine classifies the partner's action and switches conversational mode automatically. A small set of persistent, never-moving override controls lets the user correct it." ]),
    bul([ R("Backchannels deferred. ", {b:1}), "Continuer support (one-tap “uh-huh” / “really?” during the partner's extended turns) is a later phase. The TRP classifier ships binary now but is specified three-way so continuers slot in without rework." ]),
    bul([ R("Single combined LLM call. ", {b:1}), "One request both classifies the partner's action and generates slot-typed response options, with the classification emitted first as inspectable structured output." ]),

    h1("2.  Layered Architecture"),
    p("The system divides into three layers with strict one-way knowledge:"),
    fig("engine-fig1.png", "Figure 1. The runtime loop of one exchange — from the partner speaking to the user's selected move being spoken.", 560),
    tbl(["Layer", "Responsibility", "Knows about"], [
        ["Conversation Engine", "Sequence stack, action classification, mode inference, move palette generation, timing/filler ladder", "CA structure only — never UI or access method"],
        ["Presentation Layer", "Renders the palette for the configured access method; pages moves that don't fit; orders scan patterns", "Move types, priorities, and the user's access profile"],
        ["I/O Services", "STT (with confidence), TTS, audio assets for fillers/tokens", "Audio only"],
    ], [2200, 4400, 2760]),
    sp(),
    p([ R("The key invariant lives in the engine, not the UI: ", {b:1}), "move ", R("types", {i:1}), " have stable ordinal positions (preferred is always first, repair always last). A scanning user's layout may surface fewer moves per page, but the relative order never changes. This gives users motor automaticity — the ability to select “Pardon?” without reading — the same property that makes core-word boards effective." ]),
    p([ "Each move the engine emits carries: ", R("slot type, spoken text, compressed hint text, priority, latency class", {b:0}), " (whether selecting it requires an LLM round-trip or plays immediately). The Presentation Layer uses priority to decide what to drop first when space shrinks, and latency class to set user expectations (e.g., instant moves are visually distinct)." ]),

    h1("3.  Conversation State: the Sequence Stack"),
    p([ "Conversation is not an alternation of turns; it is a ", R("stack of open sequences", {b:1}), ". A first pair part (FPP — question, invitation, request, complaint, assessment) opens a sequence and creates an obligation that stays open until a type-matching second pair part (SPP) closes it. Sequences nest: if the user initiates repair (“Pardon?”), that pushes a new sequence on top of the still-open one. When the repair sequence closes, the original question is still owed an answer — and the engine knows it." ]),
    fig("engine-fig2.png", "Figure 2. The sequence stack: a clarification nests on the still-owed question, then pops to restore it when the partner restates.", 580),
    code([
        "ConversationState {",
        "  sequenceStack: [          // what is currently “owed”, innermost last",
        "    { action: QUESTION_WH,  openedBy: PARTNER,",
        "      utterance: “What did you think of the movie?”,",
        "      sttConfidence: 0.91 }",
        "  ]",
        "  register:  ORDINARY | INSTITUTIONAL(role)   // medical, interview, retail…",
        "  phase:     OPENING | BODY | PRE_CLOSING | CLOSING",
        "  lastUserUtterance: string                   // for repair of our own turn",
        "  lastPartnerUtterance: { text, confidence }",
        "}",
    ]),
    p([ R("Why the stack pays for itself: ", {b:1}), "after a clarification detour, current AAC systems strand the user with no path back to the original question. Here, when the repair sequence pops, the engine sees the original FPP still open and regenerates answer options against the now-clarified utterance — automatically. The moment most systems lose the user is handled structurally." ]),
    p("Stack operations are few and deterministic: partner FPP pushes; user SPP pops; user or partner repair initiation pushes a nested repair sequence; repair resolution pops it and re-activates the sequence beneath. The stack rarely exceeds depth two in practice, but modeling it as a stack rather than a single “pending utterance” variable is what makes nesting recoverable."),

    h1("4.  The Move Palette"),
    p([ "At every transition-relevance place (TRP), the engine generates a palette of ", R("structurally distinct moves", {b:1}), ", not three paraphrases of the same move. The default (RESPONDING-mode) palette:" ]),
    fig("engine-fig3.png", "Figure 3. The four-slot move palette — structurally distinct social actions in a stable order.", 600),
    tbl(["Slot", "Move type", "Example — after “Want to come to dinner Friday?”"], [
        ["1", "Preferred SPP", "“I’d love to — what time?”"],
        ["2", "Dispreferred SPP (hedge + account)", "“Ah, I wish I could, but I have PT on Friday.”"],
        ["3", "Initiative move (counter, return question, expansion)", "“Could we do Saturday instead?”"],
        ["4", "Repair initiator (standing or confidence-triggered)", "“Sorry — dinner where?”"],
    ], [900, 3800, 4660]),
    sp(),
    bul([ R("Slot 1 — Preferred. ", {b:1}), "Delivered plainly, no hedging, per CA preference organization. The model's best guess at what this user would most plausibly say." ]),
    bul([ R("Slot 2 — Dispreferred. ", {b:1}), "Must be properly formed: a preface (“Well…”, “Ah…”), the declination/disagreement, and a brief account. A bare “No” is a prompt-design defect, not an option." ]),
    bul([ R("Slot 3 — Initiative. ", {b:1}), "The structurally new slot. A counter-offer, return question, or topic expansion is how a speaker stops being purely responsive. Without it the AAC user is locked into the answerer role permanently — the social asymmetry AAC users report disliking most. Slot 3 must also vary grammatical format (conditional, declarative, interrogative), not just content, so the three substantive options are genuinely different conversational moves." ]),
    bul([ R("Slot 4 — Repair. ", {b:1}), "Always generated; surfaced with elevated priority when STT confidence is low or the partner's utterance is long/complex. Form adapts: open-class (“Sorry?”) when confidence is globally low, restricted (“Dinner where?”) when a specific span is uncertain." ]),
    p([ "The palette contents are mode-dependent (Section 5). The slot ", R("structure", {i:1}), " — typed, prioritized, positionally stable — is constant across modes." ]),

    h1("5.  Mode Inference and Override"),
    p("The engine operates in one of five modes. The combined LLM call's action classification selects the mode automatically; persistent controls let the user override."),
    fig("engine-fig4.png", "Figure 4. The five modes and where the floor sits; the partner's action or a user override sets the posture.", 600),
    tbl(["Mode", "Entered when", "Palette becomes"], [
        ["LISTENING", "Partner is speaking; no TRP yet", "Idle; filler ladder armed (Section 6)"],
        ["RESPONDING", "TRP detected; partner action is an FPP", "Default four-slot palette (Section 4)"],
        ["REPAIR-OF-SELF", "Partner's utterance classified as repair initiator (“What?”, “You want what?”)", "Operations on lastUserUtterance: 1. re-speak verbatim (instant, no LLM)  2. rephrase (LLM)  3. expand/clarify (LLM)"],
        ["INITIATING", "User opens; or conversation idle", "Pre-sequences and openers: “Hey, got a minute?”, “Guess what.”, “Can I ask you something?”"],
        ["PRE-CLOSING / CLOSING", "User presses Wind down; or partner produces pre-closing (“Okay, well…”)", "Pre-closings (“I should get going”), then after partner's go-ahead, terminal exchanges (“Bye!”, “Great seeing you”)"],
    ], [2200, 3400, 3760]),
    sp(),
    h2("5.1  Persistent override controls"),
    p("Four always-present, never-moving buttons form the user's escape hatch when inference is wrong. All are zero- or low-latency by design, because override moments are exactly the moments the system has already misjudged once:"),
    bul([ R("Say again ", {b:1}), "— re-speak lastUserUtterance verbatim. Instant; no LLM." ]),
    bul([ R("Hold on ", {b:1}), "— manually fire a floor-holding filler. Instant; audio asset." ]),
    bul([ R("Pardon? ", {b:1}), "— manually initiate repair on the partner's turn when the system didn't offer it. Instant; pushes a repair sequence." ]),
    bul([ R("Wind down ", {b:1}), "— enter PRE-CLOSING mode. Instant; swaps the palette." ]),
    h2("5.2  Pre-sequences: composition time at conversation level"),
    p([ "Pre-sequences deserve emphasis because they are a structural gift to AAC users. “Hey, got a minute?” is short, formulaic, and cheap to produce — and it ", R("obligates a response", {i:1}), " (“Sure, what's up?”), which buys the user a legitimate, socially ratified pause in which to compose the expensive substantive turn. This is the same trick as the filler, executed at conversation scale: spend a cheap token to purchase composition time. INITIATING mode should make pre-sequences the first-class entry point, with the substantive turn composed during the ratified pause they create." ]),

    h1("6.  Timing: the Filler Ladder"),
    p([ "CA research sets two clocks. Silence at a TRP becomes perceptible at ~0.7 seconds and is treated as meaningful (a rejection coming, a breakdown) past ~1 second. Meanwhile, transcript confirmation must precede option generation (intersubjectivity, CA doc §9), and generation itself takes up to ~3 seconds. These cannot be satisfied serially inside the silence budget. The resolution: floor-holding is an ", R("escalating ladder", {b:1}), ", where each rung needs less information than the next." ]),
    tbl(["When (after TRP)", "Rung", "Requires"], [
        ["~0.5–1.0 s", "Acknowledgment token: “Hmm.” / “Ah.” / “Good question.”", "TRP detection only. No LLM, no confirmed transcript. Kills the dangerous silence instantly."],
        ["~2–3 s", "Projection filler: “Give me a second.” — or cheaply contextualized from the partial transcript (“Let me think about Friday…”)", "Partial transcript at most. Covers the transcript-confirmation window. This is the existing placeholder mechanism, now with a defined job."],
        ["Periodic re-fill", "“Still thinking…” — escalating variants, never the same phrase twice consecutively", "Timer only. Covers extended composition."],
    ], [1700, 4200, 3460]),
    sp(),
    p([ R("Reframe: ", {b:1}), "the filler is not merely a courtesy the user can trigger; the first rung is the architectural component that makes transcript validation affordable. The acknowledgment token buys the time; validation spends it. The generation window starts only after the user confirms (or corrects) the transcript, and the UI must visually distinguish “unconfirmed transcript” from “confirmed, generating.” The current 4-second initial delay should drop to fire the first rung inside ~1 second." ]),
    p("The acknowledgment-token rung also doubles, in a later phase, as the continuer/backchannel mechanism: same audio assets, same trigger plumbing, different classification outcome (Section 8)."),

    h1("7.  Repair Runs in Both Directions"),
    h2("7.1  User repairs the partner's turn (other-initiated repair)"),
    p("Covered by Slot 4 and the persistent Pardon? control. Selection logic: open-class initiator when overall STT confidence is low; restricted initiator targeting the uncertain span when confidence is locally low; request for repetition when the utterance was long. Initiating repair pushes a nested sequence; on resolution, the engine regenerates the palette against the clarified original FPP (Section 3)."),
    fig("engine-fig5.png", "Figure 5. The repair typology mapped to engine mechanisms — by who signals the trouble and whose turn it was.", 620),
    h2("7.2  Partner repairs the user's turn — the missing mirror case"),
    p([ "Equally common and currently unaddressed anywhere in AAC: the partner says “What was that?” — the TTS was unclear, or they weren't listening. When the classifier tags the partner's utterance as a repair initiator, the engine must ", R("not", {b:1}), " generate fresh SPPs. It switches to REPAIR-OF-SELF mode and offers operations on lastUserUtterance: re-speak verbatim (one tap, zero latency), rephrase (LLM: “say the same thing differently”), or expand. This requires no new infrastructure beyond storing lastUserUtterance and one classifier label — and no amount of better option generation covers for its absence. ", R("It is the highest-leverage near-term item in this document.", {b:1}) ]),

    h1("8.  TRP Classification: Specified Three-Way, Shipped Binary"),
    p("End-of-utterance detection is currently binary (done / not done). The full specification is three-way:"),
    bul([ R("COMPLETE ", {b:1}), "(true TRP) — grammatically, prosodically, and pragmatically complete. Generate the palette; start the filler ladder." ]),
    bul([ R("INCOMPLETE ", {b:1}), "— mid-utterance pause. Do nothing; keep listening. Responding here is the high-stakes “false TRP” error the CA document flags as reading as rude." ]),
    bul([ R("CONTINUING ", {b:1}), "(backchannel-relevant; deferred) — the partner is mid-telling, paused at a clause boundary. The right move is a continuer (“uh-huh”, “really?”, “wow”), not a full response. An AAC user who cannot backchannel during a long telling appears disengaged, and partners cut their tellings short." ]),
    p("Phase 1–2 ships COMPLETE/INCOMPLETE on silence detection plus the manual fallback. The CONTINUING category is reserved in the classifier's output schema now, so that when Phase 2+ STT providers supply prosodic cues (and the combined LLM call supplies textual cues — story prefaces like “so the other day…”, clause-final continuation), continuers arrive as a new palette mode, not a rework. STT providers should be evaluated on TRP accuracy, not just word accuracy."),

    h1("9.  The LLM Contract: One Call, Inspectable Classification"),
    p([ "A single combined call both classifies and generates, with the classification emitted ", R("first", {i:1}), " in the structured output. Forcing the model to commit to the action type before producing moves implements the CA recommendation (“identify the FPP type before generating SPPs”) as a structural property of the output rather than a hope — and yields a logged classification that can be audited when options feel wrong. The application injects state; the LLM stays stateless." ]),
    h2("9.1  Request context (assembled by the engine)"),
    code([
        "{",
        "  “transcript”:        “Want to come to dinner Friday?”,",
        "  “stt_confidence”:    0.91,",
        "  “sequence_stack”:    [ /* open sequences, innermost last */ ],",
        "  “register”:          “ORDINARY”,        // or INSTITUTIONAL + role norms",
        "  “phase”:             “BODY”,",
        "  “last_user_utterance”: “…”,",
        "  “recent_turns”:      [ /* short rolling window */ ],",
        "  “user_profile”:      { /* voice, interests, standing facts */ }",
        "}",
    ]),
    h2("9.2  Response schema"),
    code([
        "{",
        "  “partner_action”: “INVITATION”,      // FPP type, committed first",
        "  “turn_status”:    “COMPLETE”,        // COMPLETE | INCOMPLETE | CONTINUING",
        "  “is_repair_initiator”: false,        // triggers REPAIR-OF-SELF mode",
        "  “moves”: [",
        "    { “slot”: “PREFERRED”,    “text”: “…”, “hint”: “…” },",
        "    { “slot”: “DISPREFERRED”, “text”: “…”, “hint”: “…”,",
        "      “account”: true },",
        "    { “slot”: “INITIATIVE”,   “text”: “…”, “hint”: “…”,",
        "      “format”: “counter-offer” },",
        "    { “slot”: “REPAIR”,       “text”: “…”, “hint”: “…”,",
        "      “trigger”: “low_stt_confidence” }",
        "  ]",
        "}",
    ]),
    h2("9.3  System-prompt obligations"),
    // CONTENT NOTE: these six bullets were EMPTY in the prior hand-authored docx.
    // Filled here with the obligations the prompt actually enforces, consistent
    // with §4, §9.2, and app/js/llm.js. Review/adjust as desired.
    p("The system prompt must enforce the following, every call:"),
    bul([ R("Classify before generating. ", {b:1}), "Emit partner_action (and turn_status, is_repair_initiator) before any move, so the model commits to the FPP type before producing SPPs." ]),
    bul([ R("Four structurally distinct moves. ", {b:1}), "Fill the preferred, dispreferred, initiative, and repair slots with different social actions — never paraphrases of one another." ]),
    bul([ R("Properly formed dispreferred. ", {b:1}), "The dispreferred move carries a meaningful preface, the declination or disagreement, and a brief account — never a bare “No.”" ]),
    bul([ R("Varied initiative format. ", {b:1}), "Vary the initiative move's grammatical format (counter-offer, return question, or expansion; conditional / declarative / interrogative) so it is a genuinely different move." ]),
    bul([ R("Confidence-adaptive repair. ", {b:1}), "Open-class repair (“Sorry?”) when overall STT confidence is low; restricted repair targeting the uncertain span (“Dinner where?”) when only part is uncertain." ]),
    bul([ R("Speak as the user; no placeholders. ", {b:1}), "Stay in the user's voice and stance; never output bracketed placeholders such as [Name] or [city] — phrase around any unknown fact, and never surface a fact the user marked private or declined." ]),
    p("The policy table — which moves are generated and how they're prioritized, indexed by (action type, register, confidence, phase) — lives in the prompt for Phase 1 and can migrate into engine code as patterns stabilize. Practice Mode scenarios should set the register field explicitly, converting the scenario library from vocabulary domains into interactional norm sets."),
    h2("9.4  Personalization, and why this amplifies rather than replaces the user"),
    p("The request context above (§9.1) is assembled with two further blocks the engine injects on every generation: a compact rendering of the user’s worldview profile — the self-authored “About Me” answers (identity, place, the people in their life, daily life, interests, and over time personality, values, and characteristic phrasing) — and a rendering of the relationship graph, identifying who the current partner is to the user. Facts the user has marked private or declined are never emitted; they surface only as an instruction to phrase around them. This is recipient design realized as concrete prompt content, drawn from the user’s own answers rather than an assumed persona. With no profile at all, generation still proceeds, simply with less personalization."),
    p("These inputs shape the options; they do not author them. The engine never speaks on its own initiative: it presents the palette, the user selects, and only then is anything spoken — and everything spoken, including the floor-holding placeholders, is shown on screen as it plays. The partner only ever hears words the user deliberately chose. The first (PREFERRED) move is the system’s best prediction of what THIS user would say, not a recommendation of what they ought to say; it models the person, it does not steer them."),
    p("Two further guarantees keep authorship with the user. Free composition — the “in my own words” path — is always available, so the user can always say something the model did not generate; the generated options are an aid to expression, never its author. And the engine is deliberately not optimized to make the user maximally informative or correct: it must let them say “I don’t know,” hedge, or hold a sincere but mistaken view, because it mirrors a real person’s knowledge and fallibility. An assistant optimizes to be helpful and right; this engine optimizes to sound like the user. The net effect is amplification — the intelligence predicts and articulates the user’s own intent quickly, while the decision of what is actually said stays entirely with the user."),
    fig("engine-fig6.png", "Figure 6. Personalization shapes the options, but the user selects — and nothing is spoken until they do; free composition is always an equal path.", 580),

    h1("10.  Phasing"),
    tbl(["Phase", "Items"], [
        ["Phase 1 refinements", "Sequence stack and ConversationState; four-slot move palette with positional stability; combined-call schema with action-type-first output; dispreferred formatting and turn-design variation in the prompt; REPAIR-OF-SELF mode + Say again (highest leverage); persistent override controls; filler ladder rung 1 (acknowledgment token ≤ 1 s, replacing the 4 s delay); transcript confirm gate with distinct visual states; PRE-CLOSING/CLOSING mode."],
        ["Phase 2", "LLM-contextualized projection fillers (rung 2) doubling as intersubjectivity displays; confidence-adaptive repair forms; institutional register norms via Situational Awareness; STT provider evaluation on TRP accuracy; pre-sequence-driven INITIATING mode; closing suggestions from context."],
        ["Later", "CONTINUING classification and the continuer palette (backchannels); prosodic TRP cues; on-device classification if latency or cost demands it."],
    ], [2400, 6960]),
    sp(),

    h1("11.  Traceability: CA Concept → Design Element"),
    tbl(["CA concept (companion doc §)", "Design element (this doc §)"], [
        ["TRPs / end-of-utterance (§1)", "Three-way TRP classification, shipped binary (§8); STT evaluation criterion"],
        ["Adjacency pairs / conditional relevance (§2)", "Sequence stack (§3); action-type-first LLM output (§9)"],
        ["Preference organization (§3)", "Slots 1–2 with mandated dispreferred formatting (§4, §9.3)"],
        ["Floor-holding / fillers (§4)", "Filler ladder; rung 1 enables transcript validation (§6)"],
        ["Insert sequences / OIR (§5)", "Slot 4, Pardon? control, nested repair sequences, automatic regeneration after repair (§3, §7.1)"],
        ["Turn design (§6)", "Format variation across slots; format-aware hints (§4, §9.3)"],
        ["Openings and closings (§7)", "INITIATING mode with pre-sequences; PRE-CLOSING/CLOSING modes; Wind down control (§5)"],
        ["Institutional vs. ordinary talk (§8)", "Register field carrying interactional norms; policy table (§9)"],
        ["Intersubjectivity / next-turn proof (§9)", "Transcript confirm gate; contextual fillers as uptake displays (§6)"],
        ["Silence and latency (§10)", "Two-clock timing model; ≤ 1 s acknowledgment token (§6)"],
        ["(Extension beyond companion doc)", "Repair-of-self / partner-initiated repair of the user's turn (§7.2); continuers (§8); move palette as structural frame (§4); access-method independence (§2)"],
    ], [3800, 5560]),
];
// ==================== END CONTENT ====================

const titleBlock = [
    new Paragraph({ spacing: { before: 240, after: 80 },
        children: [new TextRun({ text: "Conversation Engine Design", bold: true, color: "1F4E79", size: 40, font: "Arial" })] }),
    new Paragraph({ spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: "Mapping Conversation Analysis Concepts to Programmatic Flow", italics: true, color: "595959", size: 26, font: "Arial" })] }),
    new Paragraph({ spacing: { before: 0, after: 240 },
        children: [
            new TextRun({ text: "Companion to: Conversation Analysis Concepts — Critical Considerations for the AI-Enabled AAC Architecture", italics: true, color: "808080", size: 18, font: "Arial" }),
            new TextRun({ text: "  |  Volksswitch.org  |  June 2026", color: "808080", size: 18, font: "Arial" }),
        ] }),
];

const children = [...titleBlock];
for (const b of blocks) children.push(...renderBlock(b));

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 24 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 300, after: 140 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 25, bold: true, font: "Arial", color: "2E75B6" },
                paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
        ]
    },
    numbering: { config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ] },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Conversation Engine Design", italics: true, color: "808080", size: 18, font: "Arial" })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  June 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" }),
            ] })] }) },
        children,
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync("Conversation-Engine-Design.docx", buffer);
    console.log("Conversation-Engine-Design.docx generated.");
});
