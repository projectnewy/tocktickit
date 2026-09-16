import { useNavigate } from "react-router-dom";
import type { StaffTicketSummary } from "../../api/staff.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { PriorityBadge } from "../ui/PriorityBadge.js";

// Matches staff.schemas.ts's STAFF_SORT_ALLOWLIST field names.
const SORT_COLUMNS = [
  { key: "ticketNumber", label: "Ticket No." },
  { key: "createdAt", label: "Created Date" },
  { key: "itPriority", label: "IT Priority" },
  { key: "status", label: "Status" },
] as const;

interface StaffTicketTableProps {
  tickets: StaffTicketSummary[];
  sort: string;
  onSortChange: (sort: string) => void;
}

// Desktop-only (≥992px) — the mobile representation is StaffTicketCardList.
// Columns per ui-spec.md §3: Ticket No., Requester, Summary, Category,
// IT Priority, Status, Owner, Last Updated.
export function StaffTicketTable({ tickets, sort, onSortChange }: StaffTicketTableProps) {
  const navigate = useNavigate();
  const [sortField, sortDir] = sort.split(":");

  function toggleSort(field: string) {
    const nextDir = sortField === field && sortDir === "asc" ? "desc" : "asc";
    onSortChange(`${field}:${nextDir}`);
  }

  function sortHeader(key: string, label: string) {
    return (
      <th
        key={key}
        scope="col"
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer" }}
        onClick={() => toggleSort(key)}
        onKeyDown={(e) => {
          if (e.key === "Enter") toggleSort(key);
        }}
      >
        {label} {sortField === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </th>
    );
  }

  return (
    <table className="table d-none d-lg-table align-middle">
      <thead>
        <tr>
          {sortHeader(SORT_COLUMNS[0].key, SORT_COLUMNS[0].label)}
          <th scope="col">Requester</th>
          <th scope="col">Summary</th>
          <th scope="col">Category</th>
          {sortHeader(SORT_COLUMNS[2].key, SORT_COLUMNS[2].label)}
          {sortHeader(SORT_COLUMNS[3].key, SORT_COLUMNS[3].label)}
          <th scope="col">Owner</th>
          {sortHeader(SORT_COLUMNS[1].key, "Last Updated")}
        </tr>
      </thead>
      <tbody>
        {tickets.map((t) => (
          <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/staff/tickets/${t.id}`)}>
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
