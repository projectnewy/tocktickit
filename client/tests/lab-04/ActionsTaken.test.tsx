import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionsTakenSection } from "../../src/components/actions/ActionsTakenSection.js";
import * as actionsApi from "../../src/api/actions.js";
import { ApiError } from "../../src/api/client.js";
import type { ActionTaken } from "../../src/api/actions.js";
import type { StaffAssignee } from "../../src/api/staff.js";
import type { TicketStatus } from "../../src/api/types.js";
import { renderWithProviders } from "../helpers/render.js";

const PRIYA = { id: 2, fullName: "Priya Natarajan" };
const CARLOS = { id: 9, fullName: "Carlos Mendes" };

const ASSIGNEES: StaffAssignee[] = [
  { ...PRIYA, role: "IT_STAFF" },
  { ...CARLOS, role: "IT_STAFF" },
];

function action(overrides: Partial<ActionTaken> = {}): ActionTaken {
  return {
    id: 1,
    ticketId: 42,
    status: "PLANNED",
    actionDateTime: "2026-10-20T09:00:00.000Z",
    description: "Replace the access point",
    result: null,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    assignee: CARLOS,
    createdBy: PRIYA,
    performedBy: null,
    version: 0,
    createdAt: "2026-10-19T09:00:00.000Z",
    updatedAt: "2026-10-19T09:00:00.000Z",
    ...overrides,
  };
}

const PLANNED = action({ id: 1, description: "Replace the access point" });
const COMPLETED = action({
  id: 2,
  status: "COMPLETED",
  description: "Checked the cabling",
  result: "Cabling is fine",
  actionDateTime: "2026-10-21T09:00:00.000Z",
  assignee: PRIYA,
  performedBy: PRIYA,
  followUpRequired: true,
  followUpNote: "Look again next week",
  attachmentNotes: "Photo on the ticket",
});
const CANCELLED = action({ id: 3, status: "CANCELLED", description: "Reimage the laptop", actionDateTime: "2026-10-22T09:00:00.000Z" });

function renderSection(options: { mode?: "staff" | "requester"; status?: TicketStatus } = {}) {
  return renderWithProviders(
    <ActionsTakenSection ticketId={42} ticketStatus={options.status ?? "IN_PROGRESS"} ticketVersion={0} mode={options.mode ?? "staff"} assignees={ASSIGNEES} />
  );
}

const table = () => screen.getByRole("table");
const dialog = () => screen.getByRole("dialog");

async function openAdd() {
  await userEvent.click(await screen.findByRole("button", { name: "Add Action" }));
  return within(dialog());
}

