import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequesterSelection from "../../src/pages/RequesterSelection.js";
import * as referenceApi from "../../src/api/reference.js";
import { renderWithProviders } from "../helpers/render.js";

const REQUESTERS = [
  { id: 1, fullName: "Jennifer Anderson", email: "jennifer@example.com", department: "IT" },
  { id: 2, fullName: "Michael Brown", email: "michael@example.com", department: "Sales" },
];

describe("RequesterSelection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("shows a loading state while requesters are being fetched (UI-01)", () => {
    vi.spyOn(referenceApi, "listRequesters").mockReturnValue(new Promise(() => {}));
    renderWithProviders(<RequesterSelection />, { route: "/select-requester" });
    expect(screen.getByText(/loading requesters/i)).toBeInTheDocument();
  });

  it("shows a safe failure state when the requester list fails to load (UI-01, BR-20)", async () => {
    vi.spyOn(referenceApi, "listRequesters").mockRejectedValue(new Error("network down"));
    renderWithProviders(<RequesterSelection />, { route: "/select-requester" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load/i);
  });

  it("shows an empty state when no active requesters exist (UI-01, AC-14)", async () => {
    vi.spyOn(referenceApi, "listRequesters").mockResolvedValue([]);
    renderWithProviders(<RequesterSelection />, { route: "/select-requester" });
    expect(await screen.findByText(/no active development requesters/i)).toBeInTheDocument();
  });

  it("renders the dropdown populated with active requesters (UI-01)", async () => {
    vi.spyOn(referenceApi, "listRequesters").mockResolvedValue(REQUESTERS);
    renderWithProviders(<RequesterSelection />, { route: "/select-requester" });
    expect(await screen.findByRole("option", { name: "Jennifer Anderson" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Michael Brown" })).toBeInTheDocument();
  });

  it("disables Continue until a requester is selected, then persists the selection on continue (UI-02, FR-01)", async () => {
    vi.spyOn(referenceApi, "listRequesters").mockResolvedValue(REQUESTERS);
    renderWithProviders(<RequesterSelection />, { route: "/select-requester" });

    const continueButton = await screen.findByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText(/development requester/i), "1");
    expect(continueButton).toBeEnabled();

    await userEvent.click(continueButton);

    await waitFor(() => {
      const stored = localStorage.getItem("toktickit.selectedRequester");
      expect(stored).toContain("Jennifer Anderson");
    });
  });
});
