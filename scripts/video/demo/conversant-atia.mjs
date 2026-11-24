// The ATIA 2027 video: how Conversant AAC gives a non-speaking person an
// authentic voice in real-time conversation with any partner, told through the
// principles of conversation analysis (Ken, November 24 2026). It is made to play
// inside the talk "Reimagining AAC: A Generative-AI Architecture for Real-Time
// Conversation", in place of the live demo and the Part 2 detail slides.
//
//   node scripts/video/render-video.mjs scripts/video/demo/conversant-atia.mjs
//
// Writes Videos/ATIA/Conversant AAC at ATIA 2027.mp4 and its caption file.
//
// THE AI'S WORDS ARE REAL, as in the demo video: recorded once with --capture into
// atia-ai-recording.json and replayed after the same wait. Re-record after any
// change to the prompt, to Marc's data, or to these steps, and watch the result.
//
// Shape: each chapter names a principle from conversation analysis on a title
// card, says what it changed in Conversant, then shows it in a real exchange.
// Two scenes: a coffee shop where Marc has never met the barista (any partner),
// and his comic shop with Ramon, who knows him well (the same voice, shaped for
// the person listening).

import os from 'node:os';
import path from 'node:path';
import {
  card, onScreen, hear, lastSpoken, markSpoken, untilNewSpeech, ownWordsBtn,
  typeInto, settingsTab, panelButtonWith, holdSpeech, topic,
} from '../helpers.mjs';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- The partners' lines (written for the video; the AI does not write these) ----
const B1 = "Hi there! What can I get for you today?";
const B2 = "You got it. Anything to eat with that? We've got cake pops, croissants, and breakfast sandwiches.";
const B3 = "Great. And what name should I put on the cup?";
const B4 = "Okay, Marc with a C. So how's your day going so far?";
const B5 = "Glad to hear it. Your order will be right up at the end of the counter. Have a good one!";

const R1 = "Hey Marc! How's your day going so far?";
const R2a = "So, the artist who draws your Spider-Man...";
const R2b = "is doing a signing here Saturday at noon. Want to come?";
const R3 = "No worries. Hey, your Spider-Man came in. You want the regular cover or the variant?";
const R4 = "Sorry, what?";
const R5 = "Ha, fair enough. Hey, did you catch who won the Bucks game last night?";
const R6 = "So what are you up to the rest of the weekend?";
const R7 = "Nice. Well, I should get back to the register. See you next Saturday!";

// ---- Timing (the same rules as the demo video) ----
const HOLDING_GAP = 2.0;   // the holding phrase, two seconds after the partner stops
const SILENCE = 0.5;       // the app notices the pause half a second after the last word
const markReq = async (p) => { p.reqMark = p.aiRequests || 0; };
const aiSeconds = async (p) => {
  const t0 = Date.now();
  while ((p.aiRequests || 0) <= (p.reqMark ?? 0)) {
    if (Date.now() - t0 > 30000) throw new Error('the AI was never asked');
    await pause(50);
  }
  return (await p.lastAIms) / 1000;
};
const untilOptionsLand = async (p, { lead, speak }) =>
  Math.max(1.0, SILENCE + await aiSeconds(p) - (HOLDING_GAP + lead + speak));
const waitForAI = (extra = 0.3) => async (p) => extra + await aiSeconds(p);

// An option found by its words (the real AI decides which position it lands in).
// Never the "Sorry, what?" card. With nothing matching, `fallback`.
const optionWhere = (re, fallback = 1) => async (page) => {
  const n = await page.evaluate((src) => {
    const cells = [...document.querySelectorAll('#responseOptions > .response-cell')];
    const rx = new RegExp(src, 'i');
    const i = cells.findIndex((c) => !c.classList.contains('slot-repair')
      && rx.test(c.querySelector('.response-text')?.innerText || ''));
    return i < 0 ? 0 : i + 1;
  }, re.source);
  return card(n || fallback);
};
// The option of one kind of move.
const slot = (kind) => `#responseOptions > .response-cell.slot-${kind}`;

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

