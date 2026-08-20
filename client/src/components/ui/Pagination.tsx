interface PaginationProps {
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, hasPreviousPage, hasNextPage, onPageChange }: PaginationProps) {
  return (
    <nav aria-label="Ticket list pagination" className="d-flex justify-content-between align-items-center mt-3">
      <button
        type="button"
        className="btn btn-outline-primary btn-sm"
        disabled={!hasPreviousPage}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-secondary small">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="btn btn-outline-primary btn-sm"
        disabled={!hasNextPage}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
