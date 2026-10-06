// AUTHORED experiment material for the "review by moment" test (October 6 2026).
// Question: if review lessons are kept per person and tagged with the moment, as in
// TODO.md "Rebuild review around tapping", do later suggestions to that person get
// closer to how the user talks with them than (a) no review and (b) today's review?
//
// Everything here is invented by the evaluating agent: the review answers, the held-out
// Mom reference (shown ONLY to the judge), and the new Mom turns. A positive result
// shows the app can carry a lesson to a new, similar moment. It cannot show that the
// app finds a real person's voice.

// Six review lessons from the three Mom conversations in test-data-folder. `key` is the
// turn's key in the conversation file; `action` is what Mom was doing (not saved in the
// file today, so tagged by hand here); `spoken` is what the user said at the time;
// `chosen` is what the user picked or typed in review as closer to how they talk to her.
export const LESSONS = [
    { convo: '2026-09-13T12-12-30', key: '2026-09-13T12:12:32.800Z', action: 'asked a question',
      partner: 'Morning. Did you sleep any better last night?',
      spoken: 'Not really. It was a rough one.',
      chosen: "I'm okay. Woke up a couple times." },
    { convo: '2026-09-13T12-12-30', key: '2026-09-13T12:12:44.100Z', action: 'made an offer',
      partner: 'Oh no. Do you want to skip swim today?',
      spoken: 'No, I still want to go.',
      chosen: "Nah, I wanna go. I'll be fine." },
    { convo: '2026-09-13T12-12-30', key: '2026-09-13T12:12:51.300Z', action: 'asked him to do something',
      partner: 'Okay. Eat something before you go, please.',
      spoken: 'OK',
      chosen: "Yeah yeah. I'll grab a granola bar." },
    { convo: '2026-09-17T12-08-00', key: '2026-09-17T12:08:02.800Z', action: 'asked a question',
      partner: 'Chair is charged. Do you have everything?',
      spoken: 'Did you see my charger?',
      chosen: 'Pretty sure. Wait, where is my charger?' },
    { convo: '2026-10-01T12-15-00', key: '2026-10-01T12:15:02.800Z', action: 'complained',
      partner: 'Ms. Whitaker emailed me about the competition. You did not tell me.',
      spoken: 'I wanted to fix it before anybody read it.',
      chosen: "I know, sorry. I was gonna tell you once it was good." },
    { convo: '2026-10-01T12-15-00', key: '2026-10-01T12:15:15.800Z', action: 'praised him',
      partner: 'Marc. It was the best one in the class.',
      spoken: 'Can you read it and tell me?',
      chosen: 'Okay, okay. Thanks, Mom. Can you read it?' },
];

// Held-out reference: how Marc talks with his mom. Shown to the judge only.
export const MOM_REFERENCE = [
    "I'm fine, Mom. Just tired.",
    'Yeah, I ate. Promise.',
    "Kinda? It was alright.",
    'Love you too. Go to bed.',
    "Mom. I'm good. Really.",
    'Can we talk about it after dinner?',
    'Thanks. That helps.',
    'Not yet. Tomorrow, okay?',
    "It's just a cold, I'm fine.",
    "Okay okay, I'm getting up.",
];

// New Mom turns, none of them in the test data. The action is the judge's and the
// analysis's label only; the generator is never told it.
export const MOM_TURNS = [
    { id: 'M1-test', action: 'asked a question', text: "You're home early. How'd the chemistry test go?" },
    { id: 'M2-quiet', action: 'asked a question', text: 'Hey, you seem kind of quiet tonight. Everything okay?' },
    { id: 'M3-dishes', action: 'asked him to do something', text: 'Can you put your dishes in the sink before you go up, please?' },
    { id: 'M4-ride', action: 'made an offer', text: "Do you want me to drive you to Devon's tomorrow?" },
    { id: 'M5-abuela', action: 'shared news', text: "Abuela called. She's coming for dinner on Sunday." },
    { id: 'M6-proud', action: 'praised him', text: "I saw your report card. I'm really proud of you." },
    { id: 'M7-late', action: 'complained', text: 'You were up gaming until two again. I heard you.' },
    { id: 'M8-morning', action: 'greeted him', text: 'Morning, sweetheart.' },
].map((t) => ({ ...t, personId: 'p-elena', who: 'his mom' }));

// Other people, to see whether Mom lessons leak to them under today's review.
export const OTHER_TURNS = [
    { id: 'O1-devon', personId: 'p-devon', who: 'his best friend Devon', text: 'yo you getting on tonight? we need a fourth for squads' },
    { id: 'O2-stranger', placeId: 'pl-gino-s-pizza', who: 'a stranger at the pizza counter', text: 'Nice hat. Packers fan? Rough game Sunday, huh?' },
];

// The lesson text placed in the situation block when the user is talking with Mom.
// PAIRED: what Mom was doing and saying, what was spoken, what the user chose.
export function pairedLessonBlock(lessons) {
    const rows = lessons.map((l) =>
        `- Mom ${l.action}: "${l.partner}" Said at the time: "${l.spoken}" Closer to how this user talks with her: "${l.chosen}"`);
    return [
        'How this user answers Mom, from their own review of earlier conversations with her. Each line shows what she was doing and saying, what was said at the time, and the words this user chose afterward as closer to how they talk with her.',
        ...rows,
        'Use these as evidence of how this user talks with Mom: length, tone, and what comes first. Draw most on the ones where she was doing what she is doing now. Do not reuse their wording; this turn is about something else.',
    ].join('\n');
}

// BARE: the same words the user chose, with nothing around them.
export function bareLessonBlock(lessons) {
    return [
        'Things this user has said to Mom, from their own review of earlier conversations with her:',
        ...lessons.map((l) => `- "${l.chosen}"`),
        'Use these as evidence of how this user talks with Mom. Do not reuse their wording.',
    ].join('\n');
}
