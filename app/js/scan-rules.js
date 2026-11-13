/* SWITCH SCANNING - THE RULES THAT DECIDE THE NEXT STOP.
 *
 * Ken, November 12 2026: "implement the design" (Documents/Conversant AAC Switch Access
 * Design.docx). The behavior is the Switch Access Proposal's and the three prototypes'
 * (prototypes/switch-access*.html); this file is the part of it that does not need a
 * browser, so tests/scan-rules.test.mjs can check every stop.
 *
 * WHAT THIS KNOWS AND WHAT IT DOES NOT. It knows a TREE of stops, rebuilt from the
 * screen each time it is asked (`build`), and a stack of the groups the highlight is
 * inside. It does not know about timers, keys, the DOM or what a button does: the
 * driver (switch-access.js) reads the screen into nodes, calls advance / retreat /
 * choose as switch presses arrive, performs what choose() hands back, and draws.
 *
 * A NODE is { key, kind, label, ... }:
 *   kind 'item'  - a button to press. needsTwo: a second press confirms it.
 *   kind 'group' - a region or row; choosing it enters it. kids() builds what is inside.
 *                  exitByPass: the highlight leaves after a full pass with no press.
 *                  enterDirect: never a stop itself; reaching it goes straight inside
 *                  (the Express Panel, Ken, November 12 2026).
 *                  keepOnLeave: leaving puts the highlight back ON the group rather than
 *                  on the stop after it.
 *   kind 'leave' - the dashed "Leave" outline at the end of a group. Never a button.
 *   scope: ['tab:x', 'sec:y'] - for Settings' one flat cycle, where a chosen tab's
 *          sections take the tab's place and an open section's controls take its
 *          heading's place (Ken, November 10 2026). With leaving by a Leave stop, the
 *          highlight goes round only the innermost scope it is in.
 * Keys must be unique within one level and stable across rebuilds, or a rebuild loses
 * the highlight's place.
 */

