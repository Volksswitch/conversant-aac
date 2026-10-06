/* Sound Check — the forced-choice item bank (Sounds Like Me, Phase 1).
 * Ken, August 7 2026.
 *
 * Twenty items. Each shows three ways of saying the same thing that differ only in
 * wording. The user picks one; the sentence they pick becomes an exemplar in the
 * voice block, which is what teaches the model to write in their words rather than
 * its own.
 *
 * Most items give a partner turn and ask how the user would reply. The `initiate-`
 * items have no partner turn and measure how the user starts things, which is the
 * text the app writes for openers, the INITIATIVE slot and wind-downs; `questionFor`
 * asks them the right question.
 *
 * ── THE FOUR AUTHORING RULES. Break any one and the instrument stops measuring. ──
 *
 * 1. HAND-AUTHORED, NEVER MODEL-GENERATED. Generating candidates at run time would
 *    limit the instrument to discovering which corner of the MODEL's own range the
 *    user prefers, which is not the question. It is also the only way to guarantee
 *    rule 2 actually holds.
 *
 * 2. CONTENT HELD CONSTANT ACROSS THE THREE. If the candidates differ in meaning the
 *    user chooses on meaning and we learn nothing about wording. This is the single
 *    easiest rule to break while writing what feel like natural alternatives.
 *
 * 3. CONTENT HELD FREE OF THE USER (Ken, August 7 2026). The candidates are written
 *    with no knowledge of the user, because that is not their purpose. Two reasons,
 *    and the second is the one that bites: a candidate mentioning something the user
 *    actually likes invites them to pick on "yes, that's true of me" rather than on
 *    wording — rule 2 broken from the other direction; and the chosen sentence is
 *    handed to the model, where a specific would read as autobiography and violate
 *    the anti-fabrication rule. So: no names, places, jobs, hobbies, relationships,
 *    or health details anywhere in this file. The prompt says so too (voice.js), but
 *    a prompt should not have to carry content it does not control.
 *
 * 4. EVERY CANDIDATE MUST BE SPEAKABLE AND CLEAN. These are spoken aloud by a
 *    synthesizer, so no texting shorthand (the 0.6.5 "I fw it" finding), and no
 *    vulgarity while that remains off.
 *
 * ── WHY EACH ITEM STIPULATES ITS CONTENT ──
 *
 * `stipulate` settles what is true BEFORE the user reads the candidates ("Suppose
 * your weekend was a good one"). Without it a user reasonably answers on truth —
 * "but my weekend wasn't quiet, so not that one" — and the answer is about their
 * life rather than their voice. A warning would ask them to suppress that reading;
 * stipulating removes it, leaving wording as the only axis left to answer on.
 *
 * ── ON THE ORDER OF THE CANDIDATES ──
 *
 * Fixed per item, never shuffled: this population benefits from predictability, and
 * a re-ordering between visits would make a half-finished module confusing. Position
 * bias is instead controlled by ALTERNATING which end of the dimension leads, item to
 * item — see `leads` on each. Keep that alternation if you add items, or every
 * first-position tap will quietly agree with the same end of every scale.
 */

// What each item is probing. From the five ways two factually identical replies can
// still be different people (Sounds Like Me, Table 1).
export const DIMENSIONS = {
    economy:   'How much they say to convey the same thing.',
    formality: 'Formal and full, or contracted and casual.',
    affect:    'Whether feeling is named outright or left implied.',
    floor:     'Whether a reply hands the conversation back or lets it rest.',
    warmth:    'Whether warmth is marked in words or left to be understood.',
    // Only appears in INITIATING items: you cannot vary the imposition of a request
    // you are not making. The classic negative-politeness axis (Brown & Levinson),
    // which the project already leans on for the DISPREFERRED slot's hedge+account
    // rule and in the Reframe redirect taxonomy.
    directness: 'How directly they ask for something, versus hedging the imposition.',
    // Added August 8 2026, and it exists because a DESCRIPTION of humor was measured
    // not to be enough. Module B2 asks what someone's sense of humor is and whether
    // they want lighter suggestions; that reliably decides WHETHER to go light, and
    // reliably fails to produce anything actually funny — a model told "witty and
    // sarcastic" writes "my history knowledge is patchy". Few-shot beats description
    // for style by a wide margin (Sounds Like Me §10), so the key has to be shown,
    // not named. These items are where it gets shown.
    levity: 'Whether an awkward moment is met flatly or brushed off with a remark.',
};

