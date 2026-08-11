/* Tier 1 — worldview profile block + privacy model (app/js/worldview.js).
 *
 * The load-bearing behavior is the three-level privacy model that governs what
 * reaches the LLM (Ken, June 19 2026): Shareable (value sent, freely usable),
 * Private (value sent, "don't volunteer"), Declined (NO value, phrase-around only).
 * Registry is fetched from the real app/data/worldview-questions.json off disk.
 */
import { resetLocalStorage, mockFetchFromDisk } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as wv from '../app/js/worldview.js';

let shareableKey;   // a field whose default privacy is not 'private'

beforeEach(async () => {
    resetLocalStorage();
    mockFetchFromDisk();
    await wv.loadRegistry();
    await wv.load();          // fresh empty profile from the (cleared) cache
    // Find a field the registry defaults to shareable.
    shareableKey = null;
    for (const mod of wv.getRegistry().modules) {
        for (const f of mod.fields) {
            if ((f.defaultPrivacy || 'shareable') !== 'private') { shareableKey = f.key; break; }
        }
        if (shareableKey) break;
    }
    assert.ok(shareableKey, 'the registry has at least one shareable field');
});

test('an empty profile injects no profile block', () => {
    assert.equal(wv.buildBlock(), '');
});

test('SHAREABLE: an answered field is listed as a usable fact', async () => {
    await wv.setField(shareableKey, 'ZEBRAVALUE');
    const block = wv.buildBlock();
    assert.match(block, /What you know about them/);
    assert.match(block, /ZEBRAVALUE/);
    assert.doesNotMatch(block, /do not volunteer/i);
});

test('PRIVATE: the value IS sent but flagged do-not-volunteer', async () => {
    await wv.setField(shareableKey, 'ZEBRAVALUE');
    await wv.setPrivacy(shareableKey, 'private');
    const block = wv.buildBlock();
    assert.match(block, /ZEBRAVALUE/, 'private value is still sent for context');
    assert.match(block, /do not volunteer them spontaneously/i);
    // "Do not volunteer" is only followable if the model is told what DOES ask for it.
    // The rule used to end "only include them if the user selects a response that
    // does" — nothing that exists when the options are written (Ken, August 3 2026).
    assert.match(block, /partner has asked/i, 'the partner asking is a prompt');
    assert.match(block, /typed guidance/i, 'the user steering via Reframe is a prompt');
    assert.doesNotMatch(block, /selects a response that does/i, 'names a mechanism that does not exist');
});

test('DECLINED: no value is sent, only a phrase-around instruction', async () => {
    await wv.setField(shareableKey, 'ZEBRAVALUE');
    await wv.declineField(shareableKey);
    const block = wv.buildBlock();
    assert.doesNotMatch(block, /ZEBRAVALUE/, 'declined value must NOT reach the model');
    assert.match(block, /chose not to share/i);
});

test('decline is reversible without data loss (value withheld while declined, restored on undo)', async () => {
    await wv.setField(shareableKey, 'ZEBRAVALUE');
    await wv.declineField(shareableKey);
    assert.equal(wv.getField(shareableKey), null, 'getField withholds a declined value');
    assert.ok(wv.hasStashedAnswer(shareableKey), 'the prior answer is stashed');
    await wv.undeclineField(shareableKey);
    assert.equal(wv.getField(shareableKey), 'ZEBRAVALUE', 'undo brings the answer back');
});

test('gaps: recordGaps logs only genuine open gaps; answering clears them', async () => {
    await wv.clearGaps();
    await wv.recordGaps(['fav_food', shareableKey], 'what do you like to eat?');
    // The already-answerable key should not be logged as a gap once answered.
    await wv.setField(shareableKey, 'pizza');
    await wv.recordGaps([shareableKey], 'x');
    const gaps = wv.listGaps().map((g) => g.key);
    assert.ok(gaps.includes('fav_food'), 'the real gap is recorded');
    assert.ok(!gaps.includes(shareableKey), 'an answered field is not an open gap');
});

// --- directive fields (August 7 2026) ----------------------------------------
// Some answers are instructions, not facts. "Topics I would rather not be asked
// about" listed as `- Topic to avoid: X` is only information, and leaves the model
// to infer what to do with it. That is too thin for what the persona audit called
// the single highest-value missing field.

