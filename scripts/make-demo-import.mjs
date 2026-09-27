/* Build an importable Conversant backup for a fully lived-in demo user.
 *
 *   node scripts/make-demo-import.mjs                 -> tests/fixtures/demo-marc-delgado.json
 *   node scripts/make-demo-import.mjs --out <path>
 *   node scripts/make-demo-import.mjs --persona <id>
 *   node scripts/make-demo-import.mjs --settings      include a settings bundle (see below)
 *
 * WHY IT IS GENERATED RATHER THAN HAND-WRITTEN. The file has to satisfy seven separate
 * data models at once, and every one of them normalizes what it is handed - dropping a
 * field it does not recognize, silently. Writing the JSON by hand means each of those
 * normalizers is a trap. Building it from the models' own vocabularies (the question
 * registry's keys, the twelve goal ids, the band sizes, the shipped phrase defaults)
 * means a rename in the app shows up here as a failed lookup instead of as a field that
 * quietly stops arriving.
 *
 * It also means the whole thing is re-generatable with one value changed, which is the
 * point: the persona, the depth, and whether settings travel are all decisions Ken can
 * reverse for the cost of re-running this.
 *
 * ⚠ SETTINGS ARE OMITTED BY DEFAULT, AND THAT IS THE ONE GENUINELY DESTRUCTIVE CHOICE
 * IN THE FILE. An import REPLACES the whole portable settings subset rather than merging
 * into it, so a partial settings bundle does not leave the rest alone - every key the
 * bundle does not name reverts to its default. For a demo profile that would mean
 * importing somebody's persona quietly resets their dock, their layout, their button
 * sizes and their voice. So the package carries no `settings` key at all unless asked,
 * and `applyPackage` skips settings entirely when it is absent.
 *
 * ⚠ AN IMPORT IS DESTRUCTIVE FOR THE CONTENT IT DOES CARRY. About Me, people, places,
 * the Express Panel, the control and placeholder phrases and the voice profile are all
 * overwritten wholesale, and the conversations are added alongside whatever is already
 * on disk. Back up first.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { PERSONA_EXTRAS } from './demo-persona-extras.mjs';
import { CONVERSATIONS } from './demo-conversations.mjs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const { PERSONAS } = require(resolve(HERE, 'doc-generators/persona-data.js'));

// The app's own vocabularies, read from the app rather than copied, so a rename there
// becomes a build failure here instead of a field that silently stops arriving.
const REGISTRY = JSON.parse(readFileSync(resolve(ROOT, 'app/data/worldview-questions.json'), 'utf8'));

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
    const i = args.indexOf('--' + name);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes('--' + name);

const PERSONA_ID = flag('persona', 'marc-delgado');
const OUT = resolve(ROOT, flag('out', `tests/fixtures/demo-${PERSONA_ID}.json`));
const WITH_SETTINGS = has('settings');

const persona = PERSONAS.find((p) => p.id === PERSONA_ID);
if (!persona) throw new Error(`No such persona: ${PERSONA_ID}`);
const extras = PERSONA_EXTRAS[PERSONA_ID];
if (!extras) throw new Error(`No extras authored for ${PERSONA_ID} (see scripts/demo-persona-extras.mjs)`);

// --- the question registry, flattened ----------------------------------------

const FIELD = {};
for (const mod of REGISTRY.modules) for (const f of mod.fields) FIELD[f.key] = f;

/* Persona answers are written for a document, so a few need coercing to what the field
 * actually stores. Doing this by FIELD TYPE rather than by a list of exceptions is what
 * makes it hold for the other nine personas too. */
function coerce(key, raw) {
    const meta = FIELD[key];
    if (!meta) return null;                    // not a question About Me asks - skip it
    if (meta.type === 'number') {
        const n = String(raw).match(/\d+/);    // "17 (born 2009)" -> 17
        return n ? Number(n[0]) : null;
    }
    if (meta.type === 'multi') return Array.isArray(raw) ? raw : [String(raw)];
    if (meta.type === 'choice') {
        // A choice answer must be one of the registry's own options, or the card shows
        // nothing selected and the prompt gets a value the model was never told the
        // scale for. Matched case-insensitively so the persona sheets can be prose.
        const opts = meta.options || [];
        const hit = opts.find((o) => o.toLowerCase() === String(raw).trim().toLowerCase());
        if (hit) return hit;
        return null;
    }
    return typeof raw === 'string' ? raw : String(raw);
}

