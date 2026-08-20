import { useEffect, useState, type FormEvent } from "react";
import { listCategories, listRelatedSystems } from "../../api/reference.js";
import type { Category, RelatedSystem } from "../../api/types.js";
import type { TicketListQuery } from "../../api/tickets.js";
import { PRIORITY_OPTIONS } from "../../config.js";

const STATUS_OPTIONS = ["NEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;

interface TicketFiltersProps {
  query: TicketListQuery;
  onChange: (patch: Partial<TicketListQuery>) => void;
  onClear: () => void;
}

export function TicketFilters({ query, onChange, onClear }: TicketFiltersProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [searchInput, setSearchInput] = useState(query.q ?? "");

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => {});
    listRelatedSystems()
      .then(setRelatedSystems)
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
          <label htmlFor="ticket-search" className="form-label small fw-semibold">
            Search
          </label>
          <input
            id="ticket-search"
            type="search"
            className="form-control"
            placeholder="Ticket number or summary…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="filter-category" className="form-label small fw-semibold">
            Category
          </label>
          <select
            id="filter-category"
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
          <label htmlFor="filter-priority" className="form-label small fw-semibold">
            Requested Priority
          </label>
          <select
            id="filter-priority"
            className="form-select"
            value={query.requestedPriority?.[0] ?? ""}
            onChange={(e) => onChange({ requestedPriority: e.target.value ? [e.target.value] : undefined })}
          >
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="filter-status" className="form-label small fw-semibold">
            Current Status
          </label>
          <select
            id="filter-status"
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
