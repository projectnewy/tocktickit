import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateTicket from "../../src/pages/CreateTicket.js";
import * as referenceApi from "../../src/api/reference.js";
import * as ticketsApi from "../../src/api/tickets.js";
import * as attachmentsApi from "../../src/api/attachments.js";
import { ApiError } from "../../src/api/client.js";
import type { TicketDetail } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const CATEGORIES = [{ id: 2, name: "Hardware" }];
const SYSTEMS = [{ id: 7, name: "Corporate Laptop" }];

const CREATED_TICKET: TicketDetail = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "Laptop battery drains quickly",
  description: "The battery drains much faster than usual.",
  requestedPriority: "MEDIUM",
  itPriority: null,
  status: "NEW",
  ticketDate: "2026-01-01T00:00:00.000Z",
  requester: { id: 1, fullName: "Jennifer Anderson" },
  category: CATEGORIES[0],
  relatedSystem: SYSTEMS[0],
  ticketOwner: null,
  attachments: [],
};

function mockReferenceData() {
  vi.spyOn(referenceApi, "listCategories").mockResolvedValue(CATEGORIES);
  vi.spyOn(referenceApi, "listRelatedSystems").mockResolvedValue(SYSTEMS);
}

async function fillValidForm() {
  await userEvent.selectOptions(screen.getByLabelText(/category/i), "2");
  await userEvent.selectOptions(screen.getByLabelText(/related system/i), "7");
  await userEvent.selectOptions(screen.getByLabelText(/requested priority/i), "MEDIUM");
  await userEvent.type(screen.getByLabelText(/ticket summary/i), "Laptop battery drains quickly");
  await userEvent.type(screen.getByLabelText(/^description/i), "The battery drains much faster than usual.");
}

describe("CreateTicket", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all required fields with Submit disabled on an empty form (UI-03)", async () => {
    mockReferenceData();
    renderWithProviders(<CreateTicket />);

    expect(await screen.findByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/related system/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/requested priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ticket summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/attachments/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit ticket/i })).toBeDisabled();
  });

  it("shows a field-level message below the field for an out-of-range summary and does not call the API (UI-04, AC-04)", async () => {
    mockReferenceData();
    const createSpy = vi.spyOn(ticketsApi, "createTicket");
    renderWithProviders(<CreateTicket />);

    await userEvent.selectOptions(await screen.findByLabelText(/category/i), "2");
    await userEvent.selectOptions(screen.getByLabelText(/related system/i), "7");
    await userEvent.selectOptions(screen.getByLabelText(/requested priority/i), "MEDIUM");
    await userEvent.type(screen.getByLabelText(/ticket summary/i), "hi");
    await userEvent.type(screen.getByLabelText(/^description/i), "The battery drains much faster than usual.");

    await userEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    const error = await screen.findByText(/between 5 and 150 characters/i);
    expect(error).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("shows a busy state while submitting, then success with the generated Ticket Number (UI-05, AC-01)", async () => {
    mockReferenceData();
    let resolveCreate!: (value: TicketDetail) => void;
    vi.spyOn(ticketsApi, "createTicket").mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );
    renderWithProviders(<CreateTicket />);
    await screen.findByLabelText(/category/i);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: /submit ticket/i }));
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    resolveCreate(CREATED_TICKET);

    expect(await screen.findByText(/TKT-2026-000042/)).toBeInTheDocument();
  });

  it("shows a safe error and preserves entered values when the API call fails (UI-06, AC-05, BR-12)", async () => {
    mockReferenceData();
    vi.spyOn(ticketsApi, "createTicket").mockRejectedValue(new ApiError(500, "Unexpected server error"));
    renderWithProviders(<CreateTicket />);
    await screen.findByLabelText(/category/i);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    expect(await screen.findByText(/unexpected server error/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ticket summary/i)).toHaveValue("Laptop battery drains quickly");
  });

  it("rejects a disallowed file type client-side without blocking the rest of the form (UI-07, AC-10)", async () => {
    mockReferenceData();
    renderWithProviders(<CreateTicket />);
    await screen.findByLabelText(/category/i);

    // userEvent.upload() respects the input's `accept` filter and silently
    // drops non-matching files; fireEvent bypasses that to simulate a user
    // picking "All Files" in the native dialog, which is a real possible path.
    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/attachments/i), { target: { files: [file] } });

    expect(await screen.findByText(/file type not allowed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ticket summary/i)).toBeEnabled();
  });

  it("rejects an oversized file client-side (UI-07, AC-11)", async () => {
    mockReferenceData();
    renderWithProviders(<CreateTicket />);
    await screen.findByLabelText(/category/i);

    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], "huge.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/attachments/i), oversized);

    expect(await screen.findByText(/exceeds the 5 mb limit/i)).toBeInTheDocument();
  });

  it("reports which files failed to upload after the ticket is created, without losing the ticket (BR-18, AC-15)", async () => {
    mockReferenceData();
    vi.spyOn(ticketsApi, "createTicket").mockResolvedValue(CREATED_TICKET);
    vi.spyOn(attachmentsApi, "uploadAttachment").mockRejectedValue(new ApiError(415, "Unsupported media type"));

    renderWithProviders(<CreateTicket />);
    await screen.findByLabelText(/category/i);
    await fillValidForm();

    const file = new File(["x".repeat(20)], "photo.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/attachments/i), file);
    await userEvent.click(screen.getByRole("button", { name: /submit ticket/i }));

    expect(await screen.findByText(/TKT-2026-000042/)).toBeInTheDocument();
    expect(screen.getByText(/could not be uploaded/i)).toBeInTheDocument();
    expect(screen.getByText(/photo\.png/)).toBeInTheDocument();
  });
});
