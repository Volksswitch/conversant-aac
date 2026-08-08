/* Voice — how this user SOUNDS, as distinct from what they can truthfully say
 * (Sounds Like Me, Phase 0 + Phase 1; Ken, August 7 2026)
 *
 * The fifth user-owned file, following the same shape as worldview / relationships /
 * express-panel / places:
 *   - <data folder>/voice.json        portable source of truth (FSA/OPFS)
 *   - localStorage 'aac_voice'        same-machine write-through cache
 * Reconciliation is the v0.2.25 rule: a file in the connected folder wins; the cache
 * is promoted to a new file only when none exists on disk yet.
 *
 * WHY THIS EXISTS. The generation prompt has told the model "You speak AS the user,
 * in their voice" since v0.3.0 with nothing behind it. Given no stylistic information
 * a model does not produce neutral English — it produces its OWN register, which is
 * verbose, formal, explicit and assistant-shaped. So the app was not neutral on the
 * question of who this person is; it was answering it wrongly, the same way, on every
 * card of every palette.
 *
 * WHAT GOES IN THE BLOCK: EXEMPLARS, NOT ADJECTIVES. Few-shot examples steer style
 * far better than descriptions do — measured at up to 23.5x the style-matching
 * accuracy of no examples, with the prompting strategy mattering more than the size
 * of the model (Jemama & Naous 2025). Descriptions are additionally the worst thing
 * to ask this user for, because people cannot accurately describe their own style:
 * the features that most mark an individual are produced below conscious awareness
 * (Tausczik & Pennebaker 2010), and style is highly observable and highly evaluative,
 * the quadrant where the self is least accurate (Vazire 2010). So the user is never
 * asked to characterize themselves; they are asked which of several replies they
 * would rather say, and the sentences they pick ARE the examples.
 */

import { readFile, writeFile, hasDataFolder } from './storage.js';
// For the item's dimension only, so buildBlock can tell a bland exemplar (safe to
// reuse verbatim) from a levity one (never reuse). sound-check-items.js imports
// nothing, so there is no cycle.
import { getItem } from './sound-check-items.js';

const FILE = 'voice.json';
const CACHE_KEY = 'aac_voice';

let profile = null;

function emptyProfile() {
    return {
        version: 1,
        updated: new Date().toISOString(),
        // Sound Check: itemId -> { verdict, choice }. `choice` is the exemplar the
        // user endorsed; null when they answered with one of the two escapes.
        soundCheck: {},
        // "What you never say" — negative constraints. Cheap for a user to state,
        // easy for a model to obey, and unusually high-value: getting this wrong is
        // conspicuous in a way that getting warmth slightly wrong is not.
        never: [],
        // Optional authored samples (Phase 1, deliberately NOT load-bearing — a
        // sample depends on the slowest feature in the app and is shortened by the
        // effort of producing it).
        samples: {},
        // Phase 2: what reading the user's own past conversations concluded.
        // { exemplars: [], lengthLean: {...}|null, counts: {}, at: ISO }
        harvest: null,
        // Harvested sentences the user has explicitly removed. Kept so a later
        // re-harvest does not put them straight back — "I can see and correct what
        // it concluded" is worthless if the correction does not stick.
        dismissed: [],
        // Every Reframe steer the user has typed: [{ text, at }].
        //
        // A steer is the user telling the app its suggestion was not right and how —
        // "keep it short", "lean toward saying no". It lives HERE rather than in the
        // conversation log because it is never spoken and never appears in the
        // conversation pane, so recording it there would muddy the standing rule that
        // the transcript mirrors the pane. Errors are in the log as a deliberate
        // diagnostic exception; a steer is not a diagnostic.
        steers: [],
    };
}

function normalize(raw) {
    const base = emptyProfile();
    if (!raw || typeof raw !== 'object') return base;
    return {
        ...base,
        ...raw,
        soundCheck: (raw.soundCheck && typeof raw.soundCheck === 'object') ? raw.soundCheck : {},
        never: Array.isArray(raw.never) ? raw.never.filter((s) => typeof s === 'string' && s.trim()) : [],
        samples: (raw.samples && typeof raw.samples === 'object') ? raw.samples : {},
        harvest: (raw.harvest && typeof raw.harvest === 'object') ? raw.harvest : null,
        dismissed: Array.isArray(raw.dismissed) ? raw.dismissed.filter((x) => typeof x === 'string') : [],
        steers: Array.isArray(raw.steers) ? raw.steers.filter((x) => x && typeof x.text === 'string') : [],
    };
}

