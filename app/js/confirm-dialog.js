/* Reusable "danger" confirmation modal.
 *
 * Destructive actions (clearing answers, deleting people, overwriting a saved
 * profile) must NOT use the native window.confirm() — its dialog is visually
 * identical to routine browser/OS prompts (notably the File System Access
 * folder-permission popup), so the user dismisses it on autopilot and a
 * wipe-everything action doesn't read as dangerous (Ken, June 15 2026).
 *
 * This renders a deliberately distinct modal — red danger styling, a warning
 * mark, an explicit consequence line, and a red confirm button — that cannot be
 * mistaken for a permission prompt. Cancel is focused by default, so a stray
 * Enter/Space cancels rather than confirms. Returns Promise<boolean>.
 *
 * Use via: if (!(await confirmDanger({ title, body, confirmLabel }))) return;
 */
import { rescueFrom } from './keyboard.js';

/* `preview` renders the exact text an action is about to send, in a scrollable
 * read-only box between the explanation and the buttons (August 31 2026).
 *
 * It exists for the launch-screen problem report. The standing rule for anything
 * carrying conversation text is that the tester must SEE it and then CONFIRM - the
 * seeing and the confirming are two separate steps and neither is optional. In
 * Settings the seeing is done by a preview box on the panel; the launch screen has no
 * panel, and is reached precisely when Settings cannot be, so without this the report
 * could only be sent blind. */
export function confirmDanger({
    title = 'Are you sure?',
    body = 'This cannot be undone.',
    preview = '',
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    over = null
} = {}) {
    return new Promise((resolve) => {
        const dlg = document.createElement('dialog');
        // `has-preview` widens the card to the Settings content area (see styles.css).
        // Only a card showing a report earns that width; a one-sentence confirmation
        // stretched across the panel puts its buttons far from the question.
        dlg.className = preview ? 'danger-dialog has-preview' : 'danger-dialog';

        const head = document.createElement('div');
        head.className = 'danger-head';
        const mark = document.createElement('span');
        mark.className = 'danger-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = '⚠';
        const h = document.createElement('h2');
        h.className = 'danger-title';
        h.textContent = title;
        head.append(mark, h);

        const p = document.createElement('p');
        p.className = 'danger-body';
        p.textContent = body;
        nameDialog(dlg, h, p);
        dlg.setAttribute('role', 'alertdialog');

        const actions = document.createElement('div');
        actions.className = 'danger-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'danger-cancel';
        cancelBtn.textContent = cancelLabel;
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'danger-confirm';
        confirmBtn.textContent = confirmLabel;
        actions.append(cancelBtn, confirmBtn);

        // Read-only rather than disabled: a disabled control cannot be scrolled, and
        // a preview the tester cannot scroll through is not a preview.
        let pre = null;
        if (preview) {
            pre = document.createElement('textarea');
            pre.className = 'danger-preview';
            pre.readOnly = true;
            pre.rows = 10;
            pre.value = preview;
        }
        dlg.append(head, p, ...(pre ? [pre] : []), actions);

        let unplace = () => {};
        let settled = false;
        const done = (val) => {
            if (settled) return;
            settled = true;
            unplace();
            try { dlg.close(); } catch { /* already closing */ }
            dlg.remove();
            resolve(val);
        };

        cancelBtn.addEventListener('click', () => done(false));
        confirmBtn.addEventListener('click', () => done(true));
        // Escape -> cancel (the safe default).
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
        // Click on the backdrop (outside the card) -> cancel.
        dlg.addEventListener('click', (e) => { if (e.target === dlg) done(false); });

        document.body.append(dlg);
        unplace = placeOver(dlg, over);
        dlg.showModal();   // top layer — sits above the full-screen overlays
        cancelBtn.focus();
    });
}