test('a directive field becomes a RULE, not another listed fact', async () => {
    await wv.setField('topics_avoid', ['what happened to me']);
    const block = wv.buildBlock();
    assert.match(block, /Never raise any of it on your own initiative/);
    assert.doesNotMatch(block, /- [^\n]*Topic to avoid/i, 'must not also appear as a fact line');
});

test('the avoid rule is not an absolute ban — the user may still raise it themselves', async () => {
    await wv.setField('topics_avoid', ['my health']);
    const block = wv.buildBlock();
    // A card that refused to discuss the user's own life would be its own failure.
    assert.match(block, /If the user steers you to it themselves, follow them/);
    // And the partner may raise it regardless — the app controls only its own output.
    assert.match(block, /lets the user move the conversation on/);
});

test('a seek field is offered as INITIATIVE ground', async () => {
    await wv.setField('topics_welcome', ['films', 'music']);
    assert.match(wv.buildBlock(), /always enjoys talking about: films, music/);
});

test('directive fields alone still produce a block (they are not facts)', async () => {
    await wv.setField('topics_avoid', ['my health']);
    assert.notEqual(wv.buildBlock(), '', 'a profile of only directives must not come out empty');
});

// --- the expertise exception (August 8 2026) ---------------------------------
// The prompt otherwise refuses to answer any question needing world knowledge,
// because the model cannot know what is in this person's head. Naming a subject
// here is the user saying that it IS — the one exception they can grant themselves.

test('an expertise answer lifts the knowledge rule, and says it does', async () => {
    await wv.setField('expertise', ['astronomy', 'model trains']);
    const block = wv.buildBlock();
    assert.match(block, /knows the following subjects WELL[^\n]*astronomy, model trains/);
    assert.match(block, /rule against supplying outside knowledge is lifted/);
    assert.doesNotMatch(block, /- [^\n]*[Ss]ubject I know well/, 'must not also appear as a fact line');
});

// It widens what may be put in the user's mouth, so it must widen no further than
// the subjects they named — an adjacent-sounding topic is still outside.
test('the expertise exception is scoped to the named subjects and forbids lecturing', async () => {
    await wv.setField('expertise', ['astronomy']);
    const block = wv.buildBlock();
    assert.match(block, /does not\s+extend to neighboring or merely related subjects/);
    // Live check on the first cut came back with a paragraph and the Einstein
    // anecdote — declared expertise licenses substance, never a lecture.
    assert.match(block, /a sentence or two/);
    assert.match(block, /No lead-ins, no history of the idea, no famous quotes/);
});

// An empty answer must leave the rule fully in force — the same neutral-produces-
// nothing property the trait and per-partner blocks rely on.
test('no expertise answer means no lifting text at all', async () => {
    await wv.setField('fav_color', 'green');
    assert.doesNotMatch(wv.buildBlock(), /is lifted/);
});

// --- B2: humor (August 8 2026) -----------------------------------------------
// Prompted by the smart-speaker fix: a real person asked something they can't
// answer is more likely to be wry than flat, and nothing in the app knew whether
// that suited them. Humor is a directive, never a fact line — "sarcastic" listed
// as a fact leaves the model to guess, and its two guesses are opposite.

test('humor becomes an instruction, not another listed fact', async () => {
    await wv.setField('b2_style', ['Sarcastic']);
    await wv.setField('b2_cheeky', 'Yes, whenever it fits');
    const block = wv.buildBlock();
    assert.match(block, /How this person does humor/);
    assert.match(block, /Their sense of humor: Sarcastic/);
    assert.doesNotMatch(block, /- [^\n]*sense of humor/i, 'must not also appear as a fact line');
});

// The hard limit. A joke in the user's own voice cannot be taken back, and a card
// can be tapped by mistake — so a straight option must always survive.
test('licensed humor is capped at one option and barred from serious turns', async () => {
    await wv.setField('b2_style', ['Dry or deadpan']);
    await wv.setField('b2_cheeky', 'Yes, whenever it fits');
    const block = wv.buildBlock();
    assert.match(block, /at most ONE response on any turn may be the playful one/);
    assert.match(block, /never go light on a turn that is serious, upsetting or medical/);
    assert.match(block, /never state or describe any of this/);
    // The case that prompted the module.
    assert.match(block, /cannot answer something, a light brush-off/);
});

