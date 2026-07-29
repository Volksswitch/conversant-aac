// Generates "Conversant AAC iPad Architecture.docx" — the build-ready specification
// for running Conversant AAC on iPadOS (July 29 2026).
// Run: node generate-ipad-architecture-doc.js
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function para(text, opts = {}) {
    return new Paragraph({
        spacing: { before: 0, after: opts.after ?? 160 },
        children: [new TextRun({ text, ...opts.run })]
    });
}
function boldPara(label, text, after = 140) {
    return new Paragraph({
        spacing: { before: 0, after },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function bullet(text, ref = "bullets") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function bulletBold(label, text, ref = "bullets") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function numBold(label, text, ref) {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 100 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

// A call-out box: shaded single-cell table. Used for the load-bearing statements.
function callout(label, text, fill = "FBF2E6") {
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders,
        rows: [new TableRow({ children: [new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [
                new TextRun({ text: label, bold: true }), new TextRun(text)
            ]})]
        })]})]
    });
}

function simpleTable(headers, rows, widths) {
    const headerCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "D5E8F0" },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: true, size: 20 })] })]
    });
    const bodyCell = (cell, w) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const text = isObj ? cell.text : cell;
        const run = isObj
            ? new TextRun({ text, size: 20, italics: !!cell.italics, bold: !!cell.bold })
            : new TextRun({ text, size: 20 });
        return new TableCell({
            width: { size: w, type: WidthType.DXA },
            margins: cellMargins,
            shading: isObj && cell.fill ? { type: ShadingType.CLEAR, fill: cell.fill } : undefined,
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [run] })]
        });
    };
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders,
        rows: [
            new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
            ...rows.map(r => new TableRow({ children: r.map((c, i) => bodyCell(c, widths[i])) }))
        ]
    });
}

function caption(text) {
    return new Paragraph({
        spacing: { before: 60, after: 200 },
        children: [new TextRun({ text, italics: true, size: 18, color: "666666" })]
    });
}

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 320, after: 180 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 26, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 220, after: 140 }, outlineLevel: 1 } },
        ]
    },
    numbering: {
        config: [
            { reference: "bullets",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "phases",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "Phase %1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 900, hanging: 540 } } } }] },
            { reference: "openq",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "steps",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — iPad Architecture", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  July 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [

// ============================================================ TITLE
new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: "Conversant AAC on iPad", bold: true, size: 44, font: "Arial", color: "1F4E79" })]
}),
new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text: "A build-ready architecture specification for iPadOS", size: 26, font: "Arial", color: "555555" })]
}),
para("July 29, 2026 · Volksswitch.org · Conversant AAC v0.5.99 (development)", { run: { size: 20, color: "666666" }, after: 240 }),

callout("What this document is. ",
    "A build-ready specification for running Conversant AAC on an iPad, served from GitHub Pages and running in the browser, keeping as much of the existing user interface, guidelines, and architectural goals as the platform allows. It is written to be executed from, not to decide from — the decision to proceed is assumed. It is not a port that has been done; it is the plan for doing one.",
    "EAF1FA"),
emptyPara(),

callout("The one thing to read if you read nothing else. ",
    "Storage is a solved problem and a small change. Speech recognition is the whole risk, and the specific things Conversant depends on — continuous capture and interim results — are exactly the two things reported broken on iOS. Installing Chrome or Edge does not help, because every browser on iPad is Safari's engine wearing a different badge. The fallback is a paid cloud transcription service, which is designed in full in Section 4. Nothing should be built until the capability probe has been run on a real iPad."),
emptyPara(),

heading2("How claims in this document are marked"),
para("Platform behavior is fiddly, changes between iPadOS releases, and is easy to get wrong from memory. Every non-obvious claim here carries one of three markers so you can tell what it rests on:"),
bulletBold("[SOURCE] ", "— read directly out of the Conversant AAC codebase, with the file and line noted."),
bulletBold("[RESEARCH] ", "— established from current public documentation and developer reports, cited in Section 12."),
bulletBold("[PROBE] ", "— not yet established. The capability probe answers it on your own hardware. Anything marked [PROBE] must not be treated as fact until the probe has run."),
para("Where a [RESEARCH] claim is load-bearing, the probe re-tests it anyway. Reported behavior and observed behavior are not the same thing, and this is a population where a wrong assumption costs a user their voice.", { after: 200 }),

// ============================================================ 1
heading1("1 · Purpose and Scope"),

heading2("1.1 What is being built"),
para("One codebase that runs on both Windows tablets and iPads, adapting at runtime to what the platform actually provides. Explicitly not a fork, not a second app, and not an iPad-specific build."),
para("The reason is not tidiness. Conversant AAC is a one-developer project whose strategic survival depends on having no ongoing costs and no duplicated effort. Two codebases would double the maintenance surface for every future feature, and the first time they drifted apart the iPad version would begin dying quietly. A single codebase with three or four narrow platform adapters is the only shape that survives."),

heading2("1.2 Why iPad is worth the work"),
para("The iPad is the dominant platform in AAC, and the gap is not close. That brings concrete advantages the Surface does not have:"),
bullet("A mature keyguard industry. Physical keyguards for iPads are a commodity from multiple vendors, in stock, in standard sizes. Conversant's entire Spatial Stability principle exists to make a keyguard work; on iPad that keyguard is a catalog purchase rather than a custom fabrication."),
bullet("A mature mounting industry — wheelchair mounts, floor stands, table clamps — again standard and available."),
bullet("Guided Access, an operating-system feature that locks the device into a single app. This is a better answer to the single-instance problem than the Web Locks design currently planned for Windows, and it comes free."),
bullet("Cellular models. Conversant needs a live internet connection for both the AI and, on every platform, speech recognition. An iPad with cellular works in a park; a Wi-Fi-only Surface does not."),
bullet("Familiarity. Speech-language pathologists, school teams, and families already know iPads. Support conversations start further along."),
para("None of this changes the fact that the platform is more restrictive. It changes how much restriction is worth absorbing.", { after: 200 }),

