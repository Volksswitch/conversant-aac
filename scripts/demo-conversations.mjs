/* Three weeks of Marc's conversations, in a compact authoring format.
 *
 * WHY THESE ARE WORTH AUTHORING AT ALL. The conversation files are not decoration on a
 * demo profile - they are the only thing several features have to read. The usage
 * summary, the weekly report's headline numbers, the voice harvest (which learns his
 * style from sentences he actually chose and composed), the rejected-option corpus and
 * the future relive-and-critique feature all work off `conversations/*.json` and
 * nothing else. A profile with no conversations leaves every one of them showing an
 * empty state.
 *
 * THE STANDARD THEY ARE WRITTEN TO is Ken's, September 10 2026: can the conversation and
 * the actions within the app be recreated to the second from what is recorded? So these
 * carry what the real app carries - the context the conversation started in and every
 * change to it, every set of cards with how long it was up and how it ended, which card
 * was taken and from which category, what the app said aloud to hold the floor, the
 * microphone going on and off, and an error interleaved in time order.
 *
 * ⚠ WHAT IS DELIBERATELY REPRESENTED, because a run of tidy successes would be a
 * useless corpus:
 *   - offers replaced before he touched them (`superseded`) - measured at 47% of sets on
 *     one real tester's twenty minutes, so this is the normal case and not an edge one;
 *   - offers he gave up on and typed instead (`composer`);
 *   - a closed-set turn, where the partner's own alternatives become the cards;
 *   - a repair, where he asked the other person to say it again;
 *   - a rate-limit error mid-conversation;
 *   - one practice-mode conversation, stamped so it is reviewable but never mistaken
 *     for a real one;
 *   - and a stretch where he answers with Express Panel buttons and no AI at all.
 *
 * TURN FORMAT - expanded by make-demo-import.mjs, which owns the clock:
 *   ['event', kind, extra?]
 *   ['partner', rawText, { uncertain?, gap? }?]
 *   ['offer', kind, [[slot, text], ...], outcome, selectedIndex?, shownMs?]
 *   ['ph', text, n]                                   what the app said to hold the floor
 *   ['user', text, { source, slot?, index?, decideMs?, spokenText?, fellBack?, options? }]
 *   ['error', context, message]
 *   ['context', trigger]                              a Context-band value changed
 *   ['gap', seconds]                                  dead air, no entry written
 */

// Four structural cards, the shape the app offers on an ordinary turn.
const four = (pref, dis, init, rep) => [
    ['PREFERRED', pref], ['DISPREFERRED', dis], ['INITIATIVE', init], ['REPAIR', rep],
];