function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}
function writeCache(p) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(p)); } catch { /* quota — disk is truth */ }
}
function writeDisk(p) {
    writeFile(FILE, JSON.stringify(p, null, 2)).catch(() => { /* best-effort */ });
}

/** Load: data folder (source of truth) → cache → empty. */
export async function load() {
    let loaded = null;
    const raw = await readFile(FILE);
    if (raw) { try { loaded = JSON.parse(raw); } catch { loaded = null; } }
    if (!loaded) loaded = readCache();
    profile = normalize(loaded);
    writeCache(profile);
    return profile;
}

function current() {
    if (!profile) profile = normalize(readCache());
    return profile;
}

function save() {
    profile.updated = new Date().toISOString();
    writeCache(profile);
    writeDisk(profile);
    return profile;
}

/**
 * Record one Sound Check answer. `choice` is the exemplar text the user endorsed, or
 * null for the two escapes — "They're all fine" (a weak or absent preference,
 * recorded as what it is rather than as a spurious first-place vote) and "I wouldn't
 * say any of these" (the genuinely different state, and at least as informative,
 * because it is a negative constraint arriving unprompted).
 */
export function recordAnswer(itemId, verdict, choice = null) {
    const p = current();
    p.soundCheck[itemId] = { verdict, choice: choice || null, at: new Date().toISOString() };
    return save();
}

export function getAnswer(itemId) {
    return current().soundCheck[itemId] || null;
}

export function clearAnswer(itemId) {
    const p = current();
    delete p.soundCheck[itemId];
    return save();
}

/** How many Sound Check items have been answered — drives the module's progress. */
export function answeredCount() {
    return Object.keys(current().soundCheck).length;
}

export function getNever() { return current().never.slice(); }
export function setNever(list) {
    const p = current();
    p.never = (Array.isArray(list) ? list : []).map((s) => String(s).trim()).filter(Boolean);
    return save();
}

export function getSample(key) { return current().samples[key] || ''; }
export function setSample(key, text) {
    const p = current();
    const t = String(text || '').trim();
    if (t) p.samples[key] = t; else delete p.samples[key];
    return save();
}

// A steer typed once is a one-off about that particular turn; typed again, word for
// word, it is a standing preference the app keeps failing to meet. Two is the bar
// because typing the identical instruction twice is deliberate, and because the user
// can see the count and remove it — a wrongly promoted preference shapes every future
// response, so it is shown with its evidence rather than asserted.
const STEER_REPEAT_MIN = 2;
const MAX_STEERS = 200;

function normalizeSteer(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Record one typed Reframe steer. Callers gate on storage.isConversationSaving(). */
export function recordSteer(text) {
    const t = String(text || '').trim();
    if (!t) return current();
    const p = current();
    p.steers.push({ text: t, at: new Date().toISOString() });
    if (p.steers.length > MAX_STEERS) p.steers = p.steers.slice(-MAX_STEERS);
    return save();
}

/**
 * Steers the user has typed more than once, most-repeated first. Anything said only
 * once is deliberately excluded: it was about that turn, not about how they sound.
 */
export function repeatedSteers(min = STEER_REPEAT_MIN) {
    const p = current();
    const gone = new Set(p.dismissed.map((s) => s.trim().toLowerCase()));
    const groups = new Map();
    for (const s of p.steers) {
        const key = normalizeSteer(s.text);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, { text: s.text, count: 0 });
        groups.get(key).count++;
    }
    return [...groups.values()]
        .filter((g) => g.count >= min && !gone.has(g.text.trim().toLowerCase()))
        .sort((a, b) => b.count - a.count);
}

/** Store what the harvest concluded (voice-harvest.js does the reading). */
export function setHarvest(result) {
    const p = current();
    p.harvest = result ? { ...result, at: new Date().toISOString() } : null;
    return save();
}

export function getHarvest() { return current().harvest; }

/**
 * The harvested sentences that are actually in play — everything found, minus what
 * the user has removed. "Here is what I think you sound like" cannot be a black box,
 * least of all for people who have spent their lives having others speak for them.
 */
export function activeExemplars() {
    const p = current();
    const found = (p.harvest && Array.isArray(p.harvest.exemplars)) ? p.harvest.exemplars : [];
    const gone = new Set(p.dismissed.map((s) => s.trim().toLowerCase()));
    return found.filter((t) => !gone.has(String(t).trim().toLowerCase()));
}

