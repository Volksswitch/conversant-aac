const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

/*
 * NO VULGARITY — absolute for now (Ken, August 3 2026).
 *
 * Prompted by a live card reading "Honestly? I think it's pretty solid. I fw it."
 * offered to a 17-year-old, with no partner selected. The speakability rule kills
 * that particular wording, but "I fucking love it" is perfectly sayable and would
 * still have been offered, so the register question is separate and had to be
 * answered on its own.
 *
 * THE DECISION, and it is deliberately NOT a filter derived from anything: vulgarity
 * is to be EXPLICITLY CHOSEN, and scoped to WHO THE PARTNER IS — a property of an
 * identified person in the relationship graph, not a global switch. That is a future
 * feature, because for a minor it also needs guardian approval and how that works is
 * genuinely unknown. Until it exists, the answer is no.
 *
 * WHY IT MUST REFUSE TO INFER: the failing turn had `partner: null` and an age in the
 * profile, and the model read those as licence rather than as constraint. Age in
 * particular is worse than useless here — with no instruction attached, "17" is a cue
 * for how to SOUND. So the rule names every signal that must NOT be read as
 * permission, silence included.
 *
 * The asymmetry that settles it: a card can be tapped by mistake — this population
 * taps imprecisely, which is why the double-tap safeguard exists — and an obscenity
 * spoken in the user's OWN voice to a support worker or a stranger cannot be taken
 * back. A blander card can.
 */
/*
 * NO OUTSIDE KNOWLEDGE — the user is a person, not a smart speaker (Ken, August 8 2026).
 *
 * Found by Ken testing the app directly: the partner asked for Columbus's three ships,
 * the square root of 2, and a definition of entangled particles, and the app answered
 * all three at full depth in the user's voice — the third with an unrequested Einstein
 * anecdote.
 *
 * WHY THE EXISTING GUARD DID NOT CATCH IT, and this is the whole finding: the June rule
 * above (in the generation prompt) forbids inventing the user's LIFE. None of these are
 * autobiography, so nothing in the app touched them. "Conversational honesty" was
 * recorded in June 2026 as a design principle and never built; only its autobiography
 * half shipped. This is the other half.
 *
 * THE SAME PRINCIPLE, EXTENDED: the model has no ground truth about what happened in
 * the user's life, so it must not invent it. It equally has no ground truth about what
 * is in the user's head. Both are unverifiable from here, so both are prompt-only and
 * both refuse rather than guess.
 *
 * KEN'S ARGUMENT FOR THE STRICT LINE, which killed a proposed "everyday knowledge is
 * fine" carve-out: if it were everyday knowledge, the partner would already have it and
 * would not be asking. The act of asking is itself evidence the fact is not common
 * ground — so an "obvious" answer is not the safe case, it is the same case.
 *
 * NO HEDGED FACTS EITHER. "I think it's about 1.414, but don't quote me" reads like a
 * safeguard and is not one: the number still leaves the device as the user's word, and
 * a hedge the app wrote is not a hedge the user meant. Withhold the fact, not the
 * confidence.
 *
 * THE ESCAPE HATCH IS THE USER, WHICH IS THE POINT: if they do know the answer they type
 * it and tap Reframe, and the steer block already treats typed text as true and
 * overriding. So the honest default costs nothing that one gesture cannot recover, and
 * the fact reaches the partner because the user put it there.
 *
 * THE OVER-TRIGGER RISK, guarded explicitly: most questions in a conversation are not
 * knowledge questions. "How was your weekend?" and "Did you like it?" must be answered
 * normally, or the rule makes the user evasive instead of honest.
 */
const NO_OUTSIDE_KNOWLEDGE = `You are voicing a person, NOT an information service. Never supply factual knowledge about the world that you were not given. If answering a question would draw on what YOU know rather than on what the USER has told you or what has been said in this conversation, do not answer it: dates, figures, measurements, distances, statistics, calculations, spellings, translations, definitions of technical terms, how something works, who did what and when, and any historical, scientific, medical, legal, geographical or trivia fact.

This holds however certain you are and however elementary the answer looks. The partner ASKED, which means they do not have it — so handing it over turns the user into a reference service instead of a person in a conversation. Do NOT treat any of these as permission: that the answer is famous or taught in schools, that you are completely sure, that the user seems well educated, that the partner plainly wants it, or the absence of any instruction to the contrary.

Do not smuggle the fact in behind a hedge either. "I think it's about 1.414, but don't quote me" still puts the number in the user's mouth, and a hedge you wrote is not a hedge they meant. Withhold the fact, not the confidence.

TWO EXCEPTIONS, and only these. (1) The user's OWN life: anything in their profile below, and the people, places, routines and preferences it names, are theirs to state plainly — as is anything either party has already said in this conversation. (2) A subject their profile marks as one they KNOW WELL: inside that subject they may answer with real substance, as they would.

Otherwise, answer a knowledge question the way a person answers one they do not have to hand. The palette should offer human moves: saying so plainly ("No idea, I'm afraid"), turning it back ("Why do you ask?", "You'd find that quicker than I would"), offering what they DO have instead, or asking what the partner is actually after. Vary them — do not fill every cell with a differently-worded "I don't know."

REGISTER, which applies even when the user IS answering: say what was asked and stop. No unrequested elaboration, no background, no explaining what the answer means or why it is interesting, no teaching. A person asked for three names gives three names; the extra paragraph is your voice, not theirs.`;

