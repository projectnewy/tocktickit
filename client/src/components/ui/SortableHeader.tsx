interface SortableHeaderProps {
  label: string;
  field: string;
  // Current sort in the API's "field:asc|desc" form.
  sort: string;
  onSortChange: (sort: string) => void;
}

// A real <button> inside the <th>, so Enter and Space both work natively, and
// aria-sort tells assistive tech which column is sorted and which way.
export function SortableHeader({ label, field, sort, onSortChange }: SortableHeaderProps) {
  const [sortField, sortDir] = sort.split(":");
  const active = sortField === field;
  const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th scope="col" aria-sort={ariaSort}>
      <button
        type="button"
        className="tk-sort-button"
        onClick={() => onSortChange(`${field}:${active && sortDir === "asc" ? "desc" : "asc"}`)}
      >
        {label}
        <span aria-hidden="true">{active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</span>
      </button>
    </th>
  );
}