heading2("1.3 What stays the same"),
para("The following are unchanged by this specification, and any implementation that compromises them has gone wrong:"),
bullet("Static web app, served from GitHub Pages, no backend server the project pays for."),
bullet("User-funded AI. The user supplies their own API key and pays only for what they use."),
bullet("All personal data stays on the device, except what is sent to the AI provider."),
bullet("Spatial Stability. Fixed geometry, no reflow, one physical keyguard across every screen."),
bullet("The conversation engine, the worldview model, the relationship graph, the Express Panel, Practice Mode, and the entire response-generation pipeline — none of these touch the platform and none of them change."),
bullet("Transcript validation. The user must be able to confirm what the partner said. Section 4 treats this as a hard constraint, not a preference, and it is the main reason the cheapest speech option may not be acceptable."),

// ============================================================ 2
heading1("2 · Platform Reality"),

heading2("2.1 Every browser on iPad is Safari"),
callout("This corrects a working assumption. ",
    "Installing Chrome or Edge on the iPad is not a fallback for Safari's limitations. Apple requires every browser on iOS and iPadOS to use WebKit, so Chrome, Edge, and Firefox for iPad are Safari's engine in a different wrapper. They inherit the same speech, storage, and layout behavior. [RESEARCH]"),
emptyPara(),
para("Apple's BrowserEngineKit does permit genuine alternative engines, but only for users in the European Union, and only on iOS 17.4 or later and iPadOS 18 or later. For a United States user this is unavailable. [RESEARCH]"),
para("There is one nuance worth testing rather than assuming, and it runs the wrong way. Although the engine is shared, the surrounding application is not, and some capabilities are granted per-application. Speech recognition in particular has historically been reachable only from Safari proper and not from third-party browser wrappers. So Chrome and Edge on iPad are, if anything, more likely to be worse than Safari for the single capability that matters most here. The probe tests all three so this is settled by observation. [PROBE]"),

heading2("2.2 The iPad lies about what it is"),
para("By default, Safari on iPadOS requests desktop websites, and its user-agent string identifies the device as a Macintosh. There is no \"iPad\" in it. [RESEARCH]"),
boldPara("Consequence for implementation: ", "any platform branch written by sniffing the user-agent string for \"iPad\" will silently fail to detect an iPad, and the device will be treated as a desktop. Platform detection must use capability detection, or at minimum navigator.maxTouchPoints, which reports a touch device even when the user-agent claims to be a Mac. The probe reports both so the discrepancy is visible."),

heading2("2.3 The capability ledger"),
para("What changes between the current target and iPadOS. This is the whole surface area of the port."),
emptyPara(),
simpleTable(
    ["Capability", "Windows (Edge / Chrome)", "iPadOS (all browsers)", "Impact"],
    [
        ["Data folder", "File System Access, user-picked visible folder", "Not available; OPFS instead", { text: "Moderate — Section 3", bold: true }],
        ["Storage durability", "Permanent", "Evictable after 7 days unless persisted", { text: "Moderate", bold: true }],
        ["Speech recognition", "Works (cloud, via Google/Microsoft)", "Present, but continuous and interim reported broken", { text: "SEVERE — Section 4", bold: true, fill: "F8D7DA" }],
        ["Speech synthesis", "Works, many voices", "Works; gesture-gated, voice list truncated", { text: "Moderate — Section 5", bold: true }],
        ["Microphone capture", "Works", "Works", "None"],
        ["Layout height", "100vh correct", "100vh exceeds visible area in a tab", { text: "SEVERE — Section 6", bold: true, fill: "F8D7DA" }],
        ["OS keyboard suppression", "inputmode=\"none\" reliable", "Unreliable; needs readonly", { text: "Minor — Section 6", bold: true }],
        ["Landscape lock", "Not needed", "Manifest orientation ignored", { text: "Minor", bold: true }],
        ["Install", "Standard PWA install prompt", "Manual Add to Home Screen only", { text: "Minor — Section 7", bold: true }],
        ["Single instance", "Web Locks (planned)", "Guided Access (better)", { text: "Improvement", bold: true }],
        ["Service worker / updates", "Works", "Works; update path needs retest", { text: "Minor", bold: true }],
        ["AI provider calls", "Direct browser fetch", "Identical", "None"],
        ["Conversation engine", "—", "Identical", "None"]
    ],
    [2000, 2600, 2760, 2000]
),
caption("Table 1 — Capability ledger. Two severe items; everything else is minor to moderate. The engine, the worldview model, and the entire response pipeline are untouched."),

// ============================================================ 3
heading1("3 · Storage"),

