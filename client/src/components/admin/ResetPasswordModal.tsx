import { useState, type FormEvent } from "react";
import type { AdminUser } from "../../api/admin.js";
import { resetPassword } from "../../api/admin.js";
import { ApiError } from "../../api/client.js";
import { Alert } from "../ui/Alert.js";
import { FormField } from "../ui/FormField.js";
import { Modal } from "../ui/Modal.js";

interface ResetPasswordModalProps {
  user: AdminUser;
  onCancel: () => void;
  onDone: (user: AdminUser) => void;
}

// ui-spec.md §5: "a second, smaller confirmation modal" opened from the Edit
// modal's "Set new password" action.
export function ResetPasswordModal({ user, onCancel, onDone }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!newPassword) {
      setFieldError("New password is required.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      setFieldError("Password must be 8–72 characters.");
      return;
    }
    setFieldError("");

    setSubmitting(true);
    try {
      const updated = await resetPassword(user.id, newPassword);
      onDone(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset the password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Set new password for ${user.fullName}`} onClose={onCancel} size="sm" closeDisabled={submitting}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          {error && <Alert variant="error">{error}</Alert>}

          <FormField
            id="reset-new-password"
            label="New Password"
            required
            error={fieldError}
            help="8–72 characters. The user must change it at next login."
          >
            <input
              id="reset-new-password"
              type="password"
              className="form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              maxLength={72}
              autoComplete="new-password"
              disabled={submitting}
            />
          </FormField>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Set Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
