import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TOUR_STEPS, TOUR_DONE, createTour, currentStep, pressed, stepMatches,
    finishedBySessionEnd,
} from '../app/js/practice-tour.js';

// A stand-in for a pressed element. `closest` is the only DOM call the module makes,
// and it answers it the way a real element would: the selector matches if it names
// this element or one of its ancestors.
function el(...selectors) {
    return { closest: (sel) => (selectors.includes(sel) ? {} : null) };
}

test('the tour starts on its first step', () => {
    const t = createTour();
    assert.equal(currentStep(t).id, 'listen');
    assert.equal(t.done, false);
});

test('pressing the named control advances one step', () => {
    const t = createTour();
    assert.equal(pressed(t, el('#listenBtn')), 'advanced');
    assert.equal(currentStep(t).id, 'initiate');
});

test('a press on anything else is ignored and the step stands', () => {
    const t = createTour();
    for (const wrong of ['#windDownBtn', '#settingsBtn', '.ep-btn']) {
        assert.equal(pressed(t, el(wrong)), 'ignored');
        assert.equal(currentStep(t).id, 'listen', `${wrong} must not advance the tour`);
    }
});

test('a press INSIDE the control counts — the icon is what gets hit', () => {
    // Every one of these buttons contains an icon element, and a response card
    // contains its own text, so the event target is routinely a child.
    const t = createTour();
    const icon = { closest: (sel) => (sel === '#listenBtn' ? {} : null) };
    assert.equal(pressed(t, icon), 'advanced');
});

test('the whole tour can be walked, in order, and reports finished exactly once', () => {
    const t = createTour();
    const results = TOUR_STEPS.map((s) => pressed(t, el(s.target)));
    assert.deepEqual(results.slice(0, -1), Array(TOUR_STEPS.length - 1).fill('advanced'));
    assert.equal(results.at(-1), 'finished');
    assert.equal(t.done, true);
    assert.equal(currentStep(t), null);
    // Further presses do nothing rather than throwing or restarting.
    assert.equal(pressed(t, el('#listenBtn')), 'ignored');
});

test('the last step ends the session, so its message is deferred to the teardown', () => {
    // ⚠ The regression this guards: End conversation clears the tour, cancels speech
    // and wipes the coach line. A closing message said at press time is destroyed a
    // moment later, so the runner has to hand it to the teardown instead.
    const t = createTour();
    TOUR_STEPS.forEach((s) => pressed(t, el(s.target)));
    assert.equal(finishedBySessionEnd(t), true);
    assert.equal(TOUR_STEPS.at(-1).id, 'end');
});

test('only the final step is flagged as ending the session', () => {
    const flagged = TOUR_STEPS.filter((s) => s.endsSession);
    assert.equal(flagged.length, 1);
    assert.equal(flagged[0], TOUR_STEPS.at(-1));
});

test('finishing on a non-session-ending step announces immediately', () => {
    const t = createTour([{ id: 'only', target: '#listenBtn', say: 'Tap it.' }]);
    assert.equal(pressed(t, el('#listenBtn')), 'finished');
    assert.equal(finishedBySessionEnd(t), false);
});

test('every step has an id, a target and something to say', () => {
    for (const s of TOUR_STEPS) {
        assert.ok(s.id, 'step needs an id');
        assert.ok(s.target, `${s.id} needs a target`);
        assert.ok(s.say && s.say.length > 20, `${s.id} needs an instruction`);
    }
    assert.ok(TOUR_DONE.length > 20);
});

test('step ids are unique', () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('THE ORDER IS LOAD-BEARING: dependent steps stay in order', () => {
    // Each of these later steps has nothing to act on until the earlier one has run —
    // reorder them and the tour appears to work while silently no-opping in the
    // middle. See the header of practice-tour.js.
    const at = (id) => TOUR_STEPS.findIndex((s) => s.id === id);
    assert.ok(at('initiate') < at('pick-card'), 'cards only exist after openers are shown');
    assert.ok(at('pick-card') < at('say-again'), 'nothing to repeat until the user has spoken');
    assert.ok(at('compose') < at('cancel-compose'), 'cannot cancel a composer that is not open');
    assert.equal(at('end'), TOUR_STEPS.length - 1, 'ending the session must come last');
});

test('NO STEP NEEDS THE AI — the tour must run with no API key', () => {
    // The property this protects is onboarding: the person who most needs the tour is
    // the one on their first day whose key is not working yet, for whom the app is
    // otherwise a screen of unlabelled icons. Every control named here is one that
    // works from static phrases or local state. A step targeting a control that
    // requires a generation call would break that silently — the tour would simply
    // stall on a button that does nothing.
    const NEEDS_AI = ['#reframeBtn', '#speakBtn'];
    for (const s of TOUR_STEPS) {
        assert.ok(!NEEDS_AI.includes(s.target), `${s.id} targets an AI-dependent control`);
    }
});

test('stepMatches tolerates rubbish rather than throwing mid-conversation', () => {
    const step = TOUR_STEPS[0];
    assert.equal(stepMatches(step, null), false);
    assert.equal(stepMatches(step, {}), false);
    assert.equal(stepMatches(null, el('#listenBtn')), false);
});