heading2("3.1 The change is smaller than it appears"),
para("Conversant's storage layer is already correctly factored. Every File System Access call is funneled through a small set of functions in app/js/storage.js, and application code never touches a file handle directly. [SOURCE]"),
emptyPara(),
simpleTable(
    ["Function (storage.js)", "What it does", "iPad change"],
    [
        ["pickDataFolder()", "showDirectoryPicker(), stores handle in IndexedDB", { text: "REWRITE — no picker exists", bold: true }],
        ["restoreDataFolder()", "Re-acquires the handle from IndexedDB", { text: "REWRITE — OPFS root needs no handle", bold: true }],
        ["hasDataFolder() / getDataFolderName()", "Reports folder state to the UI", "Adapt — report \"on-device storage\""],
        ["readFile(name) / writeFile(name, content)", "getFileHandle + createWritable", { text: "UNCHANGED", bold: true }],
        ["getSettingsDir() / getConversationsDir()", "getDirectoryHandle for subfolders", { text: "UNCHANGED", bold: true }],
        ["appendErrorFile(entry)", "Append to errors.log", { text: "UNCHANGED", bold: true }],
        ["Everything above these", "Settings, conversation logs, profiles", { text: "UNCHANGED", bold: true }]
    ],
    [2500, 3400, 3460]
),
caption("Table 2 — The File System Access seam. Two functions are rewritten; the rest are untouched."),
para("The reason so little changes is that the Origin Private File System uses the same interfaces as the File System Access API — the same FileSystemDirectoryHandle and FileSystemFileHandle objects, with the same getFileHandle, getDirectoryHandle, and createWritable methods. Once the module-level dirHandle is set to the OPFS root instead of a user-picked directory, the read and write paths work as written. [RESEARCH, confirmed by probe]"),
boldPara("Implementation: ", "introduce a backend selector in storage.js. On a platform with showDirectoryPicker, behave exactly as today. Otherwise, acquire the OPFS root via navigator.storage.getDirectory() and assign it to dirHandle. The existing directory tree — conversations/, settings/, and the root-level JSON files — is created inside OPFS unchanged."),

heading2("3.2 One fork that the probe decides"),
para("Writing to OPFS has two possible mechanisms. createWritable() works from the main thread and is what the existing code uses. createSyncAccessHandle() is faster but is only available inside a Web Worker. [RESEARCH]"),
para("If Safari provides createWritable on the main thread, storage.js needs no structural change. If it provides only the synchronous worker-scoped handle, all file writes must move into a Worker and storage.js becomes asynchronous message-passing — a substantially larger change affecting every caller's error handling. The probe tests exactly this and reports which mechanism is available. [PROBE]"),

heading2("3.3 What is genuinely lost"),
callout("The portable, user-visible file disappears. ",
    "OPFS is private to the browser. There is no folder the user can open, no worldview.json they can copy onto a flash drive, and no way to inspect or back up their own data through the Files app. The v0.2.25 workflow — copy worldview.json from one machine into the other machine's data folder and have the app adopt it — cannot exist on iPad."),
emptyPara(),
para("This matters more than it first sounds, because that visible file is currently doing three separate jobs: it is the backup mechanism, the cross-device transfer mechanism, and the reassurance that the user owns their own data. All three now need building explicitly."),
boldPara("Required replacement — Export / Import: ",
    "a single \"Export my data\" action that serializes the whole data set into one file and hands it to the user via a normal download, and a matching \"Import my data\" that accepts one back through a file input. Both are supported on iPadOS and both land in the Files app, so the data becomes visible, backup-able, and movable again — just deliberately rather than incidentally."),
para("The \"file in the folder wins\" reconciliation rule from v0.2.25 has no meaning on iPad, because there is no folder to inspect. Import becomes an explicit, confirmed, destructive action with a danger dialog, per the standing rule about confirming before destroying significant work."),
boldPara("Note this is not iPad-only value. ", "Export/Import is the mechanism the long-planned cross-device transfer feature has always needed, and the Settings-profile work from v0.5.83 is already half of it. Building it for iPad builds it for Windows too."),

heading2("3.4 Durability"),
para("WebKit erases site data — IndexedDB, localStorage, service workers, and OPFS — after seven days without user interaction. An origin that has been granted persistent storage is exempt from that sweep. Safari 17 and later support the Storage API fully. [RESEARCH]"),
boldPara("Implementation: ", "call navigator.storage.persist() during first-run setup, and treat a denial as a condition the user must be told about — an AAC user silently losing their worldview profile after a two-week hospital stay is a serious failure, not a cosmetic one. Surface the persisted state in Settings, and prompt for an export when persistence has been denied."),
para("This is better than previously assumed. The project's working note held that iOS storage was fundamentally unreliable and that persistence was best-effort even after installing to the Home Screen. With Safari 17's full Storage API support, a granted persist() is an actual exemption. Whether it is granted in practice, and whether it survives a Home Screen install, is [PROBE].", { after: 200 }),

// ============================================================ 4
heading1("4 · Speech In — The Decisive Problem"),

heading2("4.1 Exactly what breaks"),
para("Conversant's Continuous Partner Capture is built on three behaviors, all visible in app/js/stt.js: [SOURCE]"),
bulletBold("continuous = true ", "(stt.js:184) — the microphone stays open across pauses, so the partner's whole turn accumulates."),
bulletBold("interimResults = true ", "(stt.js:185) — partial words arrive before they are finalized."),
bulletBold("A silence checkpoint ", "— after a configurable pause, the accumulated speech is sent for response generation, and recording continues."),
para("On iOS, continuous mode is reported broken: the microphone never stops and recognized text is never delivered. Interim results are reported unreliable in WebKit. [RESEARCH]"),
callout("The two flags Conversant is built on are precisely the two that fail. ",
    "This is not a general \"speech is flaky on iOS\" caution. It is a direct hit on the specific mechanism, and it means the core loop cannot be assumed to work at all until measured."),
emptyPara(),
para("Interim results are load-bearing in three separate places, which is why losing them is worse than it sounds:"),
bullet("The live transcript. The partner's words appear as they speak. Without interims the transcript only updates after each pause. [SOURCE — stt.js:222]"),
bullet("Interruption capture. getCurrentTranscript() returns finalized segments plus the in-progress interim, so that cutting in mid-sentence still records what the partner had said. Without interims, an interruption loses their partial speech — the exact defect fixed in v0.5.77. [SOURCE — stt.js:310]"),
bullet("Echo filtering. The filter matches the app's own speech against a growing interim prefix. Without interims it loses one of its four matching strategies and gets weaker. [SOURCE — stt.js:169]"),

