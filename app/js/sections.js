/* Collapsible setting sections (Ken, August 11 2026)
 *
 * Turns any container's .setting-group children into disclosures: the group's heading
 * becomes a tappable summary, everything else moves inside it, and sections nest.
 * Used by the Settings tabs and by the Controls editor, which builds its own sections
 * rather than declaring them in index.html.
 *
 * ⚠ THE HEADING MUST NOT STAY A <label>. A click whose target is a <label> inside a
 * <summary> does NOT toggle the details — that is the spec'd activation behaviour, so
 * forms can live in a summary. Moving a group's own <label> up as the title therefore
 * produced a section that opened from its arrow and its background but NOT from its
 * words. The title is a <span> carrying the label's text, and whatever the label named
 * keeps its accessible name through aria-labelledby.
 *
 * OPEN STATE IS REMEMBERED FOR THE SESSION, keyed by position within a named scope,
 * because a container that rebuilds itself (the Controls editor does, on add / reorder
 * / delete) would otherwise slam every section shut under the user's hands. Position
 * rather than title: two sections on the Buttons & Keyboard tab are both called
 * "Express Panel & keyboard layout", and a title key would tie them together.
 *
 * Every section starts CLOSED (Ken, retracting his earlier "topmost expanded"): a tab
 * opens as a plain list of what is on it, with nothing already claiming the space.
 * A reload is a new session and starts from closed again.
 */

const openSections = new Set();

/**
 * Wrap `container`'s .setting-group descendants, one level at a time.
 *
 * Idempotent BY CONSTRUCTION — a group that already holds a <details> is skipped —
 * rather than by a flag on the container. A flag would be wrong here: the Controls
 * editor wipes its container's innerHTML on a rebuild, and a dataset attribute set on
 * the container itself survives that, so the second render would silently skip
 * wrapping and the tab would come back as a flat list.
 *
 * @param {Element} container  the panel or editor whose groups become sections
 * @param {string}  scope      stable name for the container, for remembering open state
 */
export function makeCollapsible(container, scope) {
    if (container) build(container, scope, { n: 0 });
}

/**
 * ONE SECTION OPEN AT A TIME, PER LEVEL (Ken, August 23 2026).
 *
 * Opening a section closes the others beside it. Two reasons it is right for this app
 * rather than merely tidy: vertical space is the scarce axis, and every extra open
 * section pushes the one you want further down a panel that a user with limited motor
 * control has to scroll; and a tab whose sections are all shut opens as a plain list of
 * what is on it, which is why they start closed in the first place - an accordion keeps
 * that property true after the first tap instead of only before it.
 *
 * What it costs, stated once: you can no longer see two sections at the same time to
 * compare them. In Settings that is rare, and it is what the panel beside the tab is
 * for on the surface where it matters.
 *
 * Only SIBLINGS at the same level close, so opening a sub-section never shuts the
 * parent it lives in.
 */
function closeSiblings(details) {
    // ⚠ SCOPED TO THE WHOLE TAB, NOT TO THE IMMEDIATE CONTAINER. The Express tab builds
    // its sections in two places - the layout and sizing sections are declared in
    // index.html, the three band sections are built at runtime inside #expressEditor -
    // so "siblings" in the DOM sense would have let one section from each container sit
    // open at the same time. What the user sees is one tab, so the rule is about the tab.
    const root = details.closest('.tab-panel') || details.parentElement.parentElement;
    if (!root) return;
    for (const other of root.querySelectorAll('details')) {
        if (other === details || !other.open) continue;
        // Never close a section that CONTAINS the one being opened, or one inside it:
        // opening a sub-section must not shut the parent it lives in.
        if (other.contains(details) || details.contains(other)) continue;
        other.open = false;
    }
}

function build(container, scope, seq) {
    for (const group of container.querySelectorAll(':scope > .setting-group')) {
        const existing = group.querySelector(':scope > details');
        if (existing) {                       // already a section — just recurse into it
            seq.n++;
            build(existing.querySelector(':scope > .sg-body') || existing, scope, seq);
            continue;
        }

        // The heading: a direct-child <label> that is not itself a control's own face
        // (.checkbox-label / .radio-label wrap their input).
        const heading = [...group.children].find(
            (el) => el.tagName === 'LABEL' && !el.classList.contains('checkbox-label')
                && !el.classList.contains('radio-label'));
        if (!heading) continue;

        const key = `${scope}#${seq.n}`;
        const title = document.createElement('span');
        title.className = 'wv-disclosure-title';
        title.id = `sgtitle-${scope}-${seq.n++}`;
        title.textContent = heading.textContent.trim();

        // Whatever the label named keeps its accessible name, since the label goes.
        const control = heading.htmlFor ? document.getElementById(heading.htmlFor) : null;
        if (control && !control.getAttribute('aria-label')) {
            control.setAttribute('aria-labelledby', title.id);
        }
        // A heading may WRAP a live element the app writes to — the error-log count did.
        // Only its text becomes the title, so anything else has to be let out first, or
        // the id it carries is destroyed and whatever updates it fails silently.
        while (heading.firstElementChild) heading.after(heading.firstElementChild);
        heading.remove();

        const details = document.createElement('details');
        const summary = document.createElement('summary');
        const mark = document.createElement('span');
        mark.className = 'wv-disclosure-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = '›';
        summary.append(mark, title);

        const body = document.createElement('div');
        body.className = 'sg-body';
        while (group.firstChild) body.appendChild(group.firstChild);

        details.append(summary, body);
        details.open = openSections.has(key);
        details.addEventListener('toggle', () => {
            if (details.open) openSections.add(key); else openSections.delete(key);
            if (details.open) closeSiblings(details);
        });
        group.appendChild(details);

        build(body, scope, seq);   // sub-sections
    }
}
