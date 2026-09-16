import { useEffect, useState } from "react";
import { listStaffTickets, type StaffTicketSummary } from "../api/staff.js";
import { useStaffTicketListParams } from "../hooks/useStaffTicketListParams.js";
import { StaffTicketFilters } from "../components/staff/StaffTicketFilters.js";
import { StaffTicketTable } from "../components/staff/StaffTicketTable.js";
import { StaffTicketCardList } from "../components/staff/StaffTicketCardList.js";
import { Pagination } from "../components/ui/Pagination.js";
import { Spinner } from "../components/ui/Spinner.js";
import { Alert } from "../components/ui/Alert.js";
import { EmptyState } from "../components/ui/EmptyState.js";

type LoadState = "loading" | "success" | "error";

interface ListMeta {
  page: number;
  totalPages: number;
  totalItems: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

const DEFAULT_META: ListMeta = { page: 1, totalPages: 1, totalItems: 0, hasPreviousPage: false, hasNextPage: false };

// ui-spec.md §3: IT Staff Ticket Queue — same shape as Lab 2 My Tickets, but
// shows every ticket (not scoped to the caller) with Requester/Owner columns.
export default function StaffTicketQueue() {
  const { query, setQuery, clearFilters } = useStaffTicketListParams();
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<StaffTicketSummary[]>([]);
  const [meta, setMeta] = useState<ListMeta>(DEFAULT_META);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    listStaffTickets(query)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setMeta({
          page: res.page,
          totalPages: res.totalPages,
          totalItems: res.totalItems,
          hasPreviousPage: res.hasPreviousPage,
          hasNextPage: res.hasNextPage,
        });
        setState("success");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(query)]);

  const hasActiveFilters = !!(query.q || query.categoryId || query.status?.length || query.ownerId !== undefined);

  return (
    <div>
      <div className="mb-3">
        <h1 className="h4 mb-0">Ticket Queue</h1>
        <p className="text-secondary mb-0">All tickets across every requester.</p>
      </div>

      <StaffTicketFilters query={query} onChange={setQuery} onClear={clearFilters} />

      {state === "loading" && <Spinner label="Loading tickets…" />}

      {state === "error" && <Alert variant="error">Unable to load the ticket queue. Please try again.</Alert>}

      {state === "success" && items.length === 0 && !hasActiveFilters && (
        <EmptyState title="No tickets yet" description="Tickets will appear here once Requesters submit them." />
      )}

      {state === "success" && items.length === 0 && hasActiveFilters && (
        <EmptyState
          title="No tickets match your filters"
          description="Try adjusting or clearing your filters."
          action={
            <button type="button" className="btn btn-outline-primary" onClick={clearFilters}>
              Clear Filters
            </button>
          }
        />
      )}

      {state === "success" && items.length > 0 && (
        <>
          <StaffTicketTable tickets={items} sort={query.sort ?? "createdAt:desc"} onSortChange={(sort) => setQuery({ sort })} />
          <StaffTicketCardList tickets={items} />
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            hasPreviousPage={meta.hasPreviousPage}
            hasNextPage={meta.hasNextPage}
            onPageChange={(page) => setQuery({ page })}
          />
        </>
      )}
    </div>
  );
}
