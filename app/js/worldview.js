/* AAC Conversation Assistant — worldview model (Build Step 1)
 *
 * The worldview profile lets the assistant speak AS the user: concrete facts,
 * interests, and (later) voice/values. This module is the data layer only —
 * the questionnaire UI (worldview-ui.js) and the LLM wiring (llm.js) come in
 * Build Steps 2 and 3.
 *
 * Two artifacts (see Worldview-Implementation-Plan.docx §2):
 *   - app/data/worldview-questions.json  static registry (ships with the app)
 *   - <data folder>/worldview.json       per-user profile (FSA), cached in
 *                                         localStorage for instant reads
 *
 * Three field states drive all behavior:
 *   unanswered  key absent in profile.fields   (eligible to ask / resurface)
 *   answered    { value, state:"answered" }
 *   declined    { value:null, state:"declined" }  sticky — never ask, always
 *                                                  phrase around; un-decline
 *                                                  returns it to unanswered.
 *
 * Privacy is independent of state, and PRIVATE is not a weaker Declined: the value
 * IS sent to the model (v0.3.12 — withholding it made the two identical), under an
 * instruction not to raise it on the model's own initiative. That instruction must
 * name what DOES bring it out, or it cannot be followed (Ken, August 3 2026): the
 * model's only output is the response palette, so "include it only if the user picks
 * a response that does" points at nothing — if no card carries the fact there is
 * nothing to pick. The two real prompts are (1) the PARTNER asks, and (2) the USER
 * steers by typing in "In my own words" and tapping Reframe. That nothing is spoken
 * until the user taps it is a separate, always-on guarantee about SELECTION.
 */

import { readFile, writeFile, hasDataFolder } from './storage.js';

const PROFILE_FILE = 'worldview.json';
const CACHE_KEY = 'aac_worldview';
const REGISTRY_URL = 'data/worldview-questions.json';

let registry = null;          // parsed worldview-questions.json
let fieldIndex = null;        // key -> { ...field, moduleId, moduleTitle }
let profile = null;           // the worldview.json object

// --- Registry ---------------------------------------------------------------

export async function loadRegistry() {
    if (registry) return registry;
    const resp = await fetch(REGISTRY_URL);
    if (!resp.ok) throw new Error(`worldview registry load failed: ${resp.status}`);
    registry = await resp.json();
    fieldIndex = {};
    for (const mod of registry.modules) {
        for (const f of mod.fields) {
            fieldIndex[f.key] = { ...f, moduleId: mod.id, moduleTitle: mod.title };
        }
    }
    return registry;
}

export function getRegistry() {
    return registry;
}

export function fieldMeta(key) {
    return fieldIndex ? fieldIndex[key] || null : null;
}

// --- Profile load / save ----------------------------------------------------

function defaultProfile() {
    return {
        version: 1,
        updated: new Date().toISOString(),
        fields: {},
        privacy: {},   // per-field privacy overrides: key -> "private" | "shareable"
        gaps: []       // [{ key, partnerText, count, lastSeen }]
    };
}

function readCache() {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch {
        return null;
    }
}

function writeCache(p) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(p));
    } catch { /* quota — non-fatal, data folder is the source of truth */ }
}

function normalize(p) {
    const base = defaultProfile();
    return {
        version: p.version ?? base.version,
        updated: p.updated ?? base.updated,
        fields: p.fields ?? {},
        privacy: p.privacy ?? {},
        gaps: Array.isArray(p.gaps) ? p.gaps : []
    };
}

/**
 * Load the profile. Prefers the data folder (source of truth); falls back to
 * the localStorage cache when no folder is granted yet, then to an empty
 * profile. Always refreshes the cache from whatever was loaded.
 */
export async function load() {
    let loaded = null;
    const fromDisk = await readFile(PROFILE_FILE);   // null if no folder / missing
    if (fromDisk) {
        try { loaded = JSON.parse(fromDisk); } catch { loaded = null; }
    }
    if (!loaded) loaded = readCache();
    profile = loaded ? normalize(loaded) : defaultProfile();
    writeCache(profile);
    return profile;
}

function ensureLoaded() {
    if (!profile) profile = readCache() ? normalize(readCache()) : defaultProfile();
    return profile;
}