test('declining joking suggestions produces a prohibition, and nothing else', async () => {
    await wv.setField('b2_style', ['Sarcastic']);
    await wv.setField('b2_teasing', 'I enjoy it');
    await wv.setField('b2_cheeky', 'No — keep my suggestions straight');
    const block = wv.buildBlock();
    assert.match(block, /does not want joking or cheeky suggestions/);
    // A decline must override the rest. Leaving "sarcastic, enjoys teasing" in the
    // prompt beside a prohibition is an invitation to split the difference.
    assert.doesNotMatch(block, /Sarcastic/);
    assert.doesNotMatch(block, /enjoy back-and-forth teasing/);
    assert.doesNotMatch(block, /light brush-off/);
});

// Someone who ticks only "I'm not much of a joker" and never reaches the permission
// question has answered it in substance. Defaulting that to licensed would offer
// jokes to the one person who told us they do not make them.
test('"not much of a joker" alone reads as a decline', async () => {
    await wv.setField('b2_style', ["I'm not much of a joker"]);
    assert.match(wv.buildBlock(), /does not want joking or cheeky suggestions/);
});

// Silence is not permission — the standing shape of every consent-ish field here.
test('a humor style with no permission answer does not license a joke', async () => {
    await wv.setField('b2_style', ['Witty — I like clever wordplay']);
    const block = wv.buildBlock();
    assert.match(block, /NOT said whether they want joking suggestions, so do not\s+offer one/);
    assert.doesNotMatch(block, /light brush-off/);
});

test('the close-only answers scope humor and teasing to close partners', async () => {
    await wv.setField('b2_teasing', "Only with people I'm close to");
    await wv.setField('b2_cheeky', "Only with people I'm close to");
    const block = wv.buildBlock();
    assert.match(block, /never with a stranger, and never in a formal setting/);
    assert.match(block, /With anyone else, keep every option straight/);
});

// A stated "no" must beat inferred style evidence. Found live: with wry Sound Check
// selections in the prompt, the model went light anyway and the refusal was simply
// lost. The model will not rank two kinds of instruction on its own, so say which
// wins — a refusal that quietly loses to an example is worse than never asking.
test('a decline explicitly overrides the Sound Check style examples', async () => {
    await wv.setField('b2_cheeky', 'No — keep my suggestions straight');
    assert.match(wv.buildBlock(), /OVERRIDES the style examples/);
});

test('no humor answers means no humor text at all', async () => {
    await wv.setField('fav_color', 'green');
    assert.doesNotMatch(wv.buildBlock(), /How this person does humor/);
});

/*
 * The drift tripwire, and it matters more here than for the Likert scale. A trait
 * string that stops matching loses an answer; HUMOR_DECLINE failing to match does
 * not lose "no thanks" — it turns it into permission. buildBlock recognises these
 * by value, so the registry must keep authoring them verbatim.
 */
test('every humor answer buildBlock recognises is still authored in the registry', async () => {
    const reg = JSON.parse(
        await readFile(new URL('../app/data/worldview-questions.json', import.meta.url), 'utf8')
    );
    const b2 = reg.modules.find(m => m.id === 'B2');
    assert.ok(b2, 'module B2 must exist, and must be B2 — the number is the question bank\'s');
    const opts = new Set(b2.fields.flatMap(f => f.options || []));
    for (const s of [
        'No — keep my suggestions straight',
        "I'm not much of a joker",
        "Only with people I'm close to",
        'Not really my thing',
        'Yes, whenever it fits',
        'I enjoy it',
    ]) {
        assert.ok(opts.has(s), `buildBlock matches on "${s}" but no B2 option offers it`);
    }
    // Every field must route through the directive, or it silently becomes a fact line.
    for (const f of b2.fields) {
        assert.equal(f.directive, 'humor', `${f.key} must carry directive: "humor"`);
        assert.ok(['style', 'teasing', 'permission'].includes(f.humorAspect),
            `${f.key} needs a humorAspect buildBlock knows`);
    }
});

// --- B5 beliefs (August 8 2026) ----------------------------------------------
/*
 * The strictest block in the file. The private-fact treatment handles disclosure
 * and nothing else, and for faith and politics disclosure is the SMALLER risk —
 * the larger is a card that takes a position, spoken in the user's voice, which
 * happens whether or not the belief is ever named. Knowing is safer than guessing,
 * so the values are sent; the rule is what makes sending them safe.
 */
test('beliefs are sent as context but barred from ever being raised or argued', async () => {
    await wv.setField('b5_faith', "Yes — it's important to me");
    await wv.setField('b5_faith_tradition', 'Quaker');
    const block = wv.buildBlock();
    assert.match(block, /Faith or spirituality: Yes[^.]*\(Quaker\)/);
    assert.match(block, /NEVER raise faith, politics or a social issue on your own initiative/);
    assert.match(block, /argues a side, agrees with a claim, or concedes a point/);
    assert.match(block, /not material to use/);
});

