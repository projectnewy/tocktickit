import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { ApiError } from "../api/client.js";
import { Alert } from "../components/ui/Alert.js";

interface LocationState {
  from?: { pathname?: string };
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      const from = (location.state as LocationState | null)?.from?.pathname;
      // A fresh login always honors mustChangePassword via AuthGuard on the
      // next render — no special-case redirect needed here.
      navigate(user.mustChangePassword ? "/change-password" : from || "/tickets", { replace: true });
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

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="login-email" className="form-label fw-semibold">
              Email <span className="text-danger">*</span>
            </label>
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
          </div>

          <div className="mb-4">
            <label htmlFor="login-password" className="form-label fw-semibold">
              Password <span className="text-danger">*</span>
            </label>
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
          </div>

          <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