function buildWorldview() {
    const fields = {};
    const skipped = [];
    const answers = { ...persona.topics, ...extras.extraTopics };

    /* ⚠ EVERY QUESTION ABOUT ME ASKS MUST BE ACCOUNTED FOR, and this is checked rather
     * than trusted (Ken, September 12 2026: fill the fields in as far as they go). The
     * failure it catches is the quiet one: a question added to the registry in a later
     * release simply would not appear in the file, and the only sign would be a profile
     * that is 73 of 75 instead of 74 of 74 - a number nobody is watching. Naming the
     * missing keys turns that into something to answer.
     *
     * Also catches an extraTopics entry that CONTRADICTS the persona sheet rather than
     * adding to it, which is how two sources of truth start to drift. */
    const missing = Object.keys(FIELD).filter((k) =>
        answers[k] === undefined && !extras.declined.includes(k) && !extras.unanswered.includes(k));
    const declared = extras.overrides || {};
    const clashes = Object.keys(extras.extraTopics).filter((k) =>
        persona.topics[k] !== undefined
        && JSON.stringify(persona.topics[k]) !== JSON.stringify(extras.extraTopics[k])
        && !declared[k]);
    // A declared override for an answer that no longer differs is a reason nobody needs
    // any more - and left in place it is the kind of note that makes the next person
    // afraid to touch the list.
    //
    // ⚠ THE OBVIOUS CONDITION MISSES THE LIKELIEST CASE, measured rather than assumed:
    // an override goes stale most often because the answer it was overriding with was
    // DELETED, not because the two values converged. Comparing the values alone reads
    // "undefined vs a string" as a live difference and reports nothing at all - so the
    // absence has to be tested first and on its own.
    const staleOverrides = Object.keys(declared).filter((k) =>
        extras.extraTopics[k] === undefined
        || persona.topics[k] === undefined
        || JSON.stringify(persona.topics[k]) === JSON.stringify(extras.extraTopics[k]));

    for (const [key, raw] of Object.entries(answers)) {
        if (extras.unanswered.includes(key)) continue;
        if (extras.declined.includes(key)) continue;
        const value = coerce(key, raw);
        if (value === null || value === '' || (Array.isArray(value) && !value.length)) {
            skipped.push(key);
            continue;
        }
        fields[key] = { value, state: 'answered', updated: stamp(key) };
    }
    for (const key of extras.declined) {
        fields[key] = { value: null, prevValue: null, state: 'declined', updated: stamp(key) };
    }
    return {
        profile: {
            version: 1,
            updated: NOW,
            fields,
            privacy: { ...extras.privacy },
            gaps: extras.gaps,
            extras: extras.extras,
        },
        skipped, missing, clashes, staleOverrides,
        overrides: Object.keys(declared).length,
    };
}

// Answers are spread over the weeks somebody would actually have entered them in,
// deterministically, so the file is stable between runs and the "last updated" dates
// look like a profile that was filled in a bit at a time rather than all at once.
const NOW = '2026-09-12T14:00:00.000Z';
const FIRST_RUN = Date.parse('2026-08-18T18:00:00.000Z');
function stamp(seed) {
    let h = 0;
    for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return new Date(FIRST_RUN + (h % 18) * 86400000 + (h % 7) * 3600000).toISOString();
}

// --- people and relationships -------------------------------------------------