heading2("4.2 One piece of good news"),
para("The adaptation is closer to the existing code than expected. stt.js already restarts recognition when a session ends while the user still intends to listen, and already flushes the pending interim into the accumulated text before restarting so nothing is lost across the restart boundary. [SOURCE — stt.js:225-250]"),
para("That restart loop is the same shape as the documented iOS workaround — turn continuous off and restart on each end event. The structure is in place; what changes is the flag, the restart timing, and the error handling around it."),
boldPara("One hazard to fix: ", "onerror currently clears listeningIntent on any surfaced error, deliberately, so that an offline device does not spin in a restart loop (stt.js:252-260). [SOURCE] On iOS, where sessions end constantly by design, a benign error would tear down listening entirely. The iOS adapter needs to distinguish benign session churn from genuinely fatal errors."),

heading2("4.3 The three tiers"),
para("Design all three. Which one ships is decided by the probe, and the app should be able to fall back at runtime rather than at build time."),
emptyPara(),
simpleTable(
    ["", "Tier 1 — Web Speech", "Tier 2 — Batch cloud", "Tier 3 — Streaming cloud"],
    [
        ["How", "Built-in recognition, non-continuous, restarted", "Record to a pause, upload the clip, get text", "Stream audio over a WebSocket, text returns live"],
        ["Money", { text: "Free", bold: true }, "Per minute of audio", "Per minute of audio"],
        ["Second API key", { text: "No", bold: true }, "Yes", "Yes"],
        ["Live transcript", "Only if interims work [PROBE]", { text: "No — text arrives after the pause", bold: true }, { text: "Yes", bold: true }],
        ["Interruption capture", "Degraded without interims", { text: "Lost", bold: true }, { text: "Full", bold: true }],
        ["Added latency", "None", "Upload + transcribe per pause", "Negligible"],
        ["Offline", "No (already cloud-based)", "No", "No"],
        ["Accuracy", "Adequate", "Typically better", "Typically better"],
        ["Complexity", { text: "Lowest", bold: true }, "Moderate", "Highest"]
    ],
    [1700, 2600, 2500, 2560]
),
caption("Table 3 — Speech-in tiers. Tier 2 is cheapest to build of the two paid options but is the only one that gives up the live transcript, which is why it is not the recommended fallback."),

heading2("4.4 Tier 1 — adapted Web Speech"),
para("Preferred if it works, because it costs nothing and needs no second account. Changes required:"),
bullet("Set continuous = false on iPadOS and rely on the existing onend restart, with a short delay before restarting."),
bullet("Distinguish benign session-end errors from fatal ones, so routine churn does not clear listeningIntent."),
bullet("Add a visibilitychange guard that stops recognition when the app is backgrounded and resumes on return — recognition is reported to stop working when backgrounded, and without the guard the app would believe it is still listening. [RESEARCH]"),
bullet("Degrade gracefully if interim results never arrive: the transcript updates per pause rather than per word, and interruption capture falls back to the last finalized segment."),
bullet("Note that Siri must be enabled in iPadOS Settings for recognition to be available at all — this belongs in the setup instructions, not in code. [RESEARCH]"),

heading2("4.5 Tiers 2 and 3 — cloud transcription"),
para("If Tier 1 fails the probe, the app streams microphone audio to a paid transcription service. This is a real architectural change and should be understood as such."),
boldPara("It does not break the no-backend principle. ",
    "The user supplies their own transcription key, stored on their own device, billed to their own account — exactly the model already used for the AI provider. No server is introduced. The key is visible to the page, but so is the existing AI key, so this adds no new class of exposure. It should be handled by the same rules: never written into a cloud-synced folder, excluded from exported settings profiles, and entered per device."),
boldPara("It does add a second account to set up. ",
    "This is the real cost. Conversant already asks a non-technical user to create an API account and paste a key, which is the single hardest step in onboarding. Doing it twice roughly doubles the hardest part of setup. If Tier 3 becomes the shipping path on iPad, onboarding needs rework, not just a second field."),
boldPara("The cost model has a design consequence worth catching early. ",
    "Streaming transcription bills per minute of audio, and Conversant's auto-resume setting keeps the microphone open continuously between exchanges. Left naive, the user pays for every silent minute the device sits listening. The adapter must gate the upstream on actual speech — either voice activity detection locally, or opening the socket only once speech begins. Specific per-minute pricing must be confirmed at build time; it changes, and this document deliberately does not quote a rate that would be stale by the time anyone acts on it."),
boldPara("One incidental improvement. ",
    "Capturing through getUserMedia allows echoCancellation to be requested on the audio track. Conversant currently fights its own text-to-speech echo with a text-matching filter built over four increasingly clever strategies (stt.js:141-174). [SOURCE] Hardware echo cancellation attacks that problem at the source, and may make the whole class of echo bugs — the ones that produced the v0.3.9, v0.5.90, and v0.5.91 fixes — substantially rarer."),

heading2("4.6 The adapter contract"),
para("Whichever tier ships, it hides behind the existing stt.js interface so that app.js is unchanged. This is the full public surface that must be preserved: [SOURCE]"),
para("isSupported, setSilenceThreshold, init({ onResult, onSilence, onStatus, onPartnerSpeech }), startListening, stopListening, getCurrentTranscript, resetTranscript, dropLastStatement, noteSpokenStart, noteSpokenEnd.",
    { run: { font: "Consolas", size: 19 } }),
