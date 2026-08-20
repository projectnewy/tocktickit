import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTickets, type TicketSummary } from "../api/tickets.js";
import { useTicketListParams } from "../hooks/useTicketListParams.js";
import { useSelectedRequester } from "../context/RequesterContext.js";
import { TicketFilters } from "../components/tickets/TicketFilters.js";
import { TicketTable } from "../components/tickets/TicketTable.js";
import { TicketCardList } from "../components/tickets/TicketCardList.js";
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

export default function MyTickets() {
  const { query, setQuery, clearFilters } = useTicketListParams();
  const { requester } = useSelectedRequester();
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<TicketSummary[]>([]);
  const [meta, setMeta] = useState<ListMeta>(DEFAULT_META);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    listTickets(query)
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
    // Re-fetch whenever the URL-driven query changes OR the selected
    // requester changes (AC-12 — switching requesters must reload the list).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query), requester?.id]);

  const hasActiveFilters = !!(
    query.q ||
    query.categoryId ||
    query.relatedSystemId ||
    query.status?.length ||
    query.requestedPriority?.length
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h1 className="h4 mb-0">My Tickets</h1>
          <p className="text-secondary mb-0">View and track all of your support requests.</p>
        </div>
        <Link to="/tickets/new" className="btn btn-primary">
          Create Ticket
        </Link>
      </div>

      <TicketFilters query={query} onChange={setQuery} onClear={clearFilters} />

      {state === "loading" && <Spinner label="Loading tickets…" />}

      {state === "error" && <Alert variant="error">Unable to load your tickets. Please try again.</Alert>}

      {state === "success" && items.length === 0 && !hasActiveFilters && (
        <EmptyState
          title="No tickets yet"
          description="Create your first ticket to get started."
          action={
            <Link to="/tickets/new" className="btn btn-primary">
              Create Ticket
            </Link>
          }
        />
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
          <TicketTable tickets={items} sort={query.sort ?? "createdAt:desc"} onSortChange={(sort) => setQuery({ sort })} />
          <TicketCardList tickets={items} />
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
