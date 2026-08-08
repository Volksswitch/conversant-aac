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
    assert.match(block, /does not\s+extend to neighbouring or merely related subjects/);
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
