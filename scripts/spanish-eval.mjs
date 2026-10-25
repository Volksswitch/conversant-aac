/*
 * Do the AI instructions carry over to Spanish? (Ken, October 18 2026.)
 *
 * The cheap first test before any Spanish work is built. The app's instructions to
 * the AI are all in English; the only change here is one added line telling it to
 * answer in Mexican / US Latino Spanish. A native speaker then reads every set of
 * options and judges whether they sound natural and whether the app's rules still
 * hold:
 *   - the four kinds of response (agree / decline politely / add something / clarify)
 *   - a menu offered by the other person becomes one option per choice
 *   - the honesty rule: no facts about the world the user did not give
 *   - "What?" is recognized as the other person asking the user to repeat
 *   - tu vs usted follows the relationship
 *   - the user's gender ("cansado" / "cansada")
 *   - bilingual speech: the other person mixes English in; the user types in English
 *
 * Nothing is scored automatically except a few mechanical checks noted in the
 * report. A person reads every option.
 *
 * Run:  node --no-warnings scripts/spanish-eval.mjs
 * Needs the API key in .anthropic-key (or ANTHROPIC_API_KEY). About 16 requests,
 * well under a dollar. Writes Reports/spanish-eval-<date>.md and .json (git-ignored);
 * the .json feeds the native speaker's review page (scripts/spanish-review/).
 */
import '../tests/env.mjs';
import { loadApiKey } from '../tests/env.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import * as llm from '../app/js/llm.js';

// The one added instruction. Kept short on purpose: the question is whether the
// existing English rules carry over with nothing else changed.
const LANGUAGE = `LANGUAGE: The user speaks Spanish, the Mexican / US Latino variety. Write every response "text" and "hint" in natural, spoken Mexican Spanish, as a person from that community would actually say it out loud - not translated English, not Spain's Spanish. Keep "offered_options" in the language the partner used. Everything else about these instructions still applies.`;

const BASE = `About the user:
- Name: Marisol. Age: 24. Lives in San Antonio, Texas, with her mother and grandmother.
- Has cerebral palsy and does not speak; uses this app to talk.
- Bilingual: speaks Spanish at home and with family, English at work and with most friends.
- Works part time at a community library. Likes cumbia, telenovelas, and the Spurs.`;
const GENDER = '- Gender: female.';

const PROFILE_WITH_GENDER = `${LANGUAGE}\n\n${BASE}\n${GENDER}`;
const PROFILE_NO_GENDER = `${LANGUAGE}\n\n${BASE.replace('with her mother and grandmother', 'with family').replace('; uses', '. Uses')}`;

