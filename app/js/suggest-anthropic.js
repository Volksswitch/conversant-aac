/*
 * The Anthropic adapter — the first and, for now, only suggestion provider.
 *
 * Everything Anthropic-specific lives here and nowhere else: the address, the
 * headers, the request shape, where the answer sits in the reply, what the usage
 * fields are called, what a key looks like, and how a prefix is marked as cacheable.
 * llm.js above it builds prompts and reads answers and knows none of it.
 *
 * ⚠ THE MODEL CARRIES ITS OWN THINKING SETTING, AND A BARE MODEL-STRING SWAP IS A
 * TRAP — measured against the live API on September 30 2026, with a control.
 *
 * On Sonnet 4.6, leaving the `thinking` field out means the model does not think.
 * On Sonnet 5.5 the same omission means it thinks by DEFAULT: the reply comes back
 * with thinking blocks and three to four times the output tokens. Output is about
 * seven-eighths of this app's bill and the whole product exists to beat a four-second
 * silence, so the "cheaper, newer" model would have been slower AND more expensive,
 * with nothing anywhere reporting a problem.
 *
 * Worse, the two models disagree about how to say no. Sonnet 5.5 refuses
 * {"type":"disabled"} with a 400 naming the replacement; Sonnet 4.6 does not accept
 * {"type":"between_tools"} at all. So the setting cannot be a constant — it belongs
 * to the model, which is why it sits in the table below rather than in the request.
 *
 * If a future pass changes MODEL, change its row too, and re-measure: the tell is
 * `thinking` appearing in the returned block types, and output tokens jumping for the
 * same prompt.
 */
import { joinSystem } from './suggest-provider.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5-5';

/*
 * Per-model request settings. `thinking` is sent verbatim when present and omitted
 * when null — the two current entries need opposite treatment to reach the same
 * behavior, which is the entire reason this table exists.
 *
 * Any model not listed falls back to sending nothing, which is the safe direction: a
 * wrong thinking field is a 400 and a dead app, while a missing one is at worst
 * slower and costlier and still works.
 */
const MODELS = {
    'claude-sonnet-5-5': { thinking: { type: 'between_tools' } },
    'claude-sonnet-4-6': { thinking: null },
};

const HEADERS = (key) => ({
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    // Anthropic requires this to be named explicitly before it will answer a browser.
    // It is what makes the user's own key workable with no server of ours in the
    // middle, which is the architectural decision the whole project rests on.
    'anthropic-dangerous-direct-browser-access': 'true',
});

let apiKey = null;

export function setKey(key) {
    apiKey = key;
}

/**
 * Cheap format check, no network. Catches the gross paste mistakes — missing prefix,
 * embedded whitespace, obviously truncated — but NOT a key that is subtly wrong,
 * since these keys have no fixed public length. That case needs testKey.
 */
function validateKeyFormat(key) {
    const k = (key || '').trim();
    if (!k) return { ok: false, reason: 'empty' };
    if (/\s/.test(k)) return { ok: false, reason: 'whitespace' };
    if (!k.startsWith('sk-ant-')) return { ok: false, reason: 'prefix' };
    if (k.length < 40) return { ok: false, reason: 'short' };
    return { ok: true };
}

/**
 * Live verification — the only way to catch a subtly wrong key. Asks for a list of
 * models, which authenticates the key and bills nothing, so a Test costs the user
 * nothing.
 *
 * ⚠ IT PROVES THE KEY AND NOTHING ELSE. A list request is not a generation request,
 * so it cannot tell whether this account can reach the model the app actually asks
 * for. That gap is exactly what let the OpenAI voice test pass while the voice itself
 * was refused (September 30 2026). It is tolerable here only because there is one
 * model and every account with a key can reach it; if a model picker is ever added,
 * this has to start generating a token rather than listing.
 */
/*
 * ⚠ THE ANSWER TO THIS CALL USED TO BE THROWN AWAY, AND IT IS THE ONLY MECHANICAL
 * SIGNAL THE PROJECT HAS THAT ITS MODEL HAS AGED (Ken, September 30 2026).
 *
 * The app sat on a model for three months that was both a generation behind and half
 * again as expensive, and nobody knew until an unrelated question was asked. Nothing
 * tells us when a vendor ships something better — prices are not published in any form
 * a program can read, and whether a model is BETTER is a judgment no endpoint reports.
 * But what EXISTS is listable, and this request is already being made, so the fact
 * costs nothing beyond reading the reply.
 *
 * It states two facts and draws no conclusion. "Newer" is not "better" — the move to
 * Sonnet 5.5 would have broken the app outright if it had been made mechanically.
 */
function newerModelThan(current, models) {
    const mine = models.find((m) => m.id === current);
    if (!mine) return null;                       // an unlisted model: say nothing
    // Same family, so Sonnet is compared with Sonnet. A different tier is a cost and
    // quality decision, not an upgrade, and this is not the place to propose one.
    const family = current.replace(/^claude-([a-z]+).*/, '$1');
    const newer = models
        .filter((m) => m.id !== current && m.id.startsWith(`claude-${family}-`))
        .filter((m) => (m.created_at || '') > (mine.created_at || ''))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    return newer ? { id: newer.id, released: String(newer.created_at || '').slice(0, 10) } : null;
}