/*
 * The repair paths reword the user's OWN last utterance, so the short form of
 * NO_OUTSIDE_KNOWLEDGE is what they need: the risk here is narrow and specific —
 * "expand" reaching for a fact to add detail with. Same principle, stated in a
 * sentence rather than a page, because "What?" is not a rare event and the long
 * rule would be billed on every one.
 */
const REWORD_ONLY = `Work ONLY from what the user already said, their profile, and this conversation. Never add a fact from your own knowledge to make it clearer or fuller — no dates, figures, definitions, explanations of how something works, or details of any event. Clearer wording, not more information.`;

const NO_VULGARITY = `No vulgarity. Never offer profanity, obscenity, slurs, or crude sexual language — not in any response text, hint, or account, and not in softened, abbreviated or initialised form ("wtf", "fw", "eff", "frickin"). Where the natural phrasing would be coarse, say it plainly instead. This is absolute: do NOT treat any of the following as permission — the user's age, anything in their profile, how casual or crude the partner sounds, the informality of the setting, or the absence of an instruction to the contrary.`;

let apiKey = null;
let onUsageUpdate = null;
let voiceBlock = '';
let worldviewBlock = '';
let relationshipsBlock = '';
let placesBlock = '';
let situationBlock = '';

export function setApiKey(key) {
    apiKey = key;
}

// Cheap client-side format check (no network). Catches the gross paste mistakes —
// missing prefix, embedded whitespace, obviously-truncated — but NOT a key that is
// subtly wrong (e.g. missing a few characters) since Anthropic keys have no fixed
// public length. That case needs testApiKey (a live call). Returns { ok, reason }.
export function validateKeyFormat(key) {
    const k = (key || '').trim();
    if (!k) return { ok: false, reason: 'empty' };
    if (/\s/.test(k)) return { ok: false, reason: 'whitespace' };
    if (!k.startsWith('sk-ant-')) return { ok: false, reason: 'prefix' };
    if (k.length < 40) return { ok: false, reason: 'short' };
    return { ok: true };
}

// Live verification against the API (the only way to catch a subtly-wrong key).
// Uses GET /v1/models — it authenticates the key but bills no tokens — so a "Test"
// costs nothing. 200 = valid; 401/403 = the key is rejected; anything else (incl. a
// thrown fetch) = couldn't reach the service. Returns { ok, reason, status }.
export async function testApiKey(key) {
    const k = (key ?? apiKey ?? '').trim();
    if (!k) return { ok: false, reason: 'empty' };
    try {
        const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
            method: 'GET',
            headers: {
                'x-api-key': k,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
        });
        if (res.ok) return { ok: true, status: res.status };
        if (res.status === 401 || res.status === 403) return { ok: false, reason: 'rejected', status: res.status };
        return { ok: false, reason: 'error', status: res.status };
    } catch (err) {
        return { ok: false, reason: 'network', message: err.message };
    }
}

// The compact worldview profile text (worldview.buildBlock()). Set fresh before
// each generation so questionnaire edits take effect immediately. This is the
// sole personalization channel now that the interim name/about fields are gone.
export function setWorldviewBlock(text) {
    worldviewBlock = (text || '').trim();
}

// The compact relationship-graph text (relationships.buildBlock()). Set fresh
// before each generation alongside the worldview block, so people edits take
// effect immediately. Private people are already withheld by buildBlock.
export function setRelationshipsBlock(text) {
    relationshipsBlock = (text || '').trim();
}

// The compact places text (places.buildBlock()). Set fresh before each generation
// alongside the worldview and relationship blocks, so edits to My Places take effect
// immediately. Private places are already withheld from being volunteered by
// buildBlock. WHERE the user is right now is separate — that rides in the situation
// block, because it changes per conversation rather than per edit.
export function setPlacesBlock(text) {
    placesBlock = (text || '').trim();
}

// HOW THE USER SOUNDS (voice.buildBlock()). Set fresh before each generation like
// the others. This one is placed FIRST in the assembled block, and the placement is
// not incidental: the other sections are FACTS, which are situational — most of them
// are irrelevant to most turns — whereas register is a global constraint on every
// card in every palette. Appending it as one more paragraph at the bottom of a
// growing pile is where instruction-following degrades.
export function setVoiceBlock(text) {
    voiceBlock = (text || '').trim();
}

// The current SITUATION — who the user is talking with (active Partner toggle)
// and how they're feeling (active Feeling toggle). Set fresh before each
// generation; empty when no influencer is active. Partner gives the AI the
// partner's identity (enabling nickname use + light tailoring); Feeling colors
// the tone of the suggestions.
export function setSituationBlock(text) {
    situationBlock = (text || '').trim();
}

/*
 * Builds the personalization + placeholder-safety block appended to a generation
 * system prompt. Even with no profile set, the no-brackets instruction prevents the
 * model from emitting "[Name]" blanks.
 *
 * THE SITUATION BLOCK IS DELIBERATELY NOT IN HERE — it is returned separately by
 * buildSituationBlock(), and the split exists for PROMPT CACHING (see the cache
 * note above generateResponses). Everything in this function changes only when the
 * user edits About Me / People / Places, i.e. never during a conversation, so it
 * can live inside the cached prefix. The situation block changes when a Partner,
 * Feeling or Place toggle is tapped — Feeling can be tapped mid-conversation — and
 * a cache prefix is invalidated by any byte that changes inside it, so leaving it
 * here would throw away a ~3,400-token cache entry to save re-sending ~50 tokens.
 *
 * Callers that are NOT cached must append buildSituationBlock() themselves, or the
 * model silently loses the partner/feeling/place context.
 */
