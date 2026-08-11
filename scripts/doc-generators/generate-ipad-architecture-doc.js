// Generates docPath("Conversant AAC iPad Architecture.docx") — the build-ready specification
// for running Conversant AAC on iPadOS (July 29 2026).
// Run: node generate-ipad-architecture-doc.js
const { docPath } = require('./doc-paths');   // resolves figures + output, whatever the CWD
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
para("July 30, 2026 · Volksswitch.org · Conversant AAC v0.5.99 (development)", { run: { size: 20, color: "666666" }, after: 240 }),

callout("What this document is. ",
    "A build-ready specification for running Conversant AAC on an iPad, served from GitHub Pages and running in the browser, keeping as much of the existing user interface, guidelines, and architectural goals as the platform allows. It is written to be executed from, not to decide from. Its platform claims are no longer predictions: a capability probe was run on an iPad 10th generation (iPadOS 26, Safari 26.6) on July 30, 2026, and the measured results are folded in throughout.",
    "EAF1FA"),
emptyPara(),

callout("The one thing to read if you read nothing else. ",
    "Speech recognition and durable storage cannot both work on an iPad. Speech works only in a Safari browser tab; persistent storage is granted only to a Home Screen app. They are mutually exclusive, they use separate storage silos, and no configuration provides both. Conversant will therefore ship TWO iPad modes and let the user choose, with Export/Import as the bridge between them. Section 7 is the heart of this document.",
    "F8D7DA"),
emptyPara(),

heading2("How claims in this document are marked"),
para("Platform behavior is fiddly, changes between iPadOS releases, and is easy to get wrong from memory. Every non-obvious claim here carries one of four markers so you can tell what it rests on:"),
bulletBold("[MEASURED] ", "— observed on the real device by the capability probe, July 30 2026. This is the strongest class of claim in the document and it overrides anything marked [RESEARCH]."),
bulletBold("[SOURCE] ", "— read directly out of the Conversant AAC codebase, with the file and line noted."),
bulletBold("[RESEARCH] ", "— established from public documentation and developer reports, cited in Section 12. Retained only where the probe did not test it."),
para("A fourth marker, [PROBE], appeared throughout the first draft for claims the probe had yet to answer. Every one of them has now been resolved, so none remain in the text. The questions that are still genuinely open are collected in Section 11 rather than scattered as markers.", { after: 140 }),
callout("Four [RESEARCH] claims in the first draft of this document were WRONG, and the probe caught them. ",
    "Continuous recognition was reported broken on iOS; it works. Safari was reported to return a truncated voice list; it returned 68 voices. The 100vh layout trap was predicted to be a hard failure; it did not reproduce in a Safari tab. inputmode=\"none\" was reported unreliable for suppressing the on-screen keyboard; it suppressed it correctly. This is exactly why the probe was built before anything else, and it is the reason [MEASURED] outranks [RESEARCH] everywhere below."),
emptyPara(),
callout("A warning about the eighteen [RESEARCH] claims that remain. ",
    "Eight claims were put to the test. Four held and four did not — a fifty percent error rate. The published record of iOS browser limitations is substantially out of date relative to iPadOS 26, and it errs consistently in one direction: it describes the platform as more broken than it is. Treat every remaining [RESEARCH] claim in this document as a hypothesis to be tested during implementation, not as a fact to design around. Where one of them would cost real work to accommodate, test it first.",
    "FBF2E6"),
emptyPara(),

heading2("What the probe measured"),
para("Device: iPad 10th generation, iPadOS 26, Safari 26.6, WebKit 605.1.15. Six runs — Safari, Chrome, and Edge, each as a browser tab and as a Home Screen app — plus two follow-up runs. [MEASURED]"),
emptyPara(),
simpleTable(
    ["Environment", "Speech recognition", "Persistent storage", "Microphone", "Verdict"],
    [
        ["Safari — browser tab", { text: "WORKS", bold: true, fill: "E6F4EA" }, { text: "DENIED", bold: true, fill: "F8D7DA" }, "Works", "The only place speech works"],
        ["Safari — Home Screen", { text: "Nothing", fill: "F8D7DA" }, { text: "GRANTED", bold: true, fill: "E6F4EA" }, "Works", "The only place storage is durable"],
        ["Chrome — browser tab", { text: "Nothing", fill: "F8D7DA" }, { text: "DENIED", fill: "F8D7DA" }, "Works", "Worst of both"],
        ["Chrome — Home Screen", { text: "Nothing", fill: "F8D7DA" }, { text: "GRANTED", fill: "E6F4EA" }, "Works", "Identical to Safari standalone"],
        ["Edge — browser tab", { text: "Nothing", fill: "F8D7DA" }, { text: "DENIED", fill: "F8D7DA" }, "Works", "Worst of both"],
        ["Edge — Home Screen", { text: "Nothing", fill: "F8D7DA" }, { text: "GRANTED", fill: "E6F4EA" }, "Works", "Identical to Safari standalone"]
    ],
    [2100, 1800, 1800, 1200, 2460]
),
caption("Table A — The measured matrix. Exactly one cell delivers speech, and it is precisely the cell where persistent storage is refused."),
para("Two further results shaped the design more than anything else in this document:"),
bulletBold("Bookmarking does not rescue persistence. ", "Safari's storage-persistence heuristic weights site engagement, so a bookmarked origin was expected to fare better. It was tested with the bookmark in place and still returned DENIED. [MEASURED]"),
bulletBold("A Home Screen app and a Safari tab are SEPARATE storage silos. ", "Persistence was granted in the Home Screen app, and two later tab runs on the same origin still reported the storage as not persisted. The grant does not carry across — and neither does the data. This kills the obvious workaround (install once to earn persistence, then run in a tab where speech works), and it means a user who starts in one mode and later moves to the other would find their profile simply gone. [MEASURED]"),
bulletBold("All three Home Screen runs report an identical Safari user-agent. ", "Add to Home Screen always produces a Safari/WebKit standalone shell, whichever browser created it. There are four distinct environments here, not six. [MEASURED]"),
emptyPara(),

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
callout("Measured result: Chrome and Edge are not merely equivalent to Safari — they are strictly worse. ",
    "Speech recognition delivered a full result set in Safari's browser tab and delivered NOTHING in either Chrome's or Edge's tab, where both sessions aborted without a single interim or final result. Although the engine is shared, the surrounding application is not, and speech recognition is reachable only from Safari proper. Chrome and Edge on iPad must be ruled out for Conversant, not merely deprioritized. [MEASURED]",
    "F8D7DA"),