const narrate = (say, extra = {}) => ({ speaker: 'narrator', say, ...extra });
const marcSays = (extra = {}) => ({ speaker: 'user', until: untilNewSpeech, say: lastSpoken, tail: 1.2, ...extra });
const tapIt = (tap, extra = {}) => ({ tap, press: true, hold: 1.2, ...extra });
// A partner speaks into the stand-in microphone.
// `settle` waits longer before the partner speaks. The app ignores, for a few
// seconds, anything that sounds like what it just said (so it never hears its own
// voice as the partner); a line that repeats Marc's words ("Marc with a C") must
// come after that window, as it would in a real room.
const partner = (speaker, line, waitWords, { settle = 0, ...extra } = {}) => ({
  speaker,
  before: async (p) => {
    await markSpoken(p); await markBoth(p);
    p.holdNextOptions(); await holdSpeech(p, true);
    if (settle) await pause(settle);
    await hear(p, line);
  },
  waitFor: onScreen(waitWords),
  say: line,
  tail: HOLDING_GAP,
  ...extra,
});
const barista = (line, w, extra) => partner('barista', line, w, extra);
const ramon = (line, w, extra) => partner('partner', line, w, extra);
const holding = () => ({ speaker: 'user', until: untilNewSpeech, whileSpeaking: true, say: lastSpoken, lead: 0, tail: untilOptionsLand });
const optionsArrive = (extra = {}) => ({
  before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); },
  waitFor: card(1) + ' .response-text', highlight: '#responseOptions', lead: 0.1, hold: 3.6, ...extra,
});
const newOptions = (extra = {}) => ({ until: untilNewOptions, highlight: '#responseOptions', lead: 0.1, hold: 3.6, ...extra });
// A partner starting to end the conversation: the goodbyes may come without a
// holding phrase, so the picture waits for the options rather than for speech.
const closingArrives = (extra = {}) => ({
  before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); },
  until: () => pause(1500), waitFor: card(1) + ' .response-text', highlight: '#responseOptions', lead: 0.1, ...extra,
});

// A picture of just the response options, kept for the side-by-side card.
const CLIPS = path.join(os.tmpdir(), 'conversant-video', 'atia-clips');
const shootOptions = (name) => async (p) => {
  const fs = await import('node:fs');
  fs.mkdirSync(CLIPS, { recursive: true });
  await p.evaluate(() => document.getElementById('vid-mark')?.remove());
  const clip = await p.$eval('#responseOptions', (e) => {
    const b = e.getBoundingClientRect();
    return { x: b.left, y: b.top, width: b.width, height: b.height };
  });
  await p.screenshot({ path: path.join(CLIPS, `${name}.png`), clip });
};
// End conversation takes a second tap (Ken, November 13 2026).
const endConversation = async (p) => {
  await p.click('#endConversationBtn'); await pause(250); await p.click('#endConversationBtn'); await pause(500);
};

const CA = 'Conversation analysis';

