/* Turn a parsed problem report into findings.
 *
 * TWO KINDS, AND KEEPING THEM APART IS THE POINT OF THE TOOL.
 *
 *   'app'   — something the app did to the tester. What to fix.
 *   'trust' — a number in the report that will mislead whoever reads it. What NOT
 *             to believe. These exist because the August 21 2026 reading of a real
 *             tester's report turned up five statistics that were wrong or
 *             unreadable, one of them (a 0.2s median wait) wrong in the flattering
 *             direction on the single question the beta exists to answer.
 *
 * A trust finding is not a bug report about the summary — it is a warning label on
 * a specific figure, so nobody reasons from it. Left unflagged these are worse than
 * a missing number, because a missing number prompts a question and a wrong one
 * does not.
 *
 * ⚠ EVERY FINDING CARRIES ITS ARITHMETIC in `evidence`, and anything inferred says
 * so in `confidence`. A tool that reports a conclusion without the numbers behind
 * it just moves the guessing somewhere less visible, and several of these checks
 * are heuristics over a small sample from one session.
 *
 * ⚠ AND IT MUST STAY HONEST ABOUT WHAT THE TRACE CANNOT SEE. The event trace
 * carries counts and durations and NO WORDS, deliberately (August 5 2026). So a
 * complaint about what was said or heard — the commonest kind — is not refutable
 * from a report, and a check that finds nothing must never be rendered as "no
 * problem". `notVisible` is for saying so out loud.
 */

const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const i = Math.floor(s.length / 2);
    return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};
const s1 = (x) => (x == null ? '?' : (Math.round(x * 10) / 10).toFixed(1));
const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : null);

const PALETTE_UP = new Set(['palette_shown', 'palette_refreshed']);
const USER_ACTED = new Set(['card_selected', 'composer_spoken', 'palette_abandoned', 'choice_chip', 'express_phrase']);

/* Everything the trace can be reduced to, computed once so a check can be a few
 * lines rather than another pass over the events. */
export function summarizeEvents(events) {
    const g = {
        palettesShown: 0, replacedBeforeAnyTap: 0, actedOn: 0,
        lives: [], decideMs: [], generationMs: [], supersededMs: [],
        placeholders: 0, secondPlaceholders: 0,
        checkpointGapsMs: [], listenStarts: 0,
        conversationsStarted: 0, selections: 0,
        checkpointsSoonAfterAppSpoke: 0, checkpointsAfterAnyAppSpeech: 0,
        rateLimited: 0, abandoned: 0,
        slotsSelected: {},
    };
    let openAt = null, lastSpokeAt = null;
    for (const e of events) {
        if (PALETTE_UP.has(e.name)) {
            g.palettesShown++;
            if (openAt !== null) { g.lives.push(e.t - openAt); g.replacedBeforeAnyTap++; }
            openAt = e.t;
        } else if (USER_ACTED.has(e.name)) {
            if (openAt !== null) { g.actedOn++; openAt = null; }
            if (e.name === 'palette_abandoned') g.abandoned++;
        }
        if (e.name === 'card_selected') {
            g.selections++;
            const slot = e.fields.slot;
            if (slot) g.slotsSelected[slot] = (g.slotsSelected[slot] || 0) + 1;
        }
        if (e.name === 'decide' && typeof e.fields.ms === 'number') g.decideMs.push(e.fields.ms);
        if (e.name === 'generation' && typeof e.fields.ms === 'number') g.generationMs.push(e.fields.ms);
        if (e.name === 'generation_superseded' && typeof e.fields.ms === 'number') g.supersededMs.push(e.fields.ms);
        if (e.name === 'placeholder_spoken') {
            g.placeholders++;
            if (e.fields.n >= 2) g.secondPlaceholders++;
            lastSpokeAt = e.t;
        }
        if (e.name === 'listen' && e.fields.status === 'start') g.listenStarts++;
        if (e.name === 'conversation_started') g.conversationsStarted++;
        if (e.name === 'rate_limited') g.rateLimited++;
        if (e.name === 'checkpoint') {
            if (typeof e.fields.sinceMs === 'number') g.checkpointGapsMs.push(e.fields.sinceMs);
            if (lastSpokeAt !== null) {
                g.checkpointsAfterAnyAppSpeech++;
                if (e.t - lastSpokeAt <= 8) g.checkpointsSoonAfterAppSpoke++;
            }
        }
    }
    g.medianLife = median(g.lives);
    g.medianDecideMs = median(g.decideMs);
    g.medianGenerationMs = median(g.generationMs);
    return g;
}

