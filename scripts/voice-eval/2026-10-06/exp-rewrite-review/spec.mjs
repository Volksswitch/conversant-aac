// AUTHORED material for Test B, review by rewrite (October 6 2026). Everything here is
// invented: the rewrites, the reference lines (shown ONLY to the judge) and the new
// partner turns. No profanity anywhere, softened forms included.
//
// The two partners were chosen because Marc's real way of talking with them should be
// further from the AI's guess than it was for the October 6 Mom test:
//   Devon - his best friend, "how I talk with them" settings as they are. The gap is
//           Marc's teasing and slang with him.
//   Mom   - a BLUNT Marc who teases his mom, with Mom's settings removed (as the
//           NOPROFILE arm of exp-review-moment did). The AI's default for "Mom" is warm.
//           "Mom" or no form of address in his lines, never "Ma".
//
// Each rewritten turn: convo and key locate it in test-data-folder; `spoken` is what was
// said at the time (NOT given to the AI); `action` is what the partner was doing (tagged
// by hand); `rewrite` is what Marc would rather have said; `smallest` marks the one
// rewrite per conversation used by the smallest review (on the turn that sounded least
// like him). The full review reuses each smallest rewrite word for word.

export const PARTNERS = {
    devon: {
        personId: 'p-devon', label: 'Devon', judgeName: 'Devon', pron: 'him', noProfile: false,
        rewrites: [
            { convo: '2026-09-16T03-05-10', key: '2026-09-16T03:05:18.800Z', action: 'accused him of cheating',
              partner: 'okay that last race was completely rigged you know that right', spoken: 'Cry about it.',
              rewrite: "Nah bro, that's a skill issue." },
            { convo: '2026-09-16T03-05-10', key: '2026-09-16T03:05:38.100Z', action: 'made an offer',
              partner: 'wow. okay. rematch then, but you are picking Rainbow Road', spoken: 'Done.',
              rewrite: 'Bet. Prepare to get lapped, dude.' },
            { convo: '2026-09-16T03-05-10', key: '2026-09-16T03:12:49.900Z', action: 'teased him', smallest: true,
              partner: 'told you. rigged', spoken: 'No way',
              rewrite: 'Bro, you lost fair and square. Cope.' },
            { convo: '2026-09-24T02-20-00', key: '2026-09-24T02:20:02.800Z', action: 'invited him', smallest: true,
              partner: 'you going to the thing saturday', spoken: 'Saturday is comic shop day.',
              rewrite: "Nah, comic shop first. After that I'm down." },
            { convo: '2026-09-24T02-20-00', key: '2026-09-24T02:20:10.700Z', action: 'shared news',
              partner: 'after that. aisha is having people over', spoken: 'Is her place step-free?',
              rewrite: 'Bet, lowkey hyped. Her place step-free though?' },
            { convo: '2026-09-24T02-20-00', key: '2026-09-24T02:20:20.700Z', action: 'did him a favor',
              partner: 'yeah her basement door is flat. i checked', spoken: 'You checked? Thanks, man.',
              rewrite: 'Dude, clutch. Owe you one.' },
        ],
        reference: [
            'Bro, no shot. Run it back.',
            'Lowkey you got lucky.',
            "Nah, I'm chilling tonight.",
            "Dude, that's wild.",
            'Bet, see you at eight.',
            "You're washed, bro.",
            'Nope. Not doing that one.',
            "Ugh, my wifi's dying again.",
            'Ha, called it.',
            "Pass. I'm tired, dude.",
            'Down. What time?',
            'Easy money. Again?',
        ],
        // decline: true = written to invite a decline
        turns: [
            { id: 'DV1-tonight', action: 'invited him', text: 'yo you getting on tonight? we need a fourth' },
            { id: 'DV2-bucks', action: 'asked a question', text: 'bro did you see the bucks game last night' },
            { id: 'DV3-mariokart', action: 'invited him', decline: true, text: 'wanna run mario kart after school' },
            { id: 'DV4-dinner', action: 'invited him', text: 'my mom says you can stay for dinner friday' },
            { id: 'DV5-forza', action: 'asked a favor', decline: true, text: 'can you lend me your forza account for a sec' },
            { id: 'DV6-headset', action: 'shared news', text: "i got a new headset, it's actually so good" },
            { id: 'DV7-rainbow', action: 'teased him', text: 'you still mad about rainbow road' },
            { id: 'DV8-lake', action: 'invited him', decline: true, text: "aisha wants to know if you're coming to the lake sunday" },
            { id: 'DV9-trailer', action: 'asked a question', text: 'that new spider-man trailer dropped, did you watch it' },
            { id: 'DV10-gotta-go', action: 'wrapped up', text: "ok i gotta go, my mom's yelling" },
        ],
    },
    mom: {
        personId: 'p-elena', label: 'Mom', judgeName: 'his mom', pron: 'her', noProfile: true,
        rewrites: [
            { convo: '2026-09-13T12-12-30', key: '2026-09-13T12:12:32.800Z', action: 'asked a question',
              partner: 'Morning. Did you sleep any better last night?', spoken: 'Not really. It was a rough one.',
              rewrite: "Nope. Slept like garbage. Don't start." },
            { convo: '2026-09-13T12-12-30', key: '2026-09-13T12:12:44.100Z', action: 'made an offer', smallest: true,
              partner: 'Oh no. Do you want to skip swim today?', spoken: 'No, I still want to go.',
              rewrite: 'Nah. Not skipping, chill.' },
            { convo: '2026-09-13T12-12-30', key: '2026-09-13T12:12:51.300Z', action: 'asked him to do something',
              partner: 'Okay. Eat something before you go, please.', spoken: 'OK',
              rewrite: "Yeah yeah, I'll eat. Relax." },
            { convo: '2026-09-17T12-08-00', key: '2026-09-17T12:08:02.800Z', action: 'asked a question',
              partner: 'Chair is charged. Do you have everything?', spoken: 'Did you see my charger?',
              rewrite: "Obviously. Except my charger. Where'd it go?" },
            { convo: '2026-09-17T12-08-00', key: '2026-09-17T12:08:11.000Z', action: 'told him something', smallest: true,
              partner: 'Sofia had it. It is in your bag.', spoken: 'Thank you',
              rewrite: 'Of course it was Sofia. Classic.' },
            { convo: '2026-10-01T12-15-00', key: '2026-10-01T12:15:02.800Z', action: 'complained', smallest: true,
              partner: 'Ms. Whitaker emailed me about the competition. You did not tell me.', spoken: 'I wanted to fix it before anybody read it.',
              rewrite: "Because you'd make it a whole thing. Which you're doing." },
            { convo: '2026-10-01T12-15-00', key: '2026-10-01T12:15:15.800Z', action: 'praised him',
              partner: 'Marc. It was the best one in the class.', spoken: 'Can you read it and tell me?',
              rewrite: "Okay okay, calm down. It's an essay." },
            { convo: '2026-10-01T12-15-00', key: '2026-10-01T12:15:25.500Z', action: 'agreed to something',
              partner: 'I would love to. Send it to me.', spoken: 'OK',
              rewrite: 'Sure. No crying when you read it.' },
        ],
        reference: [
            "Mom. I'm fine. Stop hovering.",
            'Nope, not hungry.',
            'You worry too much, you know that?',
            'Sure, whatever you say.',
            'Ugh, again? Fine.',
            'Wow, dramatic much?',
            'Yeah, I did it. Relax.',
            "Not now, I'm in a match.",
            'Love you, but no.',
            "Chill, it's one grade.",
            'Classic you.',
            'Fine. Tomorrow. Happy?',
        ],
        turns: [
            { id: 'MM1-grocery', action: 'invited him', decline: true, text: 'Do you want to come to the grocery store with me?' },
            { id: 'MM2-abuela', action: 'asked him to do something', text: 'Abuela wants you to call her tonight. Will you?' },
            { id: 'MM3-volume', action: 'asked him to do something', decline: true, text: "Can you turn the game down a little? It's late." },
            { id: 'MM4-enchiladas', action: 'made an offer', text: 'I made extra enchiladas. Want some?' },
            { id: 'MM5-convention', action: 'shared news', text: 'Your dad and I want to take you to the comic convention in Chicago again this year.' },
            { id: 'MM6-swim', action: 'asked a question', text: 'How was swim today?' },
            { id: 'MM7-shoes', action: 'complained', text: 'You left your shoes in the hallway again.' },
            { id: 'MM8-movie', action: 'invited him', decline: true, text: 'Want to watch a movie with me tonight?' },
            { id: 'MM9-essay', action: 'asked a question', text: 'Did you finish your English essay draft?' },
            { id: 'MM10-pancakes', action: 'made an offer', text: 'Morning, sweetheart. Want pancakes?' },
        ],
    },
};

