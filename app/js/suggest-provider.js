/*
 * THE SUGGESTION SEAM — where "ask for suggestions" stops and "talk to a service"
 * begins (Ken, September 30 2026).
 *
 * WHY THE CUT IS HERE AND NOT ONE LAYER LOWER, because that is the whole decision
 * and a later pass will be tempted to move it. The obvious tidy-up is to collect the
 * seven duplicated HTTP calls into one "send a request" helper. That makes a second
 * CLOUD vendor easy and makes a model running on the device no easier at all, because
 * such a model has no address, no key, no headers and no response body. So the cut is
 * at a level that never mentions the web: hand over a prompt, get back text and a
 * count of what it cost. A vendor satisfies that with a request. A model running on
 * the machine satisfies it without a network at all, and nothing above this line has
 * to learn the difference.
 *
 * Ken's stated destination is a suggestion engine that runs on the device, free and
 * open source. That is not buildable today — measured, for speech, in September 2026:
 * both tablets ran out of memory, and the one that finished took 64 seconds a
 * sentence. It is buildable on a laptop sooner. Drawing the line here costs nothing
 * now and is the difference between a day's work and a rewrite when it arrives.
 *
 * WHAT A PROVIDER IS:
 *
 *   {
 *     id, label,
 *     model,                                  // what to show on the About screen
 *     complete({ system, messages, maxTokens }) -> { text, usage },
 *     validateKeyFormat(key) -> { ok, reason },   // optional, no network
 *     testKey(key) -> { ok, reason, status },     // optional, one live call
 *     needsKey,                               // false for anything on-device
 *   }
 *
 * `system` is an ORDERED array of { text, cache }. The array rather than one string
 * is load-bearing: it is how a provider is told which part of the prompt is stable
 * enough to cache, without the caller knowing whether this provider caches at all.
 * A provider with no caching joins the parts and ignores the flag.
 *
 * `usage` is { input, output, cacheWrite, cacheRead }, in tokens, with zeros where a
 * provider has no such idea. Kept as four separate numbers rather than a total
 * because they bill at different rates and collapsing them under-reports the bill —
 * see the note on trackUsage in llm.js.
 *
 * ADDING A PROVIDER is a file and one register() call. It is deliberately NOT a data
 * entry the way a speech service is: the speech catalog works because those services
 * are all one shape, and the two live LLM request shapes plus an on-device engine are
 * three shapes, not one. A family of look-alike services would share one adapter file
 * between them, exactly as the REST speech services share theirs.
 */

const providers = new Map();
let activeId = null;

/** Register a provider. The first one registered becomes the active one. */
export function register(provider) {
    if (!provider || !provider.id) throw new Error('a provider needs an id');
    if (typeof provider.complete !== 'function') throw new Error(`provider ${provider.id} has no complete()`);
    providers.set(provider.id, provider);
    if (activeId === null) activeId = provider.id;
}

export function listProviders() {
    return [...providers.values()].map((p) => ({ id: p.id, label: p.label, needsKey: p.needsKey !== false }));
}

/**
 * Choose the provider. Unknown ids are IGNORED rather than thrown, and this is
 * deliberate: the id arrives from saved settings, so a profile written by a later
 * build naming a provider this one does not have would otherwise stop the app from
 * starting. Falling back to the one already active degrades to "the suggestions come
 * from somewhere else than you picked", which is visible and recoverable.
 */
export function setProvider(id) {
    if (providers.has(id)) activeId = id;
    return activeId;
}

export function getProviderId() {
    return activeId;
}

/** The active provider object. Throws only when nothing has been registered at all. */
export function active() {
    const p = providers.get(activeId);
    if (!p) throw new Error('no suggestion provider registered');
    return p;
}

/**
 * Ask the active provider to complete a prompt.
 *
 * This is the ONLY function in the app that turns a prompt into words, and keeping it
 * that way is what the seam buys. If a future call site reaches past it to make its
 * own request, the on-device path silently stops covering that feature.
 */
export function complete(request) {
    return active().complete(request);
}

/** Flatten the system blocks for a provider that has no notion of a cached prefix. */
export function joinSystem(system) {
    if (typeof system === 'string') return system;
    return (system || []).map((b) => b.text).join('\n\n');
}
