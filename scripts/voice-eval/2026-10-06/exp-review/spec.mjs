// AUTHORED experiment material (by the evaluating agent, not by the project):
//  - simulated review answers in Marc's voice (closer / reword / typed)
//  - a held-out "Marc voice reference" (12 lines) used ONLY by the judge
//  - 8 held-out partner turns, plus 2 turns for the context-targeted variant.
// Review answers use kinds: closer = setCardAnswer(index) on a card the user did NOT
// take live; reword = setCardAnswer(index, newText); typed = setTypedAnswer(text).

export const REVIEWS = {
    // A — Devon, best friend (K=1)
    '2026-09-16T03-05-10': [
        { key: '2026-09-16T03:05:12.800Z', kind: 'closer', index: 2 },
        { key: '2026-09-16T03:05:18.800Z', kind: 'closer', index: 1 },
        { key: '2026-09-16T03:05:38.100Z', kind: 'typed', text: "Rainbow Road? Bold choice. Hope you like losing twice." },
        { key: '2026-09-16T03:12:49.900Z', kind: 'typed', text: "Rigged my foot. Run it back, I'm warmed up now." },
    ],
    // B — Owen, stranger at school (K=3)
    '2026-09-27T17-41-00': [
        { key: '2026-09-27T17:41:02.800Z', kind: 'reword', index: 2, text: "Long story. Ask me something better and I'll actually answer." },
        { key: '2026-09-27T17:41:16.800Z', kind: 'closer', index: 1 },
        { key: '2026-09-27T17:41:30.600Z', kind: 'closer', index: 1 },
        { key: '2026-09-27T17:41:39.200Z', kind: 'typed', text: "Marc. With a C. Sit with us tomorrow if you want, we don't bite." },
    ],
    // C — Ms. Whitaker, teacher (K=3)
    '2026-09-22T16-35-00': [
        { key: '2026-09-22T16:35:02.800Z', kind: 'closer', index: 2 },
        { key: '2026-09-22T16:35:15.300Z', kind: 'reword', index: 0, text: "Yeah, I'm in. Thanks, Ms. Whitaker." },
        { key: '2026-09-22T16:35:30.200Z', kind: 'typed', text: "Okay, but I'm fixing the third paragraph first. It's bugging me." },
    ],
    // D — Devon (K=10)
    '2026-09-24T02-20-00': [
        { key: '2026-09-24T02:20:02.800Z', kind: 'closer', index: 0 },
        { key: '2026-09-24T02:20:10.700Z', kind: 'closer', index: 0 },
        { key: '2026-09-24T02:20:20.700Z', kind: 'typed', text: "Wait, you actually checked? Okay, that's kind of clutch. Thanks, man." },
    ],
    // E — Sof, sister (K=10)
    '2026-09-29T23-38-00': [
        { key: '2026-09-29T23:38:02.800Z', kind: 'reword', index: 1, text: "Nice try. She didn't say that." },
        { key: '2026-09-29T23:38:10.000Z', kind: 'closer', index: 1 },
        { key: '2026-09-29T23:38:18.500Z', kind: 'typed', text: "Deal. Prepare to lose, small child." },
    ],
    // F — Mom (K=10)
    '2026-09-13T12-12-30': [
        { key: '2026-09-13T12:12:32.800Z', kind: 'reword', index: 0, text: "Kinda. Woke up a couple times." },
        { key: '2026-09-13T12:12:44.100Z', kind: 'closer', index: 1 },
        { key: '2026-09-13T12:12:51.300Z', kind: 'typed', text: "Yeah yeah. I'll grab a granola bar." },
    ],
    // G — Abuela (K=10)
    '2026-09-19T22-44-00': [
        { key: '2026-09-19T22:44:09.500Z', kind: 'closer', index: 2 },
        { key: '2026-09-19T22:44:21.800Z', kind: 'reword', index: 0, text: "It's good, Abuela. English is my favorite class this year." },
        { key: '2026-09-19T22:44:38.800Z', kind: 'closer', index: 0 },
        { key: '2026-09-19T22:44:50.300Z', kind: 'typed', text: "Gracias, Abuela. I'll bring it Sunday so you can see." },
    ],
    // H — Dr. Aldrich (K=10)
    '2026-09-23T19-05-00': [
        { key: '2026-09-23T19:05:02.800Z', kind: 'reword', index: 0, text: "Tighter than before. Mornings are the worst." },
        { key: '2026-09-23T19:05:36.200Z', kind: 'closer', index: 2 },
        { key: '2026-09-23T19:05:56.000Z', kind: 'closer', index: 2 },
        { key: '2026-09-23T19:06:17.400Z', kind: 'typed', text: "Thanks. It happens a lot, so I'm used to it." },
    ],
    // I — Gino's counter, stranger (K=10)
    '2026-09-28T22-14-00': [
        { key: '2026-09-28T22:14:02.800Z', kind: 'closer', index: 2 },
        { key: '2026-09-28T22:14:13.800Z', kind: 'closer', index: 0 },
        { key: '2026-09-28T22:14:23.300Z', kind: 'typed', text: "Cool, thanks. Keep the change." },
    ],
    // J — Coach Bea (K=10)
    '2026-09-21T21-22-00': [
        { key: '2026-09-21T21:47:08.200Z', kind: 'typed', text: "Maybe. You said eight, I heard ten." },
        { key: '2026-09-21T21:47:15.900Z', kind: 'closer', index: 0 },
        { key: '2026-09-21T21:47:24.200Z', kind: 'reword', index: 2, text: "Probably. Can I tell you Thursday?" },
    ],
};

