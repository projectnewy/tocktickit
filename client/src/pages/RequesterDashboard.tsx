import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRequesterDashboard, type DashboardTicket, type RequesterDashboard as DashboardData } from "../api/dashboard.js";
import { ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import { StatusBadge } from "../components/ui/StatusBadge.js";
import { Alert } from "../components/ui/Alert.js";
import { Spinner } from "../components/ui/Spinner.js";

type LoadState = "loading" | "success" | "forbidden" | "error";

interface CountCardProps {
  label: string;
  count: number;
  link: string;
  // Waiting-for-you is highlighted when it needs the Requester: an icon and words, never colour alone.
  attention?: string;
}

function CountCard({ label, count, link, attention }: CountCardProps) {
  const highlighted = Boolean(attention) && count > 0;
  return (
    <section className={`tk-surface p-3 h-100 d-flex flex-column ${highlighted ? "border border-warning border-2" : ""}`} aria-label={label}>
      <h2 className="h6 text-secondary mb-2">{label}</h2>
      <div className="display-5 fw-semibold lh-1 mb-2">{count}</div>
      {highlighted && (
        <p className="small fw-semibold mb-2" style={{ color: "var(--tk-warning)" }}>
          <span aria-hidden="true">⚠ </span>
          {attention}
        </p>
      )}
      <Link className="mt-auto fw-semibold" to={link}>
        View<span className="visually-hidden"> {label}</span>
      </Link>
    </section>
  );
}

interface ListCardProps {
  label: string;
  items: DashboardTicket[];
  link: string;
  emptyText: string;
}

function ListCard({ label, items, link, emptyText }: ListCardProps) {
  return (
    <section className="tk-surface p-3 h-100 d-flex flex-column" aria-label={label}>
      <h2 className="h6 text-secondary mb-2">{label}</h2>
      {items.length === 0 ? (
        <p className="text-secondary mb-2">{emptyText}</p>
      ) : (
        <ul className="list-unstyled mb-2">
          {items.map((t) => (
            <li key={t.id} className="border-bottom py-2">
              <Link to={`/tickets/${t.id}`} className="fw-semibold d-block text-truncate">
                {t.ticketNumber}
                <span className="visually-hidden">: {t.summary}</span>
              </Link>
              <div className="text-truncate small">{t.summary}</div>
              <div className="d-flex align-items-center gap-2 small text-secondary">
                <StatusBadge status={t.status} />
                <span>{new Date(t.updatedAt).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link className="mt-auto fw-semibold" to={link}>
        View all<span className="visually-hidden"> {label}</span>
      </Link>
    </section>
  );
}

// ui-spec.md §2: a concise summary of the signed-in Requester's own Tickets that points into My Tickets and
// Ticket Detail instead of repeating them. Every number comes from the server in one request.
export default function RequesterDashboard() {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      setData(await getRequesterDashboard());
      setState("success");
    } catch (err) {
      setState(err instanceof ApiError && err.status === 403 ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h1 className="h4 mb-0">Dashboard</h1>
          <p className="text-secondary mb-0">Welcome back, {user?.fullName ?? "there"}. Here is where your requests stand.</p>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={() => void load()} disabled={state === "loading"}>
          Refresh
        </button>
      </div>

      {state === "loading" && <Spinner label="Loading your dashboard…" />}

      {state === "forbidden" && <Alert variant="error">This dashboard is only available to Requesters. Use the navigation above to open your own screens.</Alert>}

      {state === "error" && (
        <Alert variant="error">
          <div>Unable to load your dashboard right now.</div>
          <button type="button" className="btn btn-sm btn-outline-danger mt-2" onClick={() => void load()}>
            Retry
          </button>
        </Alert>
      )}

      {state === "success" && data && (
        <div className="row g-3">
          <div className="col-12 col-md-6 col-xl-3">
            <CountCard label="Open Tickets" count={data.openTickets.count} link={data.openTickets.link} />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <CountCard
              label="Waiting for You"
              count={data.waitingForRequester.count}
              link={data.waitingForRequester.link}
              attention="Needs your reply"
            />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <ListCard label="Recently Updated" items={data.recentlyUpdated.items} link={data.recentlyUpdated.link} emptyText="No tickets updated in the last 7 days." />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <ListCard label="Recently Resolved" items={data.recentlyResolved.items} link={data.recentlyResolved.link} emptyText="No tickets resolved in the last 7 days." />
          </div>
        </div>
      )}
    </div>
  );
}