const slug = (s) => 'p-' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const placeSlug = (s) => 'pl-' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function buildRelationships() {
    const people = [];
    const edges = [];
    const byName = {};

    const all = [
        ...persona.people.map((p) => ({ ...p, profile: extras.partnerProfiles[p.name] })),
        ...extras.extraPeople,
    ];

    for (const p of all) {
        const id = slug(p.name);
        byName[p.name] = id;
        const attrs = {};
        if (p.nickname) attrs.nickname = p.nickname;
        if (p.about) attrs.about = p.about;
        if (p.livesWithMe) attrs.livesWithMe = true;
        const pron = (extras.pronunciations.people || {})[p.name];
        const nickPron = (extras.pronunciations.nicknames || {})[p.name];
        if (pron) attrs.pronunciation = pron;
        if (nickPron) attrs.nicknamePronunciation = nickPron;
        people.push({ id, name: p.name, private: !!p.private, attrs });

        // The me->person edge. Its `type` is the relationship; its attrs are "how I
        // talk with this person". Only dimensions the user actually set are stored -
        // a neutral one contributes nothing to the prompt, so storing it as an empty
        // string would be recording a decision nobody made.
        const prof = p.profile || {};
        const eAttrs = {};
        if (prof.register && Object.keys(prof.register).length) eAttrs.register = { ...prof.register };
        if (prof.goals && prof.goals.length) eAttrs.goals = prof.goals.map(normGoal);
        if (prof.note) eAttrs.note = prof.note;
        for (const k of ['openers', 'windDowns', 'closings']) {
            if (prof[k] && prof[k].length) eAttrs[k] = prof[k].slice();
        }
        edges.push({ from: 'me', to: id, type: p.relationship || '', attrs: eAttrs });
    }

    return {
        graph: {
            version: 1,
            updated: NOW,
            people,
            edges,
            goals: extras.generalGoals.map(normGoal),
        },
        byName,
    };
}

// A menu goal stores its id and nothing else, so a later rewording of the twelve
// reaches it. A typed goal stores its words, plus the short button face if given.
function normGoal(g) {
    if (g.id) return { id: g.id };
    const out = { id: '', text: g.text };
    if (g.label) out.label = g.label;
    return out;
}

// --- places -------------------------------------------------------------------

function buildPlaces() {
    const places = persona.places.map((pl) => {
        const out = {
            id: placeSlug(pl.name),
            name: pl.name,
            pronunciation: (extras.pronunciations.places || {})[pl.name] || '',
            private: !!pl.private,
            facts: pl.facts.map((f) => ({ key: f.key, value: f.value })),
            goals: (extras.placeGoals[pl.name] || []).map(normGoal),
        };
        return out;
    });
    const byName = {};
    for (const p of places) byName[p.name] = p.id;
    return { model: { version: 1, updated: NOW, places }, byName };
}

// --- Express Panel -------------------------------------------------------------

/* The shipped Always band is read out of the app's own module text rather than retyped,
 * because retyping it would fork the therapists' set: a later revision to their wording
 * would reach every real user and not this file, and the difference would look like a
 * deliberate customization. Reading it also keeps the ids and the `origin: default`
 * stamps exactly as a real panel has them, which is what stops the whole band being
 * credited to the user as evidence of their voice. */