/** Remove a harvested sentence, permanently — a re-harvest must not resurrect it. */
export function dismissExemplar(text) {
    const p = current();
    const t = String(text || '').trim();
    if (t && !p.dismissed.includes(t)) p.dismissed.push(t);
    return save();
}

export async function resetAll() {
    profile = emptyProfile();
    writeCache(profile);
    await writeFile(FILE, JSON.stringify(profile, null, 2)).catch(() => {});
    return profile;
}

/** Reconcile once a data folder becomes available — v0.2.25 file-in-folder-wins. */
export async function syncToFolder() {
    if (!hasDataFolder()) return 'noop';
    const raw = await readFile(FILE);
    let disk = null;
    if (raw) { try { disk = JSON.parse(raw); } catch { disk = null; } }
    if (disk) {
        profile = normalize(disk);
        writeCache(profile);
        return 'adopted';
    }
    profile = current();
    await writeFile(FILE, JSON.stringify(profile, null, 2));
    return 'wrote';
}

/**
 * The voice block for the system prompt.
 *
 * `idiom` is the user's OWN Express Panel phrases (provenance-filtered — see
 * express-items.js). Two cautions are wired into the wording itself rather than left
 * to whoever calls this:
 *
 *   1. Express phrases are evidence of VOCABULARY and IDIOM, never of LENGTH. Button
 *      labels are short by construction, so a model shown a list of them will
 *      conclude the user is terse — a bias that came from the widget, not the person.
 *      The block says so explicitly.
 *   2. The model must never PRODUCE the user's catchphrases (Sounds Like Me 4.1).
 *      Given a list of them, models over-apply: they sprinkle the marker where a real
 *      speaker would not, and idiolect used slightly wrong reads as impersonation,
 *      which is worse than idiolect absent. Those phrases live as Express Panel
 *      buttons the user taps deliberately; the model is told to recognize the
 *      register, not to reproduce the phrases.
 *
 * Returns '' when there is nothing to say, so the prompt gains no empty heading.
 */