function buildProfileBlock() {
    const sections = [];
    if (voiceBlock) sections.push(`\n\n${voiceBlock}`);   // first — see setVoiceBlock
    if (worldviewBlock) sections.push(`\n\n${worldviewBlock}`);
    if (relationshipsBlock) sections.push(`\n\n${relationshipsBlock}`);
    if (placesBlock) sections.push(`\n\n${placesBlock}`);
    sections.push(`\n\nNever output placeholder text in square brackets such as [Name], [your name], or [city]. If you do not know a personal detail, phrase the response so it is not needed.`);
    return sections.join('');
}

// Who the user is talking with / how they feel / where they are — the volatile half
// of the old combined profile block. Kept out of the cached prefix; see above.
function buildSituationBlock() {
    return situationBlock ? `\n\n${situationBlock}` : '';
}

export function onUsage(callback) {
    onUsageUpdate = callback;
}

/*
 * Report token usage to the cost counter.
 *
 * ⚠ WITH PROMPT CACHING, `input_tokens` IS THE UNCACHED REMAINDER ONLY — it is not
 * the size of the prompt. The prompt is input_tokens + cacheWrite + cacheRead, and
 * the three are billed at DIFFERENT rates (full / 1.25x / 0.1x). Passing only
 * input_tokens once caching is on would silently under-report the bill by roughly
 * the cache hit rate, which for this app's hot path is ~90%. A cost display that
 * lies low is worse than none in a product whose whole funding model is "you pay
 * for what you use", so the three are counted separately all the way through to
 * pricing.json.
 */
function trackUsage(data) {
    if (!data.usage || !onUsageUpdate) return;
    onUsageUpdate({
        input: data.usage.input_tokens ?? 0,
        output: data.usage.output_tokens ?? 0,
        cacheWrite: data.usage.cache_creation_input_tokens ?? 0,
        cacheRead: data.usage.cache_read_input_tokens ?? 0,
    });
}

export async function cleanupTranscript(rawText, conversationHistory) {
    if (!apiKey) return rawText;

    const contextLines = conversationHistory.slice(-6).map(entry =>
        `${entry.role === 'partner' ? 'Partner' : 'User'}: ${entry.text}`
    ).join('\n');

    const systemPrompt = `You are cleaning up a speech-to-text transcript from a live conversation. The transcript may contain:
- Missing or incorrect punctuation and capitalization
- Words the speech recognizer misheard (e.g., "Kmart" instead of "Hey Mark", "eye pad" instead of "iPad")

Use the conversation context to identify likely mishearings and correct them. Apply proper punctuation and capitalization. Keep corrections conservative — only fix words that are clearly wrong given the context. Do not add, remove, or rephrase beyond correcting recognition errors.

Return ONLY the corrected transcript text, nothing else.${contextLines ? '\n\nConversation so far:\n' + contextLines : ''}`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 200,
            system: systemPrompt,
            messages: [{ role: 'user', content: rawText }]
        })
    });

    if (!response.ok) return rawText;

    const data = await response.json();
    trackUsage(data);
    return data.content[0].text.trim();
}