para("Any implementation satisfying these ten functions is a drop-in. The silence checkpoint, the echo filter, and the segment tracking are Conversant's own logic and belong in a shared layer above the adapter rather than being reimplemented per tier — they are not platform-specific and there is no reason to write them twice."),
boldPara("Fix while you are here: ", "app.js:201-202 tells a user whose browser lacks recognition to \"Use Chrome or Edge.\" [SOURCE] On an iPad that advice is wrong, since those are the same engine. It also routes through ui.setStatus, which has been a visually hidden element since v0.5.2, so the user never sees it regardless. Both halves need fixing."),

// ============================================================ 5
heading1("5 · Speech Out"),

heading2("5.1 The gesture rule"),
para("On iOS, speechSynthesis.speak() is reported to do nothing unless it is reached from a genuine user gesture. [RESEARCH] Conversant speaks placeholder phrases on a timer — the whole point of a placeholder is that it fires while the user is still choosing, with no tap involved."),
boldPara("Standard remedy: ", "unlock the synthesizer once, during a real gesture, by speaking a silent or near-empty utterance; subsequent programmatic calls then work for the life of the page. The natural place is handleStart (app.js:446), which already runs from the user pressing Start. [SOURCE] Whether the unlock genuinely persists is [PROBE]."),
para("If it does not persist, placeholders cannot be spoken on iPad at all. That is survivable — the placeholder cap can already be set to zero for users who find them artificial — but it removes the floor-holding behavior that keeps a partner from thinking the user has stopped responding."),

heading2("5.2 Voices"),
para("Safari's getVoices() is reported to return a truncated list, sometimes empty, and voice selection does not always take effect. [RESEARCH] Two consequences:"),
bullet("The voice picker in Settings may offer very little. The UI must handle an empty list without breaking, and should not present an empty dropdown as if it were a choice."),
bulletBold("Practice Mode may lose its distinct partner voice. ", "The feature depends on the AI partner speaking in a different voice from the user so the two are aurally distinguishable. If only one usable voice exists, fall back to differentiating by rate and pitch on the same voice — cruder, but it preserves the distinction that makes the feature work."),
para("Apple's Personal Voice — the system feature that banks a user's own voice — is not exposed to web applications. An iPad user who has banked their voice at the operating-system level cannot use it in Conversant. This is worth knowing precisely because it looks like it should work, and it is a reasonable question a user will ask.", { after: 200 }),

heading2("5.3 Backgrounding and cancellation"),
bullet("Speech stops when the app is backgrounded, including mid-utterance. [RESEARCH] Add a visibilitychange handler that cancels cleanly rather than leaving the speaking state stuck true — the echo filter and the placeholder gate both read that state."),
bullet("tts.js:47 calls synth.cancel() and then immediately synth.speak() in the same tick. [SOURCE] This sequence is a known source of trouble on iOS, where the cancel is asynchronous and the new utterance can be swallowed. If speech intermittently fails to start on iPad, this is the first place to look; the remedy is a short delay between the two."),

// ============================================================ 6
heading1("6 · User Interface and Layout"),

heading2("6.1 The one hard layout failure"),
callout("styles.css:125 sets height: 100vh with overflow: hidden. ",
    "In a Safari tab, 100vh resolves to the viewport height with the toolbars retracted, which is taller than the actually visible area. Because the body cannot scroll, the bottom of the layout — the dock, holding the Express Panel and the on-screen keyboard — sits underneath Safari's toolbar and cannot be tapped. That is a hard failure of the primary interaction surface, not a cosmetic problem. [SOURCE + RESEARCH]",
    "F8D7DA"),
emptyPara(),
boldPara("Fix: ", "use 100dvh, the dynamic viewport height, which resolves to the actually visible area. Supported in Safari 15.4 and later. The probe confirms support and reports exactly how many pixels are being hidden on your device. The same substitution is needed anywhere else vh drives a full-height container."),

heading2("6.2 Screen size and the calibrated fleet"),
para("Conversant's proportional layout is explicitly calibrated to a device fleet of roughly 1280 to 1465 CSS pixels wide by 853 to 976 tall, with clamp() bounds deliberately set outside that range so that within the fleet everything scales linearly. [SOURCE — styles.css:23-24]"),
para("Every iPad falls outside that fleet. Running the actual root type rule — clamp(14px, 1.6vmin + 1.8px, 24px) — against real iPad dimensions gives a more precise picture than \"it will not fit\":"),
emptyPara(),
simpleTable(
    ["Device", "Landscape CSS px", "Root font computes", "Verdict"],
    [
        ["iPad Pro 13\"", "1366 × 1024", "18.18px", { text: "In range — scales correctly", bold: true }],
        ["iPad Pro 11\"", "1194 × 834", "15.14px", "In range"],
        ["iPad Air 11\"", "1180 × 820", "14.92px", "In range, close to the floor"],
        ["iPad (standard)", "1180 × 820", "14.92px", "In range, close to the floor"],
        ["iPad mini", "1133 × 744", "13.70px → clamped to 14.00px", { text: "CLAMPED — type stops scaling", bold: true, fill: "FBF2E6" }],
        ["Surface (current)", "1280 × 853", "15.45px", "Inside the calibrated fleet"]
    ],
    [2100, 2200, 2560, 2500]
),
caption("Table 4 — Measured against the shipping clamp rule. Only the mini actually pins; the rest compute in range but sit below the fleet the bounds were derived from."),
boldPara("So the work is calibration, not redesign. ",
    "The proportional system does its job — it degrades gracefully rather than breaking. What is required is widening the fleet definition to include the iPad range and re-deriving the clamp bounds so they again sit outside it, then confirming the vertical clamps on region heights and card sizes still hold at 744 pixels tall. The iPad mini should be treated as the low-water mark and may simply be declared unsupported; a 7.9-inch screen holding four response cards, a transcript, a command bar, and a keyguard grid is a hard case regardless of software."),