/* ── The checks ──────────────────────────────────────────────────────────── */

function checkPaletteChurn(r, g, add) {
    if (!g.palettesShown) return;
    const share = pctOf(g.replacedBeforeAnyTap, g.palettesShown);
    if (g.replacedBeforeAnyTap < 2) return;
    const decideS = g.medianDecideMs != null ? g.medianDecideMs / 1000 : null;
    const shorterThanDecide = decideS == null ? null : g.lives.filter(x => x < decideS).length;
    add({
        kind: 'app', severity: share >= 25 ? 'high' : 'medium',
        title: 'Suggestions were replaced while the tester was still choosing',
        detail: 'Each pause in the other person\'s speech asks the AI again and swaps the cards. '
            + 'A tester who reads slowly loses the answer they were reaching for.',
        evidence: [
            `${g.palettesShown} sets of suggestions were put up; ${g.replacedBeforeAnyTap} (${share}%) were replaced before anything was tapped`,
            g.medianLife != null ? `a set lasted ${s1(g.medianLife)}s typically, shortest ${s1(Math.min(...g.lives))}s` : null,
            decideS != null ? `the tester takes ${s1(decideS)}s to read and choose` : null,
            shorterThanDecide != null ? `${shorterThanDecide} of ${g.lives.length} sets did not survive that long` : null,
        ].filter(Boolean),
        confidence: 'measured',
    });
}

function checkNoSelectionRun(r, g, add) {
    // A run of palettes with nothing tapped between them, ending the trace: the
    // tester gave up. This is what the last minutes of a report often look like,
    // and it is the shape that produces the message rather than the numbers.
    let run = 0, worst = 0;
    for (const e of r.events) {
        if (PALETTE_UP.has(e.name)) { run++; worst = Math.max(worst, run); }
        else if (USER_ACTED.has(e.name)) run = 0;
    }
    if (run >= 3) {
        add({
            kind: 'app', severity: 'high',
            title: 'The report was written after a stretch with nothing chosen',
            detail: 'The trace ends with suggestions being offered and replaced and nothing being picked at all.',
            evidence: [`${run} sets of suggestions in a row, none acted on, immediately before the report was sent`],
            confidence: 'measured',
        });
    } else if (worst >= 4) {
        add({
            kind: 'app', severity: 'medium',
            title: 'A stretch where nothing could be chosen',
            evidence: [`${worst} sets of suggestions in a row with no selection`],
            confidence: 'measured',
        });
    }
}

function checkWastedGenerations(r, g, add) {
    if (g.supersededMs.length < 3) return;
    const secs = g.supersededMs.reduce((a, b) => a + b, 0) / 1000;
    add({
        kind: 'app', severity: 'medium',
        title: 'AI requests were started and thrown away',
        detail: 'Each pause starts a fresh request and discards the one in flight. It is billed either way.',
        evidence: [`${g.supersededMs.length} discarded, ${s1(secs)}s of work in total`],
        confidence: 'measured',
    });
}

function checkSlowGeneration(r, g, add) {
    if (!g.generationMs.length) return;
    const med = g.medianGenerationMs / 1000;
    const max = Math.max(...g.generationMs) / 1000;
    if (med < 4) return;
    add({
        kind: 'app', severity: med >= 6 ? 'high' : 'medium',
        title: 'Suggestions took a long time to arrive',
        detail: 'The app fills the gap by speaking a placeholder, and a second one when it runs long. '
            + 'That is more of the app talking into an open microphone.',
        evidence: [
            `${s1(med)}s typically, worst ${s1(max)}s, over ${g.generationMs.length} requests`,
            g.secondPlaceholders ? `${g.secondPlaceholders} of ${g.placeholders} placeholders were a second one in a row` : null,
        ].filter(Boolean),
        confidence: 'measured',
    });
}

