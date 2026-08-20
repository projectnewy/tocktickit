export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="d-flex align-items-center gap-2 text-secondary" role="status">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
