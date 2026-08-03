/*
 * Diagnostic trace (Ken, August 3 2026).
 *
 * WHY THIS EXISTS. Chasing the Listen-button bug cost several round trips because the
 * only record of what happened was Ken's recollection, in prose, after the fact —
 * "flashes red" and "clears the transcript" each turned out to mean two different
 * things, and one of them was corrected two messages later. Ken's proposal: have the
 * app write down what it did, and hand the file over. This is that file.
 *
 * IT RECORDS DECISIONS AND STATE TRANSITIONS, NOT CALLS. "Echo every call" taken
 * literally is unusable: the audio frame handler runs about twelve times a second and
 * interim speech results arrive continuously, so a faithful call log would be
 * megabytes of noise with the four interesting lines buried in it. What is worth
 * having is every point where the app CHOSE something — which branch a tap took, what
 * a status event did to the listening state, when a turn was written or discarded.
 * High-frequency events are COUNTED instead (see `bump`), so their volume is visible
 * without their bulk.
 *
 * IT RECORDS WHAT WAS SAID, verbatim, because that is most of what makes it useful for
 * transcript bugs. Fine while the partner is Ken testing his own device; it is a
 * developer tool, off by default, and is not something to leave running for a real
 * user. Nothing is uploaded — the file is written to the user's own data folder,
 * exactly like errors.log.
 *
 * SAFETY. Tracing must never be able to break the thing it is observing: every entry
 * point returns immediately when disabled, and the whole body is wrapped so a fault in
 * the tracer cannot propagate into the app.
 */

const MAX_ENTRIES = 4000;   // a long conversation, bounded; oldest dropped first

let enabled = false;
let entries = [];
let dropped = 0;
let t0 = 0;
let counters = new Map();
let header = '';

// Typographic punctuation to ASCII, so the file survives being opened in a plain
// editor, pasted into a message and mailed around — the standing log rule.
const ASCII = new Map(Object.entries({
    '—': '-', '–': '-', '‘': "'", '’': "'",
    '“': '"', '”': '"', '…': '...', ' ': ' ',
    '•': '*', '→': '->', '×': 'x', '✓': 'ok',
}));

function ascii(text) {
    let out = '';
    for (const ch of String(text ?? '')) out += ASCII.get(ch) ?? ch;
    return out;
}

function stamp() {
    const ms = Date.now() - t0;
    const s = Math.floor(ms / 1000);
    return `+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.`
        + String(ms % 1000).padStart(3, '0');
}

export function isEnabled() { return enabled; }

/*
 * Begin a trace. `info` is the one-off context a reader needs before the first line:
 * app version, build, platform, and which speech backends are in use. Called at the
 * start of each conversation so the file covers exactly one conversation.
 */
export function start(info = {}) {
    if (!enabled) return;
    t0 = Date.now();
    entries = [];
    counters = new Map();
    dropped = 0;
    const lines = ['Conversant AAC diagnostic trace', `started: ${new Date().toISOString()}`];
    for (const [k, v] of Object.entries(info)) lines.push(`${k}: ${ascii(v)}`);
    lines.push('', 'elapsed      event                  detail');
    header = lines.join('\n');
}

/*
 * Record one decision or state transition. `detail` is a small object; its values are
 * rendered compactly, so keep them scalar.
 */
export function trace(event, detail = null) {
    if (!enabled) return;
    try {
        if (entries.length >= MAX_ENTRIES) { entries.shift(); dropped++; }
        let d = '';
        if (detail && typeof detail === 'object') {
            d = Object.entries(detail)
                .map(([k, v]) => `${k}=${typeof v === 'string' ? JSON.stringify(ascii(v)) : v}`)
                .join(' ');
        } else if (detail != null) {
            d = ascii(detail);
        }
        entries.push(`${stamp()}  ${String(event).padEnd(22)} ${d}`);
    } catch { /* a tracer must never break the app it is watching */ }
}

/*
 * Count a high-frequency event rather than recording each one. Audio frames and
 * interim speech results belong here: the COUNT is diagnostic (did audio flow at all?
 * how many interims before the checkpoint?), the individual events are not.
 */
export function bump(name) {
    if (!enabled) return;
    try { counters.set(name, (counters.get(name) || 0) + 1); } catch { /* never throw */ }
}

// The finished file. Counters are summarised at the foot so their volume is visible
// without their bulk.
export function render() {
    const out = [header, ...entries];
    if (dropped) out.push(`... ${dropped} earlier entries dropped (cap ${MAX_ENTRIES})`);
    if (counters.size) {
        out.push('', 'counted (high-frequency, not listed individually):');
        for (const [k, v] of counters) out.push(`  ${k}: ${v}`);
    }
    return out.join('\n') + '\n';
}

export function setEnabled(on) {
    enabled = !!on;
    if (!enabled) { entries = []; counters = new Map(); dropped = 0; }
}
