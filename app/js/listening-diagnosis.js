/*
 * listening-diagnosis.js - walk the steps of hearing in order and say where it breaks.
 *
 * WHY THIS EXISTS (Ken, November 22 2026): a beta tester's device could not hear the
 * other person, and the problem report held the facts - which service was chosen, which
 * was listening, how loud the microphone got - without anything drawing the conclusion.
 * "The report has the facts, but you have to put them together yourself" is not good
 * enough when finding where hearing breaks is the whole point of the report.
 *
 * Pure: it is handed the facts and returns words, so every branch is tested without a
 * microphone. The facts come from stt.listeningFacts(), micCheck.facts(), the service
 * test (stt.testHearingService), the platform's verdict on built-in recognition, and
 * the browser's microphone permission.
 *
 * ⚠ THE COUNTS COVER ONLY THIS SESSION, since the app was last opened. A tester who
 * hit the problem, closed the app and then sent a report gives counts of nothing, and
 * the check must say so rather than read the silence as "nothing went wrong".
 *
 * Each step is OK, PROBLEM, NOT KNOWN or NOT MEASURED. The first PROBLEM is where
 * hearing breaks; later steps can only be as good as the ones before them.
 */

const LABELS = {
    builtin: "this device's own listening",
    browser: "this device's own listening",
    deepgram: 'Deepgram',
    azure: 'Azure Speech',
    google: 'Google Cloud',
    elevenlabs: 'ElevenLabs',
};
const label = (id) => LABELS[id] || id || 'unknown';
const isDevice = (id) => !id || id === 'builtin' || id === 'browser';

