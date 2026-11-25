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

// name -> { get: () => the owner's current context or null, inUse: () => is it busy now }
const owners = new Map();
const replacedNames = new Set(); // owners whose context has been replaced this session
let replacements = 0;
let idlePauses = 0;              // idle clocks that were only paused (the monitor's nudge woke them)

export const STOPPED_MESSAGE = 'The sound on this device stopped working.';

/** An owner of an AudioContext says how to find it, and (optionally) when it is busy.
 *  Registering a name again replaces it. */
export function register(name, getContext, { inUse = null } = {}) {
    if (typeof getContext !== 'function') return;
    const prev = owners.get(name);
    owners.set(name, { get: getContext, inUse: inUse || (prev && prev.inUse) || null });
}

/** Say when a registered owner is busy, from outside it (app.js knows when it is listening). */
export function setInUse(name, inUse) {
    const o = owners.get(name);
    if (o) o.inUse = inUse;
    else owners.set(name, { get: () => null, inUse });
}

function busy(o) {
    try { return !!(o.inUse && o.inUse()); } catch { return true; }   // unsure: leave it alone
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
        if (ctx.currentTime - t0 >= (ms / 1000) * 0.5) return 'running';
        // ⚠ A NEW context says "running" before its clock has started: measured in
        // Chrome, about 0.6-0.8 s of currentTime 0 while the audio device starts. A
        // clock that has never moved is starting, not stopped - and the overnight
        // failure this module exists for was a clock that had run for hours.
        return ctx.currentTime === 0 ? 'not started' : 'stopped';
    } catch { return 'unknown'; }
}

/** One line naming every audio context the app has made and its condition. */
export async function describe({ ms = 400, wait = sleep } = {}) {
    const found = [];
    for (const [name, o] of owners) {
        const ctx = currentOf(o.get);
        if (ctx) found.push({ name, ctx });
    }
    if (!found.length) return 'no audio made yet';
    const results = await Promise.all(found.map(({ ctx }) => check(ctx, ms, wait)));
    const line = found.map(({ name }, i) => {
        const r = results[i];
        return `${name} ${r === 'stopped' ? 'STOPPED (says running, clock not moving)' : r}`;
    }).join(', ');
    const extra = [];
    if (replacements) extra.push(`replaced this session: ${replacements}`);
    if (idlePauses) extra.push(`idle pauses seen (harmless): ${idlePauses}`);
    return extra.length ? `${line}; ${extra.join('; ')}` : line;
}

/*
 * Play half a second of pure silence through a context and see whether its clock moves.
 * Tells a device that only PAUSED an idle connection to save power (a sound wakes it,
 * so this returns true) from one whose audio has really stopped (still false). The
 * silence is all zeros: nothing can be heard.
 */
export async function nudge(ctx, ms = 400, wait = sleep) {
    let src = null;
    try {
        const buffer = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * 0.5)), ctx.sampleRate);
        src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start();
    } catch { /* could not even schedule it: judged below */ }
    const result = await check(ctx, ms, wait);
    try { if (src) src.stop(); } catch { /* already over */ }
    return result === 'running';
}

/*
 * THE MONITOR (Ken, November 25 2026: "Build the monitor"). One pass over every audio
 * connection that is NOT in use: a stopped clock gets the silent nudge; if that wakes
 * it, the device had only paused it (counted for the report, never logged as an error);
 * if not, it is replaced. A connection in use is never touched - closing the listening
 * audio would cut off the microphone mid-conversation - and those have their own checks
 * (no sound while listening, a voice sentence that does not play).
 * Returns { replaced: [names], again } like replaceStopped.
 */
export async function monitorOnce({ ms = 400, wait = sleep } = {}) {
    const replaced = [];
    let again = false;
    for (const [name, o] of owners) {
        const ctx = currentOf(o.get);
        if (!ctx || busy(o)) continue;
        if ((await check(ctx, ms, wait)) !== 'stopped') continue;
        if (busy(o) || currentOf(o.get) !== ctx) continue;   // started being used meanwhile
        if (await nudge(ctx, ms, wait)) { idlePauses++; continue; }
        if (busy(o) || currentOf(o.get) !== ctx) continue;
        retire(ctx);
        if (replacedNames.has(name)) again = true;
        replacedNames.add(name);
        replaced.push(name);
    }
    return { replaced, again };
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
    for (const [name, o] of owners) {
        const get = o.get;
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
    // A clock still at 0 has not started yet (a new context, see check): give it longer.
    const early = setTimeout(() => {
        let now = t0;
        try { now = c.currentTime; } catch { /* treat as not moving */ }
        if (now - t0 < 0.1) fire(onStopped);
    }, t0 > 0 ? 800 : 2500);
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
    idlePauses = 0;
}
