import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader.js";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="tk-page">
      <a className="visually-hidden-focusable" href="#main-content">
        Skip to main content
      </a>
      <AppHeader />
      {/* tabIndex -1: lets the skip link and the Modal's focus-restore
          fallback land here without adding another Tab stop. */}
      <main className="container py-4" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