// Closer-only version of the K=3 set (A, B, C): every answered turn that has cards is
// turned into a closer mark on the card nearest the intent; card-less turns dropped.
export const REVIEWS_CLOSER_ONLY = {
    '2026-09-16T03-05-10': [
        { key: '2026-09-16T03:05:12.800Z', kind: 'closer', index: 2 },
        { key: '2026-09-16T03:05:18.800Z', kind: 'closer', index: 1 },
        { key: '2026-09-16T03:05:38.100Z', kind: 'closer', index: 2 },
    ],
    '2026-09-27T17-41-00': [
        { key: '2026-09-27T17:41:02.800Z', kind: 'closer', index: 2 },
        { key: '2026-09-27T17:41:16.800Z', kind: 'closer', index: 1 },
        { key: '2026-09-27T17:41:30.600Z', kind: 'closer', index: 1 },
        { key: '2026-09-27T17:41:39.200Z', kind: 'closer', index: 1 },
    ],
    '2026-09-22T16-35-00': [
        { key: '2026-09-22T16:35:02.800Z', kind: 'closer', index: 2 },
        { key: '2026-09-22T16:35:15.300Z', kind: 'closer', index: 0 },
        { key: '2026-09-22T16:35:30.200Z', kind: 'closer', index: 0 },
    ],
};

// Context-targeted correction: a reviewed Mom conversation where the user rewords two
// cards to be warmer. Nothing else is reviewed.
export const REVIEWS_MOM_WARM = {
    '2026-10-01T12-15-00': [
        { key: '2026-10-01T12:15:02.800Z', kind: 'reword', index: 1, text: "Sorry, Mom. I wanted to fix it first. I was gonna tell you, promise." },
        { key: '2026-10-01T12:15:15.800Z', kind: 'reword', index: 1, text: "Thanks, Mom. That honestly means a lot." },
    ],
};

export const K_SETS = {
    K1: ['2026-09-16T03-05-10'],
    K3: ['2026-09-16T03-05-10', '2026-09-27T17-41-00', '2026-09-22T16-35-00'],
    K10: Object.keys(REVIEWS),
};

// Held-out reference — AUTHORED by the evaluating agent from the persona description
// (persona-data.js: 17, Madison WI, witty, sarcastic, competitive, gamer, Packers).
// Shown to the judge only; never to the generator.
export const REFERENCE = [
    "Nah, I'm good. Maybe next time.",
    "Bro. That pass was criminal.",
    "Yeah, got it. Thanks though.",
    "I'm not mad, I'm just disappointed in your aim.",
    "Honestly? Pretty tired. Long day.",
    "Packers by ten. Write it down.",
    "Sure, if you're buying.",
    "That's fair. Kind of rude, but fair.",
    "Don't help, I'm almost there.",
    "Biscuit ate my homework. For real this time.",
    "Cool. See you Saturday.",
    "Wait, what? Back up.",
];

export const HELD_OUT = [
    { id: 'H1-mom-test', personId: 'p-elena', who: 'his mom', text: "You're home early. How'd the chemistry test go?" },
    { id: 'H2-mom-quiet', personId: 'p-elena', who: 'his mom', text: "Hey, you seem kind of quiet tonight. Everything okay?" },
    { id: 'H3-devon-squads', personId: 'p-devon', who: 'his best friend Devon', text: "yo you getting on tonight? we need a fourth for squads" },
    { id: 'H4-sof-homework', personId: 'p-sofia', who: 'his younger sister Sofia', text: "can you help me with my math homework. please. i'm begging" },
    { id: 'H5-stranger-way', who: 'a stranger in a hallway', text: "Oh, sorry, am I in your way? Do you need me to move?" },
    { id: 'H6-stranger-packers', placeId: 'pl-gino-s-pizza', who: 'a stranger at the pizza counter', text: "Nice hat. Packers fan? Rough game Sunday, huh?" },
    { id: 'H7-whitaker', personId: 'p-ms-whitaker', placeId: 'pl-west-high-school', who: 'his English teacher, Ms. Whitaker', text: "Marc, the district results came back. Can you stay after class for a minute?" },
    { id: 'H8-stranger-inspiration', who: 'a stranger on the street', text: "Wow, you're such an inspiration, getting out and about like this." },
];

// Variant (b): later Mom turn + later stranger turn.
export const VARIANT_B = [
    HELD_OUT[1],
    { id: 'S1-stranger-wait', placeId: 'pl-gino-s-pizza', who: 'a stranger working the pizza counter', text: "Sorry about the wait tonight, we're short a cook. You doing okay?" },
];
