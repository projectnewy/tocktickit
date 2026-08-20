import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-5">
      <p className="fw-semibold mb-1">{title}</p>
      {description && <p className="text-secondary mb-3">{description}</p>}
      {action}
    </div>
  );
}