/*
 * Wording changed on October 5 2026 (CR-191): several candidates read as British
 * ("lovely", "mind you", "whereabouts"), and a chosen candidate is sent to the AI
 * as the user's own wording. Each kept its length and its place in the item, so
 * the item still measures what it did. voice.js maps a stored answer that still
 * carries the old text onto the new one, so nobody loses their answer.
 */
export const RENAMED_CANDIDATES = {
    "Good, thanks. Quiet one.": "Good, thanks. Pretty quiet.",
    "It was good, thanks — quiet, but that suited me.": "It was good, thanks — quiet, but I liked that.",
    "Not properly yet, no — I keep meaning to sit down and work it out.": "Not really, no — I keep meaning to sit down and figure it out.",
    "Not properly yet, no.": "Not really, no.",
    "Oh, lovely. Thanks.": "Oh, great. Thanks.",
    "Oh, whereabouts?": "Oh, where to?",
    "I don't suppose you could help me?": "I hate to ask, but could you help me?",
    "Right, I'd better go.": "Okay, I'd better go.",
    "I should get going - this has been lovely.": "I should get going - this has been great.",
    "No idea, I'm afraid.": "No idea, sorry.",
    "It's fine. I was starting to plan my escape, mind you.": "It's fine. I was starting to plan my escape, though.",
};

