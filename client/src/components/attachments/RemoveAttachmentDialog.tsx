import { useState } from "react";
import { ConfirmDialog } from "../ui/ConfirmDialog.js";
import { REMOVAL_REASONS } from "../../config.js";

interface RemoveAttachmentDialogProps {
  filename: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  submitting?: boolean;
}

export function RemoveAttachmentDialog({ filename, onCancel, onConfirm, submitting }: RemoveAttachmentDialogProps) {
  const [preset, setPreset] = useState<string>(REMOVAL_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");

  const isOther = preset === "Other";
  const reason = (isOther ? otherReason : preset).trim();
  const canConfirm = reason.length > 0 && reason.length <= 200;

  return (
    <ConfirmDialog
      title={`Remove ${filename}?`}
      onCancel={onCancel}
      onConfirm={() => onConfirm(reason)}
      confirmLabel={submitting ? "Removing…" : "Remove"}
      confirmDisabled={!canConfirm || submitting}
    >
      <label htmlFor="removal-reason" className="form-label fw-semibold">
        Reason for removal <span className="text-danger">*</span>
      </label>
      <select
        id="removal-reason"
        className="form-select mb-2"
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
        disabled={submitting}
      >
        {REMOVAL_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {isOther && (
        <textarea
          className="form-control"
          placeholder="Describe the reason (max 200 characters)"
          value={otherReason}
          maxLength={200}
          disabled={submitting}
          onChange={(e) => setOtherReason(e.target.value)}
          aria-label="Other reason"
        />
      )}
    </ConfirmDialog>
  );
}