/** Write-through to both the data folder and the localStorage cache. */
async function save() {
    profile.updated = new Date().toISOString();
    writeCache(profile);
    await writeFile(PROFILE_FILE, JSON.stringify(profile, null, 2));
}

/**
 * Reconcile the localStorage cache with the data folder once a folder
 * becomes available. Call this right after a folder is granted/restored.
 *
 * The file in the data folder is the source of truth — the folder is the
 * portable profile, the localStorage cache is only a same-machine mirror and a
 * stopgap for when no folder is granted. So the rule is simple and predictable
 * (Ken, June 15 2026): **if a worldview.json is present in the connected
 * folder, that file wins — always.** Copying a profile in from another machine
 * therefore just works; the file is never entered into a timestamp contest
 * against the browser cache and is never overwritten by it. The cache is
 * promoted to disk only when there is NO file on disk yet (answers entered
 * before a folder was ever granted). The winner is written through to both
 * stores and becomes the in-memory profile. Returns 'wrote' | 'adopted' |
 * 'noop'.
 *
 * Trade-off (accepted): answers entered while a folder was disconnected, then
 * re-connecting a folder that already holds a file, are dropped in favor of the
 * file. A future "this folder and this browser differ — which do you want?"
 * prompt is the way to make that case loss-free.
 */
export async function syncToFolder() {
    if (!hasDataFolder()) return 'noop';   // nothing to sync to yet

    const raw = await readFile(PROFILE_FILE);
    let disk = null;
    if (raw) { try { disk = JSON.parse(raw); } catch { disk = null; } }

    if (disk) {
        // A file in the connected folder is the source of truth — adopt it,
        // mirror it to the cache. Never let the cache overwrite it.
        profile = normalize(disk);
        writeCache(profile);
        return 'adopted';
    }

    // No portable file yet — promote whatever the cache holds to disk so the
    // data stops being machine-local.
    profile = normalize(readCache() || profile || defaultProfile());
    await save();
    return 'wrote';
}

// --- Field state ------------------------------------------------------------

export function getState(key) {
    const f = ensureLoaded().fields[key];
    if (!f) return 'unanswered';
    return f.state === 'declined' ? 'declined' : 'answered';
}

export function getField(key) {
    const f = ensureLoaded().fields[key];
    return f && f.state === 'answered' ? f.value : null;
}

export async function setField(key, value) {
    ensureLoaded().fields[key] = { value, state: 'answered', updated: new Date().toISOString() };
    clearGapEntry(key);   // answering a field resolves its gap
    await save();
}

export async function declineField(key) {
    // Preserve any existing answer so "Prefer not to say" is reversible — it must
    // not silently destroy a saved answer (Ken, July 2026). The stashed value is
    // NEVER sent to the AI: getField() returns null for a declined field and
    // buildBlock() treats declined as phrase-around with no value. It lives only
    // to let undeclineField() put the answer back.
    const existing = ensureLoaded().fields[key];
    const prev = existing && existing.state === 'answered' ? existing.value
        : (existing && existing.prevValue != null ? existing.prevValue : null);
    profile.fields[key] = { value: null, prevValue: prev, state: 'declined', updated: new Date().toISOString() };
    clearGapEntry(key);   // declined is a real answer — stop surfacing it
    await save();
}

/** True if a declined field has a stashed prior answer that undecline can restore. */
export function hasStashedAnswer(key) {
    const f = ensureLoaded().fields[key];
    return !!(f && f.state === 'declined' && f.prevValue != null && f.prevValue !== '');
}

/**
 * Undo a decline: restore the prior answer if there was one, otherwise return the
 * field to the unanswered state (ask me again). This is what the declined card's
 * Undo control calls, so a decline never loses a saved answer.
 */
export async function undeclineField(key) {
    const f = ensureLoaded().fields[key];
    if (f && f.state === 'declined' && f.prevValue != null && f.prevValue !== '') {
        profile.fields[key] = { value: f.prevValue, state: 'answered', updated: new Date().toISOString() };
    } else {
        delete profile.fields[key];
    }
    await save();
}

/** Skip-for-now / un-decline: return the field to the unanswered state. */
export async function resetField(key) {
    delete ensureLoaded().fields[key];
    await save();
}

/** Wipe all answers (revertibility invariant). Keeps the gaps log. */
export async function resetAll() {
    ensureLoaded();
    profile.fields = {};
    profile.privacy = {};
    await save();
}

// --- Privacy ----------------------------------------------------------------

