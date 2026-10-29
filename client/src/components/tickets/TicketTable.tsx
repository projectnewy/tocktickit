import { useNavigate } from "react-router-dom";
import type { TicketSummary } from "../../api/tickets.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { PriorityBadge } from "../ui/PriorityBadge.js";
import { SortableHeader } from "../ui/SortableHeader.js";
import { activatableProps } from "../ui/activatable.js";

interface TicketTableProps {
  tickets: TicketSummary[];
  sort: string;
  onSortChange: (sort: string) => void;
}

// Desktop-only (≥992px) — the mobile representation is TicketCardList.
// Sort field names match api-spec.md's sort allowlist.
export function TicketTable({ tickets, sort, onSortChange }: TicketTableProps) {
  const navigate = useNavigate();

  return (
    <table className="table d-none d-lg-table align-middle">
      <thead>
        <tr>
          <SortableHeader label="Ticket No." field="ticketNumber" sort={sort} onSortChange={onSortChange} />
          <SortableHeader label="Created Date" field="createdAt" sort={sort} onSortChange={onSortChange} />
          <SortableHeader label="Summary" field="summary" sort={sort} onSortChange={onSortChange} />
          <th scope="col">Category</th>
          <th scope="col">Requested Priority</th>
          <th scope="col">Current Status</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((t) => (
          <tr
            key={t.id}
            className="tk-clickable-row"
            aria-label={`Open ${t.ticketNumber}`}
            {...activatableProps(() => navigate(`/tickets/${t.id}`))}
          >
            <td>{t.ticketNumber}</td>
            <td>{new Date(t.ticketDate).toLocaleDateString()}</td>
            <td>{t.summary}</td>
            <td>{t.category.name}</td>
            <td>
              <PriorityBadge priority={t.requestedPriority} />
            </td>
            <td>
              <StatusBadge status={t.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
