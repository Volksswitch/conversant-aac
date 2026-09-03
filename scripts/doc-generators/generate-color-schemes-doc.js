/* Generates docPath("Conversant AAC Color Schemes.docx") - what each of the seven
 * color schemes does, who it is likely to help, and the argument and evidence for
 * why seven is a reasonable and complete set.
 *
 * WHY THIS EXISTS. On September 3 2026 Ken was asked whether the app supports
 * changing colors for people with visual impairments. The seven schemes were built
 * that day; this document is the case for them - it has to stand up to a speech and
 * language therapist or an eye clinician asking "why those, and why is that enough".
 *
 * ⚠ THE COMPLETENESS ARGUMENT IS THE POINT OF THIS DOCUMENT, and it is a claim about
 * a taxonomy of NEEDS, never about taste. The set is two axes - how bright the
 * background is, and how hard the contrast is pushed - plus one orthogonal axis for
 * color discrimination. Stated that way it can be checked, and its one deliberate
 * gap can be named. Stated as "seven nice options" it could not be.
 *
 * ⚠ EVERY REFERENCE HERE WAS VERIFIED AGAINST A SOURCE ON SEPTEMBER 3 2026, not
 * written from memory. That is a standing rule in this project for a reason: a probe
 * in July 2026 found half the remembered facts about a platform were wrong. Where a
 * number is approximate or contested, the document says so rather than rounding it
 * into a clean claim.
 *
 * ⚠ WHAT IT DELIBERATELY DOES NOT CLAIM: that any of this has been tried by a person
 * with the conditions described. It has been measured and rendered, which is not the
 * same thing, and Section 8 says so plainly. Do not let a later edit quietly upgrade
 * "measured" into "validated".
 *
 * Figures cs-*.png are captures of the real app, produced by
 * scripts/capture-color-schemes.mjs. Re-run that if the palettes change.
 *
 * Run: node generate-color-schemes-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, ImageRun } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// keepNext goes on the PARAGRAPH, not on the paragraph style: set in the style
// definition it is silently ignored, and the checker goes on reporting every heading
// as able to be stranded at the foot of a page (rule S3).
function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true,
        children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true,
        children: [new TextRun(text)] });
}
function para(text, opts = {}) {
    return new Paragraph({
        spacing: { before: 0, after: opts.after ?? 160 },
        children: [new TextRun({ text, ...opts.run })]
    });
}
function lead(label, text) {
    return new Paragraph({
        spacing: { before: 0, after: 160 },
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
function refItem(text) {
    return new Paragraph({
        spacing: { before: 0, after: 120 },
        indent: { left: 720, hanging: 720 },
        children: [new TextRun({ text, size: 20 })]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

// The captures are 2560 x 1600; 624 twips wide keeps them inside the text column.
function figure(file, caption) {
    const k = 624 / 2560;
    return [
        new Paragraph({ spacing: { before: 120, after: 60 }, alignment: AlignmentType.CENTER,
            children: [new ImageRun({ type: 'png', data: fs.readFileSync(file),
                transformation: { width: Math.round(2560 * k), height: Math.round(1600 * k) } })] }),
        new Paragraph({ spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: caption, italics: true, size: 18, color: '666666' })] }),
    ];
}

function simpleTable(headers, rows, widths) {
    const headerCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "D5E8F0" },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: true })] })]
    });
    // No size on the run: the house table style carries it, and a size here would
    // beat the style and stop it governing (checker rule S11).
    const bodyCell = (cell, w) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const text = isObj ? cell.text : cell;
        const run = isObj
            ? new TextRun({ text, italics: !!cell.italics, bold: !!cell.bold })
            : new TextRun({ text });
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

const W2 = [3200, 6160];
const W3 = [2400, 3480, 3480];
const W4 = [2100, 2420, 2420, 2420];

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 320, after: 180 }, outlineLevel: 0, keepNext: true } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 26, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 220, after: 140 }, outlineLevel: 1, keepNext: true } },
        ]
    },
    // ⚠ Every reference used below must be declared here. docx-js does not throw on
    // an undeclared one -- it writes the unresolved placeholder into the file, and
    // Word then refuses to open the document with no clue as to why.
    numbering: {
        config: [
            { reference: "bullets",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "needs",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "limits",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Color Schemes", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  September 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            // ===== TITLE =====
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Color Schemes", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "What each one does, who it is likely to help, and why these seven are a reasonable and complete set", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  September 2026  |  Last updated September 3, 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("Conversant AAC offers seven color schemes. This document says what each one does, who it is likely to help, and why the set is the shape it is. It is written for anyone who has to judge whether the app is suitable for a particular person: a speech and language therapist, a teacher, an eye care professional, a family member, or the person themselves."),
            lead("The short version. ",
                "Sight varies in more than one way, and the ways ask for different things. The set covers two things that can be dialed independently — how bright the background is, and how hard the contrast is pushed — plus one separate scheme for people who have trouble telling colors apart. Section 5 lays that out as a grid and names the one square deliberately left empty."),
            lead("What this document does not claim. ",
                "None of these schemes has yet been used by a person with the conditions described. They have been measured against published standards and rendered on a real screen, which is not the same as being tried. Section 8 states the limits plainly, and they should be read before anyone treats this as a clinical recommendation."),

            // ===== 2 =====
            heading1("2. The Problem the Schemes Solve"),
            heading2("What was already good"),
            para("Before any of this work, the words in the app were easy to read. Measured against the published standard, the response wording on a card, the two speakers in the conversation, and the notices all sat far above the minimum. Somebody who found the app hard to look at was not going to be helped by darker text."),

            heading2("What was not"),
            para("The lines that say where one thing ends and the next begins were nearly invisible. Of twenty-nine boundaries measured across the app, twenty-six fell below the published minimum. A response card's outline stood out from the page behind it by a ratio of 1.14 to 1, where the standard asks for at least 3 to 1."),
            para("For somebody whose eyes struggle with faint differences, that is the difference between seeing four separate cards and seeing one gray field with words floating in it. Reduced contrast sensitivity is ordinary with age, common with cataract, and common alongside cerebral palsy. So the first change was not a color scheme at all: every boundary in the app was redrawn dark enough to be made out, for everybody, with no setting to find."),

            heading2("What a scheme adds on top"),
            para("Strong outlines help a great deal and do not help everybody. Somebody who cannot tolerate a bright screen needs a dark one. Somebody with very reduced contrast sensitivity needs more than a firm outline. Somebody who cannot tell green from amber needs those two colors changed, not strengthened. Those are different needs and they cannot all be met by one appearance, which is why there is a choice."),

            // ===== 3 =====
            heading1("3. How Sight Varies, and What Each Difference Asks For"),
            para("Four differences matter for a screen like this one. They are independent: a person can have any combination of them."),

            heading2("Seeing faint differences"),
            para("Contrast sensitivity is the ability to tell nearly-matching shades apart. It is separate from sharpness — a person can read small print in good conditions and still lose the edge of a pale box. It declines with age, and it is reduced by cataract, glaucoma and macular degeneration. Reading research going back to the 1980s shows that people with low vision need substantially more contrast than people without to read at the same speed (Legge, Rubin and Luebker 1987; Rubin and Legge 1989)."),
            lead("What it asks for: ", "stronger boundaries first, and if that is not enough, the removal of pale tints altogether so that everything on screen is either firmly dark or firmly light."),

            heading2("Tolerating light"),
            para("Photophobia — discomfort or pain from ordinary light levels — accompanies migraine, concussion and brain injury, and is a documented feature of cerebral visual impairment. That matters here because cerebral visual impairment is reported in roughly half to two thirds of children with cerebral palsy, which is the app's initial target group. Reported rates vary widely with the definition used, from about a quarter to over four fifths, so the figure should be treated as a range rather than a number."),
            lead("What it asks for: ", "a dark background, which reduces the total light the screen puts out."),

            heading2("Telling colors apart"),
            para("Red-green color vision deficiency affects about 8 percent of men and about 0.5 percent of women. The commonest form, deuteranomaly, accounts for roughly 6 percent of men on its own. Blue-yellow deficiency present from birth is genuinely rare — under 0.01 percent, and equally common in men and women."),
            lead("But the rare kind is not as rare as it looks, and this changed the design. ",
                "Blue-yellow discrimination is also lost as an acquired condition, and cataract is the common cause: the yellowing lens absorbs short-wavelength light, so color vision is impaired along the blue-yellow axis specifically. Cataract is very common with age. So a scheme that separates colors only for the red-green types would leave out a group that is small at birth and much larger later in life."),
            lead("What it asks for: ", "colors chosen to stay apart under each kind of loss — and, because that turns out not to be achievable for four categories at once, a second cue that does not depend on color at all."),

            heading2("Seeing small things"),
            para("Visual acuity is what an eye test measures, and it is the one difference in this list that a color scheme cannot address. It is handled separately, and was already handled before this work: text size is set per area of the app, and button size is its own setting. This document does not cover either. It is worth saying because acuity is what most people think of first when they hear “visual impairment”, and it is the one thing color cannot help with."),

            // ===== 4 =====
            heading1("4. The Seven Schemes"),
            para("All seven are chosen in one place: “Settings”, on the “Text & Color” tab, under “Color scheme”. The change takes effect immediately, with the panel still open, so a scheme can be judged against the app rather than against a memory of it. The choice is remembered."),
            lead("Nothing moves when the scheme changes. ",
                "Every button and card stays in the same place at the same size in all seven. This is not a detail: many users of this app rely on a keyguard, a physical overlay with holes cut over the buttons, and a scheme that shifted anything by even a few pixels would put the holes out of line. The positions were measured in all seven and are identical."),

            heading2("1. “Default”"),
            para("The app as it has always looked: dark text on a light gray page, with pale colored tints marking the four kinds of suggested reply. Since the boundary work described in Section 2, every outline in it is drawn firmly enough to meet the published minimum."),
            ...figure('cs-light.png', 'Figure 1. “Default” — dark text on a light page, with pale tints marking the four kinds of reply.'),
            lead("Likely to suit: ", "anyone without a specific visual difficulty, and it is where everybody starts. Dark text on a light background is also the better choice for most people who simply want to read comfortably: display research finds a consistent advantage for dark-on-light over light-on-dark in people without visual disorders, in both younger and older adults (Piepenbrock and colleagues, 2013 and 2014). That is a real reason for it to remain the default rather than an arbitrary one."),

            heading2("2. “Bold outlines”"),
            para("The same familiar colors, with every boundary drawn heavily and the pale card tints darkened a step, so a card reads as a solid block rather than a hint of one."),
            ...figure('cs-bold.png', 'Figure 2. “Bold outlines” — the familiar colors, with every edge drawn heavily.'),
            lead("Likely to suit: ", "the largest group of anybody on this list — people with mildly or moderately reduced contrast sensitivity, which includes most older users, anyone with early cataract, and many people with cerebral visual impairment. It is the smallest change of the seven: nothing is unfamiliar, the edges are simply there. For that reason it is the one to try first when somebody says the screen is hard to make sense of but can still read the words."),

            heading2("3. “High contrast, light”"),
            para("Black on white, with the pale tints removed entirely. The identity of a suggested reply rests wholly on its thick colored bar and its printed label."),
            ...figure('cs-hc-light.png', 'Figure 3. “High contrast, light” — black on white, with the tints removed.'),
            lead("Likely to suit: ", "people with substantially reduced contrast sensitivity who still prefer or need a light background. It pushes every piece of text and every boundary to the maximum the screen can produce in this direction. The cost is that the four kinds of reply are told apart by less: the tint that used to fill each card is gone, leaving position, the colored bar and the printed label."),

            heading2("4. “Dark”"),
            para("Light text on a near-black ground, with the card tints becoming deep colors rather than pale ones. Not a maximum-contrast scheme: it is a comfortable dark appearance, of the kind most applications now offer."),
            ...figure('cs-dark.png', 'Figure 4. “Dark” — light text on a near-black ground.'),
            lead("Likely to suit: ", "people who find bright screens uncomfortable but do not need extreme contrast, and anyone using the app in a dim room or at night. It is also the scheme most users will recognize and ask for by name, which is a reason to have it even though it is not the strongest answer to any single visual difficulty."),

            heading2("5. “High contrast, dark”"),
            para("White on black. The mirror of “High contrast, light”, and the strongest contrast available on a dark background."),
            ...figure('cs-hc-dark.png', 'Figure 5. “High contrast, dark” — white on black.'),
            lead("Likely to suit: ", "people who have both substantially reduced contrast sensitivity and difficulty tolerating bright light — a combination that is common in cerebral visual impairment, and therefore plausible for a meaningful share of this app's intended users. It is also the choice of many people with severe low vision who report reading light-on-dark more easily, which is a genuine and frequently reported preference even though the population-level research points the other way."),

            heading2("6. “Yellow on black”"),
            para("Yellow text on black. Every word in the app is yellow; the four category bars keep distinct colors so the kinds of reply remain tellable apart."),
            ...figure('cs-yellow.png', 'Figure 6. “Yellow on black” — the highest luminance separation the screen can produce.'),
            lead("Likely to suit: ", "people with severe low vision who already use this combination elsewhere. It is a long-standing choice in low-vision practice and rehabilitation, and yellow is repeatedly singled out in that literature as helping both contrast and glare. People who need it usually already know, and ask for it by name — which is the main argument for offering it as a named scheme rather than expecting somebody to assemble it."),
            lead("One deliberate departure. ", "A strict reading of the name would make everything on screen yellow or black, including the category bars. That was rejected: it would remove the only remaining color cue distinguishing the four kinds of reply. The words are all yellow; the bars are not."),

            heading2("7. “Color-blind safe”"),
            para("A light scheme in which the four kinds of reply are recolored so that they stay apart for people who have difficulty telling colors apart, and each is additionally given a different edge — solid, double, dashed and dotted."),
            ...figure('cs-cb.png', 'Figure 7. “Color-blind safe” — recolored categories, each with a different edge as well.'),
            lead("Likely to suit: ", "the roughly 1 man in 12 with red-green color vision deficiency, and anyone whose color discrimination has been reduced by cataract or another acquired cause. The one genuinely risky pair in the standard palette is the green used for the preferred reply against the amber used for declining: to the commonest form of color blindness they are the same muddy yellow."),
            lead("Why it also changes the shape of the edge. ",
                "This began as a color change alone. Measuring it showed that will not do the job: four categories cannot be well separated by color alone for somebody with color blindness while keeping colors that still mean what they should. Section 6 gives the numbers. The four edge styles carry the same information without depending on color at all, which is what makes the scheme work for the blue-yellow types and for the very rare people who see no color whatsoever."),

            // ===== 5 =====
            heading1("5. Why These Seven, and Why Seven Is Enough"),
            para("The set is not seven appearances somebody liked. It is a grid, and the argument for its completeness is that the grid is filled."),

            heading2("Two axes, plus one"),
            para("Two things can be dialed independently. How bright the background is — light or dark — answers the question of tolerating light. How hard the contrast is pushed — ordinary, bold, or maximum — answers the question of seeing faint differences. Every combination of those two is a legitimate need, and each is a scheme:"),
            emptyPara(),
            simpleTable(
                ["", "Ordinary contrast", "Bold", "Maximum"],
                [
                    [{ text: "Light background", bold: true }, "“Default”", "“Bold outlines”", "“High contrast, light”"],
                    [{ text: "Dark background", bold: true }, "“Dark”", "(deliberately empty — see below)", "“High contrast, dark” and “Yellow on black”"],
                ], W4),
            emptyPara(),
            para("Color discrimination is a separate axis, because it is independent of both of the others: a person with color blindness may want a light screen or a dark one, ordinary contrast or maximum. “Color-blind safe” is built on the light, ordinary-contrast square because that is where most people start, and because the two needs rarely coincide in a way that would require a dark version."),

            heading2("The empty square, and why it is empty"),
            para("There is no “Bold outlines, dark”. That is a decision, not an oversight: the dark scheme is already drawn with strong boundaries, because a dark background needs them to look right at all. A separate bold dark scheme would be very close to the plain dark one and would add a choice without adding a capability. If a tester asks for it, it is a table of numbers away."),

            heading2("Why two schemes share the maximum-contrast dark square"),
            para("“High contrast, dark” and “Yellow on black” are both white-or-yellow on black, and a purist might call one of them redundant. They are kept apart for a practical reason rather than a theoretical one: yellow on black is a specific, named thing that people who need it already ask for, and burying it inside a general dark scheme would mean they could not find it. Naming a scheme after the thing somebody has been told to look for is worth one extra row in a list."),

            heading2("What “complete” does and does not mean here"),
            bullet("It means every combination of the two main visual needs has an answer, and the axis that is independent of them has its own.", "limits"),
            bullet("It does not mean every individual preference is catered for. Somebody who wants blue on cream will not find it.", "limits"),
            bullet("It does not mean per-element adjustment. There is deliberately no way to set the color of one part of the app on its own: that would be many decisions rather than one, and it would let a user make the app unreadable without meaning to.", "limits"),
            bullet("It does not cover needs that are not about color. Text size, button size, spacing and timing are separate settings, and a color scheme is the wrong tool for any of them.", "limits"),

            // ===== 6 =====
            heading1("6. How They Were Checked"),
            heading2("Contrast, in every scheme"),
            para("Contrast between two colors is expressed as a ratio. The published accessibility standard asks for at least 4.5 to 1 for ordinary text, and at least 3 to 1 for anything else that carries meaning, such as the outline of a button or a card. Larger text is allowed a lower bar."),
            para("Sixty-two pairs of colors — text on each surface, each boundary against what it sits on, each category bar against its own card, each label against its badge — are checked in all seven schemes automatically, every time the app is built. A scheme that fell below the bar anywhere would stop the build rather than ship."),
            para("They were then checked again in the running app rather than only on paper, because a color can pass as a pair of numbers and still be used somewhere unintended. In each of the seven schemes, 518 pieces of text and about 600 outlines were measured on the actual screen, across the conversation view, every settings tab, and the profile section. All pass."),

            heading2("Color blindness, by simulation"),
            para("Whether a scheme helps somebody with color blindness is the one claim in this document that cannot be checked by looking at it. So it is simulated: each color is converted into what a person with each of the three kinds of color blindness would see, using a published method (Viénot, Brettel and Mollon 1999; the underlying approach is Brettel, Viénot and Mollon 1997), and the results are compared using a standard measure of how different two colors appear."),
            para("On that measure, a difference of about 2.3 is the smallest a person can detect at all. The table gives the closest pair of the four reply categories — that is, the worst case — under each kind."),
            emptyPara(),
            simpleTable(
                ["Kind of color blindness", "Roughly how common", "“Default”", "“Color-blind safe”"],
                [
                    ["Deuteranopia (green)", "about 6% of men", "13.7", "26.6"],
                    ["Protanopia (red)", "about 1% of men", "17.0", "29.0"],
                    ["Tritanopia (blue-yellow)", "under 0.01% from birth, but acquired with cataract", "9.3", "6.2"],
                ], W4),
            emptyPara(),
            lead("The two common kinds roughly double. ",
                "That is the scheme earning its place. The third column is the honest one: for blue-yellow the colors alone do no better, and slightly worse. This is why the four edge styles exist. They were originally going to be left out as redundant; the measurement is what showed they are the load-bearing part."),
            lead("An optimizer could have scored far higher, and was overruled. ",
                "A search allowed to pick any colors at all reached more than twice these numbers — but only by making the declining reply pure red. The app deliberately avoids red there, because declining is a normal thing to do and not an error. Keeping the meaning of the colors and adding a second, non-color cue was judged better than a high score on a set of colors that would mislead."),

            heading2("Position, in every scheme"),
            para("Forty-seven measured positions — every button in the phrase panel, every command button, every card, and the regions that hold them — are identical in all seven schemes. One keyguard fits any of them."),

            // ===== 7 =====
            heading1("7. A Principle That Runs Underneath All of Them"),
            para("No scheme relies on color alone to tell the user anything. The four kinds of suggested reply are marked three ways at once: by where they sit on screen, which never changes; by color; and by a printed label. Somebody who cannot use the color leg still has the other two."),
            para("This is a requirement of the published accessibility standard, and it also reflects a caution from the research on AAC displays specifically. Work on how color is used in these displays has produced mixed results rather than uniformly positive ones: background color has been found to help in some conditions, to make no difference in others, and to interfere in others again, with the benefit appearing to depend on whether the user has developed the reasoning to treat a color as a signal about something (Thistle and Wilkinson 2017). The broader argument for designing these displays around how vision and attention actually work, rather than around how they look, is set out by Wilkinson and Jagaroo (2004)."),
            para("The practical conclusion is the same either way: color is worth using and is not worth relying on. Every scheme here changes the color leg and leaves the other two alone."),

            // ===== 8 =====
            heading1("8. Limits, and What Would Change Them"),
            para("These should be read before anyone treats this document as a clinical recommendation."),
            bullet("Nobody with the conditions described has used these schemes. They have been measured against published thresholds and rendered on a real screen. That is evidence that they are built correctly; it is not evidence that they help.", "limits"),
            bullet("Simulating color blindness is a model, not an experience. The method used is well established for the red-green kinds; the blue-yellow simulation is a rougher approximation, and the thresholds chosen for what counts as far enough apart are a judgment.", "limits"),
            bullet("Meeting a contrast standard is a floor, not a goal. A scheme can clear every threshold and still be tiring to look at for hours, and nothing here measures that.", "limits"),
            bullet("The schemes have not been checked on paper or under a keyguard in daylight, on a glossy screen, or outdoors, where reflections change everything.", "limits"),
            bullet("Two schemes reduce the information available. “High contrast, light” and “High contrast, dark” remove the card tints, so the four kinds of reply are distinguished by less than in the default. That is the intended trade, and it should be a conscious one.", "limits"),
            para("What would change this is straightforward and not yet done: try them with real users, including at least one person with reduced contrast sensitivity, one with color blindness, and one with light sensitivity, and record which scheme each of them settles on and why. Until then, the reasonable use of this document is to narrow the starting point, not to make the choice."),

            // ===== 9 =====
            heading1("9. References"),
            para("Every source below was checked on September 3 2026. Where a figure is an approximation or is reported as a range in the literature, the body of this document says so rather than presenting a single number."),

            heading2("Standards"),
            refItem("W3C Web Accessibility Initiative. Understanding Success Criterion 1.4.3: Contrast (Minimum). Web Content Accessibility Guidelines 2.2. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"),
            refItem("W3C Web Accessibility Initiative. Understanding Success Criterion 1.4.11: Non-text Contrast. Web Content Accessibility Guidelines 2.1. https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html"),

            heading2("Contrast and reading"),
            refItem("Legge, G. E., Rubin, G. S., and Luebker, A. (1987). Psychophysics of reading. V. The role of contrast in normal vision. Vision Research, 27(7), 1165–1177."),
            refItem("Rubin, G. S., and Legge, G. E. (1989). Psychophysics of reading. VI. The role of contrast in low vision. Vision Research, 29(1), 79–91."),
            refItem("Piepenbrock, C., Mayr, S., Mund, I., and Buchner, A. (2013). Positive display polarity is advantageous for both younger and older adults. Ergonomics, 56(7), 1116–1124."),
            refItem("Piepenbrock, C., Mayr, S., and Buchner, A. (2014). Positive display polarity is particularly advantageous for small character sizes. Human Factors, 56(5), 942–951."),

            heading2("Color vision"),
            refItem("Okabe, M., and Ito, K. Color Universal Design: how to make figures and presentations that are friendly to color blind people. Widely adopted eight-color palette for categorical color that remains distinguishable under the common kinds of color vision deficiency."),
            refItem("Viénot, F., Brettel, H., and Mollon, J. D. (1999). Digital video colourmaps for checking the legibility of displays by dichromats. Color Research and Application, 24(4), 243–252."),
            refItem("Brettel, H., Viénot, F., and Mollon, J. D. (1997). Computerized simulation of color appearance for dichromats. Journal of the Optical Society of America A, 14(10), 2647–2655."),
            refItem("Colour Blind Awareness. Types of color blindness, and prevalence figures. https://www.colourblindawareness.org/colour-blindness/types-of-colour-blindness/"),
            refItem("Impact of Cataract on Color Vision and Contrast Sensitivity: A Clinical Review. Cureus. Reports that cataract impairs color vision most notably along the blue-yellow axis, attributed to absorption of short-wavelength light by the yellowed lens."),

            heading2("Vision and cerebral palsy"),
            refItem("American Academy of Ophthalmology (2024). Diagnosis and Care of Children With Cerebral/Cortical Visual Impairment. Clinical statement. https://www.aao.org/education/clinical-statement/diagnosis-care-of-children-with-cerebral-cortical-"),
            refItem("Cerebral Visual Impairment. EyeWiki, American Academy of Ophthalmology. Reports cerebral visual impairment in 50 to 70 percent of children with cerebral palsy, with rates ranging from 26 to 83 percent depending on the definition used, and lists reduced contrast sensitivity and photophobia among its common features. https://eyewiki.org/Cerebral_Visual_Impairment"),

            heading2("Color in AAC displays"),
            refItem("Wilkinson, K. M., and Jagaroo, V. (2004). Contributions of principles of visual cognitive science to AAC system display design. Augmentative and Alternative Communication, 20(3), 123–136."),
            refItem("Thistle, J. J., and Wilkinson, K. (2017). Effects of background color and symbol arrangement cues on construction of multi-symbol messages by young children without disabilities: implications for aided AAC design. Augmentative and Alternative Communication, 33(3), 160–169."),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(docPath("Conversant AAC Color Schemes.docx"), buffer);
    console.log("Wrote Conversant AAC Color Schemes.docx");
});
