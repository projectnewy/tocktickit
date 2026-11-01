import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getStaffDashboard, type StaffDashboard as DashboardData, type StaffDashboardTicket } from "../api/dashboard.js";
import { ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import { landingPath } from "../config/landing.js";
import { StatusBadge } from "../components/ui/StatusBadge.js";
import { PriorityBadge } from "../components/ui/PriorityBadge.js";
import { Alert } from "../components/ui/Alert.js";
import { Spinner } from "../components/ui/Spinner.js";

type LoadState = "loading" | "success" | "forbidden" | "error";

function CountCard({ label, count, link }: { label: string; count: number; link: string }) {
  return (
    <section className="tk-surface p-3 h-100 d-flex flex-column" aria-label={label}>
      <h2 className="h6 text-secondary mb-2">{label}</h2>
      <div className="display-5 fw-semibold lh-1 mb-2">{count}</div>
      <Link className="mt-auto fw-semibold" to={link}>
        View<span className="visually-hidden"> {label}</span>
      </Link>
    </section>
  );
}

interface BreakdownRow {
  key: string;
  label: React.ReactNode;
  name: string;
  count: number;
  link: string;
}

// One row per status / priority, zeros included; the whole row is a link to the filtered Ticket Queue.
function Breakdown({ title, rows, total }: { title: string; rows: BreakdownRow[]; total: number }) {
  return (
    <section className="tk-surface p-3 h-100" aria-label={title}>
      <h2 className="h6 text-secondary mb-3">{title}</h2>
      <ul className="list-unstyled mb-0">
        {rows.map((row) => (
          <li key={row.key} className="mb-2">
            <Link to={row.link} className="d-flex align-items-center gap-2 text-decoration-none" aria-label={`${row.name}: ${row.count}`}>
              <span style={{ minWidth: "11rem" }}>{row.label}</span>
              <span className="progress flex-grow-1" aria-hidden="true" style={{ height: "0.6rem" }}>
                <span className="progress-bar" style={{ width: `${total > 0 ? (row.count / total) * 100 : 0}%` }} />
              </span>
              <span className="fw-semibold text-body" style={{ minWidth: "2ch", textAlign: "right" }}>
                {row.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TicketList({ label, items, link, emptyText }: { label: string; items: StaffDashboardTicket[]; link: string; emptyText: string }) {
  return (
    <section className="tk-surface p-3 h-100 d-flex flex-column" aria-label={label}>
      <h2 className="h6 text-secondary mb-2">{label}</h2>
      {items.length === 0 ? (
        <p className="text-secondary mb-2">{emptyText}</p>
      ) : (
        <ul className="list-unstyled mb-2">
          {items.map((t) => (
            <li key={t.id} className="border-bottom py-2">
              <Link to={`/staff/tickets/${t.id}`} className="fw-semibold d-block text-truncate">
                {t.ticketNumber}
                <span className="visually-hidden">: {t.summary}</span>
              </Link>
              <div className="text-truncate small">{t.summary}</div>
              <div className="d-flex flex-wrap align-items-center gap-2 small text-secondary">
                <StatusBadge status={t.status} />
                {t.itPriority && <PriorityBadge priority={t.itPriority} />}
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

// ui-spec.md §3: the IT Staff operational starting point (also used by Administrators, with an account
// summary). Every number is computed by the server; each row and card opens the matching Ticket Queue.
export default function StaffDashboard() {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      setData(await getStaffDashboard());
      setState("success");
    } catch (err) {
      setState(err instanceof ApiError && err.status === 403 ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A Requester who reaches this screen is sent to their own Dashboard (ui-spec.md §1).
  if (state === "forbidden" && user && user.role === "REQUESTER") return <Navigate to={landingPath(user.role)} replace />;

  const activeTotal = data ? data.byStatus.reduce((sum, row) => sum + row.count, 0) : 0;
  const priorityTotal = data ? data.byItPriority.reduce((sum, row) => sum + row.count, 0) : 0;
  const counts = data?.userCounts;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h1 className="h4 mb-0">Dashboard</h1>
          <p className="text-secondary mb-0">Welcome back, {user?.fullName ?? "there"}. Here is what is happening in your queue.</p>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={() => void load()} disabled={state === "loading"}>
          Refresh
        </button>
      </div>

      {state === "loading" && <Spinner label="Loading the dashboard…" />}

      {state === "forbidden" && <Alert variant="error">You do not have access to this dashboard.</Alert>}

      {state === "error" && (
        <Alert variant="error">
          <div>Unable to load the dashboard right now.</div>
          <button type="button" className="btn btn-sm btn-outline-danger mt-2" onClick={() => void load()}>
            Retry
          </button>
        </Alert>
      )}

      {state === "success" && data && (
        <div className="d-flex flex-column gap-3">
          <div className="row g-3">
            <div className={`col-12 col-md-6 ${counts ? "col-xl-4" : ""}`}>
              <CountCard label="Unassigned" count={data.unassigned.count} link={data.unassigned.link} />
            </div>
            <div className={`col-12 col-md-6 ${counts ? "col-xl-4" : ""}`}>
              <CountCard label="Owned by Me" count={data.ownedByMe.count} link={data.ownedByMe.link} />
            </div>
            {counts && (
              <div className="col-12 col-xl-4">
                <section className="tk-surface p-3 h-100 d-flex flex-column" aria-label="Users">
                  <h2 className="h6 text-secondary mb-2">Users</h2>
                  <dl className="row mb-2 small">
                    <dt className="col-8 fw-normal">Active Requesters</dt>
                    <dd className="col-4 mb-0 text-end fw-semibold">{counts.REQUESTER}</dd>
                    <dt className="col-8 fw-normal">Active IT Staff</dt>
                    <dd className="col-4 mb-0 text-end fw-semibold">{counts.IT_STAFF}</dd>
                    <dt className="col-8 fw-normal">Active Administrators</dt>
                    <dd className="col-4 mb-0 text-end fw-semibold">{counts.ADMINISTRATOR}</dd>
                    <dt className="col-8 fw-normal">Inactive accounts</dt>
                    <dd className="col-4 mb-0 text-end fw-semibold">{counts.inactive}</dd>
                  </dl>
                  <Link className="mt-auto fw-semibold" to="/admin/users">
                    View<span className="visually-hidden"> Users</span>
                  </Link>
                </section>
              </div>
            )}
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <Breakdown
                title="By Status"
                total={activeTotal}
                rows={data.byStatus.map((row) => ({
                  key: row.status,
                  name: row.status,
                  label: <StatusBadge status={row.status} />,
                  count: row.count,
                  link: row.link,
                }))}
              />
            </div>
            <div className="col-12 col-lg-6">
              <Breakdown
                title="By IT Priority"
                total={priorityTotal}
                rows={data.byItPriority.map((row) => ({
                  key: row.itPriority,
                  name: row.itPriority,
                  label: <PriorityBadge priority={row.itPriority} />,
                  count: row.count,
                  link: row.link,
                }))}
              />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <TicketList label="Urgent Tickets" items={data.urgentTickets.items} link={data.urgentTickets.link} emptyText="No urgent tickets right now." />
            </div>
            <div className="col-12 col-lg-4">
              <TicketList label="Recently Updated" items={data.recentlyUpdated.items} link={data.recentlyUpdated.link} emptyText="No tickets updated in the last 7 days." />
            </div>
            <div className="col-12 col-lg-4">
              <section className="tk-surface p-3 h-100 d-flex flex-column" aria-label="My Planned Actions">
                <h2 className="h6 text-secondary mb-2">
                  My Planned Actions <span className="badge text-bg-secondary ms-1">{data.myPlannedActions.count}</span>
                </h2>
                {data.myPlannedActions.items.length === 0 ? (
                  <p className="text-secondary mb-0">No planned actions assigned to you.</p>
                ) : (
                  <ul className="list-unstyled mb-0">
                    {data.myPlannedActions.items.map((a) => (
                      <li key={a.id} className="border-bottom py-2">
                        <div className="small text-truncate">{a.description}</div>
                        <Link to={`/staff/tickets/${a.ticketId}`} className="fw-semibold">
                          {a.ticketNumber}
                          <span className="visually-hidden">: {a.description}</span>
                        </Link>
                        <div className="small text-secondary">{new Date(a.actionDateTime).toLocaleString()}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
