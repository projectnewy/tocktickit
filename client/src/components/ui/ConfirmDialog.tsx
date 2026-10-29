import type { ReactNode } from "react";
import { Modal } from "./Modal.js";

interface ConfirmDialogProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  children: ReactNode;
}

// A destructive-style confirmation built on the shared Modal, so it gets the
// same focus handling, Escape-to-close, and ARIA wiring as every other dialog.
export function ConfirmDialog({
  title,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  confirmDisabled,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="modal-body">{children}</div>
      <div className="modal-footer">
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={confirmDisabled}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