async function testKey(key) {
    const k = (key ?? apiKey ?? '').trim();
    if (!k) return { ok: false, reason: 'empty' };
    try {
        // Enough of the list to see the whole family. Still bills nothing.
        const res = await fetch('https://api.anthropic.com/v1/models?limit=40', {
            method: 'GET',
            headers: HEADERS(k),
        });
        if (res.ok) {
            let newer = null;
            try {
                const data = await res.json();
                newer = newerModelThan(MODEL, (data && data.data) || []);
            } catch { /* the key is what was being tested; this is a bonus */ }
            return { ok: true, status: res.status, model: MODEL, newer };
        }
        if (res.status === 401 || res.status === 403) return { ok: false, reason: 'rejected', status: res.status };
        return { ok: false, reason: 'error', status: res.status };
    } catch (err) {
        return { ok: false, reason: 'network', message: err.message };
    }
}

/**
 * Turn the seam's system blocks into Anthropic's shape, marking the cacheable ones.
 *
 * An empty text block is rejected outright, so blocks with nothing in them are
 * dropped rather than sent. A caller that supplies a plain string gets a single
 * uncached block, which is what every call except the response generator does.
 */
function systemBlocks(system) {
    if (typeof system === 'string') {
        return system.trim() ? [{ type: 'text', text: system }] : [];
    }
    return (system || [])
        .filter((b) => b && typeof b.text === 'string' && b.text.trim())
        .map((b) => (b.cache
            ? { type: 'text', text: b.text, cache_control: { type: 'ephemeral' } }
            : { type: 'text', text: b.text }));
}

/**
 * Normalize the usage fields.
 *
 * ⚠ `input_tokens` IS THE UNCACHED REMAINDER, not the size of the prompt. The prompt
 * is input + cacheWrite + cacheRead and the three bill at different rates, so they
 * stay separate all the way to pricing.json. Reporting only input_tokens once caching
 * is on under-states the bill by roughly the hit rate, which on this app's hot path
 * is about ninety percent.
 */
function usageFrom(data) {
    const u = (data && data.usage) || {};
    return {
        input: u.input_tokens ?? 0,
        output: u.output_tokens ?? 0,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
    };
}

/**
 * Pull the spoken answer out of the reply.
 *
 * ⚠ TAKES THE FIRST TEXT BLOCK RATHER THAN THE FIRST BLOCK. With thinking off there
 * is only one block and the two are the same; with thinking on the first block is the
 * reasoning, and reading blindly would hand the prompt parser a paragraph of thinking
 * instead of the JSON. That costs nothing when thinking is off and is the difference
 * between working and not if a future model turns it on.
 */
function textFrom(data) {
    const blocks = (data && data.content) || [];
    // Prefer a block that says it is text. Fall back to the first block carrying a
    // string that is not reasoning — the service always labels its blocks, so the
    // fallback is for replies that were not built by it, and skipping thinking is the
    // part that has to hold either way.
    const block = blocks.find((b) => b && b.type === 'text')
        || blocks.find((b) => b && b.type !== 'thinking' && typeof b.text === 'string');
    if (!block || typeof block.text !== 'string') throw new Error('no text in the reply');
    return block.text.trim();
}

async function complete({ system, messages, maxTokens, schema }) {
    if (!apiKey) throw new Error('API key not set');

    const blocks = systemBlocks(system);
    const settings = MODELS[MODEL] || {};

    const body = {
        model: MODEL,
        max_tokens: maxTokens,
        // ⚠ A LONE CACHED BLOCK MUST STAY AN ARRAY. Collapsing a single block to a
        // plain string is tidier and would silently drop its cache_control, turning
        // caching off for the one call that has it — a change that looks like nothing
        // and roughly triples the input bill. Only an uncached lone block collapses.
        system: (blocks.length === 1 && !blocks[0].cache_control) ? blocks[0].text : blocks,
        messages,
    };
    // Sent only when the model needs it. See the note at the top of this file.
    if (settings.thinking) body.thinking = settings.thinking;
    // A reply shape the service ENFORCES, so the model cannot answer in plain prose
    // instead. See GENERATION_SCHEMA in llm.js for why this was needed.
    if (schema) body.output_config = { format: { type: 'json_schema', schema } };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: HEADERS(apiKey),
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    // stopReason travels back so a reply that cannot be read can say why the model
    // stopped: cut off at the length limit, declined, or finished normally.
    // Usage and the stop reason are read FIRST, and a reply with no text comes back as
    // empty rather than throwing here (CR-279): thrown, the request was billed but not
    // counted, and the reason (a refusal, say) was lost from the error.
    const usage = usageFrom(data);
    const stopReason = data.stop_reason || null;
    let text = '';
    try { text = textFrom(data); } catch { text = ''; }
    return { text, usage, stopReason };
}

export const anthropic = {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    model: MODEL,
    needsKey: true,
    setKey,
    validateKeyFormat,
    testKey,
    complete,
};

export default anthropic;