// what = what the reviewer should look for.
const SCENARIOS = [
    { id: 'S1', who: 'Friend (Ana)', partner: '¡Qué onda, Mari! ¿Cómo has estado?',
      what: 'Ordinary greeting. Do the four options sound like a 24-year-old talking to a friend?' },
    { id: 'S2', who: 'Cousin', partner: 'Oye, ¿vienes a la fiesta de mi hermana el sábado?',
      what: 'Invitation. Is the polite decline (the second option) a natural way to say no?' },
    { id: 'S3', who: 'Barista', partner: '¿Lo quieres chico, mediano o grande?',
      what: 'A menu. There should be one option per size, plus a spare.' },
    { id: 'S4', who: 'Coworker', partner: '¿Sabes en qué año fue la independencia de México?',
      what: 'A fact question. The app should NOT answer it (the honesty rule); it should say she is not sure, or turn it back.' },
    { id: 'S5', who: 'Grandmother (Abuelita)', partner: 'Mija, ¿ya comiste?',
      what: 'Family, warm. Natural for a granddaughter?' },
    { id: 'S6', who: 'Doctor (Dr. Ramírez)', situation: 'The user uses "usted" with this person, never "tú".',
      partner: '¿Cómo se ha sentido desde la última consulta?',
      what: 'Formal. Every option should use usted, not tú.' },
    { id: 'S7', who: 'Store clerk (stranger)', partner: '¿Necesita ayuda para encontrar algo?',
      what: 'No instruction about tú/usted. Does the AI choose sensibly for a stranger?' },
    { id: 'S8', who: 'Mother', partner: '¿Estás cansada? Te ves cansada.', profile: 'gender',
      what: 'Gender given as female. Options should say "cansada", never "cansado".' },
    { id: 'S9', who: 'Friend', partner: '¿Cómo amaneciste hoy? ¿Bien o cansado?', profile: 'nogender',
      what: 'NO gender in the profile, and the partner used the masculine. What does the AI do? (There is no right answer here - this shows the gap.)' },
    { id: 'S10', who: 'Mother', partner: '¿Mande?', history: [
        { role: 'partner', text: '¿Qué quieres de cenar?' },
        { role: 'user', text: 'Quiero enchiladas verdes, por favor.' }],
      what: '"¿Mande?" is the Mexican "What?". It should be recognized as asking her to repeat (the report shows whether it was).' },
    { id: 'S11', who: 'Coworker', partner: 'Oye, ¿ya terminaste el report para el meeting de mañana?',
      what: 'The partner mixes English in (very common). Do the options sound natural for a bilingual speaker, and is the mixing handled well?' },
    { id: 'S12', who: 'Friend', partner: 'Hey, are you coming to the game tonight?',
      what: 'The partner speaks ENGLISH to a Spanish-set user. What language do the options come back in? (Shows whether language belongs to the partner.)' },
    { id: 'S13', who: 'Cousin', partner: '¿Vienes al cine con nosotros mañana?',
      steer: 'dile que no puedo porque tengo cita con el doctor',
      what: 'She typed her point in Spanish and pressed Reframe. Every option should carry it (doctor\'s appointment).' },
    { id: 'S14', who: 'Cousin', partner: '¿Vienes al cine con nosotros mañana?',
      steer: "I can't, I have to work",
      what: 'She typed her point in ENGLISH. Do the options come back in Spanish and carry the point?' },
    { id: 'S15', who: 'Friend', partner: 'Bueno, ya me voy. ¡Cuídate mucho!',
      what: 'The friend is leaving. The report shows whether it was recognized as a goodbye.' },
    { id: 'S16', who: 'Nurse', partner: 'Del uno al diez, ¿cuánto le duele?',
      what: 'A 1-to-10 scale. The app should recognize the range (the number button), not list ten choices.' },
];

function setupFor(s) {
    llm.setWorldviewBlock(s.profile === 'nogender' ? PROFILE_NO_GENDER : PROFILE_WITH_GENDER);
    llm.setSituationBlock(`The user is talking with: ${s.who}.${s.situation ? ' ' + s.situation : ''}`);
}

// Mechanical checks a non-Spanish reader can trust. Everything else is the reviewer's.
function checks(s, r) {
    const c = r.classification || {};
    const texts = (r.responses || []).map(o => `${o.text} ${o.hint || ''}`).join(' ');
    const notes = [];
    if (s.id === 'S3') notes.push(`menu recognized: ${JSON.stringify(c.offered_options || [])}`);
    if (s.id === 'S6') notes.push(/\b(tú|tu|te|contigo|estás|quieres|puedes)\b/i.test(texts) ? 'POSSIBLE tú form found - check' : 'no obvious tú forms');
    if (s.id === 'S8') notes.push(/cansado\b/i.test(texts) ? 'MASCULINE "cansado" found' : 'no masculine "cansado"');
    if (s.id === 'S9') notes.push(`cansado: ${/cansado\b/i.test(texts)}, cansada: ${/cansada\b/i.test(texts)}`);
    if (s.id === 'S10') notes.push(`recognized as "please repeat": ${!!c.is_repair_initiator}`);
    if (s.id === 'S15') notes.push(`partner action: ${c.partner_action}`);
    if (s.id === 'S16') notes.push(`range: ${JSON.stringify(c.offered_range ?? null)}, options: ${JSON.stringify(c.offered_options || [])}`);
    if (s.id === 'S4') notes.push(/1810|1821/.test(texts) ? 'GAVE A DATE (honesty rule broken)' : 'no date given');
    return notes;
}

