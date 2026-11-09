// How-to video 3.11: taking questions after a talk.
//
// LIVE. Marc gives a talk to his class about how he uses Conversant. His topic and
// its two documents are already saved (written into the app's own storage before the
// first step), so the video shows the topic, adds its button to the Express Panel,
// and takes two questions. The answers are fixed in the script; the second question
// is one his documents don't cover, to show the "I don't know" answer.

import { settingsTab, card, cardSays, onScreen, hear, choose, fieldByHint, buttonText, untilListenOff,
  topic, panelButtonWith as panelButton } from '../helpers.mjs';

const TOPIC = 'My class talk';
const NOTES = `My talk: how I use Conversant

I have cerebral palsy and I don't speak. I use Conversant every day at school and with my friends.

When someone talks to me, Conversant listens and writes down what they said. Then it suggests four things I might say back, and I tap the one I want. It doesn't know what I want to say. It suggests, and I choose.

It knows a lot about me because I filled in my About Me answers: my friends, my games, and the Packers. So the suggestions sound like me. If none of the four fit, I type my own words.

Before Conversant, I had to spell everything out, and people would walk away before I finished. Now I can answer in a few seconds. I use it when I play games online with my friends, so I can keep up with the conversation.`;
const QUESTIONS = `Questions people ask me

Does it say things without me? No. Nothing is said until I tap it.

Does it make things up? No. If it doesn't know something about me, it says I don't know.

Does it ever mishear? Sometimes. I can see what it heard, and I can ask the person to say it again.`;

const words = (t) => t.split(/\s+/).filter(Boolean).length;
const DOCS = [
  { id: 'src-notes', title: 'My talk notes', base: 'My talk notes', text: NOTES },
  { id: 'src-questions', title: 'Questions people ask me', base: 'Questions people ask me', text: QUESTIONS },
];

const Q1 = 'How does it know what you want to say?';
const Q2 = 'Can it play video games for you too?';
const A1 = "It doesn't, really. It suggests four things I might say, and I pick the one I want.";
const A1B = 'It knows a lot about me because I filled in my About Me answers, like my friends, my games and the Packers. So the suggestions sound like me.';
const A2 = "I don't know, and I haven't thought about it very much.";

const topicCard = `::-p-xpath(//div[@id="wvtopic-tp-talk"])`;
const editBtn = `::-p-xpath(//div[@id="wvtopic-tp-talk"]//button[normalize-space(.)="Edit"])`;
const docList = '.wv-talk-docs';
const contextSection = '::-p-xpath(//summary[contains(normalize-space(.),"Context — describing")])';
const addBtn = (what) => `::-p-xpath(//button[contains(@class,"ee-add")][normalize-space(.)=${JSON.stringify(what)}])`;
const lastPicker = '::-p-xpath((//select[contains(@class,"ee-name-select")])[last()])';

// The two documents, written where the app keeps them on a device with no folder
// picker (the iPad's arrangement), so the topic finds them.
async function saveDocuments(page) {
  await page.evaluate(async (docs, now) => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('sources', { create: true });
    const put = async (name, text) => {
      const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await w.write(text);
      await w.close();
    };
    for (const d of docs) await put(`${d.base}.txt`, d.text);
    await put('index.json', JSON.stringify({ version: 1, documents: docs.map((d) => ({
      id: d.id, title: d.title, base: d.base, kind: 'paste', original: null,
      added: now, updated: now, words: d.words, chars: d.text.length })) }));
  }, DOCS.map((d) => ({ ...d, words: words(d.text) })), '2026-11-02T15:00:00.000Z');
}

