/* Pronunciation lexicon — August 8 2026
 *
 * Names the voice says wrong, and how they should be said instead. A person or place
 * can carry a RESPELLING ("Shiv-awn" for Siobhan), and this applies it to every
 * utterance at the moment the text is handed to the synthesiser.
 *
 * ── WHY A SUBSTITUTION AND NOT JUST A SECOND FIELD ──
 *
 * An Express phrase can carry its own spoken form outright, because the app knows
 * which phrase it is about to say. A NAME cannot work that way: the name usually
 * arrives inside a sentence the AI wrote, which the app never composed and cannot
 * predict. So the only place to correct it is on the way out, by looking for the name
 * in whatever is about to be spoken.
 *
 * ── THE LOAD-BEARING RULE: SPEAK-TIME ONLY ──
 *
 * The respelling must reach the synthesiser and NOTHING else. It must never appear
 * in the transcript, the saved conversation file, the "now playing" line, or the LLM
 * prompt. Each has its own reason, and the last two are the ones that bite:
 *   - Told a person is called "Shiv-awn", a model writes THAT into responses, and the
 *     respelling appears on screen as though it were the person's name.
 *   - A respelling in the saved conversation corrupts the Phase-3 relive-and-critique
 *     feature, and the voice harvest reads those same fields as evidence of how the
 *     user talks.
 * Hence one seam: tts.setPronouncer(), applied to the string given to the voice and
 * to nothing upstream of it. The echo filter also keeps the real name, and that is
 * the more accurate choice rather than a concession - speech-to-text normalises a
 * respelling back to the real word (measured August 8 2026: "rahn-day-voo" came back
 * as "Rendezvous"), so the real name is what the mic will report hearing.
 */

import * as relationships from './relationships.js';
import * as places from './places.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Collect every respelling the user has actually set. Nothing is included unless they
 * deliberately typed it, which is what keeps the blast radius small: a name is only
 * ever rewritten because someone decided the voice was getting it wrong.
 *
 * The nickname is a separate entry from the name because they are separate words —
 * and the nickname is the one spoken MORE often, since the openers use it in
 * preference to the name.
 */
export function buildLexicon(people = [], placeList = []) {
    const out = [];
    const add = (from, to) => {
        const f = (from || '').trim();
        const t = (to || '').trim();
        if (f && t && f !== t) out.push({ from: f, to: t });
    };
    for (const p of people) {
        add(p.name, p.pronunciation);
        add(p.nickname, p.nicknamePronunciation);
    }
    for (const pl of placeList) add(pl.name, pl.pronunciation);
    // Longest first: regex alternation takes the FIRST branch that matches, so without
    // this a person called "Ann" would claim the "Ann" inside "Annabel" and the longer
    // entry could never fire.
    return out.sort((a, b) => b.from.length - a.from.length);
}

/**
 * Rewrite `text` for the synthesiser. Pure — the caller supplies the lexicon.
 *
 * MATCHING IS CASE-SENSITIVE AND WHOLE-WORD, and both halves are deliberate:
 *   - Whole-word so a name cannot be found inside an unrelated word.
 *   - Case-sensitive because names are capitalised and ordinary words are not, which
 *     is the cheap defence against the real hazard here: a person called Bill turning
 *     "pay the bill" into a mispronunciation. It is a defence and not a guarantee —
 *     a sentence STARTING "Bill me later" would still match — so the honest summary
 *     is that a respelling on a name that is also a common word is a bad idea.
 * Everything is replaced in ONE pass, so a respelling that happens to contain another
 * name cannot be rewritten a second time.
 */
export function substitute(text, lexicon) {
    if (!text || !lexicon || !lexicon.length) return text;
    const map = new Map(lexicon.map((e) => [e.from, e.to]));
    const rx = new RegExp(
        '(?<![A-Za-z0-9])(' + lexicon.map((e) => escapeRe(e.from)).join('|') + ')(?![A-Za-z0-9])',
        'g'
    );
    return text.replace(rx, (m) => map.get(m) ?? m);
}

/**
 * The live pronouncer, wired into tts once at startup.
 *
 * Built fresh on every utterance rather than cached, and that is a deliberate trade:
 * the lists are a handful of records, while a cache would need invalidating from
 * every path that edits a person or a place — and a stale lexicon fails silently, in
 * the direction of saying a name the user has already corrected.
 */
export function apply(text) {
    try {
        return substitute(text, buildLexicon(relationships.listPeople(), places.listPlaces()));
    } catch {
        // A pronouncer that throws would take the app's whole voice down with it. The
        // uncorrected name is a far better outcome than silence.
        return text;
    }
}