describe("ActionsTakenSection", () => {
  beforeEach(() => {
    vi.spyOn(actionsApi, "listActions").mockResolvedValue([PLANNED, COMPLETED, CANCELLED]);
  });
  afterEach(() => vi.restoreAllMocks());

  describe("list (UI-01)", () => {
    it("shows each action's fields in a table and in cards, in the order the server returned them", async () => {
      renderSection();
      await within(await screen.findByRole("table")).findByText("Replace the access point");

      const rows = within(table()).getAllByRole("row").slice(1);
      expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual([
        "Replace the access point",
        "Checked the cabling",
        "Reimage the laptop",
      ]);
      const completedRow = within(rows[1]);
      expect(completedRow.getByText("Cabling is fine")).toBeInTheDocument();
      expect(completedRow.getByText("Priya Natarajan", { selector: "td:nth-child(5)" })).toBeInTheDocument(); // Performed By
      expect(completedRow.getByText("Completed")).toBeInTheDocument();
      expect(completedRow.getByText("Look again next week")).toBeInTheDocument();
      expect(completedRow.getByText("Photo on the ticket")).toBeInTheDocument();

      const cards = within(screen.getByTestId("action-cards"));
      expect(cards.getAllByRole("listitem")).toHaveLength(3);
      expect(cards.getByText("Replace the access point")).toBeInTheDocument();
      expect(cards.getByText("Planned")).toBeInTheDocument(); // friendly label, never PLANNED
      expect(screen.queryByText(/PLANNED|COMPLETED|CANCELLED/)).not.toBeInTheDocument();
    });

    it("shows an empty message when there are no actions", async () => {
      vi.spyOn(actionsApi, "listActions").mockResolvedValue([]);
      renderSection();
      expect(await screen.findByText("No actions have been recorded for this ticket yet.")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows a safe failure with Retry, never a raw error", async () => {
      const list = vi.spyOn(actionsApi, "listActions").mockRejectedValue(new Error("boom: connect ECONNREFUSED"));
      renderSection();
      expect(await screen.findByText("Unable to load the actions for this ticket.")).toBeInTheDocument();
      expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();

      list.mockResolvedValue([PLANNED]);
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await within(await screen.findByRole("table")).findByText("Replace the access point")).toBeInTheDocument();
    });

    it("shows a loading state first", () => {
      vi.spyOn(actionsApi, "listActions").mockReturnValue(new Promise(() => {}));
      renderSection();
      expect(screen.getByText("Loading actions…")).toBeInTheDocument();
    });

    it("offers no Add or Edit while the ticket is not being worked, and says why", async () => {
      renderSection({ status: "RESOLVED" });
      await screen.findByRole("table");
      expect(screen.getByRole("button", { name: "Add Action" })).toBeDisabled();
      expect(screen.getByText(/only while the ticket is Open, In Progress/i)).toBeInTheDocument();
      for (const button of within(table()).getAllByRole("button", { name: /^(Edit|Complete|Cancel)/ })) expect(button).toBeDisabled();
    });
  });

  describe("create (UI-02, UI-03, UI-07)", () => {
    it("UI-02: an empty submit shows the message directly below the field and calls no API", async () => {
      const create = vi.spyOn(actionsApi, "createAction");
      renderSection();
      const form = await openAdd();

      await userEvent.click(form.getByRole("button", { name: "Create action" }));

      const field = form.getByLabelText(/^Description/);
      const message = form.getByText("Description is required.");
      expect(message).toHaveAttribute("role", "alert");
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field.getAttribute("aria-describedby")).toBe(message.id);
      expect(field.parentElement).toContainElement(message); // same field block, rendered after the control
      expect(create).not.toHaveBeenCalled();
      // The submit button was never disabled by invalid input, so this click really reached validation.
      expect(form.getByRole("button", { name: "Create action" })).toBeEnabled();
    });

    it("UI-02: the follow-up note appears only when follow-up is required, and then must be filled", async () => {
      const create = vi.spyOn(actionsApi, "createAction");
      renderSection();
      const form = await openAdd();

      expect(form.queryByLabelText(/Follow-up note/)).not.toBeInTheDocument();
      await userEvent.type(form.getByLabelText(/^Description/), "Call the supplier");
      await userEvent.click(form.getByLabelText("Follow-up required"));
      expect(form.getByLabelText(/Follow-up note/)).toBeInTheDocument();

      await userEvent.click(form.getByRole("button", { name: "Create action" }));
      expect(form.getByText("Follow-up note is required when follow-up is required.")).toBeInTheDocument();
      expect(create).not.toHaveBeenCalled();
    });

    it("UI-02: completing needs a result", async () => {
      const create = vi.spyOn(actionsApi, "createAction");
      renderSection();
      const form = await openAdd();
      await userEvent.type(form.getByLabelText(/^Description/), "Swap the switch");
      await userEvent.click(form.getByLabelText("Mark completed"));

      await userEvent.click(form.getByRole("button", { name: "Complete action" }));
      expect(form.getByText("Result is required to complete an action.")).toBeInTheDocument();
      expect(create).not.toHaveBeenCalled();
    });

    it("UI-02: a valid form sends the trimmed fields and a clientRequestId, then closes with a success message", async () => {
      const saved = action({ id: 7, description: "Call the supplier" });
      const create = vi.spyOn(actionsApi, "createAction").mockResolvedValue(saved);
      renderSection();
      const form = await openAdd();

      await userEvent.type(form.getByLabelText(/^Description/), "  Call the supplier  ");
      await userEvent.click(form.getByLabelText("Follow-up required"));
      await userEvent.type(form.getByLabelText(/Follow-up note/), "Ask about the delivery date");
      await userEvent.click(form.getByRole("button", { name: "Create action" }));

      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      const [ticketId, body] = create.mock.calls[0];
      expect(ticketId).toBe(42);
      expect(body).toMatchObject({
        description: "Call the supplier",
        status: "PLANNED",
        followUpRequired: true,
        followUpNote: "Ask about the delivery date",
        result: null,
      });
      expect(body.clientRequestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(body).not.toHaveProperty("assigneeId"); // "Me (default)": the server uses the signed-in user
      expect(await screen.findByText("Action added.")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("UI-03: the assignee list offers only the staff supplied (active IT Staff and Administrators)", async () => {
      renderSection();
      const form = await openAdd();
      const options = Array.from((form.getByLabelText("Assignee") as HTMLSelectElement).options).map((o) => o.textContent);
      expect(options).toEqual(["Me (default)", "Priya Natarajan", "Carlos Mendes"]);
    });

    it("UI-03: a rejected assignee (422) shows under the Assignee field and keeps everything typed", async () => {
      vi.spyOn(actionsApi, "createAction").mockRejectedValue(new ApiError(422, "Assignee must be an active IT Staff or Administrator"));
      renderSection();
      const form = await openAdd();
      await userEvent.type(form.getByLabelText(/^Description/), "Reassign the work");
      await userEvent.selectOptions(form.getByLabelText("Assignee"), "9");

      await userEvent.click(form.getByRole("button", { name: "Create action" }));

      const message = await form.findByText("Choose an active IT Staff member or Administrator.");
      expect(form.getByLabelText("Assignee").parentElement).toContainElement(message);
      expect(form.getByLabelText(/^Description/)).toHaveValue("Reassign the work");
      expect(form.getByLabelText("Assignee")).toHaveValue("9");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("keeps the typed values after a network failure and shows a safe message", async () => {
      vi.spyOn(actionsApi, "createAction").mockRejectedValue(new Error("network down"));
      renderSection();
      const form = await openAdd();
      await userEvent.type(form.getByLabelText(/^Description/), "Keep my words");

      await userEvent.click(form.getByRole("button", { name: "Create action" }));

      expect(await form.findByText(/Unable to save this action/)).toBeInTheDocument();
      expect(screen.queryByText(/network down/)).not.toBeInTheDocument();
      expect(form.getByLabelText(/^Description/)).toHaveValue("Keep my words");
    });

    it("maps server field errors (400 details) onto the right fields", async () => {
      vi.spyOn(actionsApi, "createAction").mockRejectedValue(
        new ApiError(400, "Invalid request", { details: [{ field: "attachmentNotes", message: "Attachment notes must be at most 500 characters." }] })
      );
      renderSection();
      const form = await openAdd();
      await userEvent.type(form.getByLabelText(/^Description/), "Valid text");
      await userEvent.click(form.getByRole("button", { name: "Create action" }));

      const message = await form.findByText("Attachment notes must be at most 500 characters.");
      expect(form.getByLabelText("Attachment notes").parentElement).toContainElement(message);
    });

    it("a non-actionable-ticket conflict is shown in plain words", async () => {
      vi.spyOn(actionsApi, "createAction").mockRejectedValue(
        new ApiError(409, "Actions can only be recorded while the Ticket is Open, In Progress, Waiting for Requester, or Reopened", { code: "TICKET_NOT_ACTIONABLE" })
      );
      renderSection();
      const form = await openAdd();
      await userEvent.type(form.getByLabelText(/^Description/), "Too late");
      await userEvent.click(form.getByRole("button", { name: "Create action" }));
      expect(await form.findByText(/Actions can only be recorded while the Ticket is Open/)).toBeInTheDocument();
    });

    it("UI-07: a double click on Submit sends one request and the button shows it is busy", async () => {
      let release: (value: ActionTaken) => void = () => {};
      const create = vi.spyOn(actionsApi, "createAction").mockImplementation(() => new Promise((resolve) => (release = resolve)));
      renderSection();
      const form = await openAdd();
      await userEvent.type(form.getByLabelText(/^Description/), "Only once please");

      await userEvent.dblClick(form.getByRole("button", { name: "Create action" }));

      expect(create).toHaveBeenCalledTimes(1);
      expect(form.getByRole("button", { name: "Saving…" })).toBeDisabled();
      release(action({ id: 8, description: "Only once please" }));
      expect(await screen.findByText("Action added.")).toBeInTheDocument();
      expect(create).toHaveBeenCalledTimes(1);
    });

    it("UI-07: a retry after a failure reuses the same clientRequestId", async () => {
      const create = vi.spyOn(actionsApi, "createAction").mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(action({ id: 9 }));
      renderSection();
      const form = await openAdd();
      await userEvent.type(form.getByLabelText(/^Description/), "Retry me");

      await userEvent.click(form.getByRole("button", { name: "Create action" }));
      await form.findByText(/Unable to save this action/);
      await userEvent.click(form.getByRole("button", { name: "Create action" }));

      await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
      expect(create.mock.calls[1][1].clientRequestId).toBe(create.mock.calls[0][1].clientRequestId);
    });
  });

  describe("view and edit modes (UI-04)", () => {
    it("a Cancelled action opens read-only: nothing editable and no Save button", async () => {
      renderSection();
      await screen.findByRole("table");
      await userEvent.click(within(table()).getByRole("button", { name: /^View/ }));

      const form = within(dialog());
      expect(form.getByText("This action was cancelled, so it is read-only.")).toBeInTheDocument();
      expect(form.getByLabelText(/^Description/)).toHaveAttribute("readonly");
      expect(form.getByLabelText("Assignee")).toBeDisabled();
      expect(form.getByLabelText("Follow-up required")).toBeDisabled();
      expect(form.queryByLabelText("Mark completed")).not.toBeInTheDocument();
      expect(form.queryByRole("button", { name: /save|create|complete action/i })).not.toBeInTheDocument();
      expect(form.getAllByRole("button", { name: "Close" })).toHaveLength(2); // the header X and the footer button
    });

    it("a Completed action allows content edits but its status and assignee are read-only; save sends neither", async () => {
      const update = vi.spyOn(actionsApi, "updateAction").mockResolvedValue({ ...COMPLETED, result: "Cabling replaced", version: 1 });
      renderSection();
      await screen.findByRole("table");
      const completedRow = within(table()).getAllByRole("row")[2];
      await userEvent.click(within(completedRow).getByRole("button", { name: /^Edit/ }));

      const form = within(dialog());
      expect(form.getByLabelText("Assignee")).toBeDisabled();
      expect(form.queryByLabelText("Mark completed")).not.toBeInTheDocument();
      expect(form.getByText("Completed")).toBeInTheDocument(); // status shown as text, not a control
      expect(form.getByText("Performed by").nextElementSibling).toHaveTextContent("Priya Natarajan"); // display only
      expect(form.getByText("Created by").nextElementSibling).toHaveTextContent("Priya Natarajan");

      const result = form.getByLabelText(/^Result/);
      await userEvent.clear(result);
      await userEvent.type(result, "Cabling replaced");
      await userEvent.click(form.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      const [ticketId, actionId, body] = update.mock.calls[0];
      expect([ticketId, actionId]).toEqual([42, 2]);
      expect(body).toMatchObject({ version: 0, result: "Cabling replaced" });
      expect(body).not.toHaveProperty("status");
      expect(body).not.toHaveProperty("assigneeId");
      expect(body).not.toHaveProperty("actionDateTime"); // untouched, so not resent
    });

    it("a Planned action is fully editable and Complete opens it with the completion box ticked and Result required", async () => {
      const update = vi.spyOn(actionsApi, "updateAction").mockResolvedValue({ ...PLANNED, status: "COMPLETED", result: "Done", performedBy: PRIYA, version: 1 });
      renderSection();
      await screen.findByRole("table");
      await userEvent.click(within(within(table()).getAllByRole("row")[1]).getByRole("button", { name: /^Complete/ }));

      const form = within(dialog());
      expect(form.getByLabelText("Mark completed")).toBeChecked();
      expect(form.getByText(/Completing records you as Performed By/)).toBeInTheDocument();
      await userEvent.click(form.getByRole("button", { name: "Complete action" }));
      expect(form.getByText("Result is required to complete an action.")).toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();

      await userEvent.type(form.getByLabelText(/^Result/), "Done");
      await userEvent.click(form.getByRole("button", { name: "Complete action" }));
      await waitFor(() => expect(update).toHaveBeenCalledWith(42, 1, expect.objectContaining({ version: 0, status: "COMPLETED", result: "Done" })));
      expect(await screen.findByText("Action saved.")).toBeInTheDocument();
    });

    it("reassigning a Planned action sends the new assignee", async () => {
      const update = vi.spyOn(actionsApi, "updateAction").mockResolvedValue({ ...PLANNED, assignee: PRIYA, version: 1 });
      renderSection();
      await screen.findByRole("table");
      await userEvent.click(within(within(table()).getAllByRole("row")[1]).getByRole("button", { name: /^Edit/ }));
      const form = within(dialog());
      await userEvent.selectOptions(form.getByLabelText("Assignee"), "2");
      await userEvent.click(form.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(update).toHaveBeenCalledWith(42, 1, expect.objectContaining({ assigneeId: 2 })));
    });
  });

  describe("cancel (confirmation)", () => {
    it("asks for confirmation, then cancels with the version it last read", async () => {
      const update = vi.spyOn(actionsApi, "updateAction").mockResolvedValue({ ...PLANNED, status: "CANCELLED", version: 1 });
      renderSection();
      await screen.findByRole("table");
      await userEvent.click(within(within(table()).getAllByRole("row")[1]).getByRole("button", { name: /^Cancel/ }));

      const confirm = within(dialog());
      expect(confirm.getByText(/will be marked Cancelled and can no longer be changed/)).toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();

      await userEvent.click(confirm.getByRole("button", { name: "Cancel action" }));
      await waitFor(() => expect(update).toHaveBeenCalledWith(42, 1, { version: 0, status: "CANCELLED" }));
      expect(await screen.findByText("Action cancelled.")).toBeInTheDocument();
    });

    it("declining the confirmation changes nothing", async () => {
      const update = vi.spyOn(actionsApi, "updateAction");
      renderSection();
      await screen.findByRole("table");
      await userEvent.click(within(within(table()).getAllByRole("row")[1]).getByRole("button", { name: /^Cancel/ }));
      await userEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
      expect(update).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("a stale cancel explains itself inside the dialog", async () => {
      vi.spyOn(actionsApi, "updateAction").mockRejectedValue(new ApiError(409, "This action was changed by someone else", { code: "STALE_VERSION", currentVersion: 3 }));
      renderSection();
      await screen.findByRole("table");
      await userEvent.click(within(within(table()).getAllByRole("row")[1]).getByRole("button", { name: /^Cancel/ }));
      await userEvent.click(within(dialog()).getByRole("button", { name: "Cancel action" }));
      expect(await within(dialog()).findByText(/changed by someone else/)).toBeInTheDocument();
    });
  });

  describe("stale update (UI-06)", () => {
    it("shows 'changed by someone else' with Reload, keeps the typed data, and the next save uses the new version", async () => {
      const update = vi
        .spyOn(actionsApi, "updateAction")
        .mockRejectedValueOnce(new ApiError(409, "This action was changed by someone else", { code: "STALE_VERSION", currentVersion: 4 }))
        .mockResolvedValueOnce({ ...PLANNED, description: "My edit", version: 5 });
      const list = vi.spyOn(actionsApi, "listActions").mockResolvedValue([PLANNED, COMPLETED, CANCELLED]);
      renderSection();
      await screen.findByRole("table");
      await userEvent.click(within(within(table()).getAllByRole("row")[1]).getByRole("button", { name: /^Edit/ }));
      const form = within(dialog());
      const description = form.getByLabelText(/^Description/);
      await userEvent.clear(description);
      await userEvent.type(description, "My edit");

      await userEvent.click(form.getByRole("button", { name: "Save changes" }));
      expect(await form.findByText("This action was changed by someone else.")).toBeInTheDocument();
      expect(form.getByLabelText(/^Description/)).toHaveValue("My edit");

      list.mockResolvedValue([{ ...PLANNED, version: 4, description: "Their edit" }, COMPLETED, CANCELLED]);
      await userEvent.click(form.getByRole("button", { name: "Reload" }));
      expect(await form.findByText(/Loaded the latest version/)).toBeInTheDocument();
      expect(form.getByLabelText(/^Description/)).toHaveValue("My edit"); // still the user's text

      await userEvent.click(form.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
      expect(update.mock.calls[1][2]).toMatchObject({ version: 4, description: "My edit" });
    });
  });

  describe("Requester view (UI-05, BR-04)", () => {
    it("shows every action with every field and offers no controls", async () => {
      renderSection({ mode: "requester" });
      await within(await screen.findByRole("table")).findByText("Checked the cabling");

      const completed = within(within(table()).getAllByRole("row")[2]);
      for (const text of ["Cabling is fine", "Look again next week", "Photo on the ticket", "Completed"]) {
        expect(completed.getByText(text)).toBeInTheDocument();
      }
      expect(within(table()).queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows the same empty message", async () => {
      vi.spyOn(actionsApi, "listActions").mockResolvedValue([]);
      renderSection({ mode: "requester" });
      expect(await screen.findByText("No actions have been recorded for this ticket yet.")).toBeInTheDocument();
    });
  });
});
