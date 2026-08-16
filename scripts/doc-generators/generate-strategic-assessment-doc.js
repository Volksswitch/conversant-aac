// Generates docPath("Conversant AAC Strategic Assessment.docx") — Claude's independent review
// (July 18 2026) answering Ken's four questions: importance of the problem, effectiveness
// of the approach, gaps/misprioritizations, and the alpha/beta test plan.
// Run: node generate-strategic-assessment-doc.js
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
            { reference: "gaps",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "betachecklist",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Strategic Assessment", italics: true, color: "808080", size: 18, font: "Arial" })]
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
            // ===== TITLE =====
            new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Strategic Assessment", bold: true, size: 32, color: "444444" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "Problem importance, approach effectiveness, gaps and priorities, and a review of the alpha/beta test plan", italics: true, size: 24, color: "555555" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Prepared by Claude at Ken Hackbarth's request  |  July 18, 2026", size: 20, color: "808080" })]
            }),

            // ===== 1. PURPOSE =====
            heading1("1. Purpose and Basis"),
            para("Ken asked four questions: Am I trying to solve an important problem? Is my approach likely to be an effective one? What am I missing or what have I misprioritized? And is the alpha/beta test plan solid? This document records the assessment behind the answers."),
            para("The assessment is based on the Product Overview and Architecture Overview (July 2026 versions), the project decision record, and the state of the Phase 1 build (v0.5.9x development cycle). It is a point-in-time snapshot, deliberately candid, intended for internal use. Where the assessment identifies risk, that is not a prediction of failure — it is a list of the specific bets the project is making, so they can be tested deliberately rather than discovered accidentally."),

            // ===== 2. IMPORTANCE =====
            heading1("2. Is the Problem Important? Yes — and It Is Framed Correctly"),
            para("The problem is real, consequential, and — critically — correctly diagnosed. Three things distinguish this project's framing from the field's default framing:"),
            bulletBold("The communication-vs-conversation distinction is the right cut. ", "Most AAC development optimizes message production (rate enhancement, prediction, vocabulary organization). The Product Overview's observation that AAC devices support communication but not conversation names a gap the field mostly talks around. The losses enumerated — timing, turn-taking power, spontaneity, humor, identity — are well supported by the AAC participation literature, which consistently documents AAC users forced into respondent roles while partners control topic and structure."),
            bulletBold("The four-second insight is genuinely differentiating. ", "Locating the barrier in partner silence-tolerance rather than user words-per-minute changes what the product must do: it must fill the silence window, not merely accelerate typing. That reframe is what makes the placeholder system, the continuous capture model, and the response palette coherent as a single design — they all serve the same clock. A rate-enhancement product cannot get there by getting faster."),
            bulletBold("The dignity claim is the correct level of stakes. ", "For the target population, the difference between transactional and interactional communication is the difference between being managed and being known. The population is small in market terms, but the per-person impact is close to the maximum an assistive technology can deliver."),
            para("One honest caution belongs next to the 'yes': importance is not the same as demand. The predecessor product's developer said the hard lesson was that people did not consistently use the feature. That failure was not a failure of problem-importance — it was a failure of solution-fit, adoption friction, or retention. So treat the problem as validated and the burden of proof as resting entirely on whether this solution gets used, which is exactly what the beta must measure (Section 5)."),

            // ===== 3. EFFECTIVENESS =====
            heading1("3. Is the Approach Likely to Be Effective?"),
            heading2("3.1 What the Approach Gets Right"),
            bulletBold("The sustainability model is the standout strategic decision. ", "No server infrastructure, user-funded AI. This directly answers the documented failure mode of every predecessor (shelved when funding ran out). A product that cannot be defunded can afford to grow slowly — which this product will need to, given its adoption friction (Section 3.3). This is the single strongest structural advantage the project holds."),
            bulletBold("The Conversation Analysis grounding is a real moat. ", "Competitors bolting an LLM onto an AAC grid will produce 'AI suggestions.' This project produces typed conversational actions — preferred, dispreferred, initiative, repair — plus repair in both directions, floor-holding, and closing sequences. That is the difference between suggesting words and supporting participation in the structure of talk. It is also hard to copy, because it is embodied in dozens of interlocking design decisions, not one feature."),
            bulletBold("The authorship safeguards are the right answers to the field's hardest objection. ", "The AAC research and practitioner community will challenge any generative-AI AAC product on agency and authenticity: whose words are these? The project's answers are unusually strong: nothing is spoken without user selection; the anti-fabrication rule forbids invented autobiography; the honesty principle keeps the user a fallible person rather than an oracle; Reframe and 'In your own words' keep user-authored ground truth one step away; and the worldview model is user-authored and optional. These need to be foregrounded in external messaging, because they will be the first line of scrutiny."),
            bulletBold("Privacy architecture is genuinely strong. ", "Local-only data, the three-level privacy model, per-conversation 'Don't save,' deliberate microphone start. Few commercial products in any category are this clean. The one honest asterisk — browser STT is cloud-based — is already documented and has a planned mitigation (the recording indicator)."),
            bulletBold("The motor-accessibility depth is real. ", "Spatial stability, keyguard congruence, positional stability of response types, configurable target sizes — these show an understanding of the actual target user that generic AI products will not match."),
            bulletBold("Graceful degradation. ", "The app remains a competent manual AAC + transcript tool with no AI. That matters for trust: the user's ability to communicate never depends on an API being up."),
            heading2("3.2 The Three Bets the Approach Rests On"),
            para("The architecture is sound. Whether the product works is now carried by three empirical bets that no amount of further engineering can settle — only users can:"),
            numBold("The timing bet. ", "The end-to-end loop — partner pauses, STT lands, options generate, the user reads four to eight cards and selects — must fit inside real partners' patience, repeatedly, for a whole conversation. The AI latency is the small part; the user's reading-and-choosing time under motor and visual load is the bottleneck, and it is the one number the project has never measured with a real target user. The placeholder system is the mitigation, and its social acceptability is itself unproven: whether partners experience 'Good question… still thinking it through' as natural presence or as a tic will only be learned in the field.", "gaps"),
            numBold("The authorship bet. ", "Do selected responses feel like 'me' to the user, and does the partner attribute the words to the user rather than to the machine? If users feel like they are operating a chatbot instead of speaking, retention will collapse even if the mechanics work perfectly. The worldview model is the long-term answer, but beta users will mostly run with thin profiles — so the out-of-box voice quality of the options carries this bet early.", "gaps"),
            numBold("The acoustic bet. ", "Cloud STT plus echo excision plus a live microphone in real rooms — kitchens, cafés, day programs — with the app's own TTS playing. The known-limitations list (echo during placeholder playback, mis-transcription, noise) is honest and non-trivial. The robust fix (partner voice identification) is Phase 2. Beta environments should be chosen with this in mind, and acoustic failure should be tracked as its own category, because users will experience it as 'the app doesn't work,' not as a nuanced STT issue.", "gaps"),
            heading2("3.3 The Principal Risk: The Adoption Friction Stack"),
            para("The biggest gap between 'works' and 'gets used' is not in the conversation loop. It is the accumulation of setup friction, each layer individually defensible:"),
            bullet("A Windows device, in an AAC world that is overwhelmingly iPad-centric (most SLPs, schools, and funded devices are iOS)."),
            bullet("Creating an Anthropic account, generating an API key, entering payment details — pay-as-you-go billing that caregivers may perceive as open-ended even though real costs are small."),
            bullet("Choosing and granting a data folder, understanding the cloud-sync caveat, re-granting after browser events."),
            bullet("Browser choice, microphone permissions, and (for now) settings that live per-machine."),
            para("Each layer filters out some fraction of the population that lacks a hands-on technical supporter. The product's target user, by definition, often depends on others for setup. This is not an argument against any individual decision — the Windows/FSA and BYO-key decisions are well reasoned and documented. It is an argument for treating the supported setup path (documentation, a supporter-assisted ritual, and for beta, preconfigured devices) as first-class product work, not an afterthought. The predecessor's lesson — consistent use never materialized — is most likely to repeat here, at the friction stack, before the conversation loop ever gets its fair trial."),
            para("A related note for external documents: the Architecture Overview (Sections 4 and 16) still says users can 'start on the free tier' of the Claude API. Per the project's own record, there is no free tier for API access. This should be corrected before the document is shared externally — it sets up exactly the billing surprise that erodes caregiver trust. The two overviews also disagree on hardware (the Product Overview permits Chromebook/Mac; the Architecture Overview still says Windows-only) — reconcile on the next sync."),

            // ===== 4. GAPS =====
            heading1("4. What Is Missing or Misprioritized (Ranked)"),
            numBold("Define the headline success metrics now — before beta, not during. ", "This is the direct lesson of the predecessor. The instrumentation design (recorded, beta-gated) is right, but the choice of what counts as success is a product decision that shapes the beta protocol itself. Recommended North Star: when a conversation opportunity arises, does the user reach for Conversant? — operationalized as conversations per week sustained across weeks three and four, plus week-1-to-week-4 continuation. Feature counts are diagnostics, not the verdict.", "gaps"),
            numBold("Practice Mode is the most valuable unbuilt feature for this stage — consider pulling a minimal version forward. ", "It is fully designed (Architecture Overview §8) and reuses the entire existing pipeline with STT bypassed. For beta it solves three problems at once: testers can learn the loop without spending a real partner's patience; the system gets exercised in acoustically clean conditions (separating UI/loop problems from acoustic problems); and it de-risks the first real conversation, which is the moment most likely to determine whether a tester continues. A minimal version — one scenario, AI plays the partner — is a modest build on existing plumbing.", "gaps"),
            numBold("The partner is unmeasured, and the partner is the thesis. ", "The whole theory of the product is about partner behavior — staying engaged past the silence threshold. Yet nothing in the plan captures the partner's experience. Beta should include even lightweight partner-side data: a two-minute conversation-partner questionnaire (Did the pauses feel okay? Did it feel like talking with the person? Would you converse again?). Partner willingness to return is arguably a co-equal North Star metric.", "gaps"),
            numBold("Reading load under time pressure has never been measured. ", "Four to eight cards of full-sentence text is a significant reading task for a user with CP under social time pressure. The alpha SLPs can help estimate this, but only target users can settle it. Watch for it specifically in beta; the 1-per-category setting and future compressed-hint display are the levers if it binds.", "gaps"),
            numBold("Defaults deserve more investment than new settings. ", "The configurability surface is enormous and philosophically justified, but every beta tester will effectively run the default profile. Between now and beta, effort spent making the default profile excellent (placeholder phrasing, timing values, palette quality) pays off for every tester; effort spent on new knobs pays off only for hypothetical future users. Resist the knob.", "gaps"),
            numBold("The pre-beta engineering gate is correct — hold it. ", "The already-identified pre-beta items (settings persistence to the data folder, the recording indicator, single-instance enforcement, usage instrumentation, an issue-reporting path) are the right list. The discipline risk is starting beta before they land because testers are eager. The recording indicator in particular is a legal-exposure item once real, unaware partners are being transcribed through a cloud service.", "gaps"),
            numBold("An AAC user's voice is missing from alpha. ", "See Section 5.1 — listed here because it is a gap in the current plan, not just a beta detail.", "gaps"),
            para("Notably absent from this list: more conversation-engine features. The engine is ahead of its validation. The highest-value work now is the kind that makes the existing loop succeed with real people — metrics, practice mode, defaults, onboarding — not additional capability."),

            // ===== 5. TEST PLAN =====
            heading1("5. The Alpha/Beta Plan: Right Shape, Several Missing Pieces"),
            heading2("5.1 Alpha (Current): SLPs with Lifespan Experience"),
            para("The choice is good. SLPs bring clinical face validity, will catch appropriateness and safeguarding issues, know the funding and provisioning ecosystem, and are the natural multipliers for beta recruitment and eventual adoption. Three refinements:"),
            bulletBold("Add at least one adult AAC user as an alpha consultant. ", "SLPs are expert proxies, but they read fast, type fast, and speak — they cannot experience the motor load, fatigue, or timing reality, and they cannot answer the authorship question ('does this feel like my voice?'). Even a few sessions with one adult AAC user — not necessarily meeting every beta criterion — would test the two bets SLPs cannot reach. It also matters for credibility: the AAC community's standard is 'nothing about us without us,' and a product that reaches beta having never touched an AAC user's hands will be asked why."),
            bulletBold("Structure the SLP sessions. ", "Free exploration finds bugs; scripted scenarios find design flaws. Give the SLPs three or four fixed scenarios (greeting and catch-up; an invitation to decline; a repair-heavy exchange with deliberate mishearing; a wind-down) and have them play both roles — user and partner. The partner role is one they are professionally expert in judging."),
            bulletBold("Use the SLPs to co-design the beta protocol. ", "They know outcome measurement (goal attainment scaling, communication participation measures), consent practice, and candidate recruitment. Their most valuable alpha output may be the beta protocol itself, not the bug list."),
            heading2("5.2 Beta: A Small Set of Target-Criteria Individuals"),
            para("A small cohort of real target users is the right design — depth over breadth; three to six testers is plenty at this stage. The plan as stated is a recruitment plan; it needs to become a protocol. The missing pieces:"),
            numBold("Duration: six to eight weeks per tester, minimum. ", "Retention is the metric, and retention cannot be observed in a demo session. A short beta would repeat the predecessor's exact blind spot. Expect and plan for the novelty spike and week-three dip.", "betachecklist"),
            numBold("Baseline capture. ", "Before the system is introduced, record each tester's current communication method and a baseline sample (how a typical exchange goes today, roughly how many conversational turns they get). Without a baseline, 'it helps' has no reference point.", "betachecklist"),
            numBold("Provisioned devices. ", "Assume testers do not own suitable Windows tablets. Preconfigured loaners (browser, API key, data folder, settings, Express Panel seeded) collapse the entire friction stack for beta — while deliberately deferring the question of whether unsupported users can self-onboard, which is a public-release question, not a beta one. Decide who funds the API keys for beta; sponsoring modest usage during the trial is cheap and removes a consent-to-billing complication.", "betachecklist"),
            numBold("Consent, for both parties. ", "Written consent from testers (and guardians where applicable), plus clear guidance about partners: conversations are transcribed through a cloud STT service, transcripts may be stored, and audio-consent law varies by state. The recording indicator and the 'Don't save' control are the product-side halves of this; the protocol-side half is a plain-language explanation sheet.", "betachecklist"),
            numBold("Instrumentation live from day one. ", "The designed metrics system must ship before the first tester's first week, or the most important data (early engagement trajectory) is lost. Events only, never content — as designed.", "betachecklist"),
            numBold("Interview cadence, and treat dropouts as the most informative testers. ", "Metrics say what happened; only conversation says why. Brief check-ins every one to two weeks; a full exit interview for anyone who stops using it — the predecessor's lesson lives exactly there. The feedback channel must itself be accessible (the tester's own AAC means, email, or a supporter-mediated interview — not a phone call).", "betachecklist"),
            numBold("Cohort composition within the criteria. ", "Vary the things most likely to moderate success: living situation (family home vs. supported living), availability of a technical supporter, daily partner mix (family only vs. broader), and age band. Avoid a cohort of one profile.", "betachecklist"),
            numBold("Success and stop criteria, decided in advance. ", "Write down before beta: what result confirms the approach (e.g., a majority of testers still initiating conversations with it in week six; partners willing), and what result forces a rethink (e.g., universal abandonment after novelty despite working mechanics — which would point at the authorship or timing bet, not at bugs). Deciding this after seeing the data is how projects fool themselves.", "betachecklist"),
            numBold("A named support person per tester. ", "Hand-holding is the stated model — make it explicit: who fixes a folder re-grant, a mic permission, a billing question, within what response time. For a communication device, 'down until the weekend' means a week of lost conversations.", "betachecklist"),
            heading2("5.3 What the Plan Gets Right"),
            para("For balance: staged rollout with trusted clinicians first; small-N depth rather than a wide launch; hand-held testers; the beta-gated instrumentation and pre-beta security items already identified in the backlog; and a product that is genuinely ready enough — the core loop, privacy model, error visibility, and manual-fallback path are all in place. Most projects run their first user test far earlier in engineering maturity and far later in honesty about risk. This one has the order right."),

            // ===== 6. BOTTOM LINE =====
            heading1("6. Bottom Line"),
            boldPara("Is the problem important? ", "Yes — and the framing (conversation, not communication; partner silence-tolerance, not words-per-minute) is itself a contribution. The stakes claimed — identity and dignity, not throughput — are the right ones."),
            boldPara("Is the approach likely to be effective? ", "The architecture is sound and three of its pillars — the unkillable sustainability model, the Conversation Analysis grounding, and the authorship/privacy safeguards — are real, durable advantages. Effectiveness now rests on three bets only field use can settle: the end-to-end timing bet, the authorship bet ('does it feel like me?'), and the acoustic bet. The largest threat is not in the conversation loop at all — it is the adoption friction stack between a real user and their first good conversation."),
            boldPara("What is missing or misprioritized? ", "Chiefly: success metrics defined before beta; a minimal Practice Mode pulled forward as the onboarding and de-risking tool; any measurement of the partner, who is the actual subject of the product's thesis; and investment in defaults over further configurability. The engine is ahead of its validation — the next unit of effort belongs to validation, not capability."),
            boldPara("Is the test plan solid? ", "The shape is right; the plan is currently a recruitment plan and needs to become a protocol. The highest-impact upgrades: add an adult AAC user's hands and voice during alpha, run beta six to eight weeks with baselines and live instrumentation, provision the devices, get consent right for both parties, and write the success/stop criteria down before the first tester starts."),
            para("None of the risks named here is a reason to slow down. They are the specific places to point the next few months of attention, so that when the beta answers arrive, they answer the questions that matter.", { after: 0 }),
        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(docPath("Conversant AAC Strategic Assessment.docx"), buf);
    console.log("Wrote Conversant AAC Strategic Assessment.docx (" + buf.length + " bytes)");
});
