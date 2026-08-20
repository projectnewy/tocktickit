import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RequesterProvider } from "../../src/context/RequesterContext.js";

// Shared render helper for Lab 2 component tests. Not itself a test file
// (vite.config.ts only collects tests/**/*.test.tsx), so this is safe to
// import from any test without being picked up as one.
export function renderWithProviders(ui: ReactElement, options: { route?: string } = {}) {
  const route = options.route ?? "/";
  return render(
    <MemoryRouter initialEntries={[route]}>
      <RequesterProvider>{ui}</RequesterProvider>
    </MemoryRouter>
  );
}