export function effectivePrivacy(key) {
    const override = ensureLoaded().privacy[key];
    if (override) return override;
    const meta = fieldMeta(key);
    return meta?.defaultPrivacy || 'shareable';
}

export async function setPrivacy(key, privacy) {
    ensureLoaded().privacy[key] = privacy;
    await save();
}

// --- Gaps log ---------------------------------------------------------------

function clearGapEntry(key) {
    if (!profile) return;
    profile.gaps = profile.gaps.filter((g) => g.key !== key);
}

/**
 * Record facts the generation call wanted but did not have. Keys that are
 * already answered or declined are dropped — we only log genuine open gaps.
 */
export async function recordGaps(missingFacts, partnerText) {
    ensureLoaded();
    const now = new Date().toISOString();
    let changed = false;
    for (const key of missingFacts || []) {
        if (getState(key) !== 'unanswered') continue;
        const existing = profile.gaps.find((g) => g.key === key);
        if (existing) {
            existing.count += 1;
            existing.lastSeen = now;
            if (partnerText) existing.partnerText = partnerText;
        } else {
            profile.gaps.push({ key, partnerText: partnerText || '', count: 1, lastSeen: now });
        }
        changed = true;
    }
    if (changed) await save();
}

/** Open gaps, most-asked first. */
export function listGaps() {
    return [...ensureLoaded().gaps].sort((a, b) => b.count - a.count);
}

export async function clearGaps() {
    ensureLoaded().gaps = [];
    await save();
}

// --- Derived: progress and suggested-next -----------------------------------

export function getModules() {
    if (!registry) return [];
    return registry.modules.map((mod) => {
        const total = mod.fields.length;
        const answered = mod.fields.filter((f) => getState(f.key) === 'answered').length;
        const declined = mod.fields.filter((f) => getState(f.key) === 'declined').length;
        return { id: mod.id, title: mod.title, tier: mod.tier, total, answered, declined };
    });
}

/**
 * What to offer next: open gaps first (real conversational demand), then any
 * unanswered registry fields in authoring order. Returns field metadata.
 */
export function suggestedNext(limit = 5) {
    const out = [];
    const seen = new Set();
    for (const g of listGaps()) {
        if (getState(g.key) !== 'unanswered') continue;
        const meta = fieldMeta(g.key);
        if (meta && !seen.has(g.key)) { out.push(meta); seen.add(g.key); }
        if (out.length >= limit) return out;
    }
    if (registry) {
        for (const mod of registry.modules) {
            for (const f of mod.fields) {
                if (seen.has(f.key)) continue;
                if (getState(f.key) === 'unanswered') {
                    out.push(fieldMeta(f.key)); seen.add(f.key);
                    if (out.length >= limit) return out;
                }
            }
        }
    }
    return out;
}

// --- Profile block for LLM injection ---------------------------------------

function formatValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) {
        return value.map((v) => {
            if (v && typeof v === 'object') return Object.values(v).filter(Boolean).join(' — ');
            return v;
        }).filter(Boolean).join(', ');
    }
    if (typeof value === 'object') return Object.values(value).filter(Boolean).join(' — ');
    return String(value);
}

function labelFor(key) {
    const meta = fieldMeta(key);
    if (!meta) return key;
    // The canonical placeholder name reads as a clean fact label
    // ("name" -> "Name: Alex"), far better than the full question text.
    if (meta.fills && meta.fills.length) {
        const f = meta.fills[0];
        return f.charAt(0).toUpperCase() + f.slice(1);
    }
    // Fallback: the question with trailing punctuation / parentheticals removed.
    return meta.q.replace(/\s*\(.*?\)\s*$/, '').replace(/[?:]\s*$/, '');
}

/**
 * Compact profile text injected into the generation system prompt.
 *
 * Privacy model (three levels — Ken, June 19 2026):
 *   Shareable   — value sent freely; AI may use it in any response.
 *   Private     — value IS sent; AI uses it for context but must not volunteer
 *                 it. It may appear in a response only if the user picks one
 *                 that includes it. Correct for sensitive-but-useful facts
 *                 (phone, address, people the user wants AI to know about).
 *   Declined    — user chose "Prefer not to say"; NO value sent; phrase-around
 *                 only. For information the user does not want the AI to know.
 */
