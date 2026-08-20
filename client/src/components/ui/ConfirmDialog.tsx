import type { ReactNode } from "react";

interface ConfirmDialogProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  children: ReactNode;
}

// Hand-rolled rather than pulled from react-bootstrap: Bootstrap's JS bundle
// isn't loaded, and react-bootstrap's focus-trap behavior is awkward in
// jsdom. This is fully testable with Testing Library as plain markup.
export function ConfirmDialog({
  title,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  confirmDisabled,
  children,
}: ConfirmDialogProps) {
  return (
    <>
      <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5" id="confirm-dialog-title">
                {title}
              </h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onCancel} />
            </div>
            <div className="modal-body">{children}</div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={confirmDisabled}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