para("The Safari toolbar makes this worse in a tab, taking roughly 100 pixels of an already-short screen. Installed to the Home Screen the app gets the full height. This is one of several reasons Section 7 leans toward installation."),

heading2("6.3 Landscape"),
para("Conversant is landscape-only by design, and the manifest requests an orientation. iOS ignores the manifest's orientation field, and screen.orientation.lock() is generally rejected. [RESEARCH] Neither mechanism will hold the device in landscape."),
boldPara("Remedy: ", "detect portrait in CSS and show a full-screen \"please rotate\" panel rather than attempting to render the conversation layout in portrait. This is honest and cheap, and it protects the keyguard assumption — a keyguard is physically mounted in one orientation anyway, so a user with a keyguard cannot meaningfully use portrait."),

heading2("6.4 Suppressing the operating-system keyboard"),
para("Conversant draws its own keyboard on the keyguard grid, and must stop iPadOS from raising its own on top. The current mechanism is inputmode=\"none\", applied to a fixed list of fields. keyboard.js:123 describes it in a comment as \"the reliable Edge/Chrome switch,\" which is accurate and is precisely the problem — it is reliable on those browsers. [SOURCE] On iOS, inputmode=\"none\" is documented as inconsistently honored. [RESEARCH]"),
boldPara("Remedy: ", "the readonly pattern. Load the field readonly so focus raises no keyboard, and remove the attribute only when the app's own keyboard is not in use. The change is localized to applyInputMode and the IN_SCOPE selector list in keyboard.js. The probe tests inputmode=\"none\", readonly, and an unmodified control input side by side, detecting the keyboard by watching for a visualViewport height change, so the answer is measured rather than assumed."),

heading2("6.5 Touch behaviors"),
bulletBold("Double-tap zoom collides with the double-tap safeguard. ", "UI Layout Rule 10 offers a confirming double-tap to guard against accidental activation. On iOS a double tap is also the zoom gesture. Set touch-action: manipulation on tappable surfaces to disable double-tap zoom; without it, the safeguard fights the operating system and the layout can zoom mid-conversation — which on a keyguarded device is severe, because the physical holes no longer line up with anything."),
bullet("Disable the callout menu and text selection on buttons and cards, so a long press on a response card does not raise a selection menu."),
bullet("Suppress rubber-band overscroll on the body so the whole app cannot be dragged away from the keyguard."),
bullet("Safe-area insets are already partially handled — styles.css:2445 uses env(safe-area-inset-bottom) in the bottom dock. [SOURCE] Audit the remaining edges; a home-indicator strip crossing the bottom row of a keyguard grid is a real hazard."),

// ============================================================ 7
heading1("7 · Install, Updates, and Single Instance"),

heading2("7.1 Tab or Home Screen — and the pincer"),
para("This is the one genuinely unresolved architectural question, and it is unresolved because two requirements may point in opposite directions."),
bullet("Installing to the Home Screen gives the full screen height, a proper app appearance, and the strongest storage durability."),
bullet("But speech recognition is reported not to work inside a standalone Home Screen app — the API is present, feature detection passes, and nothing happens. [RESEARCH]"),
callout("If both reports hold, they are mutually exclusive, and that is the single most important thing the probe settles. ",
    "The likely escape is that Safari 17's persist() grant is sufficient on its own, making a normal tab durable enough and leaving speech working. The probe is designed to be run in both modes precisely to answer this."),
emptyPara(),
simpleTable(
    ["Probe outcome", "Decision"],
    [
        ["Speech works in standalone, persist() granted", "Install to Home Screen. Best case — full height and durability."],
        ["Speech fails in standalone, persist() works in a tab", "Run in a tab. Accept the toolbar height loss; 100dvh makes it survivable."],
        ["Speech fails in standalone, persist() unreliable in a tab", "Run in a tab with aggressive export prompting, and treat data loss as a live risk to warn the user about."],
        ["Speech fails in both", "Cloud transcription becomes mandatory, and the tab/standalone choice reverts to storage alone — install to Home Screen."]
    ],
    [3400, 5960]
),
caption("Table 5 — The decision matrix the probe resolves. Note that the last row is not a failure: it selects Tier 3 and then everything else gets easier."),

heading2("7.2 Installation is manual"),
para("iOS provides no install prompt. The user must use Share, then Add to Home Screen, and there is no way for the page to trigger or even reliably detect the opportunity. [RESEARCH] If installation is the chosen path, this needs a short illustrated setup guide, and the setup burden — already the heaviest part of onboarding — grows again."),

heading2("7.3 Updates"),
para("Service workers function on iPadOS. Conversant's update mechanism is network-first with forced revalidation, skipWaiting on install, and a controllerchange listener that reloads the page once a new worker takes control. [SOURCE — sw.js] The mechanism is sound, but the specific behavior of that reload under WebKit, and inside a standalone Home Screen app, must be retested — a silent failure to update is exactly the class of bug this app cannot afford, because the user would never know."),

heading2("7.4 Single instance — an improvement"),
para("The planned Windows solution is a Web Locks guard plus a PWA launch handler, to stop two instances from feeding each other's microphones and racing on data-folder writes. On iPad, Guided Access locks the device into one app at the operating-system level, which solves the problem more completely than any web API can, and additionally prevents a user with limited motor control from accidentally leaving the app."),
boldPara("Recommendation: ", "make Guided Access part of the standard iPad setup instructions. Still implement the Web Locks guard, since it is shared code and costs nothing on iPad, but the operating system is doing the real work here."),

