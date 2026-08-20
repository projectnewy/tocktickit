import { useNavigate } from "react-router-dom";
import type { TicketSummary } from "../../api/tickets.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { PriorityBadge } from "../ui/PriorityBadge.js";

// Mobile-only (<992px) representation of the ticket list — a card list
// instead of a horizontally-scrolling table.
export function TicketCardList({ tickets }: { tickets: TicketSummary[] }) {
  const navigate = useNavigate();

  return (
    <div className="d-lg-none d-flex flex-column gap-2">
      {tickets.map((t) => (
        <div
          key={t.id}
          className="tk-surface p-3"
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/tickets/${t.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(`/tickets/${t.id}`);
          }}
        >
          <div className="d-flex justify-content-between align-items-start mb-1">
            <span className="fw-semibold">{t.ticketNumber}</span>
            <StatusBadge status={t.status} />
          </div>
          <p className="mb-2">{t.summary}</p>
          <div className="d-flex justify-content-between align-items-center">
            <span className="text-secondary small">
              {t.category.name} · {new Date(t.ticketDate).toLocaleDateString()}
            </span>
            <PriorityBadge priority={t.requestedPriority} />
          </div>
        </div>
      ))}
    </div>
  );
}
