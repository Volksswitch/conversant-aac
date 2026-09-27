/* The parts of a lived-in user that the test personas do not carry.
 *
 * `scripts/doc-generators/persona-data.js` already holds ten personas with About Me
 * answers, people, places and Sound Check picks, and this file does NOT duplicate any
 * of that - it adds the layers that only exist once somebody has actually used the app
 * for a few weeks: how they talk with each person, what they want out of each
 * relationship, what their Express Panel looks like after they edited it, the control
 * and placeholder phrases they reworded, the respellings they fixed, and a run of real
 * conversations.
 *
 * ⚠ KEYED BY PERSONA ID, one entry per persona, so a second persona can be given the
 * same depth later without this file changing shape. Only Marc is filled in today.
 *
 * WHOSE VOICE THIS IS. Marc is 17, in Madison, Wisconsin, witty and competitive, short
 * with his words, and quickest to anger at being talked about rather than to. Every
 * phrase, goal and conversation here is written to sound like him and to agree with his
 * Sound Check picks (he chose the SHORT candidate on nearly every economy item), his
 * humor answers (witty and sarcastic, cheeky responses welcome), and his register
 * answers (relaxed with family and friends, guarded with strangers, formal with a
 * doctor). Consistency across those layers is the whole point of the file - it is what
 * makes it useful for judging whether the app reads a coherent person correctly.
 */

// --- Marc Delgado -------------------------------------------------------------

