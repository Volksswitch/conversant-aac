/*
 * audio-clock.js - is the app's sound actually running, or only saying it is?
 *
 * WHY IT EXISTS (Ken's iPad, reproduced November 25 2026). The installed app was left
 * open overnight. In the morning Deepgram listening lit the button, the iPad showed its
 * microphone indicator, and not one sample of sound arrived; the listening tone was
 * silent; and the Deepgram voice Test waited 15 seconds and gave up. Every one of those
 * goes through the browser's audio system (an AudioContext), and every one of those
 * contexts said "running". The device's own hearing and voice, which do not use it,
 * worked. A reload fixed it.
 *
 * Best explanation, measured by this module rather than assumed: the context's clock
 * stopped while its state still read "running". A sound scheduled on a stopped clock
 * never starts and never ends, so the voice waits for ever, and the microphone's audio
 * is never processed. A running context's clock (currentTime) advances whether or not
 * anything is playing, so comparing it a fraction of a second apart tells the two
 * apart.
 *
 * Three uses:
 *   1. describe() - one line for the error log and the problem report: each audio
 *      context the app has made, and whether its clock is moving.
 *   2. guardPlayback() - a time limit on one sound from a paid voice. A clock that does
 *      not move rejects at once, so tts.js says the sentence in the device's own voice;
 *      a sound that never reports its end is let go once it should have finished.
 *   3. replaceStopped() - close any context whose clock has stopped. Every owner makes a
 *      new one when it finds its context closed, and the next tap wakes it.
 *
 * Never throws: a diagnostic must not break the sound it is checking.
 */

const owners = new Map();        // name -> () => the owner's current context, or null
const replacedNames = new Set(); // owners whose context has been replaced this session
let replacements = 0;

export const STOPPED_MESSAGE = 'The sound on this device stopped working.';

/** An owner of an AudioContext says how to find it. Registering a name again replaces it. */
export function register(name, getContext) {
    if (typeof getContext === 'function') owners.set(name, getContext);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function currentOf(get) {
    try { return get() || null; } catch { return null; }
}

/*
 * One context's condition: 'running' (clock moving), 'stopped' (says running, clock
 * still), or its own state when not running ('suspended', 'interrupted', 'closed').
 */
export async function check(ctx, ms = 400, wait = sleep) {
    if (!ctx) return 'none';
    let state;
    try { state = ctx.state; } catch { return 'unknown'; }
    if (state !== 'running') return state || 'unknown';
    let t0;
    try { t0 = ctx.currentTime; } catch { return 'unknown'; }
    await wait(ms);
    try {
        if (ctx.state !== 'running') return ctx.state;
        return ctx.currentTime - t0 >= (ms / 1000) * 0.5 ? 'running' : 'stopped';
    } catch { return 'unknown'; }
}

/** One line naming every audio context the app has made and its condition. */
export async function describe({ ms = 400, wait = sleep } = {}) {
    const found = [];
    for (const [name, get] of owners) {
        const ctx = currentOf(get);
        if (ctx) found.push({ name, ctx });
    }
    if (!found.length) return 'no audio made yet';
    const results = await Promise.all(found.map(({ ctx }) => check(ctx, ms, wait)));
    const line = found.map(({ name }, i) => {
        const r = results[i];
        return `${name} ${r === 'stopped' ? 'STOPPED (says running, clock not moving)' : r}`;
    }).join(', ');
    return replacements ? `${line}; replaced this session: ${replacements}` : line;
}

/*
 * Close every context whose clock has stopped. Checked twice, a moment apart, so a
 * context that is only slow to get going after the device wakes is not thrown away.
 * Returns { replaced: [names], again: whether one of them had been replaced before
 * this session - a sign that a new context does not help and only a reload will }.
 */
export async function replaceStopped({ ms = 400, gap = 700, wait = sleep } = {}) {
    const replaced = [];
    let again = false;
    for (const [name, get] of owners) {
        const ctx = currentOf(get);
        if (!ctx) continue;
        if ((await check(ctx, ms, wait)) !== 'stopped') continue;
        await wait(gap);
        if (currentOf(get) !== ctx) continue;            // the owner already replaced it
        if ((await check(ctx, ms, wait)) !== 'stopped') continue;
        retire(ctx);
        if (replacedNames.has(name)) again = true;
        replacedNames.add(name);
        replaced.push(name);
    }
    return { replaced, again };
}

/** Close a context so its owner makes a new one. Counted for the report. */
export function retire(ctx) {
    if (!ctx) return;
    replacements++;
    try {
        const p = ctx.close();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* already closed */ }
}

/*
 * A time limit on one sound (a buffer source, or a run of them) on context `c`, which
 * should be over at context time `endAt`.
 *   - At 0.8 s: if the clock has not moved, the sound cannot be playing: onStopped().
 *   - At the expected end plus 3 s: if the clock passed endAt, the sound played and only
 *     its end report was lost: onOverdue(). Otherwise onStopped().
 * Returns a function that cancels both checks; call it when the sound ends normally.
 */
export function guardPlayback(c, endAt, { onStopped, onOverdue } = {}) {
    let t0 = 0;
    try { t0 = c.currentTime; } catch { /* checked below */ }
    let over = false;
    const fire = (fn) => {
        if (over) return;
        over = true;
        clearTimeout(early);
        clearTimeout(late);
        try { if (fn) fn(); } catch { /* never throws */ }
    };
    const early = setTimeout(() => {
        let now = t0;
        try { now = c.currentTime; } catch { /* treat as not moving */ }
        if (now - t0 < 0.1) fire(onStopped);
    }, 800);
    const lateMs = Math.max(0, (endAt - t0) * 1000) + 3000;
    const late = setTimeout(() => {
        let now = t0;
        try { now = c.currentTime; } catch { /* treat as not moving */ }
        fire(now >= endAt ? onOverdue : onStopped);
    }, lateMs);
    return () => { over = true; clearTimeout(early); clearTimeout(late); };
}

/** For tests only. */
export function _reset() {
    owners.clear();
    replacedNames.clear();
    replacements = 0;
}
