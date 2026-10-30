import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { ApiError } from "../api/client.js";
import { Alert } from "../components/ui/Alert.js";
import { FormField } from "../components/ui/FormField.js";

interface LocationState {
  from?: { pathname?: string };
  expired?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // ui-spec.md §1/§6: required-field messages appear below each field.
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Password is required.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const user = await login(email, password);
      const from = (location.state as LocationState | null)?.from?.pathname;
      // A fresh login always honors mustChangePassword via AuthGuard on the
      // next render — no special-case redirect needed here.
      navigate(user.mustChangePassword ? "/change-password" : from || "/", { replace: true });
    } catch (err) {
      // BR-06/BR-07: the API already returns one generic message for both
      // bad credentials and inactive accounts — just surface it as-is.
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tk-page d-flex align-items-center justify-content-center py-5">
      <div className="tk-surface p-4" style={{ maxWidth: 400, width: "100%" }}>
        <h1 className="h4 mb-3">TokTickIT</h1>

        {!error && (location.state as LocationState | null)?.expired && (
          <Alert variant="info">Your session has expired. Please sign in again.</Alert>
        )}
        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} noValidate>
          <FormField id="login-email" label="Email" required error={fieldErrors.email}>
            <input
              id="login-email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              disabled={submitting}
            />
          </FormField>

          <FormField id="login-password" label="Password" required error={fieldErrors.password}>
            <input
              id="login-password"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={submitting}
            />
          </FormField>

          <button type="submit" className="btn btn-primary w-100 mt-2" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