export default {
  id: 'conversant-atia',
  title: 'Conversant AAC at ATIA 2027',
  standalone: true,
  outDir: 'ATIA',
  inBrowserStorage: true,
  backup: 'Conference Demo/conversant-demo-marc.json',
  lead: 0.6,
  tail: 1.1,
  settings: {
    autoRelisten: true,
    keyboardMode: 'onscreen',
    // The holding phrase comes two seconds after every pause, as the timeline
    // card says. (By default it waits a little longer each exchange.)
    placeholderEaseOff: 0,
    convLayout: { bottom: { command: 0.10, response: 0.20, dock: 0.42 } },
  },
  adjustBackup(pkg) {
    const ep = pkg.data['express-panel.json'];
    ep.sizes = { ...ep.sizes, shape: 'rows', contextRows: 1, flexRows: 1 };
  },
  voices: {
    narrator: { name: 'Ken Hackbarth (cloned)', eleven: { id: 'UjNdMHnAjJXQL1HGr4ry', model: 'eleven_multilingual_v2', speed: 0.9, gap: 1.1, clause: 0.5,
      oneTake: true, settings: { stability: 0.7, similarity_boost: 0.8, style: 0, use_speaker_boost: true }, seed: 1107, loudness: -18 } },
    user: { name: 'Eric', eleven: { id: 'cjVigY5qzO86Huf0OWal', model: 'eleven_multilingual_v2', speed: 0.92 } },
    partner: { name: 'Charlie', eleven: { id: 'IKne3meq5aSn9XLyUdCD', model: 'eleven_multilingual_v2', speed: 0.92 } },
    barista: { name: 'River', eleven: { id: 'SAz9YHcvj6GT2YYXdXww', model: 'eleven_multilingual_v2', speed: 0.92 } },
  },
  ai: { recording: 'scripts/video/demo/atia-ai-recording.json' },

  steps: [
    // ===== 1. The requirement =====
    narrate("A conversational AAC system has to put something the user would actually say in front of them, and hold the floor, within about four seconds, turn after turn. A language model supplies the words. Conversation analysis supplies the structure.",
      { card: { title: 'The requirement', lines: ['Something the user would actually say,', 'and the floor held, within about four seconds,', 'turn after turn.'] } }),

    // ===== 2. One conversation, start to finish =====
    narrate("Marc is at the coffee shop near his school. He has never met this barista, and she needs no app and no training. One conversation, start to finish.",
      { card: { title: 'One conversation', lines: ['Marc has never met this barista.', 'She needs no app and no training.'] } }),
    narrate("He taps where he is, then Listen.", { tap: panelButtonWith('Starbucks'), press: true }),
    tapIt('#listenBtn'),
    barista(B1, 'What can I get'),
    holding(),
    optionsArrive({ after: async (p) => { p.firstWait = SILENCE + (await p.lastAIms) / 1000; } }),
    tapIt(optionWhere(/tea|usual/), { before: markSpoken }),
    marcSays(),
    barista(B2, 'Anything to eat'),
    holding(),
    optionsArrive({ waitFor: '#expressPanel .ep-choice', highlight: 'all:#responseOptions, #expressPanel .ep-choice' }),
    tapIt(optionWhere(/cake pop|croissant/), { before: markSpoken }),
    marcSays(),
    barista(B3, 'name should I put'),
    holding(),
    optionsArrive(),
    tapIt(optionWhere(/marc/), { before: markSpoken }),
    marcSays(),
    barista(B4, 'going so far', { settle: 4000 }),
    holding(),
    optionsArrive({ after: shootOptions('barista') }),
    tapIt(optionWhere(/good|not bad|fine|pretty|alright|okay/), { before: markSpoken }),
    marcSays(),
    barista(B5, 'Have a good one', { tail: 1.6 }),
    closingArrives({ hold: 3.2 }),
    tapIt(optionWhere(/thank|you too|bye|have a/), { before: markSpoken }),
    marcSays({ after: async (p) => { await endConversation(p); await p.click(panelButtonWith('Starbucks')); await pause(300); } }),

    // ===== 3. Words from the AI, structure from conversation analysis =====
    narrate("Here's that conversation on the architecture. Speech-to-text heard the barista. Marc had told the app where he was, and about himself.",
      { card: { title: 'The architecture as built', diagram: { lit: ['hearing', 'context', 'worldview'] } } }),
    narrate("A language model wrote the options, and a voice spoke the one he tapped. Each is a replaceable service, with no server in the middle.",
      { card: { title: 'The architecture as built', diagram: { lit: ['hearing', 'engine', 'speaking', 'boundary'] } } }),
    narrate("Underneath the engine is conversation analysis: decades of research on recordings of everyday talk, about how people take turns, accept and decline, fix trouble, and open and close. The words come from the language model. The structure comes from conversation analysis.",
      { card: { title: 'The architecture as built', diagram: { lit: ['ca', 'engine'] } } }),
    narrate("My original article left it out. Building the app showed why it matters. An early version had no rule for questions that offer choices. Asked, 'Is it mild, moderate, or severe?', it offered four ways to say 'mild.' In conversation analysis, those choices are what's due next. That's why the barista's list became Marc's options.",
      { card: { kicker: CA, title: 'Why it had to be built in', lines: ['“Is it mild, moderate, or severe?”', 'An early version offered four ways to say “mild.”'] } }),
    narrate("Here are five principles from conversation analysis, and what each one changed in Conversant.",
      { card: { kicker: CA, title: 'Five principles', lines: ['Turn-taking', 'Adjacency pairs and preference', 'Repair', 'Recipient design', 'Openings and closings'] } }),

    // ===== 4. Turn-taking =====
    narrate("Turn-taking. The gap between turns is usually under half a second, and silence starts to mean something at about one second.",
      { card: { kicker: CA, title: 'Turn-taking', lines: ['Gaps between turns: usually under half a second.', 'Silence starts to mean something at about one second.', 'The people talking decide who speaks next.'],
        foot: 'Sacks, Schegloff & Jefferson, 1974; Jefferson, 1989' } }),
    narrate("So Conversant holds the floor. Two seconds after the barista stopped, a holding phrase told her a reply was coming, before the options were even on screen. It's first person and neutral, never 'Good question.'",
      { card: (p) => {
        const w = Math.round((p.firstWait || 3) * 10) / 10;
        return { title: 'Holding the floor', lines: ['The first exchange at the coffee shop, as it happened.'],
          timeline: { seconds: Math.max(5, Math.ceil(w + 1)), marks: [
            { t: 0, label: 'The barista stops' },
            { t: SILENCE, label: 'The app notices the pause' },
            { t: HOLDING_GAP, label: 'Holding phrase' },
            { t: w, label: `Options on screen: ${w} s` },
          ] } };
      } }),
    narrate("Now his comic shop, with Ramon, who knows Marc well.",
      { card: { title: 'Someone Marc knows', lines: ['Ramon works the counter at Pulp Comics.'] } }),
    tapIt(panelButtonWith('Ramon')),
    tapIt(panelButtonWith('Pulp Comics')),
    tapIt('#listenBtn'),
    ramon(R1, 'going so far'),
    holding(),
    optionsArrive({ after: shootOptions('ramon') }),
    tapIt(optionWhere(/good|not bad|fine|pretty|alright|okay|solid/), { before: markSpoken }),
    marcSays(),
    narrate("Watch what happens when Ramon pauses partway through.", { highlight: '#transcriptSection' }),
    ramon(R2a, 'artist who draws'),
    holding(),
    optionsArrive({ hold: undefined, ...narrate("Every pause is a checkpoint. The app offers options for what he's said so far.") }),
    ramon(R2b, 'signing here Saturday', { tail: 0.6 }),
    { before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); }, until: untilNewOptions,
      highlight: '#responseOptions', lead: 0.1,
      ...narrate("When he goes on, the options are rewritten for all of it. His turn ends when Marc answers, not when the app guesses.") },

    // ===== 5. Adjacency pairs and preference =====
    narrate("Adjacency pairs and preference. A question makes an answer due. Yes is quick and plain. No comes softened, with a reason, which is why declining costs AAC users the most.",
      { card: { kicker: CA, title: 'Adjacency pairs and preference', lines: ['A question makes an answer due next.', 'Yes is quick and plain.', 'No comes softened, with a reason.'],
        foot: 'Schegloff & Sacks, 1973; Pomerantz, 1984' } }),
    narrate("So every turn, Conversant offers four kinds of move. The first agrees.", { highlight: slot('preferred') }),
    narrate("The second declines, the way people really do it.", { highlight: slot('dispreferred') }),
    narrate("The third takes a new direction, or asks a question back.", { highlight: slot('initiative') }),
    narrate("And the fourth asks what he meant.", { highlight: slot('repair') }),
    narrate("Each kind always sits in the same place, so position tells Marc what kind of move it is, not which is best. Declining politely is one tap.",
      { tap: slot('dispreferred'), press: true, before: markSpoken }),
    marcSays(),
    ramon(R3, 'regular cover or the variant'),
    holding(),
    optionsArrive({ waitFor: '#expressPanel .ep-choice', highlight: 'all:#responseOptions, #expressPanel .ep-choice', hold: undefined,
      ...narrate("And when someone offers choices, the choices themselves are what's due next. They become the options, in the order Ramon said them, and buttons too.") }),
    tapIt(optionWhere(/variant/), { before: markSpoken }),
    marcSays(),

    // ===== 6. Repair =====
    narrate("Repair. Trouble gets fixed right away, by the speaker or the listener, so a way to repair is always on screen.",
      { card: { kicker: CA, title: 'Repair', lines: ['Trouble gets fixed right away,', 'by the speaker or by the listener.'],
        foot: 'Schegloff, Jefferson & Sacks, 1977' } }),
    ramon(R4, 'what?', { tail: 3.0 }),
    { waitFor: card(3) + ' .response-text', before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); },
      until: async (p) => { while ((p.aiCount || 0) < (p.aiMark ?? 0) + 2) await pause(100); await pause(900); },
      highlight: '#responseOptions', lead: 0.1,
      ...narrate("Ramon didn't catch it. Marc can say it again, say it differently, or say a little more.") },
    tapIt(card(2), { before: markSpoken }),
    marcSays(),
    narrate("And when Marc doesn't catch what Ramon said, Ask them to repeat is always on the Command Bar.", { highlight: '#pardonBtn' }),

    // ===== 7. Recipient design =====
    narrate("Recipient design. People shape what they say for the person listening.",
      { card: { kicker: CA, title: 'Recipient design', lines: ['People shape what they say', 'for the person listening.'],
        foot: 'Sacks, Schegloff & Jefferson, 1974' } }),
    narrate("Both asked Marc the same question. The plain answer is the same, because that's how Marc talks. What follows is shaped for each: his caffeine and her shift for the barista, and for Ramon, 'Anything in for me?'",
      { card: { title: '“How’s your day going so far?”', compare: [
        { label: 'From the barista, whom Marc has never met', image: path.join(CLIPS, 'barista.png') },
        { label: 'From Ramon, who knows him well', image: path.join(CLIPS, 'ramon.png') },
      ] } }),
    narrate("That comes from what Marc has told the app about Ramon.", { tap: '#settingsBtn', press: true }),
    { waitFor: '#settingsDialog[open]', ...tapIt(settingsTab('aboutme'), { hold: 1.0 }) },
    { waitFor: topic('People in Your Life'), ...tapIt(topic('People in Your Life'), { hold: 1.0 }) },
    { waitFor: '::-p-xpath(//div[starts-with(@id,"wvperson-")][.//*[contains(text(),"Ramon")]]//button[normalize-space(.)="Edit"])',
      ...tapIt('::-p-xpath(//div[starts-with(@id,"wvperson-")][.//*[contains(text(),"Ramon")]]//button[normalize-space(.)="Edit"])', { hold: 1.0 }) },
    { waitFor: '#settingsDialog[open] .wv-dim-row',
      before: (p) => p.$eval('#settingsDialog[open] .wv-dim-row', (el) => el.scrollIntoView({ block: 'start' })),
      highlight: 'all:#settingsDialog[open] .wv-dim-row',
      ...narrate("Ramon keeps his pull list, and Marc talks with him relaxed and short. Marc answers questions like these at his own pace.",
        { after: async (p) => { await p.click('#closeSettingsBtn'); await pause(600); } }) },
    ramon(R5, 'who won the Bucks'),
    holding(),
    optionsArrive({ hold: undefined,
      ...narrate("An authentic voice is honest, too. It won't invent facts about Marc's life, or answer trivia as though he knew.") }),
    tapIt(optionWhere(/no idea|not sure|missed|didn.t|who won|don.t know/), { before: markSpoken }),
    marcSays(),
    ramon(R6, 'rest of the weekend'),
    holding(),
    optionsArrive({ hold: undefined, ...narrate("It does know Marc's usual weekend, because he told it.") }),
    narrate("When he wants his own words, he types them and taps Reframe.", { tap: ownWordsBtn, press: true }),
    { waitFor: '#composerInput', before: (p) => typeInto(p, '#composerInput', "Sunday dinner at Abuela's. Enchiladas."),
      highlight: '#composerInput', hold: 2.8 },
    tapIt('#reframeBtn', { before: markBoth, hold: 1.0, tail: waitForAI() }),
    newOptions({ hold: undefined, ...narrate("The options are rebuilt around them. Nothing is said until he taps one.") }),
    tapIt(optionWhere(/abuela|enchilada|sunday|dinner/), { before: markSpoken }),
    marcSays(),

    // ===== 8. Openings and closings =====
    narrate("Openings and closings. Conversations end in steps, and either person can start the ending, or put it off.",
      { card: { kicker: CA, title: 'Openings and closings', lines: ['Conversations end in steps.', 'Either person can start the ending,', 'and either can put it off.'],
        foot: 'Schegloff & Sacks, 1973' } }),
    ramon(R7, 'next Saturday', { tail: 1.6 }),
    closingArrives({ ...narrate("Ramon starts the ending. Marc gets goodbyes, plus one way to keep talking.") }),
    narrate("To start the ending himself, Marc taps Wrap up.", { highlight: '#windDownBtn' }),
    tapIt(optionWhere(/see you|later|bye|saturday/), { before: markSpoken }),
    marcSays({ after: async (p) => { await endConversation(p); await p.click(panelButtonWith('Pulp Comics')); await pause(300); } }),

    // ===== 9. A screen built around these moves =====
    narrate("The screen follows the same principles. Each kind of move always appears in the same place, so Marc learns where it lives, and a keyguard keeps working.",
      { highlight: '#responseOptions' }),
    narrate("The Command Bar always offers repair, holding the floor, and wrapping up.",
      { highlight: '#listenControls' }),
    narrate("And without the AI, his own phrases and his typing still speak.",
      { highlight: 'all:#expressPanel .ep-band-always' }),

    // ===== 10. Privacy and cost =====
    narrate("There's no account and no server. Marc's data stays on his device, and a whole conversation costs well under a dollar.",
      { card: { title: 'Privacy and cost', lines: ['No account, no server: Marc’s data stays on his device.', 'A whole conversation costs well under a dollar.'] } }),
  ],

  endings: {
    public: {
      file: 'Conversant AAC at ATIA 2027',
      steps: [
        narrate("The language model supplies the words. Conversation analysis supplies the structure. Marc decides what is said. It speaks AS him, not FOR him.",
          { card: { title: 'It speaks as him, not for him.', lines: ['Conversant AAC', 'conversant.volksswitch.org'] }, tail: 3 }),
      ],
    },
  },
};