export function createScanner({ build, cfg, now = () => Date.now() }) {
    const S = { stack: [], held: null, prevLevel: null, prevIdx: null, lastMove: -1e12 };

    const conf = () => (typeof cfg === 'function' ? cfg() : cfg) || {};
    const top = () => S.stack[S.stack.length - 1];
    const cur = () => { const L = top(); return L ? L.nodes[L.idx] || null : null; };

    function level(buildFn, fromKey, node) {
        const nodes = safe(buildFn);
        return { build: buildFn, nodes, idx: 0, passes: 0, fromKey,
                 exitByPass: node ? node.exitByPass !== false : false,
                 keepOnLeave: !!(node && node.keepOnLeave) };
    }
    function safe(fn) { try { return (fn() || []).filter(Boolean); } catch { return []; } }

    // Reaching a node that is entered directly goes inside at once: forward lands on its
    // first stop, backward on its last.
    function enterDirect(atEnd) {
        for (let guard = 0; guard < 4; guard++) {
            const n = cur();
            if (!n || n.kind !== 'group' || !n.enterDirect) return;
            const L = level(n.kids, n.key, n);
            if (!L.nodes.length) return;
            if (atEnd) L.idx = L.nodes.length - 1;
            S.stack.push(L);
        }
    }

    function reset(opts = {}) {
        S.held = null; S.prevLevel = null; S.prevIdx = null;
        S.stack = [level(build, null, null)];
        if (opts.focusKey) focus(opts.focusKey);
        else enterDirect(false);
    }

    // Put the highlight on a stop by key, searching the root level (and, for a key
    // inside a group, entering that group). Returns false when the key is not there.
    function focus(key, inside) {
        S.stack = [S.stack[0] || level(build, null, null)];
        const R = S.stack[0];
        R.nodes = safe(R.build);
        let i = R.nodes.findIndex((n) => n.key === key);
        if (i >= 0) { R.idx = i; R.passes = 0; if (!inside) enterDirect(false); return true; }
        // One level down: a group that holds the key.
        for (let g = 0; g < R.nodes.length; g++) {
            const n = R.nodes[g];
            if (n.kind !== 'group') continue;
            const kids = safe(n.kids);
            i = kids.findIndex((k) => k.key === key);
            if (i < 0) continue;
            R.idx = g;
            const L = level(n.kids, n.key, n);
            L.idx = Math.max(0, L.nodes.findIndex((k) => k.key === key));
            S.stack.push(L);
            return true;
        }
        return false;
    }

    // Rebuild every level from the screen, keeping the highlight on the same stop. A
    // group that has gone, or emptied, is left.
    function refresh() {
        for (let d = 0; d < S.stack.length; d++) {
            const L = S.stack[d];
            const key = L.nodes[L.idx] && L.nodes[L.idx].key;
            if (d > 0) {
                const P = S.stack[d - 1];
                const parent = P.nodes.find((n) => n.key === L.fromKey);
                if (!parent || parent.kind !== 'group') { S.stack.length = d; break; }
                L.build = parent.kids;
            }
            L.nodes = safe(L.build);
            if (!L.nodes.length && d > 0) { S.stack.length = d; break; }
            const i = L.nodes.findIndex((n) => n.key === key);
            L.idx = i >= 0 ? i : Math.min(L.idx, Math.max(0, L.nodes.length - 1));
        }
        if (S.held && !nodeStillThere(S.held.key)) S.held = null;
        if (S.stack.length === 1) enterDirect(false);
    }
    function nodeStillThere(key) { const L = top(); return !!L && L.nodes.some((n) => n.key === key); }

    const scoped = () => conf().exit === 'leave';
    const inner = (n) => (n && n.scope && n.scope.length ? n.scope[n.scope.length - 1] : null);
    const inScope = (n, sc) => !!n && !!n.scope && n.scope.includes(sc);

    // Forward one stop. Returns what happened, for the driver to note.
    function advance() {
        const L = top();
        if (!L || !L.nodes.length) return { moved: false };
        S.held = null;
        S.prevLevel = L; S.prevIdx = L.idx; S.lastMove = now();
        const sc = scoped() && S.stack.length === 1 ? inner(cur()) : null;
        if (sc) {
            const next = L.idx + 1;
            L.idx = next < L.nodes.length && inScope(L.nodes[next], sc)
                ? next : L.nodes.findIndex((n) => inScope(n, sc));
            return { moved: true };
        }
        L.idx++;
        if (L.idx >= L.nodes.length) {
            L.idx = 0; L.passes++;
            if (S.stack.length > 1 && L.exitByPass) { leave(true); return { moved: true, left: true }; }
        }
        if (S.stack.length === 1) enterDirect(false);
        return { moved: true };
    }

    // Back one stop (the third switch). At a group's first stop it leaves the group and
    // stays on the group (Ken, November 12 2026). A group entered directly is never a
    // stop, so leaving it backward goes to the stop before it.
    function retreat() {
        const L = top();
        if (!L || !L.nodes.length) return { moved: false };
        S.held = null; S.prevLevel = null;
        if (S.stack.length > 1 && L.idx === 0) {
            const G = S.stack.pop();
            const P = top();
            P.nodes = safe(P.build);
            const i = P.nodes.findIndex((n) => n.key === G.fromKey);
            if (i >= 0) P.idx = i;
            const parent = P.nodes[P.idx];
            if (parent && parent.enterDirect) {
                P.idx = (P.idx - 1 + P.nodes.length) % P.nodes.length;
                if (S.stack.length === 1) enterDirect(true);
            }
            return { moved: true, left: true };
        }
        const sc = scoped() && S.stack.length === 1 ? inner(cur()) : null;
        if (sc) {
            const prev = L.idx - 1;
            if (prev >= 0 && inScope(L.nodes[prev], sc)) L.idx = prev;
            else { let k = L.nodes.length - 1; while (k > 0 && !inScope(L.nodes[k], sc)) k--; L.idx = k; }
            return { moved: true };
        }
        L.idx = (L.idx - 1 + L.nodes.length) % L.nodes.length;
        if (S.stack.length === 1) enterDirect(true);
        return { moved: true };
    }

    // Leave the current group: the highlight goes to the stop after it (or back onto it).
    function leave(next = true) {
        if (S.stack.length < 2) return false;
        const G = S.stack.pop();
        const P = top();
        P.nodes = safe(P.build);
        const i = P.nodes.findIndex((n) => n.key === G.fromKey);
        if (i >= 0) P.idx = i;
        if (next && !G.keepOnLeave && P.nodes.length) {
            P.idx = (P.idx + 1) % P.nodes.length;
            if (P.idx === 0) P.passes++;
            if (S.stack.length > 1 && P.idx === 0 && P.exitByPass) return leave(true);
        }
        if (S.stack.length === 1) enterDirect(false);
        return true;
    }

    // A press on the "choose" switch. Returns an effect for the driver:
    //   { type: 'act', node }    press this button (the driver then calls afterAct)
    //   { type: 'hold', node }   waiting for a second press to confirm
    //   { type: 'entered' }      went inside a group
    //   { type: 'left' }         a Leave stop took the highlight out
    //   null                     nothing to do
    function choose() {
        const L = top();
        if (!L) return null;
        // Forgiving a late press: one that arrives just after the highlight moved counts
        // for the stop it has just left (automatic scanning only).
        const c = conf();
        if (c.method === 'auto' && c.forgiveMs > 0 && !S.held && S.prevLevel === L
            && S.prevIdx != null && now() - S.lastMove < c.forgiveMs) {
            L.idx = S.prevIdx;
        }
        S.prevLevel = null;
        if (S.held) {
            const h = S.held; S.held = null;
            return { type: 'act', node: h, confirmed: true };
        }
        const n = cur();
        if (!n) return null;
        if (n.kind === 'leave') {
            if (n.act) return { type: 'act', node: n };
            leave(true);
            return { type: 'left' };
        }
        if (n.kind === 'group') {
            const G = level(n.kids, n.key, n);
            if (!G.nodes.length) return null;
            S.stack.push(G);
            return { type: 'entered', node: n };
        }
        if (n.needsTwo) { S.held = n; return { type: 'hold', node: n }; }
        return { type: 'act', node: n };
    }

    function cancelHold() { S.held = null; }

    // After the driver pressed a button, where the highlight goes:
    //   'region'  - stays in the region (a row is left for its region), first stop
    //   'stay'    - stays exactly where it is, the screen rebuilt around it
    //   'top'     - back to the first stop of the current level
    //   'reset'   - back to the start of the screen
    //   { focusKey } - onto that stop
    function afterAct(how) {
        if (how && typeof how === 'object' && how.focusKey) {
            refresh();
            const L = top();
            const i = L ? L.nodes.findIndex((n) => n.key === how.focusKey) : -1;
            if (i >= 0) { L.idx = i; L.passes = 0; return; }
            if (!focus(how.focusKey)) reset();
            return;
        }
        if (how === 'reset') { reset(); return; }
        if (how === 'stay') { refresh(); if (top()) top().passes = 0; return; }
        if (how === 'top') { refresh(); const L = top(); if (L) { L.idx = 0; L.passes = 0; } return; }
        // 'region' (the default)
        if (S.stack.length > 2) S.stack.length = 2;
        refresh();
        const L = top();
        if (!L || !L.nodes.length) { reset(); return; }
        if (S.stack.length > 1) { L.idx = 0; L.passes = 0; }
        else if (conf().pattern === 'items') reset();
    }

    return {
        reset, refresh, advance, retreat, choose, leave, afterAct, focus, cancelHold,
        current: cur,
        held: () => S.held,
        depth: () => S.stack.length,
        // The groups the highlight is inside, outermost first (for drawing and saying where).
        path: () => S.stack.slice(1).map((L, d) => S.stack[d].nodes[S.stack[d].idx]).filter(Boolean),
        levelKeys: () => S.stack.map((L) => L.nodes.map((n) => n.key)),
        passes: () => (top() ? top().passes : 0),
    };
}