heading2("2.2 The iPad lies about what it is"),
para("By default, Safari on iPadOS requests desktop websites, and its user-agent string identifies the device as a Macintosh. There is no \"iPad\" in it. Confirmed on the device: Safari reported \"Macintosh; Intel Mac OS X 10_15_7\" with maxTouchPoints of 5. Chrome and Edge, by contrast, do say \"iPad\" — so a user-agent test would detect the two browsers that cannot run the app and miss the one that can. [MEASURED]"),
boldPara("Consequence for implementation: ", "any platform branch written by sniffing the user-agent string for \"iPad\" will silently fail to detect an iPad, and the device will be treated as a desktop. Platform detection must use capability detection, or at minimum navigator.maxTouchPoints, which reports a touch device even when the user-agent claims to be a Mac. The probe reports both so the discrepancy is visible."),

heading2("2.3 The capability ledger"),
para("What changes between the current target and iPadOS. This is the whole surface area of the port."),
emptyPara(),
simpleTable(
    ["Capability", "Windows (Edge / Chrome)", "iPadOS (all browsers)", "Impact"],
    [
        ["Data folder", "File System Access, user-picked visible folder", "Not available; OPFS instead (createWritable confirmed)", { text: "Moderate — Section 3", bold: true }],
        ["Storage durability", "Permanent", "Durable ONLY as a Home Screen app", { text: "SEVERE — Section 7", bold: true, fill: "F8D7DA" }],
        ["Speech recognition", "Works (cloud, via Google/Microsoft)", "Works ONLY in a Safari browser tab", { text: "SEVERE — Section 7", bold: true, fill: "F8D7DA" }],
        ["Speech synthesis", "Works, many voices", "Works; 68 voices; needs a gesture unlock", { text: "Minor — Section 5", bold: true }],
        ["Microphone capture", "Works", "Works in every environment tested", "None"],
        ["Layout height", "100vh correct", "100vh correct in a tab; use dvh anyway", { text: "Minor — Section 6", bold: true }],
        ["Screen size", "Inside the calibrated fleet", "At the very bottom of it (root type 14.01px)", { text: "Moderate — Section 6", bold: true }],
        ["OS keyboard suppression", "inputmode=\"none\" reliable", "inputmode=\"none\" works here too", { text: "None — no change needed", bold: true }],
        ["Landscape lock", "Not needed", "orientation.lock absent; cannot force", { text: "Minor", bold: true }],
        ["Install", "Standard PWA install prompt", "Manual Add to Home Screen only", { text: "Minor — Section 7", bold: true }],
        ["Single instance", "Web Locks (planned)", "Web Locks present; Guided Access better", { text: "Improvement", bold: true }],
        ["Service worker / updates", "Works", "Supported; update path needs retest", { text: "Minor", bold: true }],
        ["AI provider calls", "Direct browser fetch", "Identical", "None"],
        ["Conversation engine", "—", "Identical", "None"]
    ],
    [2000, 2600, 2760, 2000]
),
caption("Table 1 — Capability ledger, revised against measured results. The two severe items are the same problem seen from two sides, and they are the subject of Section 7. The engine, the worldview model, and the entire response pipeline are untouched."),

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

heading2("3.2 The fork that would have hurt — resolved, and it went the good way"),
para("Writing to OPFS has two possible mechanisms. createWritable() works from the main thread and is what the existing code already uses. createSyncAccessHandle() is only available inside a Web Worker; had that been the only option, every file write would have had to move into a Worker, turning storage.js into asynchronous message-passing and touching every caller's error handling — a substantially larger change."),
callout("createWritable works. ",
    "All six probe runs completed an OPFS write-then-read round trip via createWritable on the main thread, and successfully created and listed a subdirectory. The larger rewrite is avoided entirely; the existing read and write paths carry over as written. Reported quota was 33,792 MB. [MEASURED]",
    "E6F4EA"),

heading2("3.3 What is genuinely lost"),
callout("The portable, user-visible file disappears. ",
    "OPFS is private to the browser. There is no folder the user can open, no worldview.json they can copy onto a flash drive, and no way to inspect or back up their own data through the Files app. The v0.2.25 workflow — copy worldview.json from one machine into the other machine's data folder and have the app adopt it — cannot exist on iPad."),
