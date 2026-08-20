import { useNavigate } from "react-router-dom";
import type { TicketSummary } from "../../api/tickets.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { PriorityBadge } from "../ui/PriorityBadge.js";

// Matches api-spec.md's sort allowlist field names.
const SORT_COLUMNS = [
  { key: "ticketNumber", label: "Ticket No." },
  { key: "createdAt", label: "Created Date" },
  { key: "summary", label: "Summary" },
] as const;

interface TicketTableProps {
  tickets: TicketSummary[];
  sort: string;
  onSortChange: (sort: string) => void;
}

// Desktop-only (≥992px) — the mobile representation is TicketCardList.
export function TicketTable({ tickets, sort, onSortChange }: TicketTableProps) {
  const navigate = useNavigate();
  const [sortField, sortDir] = sort.split(":");

  function toggleSort(field: string) {
    const nextDir = sortField === field && sortDir === "asc" ? "desc" : "asc";
    onSortChange(`${field}:${nextDir}`);
  }

  return (
    <table className="table d-none d-lg-table align-middle">
      <thead>
        <tr>
          {SORT_COLUMNS.map((col) => (
            <th
              key={col.key}
              scope="col"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => toggleSort(col.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter") toggleSort(col.key);
              }}
            >
              {col.label} {sortField === col.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
            </th>
          ))}
          <th scope="col">Category</th>
          <th scope="col">Requested Priority</th>
          <th scope="col">Current Status</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((t) => (
          <tr
            key={t.id}
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/tickets/${t.id}`)}
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
