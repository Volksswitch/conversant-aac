// The Conversant AAC demonstration video (ATIA 2027, possible testers, and later
// promotion). Made from "Conversant-AAC-Demo-Script.docx", second edition, and
// re-made whenever the app changes:
//
//   node scripts/video/render-video.mjs scripts/video/demo/conversant-demo.mjs
//
// Writes Videos/Demo/Conversant AAC Demo.mp4 (public, no beta references) and
// Videos/Demo/Conversant AAC Demo - Beta.mp4 (the same, with the beta ending).
//
// THE AI'S WORDS ARE REAL. Every set of options, the barista's lines and the
// rewordings after "Sorry, what?" came from the real AI, run once with --capture
// and saved in demo-ai-recording.json. Every later render replays them, after the
// same wait, so the video repeats exactly. Re-record (add --capture) after any
// change to the prompt, to Marc's data, or to these steps; then watch it again,
// because the AI may word things differently.
//
// Shape (Ken, November 7 2026): Ken's cloned voice speaks the "to camera" parts
// over title cards, AND narrates the demos: what is about to happen is said first,
// then shown. Nothing is printed under the picture. Voices: Ken (narrator), Eric
// (Marc), Charlie (Ramon), River (the barista).
//
// PACING (Ken, November 7 2026, second pass): slower voices with pauses between
// the narrator's sentences, pictures held long enough to read, the holding phrase
// two seconds after Ramon stops, and the options after the AI's real wait.

import {
  card, onScreen, hear, lastSpoken, markSpoken, untilNewSpeech, ownWordsBtn,
  typeInto, settingsTab, section, panelButtonWith, panelButton, holdSpeech, topic,
} from '../helpers.mjs';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Ramon's lines (written for the demo; the AI does not write these) ----
const R1 = "Hey Marc! Good timing. Your pull list came in this morning.";
const R2 = "New Ms. Marvel and the Spider-Man. You want the regular cover or the variant?";
const R3 = "Variant's eight bucks more, just so you know. Still want it?";
const R4 = "Back again! Hey, the new Batman one-shot just came in. Want me to add it to your list?";
const R5 = "Sorry, what?";
const R6 = "No problem. Anything else today?";
const R7 = "Already on there. I set aside the new Spider-Man too.";
const R8 = "See you next Saturday.";

// The goal Marc switches on with Ramon.
const GOAL = 'Just chatting';

// ---- Timing ----
// Ken: two seconds between the end of what Ramon says and the holding phrase.
const HOLDING_GAP = 2.0;
// The app asks the AI at the pause, which it notices half a second after the
// last words. So the options land that long after Ramon stops, plus the AI's
// real wait, and never sooner than a second after the holding phrase ends.
const SILENCE = 0.5;
// How long the AI took to answer the request a tap or a pause set off (seconds).
const markReq = async (p) => { p.reqMark = p.aiRequests || 0; };
const aiSeconds = async (p) => {
  const t0 = Date.now();
  while ((p.aiRequests || 0) <= (p.reqMark ?? 0)) {
    if (Date.now() - t0 > 30000) throw new Error('the AI was never asked');
    await pause(50);
  }
  return (await p.lastAIms) / 1000;
};
// The holding phrase's picture stays up until the options would have landed.
const untilOptionsLand = async (p, { lead, speak }) =>
  Math.max(1.0, SILENCE + await aiSeconds(p) - (HOLDING_GAP + lead + speak));
// A tap that sends a request: its picture stays up for the real wait.
const waitForAI = (extra = 0.3) => async (p) => extra + await aiSeconds(p);

// ---- Choosing an option by its words ----
// The real AI decides which position an answer lands in, so a tap names the kind
// of answer it wants and finds it. When nothing fits, it takes `fallback`, so a
// fresh recording never stalls; watch the result after re-recording.
const optionWhere = (re, fallback = 1) => async (page) => {
  const n = await page.evaluate((src) => {
    const cells = [...document.querySelectorAll('#responseOptions > .response-cell')];
    const rx = new RegExp(src, 'i');
    // The full wording only; the short label under it would match too loosely.
    // Never the "Sorry, what?" card: none of these taps is asking again.
    const i = cells.findIndex((c) => !c.classList.contains('slot-repair')
      && rx.test(c.querySelector('.response-text')?.innerText || ''));
    return i < 0 ? 0 : i + 1;
  }, re.source);
  return card(n || fallback);
};