emptyPara(),
para("This matters more than it first sounds, because that visible file is currently doing three separate jobs: it is the backup mechanism, the cross-device transfer mechanism, and the reassurance that the user owns their own data. All three now need building explicitly."),
boldPara("Required replacement — Export / Import: ",
    "a single \"Export my data\" action that serializes the whole data set into one file and hands it to the user via a normal download, and a matching \"Import my data\" that accepts one back through a file input. Both are supported on iPadOS and both land in the Files app, so the data becomes visible, backup-able, and movable again — just deliberately rather than incidentally."),
para("The \"file in the folder wins\" reconciliation rule from v0.2.25 has no meaning on iPad, because there is no folder to inspect. Import becomes an explicit, confirmed, destructive action with a danger dialog, per the standing rule about confirming before destroying significant work."),
boldPara("Note this is not iPad-only value. ", "Export/Import is the mechanism the long-planned cross-device transfer feature has always needed, and the Settings-profile work from v0.5.83 is already half of it. Building it for iPad builds it for Windows too."),

heading2("3.4 Durability — measured, and it is the crux"),
para("WebKit erases site data — IndexedDB, localStorage, service workers, and OPFS — after seven days without user interaction. An origin granted persistent storage is exempt from that sweep. [RESEARCH]"),
para("The probe tested the grant in every environment. The result is unambiguous and it is the reason this document has a Section 7:"),
bulletBold("Home Screen app: GRANTED, every time. ", "Storage is durable. [MEASURED]"),
bulletBold("Browser tab: DENIED, every time, in all three browsers. ", "Storage is evictable after seven days of non-use. [MEASURED]"),
bulletBold("Bookmarking does not change it. ", "Safari's heuristic weights site engagement, so a bookmarked origin was expected to do better. Tested with the bookmark in place: still denied. [MEASURED]"),
callout("The grants do not cross between the two, and neither does the data. ",
    "Persistence was granted in the Home Screen app; two subsequent Safari-tab runs on the same origin still reported storage as not persisted. A Home Screen app and a browser tab are separate storage silos. This is the single most consequential measurement in the document: it rules out the obvious workaround of installing once to earn persistence and then running in a tab, and it means moving between the two modes loses everything unless the user exports first. [MEASURED]"),
emptyPara(),
boldPara("Implementation: ", "call navigator.storage.persist() during first-run setup in both modes. In the installed mode, confirm the grant and move on. In the tab mode, expect denial, and treat it as a standing condition to design around rather than an error to report once — see Section 7.3 for the automatic backup requirement that follows from it. Surface the current persisted state in Settings so the user can always see whether their data is safe."),

// ============================================================ 4
heading1("4 · Speech In"),

heading2("4.1 What was predicted, and what actually happens"),
para("Conversant's Continuous Partner Capture is built on three behaviors, all visible in app/js/stt.js: [SOURCE]"),
bulletBold("continuous = true ", "(stt.js:184) — the microphone stays open across pauses, so the partner's whole turn accumulates."),
bulletBold("interimResults = true ", "(stt.js:185) — partial words arrive before they are finalized."),
bulletBold("A silence checkpoint ", "— after a configurable pause, the accumulated speech is sent for response generation, and recording continues."),
para("Public reports hold that continuous mode is broken on iOS — the microphone never stops and recognized text is never delivered — and that interim results are unreliable in WebKit. [RESEARCH] The first draft of this document treated that as the central risk and concluded that the two flags Conversant depends on were precisely the two that fail."),
callout("That conclusion was wrong, and this is the most important correction in the document. ",
    "In a Safari browser tab, BOTH modes worked. With continuous = true the probe received 22 interim events and a final result. With continuous = false it received 16 interim events and a final result. Interim results arrived in both. The reported iOS breakage does not apply to iPadOS 26 / Safari 26.6 in a tab. [MEASURED]",
    "E6F4EA"),
emptyPara(),
para("So the three behaviors the core loop is built on are all intact, and Tier 1 — the free, built-in path with no second account — is viable. That is a substantially better outcome than the research predicted, and it is why running the probe before writing any code was worth the delay."),
boldPara("One measured caveat worth carrying into tuning: ", "continuous mode took 4,274 ms to its first result, while non-continuous took 1,851 ms. Better than two seconds of difference in time-to-first-word is significant for a system whose entire reason for existing is the four-second awkward-silence threshold. The iPad adapter should default to non-continuous with the existing restart loop, not because continuous fails, but because it is measurably slower to the first word. [MEASURED]"),
emptyPara(),
para("Interim results remain load-bearing in three separate places, so their confirmed presence protects three features at once:"),
bullet("The live transcript. The partner's words appear as they speak. [SOURCE — stt.js:222]"),
bullet("Interruption capture. getCurrentTranscript() returns finalized segments plus the in-progress interim, so cutting in mid-sentence still records what the partner had said — the defect fixed in v0.5.77. [SOURCE — stt.js:310]"),
bullet("Echo filtering. The filter matches the app's own speech against a growing interim prefix, one of its four matching strategies. [SOURCE — stt.js:169]"),
callout("But all of this holds ONLY in a Safari browser tab. ",
    "In a Home Screen app, and in Chrome and Edge tabs, recognition started and then delivered nothing at all — no interim results, no final results, session aborted. Feature detection passed in every case. This is the failure mode that is worst for a user: the API is present, the app believes it is listening, and no words ever arrive. [MEASURED]",
    "F8D7DA"),
emptyPara(),