function checkEchoSuspicion(r, g, add) {
    // Deliberately reported EITHER WAY. A negative here is worth as much as a
    // positive: it is what stops a plausible-sounding echo story being written
    // around a complaint the trace does not actually support.
    if (!g.checkpointsAfterAnyAppSpeech) return;
    const n = g.checkpointsSoonAfterAppSpoke, d = g.checkpointsAfterAnyAppSpeech;
    const share = pctOf(n, d);
    if (share >= 40) {
        add({
            kind: 'app', severity: 'high',
            title: 'The app may be hearing its own voice',
            detail: 'Listening restarted soon after the app spoke, often enough to suggest its own speech is being '
                + 'treated as the other person talking.',
            evidence: [`${n} of ${d} listening checkpoints landed within 8s of the app speaking (${share}%)`],
            confidence: 'suspected — the trace carries no words, so this is a pattern, not proof',
        });
    } else {
        add({
            kind: 'note', severity: 'note',
            title: 'The app hearing its own voice is NOT visible here',
            evidence: [`only ${n} of ${d} listening checkpoints landed within 8s of the app speaking (${share}%)`],
            confidence: 'measured — but see "what this report cannot show" below',
        });
    }
}

function checkCheckpointBursts(r, g, add) {
    const burst = g.checkpointGapsMs.filter(x => x < 2500);
    if (burst.length < 3) return;
    add({
        kind: 'app', severity: 'medium',
        title: 'Listening re-triggered in rapid bursts',
        detail: 'Several asks in a row a couple of seconds apart. Each one costs a request and swaps the cards.',
        evidence: [`${burst.length} of ${g.checkpointGapsMs.length} gaps were under 2.5s (typical gap ${s1(median(g.checkpointGapsMs) / 1000)}s)`],
        confidence: 'measured',
    });
}

function checkSilenceSetting(r, g, add) {
    const st = r.system.silenceThreshold;
    if (typeof st !== 'number') return;
    if (st > 0.5) {
        add({
            kind: 'note', severity: 'note',
            title: 'This tester has already slowed the app down',
            evidence: [`silence period ${st}s, against a shipped default of 0.5s`],
            detail: 'Anything churning at this setting will churn harder for everyone on the default.',
            confidence: 'measured',
        });
    }
}

function checkDisplay(r, g, add) {
    // Dotted paths, not bare names: DISPLAY carries several `w:` and `h:` leaves
    // and a flat lookup would return whichever appeared first.
    const lay = r.system['layoutViewport.w'];
    const scr = r.system['screen.w'];
    if (typeof lay !== 'number' || typeof scr !== 'number' || !scr) return;
    const share = pctOf(lay, scr);
    if (share !== null && share < 80) {
        add({
            kind: 'note', severity: 'note',
            title: 'The app is running in a small window',
            evidence: [`${lay} wide on a ${scr}-wide screen (${share}%)`],
            detail: 'A wider window means bigger cards and easier targets.',
            confidence: 'measured',
        });
    }
}

/* ── Trust checks: figures not to believe ────────────────────────────────── */

function trustErrorsContradiction(r, add) {
    if (!r.usage.errors) return;
    if (r.errorSectionSaysNone) {
        add({
            kind: 'trust', severity: 'high',
            title: 'The errors section is empty although errors were recorded',
            detail: 'The two are read from different places: the summary from the saved conversations on disk, '
                + 'the errors section from a copy the browser holds. The browser copy is lost if the app\'s web '
                + 'address changes or the browser clears its storage.',
            evidence: [`summary says ${r.usage.errors} error(s) in ${r.usage.errorConversations ?? '?'} conversation(s); errors section says none`],
            confidence: 'measured',
        });
    }
    if (!r.transcriptBlocks) {
        add({
            kind: 'trust', severity: 'high',
            title: 'No transcripts came with this report',
            detail: 'Transcripts are attached only for conversations the browser-held error copy knows about. '
                + 'Without them there is no way to check a complaint about what was said or heard.',
            evidence: [`${r.usage.errors} error(s) recorded, 0 transcripts attached`],
            confidence: 'measured',
        });
    }
}

function trustSourcePopulation(r, add) {
    const sc = r.usage.sourceCounts || {};
    const unrecorded = sc['(not recorded)'];
    if (!unrecorded || r.usage.fromCard == null) return;
    const recorded = Object.entries(sc).filter(([k]) => k !== '(not recorded)')
        .reduce((a, [, n]) => a + n, 0);
    add({
        kind: 'trust', severity: 'medium',
        title: '"Chosen from a card" and "where the words came from" count different things',
        detail: 'The first has been recorded since the beginning; the second only since August, so it covers a '
            + 'fraction of the same turns. Read the percentage, not the second list.',
        evidence: [
            `chosen from a card: ${r.usage.fromCard}`,
            `where the words came from: ${recorded} recorded, ${unrecorded} not`,
        ],
        confidence: 'measured',
    });
}