// A partner CAN raise these, and the app controls only its own output — so the
// answer is an escape route, the same shape as the topics_avoid rule.
test('when the partner raises a belief topic, not engaging must be an option', async () => {
    await wv.setField('b5_politics', 'Yes, strong ones');
    const block = wv.buildBlock();
    assert.match(block, /as much or as little as they choose/);
    assert.match(block, /a way to not engage at all/);
});

test('a belief field never appears as an ordinary fact line', async () => {
    await wv.setField('b5_politics', 'Some');
    await wv.setField('b5_politics_lean', 'left of centre');
    const block = wv.buildBlock();
    assert.doesNotMatch(block, /- [^\n]*political/i);
    assert.match(block, /Strong social or political views: Some \(left of centre\)/);
});

// Outlook is a disposition, not a conviction. Lumping it in with faith and politics
// would saddle "optimist" with the never-raise rules and make it unusable.
test('outlook is kept out of the beliefs block and stays usable', async () => {
    await wv.setField('b5_outlook', 'Skeptic — I expect the catch');
    const block = wv.buildBlock();
    assert.match(block, /general outlook on things: Skeptic/);
    assert.doesNotMatch(block, /NEVER raise faith/);
});

// --- B6 register by relationship category ------------------------------------
/*
 * NOT a duplicate of the per-partner profile, which is per NAMED person on the
 * graph. This is per CATEGORY, so it covers the partner nobody has written a
 * profile for — strangers included, who by definition are never in the graph.
 */
test('group shifts are emitted as wording defaults that per-person data overrides', async () => {
    await wv.setField('b6_strangers', 'More guarded');
    await wv.setField('b6_friends', 'More open and relaxed');
    const block = wv.buildBlock();
    assert.match(block, /with strangers and new people, more guarded/);
    assert.match(block, /with close friends, more open and relaxed/);
    assert.match(block, /governs WORDING only/);
    assert.match(block, /specific named person overrides this/);
});

// "About the same" is the neutral answer and must cost nothing — the same
// property the Likert middle and the per-partner register both rely on.
test('"About the same" contributes no clause, and all-neutral emits nothing', async () => {
    await wv.setField('b6_family', 'About the same');
    await wv.setField('b6_kids', 'About the same');
    assert.doesNotMatch(wv.buildBlock(), /How this person shifts/);

    await wv.setField('b6_authority', 'More formal');
    const block = wv.buildBlock();
    assert.match(block, /with someone in authority, more formal/);
    assert.doesNotMatch(block, /with family/, 'a neutral group must not be listed');
});

// --- B7 conflict style and the "one thing" -----------------------------------
test('conflict style is aimed at the DISPREFERRED option', async () => {
    await wv.setField('b7_conflict', 'I use humor to take the heat out of it');
    const block = wv.buildBlock();
    assert.match(block, /tension or disagreement/);
    assert.match(block, /Shape the DISPREFERRED option around that/);
    assert.match(block, /Never state it/);
});

// The one entry the user may well WANT said, so it takes the opposite shape to the
// never-raise rules: do not introduce it, but let them reach it when asked.
test('the "one thing" is not raised but is reachable when the partner opens the door', async () => {
    await wv.setField('b7_understand', 'I am slower to answer, not slower to think');
    const block = wv.buildBlock();
    assert.match(block, /Do NOT raise it yourself and never quote/);
    assert.match(block, /when the partner touches on it, make sure one of the options/);
});

