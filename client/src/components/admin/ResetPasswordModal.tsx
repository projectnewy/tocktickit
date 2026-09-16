import { useState, type FormEvent } from "react";
import type { AdminUser } from "../../api/admin.js";
import { resetPassword } from "../../api/admin.js";
import { ApiError } from "../../api/client.js";
import { Alert } from "../ui/Alert.js";

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
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
    <>
      <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="reset-password-title" tabIndex={-1}>
        <div className="modal-dialog modal-sm">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5" id="reset-password-title">
                Set new password for {user.fullName}
              </h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onCancel} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <Alert variant="error">{error}</Alert>}

                <label htmlFor="reset-new-password" className="form-label fw-semibold">
                  New Password <span className="text-danger">*</span>
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  disabled={submitting}
                />
                <p className="tk-help mb-0">8–72 characters. The user must change it at next login.</p>
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
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
