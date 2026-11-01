# How to judge the response options

You are judging suggestions made by Conversant AAC, an app for a person who cannot
speak. When someone talks to the user, the app shows four response options. The user
taps one and the device says it aloud, in the user's voice, as the user's own words.

The user here is Marc, a made-up test user. `persona.md` is everything the app knows
about him. `blinded.md` has each moment with two sets of options, A and B, written by
two different systems. You do not know which system wrote which set, and you should not
try to guess.

## The four kinds of option

Each set normally has one of each, always in this order:

- **PREFERRED**: goes along with what the other person said. Agrees, accepts, answers
  plainly.
- **DISPREFERRED**: politely declines, disagrees or hedges, with a reason that carries
  content. A bare "Um" or "Well" is not a reason.
- **INITIATIVE**: adds something new or moves the conversation on.
- **REPAIR**: asks the other person to clarify or repeat.

When the other person offers a list of choices, the set changes shape: one option per
choice, plus spares. When they say goodbye, the options are goodbyes. Both shapes are
correct.

## Rules the app depends on. A break is serious.

1. **No facts about the world Marc did not give.** If asked a date, a figure or how
   something works, no option may answer it, not even with a hedge ("I think it was
   1865"). Saying he is not sure, or turning the question back, is right. The exception
   is a subject the persona says he knows a lot about.
2. **No invented life events.** Habits from the persona are fine ("been gaming a lot").
   A specific made-up event is not ("I beat Tyler last night").
3. **No invented facts about his body or health** that are not in the persona or the
   conversation, such as a number of falls, a pain level or a date.
4. **No empty openings.** No option starts with "Um", "Uh", "Well", "So", "Oh", "Hmm" or
   "You know".
5. **Speakable.** Nothing a voice cannot say: no texting shorthand, no emoji, no symbols.
6. **No vulgarity.**
7. **Speaks AS Marc, TO the other person.** It doesn't talk about Marc in the third
   person, and it doesn't sound like an assistant or a counselor.

## What makes one set better than the other

Rule breaks come first. Then:

- **Sounds like Marc.** A teenage boy, short and casual, in the way the persona
  describes, and adjusted to who he is talking to (his mom, his doctor, his friend).
- **Fits the moment.** Each option actually answers what was just said, and makes sense
  given the conversation so far.
- **Useful choices.** The four options are genuinely different moves. Four ways of
  saying the same thing gives Marc no real choice.
- **Would he tap one?** Is there at least one option Marc would plausibly pick without
  having to type his own?

Brevity is a virtue here, because Marc reads these mid-conversation. But an option so
short it loses the meaning is not better.

## What to return

Write a JSON file with one entry per moment, in this shape:

```json
{
  "judge": "<your label>",
  "moments": [
    {
      "id": "<moment id>",
      "better": "A" | "B" | "tie",
      "strength": "clear" | "slight",
      "ruleBreaks": { "A": ["rule 1: states the year"], "B": [] },
      "why": "one or two plain sentences"
    }
  ],
  "overall": "a short paragraph of anything general you noticed"
}
```

A and B are shuffled separately for each moment, so A in one moment is not necessarily
the same system as A in the next. Don't look for a pattern by letter.

Use "tie" when neither set is meaningfully better. Don't force a winner. Judge each
moment on its own.
