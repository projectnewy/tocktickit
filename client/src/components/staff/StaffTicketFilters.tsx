import { useEffect, useState, type FormEvent } from "react";
import { listCategories } from "../../api/reference.js";
import type { Category } from "../../api/types.js";
import type { StaffTicketListQuery } from "../../api/staff.js";

const STATUS_OPTIONS = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;

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
            value={query.status?.[0] ?? ""}
            onChange={(e) => onChange({ status: e.target.value ? [e.target.value] : undefined })}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
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