heading2("4.2 One piece of good news"),
para("The adaptation is closer to the existing code than expected. stt.js already restarts recognition when a session ends while the user still intends to listen, and already flushes the pending interim into the accumulated text before restarting so nothing is lost across the restart boundary. [SOURCE — stt.js:225-250]"),
para("That restart loop is the same shape as the documented iOS workaround — turn continuous off and restart on each end event. The structure is in place; what changes is the flag, the restart timing, and the error handling around it."),
boldPara("One hazard to fix: ", "onerror currently clears listeningIntent on any surfaced error, deliberately, so that an offline device does not spin in a restart loop (stt.js:252-260). [SOURCE] On iOS, where sessions end constantly by design, a benign error would tear down listening entirely. The iOS adapter needs to distinguish benign session churn from genuinely fatal errors."),

heading2("4.3 The three tiers"),
para("All three are still needed, but the probe has assigned each a home. Tier 1 is the shipping path for the Safari-tab mode. Tier 2 or 3 is mandatory for the installed mode, where built-in recognition delivers nothing. The app selects at runtime, not at build time."),
emptyPara(),
simpleTable(
    ["", "Tier 1 — Web Speech", "Tier 2 — Batch cloud", "Tier 3 — Streaming cloud"],
    [
        ["How", "Built-in recognition, non-continuous, restarted", "Record to a pause, upload the clip, get text", "Stream audio over a WebSocket, text returns live"],
        ["Money", { text: "Free", bold: true }, "Per minute of audio", "Per minute of audio"],
        ["Second API key", { text: "No", bold: true }, "Yes", "Yes"],
        ["Live transcript", { text: "Yes — interims confirmed", bold: true }, { text: "No — text arrives after the pause", bold: true }, { text: "Yes", bold: true }],
        ["Interruption capture", "Degraded without interims", { text: "Lost", bold: true }, { text: "Full", bold: true }],
        ["Added latency", "None", "Upload + transcribe per pause", "Negligible"],
        ["Offline", "No (already cloud-based)", "No", "No"],
        ["Accuracy", "Adequate", "Typically better", "Typically better"],
        ["Complexity", { text: "Lowest", bold: true }, "Moderate", "Highest"]
    ],
    [1700, 2600, 2500, 2560]
),
caption("Table 3 — Speech-in tiers. Tier 1 is confirmed working in the Safari-tab mode. Tier 2 is cheapest to build of the two paid options but is the only one that gives up the live transcript, which is why Tier 3 is the recommended path for the installed mode."),

heading2("4.4 Tier 1 — adapted Web Speech (the Safari-tab mode)"),
para("Confirmed working, costs nothing, needs no second account. Changes required:"),
bullet("Set continuous = false on iPadOS and rely on the existing onend restart, with a short delay before restarting. Not because continuous fails — it works — but because it measured 2.4 seconds slower to the first word. [MEASURED]"),
bullet("Add a short delay before restarting. With continuous off, sessions end constantly by design, and restarting synchronously into a session that ends immediately spins a tight loop."),
bullet("Benign session-end errors are ALREADY handled correctly — 'no-speech' and 'aborted' are ignored and only other errors clear listeningIntent (stt.js:252-260). [SOURCE] An earlier draft of this document claimed this needed fixing; reading the code showed it did not. If device testing turns up further errors that fire routinely on restart, that allow-list is where they belong."),
bullet("Add a visibilitychange guard that stops recognition when the app is backgrounded and resumes on return — without it the app believes it is still listening. [RESEARCH]"),
bullet("Detect the failing environments explicitly and say so. If the app finds itself in a Home Screen app, or in Chrome or Edge, built-in recognition will start and then deliver nothing. The app must not present a listening state it cannot honor; it must detect the mode and either switch to a paid tier or tell the user plainly."),
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
callout("Confirmed, in all six runs. ",
    "A speak() call deliberately scheduled outside the gesture's call stack was SILENT — onstart never fired. The same call made from inside a tap spoke normally, with both onstart and onend firing. The gesture unlock is mandatory, not a precaution. [MEASURED]"),
emptyPara(),
boldPara("Remedy: ", "unlock the synthesizer once, during a real gesture, by speaking a silent or near-empty utterance; subsequent programmatic calls then work for the life of the page. The natural place is handleStart (app.js:446), which already runs from the user pressing Start. [SOURCE] Whether the unlock survives for the whole session, or has to be renewed, was not measured and is listed in Section 11."),
para("If the unlock does not persist, placeholders cannot be spoken on iPad. That is survivable — the placeholder cap can already be set to zero — but it removes the floor-holding behavior that keeps a partner from thinking the user has stopped responding."),

heading2("5.2 Voices — the second wrong prediction"),
para("Safari's getVoices() is reported to return a truncated or empty list, with voice selection not always taking effect. [RESEARCH] The first draft treated Practice Mode's distinct partner voice as probably lost."),
callout("Not so. The device reported 68 voices, in every run. ",
    "Including Samantha, Albert, Fred, and more than twenty other English voices. Two distinct voices are comfortably available, so Practice Mode's partner voice works as designed and needs no fallback. [MEASURED]",
    "E6F4EA"),
emptyPara(),
para("The rate-and-pitch fallback is therefore not needed on this device. It should still be written, because it costs little and the voice list is a platform detail that can change, but it is a contingency rather than the expected path."),
para("Apple's Personal Voice — the system feature that banks a user's own voice — is not exposed to web applications. An iPad user who has banked their voice at the operating-system level cannot use it in Conversant. This is worth knowing precisely because it looks like it should work, and it is a reasonable question a user will ask.", { after: 200 }),

