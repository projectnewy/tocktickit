import { useNavigate } from "react-router-dom";
import type { StaffTicketSummary } from "../../api/staff.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { PriorityBadge } from "../ui/PriorityBadge.js";

// Mobile-only (<992px) representation of the queue — StaffTicketTable is the
// desktop table.
export function StaffTicketCardList({ tickets }: { tickets: StaffTicketSummary[] }) {
  const navigate = useNavigate();

  return (
    <div className="d-lg-none d-flex flex-column gap-2">
      {tickets.map((t) => (
        <div
          key={t.id}
          className="tk-surface p-3"
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/staff/tickets/${t.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(`/staff/tickets/${t.id}`);
          }}
        >
          <div className="d-flex justify-content-between align-items-start mb-1">
            <span className="fw-semibold">{t.ticketNumber}</span>
            <StatusBadge status={t.status} />
          </div>
          <p className="mb-1">{t.summary}</p>
          <p className="text-secondary small mb-2">
            {t.requester.fullName} · {t.category.name}
          </p>
          <div className="d-flex justify-content-between align-items-center">
            <span className="text-secondary small">{t.owner ? t.owner.fullName : "Unassigned"}</span>
            {t.itPriority ? <PriorityBadge priority={t.itPriority} /> : <span className="text-secondary small">No IT Priority</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