/**
 * The Likert scale shared by every Tier B trait item. Answers at the two ends
 * contribute a description; the middle contributes NOTHING, so a user who is
 * genuinely in the middle on something costs no tokens and exerts no pull.
 *
 * These strings must match the `options` authored in worldview-questions.json
 * exactly — a test asserts that, because a silent mismatch would make every trait
 * answer neutral and the whole module would quietly stop working.
 */
const TRAIT_HIGH = new Set(['Very much like me', 'Mostly like me']);
const TRAIT_LOW = new Set(['Not much like me', 'Not like me at all']);

function traitClause(field, value) {
    if (TRAIT_HIGH.has(value)) return field.trait.high || '';
    if (TRAIT_LOW.has(value)) return field.trait.low || '';
    return '';   // the middle of the scale, or an unrecognised value
}

/*
 * B2 humor: the answers that must be recognised by VALUE, and so carry the same
 * hazard as the Likert scale above — these strings must match the `options` in
 * worldview-questions.json exactly, and a test asserts it. A silent mismatch here
 * is worse than the trait one: `HUMOR_DECLINE` failing to match would not merely
 * lose an answer, it would turn "no joking suggestions, please" into permission.
 *
 * The scoped answer is deliberately the SAME string on both questions, so one
 * constant covers teasing and permission alike.
 */
const HUMOR_DECLINE = 'No — keep my suggestions straight';
const HUMOR_NOT_A_JOKER = "I'm not much of a joker";
const HUMOR_CLOSE_ONLY = "Only with people I'm close to";
const HUMOR_TEASE_NO = 'Not really my thing';

/*
 * Build the humor instruction, or '' for nothing to say. Structured as one function
 * because the pieces interact: a decline overrides everything, and "not much of a
 * joker" with no explicit permission has to be read as a decline rather than as a
 * style to imitate.
 */
function humorRule(answers) {
    const get = (aspect) => (answers.find((h) => h.aspect === aspect) || {}).value || '';
    const style = get('style');
    const teasing = get('teasing');
    const permission = get('permission');

    // Two routes to "no", and the second matters: someone who ticks only "I'm not
    // much of a joker" and never reaches the permission question has answered it in
    // substance. Defaulting that to licensed would offer jokes to the one person who
    // told us they do not make them.
    const declined = permission === HUMOR_DECLINE
        || (!permission && style === HUMOR_NOT_A_JOKER);
    if (declined) {
        // The override clause is load-bearing and was added after a live check caught
        // the failure: with wry style examples in the prompt from Sound Check, the
        // model went light ANYWAY and ignored the decline. Style evidence and a
        // stated preference are different kinds of instruction, and the model will
        // not rank them on its own — so say which wins. A refusal that quietly loses
        // to an example is worse than never having asked.
        return 'This person does not want joking or cheeky suggestions. Keep every '
            + 'response straight and sincere — no wisecracks, no playful deflections, no '
            + 'teasing, not even as one option among several, and not on a turn where a '
            + 'joke would seem to fit. This OVERRIDES the style examples you have been '
            + 'given: if one of them sounds wry or joking, take only its length and '
            + 'directness and drop the humor entirely.';
    }
    // Silence is not permission. With a style but no answer on the cheeky question we
    // know their taste and not whether they want it used, so say the taste and stop.
    const licensed = permission === 'Yes, whenever it fits' || permission === HUMOR_CLOSE_ONLY;

    const parts = [];
    if (style) parts.push(`Their sense of humor: ${style}.`);
    if (teasing === 'I enjoy it') {
        parts.push('They enjoy back-and-forth teasing.');
    } else if (teasing === HUMOR_CLOSE_ONLY) {
        parts.push('They enjoy back-and-forth teasing, but only with people they are '
            + 'close to — never with a stranger, and never in a formal setting.');
    } else if (teasing === HUMOR_TEASE_NO) {
        parts.push('Teasing is not their thing: never offer a response that teases the partner.');
    }
    if (!parts.length && !licensed) return '';

    // The permission clause and the licence to act on it are ONE unit and must not
    // come apart: a first cut appended the hard-limits paragraph unconditionally, so
    // an unlicensed profile said "do not offer one" and then, four lines later,
    // "a light brush-off is a good use of that one option." A test caught it.
    if (!licensed) {
        parts.push('They have NOT said whether they want joking suggestions, so do not '
            + 'offer one. Use the above only to judge their general tone; never write a '
            + 'joke, a wisecrack or a playful deflection into any response.');
        return 'How this person does humor. ' + parts.join(' ');
    }

    parts.push(permission === HUMOR_CLOSE_ONLY
        ? 'They are happy to be offered a joking or cheeky response, but only with '
          + 'people they are close to. With anyone else, keep every option straight.'
        : 'They are happy to be offered a joking or cheeky response when one fits.');

    // The guard is two-sided, like the trait and place blocks, and for a sharper
    // reason: the failure here is not an awkward sentence but a joke landing in the
    // user's own voice at the wrong moment, which cannot be taken back. So the ONE
    // slot cap is a hard limit, not a preference — the user must always keep a plain
    // way to say the same thing, since a card can be tapped by mistake.
    parts.push('Use this ONLY to decide whether a LIGHTER response belongs among the '
        + 'options, and what key it should be in. Hard limits: at most ONE response on '
        + 'any turn may be the playful one, so there is always a straight way to say the '
        + 'same thing; never state or describe any of this; and never go light on a turn '
        + 'that is serious, upsetting or medical, or where the partner sounds distressed. '
        + 'Where the user genuinely cannot answer something, a light brush-off is a good '
        + 'use of that one option.');

    return 'How this person does humor. ' + parts.join(' ');
}