// Single combined call (Conversation-Engine-Design.docx §9): classify the
// partner's action AND generate a typed, slot-structured response palette AND report
// which personal facts were missing (worldview gaps log). The classification is
// emitted FIRST in the output so it is inspectable and so the model commits to
// the action type before producing responses (the CA recommendation as a structural
// property of the output).
//
// `context` is the engine's request context (design §9.1): { stt_confidence,
// sequence_stack, register, phase, last_user_utterance }. Optional.
//
// Returns { classification:{partner_action,turn_status,is_repair_initiator},
//           responses:[{slot,text,hint,...}], missingFacts:string[] }.
// `opts.avoid` (optional): an array of previously-offered option texts the user
// rejected as "not quite right" — set by the "Show me different options"
// regenerate control. When present, the model is told to take a different angle
// and not repeat those.
// `opts.steer` (optional): free-text guidance the user typed in the "In your own
// words" box and submitted via Reframe — additional context and/or direction for
// THIS regeneration ("I'm worried about the cost", "keep it short, lean toward
// declining", "I actually beat Tyler at chess last night"). One-shot: the caller
// does not persist it. Because it is user-authored it is ground truth — the model
// may treat any specifics in it as real (it is exactly how the user supplies the
// facts the anti-fabrication rule forbids the model from inventing).
// `opts.focusChoice` (optional): one of the alternatives the partner offered, set
// when the user taps a choice chip in the Express Panel. The user has picked it and
// wants the four structural responses built around THAT alternative, so it
// deliberately overrides the closed-set rule (which would otherwise re-detect the
// menu and return the choice cards again).
export async function generateResponses(conversationHistory, context = {}, opts = {}) {
    if (!apiKey) throw new Error('API key not set');

    const avoidBlock = (Array.isArray(opts.avoid) && opts.avoid.length)
        ? `\n\nThe user found the previous options not quite right and asked for a different set. Produce a meaningfully DIFFERENT palette — take a different angle, tone, or content; do not just reword these. Previous options to avoid repeating:\n${opts.avoid.map((t) => `- ${t}`).join('\n')}`
        : '';

    const steerText = (opts.steer || '').trim();
    const steerBlock = steerText
        ? `\n\nThe user typed this guidance for how to respond right now — treat it as additional context AND direction, and shape every response around it. It may state facts to convey (use them — being user-authored, they are TRUE and override BOTH the "keep it general" caution AND the rule against supplying outside knowledge: a fact the user has typed is a fact the user has, so use it plainly and build on it), and/or how to come across (tone, length, stance). Honor it while keeping the four-slot structure. User's guidance:\n"${steerText}"`
        : '';

    // 1 or 2 options per category (Settings, max 2). When 2, offer two genuinely
    // different alternatives per slot so each category cell can show a choice.
    const perCat = opts.perCategory === 2 ? 2 : 1;
    const perCatBlock = perCat === 2
        ? `\n\nProvide TWO distinct options for EACH of the four slots — 8 responses total (2 PREFERRED, 2 DISPREFERRED, 2 INITIATIVE, 2 REPAIR), in that slot order, best-first within each slot. The two options within a slot must be meaningfully DIFFERENT alternatives (different wording, angle, or content), both valid for that slot — not minor rephrasings.`
        : '';

    // How many cards the palette footprint can show (4 cells × 1 or 2 per cell).
    // A choice palette must fit it, so the model is told the ceiling.
    const paletteCap = perCat === 2 ? 8 : 4;

    // The user tapped a choice chip: they have PICKED one of the alternatives the
    // partner offered and now want the full structural treatment of it. This must
    // override the closed-set rule below — otherwise the model re-detects the same
    // menu and hands back the choice cards again, and the chip does nothing.
    const pick = (opts.focusChoice || '').trim();
    const focusBlock = pick
        ? `\n\nTHE USER HAS ALREADY CHOSEN. Of the alternatives the partner offered, the user wants to answer with "${pick}". The choice is settled, so the closed-set rule does NOT apply to this response: return "offered_options": [] and use the normal four structural slots. EVERY response must answer with "${pick}" — do not offer the other alternatives again, and do not hedge about which one they picked. PREFERRED states it plainly; DISPREFERRED says it with a softening or a caveat (still "${pick}", just more reluctantly or with a qualification); INITIATIVE says it and adds something — a detail, a consequence, or a question back; REPAIR stays a clarification on the partner's turn. Vary the wording so the four are genuinely different ways of saying it, not one sentence reworded.`
        : '';

    /*
     * PROMPT CACHING (Ken, August 8 2026) — this is the ONLY cached call, and the
     * prompt is split into two system blocks because of it.
     *
     * Caching is a strict PREFIX match: one changed byte invalidates everything
     * after it. Before this change the per-turn engine context was interpolated in
     * the MIDDLE of the system prompt, between the fixed instructions and the
     * profile — so nothing was cacheable even though ~3,400 tokens of the prompt
     * are byte-identical on every call. Order is now stability-descending:
     *
     *   [ fixed instructions + perCat + profile ]  <- cache breakpoint
     *   [ situation + engine context + avoid/steer/focus ]
     *
     * WHY ONLY THIS CALL. Caching bills 1.25x to write and 0.1x to read, so an
     * entry needs two reads to pay for itself. This is the only call that fires
     * repeatedly against the same prefix — every silence checkpoint re-generates
     * for the same partner turn, and the 0.5s silence period (Aug 7 2026) makes
     * that several calls per turn plus a regenerate. The other five calls fire once
     * or rarely per conversation and have small prompts; caching them would write
     * entries nobody reads. They also do not share a prefix with this one (each
     * opens with different instructions), so a shared profile block buys nothing —
     * a common SUFFIX is not a common prefix.
     *
     * WHAT INVALIDATES IT, deliberately: editing About Me / People / Places, and
     * changing the cards-per-category setting. All are rare and none happen during
     * a conversation. The 5-minute TTL refreshes on every read, so a conversation
     * pays one write and reads for the rest of its length; the next conversation
     * pays another write.
     *
     * Cache mechanics are Anthropic-specific — this is one more item for the
     * multi-vendor adapter list in CLAUDE.md when a second provider lands.
     */
    const cachedPrompt = `You are an AAC (Augmentative and Alternative Communication) assistant. A non-speaking user is in a live conversation. You speak AS the user, in their voice — not as a helpful assistant. Their communication partner just spoke. First classify what the partner is doing, then generate a palette of structurally distinct responses the user might want to say.

Return ONLY a JSON object, no other text, with exactly this shape:
{
  "partner_action": "INVITATION|QUESTION|REQUEST|STATEMENT|GREETING|ASSESSMENT|CLOSING|OTHER",
  "turn_status": "COMPLETE|INCOMPLETE|CONTINUING",
  "is_repair_initiator": false,
  "offered_options": [],
  "responses": [
    // for a CLOSED-SET turn (offered_options non-empty) the responses are instead:
    //   {"slot": "CHOICE|CHOICE_OTHER|CHOICE_ASK|CHOICE_REPAIR", "text": "...", "hint": "..."}
    // and NONE of the four structural slots below are used. See the closed-set rule.
    {"slot": "PREFERRED", "text": "...", "hint": "..."},
    {"slot": "DISPREFERRED", "text": "...", "hint": "...", "account": true},
    {"slot": "INITIATIVE", "text": "...", "hint": "...", "format": "counter-offer|return-question|expansion"},
    {"slot": "REPAIR", "text": "...", "hint": "...", "trigger": "low_stt_confidence|uncertain_span|long_utterance|none"}
  ],
  "missing_facts": ["<key>", ...]
}

Speak only to what is real — this is the most important rule. You are voicing a real person in a real conversation, NOT writing fiction about a character. Never invent specific events, episodes, outcomes, results, scores, dates, numbers, places, or names that you were not given. Do NOT fabricate autobiography: e.g. never produce "I beat Tyler at a game last night", "I won three matches", "we went to the lake on Saturday", or any concrete happening you have not been told occurred. You MAY draw on the standing facts in the user's profile below (habitual activities, interests, the people in their life) and you MAY offer general, open, or non-committal replies. When a natural answer would otherwise need a specific detail you don't have, keep it GENERAL ("Been playing online games with friends lately") instead of inventing the specifics ("I won last night"). Every option must be something the user could select and have it be TRUE — either grounded in their profile, or general enough that only they would know the particulars. The user is the sole source of truth about their own life; never put invented events in their mouth.

${NO_OUTSIDE_KNOWLEDGE}

Those two rules are the same rule pointed at two things — you cannot know what happened in this person's life, and you cannot know what is in their head. Neither may be filled in from your own knowledge. But do not over-apply them: MOST turns are not knowledge questions at all. "How was your weekend?", "Did you enjoy it?", "What do you fancy doing?" ask about the user, not about the world, and must be answered normally and warmly. Reaching for "I don't know" there makes them evasive, which is its own failure.

Classification (commit to these BEFORE writing responses):
- "partner_action": the first-pair-part type the partner's utterance performs.
- "turn_status": your read of whether the turn sounds finished (COMPLETE) or still in progress (INCOMPLETE / CONTINUING). This is INFORMATIONAL ONLY — it does NOT change what you output; always produce responses regardless (the app, and ultimately the user, decides when to actually respond, not you).
- "is_repair_initiator": true ONLY if the partner is asking the USER to repeat or clarify the user's own last utterance ("What?", "Huh?", "You want what?", "Say that again?").
- "CLOSING" specifically — the partner is moving to END THE CONVERSATION. Do NOT look only for a farewell word: the move that OPENS a closing is usually semantically EMPTY — "Well…", "So…", "Anyway…", "Okay then", "Right", often trailing off. It says nothing precisely because its job is to signal "I have nothing more to add." Also classify as CLOSING: a reason framed around the USER's time ("I should let you go", "I'll let you get back to it"), an arrangement for next time ("See you Tuesday", "Talk soon", "I'll call you"), an appreciation that wraps things up ("It was really good seeing you", "Thanks for calling"), a service-encounter sign-off ("Have a good one", "Take care now", "Enjoy the rest of your day"), and of course the plain farewell ("Bye", "Goodbye", "Night").
  CRITICAL GUARD — ending a TOPIC is not ending the CONVERSATION. The same empty markers also introduce a new topic: "Anyway, what did you think of the film?" and "So, how's the new job?" are NOT closings — the partner is carrying on. Classify CLOSING only when they are moving to end the WHOLE conversation. When the marker is followed by a fresh question or a new subject, it is not a closing. If genuinely unsure, do NOT classify CLOSING — a wrong CLOSING replaces the user's response options with goodbyes while their partner is still talking, which is far more disruptive than missing one.
- "offered_options": the specific things the partner has just PUT ON THE TABLE for the user to choose among, IN THE ORDER THEY SAID THEM, as short bare labels ("mild", "moderate", "severe"). TWO forms count, and the second is the more common one in everyday talk:
  (a) an alternative question, where the list IS the question — "mild, moderate, or severe?", "coffee or tea?", "would you rather walk or drive?";
  (b) a list offered in a STATEMENT — "We've got muffins, croissants, and a few different pastries today — anything jump out at you?", "I could do Tuesday, Wednesday, or Friday.", "There's soup, salad, or a sandwich if you're hungry." The list does NOT have to be exhaustive. A question after the list ("anything jump out at you?") is a STRONG SIGNAL that the options are being offered, but it is NOT required — a plain declarative offer counts too, as the last two examples show, and those are common in casual planning. If the partner named things the user could pick, list them.
  The test is whether the partner is OFFERING them for the user to choose from — not merely mentioning them. A narrative list is NOT an offer: "I picked up milk, eggs, and bread on the way home" puts nothing on the table, so use []. An open question with no named options ("how have you been feeling?", "what do you fancy?") is [] too. NEVER invent an option the partner did not say.
  If one item is vague or open-ended ("a few different pastries", "some other bits"), do not pretend it is a definite choice — either make its card ask about it naturally ("What kind of pastries do you have?") or leave it out. And since a list like this is usually not the whole menu, keep a CHOICE_OTHER card for what the user actually wants whenever a cell is free.

CLOSED-SET TURNS override the slot structure. When "offered_options" is NOT empty, the four structural slots are the wrong shape for this turn: the user needs to be able to pick ANY of the offered alternatives, not four variations on one of them. Returning four takes on a single option is a FAILURE — it silently strips away the choices the partner actually offered. So when "offered_options" is not empty, do NOT use PREFERRED/DISPREFERRED/INITIATIVE/REPAIR at all. Instead return at most ${paletteCap} responses total, in this order:

FIRST, one {"slot": "CHOICE", "text": "...", "hint": "..."} per offered alternative, IN THE ORDER OFFERED — "text" is a natural, complete sentence answering with that alternative in the user's voice ("It's been pretty mild."), and "hint" is the bare option label ("mild"). Never make "text" the bare label on its own.

THE PARTNER'S OWN ALTERNATIVES ALWAYS TAKE PRECEDENCE over anything you would add. Never drop, merge, or omit one of them to make room for a filler below. If the alternatives exactly fill the palette — four alternatives with ${paletteCap} cells, say — return those alternatives ALONE and no fillers at all. If they somehow exceed ${paletteCap}, return the first ${paletteCap} and no fillers.

THEN, ONLY IF CELLS REMAIN, FILL EVERY ONE, up to ${paletteCap} total. A partner who offers two alternatives leaves two cells free, and leaving them empty wastes what the user can say. Fill them from this list, most useful first — each at most once unless noted:
- {"slot": "CHOICE_OTHER"} — an answer OUTSIDE the offered set: in-between, neither, or it-depends ("It's somewhere between mild and moderate.", "Neither, thanks.", "Honestly, it changes day to day."). Include this whenever a cell is free; a real person's answer often isn't on the menu. Never a bare "I don't know."
- A SECOND {"slot": "CHOICE_OTHER"} — use this when the situation has another obvious answer that isn't in the set. Two-way questions especially ("better or worse?" → "About the same." AND "It comes and goes."). Prefer this over the two below when such an answer genuinely exists; it is usually the most useful thing in a free cell.
- {"slot": "CHOICE_ASK"} — turn the question back or ask for what you need to decide ("What would you recommend?", "What are you having?", "What are my options if neither works?"). Good when the user could reasonably not know or want the partner's steer.
- {"slot": "CHOICE_REPAIR"} — ask the partner to say the choices again ("Sorry, what were the options?"). Include when the alternatives were long, unusual, or may have been misheard.
Every one of these needs the same natural "text" plus a short "hint" (a few words naming it: "in between", "ask them", "say again").

Responses — the four structural slots below apply when "offered_options" is EMPTY (for a closed set, use the CHOICE shape above instead). ALWAYS return all four — even if the turn seems to trail off, is short, or contains filler/disfluencies; the ONLY time you return "responses": [] is when is_repair_initiator is true:
- "hint" is a short glanceable label naming the response (a few words), not a truncation of "text".
- PREFERRED: the most likely thing THIS user would say, delivered plainly, no hedging.
- DISPREFERRED: a properly formed reluctant / declining / disagreeing reply — a brief MEANINGFUL softener that carries content ("I'd love to, but…", "I wish I could —"), the declination, and a short account/reason. Never a bare "No." Keep the account GENERAL or grounded in the profile — do not invent a specific excuse (a named appointment, a concrete prior plan) the user may not actually have; "I'm pretty wiped today" or "it's not really my thing" are safe, "I have a dentist appointment at 3" is fabricated.
- INITIATIVE: a response that stops the user being purely responsive — a counter-offer, a return question, or a topic expansion. Vary its grammatical format (conditional / declarative / interrogative) from the other responses.
- REPAIR: a clarification request on the PARTNER's turn — open-class ("Sorry?") when overall confidence is low, restricted ("Dinner where?") when a specific span is uncertain.

User is leading: if the engine context has "user_holds_floor_to_lead": true, the partner has just RESPONDED to something the USER initiated (an opener or pre-question such as "Can I ask you something?"). The user now holds the floor to LEAD — do NOT generate replies as if answering the partner. Treat the partner's reply, even a short one ("sure", "go ahead", "of course", "any time"), as a go-ahead, not as a question to the user. Generate responses that let the user CONTINUE and lead: PREFERRED advances what the user wanted to say or asks their actual question; INITIATIVE offers a topic or question to raise; DISPREFERRED can gracefully back off ("Actually, never mind"); REPAIR stays a clarification on the partner only if their reply was unclear.

EVERYTHING YOU WRITE WILL BE SPOKEN ALOUD by a speech synthesizer — it is never read on a screen by the partner. Write words exactly as they are SAID. No forms that exist only in writing: no texting abbreviations or initialisms ("fw", "idk", "tbh", "ngl", "imo", "rn", "afaik"), no "w/", "&", "@", "+", "%", no emoji, no stage directions ("*laughs*"), no formatting or quotation marks around the whole line. Spell the words out instead: "I'm into it", never "I fw it". The test is simple — if a speech synthesizer reading it letter for letter would not produce the words you intended, do not write it. This is NOT a register rule: how casual, slangy or formal the user sounds comes from their profile below, and spoken slang ("that's sick", "no worries") is perfectly fine. The rule is only that it must be SAYABLE.

${NO_VULGARITY}

Get to the point: NO response may begin with an empty interjection — no "Ah", "Oh", "Um", "Er", "Well", "So", "Hmm", "You know" at the start. Open with the substance. (A meaningful softener on DISPREFERRED, like "I'd love to, but…", is fine; a bare interjection is not.)

- "missing_facts": lowercase snake_case keys for personal facts about the user you needed but were not given (e.g. "home_city", "fav_team", "occupation"). Use [] if none. Always phrase responses around any missing fact — never output bracketed placeholders.

${perCatBlock}${buildProfileBlock()}`;

    // Everything that can differ between two calls about the SAME partner turn.
    // Sits after the cache breakpoint, so a Feeling tap, a "New N" regenerate, or
    // the next silence checkpoint re-bills only these few hundred tokens.
    const turnPrompt = `${buildSituationBlock()}

Conversation context (engine state — use it, do not echo it):
${JSON.stringify(context)}${avoidBlock}${steerBlock}${focusBlock}`;

    // Two blocks, breakpoint on the first. An empty text block is rejected by the
    // API, so the tail is only appended when it has content (it always does — the
    // engine-context line is unconditional — but the guard costs nothing).
    const system = [{ type: 'text', text: cachedPrompt, cache_control: { type: 'ephemeral' } }];
    if (turnPrompt.trim()) system.push({ type: 'text', text: turnPrompt });

    const messages = conversationHistory.map(entry => ({
        role: entry.role === 'partner' ? 'user' : 'assistant',
        content: entry.text
    }));

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: perCat === 2 ? 1000 : 700,
            system,
            messages
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    trackUsage(data);
    return parseGeneration(data.content[0].text.trim());
}