const marc = {
    // Answers for the modules the persona document does not cover, plus the two
    // fields deliberately left UNANSWERED so the gaps log below has something true
    // to point at. A profile with every single question answered is not typical.
    /* Answers here that deliberately REPLACE the persona sheet's, each with the reason.
     *
     * ⚠ EVERY ENTRY CARRIES ITS REASON, because a list of names rots into a list nobody
     * dares change - the same rule the settings hold-back lists follow. Anything not
     * listed here that disagrees with the persona sheet is reported as drift between two
     * sources of truth, which is what it would be. */
    overrides: {
        nickname: 'the sheet writes it as prose ("Marc (his gaming friends call him '
            + '\'Speedy\')"), which is right for a document and wrong for a field the app '
            + 'uses as a name - it would be read out whole. The question asks what he '
            + 'likes to be called, so it holds the one word.',
    },

    extraTopics: {
        nickname: 'Speedy',
        // A6 Health & Safety. Private by default in the registry, which is right: a
        // paramedic asking is a prompt, a stranger at the comic shop is not.
        health_allergies: ['Penicillin', 'Bee stings'],
        health_meds: ['Baclofen, twice a day', 'Vitamin D'],
        health_conditions: [
            'Cerebral palsy - spastic, affects all four limbs',
            'I use a power wheelchair',
            'I have a seizure history - last one was years ago',
        ],
        health_diet: ['Nothing I have to avoid', 'I just will not eat olives'],
        emergency_contact: 'Mom - Elena Delgado, (608) 555-0143',
        // (No `email` here on purpose - the persona sheet already carries it, and a
        // second copy is a second thing to keep in step. It only ever looked missing
        // because it used to be on the `unanswered` list.)
        //
        // Consistent with the age and birth year on the persona sheet: born March 2009,
        // so he is 17 in September 2026. A demo profile whose own dates disagree is
        // worse than one missing a field, because nothing on screen says which is right.
        date_of_birth: 'March 14, 2009',
        // C2 expertise. Scoped tight on purpose: the honesty rule lifts its ban on
        // supplying facts only INSIDE the subjects the user named, so a wide claim
        // here would let the app put guesses in his mouth about anything nearby.
        expertise: [
            'Marvel comics - Spider-Man continuity especially',
            'Mario Kart tracks and shortcuts',
            'The Packers roster and their schedule',
            'Setting up a game controller for one-handed play',
        ],
    },

    // ⚠ NOTHING IS LEFT UNANSWERED (Ken, September 12 2026: he wants About Me filled in
    // as far as it goes). Every one of the 74 questions About Me asks is either answered
    // or, in one case, declined.
    //
    // What that costs, stated once because it is not obvious: a GAP only stays live
    // while its field is unanswered, so a fully answered profile has an empty gaps log
    // by construction and "Questions worth answering" is correctly empty. The gaps
    // feature is still demonstrated, but through `extras` below - the questions real
    // conversations asked that About Me has no field for at all, which is the half of
    // that feature a full profile cannot make stale.
    unanswered: [],

    /* Declined - sticky, never asked again, never sent to the AI.
     *
     * ⚠ THE ONE FIELD NOT ANSWERED, AND IT IS MARC'S OWN ANSWER RATHER THAN A GAP. The
     * persona sheet says "Prefer not to say" to where he leans politically, so filling
     * it in would contradict the persona this file exists to represent - and a decline
     * is not a blank: the question has been dealt with and will never be asked again.
     * It is also the only thing in the file exercising the third privacy level. */
    declined: ['b5_politics_lean'],

    // Privacy overrides, deliberately in BOTH directions so the three-level model is
    // exercised rather than just described.
    privacy: {
        // Registry default is private. Marc wants his number given out - his friends
        // ask for it constantly and he is tired of typing it.
        phone: 'shareable',
        // Registry default is shareable. Who he lives with is nobody's business at the
        // comic shop, and it is exactly the kind of fact a stranger asks in passing.
        //
        // ⚠ MEASURED, NOT ASSUMED: the first version of this put the override on
        // topics_avoid, and it did nothing at all. A field carrying a DIRECTIVE is
        // handled by that directive rather than by the privacy list, so the override
        // was inert and the demo would have shown a feature working that was not.
        living_situation: 'private',
    },

    // Empty by construction - see `unanswered` above. A gap names a question About Me
    // asks and the user has not answered, and there are none left.
    gaps: [],

    /* Facts real conversations asked for that About Me has NO question for. This is the
     * honest half of the gaps feature: the questionnaire could not have anticipated
     * everything, and this is where the rest lands.
     *
     * ⚠ THE STATE WORD IS 'open', NOT 'unanswered', AND THE FIRST VERSION OF THIS FILE
     * GOT IT WRONG - silently, which is the point. An extra is read by two functions
     * that each filter POSITIVELY, one for state 'open' and one for 'answered', so a
     * third spelling is in neither list: it sits in the file, is never shown to the
     * user, never reaches the model, and nothing anywhere reports that it was dropped.
     *
     * Two are ANSWERED and two are still open, on purpose. An answered extra is real
     * About Me content - it reaches the prompt as a private known fact, available the
     * moment a partner asks and never volunteered - while the open ones are what keeps
     * "Questions worth answering" from being empty on a fully answered profile. */
    extras: [
        {
            name: 'gamer_tag',
            question: 'What is your gamer tag?',
            value: 'Speedy_608',
            state: 'answered',
            count: 4,
            lastSeen: '2026-09-09T23:41:12.000Z',
            partnerText: 'What is your tag? I will add you before the tournament.',
        },
        {
            name: 'student_id',
            question: 'What is your student ID number?',
            value: 'WHS-114772',
            state: 'answered',
            count: 2,
            lastSeen: '2026-09-02T16:38:20.000Z',
            partnerText: 'I need your student ID number for the competition entry.',
        },
        {
            name: 'insurance_member_id',
            question: 'What is your insurance member ID?',
            value: null,
            state: 'open',
            count: 3,
            lastSeen: '2026-09-03T15:14:02.000Z',
            partnerText: 'Do you have your insurance card with you? I need the member ID.',
        },
        {
            name: 'wheelchair_model',
            question: 'What model is your wheelchair?',
            value: null,
            state: 'open',
            count: 2,
            lastSeen: '2026-09-01T21:30:44.000Z',
            partnerText: 'What model is the chair? I want to check it fits through the door.',
        },
    ],

    // --- How he talks with each person ---------------------------------------
    //
    // Keyed by the person's name as the persona sheet spells it. Every dimension left
    // out is NEUTRAL and contributes nothing to the prompt, which is why nobody here
    // has all five set: a real user sets the one or two that actually differ.
    //
    // `goals` are standing - what he wants out of the relationship over time, in HIS
    // order of importance. `note` overrides the menu where they disagree.
    partnerProfiles: {
        Elena: {
            register: { formality: 'relaxed', warmth: 'warmer', length: 'shorter' },
            goals: [{ id: 'connect' }, { id: 'share' }, { id: 'help' }],
            note: 'She worries. Short answers land better than long ones, and if I am '
                + 'fine she needs to hear that I am fine before anything else.',
            openers: ['Hey Mom, quick thing.', 'Mom, you got a second?'],
            windDowns: ['Okay, I am good.'],
            closings: ['Love you.', 'Later, Mom.'],
        },
        Ray: {
            register: { formality: 'relaxed', humor: 'playful', length: 'shorter' },
            goals: [{ id: 'together' }, { id: 'sociable' }],
            note: 'We talk about the Packers and about cars. He does not need the '
                + 'feelings version of anything.',
            openers: ['Dad. Did you see that game?'],
            closings: ['Later, Dad.'],
        },
        Sofia: {
            register: { formality: 'relaxed', humor: 'playful', directness: 'direct' },
            goals: [{ id: 'sociable' }, { id: 'together' }],
            note: 'We give each other a hard time constantly. Nothing here should '
                + 'sound careful or nice.',
            openers: ['Sof. Come here.', 'Sofia. Emergency.'],
            closings: ['Go away.', 'Bye, weirdo.'],
        },
        Rosa: {
            register: { formality: 'careful', warmth: 'warmer', length: 'fuller' },
            goals: [{ id: 'reassure' }, { id: 'connect' }, { id: 'their_people' }],
            note: 'She speaks Spanish to me and I answer in English. She is old '
                + 'school, so I am politer with her than with anyone. Never sarcastic '
                + 'with Abuela.',
            openers: ['Hola, Abuela.', 'Abuela, it smells amazing in here.'],
            windDowns: ['I should let you sit down.'],
            closings: ['Te quiero, Abuela.', 'Bye, Abuela.'],
        },
        Devon: {
            register: { formality: 'relaxed', length: 'shorter', humor: 'playful', directness: 'direct' },
            goals: [{ id: 'sociable' }, { id: 'plans' }, { id: 'together' }],
            note: 'Best friend since fourth grade. He waits for me to finish typing '
                + 'and never fills it in, so I can take the long way around with him.',
            openers: ['Dev. You on?', 'Yo.'],
            closings: ['One more.', 'Out.'],
        },
        Aisha: {
            register: { warmth: 'warmer', formality: 'relaxed' },
            goals: [{ id: 'connect' }, { id: 'upbeat' }],
            note: 'She is easy to talk to and she asks actual questions.',
            openers: ['Hey Aisha.'],
        },
        Tyler: {
            register: { humor: 'playful', directness: 'direct', length: 'shorter' },
            goals: [{ id: 'sociable' }],
            note: 'Pure trash talk. He gives it and he can take it.',
            openers: ['Tyler. Rematch.'],
            closings: ['Get wrecked.'],
        },
        Biscuit: {
            register: { warmth: 'warmer' },
            goals: [],
            note: 'He is a dog.',
        },
    },

    // People the persona sheet does not have, because they only appear once somebody
    // has used the app in the places they actually go.
    extraPeople: [
        {
            name: 'Ramon',
            relationship: 'Other: shop owner',
            nickname: '',
            livesWithMe: false,
            about: 'runs Pulp Comics, keeps my pull list, talks to me and not to whoever '
                + 'pushed me in',
            private: false,
            profile: {
                register: { formality: 'relaxed', length: 'shorter' },
                goals: [{ id: 'information' }, { id: 'sociable' }],
                note: 'He knows what I collect, so I do not have to explain it every week.',
                openers: ['Ramon. Anything for me?'],
            },
        },
        {
            name: 'Ms. Whitaker',
            relationship: 'Teacher',
            nickname: '',
            livesWithMe: false,
            about: 'English, 11th grade; gives me extra time without making a thing of it',
            private: false,
            profile: {
                register: { formality: 'careful', length: 'fuller' },
                goals: [{ id: 'information' }, { id: 'help' }],
                note: 'School voice. Full sentences, no sarcasm, but she does not need '
                    + 'me to be formal about it.',
            },
        },
        {
            name: 'Dr. Aldrich',
            relationship: 'Doctor',
            nickname: '',
            livesWithMe: false,
            about: 'rehab clinic; physical therapy every other Thursday',
            private: true,
            profile: {
                register: { formality: 'careful', humor: 'serious', directness: 'direct' },
                goals: [{ id: 'information' }, { id: 'help' }],
                note: 'I want straight answers here and I want to be the one answering, '
                    + 'not Mom. Do not soften what I say about pain - if it hurts, say '
                    + 'it hurts.',
            },
        },
        {
            name: 'Coach Bea',
            relationship: 'Other: swim coach',
            nickname: 'Bea',
            livesWithMe: false,
            about: 'adaptive swim at the YMCA, Tuesdays',
            private: false,
            profile: {
                register: { formality: 'relaxed', directness: 'direct' },
                goals: [{ id: 'help' }, { id: 'upbeat' }],
                note: 'She pushes me, which I like. Tell her the real number of laps.',
            },
        },
    ],

    // Goals he can switch on with anyone, anywhere - the third source, and the only
    // one that covers somebody he has never met.
    generalGoals: [
        { id: 'information' },
        { id: 'help' },
        { id: '', text: 'Be taken seriously as the person answering', label: 'Talk to me' },
        { id: '', text: 'Keep this short - I am running out of steam', label: 'Keep it short' },
        { id: 'sociable' },
    ],

    // Goals attached to particular places - what this visit is for. Keyed by place name.
    placeGoals: {
        'The rehab clinic': [
            { id: '', text: 'Answer the questions myself instead of letting Mom answer', label: 'My answers' },
            { id: 'information' },
        ],
        'Gino’s Pizza': [
            { id: '', text: 'Order a pepperoni slice and a root beer', label: 'Order' },
        ],
        'Pulp Comics': [
            { id: '', text: 'Find out what came in for my pull list', label: 'Pull list' },
            { id: 'sociable' },
        ],
        'The YMCA': [
            { id: 'help' },
        ],
    },

    // Respellings - the display form stays, the synthesizer gets these. Only on names
    // the voice actually says wrong; a respelling on a name the voice already gets
    // right can only make it worse.
    pronunciations: {
        people: {
            // Spanish "Abuela" comes out flat and wrong on the device voices.
            Rosa: '',
            Elena: 'eh-LAY-na',
        },
        nicknames: {
            Rosa: 'ah-BWEH-la',
        },
        places: {
            'St. Maria’s': 'Saint ma-REE-ahs',
            'Gino’s Pizza': 'JEE-nos Pizza',
        },
    },

    // --- Express Panel, as it looks after he rearranged it --------------------
    //
    // The Always band is left exactly as shipped (the speech and language therapists'
    // set). What a real user changes first is the Context band - the six starter
    // feelings are placeholders by design and swap out in seconds - and then the Flex
    // lists, which start empty and can only be filled once there are people and
    // places to hang them on.
    // Five, not six. The sixth shipped feeling is deleted rather than reworded, which
    // is what a real user does with a word that means nothing to them.
    feelings: ['Pumped', 'Annoyed', 'Wiped', 'Chill', 'Curious'],

    // Partner and place buttons, in the order he wants them. These resolve to real
    // records, which is the whole reason they cannot ship as defaults.
    // ⚠ TEN ITEMS, AND THE CEILING IS THE LAYOUT RATHER THAN TASTE. One row of Context
    // holds 11 positions on a bottom QWERTY layout and 5 on a narrow side one, and
    // anything past the band's positions is simply unreachable. Ten fits the first with
    // room to spare; on a side dock the last few are hidden until the user gives Context
    // a second row, which is why the band is a setting.
    contextPartners: ['Elena', 'Devon', 'Sofia'],
    contextPlaces: ['West High School', 'Pulp Comics'],

    // Situational phrase lists, most specific first. The key is a partner and a place,
    // either of which may be "anyone" / "anyplace" - and anyone plus anyplace IS the
    // general list.
    flex: {
        'anyone|anyplace': [
            'Give me a second, I am typing',
            'Talk to me, not to them',
            'I can hear you fine',
            'Do not finish my sentence',
        ],
        'Devon|anyplace': [
            'Rematch',
            'Your turn',
            'That was luck and you know it',
            'Get on voice chat',
        ],
        'Elena|anyplace': [
            'I am fine, really',
            'Can you charge my chair?',
            'I need help with something',
        ],
        'anyone|Pulp Comics': [
            'Anything in for me?',
            'Hold that one for me',
            'What came out this week?',
        ],
        'anyone|The YMCA': [
            'Same as last week',
            'One more lap',
            'I need the changing room',
        ],
        'anyone|The rehab clinic': [
            'That hurts',
            'Not that side',
            'Ask me, not my mom',
        ],
    },

    // --- Phrases he reworded -------------------------------------------------
    //
    // Added to the shipped lists rather than replacing them, which is what a real user
    // does: the defaults stay usable and his own come first.
    controlPhrases: {
        holdOn: 'Hang on, I am typing.',
        openers: [
            'Hey {name}. Got a second?',
            'Guess what, {name}.',
        ],
        pardon: [
            'Say that again?',
            'I missed that - one more time?',
        ],
        windDowns: [
            'I gotta go.',
            'This was good. I am out of steam though.',
        ],
        closings: [
            'Later.',
            'See ya.',
        ],
        declineClosing: [
            'Wait - one thing.',
        ],
        retry: [
            'Let me try that again.',
        ],
    },

    placeholders: {
        acknowledgment: [
            'Hang on, I am typing.',
            'Give me a second.',
        ],
        thinking: [
            'Still typing.',
            'Almost there.',
        ],
    },

    // Things the app must never say in his voice. Cheap for a user to state, easy for
    // a model to obey, and unusually high value - getting this wrong is conspicuous in
    // a way that getting warmth slightly wrong is not.
    never: [
        'brave',
        'inspiration',
        'inspiring',
        'special needs',
        'wheelchair-bound',
        'confined to a wheelchair',
        'suffers from cerebral palsy',
        'differently abled',
        'I am fine with it',
    ],

    // Every Reframe he has typed. Not spoken and never in the conversation pane, so it
    // lives with the voice profile rather than the transcript.
    steers: [
        { text: 'shorter', at: '2026-08-26T23:12:40.000Z' },
        { text: 'do not apologize, I did nothing wrong', at: '2026-08-29T19:44:02.000Z' },
        { text: 'say it hurts, do not soften it', at: '2026-09-03T15:18:55.000Z' },
        { text: 'funnier', at: '2026-09-05T00:31:17.000Z' },
        { text: 'I already told her this yesterday', at: '2026-09-07T22:05:33.000Z' },
        { text: 'keep it to five words', at: '2026-09-11T23:02:09.000Z' },
    ],
};

export const PERSONA_EXTRAS = {
    'marc-delgado': marc,
};
