import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { TicketListQuery } from "../api/tickets.js";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT = "createdAt:desc";

// Keeps My Tickets' search/filter/sort/page state entirely in the URL, so
// refresh, back button, and deep links all work — see ui-spec.md §6.3.
export function useTicketListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query: TicketListQuery = useMemo(() => {
    const status = searchParams.getAll("status");
    const requestedPriority = searchParams.getAll("requestedPriority");
    return {
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE,
      q: searchParams.get("q") || undefined,
      categoryId: searchParams.get("categoryId") ? Number(searchParams.get("categoryId")) : undefined,
      relatedSystemId: searchParams.get("relatedSystemId")
        ? Number(searchParams.get("relatedSystemId"))
        : undefined,
      status: status.length ? status : undefined,
      requestedPriority: requestedPriority.length ? requestedPriority : undefined,
      sort: searchParams.get("sort") || DEFAULT_SORT,
    };
  }, [searchParams]);

  const setQuery = useCallback(
    (patch: Partial<TicketListQuery>) => {
      const next = new URLSearchParams(searchParams);

      function setOrDelete(key: string, value: string | undefined) {
        if (value) next.set(key, value);
        else next.delete(key);
      }

      if ("page" in patch) setOrDelete("page", patch.page ? String(patch.page) : undefined);
      if ("pageSize" in patch) setOrDelete("pageSize", patch.pageSize ? String(patch.pageSize) : undefined);
      if ("q" in patch) setOrDelete("q", patch.q);
      if ("categoryId" in patch) setOrDelete("categoryId", patch.categoryId ? String(patch.categoryId) : undefined);
      if ("relatedSystemId" in patch) {
        setOrDelete("relatedSystemId", patch.relatedSystemId ? String(patch.relatedSystemId) : undefined);
      }
      if ("sort" in patch) setOrDelete("sort", patch.sort);
      if ("status" in patch) {
        next.delete("status");
        for (const s of patch.status ?? []) next.append("status", s);
      }
      if ("requestedPriority" in patch) {
        next.delete("requestedPriority");
        for (const p of patch.requestedPriority ?? []) next.append("requestedPriority", p);
      }

      // Any filter/sort change resets to page 1, unless page itself is the change.
      if (!("page" in patch)) next.set("page", "1");

      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams]);

  return { query, setQuery, clearFilters };
}