// Practice Mode (§8): the AI plays the communication PARTNER. Given a scenario
// persona and the conversation so far, produce the partner's next spoken line. The
// ROLES ARE INVERTED from generateResponses — here the model IS the partner, so the
// partner's own prior lines are 'assistant' and the user's responses are 'user'.
// Returns a plain string (the words to speak). Requires a key like any generation.
export async function generatePartnerUtterance(scenario, conversationHistory = []) {
    if (!apiKey) throw new Error('API key not set');

    const systemPrompt = `You are role-playing a communication partner so a non-speaking AAC user can PRACTICE having a conversation. ${scenario.partnerPersona}

The register is: ${scenario.register}.

Produce ONLY your next spoken line, as the partner — the exact words you would say out loud. Rules:
- One short, natural turn (usually one or two sentences). It is spoken aloud, so keep it easy to follow.
- Speak directly to the user in the first person. Use their name only if it is natural.
- Output ONLY the words you speak — no quotation marks, no stage directions, no narration, no role labels.
- React naturally to what the user just said and keep the conversation moving. If the conversation is just beginning, greet them and open the scenario.
- Stay in character and appropriate to the register at all times.

${NO_VULGARITY}`;

    const messages = conversationHistory.map(entry => ({
        role: entry.role === 'partner' ? 'assistant' : 'user',
        content: entry.text
    }));
    // The API requires a non-empty messages array starting with a 'user' turn. When
    // the partner opens (no history, or history that starts with the partner's own
    // line), prime it with a neutral cue so the model produces the opening line.
    if (messages.length === 0 || messages[0].role !== 'user') {
        messages.unshift({ role: 'user', content: '(Begin the conversation.)' });
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 200, system: systemPrompt, messages })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    trackUsage(data);
    let line = data.content[0].text.trim();
    // Strip a stray wrapping pair of quotes the model sometimes adds.
    line = line.replace(/^["'“”']+/, '').replace(/["'“”']+$/, '').trim();
    return line;
}