export const SOUND_CHECK_ITEMS = [
    {
        id: 'economy-weekend', dimension: 'economy', leads: 'short',
        stipulate: 'Suppose your weekend was a good one.',
        partner: 'How was your weekend?',
        candidates: [
            'Good, thanks.',
            'Good, thanks. Pretty quiet.',
            'It was good, thanks — quiet, but I liked that.',
        ],
    },
    {
        id: 'economy-decided', dimension: 'economy', leads: 'long',
        stipulate: 'Suppose you have not made your mind up yet.',
        partner: 'Have you thought any more about what you want to do?',
        candidates: [
            'Not really, no — I keep meaning to sit down and figure it out.',
            'Not really, no.',
            'Not yet.',
        ],
    },
    {
        id: 'economy-queue', dimension: 'economy', leads: 'middle',
        stipulate: 'Suppose you do not mind waiting.',
        partner: "There's a bit of a wait today, sorry.",
        candidates: [
            "That's fine, no rush.",
            "That's fine.",
            "That's fine — I'm in no particular hurry.",
        ],
    },
    {
        id: 'formality-late', dimension: 'formality', leads: 'formal',
        stipulate: 'Suppose you are not annoyed about it.',
        partner: "Sorry I'm late.",
        candidates: [
            "That is quite all right. Please don't worry.",
            "That's all right, don't worry about it.",
            'No worries.',
        ],
    },
    {
        id: 'formality-sit', dimension: 'formality', leads: 'casual',
        stipulate: 'Suppose you would like to sit down.',
        partner: 'Would you like to sit down?',
        candidates: [
            'Yeah, thanks.',
            'Yes please, thanks.',
            'Thank you, I would.',
        ],
    },
    {
        id: 'affect-coffee', dimension: 'affect', leads: 'implied',
        stipulate: 'Suppose you are pleased about it.',
        partner: 'I brought you a coffee.',
        candidates: [
            'Oh, great. Thanks.',
            "Thanks, that's kind of you.",
            "That's really thoughtful, thank you.",
        ],
    },
    {
        id: 'affect-finished', dimension: 'affect', leads: 'explicit',
        stipulate: 'Suppose this is good news to you.',
        partner: "I've finished that thing you asked about.",
        candidates: [
            "Oh good, I'm really pleased. Thank you.",
            "That's great news, thank you.",
            'Great, thanks.',
        ],
    },
    {
        id: 'floor-busy', dimension: 'floor', leads: 'closes',
        stipulate: 'Suppose your week has been busy too.',
        partner: "It's been a busy week.",
        candidates: [
            'Same here.',
            'Same here. Busy with what?',
            'Same here — how are you coping?',
        ],
    },
    {
        id: 'floor-trip', dimension: 'floor', leads: 'returns',
        stipulate: 'Suppose you are glad to hear it.',
        partner: "I've just got back from a trip.",
        candidates: [
            'Oh, where to?',
            'That sounds nice. Where did you go?',
            'That sounds nice.',
        ],
    },
    {
        id: 'floor-decision', dimension: 'floor', leads: 'closes',
        stipulate: 'Suppose you think it is a big decision.',
        partner: "I'm thinking of changing jobs.",
        candidates: [
            "That's a big decision.",
            "That's a big decision. What's brought that on?",
            "That's a big decision — how are you feeling about it?",
        ],
    },
    {
        id: 'warmth-next-week', dimension: 'warmth', leads: 'plain',
        stipulate: 'Suppose you are happy to see them again.',
        partner: "I'll see you next week, then.",
        candidates: [
            'See you then.',
            'See you then, take care.',
            'See you then — looking forward to it.',
        ],
    },
    {
        id: 'warmth-let-you-go', dimension: 'warmth', leads: 'warm',
        stipulate: 'Suppose you have enjoyed the conversation.',
        partner: 'Well, I should let you go.',
        candidates: [
            'It was really good to talk to you. Take care.',
            'Good to talk to you. Bye.',
            'Okay, bye.',
        ],
    },

    // -- INITIATING ITEMS (no `partner` -- nobody has spoken) ------------------
    // These close the gap noted at the top. `questionFor` drops "in response" for
    // them, and the renderer omits the partner line. Placed at the END as a coherent
    // group so anyone part-way through the responsive set keeps their place.
    {
        id: 'initiate-opener', dimension: 'economy', leads: 'short',
        stipulate: 'Suppose you want to start a conversation with someone you know.',
        candidates: [
            'Hi.',
            'Hi, how are you?',
            'Hi - good to see you. How have you been?',
        ],
    },
    {
        id: 'initiate-help', dimension: 'directness', leads: 'direct',
        stipulate: 'Suppose you need someone to help you with something.',
        candidates: [
            'Can you help me?',
            'Would you mind helping me?',
            'I hate to ask, but could you help me?',
        ],
    },
    {
        id: 'initiate-slow-down', dimension: 'directness', leads: 'indirect',
        stipulate: 'Suppose you want the other person to slow down.',
        candidates: [
            'Would you mind slowing down a little?',
            'Could you slow down a bit?',
            'Slow down a bit, please.',
        ],
    },
    {
        id: 'initiate-disagree', dimension: 'affect', leads: 'hedged',
        stipulate: 'Suppose you do not agree with what is being suggested.',
        candidates: [
            "I'm not sure about that.",
            "I'm not convinced, to be honest.",
            "I don't think so, no.",
        ],
    },
    {
        id: 'initiate-leaving', dimension: 'warmth', leads: 'plain',
        stipulate: 'Suppose you need to bring the conversation to an end.',
        candidates: [
            "Okay, I'd better go.",
            'I should get going.',
            'I should get going - this has been great.',
        ],
    },
    // The three levity items. All hold the CONTENT fixed at "I do not have this" or
    // "that went wrong" and vary only how lightly it is met, so a choice here is
    // about manner and nothing else. `leads` alternates across them.
    {
        id: 'levity-dontknow', dimension: 'levity', leads: 'flat', light: [2],
        stipulate: 'Suppose you genuinely do not know the answer.',
        partner: 'Do you happen to know what year that happened?',
        candidates: [
            "No, I don't know that one.",
            'No idea, sorry.',
            'Not a clue. That one left my head a long time ago.',
        ],
    },
    {
        id: 'levity-mishap', dimension: 'levity', leads: 'light', light: [0, 1],
        stipulate: 'Suppose you have just knocked something over, and no harm is done.',
        partner: 'Oh — are you okay?',
        candidates: [
            'Well, that went beautifully.',
            "Fine, thanks. Not my finest moment.",
            "Fine, thanks. Sorry about that.",
        ],
    },
    {
        id: 'levity-late', dimension: 'levity', leads: 'flat', light: [1, 2],
        stipulate: 'Suppose you have been kept waiting a while and you do not really mind.',
        partner: "Sorry, I've kept you waiting forever.",
        candidates: [
            "It's fine, honestly.",
            "It's fine - I had nowhere better to be.",
            "It's fine. I was starting to plan my escape, though.",
        ],
    },
];

