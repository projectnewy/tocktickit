export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <span className={`badge ${isActive ? "text-bg-success" : "text-bg-secondary"}`}>{isActive ? "Active" : "Inactive"}</span>;
}