// Reframe-to-lead (Ken): the user HOLDS THE FLOOR (they just responded, or the
// conversation is between turns) and wants to STEER the conversation somewhere.
// They typed a direction in the "In your own words" box and hit Reframe. Instead
// of replies to a partner, generate STATEMENTS the user could say next to take the
// conversation where they want. Returns { responses:[{slot:'STATEMENT',text,hint}] }
// so it renders one-per-cell like openers/closers. `count` (4 or 8) matches the
// footprint capacity.
export async function generateStatements(steer, conversationHistory = [], context = {}, count = 4) {
    if (!apiKey) throw new Error('API key not set');
    const n = count === 8 ? 8 : 4;

    const contextLines = conversationHistory.slice(-8).map(entry =>
        `${entry.role === 'partner' ? 'Partner' : 'User'}: ${entry.text}`
    ).join('\n');

    const systemPrompt = `You are an AAC assistant speaking AS a non-speaking user in a live conversation. You speak in the user's OWN voice, never as a helpful assistant. The user currently HOLDS THE FLOOR — it is their turn — and they want to LEAD the conversation in a direction. They typed this direction/goal for what they want to say or where they want things to go:
"${steer}"

Generate ${n} distinct STATEMENTS (or questions) the user could say NEXT to move the conversation toward that goal. These are things the USER initiates — NOT answers to a partner's question. Vary them: some plain statements, some questions that open the topic, some gentle lead-ins. Order them best-first.

Speak only to what is real: never invent specific events, outcomes, dates, numbers, or names you were not given. You MAY use standing facts from the user's profile below and the direction they typed (being user-authored, it is TRUE). When a natural statement would need a specific you don't have, keep it general rather than fabricating.

${NO_OUTSIDE_KNOWLEDGE}
The direction the user typed above is the exception that matters most here: whatever they stated in it is theirs to say, so use it in full.

Do not begin any statement with an empty interjection ("Ah", "Oh", "Well", "So", "Hmm"). Open with the substance.

${NO_VULGARITY}

Return ONLY a JSON array of ${n} strings, nothing else. Example: ["...", "...", "..."].

Conversation context (engine state — use it, do not echo it):
${JSON.stringify(context)}${buildProfileBlock()}${buildSituationBlock()}${contextLines ? '\n\nConversation so far:\n' + contextLines : ''}`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 600,
            system: systemPrompt,
            messages: [{ role: 'user', content: steer }]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    trackUsage(data);
    return { responses: parseStatements(data.content[0].text.trim(), n) };
}

