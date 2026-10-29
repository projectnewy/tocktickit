import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { changePassword as changePasswordApi } from "../api/auth.js";
import { ApiError } from "../api/client.js";
import { Alert } from "../components/ui/Alert.js";
import { FormField } from "../components/ui/FormField.js";

type FieldErrors = Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { refresh } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // ui-spec.md §2/§6: every message sits below the field it belongs to.
    const errors: FieldErrors = {};
    if (!currentPassword) errors.currentPassword = "Current password is required.";
    if (!newPassword) errors.newPassword = "New password is required.";
    else if (newPassword.length < 8 || newPassword.length > 72) errors.newPassword = "Password must be 8–72 characters.";
    if (!confirmPassword) errors.confirmPassword = "Please confirm your new password.";
    else if (newPassword !== confirmPassword) errors.confirmPassword = "New password and confirmation do not match.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await changePasswordApi({ currentPassword, newPassword });
      // Pulls the fresh mustChangePassword=false from the server rather than
      // assuming it locally, so AuthGuard's redirect logic stays a single
      // source of truth.
      await refresh();
      navigate("/tickets", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to change password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tk-page d-flex align-items-center justify-content-center py-5">
      <div className="tk-surface p-4" style={{ maxWidth: 420, width: "100%" }}>
        <h1 className="h4 mb-1">TokTickIT</h1>
        <h2 className="h5 mb-3">Change Your Password</h2>
        <p className="text-secondary mb-4">
          Your account uses a temporary initial password. Choose a new password before continuing.
        </p>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} noValidate>
          <FormField id="current-password" label="Current Password" required error={fieldErrors.currentPassword}>
            <input
              id="current-password"
              type="password"
              className="form-control"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={submitting}
            />
          </FormField>

          <FormField id="new-password" label="New Password" required error={fieldErrors.newPassword} help="8–72 characters.">
            <input
              id="new-password"
              type="password"
              className="form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              disabled={submitting}
            />
          </FormField>

          <FormField id="confirm-password" label="Confirm New Password" required error={fieldErrors.confirmPassword}>
            <input
              id="confirm-password"
              type="password"
              className="form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={submitting}
            />
          </FormField>

          <button type="submit" className="btn btn-primary w-100 mt-2" disabled={submitting}>
            {submitting ? "Saving…" : "Save New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