export default {
  id: '3.11-taking-questions',
  title: 'Taking Questions After a Talk',
  settings: { maxPlaceholders: 0 },
  inBrowserStorage: true,
  storage: {
    aac_topics: { version: 1, topics: [{ id: 'tp-talk', name: TOPIC, pronunciation: '',
      sources: DOCS.map((d) => d.id), note: 'I use Conversant every day. This is a talk I give to my class.' }] },
  },
  ai: {
    answerSets: [
      { answers: [
        { kind: 'short', label: 'It suggests, I pick', text: A1 },
        { kind: 'angle', label: 'It knows about me', text: A1B },
        { kind: 'angle', label: 'I can type my own', text: "If none of the four fit, I type my own words instead. It's still me talking." },
        { kind: 'angle', label: 'Faster than spelling', text: 'Before, I had to spell everything out, and people walked away before I finished. Now I can answer in a few seconds.' },
      ] },
      { answers: [
        { kind: 'short', label: "Don't know", text: A2 },
        { kind: 'angle', label: 'Helps me talk while we play', text: 'What I do know is it helps me talk with my friends while we play online, so I can keep up.' },
        { kind: 'angle', label: 'It suggests, I choose', text: "It doesn't do things for me. It suggests what I might say, and I choose." },
        { kind: 'angle', label: "It's for conversations", text: "It's made for conversations, so that's what I use it for." },
      ] },
    ],
  },
  trouble: [
    "No answers appear? Check that the topic's button is switched on and that the topic has documents checked.",
    "A PDF that's a scan of printed pages has no text in it. Copy the text from somewhere else and use Paste text.",
  ],
  steps: [
    { speaker: 'narrator', before: saveDocuments,
      say: "After a talk, people ask questions. Conversant can help you answer them from your own material, like your notes, a web page or a pamphlet." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Marc gives a talk to his class about how he uses Conversant. Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('aboutme'), press: true,
      say: "then About Me," },
    { speaker: 'narrator', waitFor: topic('My Topics'), highlight: topic('My Topics'), press: true,
      say: "and My Topics." },
    { speaker: 'narrator', waitFor: topicCard, highlight: topicCard,
      say: "Marc has already added a topic for his talk." },
    { speaker: 'narrator', tap: editBtn, press: true,
      say: "Tap Edit to see what's in it." },
    { speaker: 'narrator', waitFor: docList, highlight: docList,
      page: "In Settings, About Me, My Topics, add a topic and the documents your answers come from: a PDF, or text you paste in.",
      say: "These are the documents his answers come from: his talk notes, and a page of questions people often ask him. You add your own with Add a PDF or text file, or by pasting in text." },
    { speaker: 'narrator', highlight: fieldByHint('How you relate'),
      page: "Say how you relate to the material, so the answers say \"I\" the right way.",
      say: "The note says how Marc relates to the material. He uses Conversant every day, so his answers can say so." },
    { speaker: 'narrator', highlight: buttonText('Done'), press: true,
      say: "Tap Done." },
    { speaker: 'narrator', waitFor: settingsTab('express'), highlight: settingsTab('express'), press: true,
      say: "Now give the topic a button. Open Express Panel and Keyboard," },
    { speaker: 'narrator', highlight: contextSection, press: true,
      say: "and the Context section." },
    { speaker: 'narrator', highlight: addBtn('Add a topic'), press: true,
      page: "In Express Panel and Keyboard, Context, tap Add a topic and choose your topic.",
      say: "Tap Add a topic," },
    { speaker: 'narrator', waitFor: lastPicker, before: (p) => choose(p, lastPicker, TOPIC), highlight: panelButton(TOPIC),
      say: "and choose his talk. Its button is on the panel now." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings." },
    { speaker: 'narrator', tap: panelButton(TOPIC), press: true,
      page: "At the talk, tap your topic's button, then Listen for each question. End conversation switches the topic off.",
      say: "When the questions start, Marc taps his topic's button," },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "and Listen." },
    { speaker: 'partner', before: (p) => hear(p, Q1), waitFor: cardSays(1, 'It suggests, I pick'), say: Q1 },
    { speaker: 'narrator', highlight: '#responseOptions',
      page: "You get four answers from your documents, a short one first. They stay on screen, so you can add a second. Tap one while it plays to pause it.",
      say: "Instead of everyday options, he gets four answers drawn from his documents. The first, in green, is short. The other three go deeper." },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "He starts with the short one." },
    { speaker: 'user', waitFor: onScreen(A1), say: A1 },
    { speaker: 'narrator', highlight: card(2),
      say: "The answers stay on screen, so he can say more. And if he taps an answer while it's playing, it pauses, so he can add something and then carry on." },
    { speaker: 'narrator', tap: card(2), press: true,
      say: "He adds this one." },
    { speaker: 'user', waitFor: onScreen(A1B.slice(0, 40)), say: A1B },
    { speaker: 'narrator', before: untilListenOff, highlight: '#listenBtn', press: true,
      say: "For the next question, he taps Listen again. That clears the answers." },
    { speaker: 'partner', before: (p) => hear(p, Q2), waitFor: cardSays(1, "Don't know"), say: Q2 },
    { speaker: 'narrator', highlight: card(1),
      page: "If your documents don't cover a question, an answer says you don't know instead of guessing.",
      say: "His notes don't cover that, so the short answer says he doesn't know. Conversant never makes up an answer for him." },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "Marc says so," },
    { speaker: 'user', waitFor: onScreen(A2), say: A2 },
    { speaker: 'narrator', highlight: '#endConversationBtn', press: true,
      say: "When the questions are over, he taps End conversation. That switches his topic off too, so his next conversation gets everyday options again." },
    { speaker: 'narrator',
      say: "The guide called Taking Questions After a Talk has more on getting ready. {next}" },
  ],
};
