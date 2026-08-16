/* The controls tour — a guided walk through the Command Bar (Ken, August 7 2026:
 * "I find that I often forget what specific buttons mean or when they should be
 * used"). The last thing the Beta Test Plan promised that did not exist: §5.3 asks
 * testers to press every button once and, until now, left them to improvise it.
 *
 * WHY IT IS NEEDED AT ALL. It is the predictable cost of Rule 12 — the conversation
 * controls are icon-only, with no text on their faces — on the one surface where
 * Rule 17's spoken help was deliberately excluded, because nothing may slow or trip
 * someone up mid-conversation. So the buttons are unlabelled by design and there is
 * nowhere to ask what they do. The tour is where you ask.
 *
 * ⚠ IT IS A DIFFERENT KIND OF SCENARIO, NOT ANOTHER SCENARIO. The five bundled
 * scenarios converse: the AI authors the partner's side and the user replies. A tour
 * has to INSTRUCT ("they didn't hear you — try Repeat what I said") and then check
 * that the right button was pressed. That is why it carries `steps` and the others
 * carry `partnerPersona`, and why practice-mode code branches on which it has.
 *
 * ⚠ NO AI, DELIBERATELY, AND THIS IS THE PROPERTY TO PROTECT. Every step is scripted
 * and every control it names works without a generation call — openers, wind-downs,
 * Hold on and Ask them to repeat are all static phrases, and "New N" pages a static
 * palette rather than regenerating. So the tour runs with no API key, on no internet,
 * and costs nothing. That matters most for exactly the person who needs it: someone
 * on their first day who has not got their key working yet, for whom the app is
 * otherwise a screen of unlabelled icons. If a future step needs the AI, it does not
 * belong in the tour.
 *
 * ⚠ THE `target` STRINGS ARE CSS SELECTORS MATCHED AGAINST WHAT WAS PRESSED, and the
 * tour OBSERVES rather than intercepts — the button does its real job and the tour
 * merely notices. Pressing a control must teach what it actually does; a tour that
 * swallowed the press would be teaching a mime of the app. The one exception is
 * Start Listening, which in a tour cues the next step instead of an AI partner turn.
 *
 * ⚠ THE ORDER IS NOT ARBITRARY — later steps depend on earlier ones having run:
 *   - the openers step must precede the card step, because the card step needs cards
 *     on screen, and openers are the only way to get them without the AI;
 *   - the card step must precede "Repeat what I said", which has nothing to repeat
 *     until the user has said something;
 *   - "New N" must follow a step that leaves a static palette showing, or it has
 *     nothing to page through;
 *   - the composer's Cancel must follow the composer opening;
 *   - End conversation is last because it ends the tour.
 * Reordering the steps without re-reading this list produces a tour that appears to
 * work and quietly no-ops in the middle.
 */

