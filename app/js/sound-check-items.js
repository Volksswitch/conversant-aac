/* Sound Check — the forced-choice item bank (Sounds Like Me, Phase 1).
 * Ken, August 7 2026.
 *
 * Twelve items. Each shows a made-up thing a partner said and three ways of replying
 * that MEAN THE SAME and differ only in wording. The user picks one; the sentence
 * they pick becomes an exemplar in the voice block, which is what teaches the model
 * to write in their words rather than its own.
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
};

export const SOUND_CHECK_ITEMS = [
    {
        id: 'economy-weekend', dimension: 'economy', leads: 'short',
        stipulate: 'Suppose your weekend was a good one.',
        partner: 'How was your weekend?',
        candidates: [
            'Good, thanks.',
            'Good, thanks. Quiet one.',
            'It was good, thanks — quiet, but that suited me.',
        ],
    },
    {
        id: 'economy-decided', dimension: 'economy', leads: 'long',
        stipulate: 'Suppose you have not made your mind up yet.',
        partner: 'Have you thought any more about what you want to do?',
        candidates: [
            'Not properly yet, no — I keep meaning to sit down and work it out.',
            'Not properly yet, no.',
            'Not yet.',
        ],
    },
    {
        id: 'economy-queue', dimension: 'economy', leads: 'middle',
        stipulate: 'Suppose you do not mind waiting.',
        partner: "There's a bit of a queue today, I'm afraid.",
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
            'Oh, lovely. Thanks.',
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
            'Oh, whereabouts?',
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
        partner: 'Right, I should let you go.',
        candidates: [
            'It was really good to talk to you. Take care.',
            'Good to talk to you. Bye.',
            'Okay, bye.',
        ],
    },
];

export const VERDICT = { CHOSE: 'chose', ALL_FINE: 'all-fine', NONE: 'none' };

export function getItem(id) {
    return SOUND_CHECK_ITEMS.find((it) => it.id === id) || null;
}
