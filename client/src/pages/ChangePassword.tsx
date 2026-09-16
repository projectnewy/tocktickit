import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { changePassword as changePasswordApi } from "../api/auth.js";
import { ApiError } from "../api/client.js";
import { Alert } from "../components/ui/Alert.js";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

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
          <div className="mb-3">
            <label htmlFor="current-password" className="form-label fw-semibold">
              Current Password <span className="text-danger">*</span>
            </label>
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
          </div>

          <div className="mb-1">
            <label htmlFor="new-password" className="form-label fw-semibold">
              New Password <span className="text-danger">*</span>
            </label>
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
          </div>
          <p className="tk-help mb-3">8–72 characters.</p>

          <div className="mb-4">
            <label htmlFor="confirm-password" className="form-label fw-semibold">
              Confirm New Password <span className="text-danger">*</span>
            </label>
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
          </div>

          <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
            {submitting ? "Saving…" : "Save New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
