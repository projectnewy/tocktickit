import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { roleLabel } from "../../config/labels.js";

export function UserBadge() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="d-flex align-items-center gap-2 text-white">
      <span>
        Signed in as {user.fullName}{" "}
        <span className="badge text-bg-light text-dark">{roleLabel(user.role)}</span>
      </span>
      <button type="button" className="btn btn-sm btn-outline-light" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
