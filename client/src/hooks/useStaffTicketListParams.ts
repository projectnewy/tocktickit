import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { StaffTicketListQuery } from "../api/staff.js";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT = "createdAt:desc";

// Same URL-driven-state pattern as useTicketListParams (Lab 2 My Tickets) —
// see ui-spec.md §3, "Same shape as Lab 2 My Tickets."
export function useStaffTicketListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query: StaffTicketListQuery = useMemo(() => {
    const status = searchParams.getAll("status");
    const ownerIdRaw = searchParams.get("ownerId");
    let ownerId: StaffTicketListQuery["ownerId"];
    if (ownerIdRaw === "me" || ownerIdRaw === "unassigned") ownerId = ownerIdRaw;
    else if (ownerIdRaw) ownerId = Number(ownerIdRaw);

    return {
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE,
      q: searchParams.get("q") || undefined,
      categoryId: searchParams.get("categoryId") ? Number(searchParams.get("categoryId")) : undefined,
      status: status.length ? status : undefined,
      ownerId,
      sort: searchParams.get("sort") || DEFAULT_SORT,
    };
  }, [searchParams]);

  const setQuery = useCallback(
    (patch: Partial<StaffTicketListQuery>) => {
      const next = new URLSearchParams(searchParams);

      function setOrDelete(key: string, value: string | undefined) {
        if (value) next.set(key, value);
        else next.delete(key);
      }

      if ("page" in patch) setOrDelete("page", patch.page ? String(patch.page) : undefined);
      if ("pageSize" in patch) setOrDelete("pageSize", patch.pageSize ? String(patch.pageSize) : undefined);
      if ("q" in patch) setOrDelete("q", patch.q);
      if ("categoryId" in patch) setOrDelete("categoryId", patch.categoryId ? String(patch.categoryId) : undefined);
      if ("ownerId" in patch) setOrDelete("ownerId", patch.ownerId !== undefined ? String(patch.ownerId) : undefined);
      if ("sort" in patch) setOrDelete("sort", patch.sort);
      if ("status" in patch) {
        next.delete("status");
        for (const s of patch.status ?? []) next.append("status", s);
      }

      if (!("page" in patch)) next.set("page", "1");

      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams]);

  return { query, setQuery, clearFilters };
}