async function run() {
    const key = loadApiKey();
    if (!key) { console.error('No API key: add .anthropic-key or set ANTHROPIC_API_KEY.'); process.exit(1); }
    llm.setApiKey(key);

    const date = new Date().toISOString().slice(0, 10);
    const L = [`# Spanish evaluation - ${date}`, '',
        'The app\'s English instructions to the AI, plus one line asking for Mexican / US Latino Spanish.',
        'For each set: does every option sound like something a bilingual young woman from San Antonio would actually say? Note anything stiff, translated-sounding, from another region, or wrong.', ''];
    let ok = 0, failed = 0;
    const sets = [];

    for (const s of SCENARIOS) {
        setupFor(s);
        const history = [...(s.history || []), { role: 'partner', text: s.partner }];
        L.push(`## ${s.id} - ${s.who}`, '', `*Look for:* ${s.what}`, '');
        for (const h of s.history || []) L.push(`**${h.role === 'user' ? 'Marisol' : s.who}:** ${h.text}`, '');
        L.push(`**${s.who}:** ${s.partner}`, '');
        if (s.steer) L.push(`**Marisol typed (Reframe):** ${s.steer}`, '');
        const set = { id: s.id, who: s.who, what: s.what, history: s.history || [],
            partner: s.partner, steer: s.steer || null, options: [], checks: [] };
        try {
            const r = await llm.generateResponses(history, {}, s.steer ? { steer: s.steer } : {});
            ok++;
            set.options = (r.responses || []).map(o => ({ slot: o.slot, text: o.text, hint: o.hint || null }));
            // A "What?" turn comes back with no responses BY DESIGN: the app then offers
            // the user's last words again, plus a reworded and a fuller version, from a
            // second request. Make that request here, so the reviewer sees what the user
            // would actually see. The short wording on those three is fixed English in
            // the app, so there is no button wording to judge.
            if (r.classification?.is_repair_initiator) {
                const last = [...(s.history || [])].reverse().find(h => h.role === 'user');
                if (last) {
                    const rep = await llm.repairOptions(last.text, history);
                    set.options = [
                        { slot: 'REPAIR_RESPEAK', text: last.text, hint: null },
                        { slot: 'REPAIR_REPHRASE', text: rep.rephrase, hint: null },
                        { slot: 'REPAIR_EXPAND', text: rep.expand, hint: null },
                    ].filter(o => o.text);
                }
            }
            for (const o of set.options) L.push(`- **${o.slot}:** ${o.text}${o.hint ? `  *(button: ${o.hint})*` : ''}`);
            if (!set.options.length) L.push('- *(no options came back)*');
            set.checks = checks(s, r);
            if (set.checks.length) L.push('', `Automatic check: ${set.checks.join('; ')}`);
        } catch (err) {
            failed++;
            set.failed = err.message;
            L.push(`- **FAILED:** ${err.message}`);
        }
        sets.push(set);
        L.push('');
        process.stdout.write(`${s.id} `);
    }
    L.splice(4, 0, `Answered ${ok}, failed ${failed}.`, '');
    mkdirSync('Reports', { recursive: true });
    const out = `Reports/spanish-eval-${date}.md`;
    writeFileSync(out, L.join('\n'), 'utf8');
    // The same results as data, for the reviewer's page
    // (scripts/spanish-review/build-review-page.mjs).
    const json = `Reports/spanish-eval-${date}.json`;
    writeFileSync(json, JSON.stringify({ date, sets }, null, 2), 'utf8');
    console.log(`\n${out}\n${json}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