// What each error that ends a listening run means, in plain words. Anything not listed
// is shown as the service said it.
function errorMeaning(kind) {
    const k = String(kind || '');
    if (k === 'not-allowed' || k === 'service-not-allowed') return 'the microphone was refused (permission)';
    if (k === 'no-key' || /key is set/.test(k)) return 'no key was set for the service';
    if (k === 'connect-failed') return 'the service could not be reached';
    if (k === 'network') return 'no internet connection (the device’s listening needs one)';
    if (k === 'audio-capture') return 'no microphone was found';
    if (/^closed \(code/.test(k)) return `the service closed the connection, ${k}`;
    if (/^microphone failed|could not be opened/.test(k)) return k;
    return k;
}
// Normal for the device's own recognizer, not errors at all.
const HARMLESS = new Set(['no-speech', 'aborted']);

const countsText = (obj, mean = (k) => k) => Object.entries(obj || {})
    .map(([k, n]) => `${mean(k)} (${n} time${n === 1 ? '' : 's'})`).join('; ');

function clock(ts) {
    try { return new Date(ts).toTimeString().slice(0, 5); } catch { return '?'; }
}

export function diagnoseListening({ chosen, test, recognition, permission, stt = {}, mic = {} } = {}) {
    const steps = [];
    const add = (name, status, says) => steps.push({ name, status, says });
    const inUse = stt.backend || 'browser';
    const paidChosen = !isDevice(chosen);
    const paidInUse = !isDevice(inUse);

    // 1. What was chosen, and what is actually listening.
    if (paidChosen && !paidInUse) {
        const why = test && test.result === 'no key'
            ? `because no ${label(chosen)} key is set`
            : 'and the app did not record why';
        add('Which service is listening', 'PROBLEM',
            `FELL BACK: ${label(chosen)} was chosen, but ${label('browser')} is in use, ${why}.`);
    } else if (paidChosen && inUse !== chosen) {
        add('Which service is listening', 'PROBLEM',
            `${label(chosen)} was chosen, but ${label(inUse)} is in use.`);
    } else if (!paidChosen && paidInUse) {
        add('Which service is listening', 'PROBLEM',
            `The setting says ${label('builtin')}, but ${label(inUse)} is in use.`);
    } else {
        const name = label(inUse);
        add('Which service is listening', 'OK', `${name.charAt(0).toUpperCase()}${name.slice(1)}, as chosen.`);
    }

    // 2. Whether the chosen paid service answers right now.
    if (paidChosen) {
        if (!test) add(`${label(chosen)} answers a test now`, 'NOT KNOWN', 'The test did not run.');
        else if (test.result === 'ok') add(`${label(chosen)} answers a test now`, 'OK', test.message);
        else if (test.result === 'no key') add(`${label(chosen)} answers a test now`, 'PROBLEM', test.message);
        else add(`${label(chosen)} answers a test now`, 'PROBLEM', test.message || 'It did not answer.');
    }

    // 3. When the device's own listening is in use: is there one, and does it work here?
    if (!paidInUse) {
        const r = recognition || {};
        if (r.apiPresent === false) {
            add("This device's own listening is available", 'PROBLEM',
                'This browser has no listening of its own, so nothing can hear the other person without a paid service.');
        } else if (r.usable === false) {
            add("This device's own listening is available", 'PROBLEM',
                `It exists but is known not to deliver words here${r.reason ? ` (${r.reason})` : ''}. A paid service is needed on this setup.`);
        } else if (r.heardHere) {
            add("This device's own listening is available", 'OK',
                `Present, and it has heard words in this setup on this device (first on ${r.heardHere}), so the app no longer warns about it.`);
        } else if (r.apiPresent) {
            add("This device's own listening is available", 'OK', 'Present, and expected to work here.');
        } else {
            add("This device's own listening is available", 'NOT KNOWN', 'The app could not tell.');
        }
    }

    // 4. Microphone permission.
    if (permission === 'granted') add('Microphone permission', 'OK', 'Allowed.');
    else if (permission === 'denied') add('Microphone permission', 'PROBLEM',
        'The browser has been told NOT to let Conversant use the microphone. It has to be allowed in the browser’s or device’s settings.');
    else if (permission === 'prompt') add('Microphone permission', 'NOT KNOWN',
        'Not decided yet: the device asks the first time Listen is turned on.');
    else add('Microphone permission', 'NOT KNOWN', 'The browser would not say.');

    // 5. Was Listen ever turned on in this session?
    const since = `since the app was opened at ${clock(stt.sessionStartedAt)}`;
    if (!stt.listenRequests) {
        add('Listen was turned on', 'NOT KNOWN',
            `Not ${since}, so the steps below have nothing to show. If the problem happened before that, `
            + 'ask the tester to turn Listen on, let the other person speak, and send another report without closing the app.');
        return finish(steps, stt, since, true);
    }
    if (stt.noSource) {
        add('Listen was turned on', 'PROBLEM',
            `Listen was turned on ${stt.listenRequests} time(s), but nothing was set up to listen ${stt.noSource} of those times.`);
    } else {
        add('Listen was turned on', 'OK', `${stt.listenRequests} time(s) ${since}.`);
    }

    // 6. Errors that ended a listening run.
    const recErr = Object.fromEntries(Object.entries(stt.recognizerErrors || {}).filter(([k]) => !HARMLESS.has(k)));
    const errs = { ...recErr, ...(stt.sourceErrors || {}) };
    if (Object.keys(errs).length) {
        add('Listening ran without errors', 'PROBLEM', `Listening stopped because ${countsText(errs, errorMeaning)}.`);
    } else {
        add('Listening ran without errors', 'OK', 'No listening run ended in an error.');
    }

    // 7-10. The microphone and the sound. Only a paid service hands the app the sound;
    // the device's own listening keeps it to itself.
    if (paidInUse) {
        const stuck = countsText(mic.stuck);
        if (!mic.starts) {
            add('The microphone opened', 'PROBLEM',
                `Listen was turned on but the microphone never opened${stuck ? `: ${stuck}` : ''}.`);
        } else if (stuck) {
            add('The microphone opened', 'PROBLEM', `It opened ${mic.starts} time(s), but did not start: ${stuck}.`);
        } else {
            add('The microphone opened', 'OK', `${mic.starts} time(s).`);
        }
        if (mic.starts) {
            if (!mic.frames) {
                add('Sound arrived from the microphone', 'PROBLEM',
                    'No sound at all reached the app. The microphone may be muted, blocked by a case, or taken by another app.');
            } else if (mic.startsWithNoSound) {
                add('Sound arrived from the microphone', 'PROBLEM',
                    `No sound arrived ${mic.startsWithNoSound} of the ${mic.starts} times it opened.`);
            } else {
                add('Sound arrived from the microphone', 'OK',
                    `Every time${mic.mutedAtStart ? ` (though the device reported the microphone muted ${mic.mutedAtStart} time(s))` : ''}.`);
            }
            const quick = startedQuickly(mic.startTimes);
            if (quick) add('The microphone started quickly', quick.status, quick.says);
            const loud = Number(mic.loudest || 0).toFixed(3);
            const bar = Number(mic.speechStartsAt || 0).toFixed(3);
            if (mic.frames && !mic.speechSpans) {
                add('Sound was loud enough to count as speech', 'PROBLEM',
                    `The loudest sound was ${loud}; speech starts counting at ${bar}. Nothing loud enough arrived, so nothing was sent to be turned into words. The microphone is too quiet, or the other person too far away.`);
            } else if (mic.speechSpans) {
                add('Sound was loud enough to count as speech', 'OK',
                    `${mic.speechSpans} stretch(es) of speech (loudest ${loud}, speech starts at ${bar}).`);
            }
            if (chosen === 'deepgram' || inUse === 'deepgram') {
                if (!mic.connected) add('The service connected', 'PROBLEM', 'Deepgram never accepted the connection.');
                else add('The service connected', 'OK', `${mic.connected} time(s).`);
            }
        }
    } else {
        add('The microphone and the sound', 'NOT MEASURED',
            "This device's own listening does not let the app see the sound, so these steps cannot be checked.");
        if (!stt.sessions) {
            add('Listening started', 'PROBLEM', 'Listen was turned on, but the device’s listening never started.');
        }
    }

    return finish(steps, stt, since, false);
}

/*
 * HOW SOON SOUND ARRIVED AFTER LISTENING WAS ASKED FOR (Ken's iPad report, November 23
 * 2026: "Listening has a several second delay which misses the beginning of the
 * statement of the communication partner"). Nothing said before sound arrives can be
 * kept, so this time is exactly how much of the other person's opening words is at risk.
 *
 * The bars are a judgment, not a measured standard: in conversation the next speaker
 * usually starts within about half a second of the last one stopping, so the other
 * person is often already talking when listening restarts after the app has spoken. A
 * typical start of a second or more, or any start of two seconds or more, loses words
 * in ordinary use. Each start's own times are in the report's "starts" lines.
 */
const SLOW_TYPICAL_MS = 1000;
const SLOW_ANY_MS = 2000;

function startedQuickly(startTimes) {
    const timed = (startTimes || []).filter((s) => s && !s.already && typeof s.sound === 'number');
    if (!timed.length) return null;
    const ms = timed.map((s) => s.sound).sort((a, b) => a - b);
    const typical = ms[Math.floor(ms.length / 2)];
    const slowest = ms[ms.length - 1];
    const sec = (n) => `${(n / 1000).toFixed(1)} s`;
    const toned = timed.filter((s) => s.tone > 0);
    const slow = typical >= SLOW_TYPICAL_MS || slowest >= SLOW_ANY_MS;
    let says = `Sound began arriving ${sec(typical)} after listening was asked for, typically `
        + `(slowest ${sec(slowest)}, over ${timed.length} start${timed.length === 1 ? '' : 's'}).`;
    if (toned.length) {
        says += ` ${toned.length === timed.length ? 'Each' : `${toned.length} of them`} included `
            + `a ${(toned[0].tone / 1000).toFixed(2)} s wait for the listening tone.`;
    }
    if (slow) says += ' Whatever the other person said in that time was not heard.';
    return { status: slow ? 'PROBLEM' : 'OK', says };
}

// 11-12. Words coming back, and whether they were kept. Then the verdict.
function finish(steps, stt, since, nothingToShow) {
    const add = (name, status, says) => steps.push({ name, status, says });
    if (!nothingToShow) {
        if (!stt.deliveries) {
            add('Words came back', 'PROBLEM', 'No words came back at all.');
        } else if (!stt.partnerHeard) {
            add('Words came back', 'PROBLEM',
                `${stt.deliveries} piece(s) of text came back, and every one was taken to be the app's own voice and dropped.`);
        } else {
            add('Words came back', 'OK',
                `${stt.partnerHeard} piece(s) of the other person's speech reached the app`
                + (stt.echoDropped ? ` (${stt.echoDropped} more were taken to be the app's own voice).` : '.'));
        }
    }
    const problems = steps.filter((s) => s.status === 'PROBLEM');
    let verdict;
    // Words reaching the app means hearing did work at least some of the time, so a
    // problem above (a fall-back, a refused test) is a warning rather than the break.
    if (problems.length && stt.partnerHeard) {
        verdict = `HEARING WORKED, BUT: ${problems[0].name} - ${problems[0].says}`;
    } else if (problems.length) verdict = `WHERE IT BREAKS: ${problems[0].name} - ${problems[0].says}`;
    else if (nothingToShow) verdict = `NOT ENOUGH TO GO ON: Listen has not been turned on ${since}.`;
    else verdict = 'Hearing worked in this session.';
    return { verdict, steps, problems: problems.length };
}

export function formatDiagnosis(d) {
    if (!d) return '(not available)';
    const lines = [`  ${d.verdict}`, ''];
    d.steps.forEach((s, i) => {
        lines.push(`  ${String(i + 1).padStart(2)}. ${s.name}: ${s.status}`);
        lines.push(`      ${s.says}`);
    });
    return lines.join('\n');
}