heading2("5.3 Backgrounding and cancellation"),
bullet("Speech stops when the app is backgrounded, including mid-utterance. [RESEARCH] Add a visibilitychange handler that cancels cleanly rather than leaving the speaking state stuck true — the echo filter and the placeholder gate both read that state."),
bullet("tts.js:47 calls synth.cancel() and then immediately synth.speak() in the same tick. [SOURCE] This sequence is a known source of trouble on iOS, where the cancel is asynchronous and the new utterance can be swallowed. If speech intermittently fails to start on iPad, this is the first place to look; the remedy is a short delay between the two."),

// ============================================================ 6
heading1("6 · User Interface and Layout"),

heading2("6.1 The predicted layout failure — mostly did not happen"),
para("styles.css:125 sets height: 100vh with overflow: hidden. [SOURCE] The concern was that on iOS, 100vh resolves to the toolbars-retracted height, which exceeds the visible area — and since the body cannot scroll, the dock holding the Express Panel and keyboard would sit under Safari's toolbar, unreachable. That would be a hard failure of the primary interaction surface."),
callout("It did not reproduce in a Safari tab. ",
    "100vh resolved to 763 px against a visible height of 763 px — nothing hidden, in every browser-tab run. The trap appeared exactly once, in one Home Screen run, where 100vh resolved to 820 px against 788 px visible: 32 px lost. So this is a real but intermittent standalone-mode issue, not the guaranteed failure predicted. [MEASURED]",
    "E6F4EA"),
emptyPara(),
boldPara("Fix anyway: ", "use 100dvh. Support is confirmed on the device, it resolves correctly in every environment measured, and it costs nothing. The 32 px case is real, and a keyguard makes any vertical shift serious — the holes stop lining up. The same substitution is needed anywhere else vh drives a full-height container."),
boldPara("Also measured: ", "a 25 px bottom safe-area inset in browser-tab mode (the home indicator), against 0 px in standalone. The bottom row of the dock is exactly where a keyguard's lowest holes sit, so this inset must be honored rather than assumed away. styles.css:2445 already handles the bottom dock; the rest needs an audit. [MEASURED]"),

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
        [{ text: "iPad 10th gen — TAB", bold: true }, { text: "1180 × 763 (measured)", bold: true }, { text: "14.01px (measured)", bold: true }, { text: "0.01px above the floor", bold: true, fill: "FBF2E6" }],
        [{ text: "iPad 10th gen — installed", bold: true }, { text: "1180 × 788 (measured)", bold: true }, { text: "14.41px (measured)", bold: true }, { text: "Barely above the floor", bold: true, fill: "FBF2E6" }],
        ["iPad mini", "1133 × 744", "13.70px → clamped to 14.00px", { text: "CLAMPED — type stops scaling", bold: true, fill: "F8D7DA" }],
        ["Surface (current)", "1280 × 853", "15.45px", "Inside the calibrated fleet"]
    ],
    [2100, 2200, 2560, 2500]
),
caption("Table 4 — Computed from the shipping clamp rule; the two iPad 10th generation rows are measured on the device. Note the real viewport is shorter than the nominal 820 px in both modes."),
callout("The measured device sits 0.01 px above the clamp floor. ",
    "The nominal 820 px height is not what the app gets: browser chrome and safe-area insets bring it to 763 px in a tab and 788 px installed, which puts root type at 14.01 px and 14.41 px against a 14 px floor. This iPad is not merely near the bottom of the calibrated range — it is at the bottom. Re-deriving the clamp bounds is therefore not an optional refinement; the proportional layout has effectively stopped scaling on this hardware. [MEASURED]"),
emptyPara(),
boldPara("So the work is calibration, not redesign. ",
    "The proportional system degrades gracefully rather than breaking. What is required is widening the fleet definition to include the iPad range and re-deriving the clamp bounds so they again sit outside it, then confirming the vertical clamps on region heights and card sizes still hold at 763 px tall. The iPad mini, computing below the floor, should be treated as the low-water mark and may simply be declared unsupported."),

heading2("6.3 Landscape"),
para("Conversant is landscape-only by design, and the manifest requests an orientation. The probe found screen.orientation.lock() entirely ABSENT on the device — not merely rejected, but not present as an API at all. [MEASURED] Combined with iOS ignoring the manifest's orientation field [RESEARCH], nothing available to a web page can hold the device in landscape."),
boldPara("Remedy: ", "detect portrait in CSS and show a full-screen \"please rotate\" panel rather than attempting to render the conversation layout in portrait. This is honest and cheap, and it protects the keyguard assumption — a keyguard is physically mounted in one orientation anyway, so a user with a keyguard cannot meaningfully use portrait."),

heading2("6.4 Suppressing the operating-system keyboard"),
para("Conversant draws its own keyboard on the keyguard grid, and must stop iPadOS from raising its own on top. The current mechanism is inputmode=\"none\", applied to a fixed list of fields. keyboard.js:123 describes it in a comment as \"the reliable Edge/Chrome switch,\" which is accurate and is precisely the problem — it is reliable on those browsers. [SOURCE] On iOS, inputmode=\"none\" is documented as inconsistently honored. [RESEARCH]"),
callout("It works. No change is needed. ",
    "Resolved by direct observation on the device: the unmodified control field raised the on-screen keyboard in every scenario, while the inputmode=\"none\" field and the readonly field both left it closed. The control raising the keyboard is what makes the negative results meaningful — it proves the test could detect a keyboard when one appeared. inputmode=\"none\" therefore suppresses the iPadOS keyboard exactly as it does on Windows, and keyboard.js works as written, IN_SCOPE list and all. [MEASURED]",
    "E6F4EA"),
