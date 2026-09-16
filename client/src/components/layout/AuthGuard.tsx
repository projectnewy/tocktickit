import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { Spinner } from "../ui/Spinner.js";

// Base check: must be logged in. Deliberately does NOT redirect on
// mustChangePassword — /change-password itself uses this alone, since
// wrapping it in the full AuthGuard below would redirect it to itself.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    // Not a redirect: a hard refresh on /tickets/5 should wait for the
    // /auth/me bootstrap check, not bounce straight to the login screen.
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

// Full gate for every normal app screen: logged in AND no password change
// owed (BR-02/AC-02).
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isBootstrapping } = useAuth();

  return (
    <RequireAuth>
      {!isBootstrapping && user?.mustChangePassword ? <Navigate to="/change-password" replace /> : children}
    </RequireAuth>
  );
}
