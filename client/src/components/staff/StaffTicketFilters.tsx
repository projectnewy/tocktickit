import { useEffect, useState, type FormEvent } from "react";
import { listCategories } from "../../api/reference.js";
import type { Category } from "../../api/types.js";
import type { StaffTicketListQuery } from "../../api/staff.js";

import { PRIORITY_VALUES, STATUS_VALUES, priorityLabel, statusLabel } from "../../config/labels.js";

// Shown (disabled) when a Dashboard link opened the queue with several statuses at once, so the control
// never claims a single status while the list shows more.
const SEVERAL = "__several";

interface StaffTicketFiltersProps {
  query: StaffTicketListQuery;
  onChange: (patch: Partial<StaffTicketListQuery>) => void;
  onClear: () => void;
}

// ui-spec.md §3: search box, filter row (Status, Category, Owner: Me/Unassigned/All).
export function StaffTicketFilters({ query, onChange, onClear }: StaffTicketFiltersProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState(query.q ?? "");

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSearchInput(query.q ?? "");
  }, [query.q]);

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onChange({ q: searchInput || undefined });
  }

  return (
    <div className="tk-surface p-3 mb-3">
      <form className="row g-2 align-items-end" onSubmit={handleSearchSubmit}>
        <div className="col-12 col-md-4">
          <label htmlFor="staff-ticket-search" className="form-label small fw-semibold">
            Search
          </label>
          <input
            id="staff-ticket-search"
            type="search"
            className="form-control"
            placeholder="Ticket number, summary, or requester…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="staff-filter-category" className="form-label small fw-semibold">
            Category
          </label>
          <select
            id="staff-filter-category"
            className="form-select"
            value={query.categoryId ?? ""}
            onChange={(e) => onChange({ categoryId: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="staff-filter-status" className="form-label small fw-semibold">
            Status
          </label>
          <select
            id="staff-filter-status"
            className="form-select"
            value={(query.status?.length ?? 0) > 1 ? SEVERAL : query.status?.[0] ?? ""}
            onChange={(e) => onChange({ status: e.target.value ? [e.target.value] : undefined })}
          >
            <option value="">All Statuses</option>
            {(query.status?.length ?? 0) > 1 && (
              <option value={SEVERAL} disabled>
                {query.status!.length} statuses selected
              </option>
            )}
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="staff-filter-priority" className="form-label small fw-semibold">
            IT Priority
          </label>
          <select
            id="staff-filter-priority"
            className="form-select"
            value={(query.itPriority?.length ?? 0) > 1 ? SEVERAL : query.itPriority?.[0] ?? ""}
            onChange={(e) => onChange({ itPriority: e.target.value ? [e.target.value] : undefined })}
          >
            <option value="">All Priorities</option>
            {(query.itPriority?.length ?? 0) > 1 && (
              <option value={SEVERAL} disabled>
                {query.itPriority!.length} priorities selected
              </option>
            )}
            {PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="staff-filter-owner" className="form-label small fw-semibold">
            Owner
          </label>
          <select
            id="staff-filter-owner"
            className="form-select"
            value={query.ownerId ?? ""}
            onChange={(e) => onChange({ ownerId: e.target.value ? (e.target.value as "me" | "unassigned") : undefined })}
          >
            <option value="">All</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
        <div className="col-6 col-md-2 d-flex gap-2">
          <button type="submit" className="btn btn-primary btn-sm flex-fill">
            Search
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm flex-fill" onClick={onClear}>
            Clear Filters
          </button>
        </div>
      </form>
    </div>
  );
}
