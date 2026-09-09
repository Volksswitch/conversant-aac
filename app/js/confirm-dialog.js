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
    cancelLabel = 'Cancel'
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
        // Escape -> cancel (the safe default).
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
        // Click on the backdrop (outside the card) -> cancel.
        dlg.addEventListener('click', (e) => { if (e.target === dlg) done(false); });

        document.body.append(dlg);
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
    dlg.append(head, p);
    return { dlg, p };
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

    document.body.append(dlg);
    dlg.showModal();

    let open = true;
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
export function showNotice({ title = '', body = '', buttonLabel = 'OK' } = {}) {
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

        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
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

        document.body.append(dlg);
        dlg.showModal();
        btn.focus();
    });
}
