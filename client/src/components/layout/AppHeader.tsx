import { NavLink } from "react-router-dom";
import { RequesterBadge } from "./RequesterBadge.js";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `tk-nav-link${isActive ? " active" : ""}`;
}

export function AppHeader() {
  return (
    <header className="tk-app-header">
      <div className="container d-flex align-items-center justify-content-between py-2 flex-wrap gap-2">
        <span className="fw-semibold fs-5 text-white">TokTickIT</span>
        <nav className="d-flex gap-3" aria-label="Primary">
          <NavLink to="/tickets" className={navLinkClass} end>
            My Tickets
          </NavLink>
          <NavLink to="/tickets/new" className={navLinkClass}>
            Create Ticket
          </NavLink>
        </nav>
        <RequesterBadge />
      </div>
    </header>
  );
}