function shippedAlways() {
    const src = readFileSync(resolve(ROOT, 'app/js/express-items.js'), 'utf8');
    const block = src.match(/export const ALWAYS_DEFAULTS = \[([\s\S]*?)\]\.map/);
    if (!block) throw new Error('Could not read ALWAYS_DEFAULTS out of express-items.js');
    const texts = [...block[1].matchAll(/PH\((['"])((?:\\.|(?!\1).)*)\1/g)]
        .map((m) => m[2].replace(/\\(['"])/g, '$1'));
    if (texts.length < 20) throw new Error(`Only parsed ${texts.length} Always phrases - check express-items.js`);
    return texts.map((text, i) => ({ id: 'a' + i, type: 'phrase', text, origin: 'default' }));
}

function seedRevision() {
    const src = readFileSync(resolve(ROOT, 'app/js/express-items.js'), 'utf8');
    const m = src.match(/export const SEED_REVISION = (\d+)/);
    return m ? Number(m[1]) : 1;
}

function buildExpressPanel(peopleByName, placesByName) {
    // Context band, in the order the model sorts it: partners, then places, then
    // feelings. The partner and place buttons carry the record id, which is the whole
    // reason they cannot ship as defaults - a defaulted one would point at somebody
    // About Me has never heard of.
    const context = [];
    let n = 0;
    for (const name of extras.contextPartners) {
        const id = peopleByName[name];
        if (!id) throw new Error(`Context partner "${name}" is not in the people list`);
        context.push({ id: 'cx' + n++, type: 'partner', name, personId: id, origin: 'added' });
    }
    for (const name of extras.contextPlaces) {
        const id = placesByName[name];
        if (!id) throw new Error(`Context place "${name}" is not in My Places`);
        context.push({ id: 'cx' + n++, type: 'place', name, placeId: id, origin: 'added' });
    }
    for (const text of extras.feelings) {
        context.push({ id: 'cx' + n++, type: 'feeling', text, origin: 'edited' });
    }

    // Situational phrase lists. The key is "<partner>|<place>", either half of which
    // may be "anyone" / "anyplace"; anyone plus anyplace IS the general list.
    const flex = {};
    let f = 0;
    for (const [key, list] of Object.entries(extras.flex)) {
        const [pname, plname] = key.split('|');
        const pid = pname === 'anyone' ? 'anyone' : peopleByName[pname];
        const plid = plname === 'anyplace' ? 'anyplace' : placesByName[plname];
        if (!pid) throw new Error(`Flex key names an unknown person: ${pname}`);
        if (!plid) throw new Error(`Flex key names an unknown place: ${plname}`);
        flex[`${pid}|${plid}`] = list.map((text) => ({
            id: 'fx' + f++, type: 'phrase', text, origin: 'added',
        }));
    }

    return {
        version: 2,
        seed: seedRevision(),
        /* Rows rather than counts, which is what ships.
         *
         * ⚠ ONE ROW OF CONTEXT, NOT TWO, AND THIS WAS MEASURED RATHER THAN CHOSEN.
         * Under ROWS a band takes whole rows, so what a band is WORTH depends entirely
         * on the layout: on a bottom QWERTY layout a row is 11 positions and on a narrow
         * side layout it is 5. Asking for two rows of Context on the bottom layout
         * leaves the Always band with ZERO positions - all 26 of the therapists' phrases
         * present in the file and none of them on screen, with nothing anywhere saying
         * so. One row leaves Always 11 and Flex 10 there, and never squeezes Always
         * below 18 on any side layout.
         *
         * The honest consequence, since it cannot be settled from here: on a narrow side
         * dock one row of Context holds 5, so the last few of the ten Context buttons are
         * hidden until the user gives the band a second row - which is safe on a side
         * layout and is why band size is a setting rather than a decision. */
        sizes: { shape: 'rows', contextRows: 1, flexRows: 1, context: 6, flex: 0 },
        always: shippedAlways(),
        context,
        flex,
        updated: NOW,
    };
}

// --- control and placeholder phrases -------------------------------------------

/* Read the shipped defaults out of the app so the `seeded` watermark is complete.
 *
 * ⚠ THE WATERMARK IS THE LOAD-BEARING PART AND IT IS EASY TO GET WRONG. It records
 * every default this profile has ever been offered. If it is left empty, the additive
 * merge decides that every shipped default is brand new and appends all of them on the
 * next load - so the user's own phrases end up buried under a second copy of the
 * defaults they already have. If a default is missing from it, that one alone gets
 * duplicated. So it must list exactly the current defaults, which is why it is read
 * rather than typed. */
function defaultsFrom(file, exportName) {
    const src = readFileSync(resolve(ROOT, file), 'utf8');
    const start = src.indexOf(`export const ${exportName} = {`);
    if (start < 0) throw new Error(`No ${exportName} in ${file}`);
    // Walk to the matching close brace so nested arrays and comments come along.
    let depth = 0, i = src.indexOf('{', start), end = -1;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
    }
    const body = src.slice(src.indexOf('{', start), end);
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${body});`)();
}

function buildControlPhrases() {
    const D = defaultsFrom('app/js/control-phrases.js', 'DEFAULTS');
    const mine = extras.controlPhrases;
    const LIST_KEYS = ['openers', 'windDowns', 'closings', 'pardon', 'declineClosing', 'retry'];
    const out = {
        version: 1,
        updated: NOW,
        // A single phrase, not a list. His wording, because the default is a whole
        // sentence and he does not talk in whole sentences.
        holdOn: mine.holdOn || D.holdOn,
        seeded: {},
    };
    for (const key of LIST_KEYS) {
        // HIS OWN FIRST, then the defaults he kept. That is the order a real user ends
        // up with: they add the phrase they actually say, move it to the top, and never
        // get around to deleting ours - and page one of the palette is what matters.
        const added = mine[key] || [];
        const kept = D[key].filter((d) => !added.includes(d));
        out[key] = [...added, ...kept];
        out.seeded[key] = D[key].slice();
    }
    return out;
}

function buildPlaceholders() {
    const D = defaultsFrom('app/js/placeholder-phrases.js', 'DEFAULTS');
    const mine = extras.placeholders;
    const out = { version: 1, updated: NOW, seeded: {} };
    for (const pool of ['acknowledgment', 'thinking']) {
        const added = mine[pool] || [];
        const kept = D[pool].filter((d) => !added.includes(d));
        out[pool] = [...added, ...kept];
        out.seeded[pool] = D[pool].slice();
    }
    return out;
}

// --- voice ---------------------------------------------------------------------

function soundCheckItems() {
    const src = readFileSync(resolve(ROOT, 'app/js/sound-check-items.js'), 'utf8');
    const block = src.match(/export const SOUND_CHECK_ITEMS = \[([\s\S]*?)\n\];/);
    if (!block) throw new Error('Could not read SOUND_CHECK_ITEMS');
    const items = {};
    for (const m of block[1].matchAll(/id: '([^']+)'[\s\S]*?candidates: \[([\s\S]*?)\n {8}\]/g)) {
        const cands = [...m[2].matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)]
            .map((c) => c[2].replace(/\\(['"])/g, '$1'));
        items[m[1]] = cands;
    }
    return items;
}

/* Sound Check, from the persona sheet's index picks.
 *
 * ⚠ THE STORED ANSWER IS THE SENTENCE, NOT THE INDEX, and that matters beyond tidiness:
 * the chosen sentence IS the exemplar the voice block hands the model, so an index would
 * be a pointer into a list that a later revision of the bank can reorder. Resolving it
 * here means a reordered bank cannot silently change what this user is said to sound
 * like. */
function buildVoice() {
    const bank = soundCheckItems();
    const soundCheck = {};
    for (const [itemId, idx] of Object.entries(persona.soundCheck || {})) {
        const cands = bank[itemId];
        if (!cands) throw new Error(`Sound Check item "${itemId}" is not in the bank any more`);
        const choice = cands[idx];
        if (choice === undefined) throw new Error(`Item "${itemId}" has no candidate ${idx}`);
        soundCheck[itemId] = { verdict: 'chose', choice, at: stamp(itemId) };
    }
    return {
        version: 1,
        updated: NOW,
        soundCheck,
        // Persona sheets carry a neverSay list; Marc's real one is authored in extras.
        never: (extras.never && extras.never.length) ? extras.never : (persona.neverSay || []),
        samples: {},
        // Left null on purpose. The harvest is what reading his own past conversations
        // concluded, and the conversations are in this file - so the app computes it
        // from them rather than being handed a conclusion it cannot check.
        harvest: null,
        dismissed: [],
        steers: extras.steers || [],
    };
}

// --- conversations -------------------------------------------------------------

/* Expand the compact turn scripts into real conversation logs.
 *
 * The clock is owned here rather than written into the scripts, because what has to be
 * true is the ORDER and the plausible spacing - a partner turn, then the app holding the
 * floor, then a set of cards up for as long as the script says it was, then the user
 * speaking. Writing every timestamp by hand is how a file ends up with a card selected
 * before it was offered.
 */
function buildConversations(peopleByName, placesByName) {
    const out = [];

    for (const conv of CONVERSATIONS) {
        let t = Date.parse(conv.at);
        const tick = (ms) => { t += ms; return new Date(t).toISOString(); };

        const partnerStamp = conv.practice
            ? { id: null, label: `Practice: ${conv.practice}` }
            : (conv.partner
                ? { id: peopleByName[conv.partner] || null, label: nickOrName(conv.partner) }
                : null);
        const placeStamp = conv.place
            ? { id: placesByName[conv.place] || null, label: conv.place }
            : null;
        const feelingStamp = conv.feeling ? { id: null, text: conv.feeling } : null;
        const goalStamp = conv.goals && conv.goals.length
            ? conv.goals.map((g) => ({ id: g.id || '', text: g.text, source: g.source || 'general' }))
            : null;

        const id = new Date(t).toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const exchanges = [];

        // Entry one of every conversation: the state it began in. Time zero is the
        // Listen press, and anything selected before it is recorded as if it had been
        // selected at that same moment.
        exchanges.push({
            timestamp: new Date(t).toISOString(),
            role: 'context',
            trigger: 'start',
            partner: partnerStamp,
            feeling: feelingStamp,
            place: placeStamp,
            goals: goalStamp,
        });

        let pendingOffer = null;

        for (const turn of conv.turns) {
            const [kind] = turn;

            if (kind === 'gap') { t += turn[1] * 1000; continue; }

            if (kind === 'event') {
                exchanges.push({
                    timestamp: tick(600), role: 'event', kind: turn[1], ...(turn[2] || {}),
                });
                continue;
            }

            if (kind === 'partner') {
                const raw = turn[1];
                const opts = turn[2] || {};
                const ts = tick(2200);
                exchanges.push({
                    timestamp: ts,
                    role: 'partner',
                    rawTranscript: raw,
                    // Always equal to the raw text now: the second AI request that used
                    // to rewrite what the recognizer heard was removed, and the field is
                    // kept because every reader of an older conversation expects it.
                    cleanedTranscript: raw,
                    uncertain: opts.uncertain || [],
                    partner: partnerStamp,
                    place: placeStamp,
                    stt: conv.practice ? null : 'browser',
                    revisions: [{ at: ts, text: raw }],
                });
                continue;
            }

            if (kind === 'ph') {
                exchanges.push({
                    timestamp: tick(2000),
                    role: 'placeholder',
                    text: turn[1],
                    n: turn[2],
                    tts: { provider: 'browser', voice: 'Microsoft Aria Online (Natural) - English (United States)' },
                });
                continue;
            }

            if (kind === 'error') {
                exchanges.push({
                    timestamp: tick(900),
                    role: 'error',
                    context: turn[1],
                    message: turn[2],
                    version: APP_VERSION,
                });
                continue;
            }

            if (kind === 'context') {
                exchanges.push({
                    timestamp: tick(1500),
                    role: 'context',
                    trigger: turn[1],
                    partner: partnerStamp,
                    feeling: feelingStamp,
                    place: placeStamp,
                    goals: goalStamp,
                });
                continue;
            }

            if (kind === 'offer') {
                const [, offerKind, options, outcome, selectedIndex, shownMs] = turn;
                const entry = {
                    timestamp: tick(1400),
                    role: 'offer',
                    kind: offerKind,
                    options: options.map(([slot, text]) => ({ slot, text })),
                    outcome: outcome || 'superseded',
                    selectedIndex: selectedIndex === undefined ? null : selectedIndex,
                    shownMs: shownMs === undefined ? null : shownMs,
                };
                exchanges.push(entry);
                pendingOffer = entry;
                // The set was on screen for this long before whatever ended it.
                if (shownMs) t += shownMs;
                continue;
            }

            if (kind === 'user') {
                const [, text, o = {}] = turn;
                const offer = pendingOffer;
                pendingOffer = null;
                exchanges.push({
                    timestamp: tick(500),
                    role: 'user',
                    selectedText: text,
                    spokenText: o.spokenText || null,
                    tts: {
                        provider: 'browser',
                        voice: 'Microsoft Guy Online (Natural) - English (United States)',
                        ...(o.fellBack ? { fellBack: true } : {}),
                    },
                    selectedIndex: o.index === undefined ? -1 : o.index,
                    // The set it was actually chosen from, captured at the tap - not
                    // whatever the last AI generation happened to be. Getting this wrong
                    // is how a goodbye ends up filed as an INITIATIVE.
                    allOptions: o.options
                        || (offer && o.index !== undefined ? offer.options.map((c) => c.text) : []),
                    selectedSlot: o.slot || null,
                    source: o.source || null,
                    decideMs: o.decideMs === undefined ? null : o.decideMs,
                    partner: partnerStamp,
                    feeling: feelingStamp,
                    place: placeStamp,
                    goals: goalStamp,
                });
                continue;
            }

            throw new Error(`Unknown turn kind: ${kind}`);
        }

        out.push({
            id,
            data: { id, started: conv.at, exchanges },
        });
    }

    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
}

function nickOrName(name) {
    const p = [...persona.people, ...extras.extraPeople].find((x) => x.name === name);
    return (p && p.nickname) || name;
}

// --- settings (only with --settings) -------------------------------------------

/* A complete portable bundle, not a partial one.
 *
 * ⚠ PARTIAL IS THE DANGEROUS SHAPE, which is why this is all-or-nothing: an import
 * replaces the portable subset outright, so any key left out reverts to its default.
 * A bundle naming six settings therefore does not mean "change these six" - it means
 * "change these six and reset everything else". Everything here is a value a real user
 * could have picked; the four device-bound ones are omitted deliberately, since the
 * import holds those back anyway and including them only invites confusion in the
 * "left as they are here" report.
 */
function buildSettings() {
    return {
        // Speech
        ttsProvider: 'builtin',
        voiceURI: 'Microsoft Guy Online (Natural) - English (United States)',
        partnerVoice: '',
        showNoveltyVoices: false,
        silenceThreshold: 0.5,
        autoRelisten: true,
        listenChime: true,
        // Conversation
        responsesPerCategory: 1,
        cardTextMode: 'both-full',
        choiceChipMax: 4,
        noSaveDefault: false,
        // Placeholders - he set a shorter first delay, because he types fast for
        // somebody using a screen and 2 seconds felt long to him.
        placeholderInitialDelay: 1.5,
        placeholderSubsequentDelay: 10,
        placeholderMax: 2,
        placeholderEaseOff: 2,
        // Buttons and keyboard
        keyboardDock: 'side',
        sideDockPosition: 'right',
        sideLayout: 'qwerty-3col',
        bottomLayout: 'qwerty',
        expressTapMode: 'double',
        doubleTapMs: 400,
        contextMark: 'shape',
        commandLabels: 'icon',
        buttonSizePos: 62,
        buttonGapPos: 30,
        minGapPos: 12,
        dockSepPos: 20,
        transcriptSepPos: 15,
        // Text and color
        colorScheme: 'default',
        transcriptFontScale: 1.1,
        composerFontScale: 1,
        expressFontScale: 1,
        responseFontScale: 1.15,
        hintFontScale: 1,
        // Reporting
        weeklySendEnabled: true,
    };
}

// --- assemble -------------------------------------------------------------------

const APP_VERSION = (() => {
    const src = readFileSync(resolve(ROOT, 'app/js/app.js'), 'utf8');
    const m = src.match(/APP_VERSION\s*=\s*'([^']+)'/);
    return m ? m[1] : '';
})();

const wv = buildWorldview();
const rel = buildRelationships();
const pl = buildPlaces();
const conversations = buildConversations(rel.byName, pl.byName);

const pkg = {
    kind: 'conversant-aac-backup',
    packageVersion: 3,
    appVersion: APP_VERSION,
    exportedAt: NOW,
    // What kind of device this came off. A neutral signature, so an import on a
    // Windows machine or an iPad treats the device-bound settings the same way:
    // different from here, therefore held back.
    device: { os: 'demo', screen: 'demo' },
    data: {
        'worldview.json': wv.profile,
        'relationships.json': rel.graph,
        'places.json': pl.model,
        'control-phrases.json': buildControlPhrases(),
        'placeholders.json': buildPlaceholders(),
        'express-panel.json': buildExpressPanel(rel.byName, pl.byName),
        'voice.json': buildVoice(),
    },
    conversations,
};

if (WITH_SETTINGS) {
    pkg.settings = buildSettings();
    pkg.profiles = [];
    pkg.activeProfile = '';
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(pkg, null, 2));

// --- report ---------------------------------------------------------------------

const answered = Object.values(wv.profile.fields).filter((f) => f.state === 'answered').length;
const declined = Object.values(wv.profile.fields).filter((f) => f.state === 'declined').length;
const total = Object.keys(FIELD).length;
const turns = conversations.reduce((n, c) => n + c.data.exchanges.filter((e) => e.role === 'user').length, 0);
const offers = conversations.reduce((n, c) => n + c.data.exchanges.filter((e) => e.role === 'offer').length, 0);
const rejected = conversations.reduce((n, c) =>
    n + c.data.exchanges.filter((e) => e.role === 'offer' && e.outcome !== 'card').length, 0);

console.log(`Wrote ${OUT}`);
console.log(`  persona            ${persona.displayName}`);
console.log(`  app version        ${APP_VERSION}`);
console.log(`  About Me           ${answered} answered, ${declined} declined, ` +
            `${total - answered - declined} unanswered of ${total}`);
console.log(`  privacy overrides  ${Object.keys(wv.profile.privacy).length}`);
console.log(`  gaps / extras      ${wv.profile.gaps.length} / ${wv.profile.extras.length}`);
console.log(`  people             ${rel.graph.people.length} (${rel.graph.edges.filter((e) => Object.keys(e.attrs).length).length} with a "how I talk with them" profile)`);
console.log(`  general goals      ${rel.graph.goals.length}`);
console.log(`  places             ${pl.model.places.length} (${pl.model.places.filter((p) => p.goals.length).length} with goals)`);
console.log(`  Express Panel      ${pkg.data['express-panel.json'].always.length} always, ` +
            `${pkg.data['express-panel.json'].context.length} context, ` +
            `${Object.keys(pkg.data['express-panel.json'].flex).length} situational lists`);
console.log(`  Sound Check        ${Object.keys(pkg.data['voice.json'].soundCheck).length} answered, ` +
            `${pkg.data['voice.json'].never.length} never-say, ${pkg.data['voice.json'].steers.length} steers`);
console.log(`  conversations      ${conversations.length}, ${turns} user turns, ` +
            `${offers} card sets (${rejected} not chosen from)`);
console.log(`  settings           ${WITH_SETTINGS ? Object.keys(pkg.settings).length + ' included' : 'omitted (pass --settings to include)'}`);
const openExtras = pkg.data['worldview.json'].extras.filter((e) => e.state === 'open').length;
const answeredExtras = pkg.data['worldview.json'].extras.filter((e) => e.state === 'answered').length;
console.log(`  extra questions    ${answeredExtras} answered, ${openExtras} still open`);
if (wv.skipped.length) console.log(`  ⚠ skipped answers  ${wv.skipped.join(', ')}`);
// A question About Me asks that nothing in this file answers. See buildWorldview.
if (wv.missing.length) console.log(`  ⚠ NO ANSWER FOR    ${wv.missing.join(', ')}`);
if (wv.overrides) console.log(`  declared overrides ${wv.overrides} (answers that deliberately replace the persona sheet)`);
if (wv.clashes.length) console.log(`  ⚠ UNDECLARED CLASH  ${wv.clashes.join(', ')} - add a reason to \`overrides\` or fix the answer`);
if (wv.staleOverrides.length) console.log(`  ⚠ stale override    ${wv.staleOverrides.join(', ')} - no longer differs, drop the entry`);