/* ── Two modals for a long, uninterruptible job (Ken, September 9 2026) ──────
 *
 * FROM THE FIELD, on an Android tablet: *"The Android is very slow. The tab showed
 * 'Importing...' below the Restore selected backup button. It was easy to miss and
 * because the restore takes so long it can look like a hung app which lead me to try
 * other approaches like pressing the restore button instead. This resulted in the data
 * not being imported at all."*
 *
 * ⚠ THE SECOND SENTENCE IS THE BUG AND THE FIRST IS ONLY THE CAUSE. A status line on
 * the panel leaves every control live, so a restore that looks stuck invites a second
 * press — and a second import racing the first, with the first's reload landing in the
 * middle of it, is how a restore ends up writing nothing at all. A modal is not a
 * politer status line here: it is what makes the second press impossible.
 *
 * So `showBusy` has NO buttons, refuses Escape and ignores a backdrop click. It is the
 * one dialog in this app that the user cannot dismiss, which is only defensible because
 * every caller closes it in a `finally`.
 */
// A dialog is announced by its title and its words, not only by the button that has
// focus - otherwise a screen reader said "Cancel, button" and never read the warning
// (CR-110).
let dialogCount = 0;
function nameDialog(dlg, h, p) {
    const n = ++dialogCount;
    h.id = `dlg-title-${n}`;
    p.id = `dlg-body-${n}`;
    dlg.setAttribute('aria-labelledby', h.id);
    dlg.setAttribute('aria-describedby', p.id);
}

function neutralCard(title) {
    const dlg = document.createElement('dialog');
    dlg.className = 'danger-dialog neutral-dialog';
    const head = document.createElement('div');
    head.className = 'danger-head';
    const h = document.createElement('h2');
    h.className = 'danger-title';
    h.textContent = title;
    head.append(h);
    const p = document.createElement('p');
    p.className = 'danger-body';
    nameDialog(dlg, h, p);
    dlg.append(head, p);
    return { dlg, p };
}

/* A plain two-button question for an action that cannot harm anything (CR-303).
 * The red card is kept for destructive actions, so it keeps reading as dangerous.
 * Cancel has focus; Escape and the backdrop cancel. Returns Promise<boolean>. */
export function confirmNeutral({
    title = '',
    body = '',
    confirmLabel = 'OK',
    cancelLabel = 'Cancel'
} = {}) {
    return new Promise((resolve) => {
        const { dlg, p } = neutralCard(title);
        p.textContent = body;
        const actions = document.createElement('div');
        actions.className = 'danger-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'danger-cancel';
        cancelBtn.textContent = cancelLabel;
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'danger-confirm neutral-confirm';
        confirmBtn.textContent = confirmLabel;
        actions.append(cancelBtn, confirmBtn);
        dlg.append(actions);

        let settled = false;
        const done = (val) => {
            if (settled) return;
            settled = true;
            try { dlg.close(); } catch { /* already closing */ }
            dlg.remove();
            resolve(val);
        };
        cancelBtn.addEventListener('click', () => done(false));
        confirmBtn.addEventListener('click', () => done(true));
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
        dlg.addEventListener('click', (e) => { if (e.target === dlg) done(false); });

        document.body.append(dlg);
        dlg.showModal();
        cancelBtn.focus();
    });
}

/* Put a dialog exactly over another element instead of centering it (Ken, October 8
 * 2026). A centered card lands across a keyguard's rails; over a region the keyguard
 * already leaves open - the Conversation Pane, or one response option - it does not.
 * `over` is an element or an element id. Follows the element through a resize; the
 * returned function stops that. With no element on screen the card stays centered.
 * Inline styles, because the dock rules that limit a card outrank a class. */