function trustSlotBase(r, add) {
    const total = Object.values(r.usage.slotCounts || {}).reduce((a, b) => a + b, 0);
    if (!total || !r.usage.userTurns) return;
    if (total < r.usage.userTurns * 0.5) {
        add({
            kind: 'trust', severity: 'medium',
            title: 'The "which kind of reply" percentages are of a much smaller number',
            detail: 'Which category a card belonged to has only been recorded since August, so the split covers '
                + 'the recent turns, not the whole history printed above it.',
            evidence: [`percentages are of ${total} turns, printed under a heading of ${r.usage.userTurns}`],
            confidence: 'measured',
        });
    }
}

function trustPerActiveWeek(r, add) {
    const { perActiveWeek, activeDays, conversations, spanDays } = r.usage;
    if (perActiveWeek == null || !activeDays) return;
    if (activeDays < 14) {
        const honest = spanDays ? (conversations / (spanDays / 7)) : null;
        add({
            kind: 'trust', severity: 'high',
            title: '"Per week" is an extrapolation from very few days',
            detail: 'It scales the days actually used up to a full week, so a tester who used it rarely can read '
                + 'as heavily engaged. Retention is the first thing the beta is trying to measure, and this is '
                + 'the figure that answers it.',
            evidence: [
                `reported ${perActiveWeek} per week, from ${activeDays} day(s) of use`,
                honest != null ? `across the whole period it is ${s1(honest)} conversations a week` : null,
            ].filter(Boolean),
            confidence: 'measured',
        });
    }
}

function trustRespondMedian(r, add) {
    const u = r.usage;
    if (u.respondMedianS == null) return;
    const buckets = Object.entries(u.byRecognizer || {});
    const worst = buckets.filter(([, b]) => b.medianS > u.respondMedianS * 5);
    if (u.respondMedianS < 1 || worst.length) {
        add({
            kind: 'trust', severity: 'high',
            title: 'The headline "typical wait" is probably not measuring a wait',
            detail: 'Before July 2026 both halves of an exchange were saved at the same moment, so the gap between '
                + 'them is an artifact rather than a wait. Older conversations drag the figure down. This is the '
                + 'number that answers whether the app keeps up, so it matters that it reads low.',
            evidence: [
                `headline: ${s1(u.respondMedianS)}s over ${u.respondSamples ?? '?'} turns`,
                ...worst.map(([k, b]) => `but "${k}" turns: ${s1(b.medianS)}s over ${b.turns}`),
            ],
            confidence: 'suspected — confirm against one saved conversation file',
        });
    }
}

function trustVersion(r, currentVersion, add) {
    if (!r.appVersion || !currentVersion || r.appVersion === currentVersion) return;
    add({
        kind: 'trust', severity: 'note',
        title: 'This report is from an older build',
        evidence: [`report: ${r.appVersion} (${r.build ?? '?'}) — current: ${currentVersion}`],
        detail: 'Some of what it describes may already be fixed.',
        confidence: 'measured',
    });
}

/* ── What a report structurally cannot answer ────────────────────────────── */

function notVisible(r) {
    const out = [];
    out.push('What was actually said. The trace records counts and durations and no words at all, '
        + 'on purpose — so a complaint about a mishearing, a wrong suggestion, or the app writing down '
        + 'its own speech cannot be confirmed or ruled out from this file.');
    if (!r.transcriptBlocks) {
        out.push('No transcripts were attached either, so there is no second route to it. '
            + 'Ask the tester for one saved conversation file.');
    }
    if (!r.sections.events) {
        out.push('There is no event trace in this report, so nothing about timing or churn can be measured.');
    }
    return out;
}

export function analyze(report, { currentVersion = null } = {}) {
    const findings = [];
    const add = (f) => findings.push(f);
    const g = summarizeEvents(report.events || []);

    checkPaletteChurn(report, g, add);
    checkNoSelectionRun(report, g, add);
    checkSlowGeneration(report, g, add);
    checkWastedGenerations(report, g, add);
    checkCheckpointBursts(report, g, add);
    checkEchoSuspicion(report, g, add);
    checkSilenceSetting(report, g, add);
    checkDisplay(report, g, add);

    trustErrorsContradiction(report, add);
    trustSourcePopulation(report, add);
    trustSlotBase(report, add);
    trustPerActiveWeek(report, add);
    trustRespondMedian(report, add);
    trustVersion(report, currentVersion, add);

    const rank = { high: 0, medium: 1, note: 2 };
    findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

    return { report, stats: g, findings, notVisible: notVisible(report) };
}