/*
 * B5 beliefs — the strictest block in the file, and the only one whose failure mode
 * is a card the user would be ashamed of rather than merely an awkward one.
 *
 * WHY THE PRIVATE-FACT TREATMENT IS NOT ENOUGH. `defaultPrivacy: private` sends the
 * value with "do not volunteer it", which handles disclosure and nothing else. For
 * faith and politics the disclosure risk is the SMALLER one. The larger is a card
 * that takes a POSITION — arguing a side, agreeing with a claim, conceding a point —
 * spoken in the user's own voice to someone who will remember it. That happens
 * whether or not the belief is ever named, and it happens most easily when the model
 * knows nothing and fills the gap with the average view.
 *
 * So knowing is better than not knowing, and the rule below is what makes knowing
 * safe: the facts are here to stop the model guessing wrong, never to be used.
 */
function beliefRule(answers) {
    const get = (kind) => (answers.find((b) => b.kind === kind) || {}).value || '';
    const facts = [];
    const faith = get('faith');
    const tradition = get('faith_tradition');
    const politics = get('politics');
    const lean = get('politics_lean');

    if (faith) facts.push(`Faith or spirituality: ${faith}${tradition ? ` (${tradition})` : ''}.`);
    else if (tradition) facts.push(`Faith tradition: ${tradition}.`);
    if (politics) facts.push(`Strong social or political views: ${politics}${lean ? ` (${lean})` : ''}.`);
    else if (lean) facts.push(`Where they lean politically: ${lean}.`);
    if (!facts.length) return '';

    return 'The most sensitive things in this profile, and the rules on them are absolute. '
        + facts.join(' ')
        + ' NEVER raise faith, politics or a social issue on your own initiative — not as a topic, '
        + 'not as an aside, not as an example, however naturally it would fit. NEVER write a response '
        + 'that argues a side, agrees with a claim, or concedes a point on any of these, and never '
        + 'let a response imply a view the user has not stated. When the PARTNER raises one, the '
        + 'options must let the user say as much or as little as they choose, and one of them must '
        + 'always be a way to not engage at all. What is written above is here so that you do not '
        + 'guess wrong about this person — it is not material to use.';
}

