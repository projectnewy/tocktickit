import type { ReactNode } from "react";

type AlertVariant = "success" | "error" | "warning" | "info";

interface AlertProps {
  variant: AlertVariant;
  children: ReactNode;
}

// Icon + text always paired with color — never a color-only signal.
const ICON: Record<AlertVariant, string> = { success: "✔", error: "⚠", warning: "⚠", info: "ℹ" };
const CLASS: Record<AlertVariant, string> = {
  success: "alert-success",
  error: "alert-danger",
  warning: "alert-warning",
  info: "alert-info",
};

export function Alert({ variant, children }: AlertProps) {
  return (
    <div className={`alert ${CLASS[variant]} d-flex align-items-start gap-2`} role="alert">
      <span aria-hidden="true">{ICON[variant]}</span>
      <div>{children}</div>
    </div>
  );
}