// ============================================================ 8
heading1("8 · Hardware Requirements and Limitations"),
para("A running record of everything hardware-related encountered while specifying this port. This section is expected to grow as testing proceeds."),

heading2("8.1 Screen"),
para("See Table 4 for the measured layout consequences. In summary: the 13-inch iPad Pro is the best fit and the only model comfortably above the current fleet's vertical floor. The 11-inch models work. The iPad mini clamps and is the likely lower bound of support."),
bulletBold("Minimum recommended: ", "an 11-inch class iPad, 1180 × 820 CSS pixels in landscape."),
bulletBold("Best: ", "13-inch iPad Pro or iPad Air, 1366 × 1024, which alone clears the height the layout was designed against."),
bulletBold("Marginal: ", "iPad mini. Formal support should be decided only after seeing the real layout on one."),
bulletBold("Note: ", "physical size and true pixel density are not reported by any web API, and devicePixelRatio is a scaling factor rather than a density. Everything above is anchored to the CSS pixel box, which is what the platform actually exposes."),

heading2("8.2 Processor, memory, and the local-AI question"),
bullet("Any iPad capable of running a current iPadOS has ample processing power for Conversant, because all AI work happens on the provider's servers. Chip generation is not a selection criterion."),
bullet("Memory matters indirectly. Safari terminates background tabs under memory pressure, and a long conversation holds a growing history in memory. M-series iPads carry substantially more RAM than A-series and are correspondingly more tolerant of long sessions. This is a robustness consideration, not a requirement."),
bullet("Running an AI model on the device is not viable here and should not be planned for. Beyond the memory and thermal cost, in-browser inference would require WebGPU, and the model quality achievable within a tablet's constraints is well below what the conversation engine needs."),

heading2("8.3 Ports and physical connectivity"),
bullet("Modern iPads use USB-C; older models use Lightning. USB-C is preferable for wired accessories, wired switch interfaces, and charging while mounted."),
bullet("No headphone jack on current models. Audio routing to a speaker or bone-conduction headset goes through USB-C or Bluetooth."),
bullet("Charging while mounted is a genuine consideration for a device in daily communication use. A single port shared between charging and accessories is a real constraint for a wheelchair-mounted setup, and may require a powered hub."),

heading2("8.4 Connectivity"),
callout("Cellular is a real advantage, not a nicety. ",
    "Conversant requires a live internet connection for the AI, and browser speech recognition is itself a cloud service on every platform — so with no connection the app cannot transcribe at all. A cellular iPad keeps working away from Wi-Fi. For a communication device this is close to a safety consideration, and it is something the Surface line does not readily offer.",
    "EAF1FA"),
emptyPara(),
para("If cloud transcription becomes the shipping path, connectivity requirements rise further, since audio is streamed continuously while listening. Cellular data consumption should be measured during testing."),

heading2("8.5 Audio and microphone"),
bullet("iPad speakers are adequate for a quiet room and marginal in a noisy one. An external speaker is worth testing for a user whose communication partners are frequently at conversational distance."),
bullet("The built-in microphone array is good and generally better positioned than a laptop's."),
bullet("Speaker and microphone are close together on a tablet, which is the physical cause of the text-to-speech echo problem the app already fights in software. Hardware echo cancellation via getUserMedia may materially improve this if the cloud transcription path is taken — see Section 4.5."),
bullet("The recording-indicator work under SEC-7 concluded that the reliable partner-facing signal is audible, because the screen faces the user. That reasoning is unchanged on iPad, and the existing listening chime carries over."),

heading2("8.6 Accessibility hardware"),
bullet("iPadOS Switch Control is mature and operates at the operating-system level, driving Safari and therefore the app. For the future scanning and switch-access renderers this is a genuine advantage over the Windows path."),
bullet("Bluetooth switch interfaces are widely supported and well documented on iPad."),
bullet("Keyguards are commodity items for iPads. Conversant's fixed-geometry requirement is far easier to satisfy with a purchased keyguard than a fabricated one."),
bullet("Guided Access locks the device to the app — see Section 7.4."),

heading2("8.7 Software-level hardware limits"),
bullet("Apple Personal Voice is not reachable from a web application. A user who has banked their voice cannot use it in Conversant. This is the most significant capability the platform has and the web cannot touch."),
bullet("Siri must be enabled for browser speech recognition to be available. [RESEARCH] This belongs in setup instructions."),
bullet("The camera indicator light cannot be driven from a web page in any practical way on iPad, so the deferred rear-camera-LED idea from SEC-7 does not become more feasible here."),

// ============================================================ 9
heading1("9 · Build Order"),
para("Sequenced so that the riskiest unknown is resolved first and no significant work is done on an assumption the probe could invalidate."),
emptyPara(),
numBold("0 — Run the probe. ", "Load ipad-probe.html on a real iPad in Safari, Chrome, and Edge, and in both a tab and a Home Screen install. This gates everything. It answers the tab-versus-standalone question, selects the speech tier, and confirms the OPFS write mechanism. Do not begin Phase 1 until it has been run, because the storage design has a fork that depends on it.", "phases"),
numBold("1 — Storage adapter. ", "Backend selection in storage.js, OPFS root acquisition, persist() request, and the Export/Import package. Independent of the speech question, useful on Windows too, and safe to build as soon as the probe reports the write mechanism.", "phases"),
numBold("2 — Speech adapter. ", "Restructure stt.js into a shared logic layer plus a platform adapter, then implement the tier the probe selected. If Tier 3, this phase also carries the second-key onboarding work, which is larger than the code.", "phases"),
numBold("3 — Layout and touch. ", "The 100dvh fix, clamp recalibration against the widened fleet, the readonly keyboard suppression, touch-action, portrait handling, and a safe-area audit. Best done with a physical keyguard available to check against.", "phases"),
numBold("4 — Install and onboarding. ", "Add to Home Screen instructions, Guided Access setup, Siri prerequisite, and the update-path retest.", "phases"),
numBold("5 — Field testing. ", "Real conversations on real hardware. The acoustic behavior — echo, placeholder timing, microphone pickup at conversational distance — cannot be verified any other way, and has been the source of most of the surprises in this project's history.", "phases"),
emptyPara(),
boldPara("Effort shape. ", "Phase 1 is small and well understood. Phase 3 is moderate and fiddly but low-risk. Phase 2 is the entire uncertainty: Tier 1 is a modest adaptation of code that already has the right shape, while Tier 3 is a genuine new subsystem plus an onboarding problem. Until the probe runs, the honest estimate for the whole port spans a range wide enough that quoting a single number would be misleading."),