emptyPara(),
para("The readonly pattern is not required and should not be built. It is worth recording that it exists as a fallback, since keyboard behavior is a platform detail that can change between releases, but it adds complexity — a field that is readonly until tapped interacts awkwardly with focus management — and there is no reason to pay that cost against a problem that does not exist."),
boldPara("A note on how this was resolved, because it matters for the rest of the project: ", "the probe's own instrumentation failed here. It inferred the keyboard's presence from a visualViewport height change, and its control measurement never completed, which left three runs of apparently-clean results that actually proved nothing. Twenty seconds of looking at the screen settled what the instrument could not. When a check is cheap to perform by eye and expensive to automate correctly, use the eye."),

heading2("6.5 Touch behaviors"),
bulletBold("Double-tap zoom collides with the double-tap safeguard. ", "UI Layout Rule 10 offers a confirming double-tap to guard against accidental activation. On iOS a double tap is also the zoom gesture. Set touch-action: manipulation on tappable surfaces to disable double-tap zoom; without it, the safeguard fights the operating system and the layout can zoom mid-conversation — which on a keyguarded device is severe, because the physical holes no longer line up with anything."),
bullet("Disable the callout menu and text selection on buttons and cards, so a long press on a response card does not raise a selection menu."),
bullet("Suppress rubber-band overscroll on the body so the whole app cannot be dragged away from the keyguard."),
bullet("Safe-area insets are already partially handled — styles.css:2445 uses env(safe-area-inset-bottom) in the bottom dock. [SOURCE] Audit the remaining edges; a home-indicator strip crossing the bottom row of a keyguard grid is a real hazard."),

// ============================================================ 7
heading1("7 · Two Modes — The Central Architectural Decision"),

heading2("7.1 The pincer, confirmed"),
para("The first draft called this the one genuinely unresolved architectural question and noted that two requirements might point in opposite directions. They do, and there is no escape:"),
bulletBold("Speech recognition works only in a Safari browser tab. ", "In a Home Screen app it starts and delivers nothing. [MEASURED]"),
bulletBold("Persistent storage is granted only to a Home Screen app. ", "In a browser tab it is denied, in all three browsers, with or without a bookmark. [MEASURED]"),
bulletBold("The two do not share storage. ", "A grant earned in the installed app does not apply to the tab, and the data written in one is invisible to the other. [MEASURED]"),
callout("There is no configuration in which Conversant gets both reliable partner capture and durable data on an iPad. ",
    "Every workaround was tested and none survived. This is a platform constraint, not an implementation problem, and no amount of engineering removes it.",
    "F8D7DA"),

heading2("7.2 The decision: ship both modes (Ken, July 30 2026)"),
para("Rather than choose for the user, Conversant will support both modes on iPad and let the user pick at setup. The trade is real in both directions and depends on facts only the user knows — whether they can fund a second API account, how often they use the device, and how much they can tolerate re-importing a backup."),
emptyPara(),
simpleTable(
    ["", "Conversation mode (Safari tab)", "Protected mode (Home Screen app)"],
    [
        ["Partner speech capture", { text: "Built-in, free, works well", bold: true }, "Requires a paid transcription key"],
        ["Data durability", { text: "Evictable after 7 days of non-use", bold: true }, { text: "Durable", bold: true }],
        ["Running cost", { text: "AI only", bold: true }, "AI + per-minute transcription"],
        ["Setup burden", { text: "One API key", bold: true }, "Two API keys"],
        ["Screen height", "763 px (25 px safe-area inset)", { text: "788 px", bold: true }],
        ["Without a transcription key", "Fully functional", { text: "Manual AAC only — no partner capture", bold: true }],
        ["Best for", "Daily users who want zero extra cost", "Users who can fund transcription, or who mainly compose manually"]
    ],
    [2200, 3580, 3580]
),
caption("Table 5 — The two shipping modes. Each is a coherent product; neither is a degraded version of the other."),
boldPara("The Protected mode without a transcription key is a legitimate configuration, not a broken one. ",
    "Conversant's AI-optional property already establishes that the app degrades to a competent manual AAC device — the Express Panel and \"In my own words\" compose and speak, and turns are recorded and saved — when the AI is absent. The same reasoning applies here with partner capture absent: the user gets durable data and manual communication. It should be presented as a real choice rather than as a failure state."),

heading2("7.3 What shipping both modes requires"),
para("Three things, and the third is the one that makes the decision safe rather than a trap."),
numBold("1 — Runtime mode detection. ",
    "The app must know which mode it is in and adapt, never assume. window.matchMedia('(display-mode: standalone)').matches and navigator.standalone both report it. In the tab, use built-in recognition. In the installed app, use the paid tier if a key is present, and if not, disable the Listen control and say why — never present a listening state the environment cannot honor, which is precisely the silent failure the probe found.", "steps"),
numBold("2 — Honest mode selection at setup. ",
    "The choice is made once, early, by a non-technical user, and it has consequences they cannot foresee. It must be presented in plain terms — what each mode costs, what each risks — not as a technical toggle. This is supporter-assisted, Setup-tier territory.", "steps"),