// Parse a JSON array of statement strings (tolerating stray prose around it) into
// STATEMENT-slot response descriptors. Falls back to splitting lines if needed.
function parseStatements(text, n) {
    let list = null;
    try { list = JSON.parse(text); } catch { /* try to extract */ }
    if (!Array.isArray(list)) {
        const m = text.match(/\[[\s\S]*\]/);
        if (m) { try { list = JSON.parse(m[0]); } catch { /* fall through */ } }
    }
    if (!Array.isArray(list)) {
        // Last resort: non-empty lines, stripped of list markers/quotes.
        list = text.split('\n').map(s => s.replace(/^\s*[-*\d.]*\s*/, '').replace(/^["']|["']$/g, '').trim()).filter(Boolean);
    }
    if (!Array.isArray(list) || !list.length) throw new Error('Could not parse statements from API');
    return list.slice(0, n).map(t => ({ slot: 'STATEMENT', text: String(t).trim(), hint: '' })).filter(m => m.text);
}

// Repair-of-self (design §7.2): the partner asked the user to repeat/clarify.
// Re-speak verbatim needs no LLM (the app handles it); this call covers the
// "rephrase" and "expand" operations on the user's own last utterance.
export async function repairSelf(lastUserUtterance, op, conversationHistory = []) {
    if (!apiKey) throw new Error('API key not set');
    const instruction = op === 'expand'
        ? 'Expand and clarify the following thing the user just said, adding a little more detail so it is clearer. Keep it natural and in the user\'s own voice.'
        : 'Rephrase the following thing the user just said so it means the same but is worded differently and may be clearer. Keep it natural and in the user\'s own voice.';

    const contextLines = conversationHistory.slice(-4).map(entry =>
        `${entry.role === 'partner' ? 'Partner' : 'User'}: ${entry.text}`
    ).join('\n');

    const systemPrompt = `You are an AAC assistant speaking AS a non-speaking user. The partner did not understand the user's last spoken turn. ${instruction}

${REWORD_ONLY}

${NO_VULGARITY}

Return ONLY the new utterance text, nothing else.${buildProfileBlock()}${buildSituationBlock()}${contextLines ? '\n\nConversation so far:\n' + contextLines : ''}`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 200,
            system: systemPrompt,
            messages: [{ role: 'user', content: lastUserUtterance }]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    trackUsage(data);
    return data.content[0].text.trim();
}

// Pre-generate BOTH repair-of-self rewordings in ONE call (Ken, July 8 2026), so
// the Rephrase and Expand cards can show their real, immediately-speakable text
// instead of a hint + a post-tap round-trip. Fired when the partner asks the user
// to repeat ("What?"). Returns { rephrase, expand } (either '' if parsing failed).
// Re-speak needs no LLM (it's the user's last utterance verbatim), so it's not here.
export async function repairOptions(lastUserUtterance, conversationHistory = []) {
    if (!apiKey) throw new Error('API key not set');

    const contextLines = conversationHistory.slice(-4).map(entry =>
        `${entry.role === 'partner' ? 'Partner' : 'User'}: ${entry.text}`
    ).join('\n');

    const systemPrompt = `You are an AAC assistant speaking AS a non-speaking user. The partner did not understand the user's last spoken turn, so the user may want to say it again a different way. Produce TWO alternatives to the user's last utterance, both in the user's own voice:
- "rephrase": the same meaning, worded differently and possibly clearer. Same length or shorter.
- "expand": the same point with a little more detail added, so it is clearer.

${REWORD_ONLY}

${NO_VULGARITY}

Return ONLY a JSON object, no other text: {"rephrase": "...", "expand": "..."}${buildProfileBlock()}${buildSituationBlock()}${contextLines ? '\n\nConversation so far:\n' + contextLines : ''}`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 300,
            system: systemPrompt,
            messages: [{ role: 'user', content: lastUserUtterance }]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    trackUsage(data);
    return parseRepairOptions(data.content[0].text.trim());
}

function parseRepairOptions(text) {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* fall through */ } }
    }
    if (parsed && typeof parsed === 'object') {
        return {
            rephrase: typeof parsed.rephrase === 'string' ? parsed.rephrase.trim() : '',
            expand: typeof parsed.expand === 'string' ? parsed.expand.trim() : '',
        };
    }
    return { rephrase: '', expand: '' };
}

