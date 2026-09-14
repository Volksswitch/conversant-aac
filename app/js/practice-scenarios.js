// Practice Mode scenario library (Architecture Overview §8; Ken, July 18 2026).
//
// In Practice Mode the AI plays the communication partner: it authors the
// partner's side of one of these scenarios (spoken via TTS), and the user selects
// responses exactly as in a real conversation — the microphone is bypassed, so the
// loop can be rehearsed in acoustically clean conditions before a real conversation.
//
// This is the bundled STARTER set (one per §8 category). They are never edited: the
// user makes a COPY and edits that (practice-library.js), so these stay a reliable
// starting point.
//
// Each scenario:
//   id            — stable key
//   category      — §8 grouping (Social / Practical / Professional / Medical / Personal)
//   title         — shown on the picker card and used in the conversation stamp
//   description   — one line shown under the title on the picker
//   opensWith     — 'partner' (the AI speaks first when the user taps Start Listening).
//                   All starter scenarios open with the partner, so the single
//                   Start-Listening-as-partner-cue flow is uniform. ('user' opens
//                   are a later addition.)
//   partnerPersona — a plain description of WHO the partner is, their goal and their
//                    tone, written with "you" meaning the USER, because a copy puts it
//                    in front of them to edit. Drives llm.generatePartnerUtterance.
//   register      — the interactional norm set (§8: scenarios set register explicitly).

import { TOUR_STEPS } from './practice-tour.js';

export const SCENARIOS = [
    // The controls tour. FIRST in the list on purpose: it is the one to do before any
    // of the others, because the rest assume you know which button is which.
    //
    // ⚠ IT IS A DIFFERENT KIND OF ENTRY — it carries `steps` and NO partnerPersona,
    // because nothing here is generated. Code that runs a scenario must branch on
    // which of the two it has; anything that assumes `partnerPersona` exists will
    // fail on this one. See practice-tour.js for why the tour is scripted and why it
    // must keep working with no API key.
    {
        id: 'controls-tour',
        category: 'Getting started',
        title: 'A tour of the buttons',
        description: 'Learn what each button does, one at a time. No API key needed.',
        opensWith: 'partner',
        steps: TOUR_STEPS,
        register: 'guided walkthrough',
    },
    {
        id: 'coffee-order',
        category: 'Practical',
        title: 'Ordering at a coffee shop',
        description: 'A friendly barista takes your order.',
        opensWith: 'partner',
        partnerPersona: 'A warm, upbeat barista at a small coffee shop. You are a customer who just walked up to the counter. They greet you, take your order, and ask the normal follow-ups (size, hot or iced, for here or to go, anything else). They keep their turns short and let you set the pace.',
        behavior: 'warm',
        register: 'casual, friendly service encounter',
    },
    {
        id: 'new-colleague',
        category: 'Social',
        title: 'Meeting a new colleague',
        description: 'Someone new introduces themselves at work.',
        opensWith: 'partner',
        partnerPersona: 'A friendly new colleague meeting you for the first time at work. They introduce themselves and make light small talk (how long you have worked here, what you do, plans for the weekend). Warm and easygoing, with short turns that leave you room to reply.',
        behavior: 'warm',
        register: 'friendly, informal workplace small talk',
    },
    {
        id: 'doctor-visit',
        category: 'Medical',
        title: 'A visit to the doctor',
        description: 'A doctor asks about how you have been feeling.',
        opensWith: 'partner',
        partnerPersona: 'A kind, unhurried family doctor. You are their patient at a routine visit. They ask how you have been feeling, follow up gently on what you say (when it started, how bad it is, anything that helps), and are reassuring. They ask one thing at a time and never lecture.',
        behavior: 'warm',
        register: 'calm, respectful medical consultation',
    },
    {
        id: 'friend-catchup',
        category: 'Personal',
        title: 'Catching up with a friend',
        description: 'A good friend wants to hear how you have been.',
        opensWith: 'partner',
        partnerPersona: 'A close, caring friend you have not seen in a while. They greet you warmly, ask how you have been, and react with genuine interest to whatever you share. They share a little about themselves too. Relaxed and personal, with short turns.',
        behavior: 'warm',
        register: 'warm, close, personal catch-up',
    },
    {
        id: 'job-interview',
        category: 'Professional',
        title: 'A job interview',
        description: 'An interviewer asks about you and your experience.',
        opensWith: 'partner',
        partnerPersona: 'A polite, professional hiring manager interviewing you for a job. They welcome you, then ask standard interview questions one at a time (tell me about yourself, why this role, a strength, a time you solved a problem). Encouraging, patient, and concise.',
        behavior: 'warm',
        register: 'polite, professional interview',
    },
];

export function getScenario(id) {
    return SCENARIOS.find(s => s.id === id) || null;
}