function placeOver(dlg, over) {
    const target = typeof over === 'string' ? document.getElementById(over) : over;
    if (!target) return () => {};
    const place = () => {
        const r = target.getBoundingClientRect();
        if (!r.width || !r.height) return;
        dlg.classList.add('over-region');
        Object.assign(dlg.style, {
            top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px`,
            right: 'auto', bottom: 'auto', margin: '0', maxWidth: 'none', maxHeight: 'none',
        });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
}

/* A question with a text box (October 8 2026), for the problem report sent from
 * Conversation Review, where the Settings note box is not on screen. Resolves with
 * the text (possibly empty) on confirm, or null on cancel. The box is in the on-screen
 * keyboard's scope (keyboard.js IN_SCOPE), and that keyboard moves into whichever
 * dialog is open, so it types here like anywhere else. */
/* `over`: see placeOver. */
export function askForText({
    title = '',
    body = '',
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    over = null
} = {}) {
    return new Promise((resolve) => {
        const { dlg, p } = neutralCard(title);
        p.textContent = body;
        const box = document.createElement('textarea');
        box.id = 'askTextInput';
        box.className = 'ask-text-input';
        box.rows = 3;
        box.setAttribute('aria-labelledby', p.id);
        const actions = document.createElement('div');
        actions.className = 'danger-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'danger-cancel';
        cancelBtn.textContent = cancelLabel;
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'danger-confirm neutral-confirm';
        confirmBtn.textContent = confirmLabel;
        actions.append(cancelBtn, confirmBtn);
        dlg.append(box, actions);

        let unplace = () => {};
        let settled = false;
        const done = (val) => {
            if (settled) return;
            settled = true;
            unplace();
            rescueFrom(dlg);   // the keyboard moved in here; it must not leave with the box
            try { dlg.close(); } catch { /* already closing */ }
            dlg.remove();
            resolve(val);
        };
        cancelBtn.addEventListener('click', () => done(null));
        confirmBtn.addEventListener('click', () => done(box.value.trim()));
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });

        document.body.append(dlg);
        unplace = placeOver(dlg, over);
        dlg.showModal();
        // Focus the button, not the box: focusing the box would raise the on-screen
        // keyboard before the user has decided to type anything.
        cancelBtn.focus();
    });
}

/* A modal that cannot be dismissed, for work that must not be interrupted.
 * Returns { update(text), close() }. ALWAYS close it in a finally. */
export function showBusy({ title = 'Please wait', body = '' } = {}) {
    const { dlg, p } = neutralCard(title);
    p.textContent = body;

    // The progress line. Kept separate from the body so an update replaces the count
    // and never the explanation of what is happening.
    const prog = document.createElement('p');
    prog.className = 'busy-progress';
    prog.setAttribute('role', 'status');
    prog.setAttribute('aria-live', 'polite');
    dlg.append(prog);

    const block = (e) => e.preventDefault();
    dlg.addEventListener('cancel', block);          // Escape
    dlg.addEventListener('click', block);           // backdrop
    // CR-082. A second Escape or Android Back is not cancelable in current Chromium,
    // so preventDefault alone lets the box go. closedby="none" stops that where it is
    // supported; elsewhere, a box that closes anyway is put straight back.
    let open = true;
    dlg.setAttribute('closedby', 'none');
    dlg.addEventListener('close', () => { if (open) { try { dlg.showModal(); } catch { /* removed */ } } });

    document.body.append(dlg);
    dlg.showModal();

    return {
        update(text) { if (open) prog.textContent = text || ''; },
        close() {
            if (!open) return;
            open = false;
            try { dlg.close(); } catch { /* already closing */ }
            dlg.remove();
        },
    };
}

/* A modal with ONE button and no way past it. Used to tell the user the app is about
 * to restart and make them the one who starts it — the restart used to happen on its
 * own, which on a slow device is indistinguishable from the crash they were already
 * worried about. Resolves when the button is pressed. */
export function showNotice({ title = '', body = '', buttonLabel = 'OK', over = null } = {}) {
    return new Promise((resolve) => {
        const { dlg, p } = neutralCard(title);
        p.textContent = body;

        const actions = document.createElement('div');
        actions.className = 'danger-actions';
        const btn = document.createElement('button');
        btn.className = 'danger-confirm neutral-confirm';
        btn.textContent = buttonLabel;
        actions.append(btn);
        dlg.append(actions);

        let unplace = () => {};
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            unplace();
            try { dlg.close(); } catch { /* already closing */ }
            dlg.remove();
            resolve();
        };
        btn.addEventListener('click', done);
        // Escape and the backdrop do NOT dismiss: there is one way on from here, and
        // it is the button. Anything else leaves the app running on data it has
        // already replaced underneath itself.
        dlg.addEventListener('cancel', (e) => e.preventDefault());
        dlg.addEventListener('click', (e) => { if (e.target === dlg) e.preventDefault(); });
        dlg.setAttribute('closedby', 'none');   // see showBusy (CR-082)
        dlg.addEventListener('close', () => { if (!settled) { try { dlg.showModal(); } catch { /* removed */ } } });

        document.body.append(dlg);
        unplace = placeOver(dlg, over);
        dlg.showModal();
        btn.focus();
    });
}