// The words Marc's voice actually says: the last thing the app spoke.
const said = lastSpoken;
// Note how many AI answers have landed (in a tap step's before), then wait for the
// next one (in the following step), so a refreshed set is never caught half-made.
const markAI = async (p) => { p.aiMark = p.aiCount || 0; };
const markBoth = async (p) => { await markAI(p); await markReq(p); };
const untilNewOptions = async (p) => {
  const t0 = Date.now();
  while ((p.aiCount || 0) <= (p.aiMark ?? 0)) {
    if (Date.now() - t0 > 30000) throw new Error('no new options arrived');
    await pause(100);
  }
  await pause(900);
};

// The narrator says what is about to happen, over the screen as it is now.
// With `tap` and press, the tap happens after he has said it; the next picture
// shows the result.
const narrate = (say, extra = {}) => ({ speaker: 'narrator', say, ...extra });
// Wait for the app to speak, then say what it said in Marc's voice.
const marcSays = (extra = {}) => ({ speaker: 'user', until: untilNewSpeech, say: said, tail: 1.4, ...extra });
// A plain tap, shown and done (nothing said).
const tapIt = (tap, extra = {}) => ({ tap, press: true, hold: 1.6, ...extra });
// Ramon speaks into the stand-in microphone; the app hears him. His picture stays
// up for the two seconds before the holding phrase.
const ramon = (line, waitWords, extra = {}) => ({
  speaker: 'partner',
  before: async (p) => {
    await markSpoken(p); await markBoth(p);
    p.holdNextOptions(); await holdSpeech(p, true); await hear(p, line);
  },
  waitFor: onScreen(waitWords),
  say: line,
  tail: HOLDING_GAP,
  ...extra,
});
// The holding phrase that plays while the options are on their way.
const holding = () => ({ speaker: 'user', until: untilNewSpeech, whileSpeaking: true, say: said, lead: 0, tail: untilOptionsLand });
// The options arrive, and stay up long enough to read (or for the narrator).
const optionsArrive = (extra = {}) => ({
  before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); },
  waitFor: card(1) + ' .response-text', highlight: '#responseOptions', lead: 0.1, hold: 4.5, ...extra,
});
// A refreshed set, after New 4, a hint, or a goal.
const newOptions = (extra = {}) => ({ until: untilNewOptions, highlight: '#responseOptions', lead: 0.1, hold: 4.5, ...extra });

