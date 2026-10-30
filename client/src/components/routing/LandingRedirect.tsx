import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { landingPath } from "../../config/landing.js";
import { Spinner } from "../ui/Spinner.js";

// The root path: waits for the session check, then sends each role to its own Dashboard (BR-30).
export function LandingRedirect() {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Navigate to={landingPath(user.role)} replace />;
}
