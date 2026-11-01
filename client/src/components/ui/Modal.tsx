import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
];
const FOCUSABLE = FOCUSABLE_SELECTORS.join(", ");
// A comma list needs the scope prefix on every alternative, not just the first.
const FOCUSABLE_IN_BODY = FOCUSABLE_SELECTORS.map((selector) => `.modal-body ${selector}`).join(", ");

interface ModalProps {
  title: string;
  onClose: () => void;
  size?: "sm";
  // True while a request is in flight: Escape and the close button then do
  // nothing, so a save cannot be abandoned half-way by accident.
  closeDisabled?: boolean;
  // Rendered inside .modal-content below the header. Callers supply their
  // own .modal-body/.modal-footer so a <form> can wrap both.
  children: ReactNode;
}

// Hand-rolled (not react-bootstrap) so it stays fully testable in jsdom.
// Shared accessibility behavior for every dialog (ui-spec.md §6): focus moves
// in on open, Escape closes, Tab/Shift+Tab are trapped, and focus returns to
// whatever opened it on close.
export function Modal({ title, onClose, size, closeDisabled, children }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial =
      dialog.querySelector<HTMLElement>(FOCUSABLE_IN_BODY) ??
      dialog.querySelector<HTMLElement>(FOCUSABLE) ??
      dialog;
    initial.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (!dialog) return;
      if (event.key === "Escape") {
        if (!closeDisabledRef.current) {
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== "Tab") return;

      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !dialog.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // The opener can be gone (e.g. a table re-rendered while the dialog was
      // open) — fall back to the page's main region rather than dropping
      // focus onto <body>.
      const target = opener && document.contains(opener) ? opener : document.getElementById("main-content");
      target?.focus();
    };
  }, []);

  return (
    <>
      <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <div className={`modal-dialog${size === "sm" ? " modal-sm" : ""}`}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5" id={titleId}>
                {title}
              </h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={closeDisabled} />
            </div>
            {children}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