// ============================================================ 10
heading1("10 · What Is Lost, What Is Gained"),
simpleTable(
    ["Lost on iPad", "Gained on iPad"],
    [
        ["The user-visible, portable data folder. Replaced by explicit Export/Import.", "A commodity keyguard and mounting ecosystem, directly serving Spatial Stability."],
        ["Guaranteed storage permanence. Depends on a persist() grant.", "Guided Access — a better single-instance guarantee than any web API."],
        ["Possibly the free speech recognition tier, and with it possibly the single-key setup.", "Cellular connectivity, which matters because the app needs the network for both AI and transcription."],
        ["Apple Personal Voice remains unreachable, despite existing on the device.", "Mature operating-system Switch Control, easing the future scanning renderer."],
        ["Some vertical screen height, especially in a browser tab.", "Battery life, instant wake, and lighter weight for mounted use."],
        ["Certainty. Several behaviors here are reported rather than confirmed.", "The platform families and clinicians already know and trust."]
    ],
    [4680, 4680]
),
caption("Table 6 — The trade, stated plainly. The lost column is dominated by one item: if speech recognition works, the port is straightforward; if it does not, the cost is a second paid account in an onboarding flow that is already the hardest part of the product."),

// ============================================================ 11
heading1("11 · Open Questions"),
para("Everything the probe cannot settle, and which therefore needs a decision from Ken or a test in the field."),
numBold("Is the iPad mini supported? ", "It is the only model that clamps. Decide after seeing the real layout on one, ideally with a keyguard.", "openq"),
numBold("If Tier 3 is required, is a second paid account acceptable? ", "This is a product decision, not a technical one. It doubles the hardest step of onboarding. An alternative worth weighing is shipping iPad support only for users who can accept it, and continuing to recommend Windows as the primary platform.", "openq"),
numBold("Does iPad become the recommended platform or an alternative? ", "This document assumes an alternative. If iPad became primary, the ecosystem advantages in Section 1.2 would argue for reversing several existing decisions, and the Windows-specific work would need reconsidering rather than merely keeping.", "openq"),
numBold("How is the probe hosted? ", "It needs HTTPS, so a local file or a LAN address will not work for the microphone and speech tests. Pushing to this repository's main branch deploys the application, so the recommendation is a separate throwaway GitHub Pages repository. This needs Ken's approval before anything is created or pushed.", "openq"),
numBold("Does cellular data consumption make streaming transcription impractical away from Wi-Fi? ", "Measure during Phase 5. It would be an unwelcome irony if the cellular advantage were consumed by the transcription fallback.", "openq"),
numBold("Should Export/Import be built for Windows first? ", "It is useful on both platforms and is the mechanism cross-device transfer has always needed. Building it on Windows first would derisk it before the iPad work, and would deliver value even if the iPad port stalls.", "openq"),

// ============================================================ 12
heading1("12 · Sources"),
para("Claims marked [RESEARCH] rest on the following, consulted July 29, 2026. Where a claim is load-bearing it is also re-tested by the probe, because reported behavior and observed behavior are not the same thing."),
bullet("WebKit — Updates to Storage Policy (webkit.org/blog/14403), on the seven-day eviction sweep and the persist() exemption."),
bullet("MDN — Storage quotas and eviction criteria; StorageManager.persist(); File System API."),
bullet("Apple Developer — Using alternative browser engines in the European Union (BrowserEngineKit availability and scope)."),
bullet("Apple Developer Forums — multiple reports on webkitSpeechRecognition on iPad and iOS, continuous-mode failure, interim-result behavior, and standalone-mode failure."),
bullet("WebKit/Documentation issue 120 and WICG/speech-api issue 96 — interim results and continuous mode in WebKit."),
bullet("Practitioner write-ups on stabilizing the Web Speech API on iOS, covering the non-continuous restart pattern and the visibilitychange guard."),
bullet("Mobiscroll and CSS-Tricks — inputmode support inconsistency on iOS Safari and the readonly workaround."),
bullet("Deepgram and AssemblyAI developer documentation — browser WebSocket streaming transcription via getUserMedia."),
bullet("Published iPad viewport reference tables for landscape CSS pixel dimensions; the layout consequences in Table 4 were computed directly from the shipping clamp rule in styles.css rather than taken from any source."),
emptyPara(),
para("Claims marked [SOURCE] were read from the Conversant AAC codebase at version 0.5.99, principally app/js/storage.js, app/js/stt.js, app/js/tts.js, app/js/keyboard.js, app/js/app.js, app/sw.js, and app/css/styles.css.", { after: 200 }),

        ]
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("Conversant AAC iPad Architecture.docx", buffer);
    console.log("Wrote: Conversant AAC iPad Architecture.docx");
});