/**
 * Was this answer to a levity item one of the LIGHTER replies? Choosing a flat reply is
 * the opposite of permission to be light (CR-052).
 *
 * Each levity item lists its lighter candidates in `light`, by position. They used to be
 * inferred as "everything except the one flat reply", which was wrong for
 * levity-dontknow: "No idea, sorry." is the TERSE flat reply, not a joke, and picking it
 * told the AI a joking response suited the user - for exactly the plain-spoken user who
 * picks it (found by the October 6 2026 evaluation; 3 of the 10 test personas chose it).
 * Give every new levity item a `light` list.
 */
export function isLighterChoice(item, text) {
    if (!item || item.dimension !== 'levity') return false;
    const i = item.candidates.indexOf(text);
    if (i < 0) return false;
    if (Array.isArray(item.light)) return item.light.includes(i);
    const flat = item.leads === 'light' ? item.candidates.length - 1 : 0;
    return i !== flat;
}

function wordCount(text) {
    return (String(text || '').match(/[A-Za-z0-9']+/g) || []).length;
}

// Below this many decided brevity answers, a lean is noise.
const MIN_DECIDED_FOR_LEAN = 3;

/**
 * Length preference from the brevity ("economy") items. This is the cleanest length
 * evidence the app has, because each item holds the content constant and varies only
 * how much is said - unlike a live pick, where the four response options are four
 * different kinds of reply and differ in length for that reason alone.
 *
 * `answers` is the stored soundCheck map (itemId -> { choice }). A pick of the item's
 * shortest candidate counts as shorter, its longest as longer, anything else as level.
 * Same shape as voice-harvest.measureLengthLean, so the two can be compared.
 */
export function soundCheckLengthLean(answers = {}) {
    let shorter = 0, longer = 0, level = 0;
    for (const item of SOUND_CHECK_ITEMS) {
        if (item.dimension !== 'economy') continue;
        const a = answers && answers[item.id];
        const i = a && a.choice ? item.candidates.indexOf(a.choice) : -1;
        if (i < 0) continue;
        const counts = item.candidates.map(wordCount);
        const n = counts[i];
        if (n === Math.min(...counts)) shorter++;
        else if (n === Math.max(...counts)) longer++;
        else level++;
    }
    const decided = shorter + longer;
    if (decided < MIN_DECIDED_FOR_LEAN) return null;
    let lean = 'neither';
    if (shorter / decided >= 0.75) lean = 'shorter';
    else if (longer / decided >= 0.75) lean = 'longer';
    return { lean, shorter, longer, level, total: shorter + longer + level };
}

/**
 * The question asked above the candidates. It FOLLOWS THE ITEM rather than being one
 * fixed string, because responding and initiating are different tasks and the stem
 * should say which is being asked (Ken, August 7 2026).
 *
 * Every item in the bank today carries a partner turn, so every item today gets the
 * "in response" form — which is the accurate one, and reinforces that the sentence
 * above is what they are replying to. An item WITHOUT a partner turn ("Suppose you
 * want to ask someone for help") is a different question, and this is what stops it
 * silently inheriting the wrong stem.
 */
export function questionFor(item) {
    return item && item.partner
        ? 'Which of these sounds most like something you would say in response?'
        : 'Which of these sounds most like something you would say?';
}

export const VERDICT = { CHOSE: 'chose', ALL_FINE: 'all-fine', NONE: 'none' };

export function getItem(id) {
    return SOUND_CHECK_ITEMS.find((it) => it.id === id) || null;
}