/** Every step: what the coach says, and what the user must press to move on. */
export const TOUR_STEPS = [
    {
        id: 'listen',
        target: '#listenBtn',
        say: "Let's walk through the buttons in the middle row. This first one turns "
           + "listening on, so the app can hear the person you are with. You tap it "
           + "once at the start of a conversation. Tap it now.",
    },
    {
        id: 'initiate',
        target: '#initiateBtn',
        say: "Good. The next one starts a conversation and offers you some ways to "
           + "open it, so you never have to think of the first line yourself. Tap it.",
    },
    {
        id: 'pick-card',
        target: '#responseOptions .response-card',
        say: "Those are response cards. Tapping one speaks it in your voice — that is "
           + "how you say almost everything. Tap whichever one you like.",
    },
    {
        id: 'say-again',
        target: '#sayAgainBtn',
        say: "You just said that out loud. If they did not catch it, Repeat what I "
           + "said says your last words again, without you choosing anything. Tap it.",
    },
    {
        id: 'hold-on',
        target: '#holdOnBtn',
        say: "Hold on buys you a moment. It tells them you are still thinking, so the "
           + "silence does not do it for you. Tap it.",
    },
    {
        id: 'pardon',
        target: '#pardonBtn',
        say: "That one was about you. This next one is about them: Ask them to repeat, "
           + "for when you did not catch what they said, or the app heard it wrong. Tap it.",
    },
    {
        id: 'regenerate',
        target: '#regenerateBtn',
        say: "When none of the cards is quite right, this button gives you a different "
           + "set. Tap it and watch the cards change.",
    },
    {
        id: 'compose',
        target: '.ep-imow',
        say: "And when nothing offered is what you mean, you can write your own. The "
           + "pencil button in your phrase panel opens a place to type. Tap it.",
    },
    {
        id: 'cancel-compose',
        target: '#cancelComposerBtn',
        say: "This is where you type, and the keyboard covers your phrases while it is "
           + "open. Cancel closes it without saying anything. Tap Cancel.",
    },
    {
        id: 'wind-down',
        target: '#windDownBtn',
        say: "Wind down is how you signal you would like to finish, without saying "
           + "goodbye yet. It offers things like \"I should get going.\" Tap it.",
    },
    {
        id: 'privacy',
        target: '#privacyBtn',
        say: "This one keeps a conversation out of your saved record — for when it is "
           + "nobody else's business. Tap it once to turn it on.",
    },
    {
        id: 'end',
        target: '#endConversationBtn',
        // ⚠ THIS STEP TEARS DOWN THE THING ANNOUNCING IT. Pressing End conversation
        // ends the practice session, which clears the tour, wipes the coach line and
        // cancels speech — so a closing message said at press time is destroyed a
        // moment later. `endsSession` tells the runner to hand the message to the
        // teardown instead of racing it. Any future last step that ends the session
        // needs the same flag.
        endsSession: true,
        say: "Last one. End conversation finishes up and clears the screen for the next "
           + "person. Tap it, and that is the tour done.",
    },
];

/** Said once at the end, after the final step. */
export const TOUR_DONE =
    "That is every button in the middle row. The only one we skipped is Settings, on "
    + "the end, which you have already used. You can run this tour again whenever you "
    + "like from the Practice tab.";

/**
 * Would pressing `el` satisfy `step`?
 *
 * `closest` rather than a direct match, because the press can land on something
 * INSIDE the control: every one of these buttons carries an icon element, and a
 * response card carries its own text and badge, so the event target is routinely a
 * child of the thing the user believes they pressed.
 */
export function stepMatches(step, el) {
    if (!step || !el || typeof el.closest !== 'function') return false;
    return !!el.closest(step.target);
}

/**
 * The tour's position, as a plain object so it can be tested without a DOM.
 *
 * Deliberately NOT a class and deliberately holding no element references: a step is
 * satisfied by whatever the user pressed at the time, and the palette is rebuilt
 * constantly, so anything remembered here would be stale by the time it was read.
 */
export function createTour(steps = TOUR_STEPS) {
    return { steps, index: 0, done: false };
}

export function currentStep(tour) {
    if (!tour || tour.done) return null;
    return tour.steps[tour.index] || null;
}

/**
 * Record a press. Returns what the caller should do about it:
 *   'advanced'  — that was the step's control; `currentStep` is now the next one
 *   'finished'  — that was the LAST step; the tour is over
 *   'ignored'   — something else was pressed; the step stands
 *
 * A wrong press is deliberately NOT an error and does not reset anything. On this
 * surface a stray tap is ordinary, and a tour that scolded — or worse, started over —
 * would be worse than one that waits. The step is simply still there.
 */
export function pressed(tour, el) {
    const step = currentStep(tour);
    if (!step) return 'ignored';
    if (!stepMatches(step, el)) return 'ignored';
    tour.index += 1;
    if (tour.index >= tour.steps.length) {
        tour.done = true;
        tour.finishedOn = step;      // so the caller can see whether it ends the session
        return 'finished';
    }
    return 'advanced';
}

/** Did the step that finished the tour also end the practice session? */
export function finishedBySessionEnd(tour) {
    return !!(tour && tour.finishedOn && tour.finishedOn.endsSession);
}
