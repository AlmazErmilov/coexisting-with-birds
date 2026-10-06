// Shared keyboard and focus behavior for the map's detail dialogs.
const previousFocus = new WeakMap();
export function openDialog(id) {
    const overlay = document.getElementById(id);
    previousFocus.set(overlay, document.activeElement);
    overlay.classList.add('open');
    overlay.querySelector('button, input, select, a[href]')?.focus();
}
export function closeDialog(overlay) {
    overlay.classList.remove('open');
    const previous = previousFocus.get(overlay);
    if (previous?.isConnected) previous.focus();
}
export function initDialogs() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay || e.target.closest('.modal-close')) closeDialog(overlay);
        });
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                closeDialog(overlay);
            }
            if (e.key !== 'Tab') return;
            const focusable = [...overlay.querySelectorAll('button, input, select, a[href], summary, [tabindex="0"]')]
                .filter(el => !el.disabled && el.getClientRects().length);
            const first = focusable[0], last = focusable.at(-1);
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        });
    });
}
