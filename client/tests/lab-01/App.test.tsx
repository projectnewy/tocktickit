import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SystemCheck from "../../src/pages/SystemCheck.js";
import * as api from "../../src/api.js";

// Migrated from rendering <App /> to <SystemCheck /> when App.tsx became the
// Lab 2 router shell — the Lab 1 screen itself, and these tests, are
// otherwise unchanged. See /system route in src/App.tsx.
describe("SystemCheck", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<SystemCheck />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });

    render(<SystemCheck />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText(/online/i)).toBeInTheDocument();
    expect(screen.getByText("Account and Access")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("Network")).toBeInTheDocument();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("Unable to connect to TokTickIT API"));

    render(<SystemCheck />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText(/offline/i)).toBeInTheDocument();
    expect(screen.getByText(/unable to connect to toktickit api/i)).toBeInTheDocument();
  });
});