numBold("3 — Export/Import as the bridge between modes, and as the tab mode's safety net. ",
    "Because the two modes are separate storage silos, switching between them without an export loses everything. Export/Import — already required by Section 3.3 — becomes the mechanism that makes mode switching survivable, and switching modes must route through a guided export-then-import flow rather than leaving the user to discover the loss.", "steps"),
callout("In Conversation mode, backup must be AUTOMATIC, not a button the user remembers to press. ",
    "Eviction happens after seven days of non-use — which describes an illness, a hospital stay, or a vacation, exactly the circumstances where losing an accumulated worldview profile is worst and the user is least able to have prepared. An automatic export written on every session end, somewhere the user can reach it in the Files app, turns eviction from a loss into a re-import. This is a requirement of the mode, not a nicety."),
emptyPara(),
boldPara("A note on the risk actually being manageable: ", "the seven-day clock measures non-use of the site. A primary communication device is used daily, so the eviction window is not the common case — it is the exceptional one. That is an argument for automatic backup rather than against the mode, because the exceptional case is the one the user will not have prepared for."),

heading2("7.4 Installation is manual"),
para("iOS provides no install prompt. The user must use Share, then Add to Home Screen, and there is no way for the page to trigger or even reliably detect the opportunity. [RESEARCH] Protected mode therefore needs a short illustrated setup guide, and its setup burden — two API keys plus a manual install — is materially heavier than Conversation mode's."),

heading2("7.5 Updates"),
para("Service workers function on iPadOS. Conversant's update mechanism is network-first with forced revalidation, skipWaiting on install, and a controllerchange listener that reloads the page once a new worker takes control. [SOURCE — sw.js] The mechanism is sound, but the specific behavior of that reload under WebKit, and inside a standalone Home Screen app, must be retested — a silent failure to update is exactly the class of bug this app cannot afford, because the user would never know."),

heading2("7.6 Single instance — an improvement"),
para("The planned Windows solution is a Web Locks guard plus a PWA launch handler, to stop two instances from feeding each other's microphones and racing on data-folder writes. Web Locks is confirmed supported on the device. [MEASURED] On iPad, Guided Access additionally locks the device into one app at the operating-system level, which solves the problem more completely than any web API can, and prevents a user with limited motor control from accidentally leaving the app."),
boldPara("Recommendation: ", "make Guided Access part of the standard iPad setup instructions. Still implement the Web Locks guard, since it is shared code and costs nothing on iPad, but the operating system is doing the real work here."),

// ============================================================ 8
heading1("8 · Hardware Requirements and Limitations"),
para("A running record of everything hardware-related encountered while specifying this port. This section is expected to grow as testing proceeds."),

heading2("8.0 The tested device, for the record"),
simpleTable(
    ["Property", "Measured value"],
    [
        ["Model", "iPad 10th generation"],
        ["Operating system", "iPadOS 26"],
        ["Browser engine", "Safari 26.6 / WebKit 605.1.15 (all browsers)"],
        ["Screen (CSS px, nominal)", "820 × 1180"],
        ["Usable viewport, browser tab", "1180 × 763 landscape"],
        ["Usable viewport, installed", "1180 × 788 landscape"],
        ["devicePixelRatio", "2 (native 1640 × 2360)"],
        ["Safe-area inset, bottom", "25 px in a tab; 0 px installed"],
        ["CPU cores reported", "4"],
        ["Device memory", "Not reported by the platform"],
        ["Storage quota offered", "33,792 MB"],
        ["Microphone", "48 kHz, echoCancellation enabled by default"],
        ["Recordable audio formats", "webm/opus, webm, mp4"],
        ["Speech synthesis voices", "68"],
        ["Vibration API", "Not supported"],
        ["Screen orientation lock", "Absent"]
    ],
    [3400, 5960]
),
caption("Table 6 — The device the probe measured, July 30 2026. Later models will differ upward; the iPad mini differs downward."),

heading2("8.1 Screen"),
para("See Table 4 for the layout consequences. In summary: the 13-inch iPad Pro is the best fit and the only model comfortably above the current fleet's vertical floor. The 11-inch models and the tested 10th generation work but sit at the clamp floor. The iPad mini computes below it."),
boldPara("The most important screen finding is that nominal height is not usable height. ", "The tested device advertises 820 px but delivers 763 px in a tab, once browser chrome and the 25 px home-indicator inset are taken out. Any layout calibration must be done against the measured usable figure, not the specification sheet. [MEASURED]"),
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
bullet("The built-in microphone array is good and generally better positioned than a laptop's. Measured: 48 kHz capture, granted in every environment tested including the installed app, reporting a healthy signal level. Notably, echoCancellation was already enabled on the track by default. [MEASURED]"),
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
numBold("0 — Run the probe. COMPLETE (July 30 2026). ", "Six runs across three browsers and two display modes, plus two follow-ups. Results are folded throughout this document. It resolved the storage write mechanism, selected the speech tiers, and forced the two-mode decision.", "phases"),
numBold("1 — Export / Import. ", "Promoted to first, ahead of everything else, by the measured result that the two modes are separate storage silos. It is the bridge between modes, the safety net for Conversation mode, and the mechanism the long-planned cross-device transfer feature has always needed. Build it on Windows first, where it is testable against a real data folder and delivers value immediately even if the iPad work stalls.", "phases"),
numBold("2 — Storage adapter. ", "Backend selection in storage.js and OPFS root acquisition — confirmed to be a small change, since createWritable works and the handle interfaces are shared. Plus the persist() request and the mode-aware reporting of its result.", "phases"),
numBold("3 — Speech adapter and mode detection. ", "Restructure stt.js into a shared logic layer plus a platform adapter. Implement Tier 1 for Conversation mode — non-continuous, restart-driven, with the corrected error handling. Implement runtime mode detection and the honest refusal when the environment cannot support listening.", "phases"),
numBold("4 — Layout and touch. ", "The 100dvh fix, clamp recalibration against the measured 763 px usable height, safe-area audit, touch-action, and portrait handling. Keyboard suppression needs no work — inputmode=\"none\" is confirmed working. Best done with a physical keyguard to check against.", "phases"),
numBold("5 — Mode selection and onboarding. ", "The setup-time choice between the two modes in plain language, Add to Home Screen instructions, Guided Access setup, the Siri prerequisite, and the guided mode-switch flow.", "phases"),
numBold("6 — Protected mode's paid transcription. ", "Tier 3 streaming, the second-key onboarding, and the speech-gated upstream that keeps the user from paying for silence. Deliberately last: Conversation mode is a complete product without it, and this phase is the largest and the only one that adds a running cost.", "phases"),
numBold("7 — Field testing. ", "Real conversations on real hardware. The acoustic behavior — echo, placeholder timing, microphone pickup at conversational distance — cannot be verified any other way, and has been the source of most of the surprises in this project's history.", "phases"),
emptyPara(),
boldPara("Effort shape, now that the uncertainty is resolved. ", "Phases 1 through 5 deliver a complete, free, single-key iPad product in Conversation mode, and none of them is large: the storage change is small, the speech adaptation is a modification of code that already has the right shape, and the layout work is fiddly but low-risk. Phase 6 is the only genuinely new subsystem, and it is severable — it can be deferred indefinitely without blocking an iPad release."),