// A drop-down set to the option at `pick(options, current)`, as a person would.
const setSelect = (sel, pick) => async (page) => {
  await page.$eval(sel, (el, src) => {
    const f = new Function('options', 'current', `return (${src})(options, current)`);
    const v = f([...el.options].map((o) => o.value), el.value);
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, pick.toString());
};
const closeSettings = '#closeSettingsBtn';

const TITLE = 'Conversant AAC';

export default {
  id: 'conversant-demo',
  title: 'Conversant AAC Demo',
  standalone: true,
  outDir: 'Demo',
  inBrowserStorage: true,
  backup: 'Conference Demo/conversant-demo-marc.json',
  // Quiet before and after every line, about twice the how-to videos'.
  lead: 0.6,
  tail: 1.2,
  settings: {
    // Resume listening on its own, as the filming script asks, so Ramon can answer
    // without anyone tapping Listen between exchanges.
    autoRelisten: true,
    // The keyboard is shown on screen, so choosing a layout shows the keyboard.
    keyboardMode: 'onscreen',
    // Marc uses QWERTY, so he has made the Express Panel taller than it ships,
    // as a QWERTY user would; the shipped height makes the buttons squat.
    convLayout: { bottom: { command: 0.10, response: 0.20, dock: 0.42 } },
  },
  // For the video only (the backup file is not changed): one row each of Always,
  // Flex and Context.
  adjustBackup(pkg) {
    const ep = pkg.data['express-panel.json'];
    ep.sizes = { ...ep.sizes, shape: 'rows', contextRows: 1, flexRows: 1 };
  },
  voices: {
    narrator: { name: 'Ken Hackbarth (cloned)', eleven: { id: 'UjNdMHnAjJXQL1HGr4ry', model: 'eleven_multilingual_v2', speed: 0.9, gap: 1.1, clause: 0.5 } },
    user: { name: 'Eric', eleven: { id: 'cjVigY5qzO86Huf0OWal', model: 'eleven_multilingual_v2', speed: 0.92 } },
    partner: { name: 'Charlie', eleven: { id: 'IKne3meq5aSn9XLyUdCD', model: 'eleven_multilingual_v2', speed: 0.92 } },
    barista: { name: 'River', eleven: { id: 'SAz9YHcvj6GT2YYXdXww', model: 'eleven_multilingual_v2', speed: 0.92 } },
  },
  ai: { recording: 'scripts/video/demo/demo-ai-recording.json' },

  steps: [
    // ===== TO CAMERA 1: the problem =====
    narrate("Real conversation has a deadline nobody talks about: roughly four seconds. Wait longer than that to answer, and the other person starts to fill the silence, change the subject, or give up.",
      { card: { title: 'Four seconds', lines: ['Real conversation has a deadline nobody talks about.'] } }),
    narrate("Most AAC can't meet that deadline, so the people who use it end up limited to short, practical exchanges instead of real conversation. Conversant AAC is a free, open-source app that uses AI to close that gap. Here's what it does.",
      { card: { title: TITLE, lines: ['Free and open source.', 'AI suggests replies within seconds, and you choose what is said.'] } }),

    // ===== DEMO 1: a conversation at the comic shop =====
    narrate("This is Marc. He's at Pulp Comics, his comic shop, on a Saturday. Ramon works the counter, and he keeps Marc's pull list: the comics he sets aside for Marc each week.",
      { card: { title: 'At the comic shop', lines: ['Marc is at Pulp Comics on a Saturday.', 'Ramon works the counter and keeps Marc’s pull list.'] } }),
    narrate("First, Marc tells Conversant who he's with. He taps Ramon.", { tap: panelButtonWith('Ramon'), press: true }),
    narrate("Then where he is: Pulp Comics.", { tap: panelButtonWith('Pulp Comics'), press: true }),
    narrate("That brings up Marc's phrases and goals for this person and this place.",
      { highlight: 'all:#expressPanel .ep-band-flex', tail: 1.6 }),
    narrate("When Ramon starts to talk, Marc taps Listen.", { tap: '#listenBtn', press: true }),
    narrate("Ramon speaks, and the app writes down what he says. When he pauses, the app says a holding phrase, so Ramon knows an answer is coming.",
      { highlight: '#transcriptSection' }),
    ramon(R1, 'pull list came in'),
    holding(),
    optionsArrive({ hold: undefined, ...narrate("Then four options arrive, written for this moment. Marc picks one with a single tap, and it's spoken.") }),
    tapIt(optionWhere(/what came|anything good|what.?s new|what.?s in/, 3), { before: markSpoken }),
    marcSays(),
    ramon(R2, 'regular cover or the variant'),
    holding(),
    optionsArrive({ waitFor: '#expressPanel .ep-choice', highlight: 'all:#expressPanel .ep-choice', hold: undefined,
      ...narrate("When Ramon offers a choice, each choice becomes a button too. Tapping one brings up options about that choice.") }),
    tapIt(optionWhere(/variant/), { before: markSpoken }),
    marcSays(),
    ramon(R3, 'eight bucks more'),
    holding(),
    optionsArrive(),
    narrate(`Goals steer the options, and they never say anything out loud. Marc is in no hurry today, so he taps "${GOAL}", and the options change to match.`,
      { tap: panelButtonWith(GOAL), press: true, before: markBoth, tail: waitForAI() }),
    newOptions(),
    narrate("Each kind of answer stays in the same place every time. Only the words change.",
      { tap: optionWhere(/worth|yeah|yes|still|sure/), press: true, before: markSpoken }),
    marcSays(),

    // ===== TO CAMERA 2: nothing on the screen moves =====
    narrate("Nothing on that screen moved, and that's on purpose. Many people who could use this rely on a keyguard, a plastic sheet with a hole over each button, so a hand with limited control doesn't hit the wrong one. If the buttons moved, the keyguard would be useless. What people can change is how it looks.",
      { card: { title: 'Nothing on the screen moves', lines: ['Only the words change.', 'So a keyguard keeps working.'] },
        after: (p) => p.click('#endConversationBtn') }),

    // ===== MONTAGE: layouts and colors =====
    tapIt('#settingsBtn', { hold: 1.4 }),
    { waitFor: '#settingsDialog[open]', ...tapIt(settingsTab('textsize'), { hold: 1.4 }) },
    tapIt(section('Colors'), { hold: 1.4 }),
    narrate("There are seven color schemes, and every button stays where it is.", { highlight: '#colorSchemeInput' }),
    ...['bold', 'dark', 'yellow', 'cb'].map((v) => ({
      before: setSelect('#colorSchemeInput', `() => '${v}'`), highlight: '#colorSchemeInput', hold: 2.6,
    })),
    { before: setSelect('#colorSchemeInput', "() => 'light'"), ...tapIt(settingsTab('express'), { hold: 1.4 }) },
    // Opening this section shows the keyboard, the thing a layout changes.
    tapIt(section('Express Panel and Keyboard selection'), { hold: 1.4 }),
    narrate("Marc types on the screen, so he can choose the layout of the on-screen keyboard. He uses QWERTY, and there are alphabet layouts as well, with larger or smaller keys.",
      { before: async (p) => { await p.evaluate(() => { window.__layoutWas = document.getElementById('bottomLayoutSelect').value; }); },
        highlight: '#bottomLayoutSelect' }),
    { before: setSelect('#bottomLayoutSelect', "() => 'B2'"), highlight: '#bottomLayoutSelect', hold: 3 },
    { before: setSelect('#bottomLayoutSelect', "() => 'B9'"), highlight: '#bottomLayoutSelect', hold: 3 },
    { before: async (p) => {
        await p.$eval('#bottomLayoutSelect', (el) => {
          el.value = window.__layoutWas;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await p.click(settingsTab('general'));
        await p.click(section('One tap or two'));
        await pause(400);
      },
      ...narrate("For anyone who hits buttons by accident, each button can be set to need two taps.",
        { tap: 'input[name="expressTapMode"][value="double"]', press: true }),
      after: async (p) => {
        const mode = await p.evaluate(() => JSON.parse(localStorage.getItem('aac_settings')).expressTapMode);
        if (mode !== 'double') throw new Error('the two-tap setting did not take');
      } },
    { before: (p) => p.click(closeSettings), ...tapIt(panelButton('Anything in for me?'), { hold: 1.2 }) },
    narrate("The first tap only marks the button. A second tap would say it.",
      { highlight: panelButton('Anything in for me?'),
        after: async (p) => {
          await pause(1500);   // let the mark expire, so nothing is said
          // Two taps are on now, and Settings follows that rule too.
          await p.click('#settingsBtn'); await pause(150); await p.click('#settingsBtn');
          await p.waitForSelector('#settingsDialog[open]');
          await p.click(settingsTab('general'));
          await p.click('input[name="expressTapMode"][value="single"]');
          await p.click(closeSettings);
          await pause(600);
        } }),

    // ===== DEMO 2: more ways to answer =====
    narrate("A little later, Marc is back at the counter, and Ramon has something new for him. Here are some more ways to answer.",
      { card: { title: 'More ways to answer', lines: ['Same shop, a little later.'] },
        after: async (p) => { await p.click(panelButtonWith('Ramon')); await pause(300); } }),
    tapIt('#listenBtn'),
    ramon(R4, 'Batman one-shot'),
    holding(),
    optionsArrive(),
    // Beat A: New 4
    narrate("If none of the options is right, Marc can ask for four more.",
      { tap: '#regenerateBtn', press: true, before: markBoth, tail: waitForAI() }),
    newOptions(),
    // Beat B: Reframe
    narrate("Or he can type a hint, and the options change to fit it.", { tap: ownWordsBtn, press: true }),
    { waitFor: '#composerInput', before: (p) => typeInto(p, '#composerInput', 'saving up for the Packers game'),
      highlight: '#composerInput', hold: 3.2 },
    tapIt('#reframeBtn', { before: markBoth, hold: 1.2, tail: waitForAI() }),
    newOptions(),
    tapIt(optionWhere(/packers|saving|skip|pass/), { before: markSpoken }),
    marcSays(),
    // Beat E: when they didn't hear
    narrate("Sometimes the other person doesn't catch what was said.", { highlight: '#transcriptSection' }),
    ramon(R5, 'what?', { tail: 3.2 }),
    // Wait for both answers: the three ways to repair, then their reworded text.
    { waitFor: card(3) + ' .response-text', before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); },
      until: async (p) => { while ((p.aiCount || 0) < (p.aiMark ?? 0) + 2) await pause(100); await pause(900); },
      highlight: '#responseOptions', lead: 0.1,
      ...narrate("Then Marc can say it again, say it a different way, or explain a little more.") },
    tapIt(card(2), { before: markSpoken }),
    marcSays(),
    ramon(R6, 'Anything else today'),
    holding(),
    optionsArrive(),
    // Beat C: speak your own words
    narrate("He can always type his own words, and the app says exactly what he typed.", { tap: ownWordsBtn, press: true }),
    { waitFor: '#composerInput', before: (p) => typeInto(p, '#composerInput', 'Can you put the next Ms. Marvel on my list too?'),
      highlight: '#composerInput', hold: 3.6 },
    tapIt('#speakBtn', { before: markSpoken, hold: 1.0 }),
    marcSays(),
    ramon(R7, 'set aside the new Spider-Man'),
    holding(),
    optionsArrive(),
    // Beat D: an Express Panel phrase
    narrate("His own phrases for Ramon and for this shop are always one tap away.",
      { tap: panelButton('Hold that one for me'), press: true, before: markSpoken }),
    marcSays(),
    // Beat F: wrapping up
    narrate("Ending a conversation takes two taps. Wrap up offers ways to bring it to a close.", { tap: '#windDownBtn', press: true }),
    { waitFor: card(1) + ' .response-text', highlight: '#responseOptions', lead: 0.1, hold: 3.6 },
    tapIt(card(1), { before: markSpoken }),
    marcSays(),
    ramon(R8, 'next Saturday', { tail: 1.6 }),
    { before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); }, until: () => pause(1500),
      waitFor: card(1) + ' .response-text', highlight: '#responseOptions', lead: 0.1,
      ...narrate("Then a goodbye.") },
    tapIt(optionWhere(/ramon|see you|later|bye/), { before: markSpoken }),
    marcSays({ after: async (p) => { await p.click('#endConversationBtn'); await pause(400); await p.click(panelButtonWith('Pulp Comics')); } }),

    // Beat G: practice (Pulp Comics is switched off first: practice is a coffee shop)
    narrate("Marc can also practice. The AI plays the other person, so he can rehearse a conversation before he has it for real.",
      { tap: '#settingsBtn', press: true }),
    { waitFor: '#settingsDialog[open]', ...tapIt(settingsTab('practice')) },
    { waitFor: '.practice-card', ...tapIt('::-p-xpath(//button[contains(@class,"practice-card")][.//*[text()="Ordering at a coffee shop"]])', { hold: 2 }) },
    tapIt('#listenBtn', { before: async (p) => { await markSpoken(p); await markReq(p); }, tail: waitForAI() }),
    { speaker: 'barista', until: untilNewSpeech, say: said },
    { waitFor: card(1) + ' .response-text', highlight: '#responseOptions', lead: 0.1, hold: 4 },
    tapIt(card(1), { before: markSpoken }),
    marcSays({ after: async (p) => { await p.click('#endConversationBtn'); await pause(600); } }),

    // ===== TO CAMERA 3: sounding like you =====
    narrate("The options sound like Marc because he has told the app about himself. There's a set of questions he answers at his own pace: his interests, what matters to him, his sense of humor, the people in his life and the places he goes. For each person, he can say how he talks with them. He's relaxed and brief with Ramon, and more careful with his doctor.",
      { card: { title: 'Sounding like you', lines: ['It speaks as him, not for him.'] } }),
    narrate("He can also go back over a saved conversation and rewrite anything that wasn't how he'd say it. The more he does that with someone, the more the options sound like him with that person. And it won't make things up. If someone asks what Marc did last night, it won't invent an answer, and it won't answer trivia as though he knew it. It speaks as him, not for him.",
      { card: { title: 'Sounding like you', lines: ['Rewrite what didn’t sound like you.', 'It won’t invent your life, or answer trivia as though you knew it.'] } }),

    // ===== DEMO 3: where that comes from =====
    narrate("Here's where that comes from. It's all in Settings.", { tap: '#settingsBtn', press: true }),
    { waitFor: '#settingsDialog[open]', ...tapIt(settingsTab('aboutme')) },
    // The topics are scrolled to the top, so the ring covers them and not the
    // questions above them. (About Me keeps the on-screen keyboard up by design.)
    { waitFor: topic('People in Your Life'),
      before: async (p) => {
        await p.evaluate(() => {
          const h = [...document.querySelectorAll('#settingsDialog[open] *')]
            .find((e) => e.children.length === 0 && e.textContent.trim() === 'Topics');
          h?.scrollIntoView({ block: 'start' });
        });
        await pause(500);
      },
      highlight: 'all:#settingsDialog[open] .wv-module-row',
      ...narrate("These are the topics in About Me. Marc answers as many or as few of the questions as he likes.") },
    narrate("Here are the people in his life.", { tap: topic('People in Your Life'), press: true }),
    { waitFor: '::-p-xpath(//div[starts-with(@id,"wvperson-")][.//*[contains(text(),"Ramon")]]//button[normalize-space(.)="Edit"])',
      ...tapIt('::-p-xpath(//div[starts-with(@id,"wvperson-")][.//*[contains(text(),"Ramon")]]//button[normalize-space(.)="Edit"])') },
    // "How I talk with them" opens by itself for a person who has settings there.
    { waitFor: '#settingsDialog[open] .wv-dim-row',
      before: (p) => p.$eval('#settingsDialog[open] .wv-dim-row', (el) => el.scrollIntoView({ block: 'start' })),
      highlight: 'all:#settingsDialog[open] .wv-dim-row',
      ...narrate("And this is how he talks with Ramon: relaxed, and a little shorter than usual.") },
    narrate("In Conversation Review, he can go back over a conversation and rewrite what didn't sound like him.",
      { tap: settingsTab('review'), press: true }),
    tapIt(section('Saved conversations')),
    { waitFor: '.review-row', ...tapIt('.review-row', { hold: 2 }) },
    { waitFor: 'body.reviewing', until: () => pause(600), ...tapIt('.review-current.turn-user', { hold: 2 }) },
    { waitFor: '#composerInput', before: async (p) => {
        await p.click('#composerInput', { clickCount: 3 });
        await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control');
        await p.keyboard.press('Backspace');
        await p.type('#composerInput', "Nah, I'm saving up for the Packers game.", { delay: 15 });
      },
      highlight: '#composerInput', hold: 3.6 },
    narrate("Then he saves his own version.", { tap: '#speakBtn', press: true }),

    // ===== TO CAMERA 4: where it stands =====
    narrate("All of this works today, in a web browser, on a Windows computer or tablet, a Mac, a Chromebook, an iPad, or an Android tablet. It works with a keyguard, and with eye gaze that moves the pointer.",
      { card: { title: 'Where it stands', lines: ['Windows, Mac, Chromebook, iPad and Android, in a web browser.', 'Works with keyguards, and with eye gaze that moves the pointer.'] } }),
    narrate("It's free and open source. Each user pays the AI company directly, only for what they use. On some devices they also pay for a speech service. There's no subscription, and no company sitting in the middle holding their conversations. What's ahead: having the app recognize where you are and who you're talking to on its own, and learning more from your own words over time.",
      { card: { title: 'Where it stands', lines: ['Free and open source. No subscription.', 'You pay the AI company directly, only for what you use.'] } }),
  ],

  // Everything above is shared. Each version adds its own last segment.
  endings: {
    // ===== ENDING: PUBLIC VERSION (ATIA and promotion) =====
    public: {
      file: 'Conversant AAC Demo',
      steps: [
        narrate("You'll find Conversant at conversant dot volksswitch dot org. If you try it, or know someone who might want to, I'd like to hear what you think.",
          { card: { title: 'Try Conversant AAC', lines: ['conversant.volksswitch.org'], foot: 'volksswitch.org' } }),
      ],
    },
    // ===== ENDING: BETA VERSION =====
    beta: {
      file: 'Conversant AAC Demo - Beta',
      steps: [
        narrate("None of this gets better without people using it in real conversations and telling me what's wrong. I'm looking for a small group of adults, 18 or older, who read, use AAC, and tap a screen or use eye gaze, to try it, break it, and push back on it.",
          { card: { title: 'Help us test it', lines: ['Adults 18 or older who read, use AAC,', 'and tap a screen or use eye gaze.'], foot: 'volksswitch.org' } }),
        narrate("During the beta, we cover the cost of the AI. If you're interested, or you know someone who might be, the way to reach me is on the screen.",
          { card: { title: 'Get in touch', lines: ['volksswitch.org/index.php/contact-us'], foot: 'During the beta, we cover the cost of the AI.' } }),
      ],
    },
  },
};