// Robustly parse the structured generation output. Tolerates a bare array or a
// legacy {options:[...]} object (older builds / best-effort) by mapping it onto
// the slot palette, plus stray prose around the JSON object.
function parseGeneration(text) {
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch {
        const obj = text.match(/\{[\s\S]*\}/);
        const arr = text.match(/\[[\s\S]*\]/);
        if (obj) { try { parsed = JSON.parse(obj[0]); } catch { /* fall through */ } }
        if (!parsed && arr) { try { parsed = JSON.parse(arr[0]); } catch { /* fall through */ } }
    }

    const SLOTS = ['PREFERRED', 'DISPREFERRED', 'INITIATIVE', 'REPAIR'];

    // Legacy: a bare array of option strings.
    if (Array.isArray(parsed)) {
        return {
            classification: null,
            responses: parsed.map((t, i) => ({ slot: SLOTS[i] || 'PREFERRED', text: String(t), hint: '' })),
            missingFacts: [],
        };
    }

    if (parsed && typeof parsed === 'object') {
        const classification = {
            partner_action: parsed.partner_action || (parsed.classification && parsed.classification.fpp) || 'OTHER',
            turn_status: parsed.turn_status || 'COMPLETE',
            is_repair_initiator: !!parsed.is_repair_initiator,
            // The closed set of alternatives the partner offered ("mild, moderate,
            // severe"), [] for an ordinary turn. Drives the CHOICE palette.
            offered_options: arr(parsed.offered_options).map((o) => String(o).trim()).filter(Boolean),
        };
        // Preferred shape: typed responses.
        if (Array.isArray(parsed.responses)) {
            return { classification, responses: parsed.responses, missingFacts: arr(parsed.missing_facts) };
        }
        // Legacy {options:[...]}.
        if (Array.isArray(parsed.options)) {
            return {
                classification,
                responses: parsed.options.map((t, i) => ({ slot: SLOTS[i] || 'PREFERRED', text: String(t), hint: '' })),
                missingFacts: arr(parsed.missing_facts),
            };
        }
    }
    throw new Error('Could not parse responses from API');
}

function arr(v) { return Array.isArray(v) ? v : []; }