// Slang in the rewrites that is not on the INFORMAL list, listed for the reader.
export const EXTRA_SLANG = ['bet', 'skill issue', 'cope', 'clutch', 'hyped', 'lapped', "i'm down", 'obviously', 'classic', 'a whole thing', "don't start"];

// The crude-partner probe, run as Devon with the full set of rewrites.
export const CRUDE = { id: 'DV-crude', action: 'complained', text: 'That ref was absolute garbage, what the hell was that' };

// The review block, in the situation part of the instructions, with that person only.
// What the partner said, what they were doing, and what Marc would rather have said.
// What was said at the time is deliberately left out.
export function reviewBlock(p, rewrites) {
    const name = p.label, pr = p.pron;
    return [
        `How this user answers ${name}, from their own review of earlier conversations with ${pr}. Each line shows what ${name} was doing and saying, and the whole reply this user wrote afterward as what they would rather have said.`,
        ...rewrites.map((r) => `- ${name} ${r.action}: "${r.partner}" This user would rather have said: "${r.rewrite}"`),
        `Use these as evidence of how this user talks with ${name}: length, tone, and what comes first. Draw most on the ones where ${name} was doing what ${pr === 'her' ? 'she is' : 'he is'} doing now. Do not reuse their wording; this turn is about something else.`,
    ].join('\n');
}
