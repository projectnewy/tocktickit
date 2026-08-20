import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttachmentSection } from "../../src/components/attachments/AttachmentSection.js";
import * as attachmentsApi from "../../src/api/attachments.js";
import type { AttachmentMeta } from "../../src/api/types.js";

function makeAttachment(overrides: Partial<AttachmentMeta> = {}): AttachmentMeta {
  return {
    id: 1,
    ticketId: 42,
    originalFilename: "photo.png",
    mimeType: "image/png",
    sizeBytes: 2048,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    uploadedBy: { id: 1, fullName: "Jennifer Anderson" },
    isRemoved: false,
    removedAt: null,
    removedReason: null,
    removedBy: null,
    ...overrides,
  };
}

describe("AttachmentSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads a valid file and adds it to the list (UI-14, FR-11)", async () => {
    const onChange = vi.fn();
    const created = makeAttachment({ id: 2, originalFilename: "new-photo.png" });
    vi.spyOn(attachmentsApi, "uploadAttachment").mockResolvedValue(created);

    render(<AttachmentSection ticketId={42} attachments={[]} onAttachmentsChange={onChange} />);

    const file = new File(["x"], "new-photo.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/add attachment/i), file);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([created]));
  });

  it("rejects a disallowed file type client-side without calling the API (UI-14, BR-13)", async () => {
    const uploadSpy = vi.spyOn(attachmentsApi, "uploadAttachment");
    render(<AttachmentSection ticketId={42} attachments={[]} onAttachmentsChange={vi.fn()} />);

    // fireEvent bypasses the input's accept-attribute filtering that
    // userEvent.upload silently applies (see CreateTicket.test.tsx).
    const badType = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/add attachment/i), { target: { files: [badType] } });

    expect(await screen.findByText(/file type not allowed/i)).toBeInTheDocument();
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("rejects an oversized file client-side without calling the API (UI-14, BR-14)", async () => {
    const uploadSpy = vi.spyOn(attachmentsApi, "uploadAttachment");
    render(<AttachmentSection ticketId={42} attachments={[]} onAttachmentsChange={vi.fn()} />);

    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], "huge.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/add attachment/i), { target: { files: [oversized] } });

    expect(await screen.findByText(/exceeds the 5 mb limit/i)).toBeInTheDocument();
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("requires a reason before confirming removal, then updates the list to show the removed state (UI-15, BR-16, BR-17)", async () => {
    const active = makeAttachment();
    const removed = makeAttachment({
      isRemoved: true,
      removedAt: "2026-01-02T00:00:00.000Z",
      removedReason: "Uploaded by mistake",
      removedBy: { id: 1, fullName: "Jennifer Anderson" },
    });
    const onChange = vi.fn();
    vi.spyOn(attachmentsApi, "removeAttachment").mockResolvedValue(removed);

    render(<AttachmentSection ticketId={42} attachments={[active]} onAttachmentsChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // The default preset reason is already non-empty, so confirm starts enabled.
    // Two "Remove" buttons exist now (the list item's and the dialog's) — the
    // dialog's is the last one rendered.
    const dialogConfirm = screen.getAllByRole("button", { name: /^remove$/i }).at(-1)!;
    expect(dialogConfirm).toBeEnabled();
    await userEvent.click(dialogConfirm);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([removed]));
  });

  it("requires free text when 'Other' is selected as the removal reason (UI-15, BR-17)", async () => {
    const active = makeAttachment();
    render(<AttachmentSection ticketId={42} attachments={[active]} onAttachmentsChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    await userEvent.selectOptions(screen.getByLabelText(/reason for removal/i), "Other");

    const dialogConfirm = screen.getAllByRole("button", { name: /^remove$/i }).at(-1)!;
    expect(dialogConfirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/other reason/i), "A custom reason");
    expect(dialogConfirm).toBeEnabled();
  });

  it("disables the upload control once 5 active attachments already exist (UI-16, BR-15, AC-06)", () => {
    const attachments = Array.from({ length: 5 }, (_, i) => makeAttachment({ id: i + 1 }));
    render(<AttachmentSection ticketId={42} attachments={attachments} onAttachmentsChange={vi.fn()} />);

    expect(screen.getByLabelText(/add attachment/i)).toBeDisabled();
    expect(screen.getByText(/maximum of 5 active attachments/i)).toBeInTheDocument();
  });

  it("shows removed attachments as metadata-only, without a download or remove control (BR-16)", () => {
    const removed = makeAttachment({
      id: 9,
      originalFilename: "old-file.pdf",
      isRemoved: true,
      removedReason: "No longer relevant",
    });
    render(<AttachmentSection ticketId={42} attachments={[removed]} onAttachmentsChange={vi.fn()} />);

    expect(screen.getByText("old-file.pdf")).toBeInTheDocument();
    expect(screen.getByText(/removed: no longer relevant/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^remove$/i })).not.toBeInTheDocument();
  });
});