export function buildBlock() {
    ensureLoaded();
    const facts = [];
    const privateKnown = [];   // sent to AI, but must not be volunteered
    const phraseAround = new Set();   // declined — AI gets no value at all
    // Some answers are not facts to know, they are INSTRUCTIONS to follow. "Topics I
    // would rather not be asked about" listed as `- Topic to avoid: X` is merely
    // information, and leaves the model to infer what to do with it. A field carrying
    // `directive` in the registry is emitted as a rule instead. (August 7 2026.)
    const seek = [];
    const avoid = [];
    // The one exception to the no-outside-knowledge rule that the user can grant
    // themselves (Ken, August 8 2026). The prompt otherwise refuses to answer any
    // question needing world knowledge, because the model cannot know what is in
    // this person's head. Naming a subject here is the user saying it IS.
    const expert = [];
    // Humor (B2) is the clearest case of the directive rule: "sarcastic" listed as a
    // fact tells the model nothing about what to DO with it, and the two wrong things
    // it might do are opposite — sprinkle sarcasm through every card, or ignore it.
    // Collected here and emitted as one governed instruction below.
    const humor = [];
    // B5 beliefs. These need a combination nothing else in this block has: they must
    // SHAPE responses (like a trait) while never being VOLUNTEERED (like a private
    // fact). The plain private-fact treatment gets only the second half, and for
    // faith and politics the first half is where the real damage lives — a card that
    // takes a position the user does not hold, spoken in their voice.
    const beliefs = [];
    const outlook = [];
    // B6, keyed by relationship category rather than by named person. Covers the
    // partner nobody has written a per-person profile for, strangers included.
    const groups = [];
    const conflict = [];
    const understand = [];
    // Tier B (personality + values) answers are Likert, and emitting them as one
    // "- Label: Very much like me" line each would be twenty lines of noise: the
    // model would have to infer what a scale point means, and the low-signal bulk
    // is exactly what the second edition of the voice plan criticised about trait
    // scores. They are aggregated into a single sentence of plain descriptions
    // instead, and a NEUTRAL answer contributes nothing at all -- the same rule as
    // the per-partner register, and what keeps a half-answered module cheap.
    const traits = [];

    if (registry) {
        for (const mod of registry.modules) {
            for (const f of mod.fields) {
                const state = getState(f.key);
                if (state === 'declined') {
                    phraseAround.add(labelFor(f.key).toLowerCase());
                    continue;
                }
                if (state !== 'answered') continue;
                const v = formatValue(getField(f.key));
                if (!v) continue;
                if (f.directive === 'avoid') { avoid.push(v); continue; }
                if (f.directive === 'seek') { seek.push(v); continue; }
                if (f.directive === 'expert') { expert.push(v); continue; }
                if (f.directive === 'humor') { humor.push({ aspect: f.humorAspect, value: v }); continue; }
                if (f.directive === 'belief') { beliefs.push({ kind: f.belief, value: v }); continue; }
                if (f.directive === 'outlook') { outlook.push(v); continue; }
                if (f.directive === 'register_group') { groups.push({ group: f.group, value: v }); continue; }
                if (f.directive === 'conflict') { conflict.push(v); continue; }
                if (f.directive === 'understand') { understand.push(v); continue; }
                if (f.trait) {
                    const clause = traitClause(f, v);
                    if (clause) traits.push(clause);
                    continue;   // never also emitted as a raw "Label: scale point"
                }
                if (effectivePrivacy(f.key) === 'private') {
                    privateKnown.push(`- ${labelFor(f.key)}: ${v}`);
                } else {
                    facts.push(`- ${labelFor(f.key)}: ${v}`);
                }
            }
        }
    }

    if (!facts.length && !privateKnown.length && !phraseAround.size && !seek.length
        && !avoid.length && !traits.length && !expert.length && !humor.length
        && !beliefs.length && !outlook.length && !groups.length && !conflict.length
        && !understand.length) return '';

    const lines = ['You are speaking AS this person, in the first person. What you know about them:'];
    if (facts.length) lines.push('', ...facts);
    if (traits.length) {
        // The guard matters more here than anywhere else in this block. Every other
        // entry is a FACT the user could plausibly state out loud; a personality
        // description is not something anyone says about themselves, and "sociable
        // and comfortable around people" worked into a response as "I'm a really
        // sociable person!" would be both false-sounding and faintly absurd. So the
        // purpose is stated before the content and the prohibition after it — the
        // same two-sided guard the place block and the per-partner goal carry.
        lines.push(
            '',
            'How this person describes themselves: ' + traits.join('; ') + '.',
            'Use this ONLY to judge attitude and outlook — how they would react, what '
            + 'they would care about, which of several possible responses fits them. It is '
            + 'not a fact about their life and not a topic. Never state it, never quote it '
            + 'back, and never have them describe their own character.'
        );
    }
    if (privateKnown.length) {
        lines.push(
            '',
            'These details are known to you for context — do not volunteer them spontaneously. Never work one into a response on your own initiative. Include one ONLY when the partner has asked for it, or when the user\'s own typed guidance tells you to:',
            ...privateKnown
        );
    }
    if (avoid.length) {
        // Stated as a rule about the ASSISTANT's own suggestions, because that is the
        // only thing it controls — it cannot stop a partner asking. Deliberately not
        // an absolute ban on the subject: the user may well want to raise it
        // themselves, and a card that refuses to discuss their own life would be its
        // own kind of failure. Same shape as the private-fact rule: never on your own
        // initiative.
        lines.push(
            '',
            'This person would rather not be asked about the following: ' + avoid.join(', ')
            + '. Never raise any of it on your own initiative. If the partner brings it up, do not '
            + 'volunteer detail, and make sure one of the responses you offer lets the user move the '
            + 'conversation on. If the user steers you to it themselves, follow them.'
        );
    }
    if (expert.length) {
        // Scoped hard, for the reason the rule exists at all: this widens what may be
        // put in the user's mouth, so it must widen no further than the subjects they
        // actually named. "Knows about astronomy" is not licence on the Napoleonic
        // wars, and an adjacent-sounding topic is still outside.
        lines.push(
            '',
            'This person knows the following subjects WELL, and says so themselves: ' + expert.join(', ')
            + '. Within these subjects ONLY, the rule against supplying outside knowledge is lifted — '
            + 'answer with real substance, the way someone who knows the subject would. This does not '
            + 'extend to neighbouring or merely related subjects. Nor does it license lecturing: these '
            + 'are still SPOKEN conversational turns, so keep every one to a sentence or two, answer '
            + 'what was actually asked, and stop. No lead-ins, no history of the idea, no famous quotes '
            + 'or anecdotes, no "and what is fascinating is…". Knowing a subject well makes someone '
            + 'CONCISE about it, not lengthy.'
        );
    }
    if (humor.length) {
        const rule = humorRule(humor);
        if (rule) lines.push('', rule);
    }
    if (outlook.length) {
        // A disposition, not a sensitive belief — kept out of the beliefs block on
        // purpose, or "optimist" would inherit the never-raise rules that faith and
        // politics need and stop being usable at all.
        lines.push('',
            `Their general outlook on things: ${outlook.join('; ')}. Let it color how they react — `
            + 'what they expect, how they read a situation — without ever stating it.');
    }
    if (conflict.length) {
        lines.push('',
            `When there is tension or disagreement, this person tends to: ${conflict.join('; ')}. `
            + 'Shape the DISPREFERRED option around that, so declining or disagreeing sounds like '
            + 'them rather than like a generic hedge. Never state it.');
    }
    if (groups.length) {
        // Per-CATEGORY defaults. The per-person profile on the relationship graph is
        // the more specific instrument and must win where it exists; without this,
        // an unidentified partner — or any of the many people who will never get a
        // written profile — gets nothing at all.
        const shifts = groups
            .filter((g) => g.value !== 'About the same')
            .map((g) => `with ${g.group}, ${g.value.toLowerCase()}`);
        if (shifts.length) {
            lines.push('',
                'How this person shifts depending on who they are with: ' + shifts.join('; ') + '. '
                + 'Apply the line that matches who they are speaking to now, when you have been told '
                + 'who that is. This governs WORDING only — how formal, how open, how guarded — never '
                + 'what is talked about, and none of it is ever stated. Anything recorded about a '
                + 'specific named person overrides this; these are the defaults for everyone else.');
        }
    }
    if (understand.length) {
        // The one entry here the user may well WANT said — so it takes the opposite
        // shape to the never-raise rules: do not introduce it, but make sure they can
        // reach it when the partner opens the door.
        lines.push('',
            `Something this person wants people to understand about them: "${understand.join('" "')}". `
            + 'Use it to judge how they want to come across. Do NOT raise it yourself and never quote '
            + 'it back — but when the partner touches on it, make sure one of the options lets the '
            + 'user say it in their own words.');
    }
    if (beliefs.length) {
        const rule = beliefRule(beliefs);
        if (rule) lines.push('', rule);
    }
    if (seek.length) {
        lines.push(
            '',
            'This person always enjoys talking about: ' + seek.join(', ')
            + '. These are good ground for an INITIATIVE response when the conversation is open.'
        );
    }
    if (phraseAround.size) {
        lines.push(
            '',
            'The person chose not to share these — do not state, invent, or ask about them; phrase around if they come up: '
            + [...phraseAround].join(', ') + '.'
        );
    }
    return lines.join('\n');
}
