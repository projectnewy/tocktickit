import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { UserBadge } from "./UserBadge.js";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `tk-nav-link${isActive ? " active" : ""}`;
}

// Nav items are role-filtered here for display, but BR-20/FR-20 requires the
// route guard (RoleGuard) to be the real enforcement — see App.tsx.
export function AppHeader() {
  const { user } = useAuth();
  const isStaff = user?.role === "IT_STAFF" || user?.role === "ADMINISTRATOR";

  return (
    <header className="tk-app-header">
      <div className="container d-flex align-items-center justify-content-between py-2 flex-wrap gap-2">
        <span className="fw-semibold fs-5 text-white">TokTickIT</span>
        <nav className="d-flex gap-3" aria-label="Primary">
          {user?.role === "REQUESTER" && (
            <>
              <NavLink to="/tickets" className={navLinkClass} end>
                My Tickets
              </NavLink>
              <NavLink to="/tickets/new" className={navLinkClass}>
                Create Ticket
              </NavLink>
            </>
          )}
          {isStaff && (
            <NavLink to="/staff/tickets" className={navLinkClass}>
              Ticket Queue
            </NavLink>
          )}
          {user?.role === "ADMINISTRATOR" && (
            <NavLink to="/admin/users" className={navLinkClass}>
              Users
            </NavLink>
          )}
        </nav>
        <UserBadge />
      </div>
    </header>
  );
}