// The registry drift tripwire, extended to the new directives. buildBlock routes on
// these strings; a field authored without one silently becomes a plain fact line —
// which for a B5 field would mean a private belief listed as an ordinary fact.
test('every Tier B directive field is wired to a directive buildBlock knows', async () => {
    const reg = JSON.parse(
        await readFile(new URL('../app/data/worldview-questions.json', import.meta.url), 'utf8')
    );
    const known = {
        B5: ['belief', 'outlook'],
        B6: ['register_group'],
        B7: ['conflict', 'understand'],
    };
    for (const [id, allowed] of Object.entries(known)) {
        const mod = reg.modules.find(m => m.id === id);
        assert.ok(mod, `module ${id} must exist — the number is the question bank's`);
        for (const f of mod.fields) {
            assert.ok(allowed.includes(f.directive),
                `${f.key}: directive "${f.directive}" is not one buildBlock handles`);
        }
    }
    // Faith and politics must stay private by default, as the June privacy model set.
    for (const key of ['b5_faith', 'b5_faith_tradition', 'b5_politics', 'b5_politics_lean']) {
        const f = reg.modules.flatMap(m => m.fields).find(x => x.key === key);
        assert.equal(f.defaultPrivacy, 'private', `${key} must default to private`);
        assert.equal(f.sensitive, true, `${key} must be marked sensitive`);
    }
    // B6 recognises its four shift values by string.
    const shifts = new Set(reg.modules.find(m => m.id === 'B6').fields.flatMap(f => f.options));
    assert.ok(shifts.has('About the same'), 'the neutral value buildBlock filters on must exist');
});

// --- Tier B: personality + values (Phase 4) ---------------------------------

test('a trait answer at either end becomes a description, not a scale point', async () => {
    await wv.loadRegistry();
    await wv.setField('b1_extra_1', 'Very much like me');
    const block = wv.buildBlock();
    assert.match(block, /How this person describes themselves/);
    assert.match(block, /sociable, and comfortable around people/);
    assert.doesNotMatch(block, /Very much like me/,
        'the raw scale point must never reach the prompt');
});

test('the low end of the scale gives the low description', async () => {
    await wv.loadRegistry();
    await wv.setField('b1_extra_1', 'Not like me at all');
    assert.match(wv.buildBlock(), /happier with quiet and their own company/);
});

// Neutral producing nothing is what keeps a half-answered module cheap, and is
// the same rule the per-partner register follows.
test('the middle of the scale contributes nothing', async () => {
    await wv.loadRegistry();
    await wv.setField('b1_extra_1', 'Somewhat like me');
    assert.doesNotMatch(wv.buildBlock(), /How this person describes themselves/);
});

test('trait descriptions are aggregated into one statement, not one line each', async () => {
    await wv.loadRegistry();
    await wv.setField('b1_extra_1', 'Very much like me');
    await wv.setField('b1_consc_1', 'Very much like me');
    await wv.setField('b4_benev', 'Mostly like me');
    const block = wv.buildBlock();
    const hits = block.split('\n').filter((l) => /describes themselves/.test(l));
    assert.equal(hits.length, 1, 'exactly one aggregated line');
    assert.match(block, /sociable.*someone who likes a plan.*puts the people close to them first/s);
});

// A personality description is not something anyone says out loud about
// themselves, so this guard is stronger than the one on ordinary facts.
test('the trait block forbids stating or quoting it back', async () => {
    await wv.loadRegistry();
    await wv.setField('b4_power', 'Not like me at all');
    const block = wv.buildBlock();
    assert.match(block, /not a fact about their life and not a topic/i);
    assert.match(block, /never have them describe their own character/i);
});

// If the registry's option strings ever drift from the scale worldview.js
// recognises, EVERY trait answer silently becomes neutral and the whole module
// stops working with no error anywhere. Same class of failure as the settings-help
// drift guard.
test('every trait field uses the canonical Likert scale', async () => {
    const reg = await wv.loadRegistry();
    const CANON = ['Very much like me', 'Mostly like me', 'Somewhat like me', 'Not much like me', 'Not like me at all'];
    let checked = 0;
    for (const mod of reg.modules) {
        for (const f of mod.fields) {
            if (!f.trait) continue;
            checked++;
            assert.deepEqual(f.options, CANON, `${f.key} has drifted from the canonical scale`);
            assert.ok(f.trait.high && f.trait.low, `${f.key} needs both a high and a low description`);
        }
    }
    assert.ok(checked >= 20, `expected the Tier B bank, found ${checked} trait fields`);
});

// The descriptions are joined into "How this person describes themselves: A; B."
// so a capitalised or full-stopped clause would read wrongly mid-sentence.
test('trait descriptions are fragments that survive being joined', async () => {
    const reg = await wv.loadRegistry();
    for (const mod of reg.modules) {
        for (const f of mod.fields) {
            if (!f.trait) continue;
            for (const end of ['high', 'low']) {
                assert.doesNotMatch(f.trait[end], /^[A-Z]/, `${f.key}.${end} should not be capitalised`);
                assert.doesNotMatch(f.trait[end], /\.$/, `${f.key}.${end} should not end with a full stop`);
            }
        }
    }
});
