import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader.js";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="tk-page">
      <AppHeader />
      <main className="container py-4">{children}</main>
    </div>
  );
}