export function buildBlock(idiom = []) {
    const p = current();
    const lines = [];

    /*
     * The bank's items split into two kinds and they need OPPOSITE instructions —
     * a distinction that did not exist until the levity items were added on
     * August 8 2026, and that a live check made unavoidable.
     *
     * Most items are deliberately bland ("Good, thanks.", "That's fine, no rush."),
     * and the model reusing one verbatim is not a defect: the user picked it because
     * it is what they would say, and nobody notices someone saying "Good, thanks."
     * twice. A LEVITY item is the opposite — its whole value is that it is
     * distinctive, and a distinctive line reused becomes a verbal tic. The same
     * brush-off on every unanswerable question is the placeholder-predictability
     * failure ("predictable fillers become a joke to partners over time") arriving
     * through the voice layer.
     *
     * So they are listed separately and told apart, rather than one blanket plea not
     * to copy anything — which the model followed about two times in three.
     */
    const answered = Object.entries(p.soundCheck)
        .filter(([, a]) => a && a.choice);
    const chosen = answered
        .filter(([id]) => (getItem(id) || {}).dimension !== 'levity')
        .map(([, a]) => a.choice);
    const chosenLevity = answered
        .filter(([id]) => (getItem(id) || {}).dimension === 'levity')
        .map(([, a]) => a.choice);

    if (chosen.length) {
        lines.push('Examples of how this user prefers to reply. They were shown several ways of saying the same thing and picked these:');
        for (const t of chosen.slice(0, 12)) lines.push(`  "${t}"`);
        lines.push('Match the length, directness, and level of formality of those examples. They are the single most important guide to wording that you have.');
        // The exemplars are STYLE, not autobiography. They were picked off a fixed
        // list of hypothetical replies, so anything they appear to mention is a
        // property of the question bank, not of this user — and the anti-fabrication
        // rule is the project's oldest guardrail. The item bank is authored to keep
        // specifics out for the same reason (see sound-check-items.js), but a prompt
        // must not depend on content it does not control.
        lines.push('Treat those examples as evidence of WORDING ONLY. They were chosen from a fixed list of made-up replies, so nothing they mention is a fact about this user and none of it may appear in a response.');
        // Found August 8 2026, the first time the bank carried a DISTINCTIVE example
        // (the levity items): the model returned the chosen sentence back verbatim as
        // a response. It went unnoticed while every example was bland — "Good,
        // thanks." reused is invisible — but a memorable line reused is not, and it
        // would come out on every similar turn, which is the placeholder-predictability
        // failure ("the same joke twice is not a joke") arriving through the voice
        // layer. The rule above forbids reusing their CONTENT; this forbids reusing
        // the SENTENCE, which is a different thing and was never stated.
    }

    if (chosenLevity.length) {
        lines.push('');
        lines.push('Offered a flat reply and a lighter one for an awkward moment — not knowing something, a small mishap, being kept waiting — this user picked the lighter one. This is how they take the edge off:');
        for (const t of chosenLevity.slice(0, 6)) lines.push(`  "${t}"`);
        lines.push('These show you their KEY, not their script. NEVER reply with one of them, or a lightly reworded copy — write a fresh line in the same spirit each time. A memorable phrase reused is a verbal tic, and it stops sounding like a person by about the third outing. Choosing the lighter option here IS this user telling you a lighter reply suits them, so one light response is welcome — UNLESS this profile says elsewhere that they do not want joking suggestions, which overrides this outright and leaves you taking only the length and directness from these.');
    }

    const samples = Object.entries(p.samples).filter(([, v]) => v && v.trim());
    if (samples.length) {
        lines.push('');
        lines.push('Things this user has written, in their own words:');
        for (const [key, text] of samples) lines.push(`  (${key}) ${text}`);
    }

    // PHASE 2 — sentences the user actually composed in past conversations. These
    // are the strongest exemplars there are, and they take the OPPOSITE instruction
    // to the Sound Check ones above. Those were picked off a list WE made up, so
    // nothing in them is a fact. These are the user's real words about real things,
    // so calling them fabrications would be false. But they are PAST utterances, and
    // treating a month-old sentence as currently true is the anti-fabrication failure
    // from the other direction — hence "not current facts" rather than "not facts".
    const harvested = activeExemplars();
    if (harvested.length) {
        lines.push('');
        lines.push('Sentences this user has actually written themselves, in real conversations. This is the best evidence you have of how they put things:');
        for (const t of harvested.slice(0, 12)) lines.push(`  "${t}"`);
        lines.push('Follow their phrasing, rhythm and level of detail. They are things this person said in the PAST, not current facts — do not assume any of it is still true, and do not repeat their content.');
    }

    // Measured from real selections, and stated as the measurement it is. This is the
    // one dimension computable locally without a model call: word count is word
    // count. The others are deliberately not guessed at.
    const lean = p.harvest && p.harvest.lengthLean;
    if (lean && lean.lean && lean.lean !== 'neither') {
        lines.push('');
        lines.push(lean.lean === 'shorter'
            ? `Offered a choice of wordings in real conversations, this user picks the shorter one far more often than the longer (${lean.shorter} of ${lean.shorter + lean.longer} decided). Keep responses brief unless there is a clear reason not to.`
            : `Offered a choice of wordings in real conversations, this user picks the fuller one far more often than the shorter (${lean.longer} of ${lean.shorter + lean.longer} decided). Do not clip responses down to the minimum.`);
    }

    if (idiom.length) {
        lines.push('');
        lines.push(`Words and turns of phrase this user actually uses: ${idiom.slice(0, 20).map((s) => `"${s}"`).join(', ')}.`);
        lines.push('Use these ONLY to judge their vocabulary and level of formality. They are button labels, so they are short for that reason alone — do NOT treat them as evidence that this user prefers short replies. Do NOT put these exact phrases into responses; the user says those themselves.');
    }

    // Corrections the user has had to type more than once. This is the strongest
    // signal in the file, because it is not a preference they reported — it is one
    // they were driven to state repeatedly by the app getting it wrong.
    const steers = repeatedSteers();
    if (steers.length) {
        lines.push('');
        lines.push('When your suggestions have not been right, this user has typed the same correction more than once. Treat each as a standing instruction, not a one-off:');
        for (const s of steers.slice(0, 6)) lines.push(`  "${s.text}" (asked ${s.count} times)`);
    }

    if (p.never.length) {
        lines.push('');
        lines.push(`This user never says: ${p.never.join('; ')}. Respect this without exception.`);
    }

    if (!lines.length) return '';
    return `HOW THIS USER SOUNDS — this governs the WORDING of every response you write.\n${lines.join('\n')}`;
}