export const CONVERSATIONS = [

    /* 1 -------------------------------------------------------------------------
     * Monday breakfast. Mom. Short, because she is worried and short answers land
     * better - which is exactly what her partner note says.
     */
    {
        at: '2026-08-24T12:12:30.000Z',
        partner: 'Elena', place: null, feeling: 'Wiped',
        turns: [
            ['event', 'listen on'],
            ['partner', 'Morning. Did you sleep any better last night?'],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', four(
                'A bit better, yeah.',
                'Not really. It was a rough one.',
                'What time did you get up?',
                'Sorry, did you say last night?',
            ), 'card', 1, 5200],
            ['user', 'Not really. It was a rough one.', { source: 'card', slot: 'DISPREFERRED', index: 1, decideMs: 5200 }],
            ['partner', 'Oh no. Do you want to skip swim today?'],
            ['offer', 'ai', four(
                'No, I still want to go.',
                'Maybe. Can I decide after school?',
                'Is Coach Bea even there today?',
                'Skip what, sorry?',
            ), 'card', 0, 3100],
            ['user', 'No, I still want to go.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 3100 }],
            ['partner', 'Okay. Eat something before you go, please.'],
            ['user', 'OK', { source: 'express' }],
            ['event', 'listen off'],
        ],
    },

    /* 2 -------------------------------------------------------------------------
     * Wednesday night, gaming with Devon. Fast, and the set gets replaced twice
     * while Devon keeps talking - the common case, not an edge one. He asks for
     * different options once, then steers for something shorter.
     */
    {
        at: '2026-08-27T03:05:10.000Z',
        partner: 'Devon', place: null, feeling: 'Pumped',
        turns: [
            ['event', 'listen on'],
            ['partner', 'okay that last race was'],
            ['offer', 'ai', four(
                'That was a good one.',
                'That was rough.',
                'Run it again?',
                'Say that again?',
            ), 'superseded', null, 2400],
            ['partner', 'okay that last race was completely rigged you know that right'],
            ['ph', 'Give me a second.', 1],
            ['offer', 'ai', four(
                'Rigged. Sure.',
                'It was not rigged, you just lost.',
                'Rematch. Right now.',
                'Rigged how?',
            ), 'regenerate', null, 6800],
            ['event', 'generation requested', { reason: 'regenerate' }],
            ['offer', 'ai', four(
                'Cry about it.',
                'You had a blue shell. That is on you.',
                'Best of three. Go.',
                'What was rigged about it?',
            ), 'card', 0, 4400],
            ['user', 'Cry about it.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 4400 }],
            ['partner', 'wow. okay. rematch then, but you are picking Rainbow Road'],
            ['offer', 'ai', four(
                'Rainbow Road it is.',
                'Not Rainbow Road. Anything but that.',
                'Loser picks next track.',
                'Which track?',
            ), 'reframe', null, 3900],
            ['event', 'reframe', { text: 'shorter' }],
            ['offer', 'ai', four(
                'Done.',
                'Nope.',
                'Loser picks next.',
                'Which one?',
            ), 'card', 0, 1800],
            ['user', 'Done.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 1800 }],
            ['gap', 420],
            ['partner', 'told you. rigged'],
            ['user', 'No way', { source: 'express' }],
            ['event', 'listen off'],
        ],
    },

    /* 3 -------------------------------------------------------------------------
     * Saturday at the comic shop. Ramon puts three issues on the table, so the four
     * structural cards are abandoned for that turn and the cards become the choices -
     * plus an escape hatch for an answer outside the set.
     */
    {
        at: '2026-08-29T19:31:00.000Z',
        partner: 'Ramon', place: 'Pulp Comics', feeling: 'Chill',
        goals: [{ id: '', text: 'Find out what came in for my pull list', source: 'place' }],
        turns: [
            ['event', 'listen on'],
            ['offer', 'opener', [
                ['OPENER', 'Ramon. Anything for me?'],
                ['OPENER', 'Hey Ramon. Got a second?'],
                ['OPENER', 'Guess what, Ramon.'],
                ['OPENER', 'Hi Ramon, got a minute?'],
            ], 'card', 0, 2600],
            ['user', 'Ramon. Anything for me?', { source: 'card', slot: 'OPENER', index: 0, decideMs: 2600 }],
            ['partner', 'Three things came in for you. The new Spider-Man, the Ms. Marvel annual, and that Daredevil trade you asked about. Which do you want today?'],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', [
                ['CHOICE', 'The Spider-Man, please.'],
                ['CHOICE', 'The Ms. Marvel annual.'],
                ['CHOICE', 'The Daredevil trade.'],
                ['CHOICE_OTHER', 'All three, if you can hold them.'],
            ], 'choice chip', null, 7100],
            ['event', 'generation requested', { reason: 'choice chip' }],
            ['offer', 'ai', four(
                'All three, if you can hold them.',
                'Just the Spider-Man today.',
                'Can I put the other two on my tab?',
                'How much for all three?',
            ), 'card', 2, 5300],
            ['user', 'Can I put the other two on my tab?', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 5300 }],
            ['partner', 'Course you can. Your mom already told me to do that.'],
            ['offer', 'ai', four(
                'Of course she did.',
                'She did not need to do that.',
                'Do not tell her I said thanks.',
                'She told you what?',
            ), 'card', 0, 2900],
            ['user', 'Of course she did.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 2900 }],
            ['partner', 'Same time next week?'],
            ['offer', 'closing', [
                ['CLOSING', 'Later.'],
                ['CLOSING', 'See ya.'],
                ['CLOSING', 'Bye!'],
                ['CLOSING_DECLINE', 'Wait - one thing.'],
            ], 'card', 0, 2100],
            ['user', 'Later.', { source: 'card', slot: 'CLOSING', index: 0, decideMs: 2100 }],
            ['event', 'listen off'],
        ],
    },

    /* 4 -------------------------------------------------------------------------
     * Sunday dinner at Abuela's. She speaks Spanish, he answers in English, and he is
     * politer here than anywhere - his note says never sarcastic with Abuela, and
     * nothing in this conversation is. Longer turns, because his register for her is
     * "fuller".
     */
    {
        at: '2026-08-30T22:44:00.000Z',
        partner: 'Rosa', place: 'Abuela’s house', feeling: 'Chill',
        goals: [{ id: 'reassure', text: 'Reassure them I am committed', source: 'partner' }],
        turns: [
            ['event', 'listen on'],
            ['offer', 'opener', [
                ['OPENER', 'Hola, Abuela.'],
                ['OPENER', 'Abuela, it smells amazing in here.'],
                ['OPENER', 'Hi Abuela, got a minute?'],
                ['OPENER', 'Good to see you, Abuela.'],
            ], 'card', 1, 4800],
            ['user', 'Abuela, it smells amazing in here.', { source: 'card', slot: 'OPENER', index: 1, decideMs: 4800 }],
            ['partner', 'Mijo! Ay, que bueno. Sientate, sientate. You are too thin.'],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', four(
                'I have been eating, I promise.',
                'I am the same as I was last week.',
                'What did you make?',
                'Sorry, say that again?',
            ), 'card', 0, 6200],
            ['user', 'I have been eating, I promise.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 6200 }],
            ['partner', 'Bueno. And school? How is school going for you this year?'],
            ['ph', 'Hang on, I am typing.', 1],
            ['ph', 'Still typing.', 2],
            ['offer', 'ai', four(
                'It is going well. English is my favorite this year.',
                'It is a lot. Junior year is heavier than I expected.',
                'How is your knee doing?',
                'School this year, or last year?',
            ), 'card', 0, 8900],
            ['user', 'It is going well. English is my favorite this year.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 8900 }],
            ['partner', 'English! Your mother told me. She said your teacher likes you.'],
            ['offer', 'ai', four(
                'Ms. Whitaker is the best teacher I have had.',
                'She is nice to everybody, it is not just me.',
                'Did Mom tell you I got an A on the essay?',
                'Which teacher?',
            ), 'card', 2, 7400],
            ['user', 'Did Mom tell you I got an A on the essay?', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 7400 }],
            ['partner', 'An A! No, she did not tell me that. Marcos, that is wonderful.'],
            ['offer', 'ai', four(
                'Thank you, Abuela.',
                'It was only one essay.',
                'I will bring it next Sunday so you can read it.',
                'Say that again?',
            ), 'card', 2, 5100],
            ['user', 'I will bring it next Sunday so you can read it.', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 5100 }],
            ['gap', 900],
            ['partner', 'Okay, mijo. Go, go. Your mother is waiting in the car.'],
            ['offer', 'windDown', [
                ['WIND_DOWN', 'I should let you sit down.'],
                ['WIND_DOWN', 'I gotta go.'],
                ['WIND_DOWN', 'This was good. I am out of steam though.'],
                ['WIND_DOWN', 'I should get going.'],
            ], 'card', 0, 3400],
            ['user', 'I should let you sit down.', { source: 'card', slot: 'WIND_DOWN', index: 0, decideMs: 3400 }],
            ['offer', 'closing', [
                ['CLOSING', 'Te quiero, Abuela.'],
                ['CLOSING', 'Bye, Abuela.'],
                ['CLOSING', 'Later.'],
                ['CLOSING_DECLINE', 'Wait - one thing.'],
            ], 'card', 0, 2200],
            ['user', 'Te quiero, Abuela.', { source: 'card', slot: 'CLOSING', index: 0, decideMs: 2200 }],
            ['event', 'listen off'],
        ],
    },

    /* 5 -------------------------------------------------------------------------
     * Tuesday, adaptive swim. Almost no AI at all - Coach Bea asks short questions and
     * he answers off the Express Panel and the Flex band. This is what a lot of real
     * use looks like and it is worth having in the corpus: the app earning its place
     * without a single round trip.
     */
    {
        at: '2026-09-01T21:22:00.000Z',
        partner: 'Coach Bea', place: 'The YMCA', feeling: 'Pumped',
        turns: [
            ['event', 'listen on'],
            ['partner', 'There he is. Same as last week?'],
            ['user', 'Same as last week', { source: 'express' }],
            ['partner', 'Eight lengths and then we talk about the relay. Ready?'],
            ['user', 'Yes', { source: 'express' }],
            ['gap', 1500],
            ['partner', 'That was nine, not eight. You showing off?'],
            ['offer', 'ai', four(
                'Maybe a little.',
                'I lost count.',
                'One more lap.',
                'Nine what?',
            ), 'card', 0, 3600],
            ['user', 'Maybe a little.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 3600 }],
            ['partner', 'Good. I want you on the relay in October. Think about it.'],
            ['offer', 'ai', four(
                'I am in.',
                'Let me think about it.',
                'Who else is on it?',
                'The relay in October?',
            ), 'card', 2, 4200],
            ['user', 'Who else is on it?', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 4200 }],
            ['partner', 'You, Marissa, and two from the Tuesday group. Same time, extra half hour.'],
            ['offer', 'ai', four(
                'I am in.',
                'I need to check with my mom first.',
                'Can I tell you Thursday?',
                'Extra half hour on top?',
            ), 'card', 0, 2700],
            ['user', 'I am in.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 2700 }],
            ['event', 'listen off'],
        ],
    },

    /* 6 -------------------------------------------------------------------------
     * Thursday at the rehab clinic. The hardest conversation in the set and the one
     * carrying the most: a general goal switched on to answer for himself, a closed
     * set he refuses to accept ("mild, moderate or severe" when none of them fit), a
     * steer telling the app not to soften it, and a rate-limit error in the middle.
     *
     * Private by default is NOT used here on purpose - a conversation he asked not to
     * save would write nothing at all, so it could not appear in a file like this.
     */
    {
        at: '2026-09-03T19:05:00.000Z',
        partner: 'Dr. Aldrich', place: 'The rehab clinic', feeling: 'Annoyed',
        goals: [
            { id: '', text: 'Answer the questions myself instead of letting Mom answer', source: 'place' },
            { id: '', text: 'Be taken seriously as the person answering', source: 'general' },
        ],
        turns: [
            ['event', 'listen on'],
            ['partner', 'Good afternoon. So how has the left side been since we changed the dose?'],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', four(
                'Tighter than before, especially in the morning.',
                'Honestly, I cannot tell a difference yet.',
                'How long should it take to know?',
                'Since we changed what?',
            ), 'card', 0, 9800],
            ['user', 'Tighter than before, especially in the morning.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 9800 }],
            ['partner', 'And the pain with it - would you say mild, moderate, or severe?'],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', [
                ['CHOICE', 'Mild.'],
                ['CHOICE', 'Moderate.'],
                ['CHOICE', 'Severe.'],
                ['CHOICE_OTHER', 'It moves around. Some mornings it is bad and by lunch it is nothing.'],
            ], 'card', 3, 11400],
            ['user', 'It moves around. Some mornings it is bad and by lunch it is nothing.', { source: 'card', slot: 'CHOICE_OTHER', index: 3, decideMs: 11400 }],
            ['partner', 'That is useful, thank you. Can you show me how far you can turn it?'],
            ['error', 'generateResponses', 'API error 429: rate_limit_error'],
            ['offer', 'ai', four(
                'About this far. That is where it stops.',
                'Not much further than that.',
                'It was further than this last month.',
                'Turn which way?',
            ), 'reframe', null, 8200],
            ['event', 'reframe', { text: 'say it hurts, do not soften it' }],
            ['offer', 'ai', four(
                'That far, and it hurts the whole way.',
                'I can do it but I do not want to.',
                'It hurts more than it did last month.',
                'Turn which way?',
            ), 'card', 0, 4600],
            ['user', 'That far, and it hurts the whole way.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 4600 }],
            ['partner', 'Okay. Mom, has he been doing the stretches at home?'],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', four(
                'You can ask me. I have been doing them.',
                'Most days. Not every day.',
                'Ask me, not her.',
                'Say that again?',
            ), 'composer', null, 14700],
            ['event', 'composer opened'],
            ['user', 'I am right here. Ask me and I will tell you - I did them every day except Sunday.', { source: 'composed', decideMs: 14700 }],
            ['partner', 'You are absolutely right, I apologize. Every day except Sunday, noted.'],
            ['offer', 'ai', four(
                'Thank you.',
                'It happens a lot.',
                'Can we do the same again next time?',
                'Noted for what?',
            ), 'card', 0, 3300],
            ['user', 'Thank you.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 3300 }],
            ['event', 'listen off'],
        ],
    },

    /* 7 -------------------------------------------------------------------------
     * Monday lunch, a new kid at school asks the question Marc's About Me explicitly
     * says he would rather not be asked - and the app offers him a way to decline
     * without ending the conversation. The DISPREFERRED slot doing the exact job it
     * exists for.
     */
    {
        at: '2026-09-07T17:41:00.000Z',
        partner: null, place: 'West High School', feeling: 'Annoyed',
        goals: [{ id: '', text: 'Be taken seriously as the person answering', source: 'general' }],
        turns: [
            ['event', 'listen on'],
            ['partner', 'hey so uh can i ask what happened to you', { uncertain: ['uh'] }],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', four(
                'I have cerebral palsy. I was born with it.',
                'I would rather not get into that. What class do you have next?',
                'Ask me something else and I will actually answer it.',
                'Happened to me how?',
            ), 'card', 1, 7900],
            ['user', 'I would rather not get into that. What class do you have next?', { source: 'card', slot: 'DISPREFERRED', index: 1, decideMs: 7900 }],
            ['partner', 'oh sorry. uh chemistry. you?'],
            ['offer', 'ai', four(
                'English. Whitaker.',
                'Chemistry is the one class I am bad at.',
                'Who do you have for chemistry?',
                'Which class?',
            ), 'card', 0, 3100],
            ['user', 'English. Whitaker.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 3100 }],
            ['partner', 'she is supposed to be good right'],
            ['offer', 'ai', four(
                'She is the best teacher in the building.',
                'She is fine. People oversell her.',
                'Do you know anybody in her class?',
                'Supposed to be what?',
            ), 'superseded', null, 3000],
            ['partner', 'she is supposed to be good right my sister had her and said she was pretty strict though'],
            ['offer', 'ai', four(
                'She is strict, but she is worth it.',
                'Strict is not the word I would use.',
                'Who is your sister?',
                'Strict how?',
            ), 'card', 0, 4500],
            ['user', 'She is strict, but she is worth it.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 4500 }],
            ['partner', 'cool. i am Owen by the way'],
            ['offer', 'ai', four(
                'Marc.',
                'Marc. People spell it with a K and it is not.',
                'Sit here tomorrow if you want.',
                'Sorry, what was it?',
            ), 'card', 2, 5600],
            ['user', 'Sit here tomorrow if you want.', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 5600 }],
            ['event', 'listen off'],
        ],
    },

    /* 8 -------------------------------------------------------------------------
     * Friday night, Sofia. Short, teasing, and the one that shows a repair: the
     * microphone mishears her and he asks her to say it again rather than guessing.
     * His Flex list for her and the Always band do most of the work.
     */
    {
        at: '2026-09-12T02:51:00.000Z',
        partner: 'Sofia', place: null, feeling: 'Over it',
        turns: [
            ['event', 'listen on'],
            ['partner', 'did you take my charger again', { uncertain: ['charger'] }],
            ['offer', 'ai', four(
                'No.',
                'I borrowed it. It is right here.',
                'Why would I need yours?',
                'Say that again?',
            ), 'ask them to repeat', null, 4100],
            ['user', 'Say that again?', { source: 'control' }],
            ['partner', 'my charger. did you take it'],
            ['offer', 'ai', four(
                'It is on my desk.',
                'I did not touch it.',
                'Check the kitchen.',
                'Which charger?',
            ), 'card', 0, 2800],
            ['user', 'It is on my desk.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 2800 }],
            ['partner', 'I knew it. You always do this'],
            ['offer', 'ai', four(
                'I always give it back.',
                'You left it in my room. That is on you.',
                'Get your own.',
                'Do what?',
            ), 'card', 1, 3300],
            ['user', 'You left it in my room. That is on you.', { source: 'card', slot: 'DISPREFERRED', index: 1, decideMs: 3300 }],
            ['partner', 'whatever. mom says come eat'],
            ['user', 'Go away.', { source: 'express' }],
            ['event', 'listen off'],
        ],
    },

    /* 9 -------------------------------------------------------------------------
     * Two minutes at the pizza counter. Transactional, with a place goal switched on -
     * the half of Marc's life the app exists to widen, and the one the four structural
     * cards matter least for.
     */
    {
        at: '2026-09-08T22:14:00.000Z',
        partner: null, place: 'Gino’s Pizza', feeling: 'Pumped',
        goals: [{ id: '', text: 'Order a pepperoni slice and a root beer', source: 'place' }],
        turns: [
            ['event', 'listen on'],
            ['partner', 'What can I get you?'],
            ['ph', 'Give me a second.', 1],
            ['offer', 'ai', four(
                'A pepperoni slice and a root beer, please.',
                'Give me a minute to decide.',
                'What do you have that is hot right now?',
                'Sorry, what was that?',
            ), 'card', 0, 4900],
            ['user', 'A pepperoni slice and a root beer, please.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 4900 }],
            ['partner', 'Two slices for the price of one today if you want.'],
            ['offer', 'ai', [
                ['CHOICE', 'Two slices, then.'],
                ['CHOICE', 'Just the one, thanks.'],
                ['CHOICE_OTHER', 'Two, but can you box the second one?'],
                ['CHOICE_ASK', 'What is the deal exactly?'],
            ], 'card', 2, 5400],
            ['user', 'Two, but can you box the second one?', { source: 'card', slot: 'CHOICE_OTHER', index: 2, decideMs: 5400 }],
            ['partner', 'Sure thing. Five eighty.'],
            ['user', 'Thank you', { source: 'express' }],
            ['event', 'listen off'],
        ],
    },

    /* 11-17 ---------------------------------------------------------------------
     * Short ones, and they are here for a reason the usage summary made obvious rather
     * than for bulk: with one conversation per person, "people you talked to more than
     * once" came out at ZERO, which is not what three weeks of a 17-year-old's life
     * looks like. Anybody real talks to their mother repeatedly and to the pharmacist
     * once. These are the repeats, at the length most real exchanges actually are.
     */
    {
        at: '2026-08-25T23:40:00.000Z',
        partner: 'Ray', place: null, feeling: 'Pumped',
        turns: [
            ['event', 'listen on'],
            ['partner', 'You watching this? They are going for it on fourth down.'],
            ['offer', 'ai', four(
                'No way they make this.',
                'They are going to make it.',
                'Put it on in here.',
                'Fourth down from where?',
            ), 'card', 0, 3400],
            ['user', 'No way they make this.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 3400 }],
            ['partner', 'They made it!'],
            ['user', 'No way', { source: 'express' }],
            ['event', 'listen off'],
        ],
    },
    {
        at: '2026-08-28T12:08:00.000Z',
        partner: 'Elena', place: null, feeling: 'Wiped',
        turns: [
            ['event', 'listen on'],
            ['partner', 'Chair is charged. Do you have everything?'],
            ['offer', 'ai', four(
                'I think so.',
                'Hang on, let me check.',
                'Did you see my charger?',
                'Everything for what?',
            ), 'card', 2, 4100],
            ['user', 'Did you see my charger?', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 4100 }],
            ['partner', 'Sofia had it. It is in your bag.'],
            ['user', 'Thank you', { source: 'express' }],
            ['event', 'listen off'],
        ],
    },
    {
        at: '2026-09-02T16:35:00.000Z',
        partner: 'Ms. Whitaker', place: 'West High School', feeling: 'Curious',
        goals: [{ id: 'information', text: 'Get information or advice', source: 'partner' }],
        turns: [
            ['event', 'listen on'],
            ['partner', 'Marc, I wanted to talk to you about the essay. Do you have a minute before the bell?'],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', four(
                'Yes, I have a few minutes.',
                'Can it wait until tomorrow? I have to get to chemistry.',
                'Is something wrong with it?',
                'About the essay?',
            ), 'card', 0, 6400],
            ['user', 'Yes, I have a few minutes.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 6400 }],
            ['partner', 'It was the strongest one in the class. I want to enter it in the district competition, if you are willing.'],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', four(
                'I am willing. Thank you.',
                'I would rather not have it read by strangers.',
                'What would I have to do?',
                'Enter it in what?',
            ), 'card', 2, 8800],
            ['user', 'What would I have to do?', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 8800 }],
            ['partner', 'Nothing. I submit it, and we hear back in October.'],
            ['offer', 'ai', four(
                'Then yes. Go ahead.',
                'Let me think about it overnight.',
                'Can I fix the third paragraph first?',
                'Hear back when?',
            ), 'card', 2, 7200],
            ['user', 'Can I fix the third paragraph first?', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 7200 }],
            ['event', 'listen off'],
        ],
    },
    {
        at: '2026-09-04T02:20:00.000Z',
        partner: 'Devon', place: null, feeling: 'Chill',
        turns: [
            ['event', 'listen on'],
            ['partner', 'you going to the thing saturday'],
            ['offer', 'ai', four(
                'What thing?',
                'Probably not.',
                'Saturday is comic shop day.',
                'Which Saturday?',
            ), 'card', 2, 3800],
            ['user', 'Saturday is comic shop day.', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 3800 }],
            ['partner', 'after that. aisha is having people over'],
            ['offer', 'ai', four(
                'Then yeah, I am in.',
                'I will probably be wiped by then.',
                'Is her place step-free?',
                'People over where?',
            ), 'card', 2, 5900],
            ['user', 'Is her place step-free?', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 5900 }],
            ['partner', 'yeah her basement door is flat. i checked'],
            ['offer', 'ai', four(
                'You checked? Thanks, man.',
                'I still might not make it.',
                'Tell her I am coming.',
                'Checked what?',
            ), 'card', 0, 4200],
            ['user', 'You checked? Thanks, man.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 4200 }],
            ['event', 'listen off'],
        ],
    },
    {
        at: '2026-09-06T23:15:00.000Z',
        partner: 'Aisha', place: null, feeling: 'Pumped',
        turns: [
            ['event', 'listen on'],
            ['partner', 'Devon said you were coming. I am really glad.'],
            ['offer', 'ai', four(
                'Me too. Thanks for checking about the door.',
                'I said probably.',
                'Who else is going to be there?',
                'Coming where?',
            ), 'card', 0, 5300],
            ['user', 'Me too. Thanks for checking about the door.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 5300 }],
            ['partner', 'Of course. Is there anything else you need me to sort out?'],
            ['offer', 'ai', four(
                'No, that was the only thing.',
                'A bathroom I can get into would help.',
                'Somewhere I can park the chair out of the way.',
                'Sort out what?',
            ), 'composer', null, 12600],
            ['event', 'composer opened'],
            ['user', 'Just somewhere to park the chair where nobody trips on it. That is honestly it.', { source: 'composed', decideMs: 12600 }],
            ['partner', 'Easy. Done.'],
            ['event', 'listen off'],
        ],
    },
    {
        at: '2026-09-09T23:38:00.000Z',
        partner: 'Sofia', place: null, feeling: 'Annoyed',
        turns: [
            ['event', 'listen on'],
            ['partner', 'mom says you have to let me use the tv'],
            ['offer', 'ai', four(
                'Fine. Twenty minutes.',
                'She did not say that.',
                'Go ask her again with me here.',
                'Use the what?',
            ), 'card', 1, 3100],
            ['user', 'She did not say that.', { source: 'card', slot: 'DISPREFERRED', index: 1, decideMs: 3100 }],
            ['partner', 'okay she did not but I asked first'],
            ['offer', 'ai', four(
                'Twenty minutes. Then it is mine.',
                'You did not ask first.',
                'Loser of one race gets it.',
                'Asked what first?',
            ), 'card', 2, 4400],
            ['user', 'Loser of one race gets it.', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 4400 }],
            ['partner', 'deal'],
            ['user', 'Awesome', { source: 'express' }],
            ['event', 'listen off'],
        ],
    },
    {
        at: '2026-09-11T12:15:00.000Z',
        partner: 'Elena', place: null, feeling: 'Chill',
        turns: [
            ['event', 'listen on'],
            ['partner', 'Ms. Whitaker emailed me about the competition. You did not tell me.'],
            ['ph', 'Hang on, I am typing.', 1],
            ['offer', 'ai', four(
                'I was going to.',
                'I wanted to fix it before anybody read it.',
                'Do not tell Abuela yet.',
                'Emailed you about what?',
            ), 'card', 1, 6900],
            ['user', 'I wanted to fix it before anybody read it.', { source: 'card', slot: 'DISPREFERRED', index: 1, decideMs: 6900 }],
            ['partner', 'Marc. It was the best one in the class.'],
            ['offer', 'ai', four(
                'The third paragraph is still weak.',
                'Okay. Thank you.',
                'Can you read it and tell me?',
                'Best at what?',
            ), 'card', 2, 5600],
            ['user', 'Can you read it and tell me?', { source: 'card', slot: 'INITIATIVE', index: 2, decideMs: 5600 }],
            ['partner', 'I would love to. Send it to me.'],
            ['user', 'OK', { source: 'express' }],
            ['event', 'listen off'],
        ],
    },

    /* 10 ------------------------------------------------------------------------
     * A practice run, stamped so it is reviewable but unmistakable. There is no
     * microphone in practice mode, so there are no listening events and the partner is
     * the AI playing a scenario.
     */
    {
        at: '2026-09-05T00:28:00.000Z',
        practice: 'Ordering at a coffee shop',
        partner: null, place: null, feeling: 'Curious',
        turns: [
            ['partner', 'Hi there, what can I get started for you?'],
            ['offer', 'ai', four(
                'A hot chocolate, please.',
                'I am still looking, sorry.',
                'What is the biggest size you do?',
                'Sorry, say that again?',
            ), 'card', 0, 5700],
            ['user', 'A hot chocolate, please.', { source: 'card', slot: 'PREFERRED', index: 0, decideMs: 5700 }],
            ['partner', 'Any size preference? We have small, medium, and large.'],
            ['offer', 'ai', [
                ['CHOICE', 'Small, please.'],
                ['CHOICE', 'Medium, please.'],
                ['CHOICE', 'Large, please.'],
                ['CHOICE_OTHER', 'Whatever is easiest for you.'],
            ], 'card', 2, 3800],
            ['user', 'Large, please.', { source: 'card', slot: 'CHOICE', index: 2, decideMs: 3800 }],
            ['partner', 'Large hot chocolate. Can I get a name for the cup?'],
            ['offer', 'ai', four(
                'Marc.',
                'Marc. With a C.',
                'Do you need it spelled?',
                'A name for what?',
            ), 'reframe', null, 6100],
            ['event', 'reframe', { text: 'funnier' }],
            ['offer', 'ai', four(
                'Marc. With a C, like the good one.',
                'Marc. You will spell it wrong anyway.',
                'Put whatever you want, I will answer to it.',
                'A name for what?',
            ), 'card', 1, 3200],
            ['user', 'Marc. You will spell it wrong anyway.', { source: 'card', slot: 'DISPREFERRED', index: 1, decideMs: 3200 }],
            ['partner', 'Ha. Fair enough. That will be right out.'],
            ['offer', 'closing', [
                ['CLOSING', 'Later.'],
                ['CLOSING', 'See ya.'],
                ['CLOSING', 'Thanks!'],
                ['CLOSING_DECLINE', 'Wait - one thing.'],
            ], 'card', 2, 2400],
            ['user', 'Thanks!', { source: 'card', slot: 'CLOSING', index: 2, decideMs: 2400 }],
        ],
    },
];
