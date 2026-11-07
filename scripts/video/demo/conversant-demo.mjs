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
// over title cards. The demos have no narration, only the real sound (Ramon,
// Marc, the barista) and short captions, as the filming script designed.
// Voices: Ken (narrator), Eric (Marc), Charlie (Ramon), River (the barista).

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
const untilNewOptions = async (p) => {
  const t0 = Date.now();
  while ((p.aiCount || 0) <= (p.aiMark ?? 0)) {
    if (Date.now() - t0 > 30000) throw new Error('no new options arrived');
    await pause(100);
  }
  await pause(900);
};
// Wait for the app to speak, then say what it said in Marc's voice.
const marcSays = (extra = {}) => ({ speaker: 'user', until: untilNewSpeech, say: said, ...extra });
// Ramon speaks into the stand-in microphone; the app hears him.
const ramon = (line, waitWords, extra = {}) => ({
  speaker: 'partner',
  before: async (p) => { await markSpoken(p); await markAI(p); p.holdNextOptions(); await holdSpeech(p, true); await hear(p, line); },
  waitFor: onScreen(waitWords),
  say: line,
  ...extra,
});
// The holding phrase that plays while the options are on their way.
const holding = (caption) => ({ speaker: 'user', until: untilNewSpeech, whileSpeaking: true, say: said, caption });
// The options arrive.
const optionsArrive = (caption, hold = 2.6) => ({
  before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); },
  waitFor: card(1) + ' .response-text', highlight: '#responseOptions', caption, hold,
});

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
  framed: true,
  inBrowserStorage: true,
  backup: 'Conference Demo/conversant-demo-marc.json',
  // Resume listening on its own, as the filming script asks, so Ramon can answer
  // without anyone tapping Listen between exchanges.
  settings: { autoRelisten: true },
  voices: {
    narrator: { name: 'Ken Hackbarth (cloned)', eleven: { id: 'UjNdMHnAjJXQL1HGr4ry', model: 'eleven_multilingual_v2' } },
    user: { name: 'Eric', eleven: { id: 'cjVigY5qzO86Huf0OWal', model: 'eleven_multilingual_v2' } },
    partner: { name: 'Charlie', eleven: { id: 'IKne3meq5aSn9XLyUdCD', model: 'eleven_multilingual_v2' } },
    barista: { name: 'River', eleven: { id: 'SAz9YHcvj6GT2YYXdXww', model: 'eleven_multilingual_v2' } },
  },
  ai: { recording: 'scripts/video/demo/demo-ai-recording.json' },

  steps: [
    // ===== TO CAMERA 1: the problem =====
    { speaker: 'narrator', card: { title: 'Four seconds', lines: ['Real conversation has a deadline nobody talks about.'] },
      say: "Real conversation has a deadline nobody talks about: about four seconds. Wait longer than that to answer, and the other person starts to fill the silence, change the subject, or give up." },
    { speaker: 'narrator', card: { title: TITLE, lines: ['Free and open source.', 'AI suggests replies within seconds, and you choose what is said.'] },
      say: "Most AAC can't meet that deadline, so the people who use it end up limited to short, practical exchanges instead of real conversation. Conversant AAC is a free, open-source app that uses AI to close that gap. Here's what it does." },

    // ===== DEMO 1: a conversation at the comic shop =====
    { card: { title: 'At the comic shop', lines: ['Marc is at Pulp Comics on a Saturday.', 'Ramon works the counter and keeps Marc’s pull list.'] }, hold: 4 },
    { tap: panelButtonWith('Ramon'), press: true, caption: "Tell it who you're with and where you are", hold: 2.2 },
    { tap: panelButtonWith('Pulp Comics'), press: true, caption: "Tell it who you're with and where you are", hold: 2.2 },
    { highlight: panelButtonWith('Keep it short'), caption: 'Phrases and goals for this person and this place', hold: 2.8 },
    { tap: '#listenBtn', press: true, caption: 'Tap Listen when they start to talk', hold: 2 },
    ramon(R1, 'pull list came in', { caption: 'The other person speaks; the app writes it down' }),
    holding('A holding phrase lets them know an answer is coming'),
    optionsArrive('Four options, written for this moment', 3.2),
    { tap: optionWhere(/what came|anything good|what.?s new|what.?s in/, 3), press: true, before: markSpoken, caption: "One tap, and it's spoken", hold: 1.2 },
    marcSays({ caption: "One tap, and it's spoken" }),
    ramon(R2, 'regular cover or the variant'),
    holding(),
    { before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); },
      waitFor: '#expressPanel .ep-choice', highlight: 'all:#expressPanel .ep-choice',
      caption: 'When they offer a choice, the choices become buttons', hold: 3 },
    { tap: optionWhere(/variant/), press: true, before: markSpoken, caption: 'When they offer a choice, the choices become buttons', hold: 1.2 },
    marcSays(),
    ramon(R3, 'eight bucks more'),
    holding(),
    optionsArrive('', 2.2),
    { tap: panelButtonWith('Keep it short'), press: true, before: markAI, caption: 'Goals steer the options. Nothing is said out loud.', hold: 2.2 },
    { until: untilNewOptions,
      highlight: '#responseOptions', caption: 'Goals steer the options. Nothing is said out loud.', hold: 3 },
    { tap: optionWhere(/worth|yeah|yes|still/), press: true, before: markSpoken, caption: 'Same positions, every time', hold: 1.2 },
    marcSays({ caption: 'Same positions, every time' }),

    // ===== TO CAMERA 2: nothing on the screen moves =====
    { speaker: 'narrator', card: { title: 'Nothing on the screen moves', lines: ['Only the words change.', 'So a keyguard keeps working.'] },
      after: (p) => p.click('#endConversationBtn'),
      say: "Notice that nothing on that screen moved. Only the words changed. That's on purpose. Many people who could use this rely on a keyguard, a plastic sheet with a hole over each button, so a hand with limited control doesn't hit the wrong one. If the buttons moved, the keyguard would be useless. What people can change is how it looks, without moving anything." },

    // ===== MONTAGE: layouts and colors =====
    { tap: '#settingsBtn', press: true, hold: 1, lead: 0.1, tail: 0.1 },
    { waitFor: '#settingsDialog[open]', tap: settingsTab('textsize'), press: true, hold: 1, lead: 0.1, tail: 0.1 },
    { tap: section('Colors'), press: true, hold: 0.8, lead: 0.1, tail: 0.1 },
    ...['bold', 'dark', 'yellow', 'cb'].map((v) => ({
      before: setSelect('#colorSchemeInput', `() => '${v}'`), highlight: '#colorSchemeInput',
      caption: 'Seven color schemes. Every button stays put.', hold: 1.7, lead: 0.1, tail: 0.1,
    })),
    { before: setSelect('#colorSchemeInput', "() => 'light'"), tap: settingsTab('express'), press: true, hold: 0.8, lead: 0.1, tail: 0.1 },
    { tap: section('Express Panel and Keyboard selection'), press: true, hold: 0.8, lead: 0.1, tail: 0.1 },
    { before: async (p) => { await p.evaluate(() => { window.__layoutWas = document.getElementById('bottomLayoutSelect').value; }); },
      highlight: '#bottomLayoutSelect', caption: 'Choose the layout and button size that work for you', hold: 1.6, lead: 0.1, tail: 0.1 },
    { before: setSelect('#bottomLayoutSelect', '(o, c) => o[(o.indexOf(c) + 3) % o.length]'), highlight: '#bottomLayoutSelect',
      caption: 'Choose the layout and button size that work for you', hold: 1.8, lead: 0.1, tail: 0.1 },
    { before: setSelect('#bottomLayoutSelect', '(o, c) => o[(o.indexOf(c) + 6) % o.length]'), highlight: '#bottomLayoutSelect',
      caption: 'Choose the layout and button size that work for you', hold: 1.8, lead: 0.1, tail: 0.1 },
    { before: async (p) => {
        await p.$eval('#bottomLayoutSelect', (el) => {
          el.value = window.__layoutWas;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await p.click(settingsTab('general'));
        await p.click(section('One tap or two'));
        await pause(400);
        await p.click('input[name="expressTapMode"][value="double"]');
        const mode = await p.evaluate(() => JSON.parse(localStorage.getItem('aac_settings')).expressTapMode);
        if (mode !== 'double') throw new Error('the two-tap setting did not take');
      },
      highlight: 'input[name="expressTapMode"][value="double"]',
      caption: 'Two taps, for anyone who hits buttons by accident', hold: 1.8, lead: 0.1, tail: 0.1 },
    { before: (p) => p.click(closeSettings),
      tap: panelButton('Anything in for me?'), press: true, caption: 'Two taps, for anyone who hits buttons by accident', hold: 0.3, lead: 0.1, tail: 0.1 },
    { highlight: panelButton('Anything in for me?'), caption: 'The first tap only marks it. The second says it.', hold: 2.2, lead: 0.1, tail: 0.3,
      after: async (p) => {
        await pause(1500);   // let the mark expire, so nothing is said
        // Two taps are on now, and Settings follows that rule too.
        await p.click('#settingsBtn'); await pause(150); await p.click('#settingsBtn');
        await p.waitForSelector('#settingsDialog[open]');
        await p.click(settingsTab('general'));
        await p.click('input[name="expressTapMode"][value="single"]');
        await p.click(closeSettings);
        await pause(600);
      } },

    // ===== DEMO 2: more ways to answer =====
    { card: { title: 'More ways to answer', lines: ['Same shop, a little later.'] }, hold: 2.6,
      after: async (p) => { await p.click(panelButtonWith('Ramon')); await pause(300); } },
    { tap: '#listenBtn', press: true, hold: 1.2, lead: 0.1 },
    ramon(R4, 'Batman one-shot'),
    holding(),
    optionsArrive('', 2.2),
    // Beat A: New 4
    { tap: '#regenerateBtn', press: true, before: markAI, caption: 'Not right? Ask for four more', hold: 1.4 },
    { until: untilNewOptions, highlight: '#responseOptions', caption: 'Not right? Ask for four more', hold: 2.8 },
    // Beat B: Reframe
    { tap: ownWordsBtn, press: true, caption: 'Type a hint, and the options are rewritten around it', hold: 1.2 },
    { waitFor: '#composerInput', before: (p) => typeInto(p, '#composerInput', 'saving up for the Packers game'),
      highlight: '#composerInput', caption: 'Type a hint, and the options are rewritten around it', hold: 2.6 },
    { tap: '#reframeBtn', press: true, before: markAI, caption: 'Type a hint, and the options are rewritten around it', hold: 1 },
    { until: untilNewOptions, highlight: '#responseOptions', caption: 'Type a hint, and the options are rewritten around it', hold: 3.4 },
    { tap: optionWhere(/packers|saving|skip|pass/), press: true, before: markSpoken, hold: 1 },
    marcSays(),
    // Beat E: when they didn't hear
    ramon(R5, 'what?'),
    // Wait for both answers: the three ways to repair, then their reworded text.
    { waitFor: card(3) + ' .response-text', before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); },
      until: async (p) => { while ((p.aiCount || 0) < (p.aiMark ?? 0) + 2) await pause(100); await pause(900); },
      highlight: '#responseOptions', caption: "Didn't catch it? Repeat it, reword it, or explain more", hold: 3.4 },
    { tap: card(2), press: true, before: markSpoken, caption: "Didn't catch it? Repeat it, reword it, or explain more", hold: 1 },
    marcSays(),
    ramon(R6, 'Anything else today'),
    holding(),
    optionsArrive('', 1.6),
    // Beat C: speak your own words
    { tap: ownWordsBtn, press: true, caption: 'Or type it yourself and it says exactly that', hold: 1 },
    { waitFor: '#composerInput', before: (p) => typeInto(p, '#composerInput', 'Can you put the next Ms. Marvel on my list too?'),
      highlight: '#composerInput', caption: 'Or type it yourself and it says exactly that', hold: 2.4 },
    { tap: '#speakBtn', press: true, before: markSpoken, hold: 0.6 },
    marcSays({ caption: 'Or type it yourself and it says exactly that' }),
    ramon(R7, 'set aside the new Spider-Man'),
    holding(),
    optionsArrive('', 1.4),
    // Beat D: an Express Panel phrase
    { tap: panelButton('Hold that one for me'), press: true, before: markSpoken, caption: 'Your own phrases, for this person and this place', hold: 1 },
    marcSays({ caption: 'Your own phrases, for this person and this place' }),
    // Beat F: wrapping up
    { tap: '#windDownBtn', press: true, caption: 'Ending a conversation takes two taps', hold: 1 },
    { waitFor: card(1) + ' .response-text', highlight: '#responseOptions', caption: 'Ending a conversation takes two taps', hold: 2.4 },
    { tap: card(1), press: true, before: markSpoken, caption: 'Ending a conversation takes two taps', hold: 0.8 },
    marcSays(),
    ramon(R8, 'next Saturday'),
    { before: async (p) => { await holdSpeech(p, false); p.releaseOptions(); }, until: () => pause(1500),
      waitFor: card(1) + ' .response-text', highlight: '#responseOptions', caption: 'Ending a conversation takes two taps', hold: 2 },
    { tap: optionWhere(/ramon|see you|later|bye/), press: true, before: markSpoken, caption: 'Ending a conversation takes two taps', hold: 0.8 },
    marcSays({ after: async (p) => { await p.click('#endConversationBtn'); await pause(400); await p.click(panelButtonWith('Pulp Comics')); } }),

    // Beat G: practice (Pulp Comics is switched off first: practice is a coffee shop)
    { tap: '#settingsBtn', press: true, caption: 'Practice: the AI plays the other person, so you can rehearse', hold: 1.2 },
    { waitFor: '#settingsDialog[open]', tap: settingsTab('practice'), press: true,
      caption: 'Practice: the AI plays the other person, so you can rehearse', hold: 1.2 },
    { waitFor: '.practice-card', tap: '::-p-xpath(//button[contains(@class,"practice-card")][.//*[text()="Ordering at a coffee shop"]])', press: true,
      caption: 'Practice: the AI plays the other person, so you can rehearse', hold: 1.8 },
    { tap: '#listenBtn', press: true, before: markSpoken, caption: 'Practice: the AI plays the other person, so you can rehearse', hold: 1 },
    { speaker: 'barista', until: untilNewSpeech, say: said, caption: 'Practice: the AI plays the other person, so you can rehearse' },
    { waitFor: card(1) + ' .response-text', highlight: '#responseOptions', caption: 'Practice: the AI plays the other person, so you can rehearse', hold: 2.4 },
    { tap: card(1), press: true, before: markSpoken, hold: 0.8 },
    marcSays({ after: async (p) => { await p.click('#endConversationBtn'); await pause(600); } }),

    // ===== TO CAMERA 3: sounding like you =====
    { speaker: 'narrator', card: { title: 'Sounding like you', lines: ['It speaks as him, not for him.'] },
      say: "The options sound like Marc because Marc told it who he is. There's a set of questions he answers at his own pace: his interests, what matters to him, his sense of humor, the people in his life and the places he goes. For each person, he can say how he talks with them. He's relaxed and brief with Ramon, and more careful with his doctor." },
    { speaker: 'narrator', card: { title: 'Sounding like you', lines: ['Rewrite what didn’t sound like you.', 'It won’t invent your life, or answer trivia as though you knew it.'] },
      say: "He can also go back over a saved conversation and rewrite anything that didn't sound like him. The more he does that with someone, the more the options sound like him with that person. And it won't make things up. If someone asks what Marc did last night, it won't invent an answer, and it won't answer trivia as though he knew it. It speaks as him, not for him." },

    // ===== DEMO 3: where that comes from =====
    { tap: '#settingsBtn', press: true, hold: 0.8, lead: 0.1 },
    { waitFor: '#settingsDialog[open]', tap: settingsTab('aboutme'), press: true, hold: 0.8, lead: 0.1 },
    { waitFor: topic('People in Your Life'), highlight: 'all:#settingsDialog[open] .wv-module-row',
      caption: 'Answer as many or as few as you like', hold: 2.8 },
    { tap: topic('People in Your Life'), press: true, caption: 'How you talk with each person', hold: 1 },
    { waitFor: '::-p-xpath(//div[starts-with(@id,"wvperson-")][.//*[contains(text(),"Ramon")]]//button[normalize-space(.)="Edit"])',
      tap: '::-p-xpath(//div[starts-with(@id,"wvperson-")][.//*[contains(text(),"Ramon")]]//button[normalize-space(.)="Edit"])', press: true,
      caption: 'How you talk with each person', hold: 1 },
    // "How I talk with them" opens by itself for a person who has settings there.
    { waitFor: '#settingsDialog[open] .wv-dim-row',
      before: (p) => p.$eval('#settingsDialog[open] .wv-dim-row', (el) => el.scrollIntoView({ block: 'start' })),
      highlight: 'all:#settingsDialog[open] .wv-dim-row',
      caption: 'How you talk with each person', hold: 3.6 },
    { tap: settingsTab('review'), press: true, caption: "Rewrite what didn't sound like you", hold: 1 },
    { tap: section('Saved conversations'), press: true, caption: "Rewrite what didn't sound like you", hold: 1 },
    { waitFor: '.review-row', tap: '.review-row', press: true, caption: "Rewrite what didn't sound like you", hold: 1.2 },
    { waitFor: 'body.reviewing', until: () => pause(600), tap: '.review-current.turn-user', press: true,
      caption: "Rewrite what didn't sound like you", hold: 1.6 },
    { waitFor: '#composerInput', before: async (p) => {
        await p.click('#composerInput', { clickCount: 3 });
        await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control');
        await p.keyboard.press('Backspace');
        await p.type('#composerInput', "Nah, I'm saving up for the Packers game.", { delay: 15 });
      },
      highlight: '#composerInput', caption: "Rewrite what didn't sound like you", hold: 2.6 },
    { tap: '#speakBtn', press: true, caption: "Rewrite what didn't sound like you", hold: 1.6 },

    // ===== TO CAMERA 4: where it stands =====
    { speaker: 'narrator', card: { title: 'Where it stands', lines: ['Windows, Mac, Chromebook, iPad and Android, in a web browser.', 'Works with keyguards, and with eye gaze that moves the pointer.'] },
      say: "All of this works today, in a web browser, on a Windows computer or tablet, a Mac, a Chromebook, an iPad, or an Android tablet. It works with a keyguard, and with eye gaze that moves the pointer." },
    { speaker: 'narrator', card: { title: 'Where it stands', lines: ['Free and open source. No subscription.', 'You pay the AI company directly, only for what you use.'] },
      say: "It's free and open source. Each user pays the AI company directly, only for what they use, and on some devices a speech service too. There's no subscription, and no company sitting in the middle holding their conversations. What's ahead: having the app recognize where you are and who you're talking to on its own, and learning more from your own words over time." },
  ],

  // Everything above is shared. Each version adds its own last segment.
  endings: {
    public: {
      file: 'Conversant AAC Demo',
      steps: [
        { speaker: 'narrator', card: { title: 'Try Conversant AAC', lines: ['conversant.volksswitch.org'], foot: 'volksswitch.org' },
          say: "Conversant is free to use. You'll find it at conversant dot volksswitch dot org. If you try it, or know someone who might want to, I'd like to hear what you think." },
      ],
    },
    beta: {
      file: 'Conversant AAC Demo - Beta',
      steps: [
        { speaker: 'narrator', card: { title: 'Help us test it', lines: ['Adults 18 or older who read, use AAC,', 'and tap a screen or use eye gaze.'], foot: 'volksswitch.org' },
          say: "None of this gets better without people using it in real conversations and telling me what's wrong. I'm looking for a small group of adults, 18 or older, who read, use AAC, and tap a screen or use eye gaze, to try it, break it, and push back on it." },
        { speaker: 'narrator', card: { title: 'Get in touch', lines: ['volksswitch.org/index.php/contact-us'], foot: 'During the beta, we cover the cost of the AI.' },
          say: "During the beta, we cover the cost of the AI. If you're interested, or you know someone who might be, the way to reach me is on the screen." },
      ],
    },
  },
};