// ============================================================ 10
heading1("10 · What Is Lost, What Is Gained"),
simpleTable(
    ["Lost on iPad", "Gained on iPad"],
    [
        ["The user-visible, portable data folder. Replaced by explicit Export/Import.", "A commodity keyguard and mounting ecosystem, directly serving Spatial Stability."],
        ["The ability to have durable storage and working speech at the same time. This is the real cost, and it is unavoidable.", "Guided Access — a better single-instance guarantee than any web API, plus confirmed Web Locks support."],
        ["Chrome and Edge as options. Measured to be strictly worse; Safari is the only supported browser.", "Cellular connectivity, which matters because the app needs the network for both AI and transcription."],
        ["Apple Personal Voice remains unreachable, despite existing on the device.", "Mature operating-system Switch Control, easing the future scanning renderer."],
        ["Vertical screen height — 763 usable px against a nominal 820, putting the layout at its clamp floor.", "Battery life, instant wake, and lighter weight for mounted use."],
        ["Simplicity. Shipping two modes doubles the configuration surface and the testing.", "68 speech voices, a 33 GB storage quota, and hardware echo cancellation on by default."]
    ],
    [4680, 4680]
),
caption("Table 7 — The trade, stated plainly, after measurement. The lost column is dominated by one item, and it is not the one predicted: speech recognition works, but never at the same time as durable storage."),

// ============================================================ 11
heading1("11 · Open Questions"),
para("What the probe did not settle. Five of the original six are now closed — the hosting question, the OPFS write mechanism, the tab-versus-standalone choice, whether Export/Import should come first, and keyboard suppression — and the answers are in the sections above."),
numBold("Does the text-to-speech gesture unlock persist for a whole session? ", "Confirmed that speak() is silent without a gesture and works within one. Not confirmed whether a single unlock at Start covers timer-driven placeholder speech for the rest of the conversation. If it does not, placeholders cannot be spoken on iPad.", "openq"),
numBold("Is the iPad mini supported? ", "It computes below the clamp floor. Decide after seeing the real layout on one, ideally with a keyguard.", "openq"),
numBold("Does engagement eventually earn a persistence grant in a tab? ", "Denied today, with a bookmark in place. Safari's heuristic also weights repeat visits over time, so a device in genuine daily use may be granted later. Worth re-testing after a few weeks of real use, because a yes would materially reduce Conversation mode's only weakness. Do not design around it.", "openq"),
numBold("Does cellular data consumption make streaming transcription impractical away from Wi-Fi? ", "Measure during field testing. It would be an unwelcome irony if the cellular advantage were consumed by the transcription fallback.", "openq"),
numBold("Does iPad become the recommended platform or an alternative? ", "This document assumes an alternative. If iPad became primary, the ecosystem advantages in Section 1.2 would argue for reversing several existing decisions.", "openq"),

// ============================================================ 12
heading1("12 · Sources"),
boldPara("Claims marked [MEASURED] ", "come from the Conversant AAC iPad Capability Probe, run on an iPad 10th generation (iPadOS 26, Safari 26.6) on July 30, 2026: six runs covering Safari, Chrome, and Edge in both browser-tab and Home Screen modes, plus two follow-up runs testing bookmarked persistence. The probe source is ipad-probe.html in the project root. Its raw reports are the primary record and should be kept."),
para("One [MEASURED] claim — keyboard suppression, Section 6.4 — was established by direct visual observation on the device rather than by the probe, because the probe's viewport-based detection proved unable to answer it. That observation is the stronger evidence of the two, not the weaker: it confirmed both that the two suppression methods work and that the control case behaves as expected."),
para("Claims marked [RESEARCH] rest on the following, consulted July 29, 2026. Three of them were contradicted by measurement and have been corrected in place; the rest are retained only where the probe did not test them."),
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
