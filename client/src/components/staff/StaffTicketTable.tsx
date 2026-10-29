import { useNavigate } from "react-router-dom";
import type { StaffTicketSummary } from "../../api/staff.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { PriorityBadge } from "../ui/PriorityBadge.js";
import { SortableHeader } from "../ui/SortableHeader.js";
import { activatableProps } from "../ui/activatable.js";

interface StaffTicketTableProps {
  tickets: StaffTicketSummary[];
  sort: string;
  onSortChange: (sort: string) => void;
}

// Desktop-only (≥992px) — the mobile representation is StaffTicketCardList.
// Columns per ui-spec.md §3: Ticket No., Requester, Summary, Category,
// IT Priority, Status, Owner, Last Updated. Sort field names match
// staff.schemas.ts's STAFF_SORT_ALLOWLIST.
export function StaffTicketTable({ tickets, sort, onSortChange }: StaffTicketTableProps) {
  const navigate = useNavigate();

  return (
    <table className="table d-none d-lg-table align-middle">
      <thead>
        <tr>
          <SortableHeader label="Ticket No." field="ticketNumber" sort={sort} onSortChange={onSortChange} />
          <th scope="col">Requester</th>
          <th scope="col">Summary</th>
          <th scope="col">Category</th>
          <SortableHeader label="IT Priority" field="itPriority" sort={sort} onSortChange={onSortChange} />
          <SortableHeader label="Status" field="status" sort={sort} onSortChange={onSortChange} />
          <th scope="col">Owner</th>
          <SortableHeader label="Last Updated" field="createdAt" sort={sort} onSortChange={onSortChange} />
        </tr>
      </thead>
      <tbody>
        {tickets.map((t) => (
          <tr
            key={t.id}
            className="tk-clickable-row"
            aria-label={`Open ${t.ticketNumber}`}
            {...activatableProps(() => navigate(`/staff/tickets/${t.id}`))}
          >
            <td>{t.ticketNumber}</td>
            <td>{t.requester.fullName}</td>
            <td>{t.summary}</td>
            <td>{t.category.name}</td>
            <td>{t.itPriority ? <PriorityBadge priority={t.itPriority} /> : <span className="text-secondary small">—</span>}</td>
            <td>
              <StatusBadge status={t.status} />
            </td>
            <td>{t.owner ? t.owner.fullName : <span className="text-secondary small">Unassigned</span>}</td>
            <td>{new Date(t.lastUpdated).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
