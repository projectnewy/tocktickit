import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client.js";
import { listActions, updateAction, type ActionTaken } from "../../api/actions.js";
import type { StaffAssignee } from "../../api/staff.js";
import type { TicketStatus } from "../../api/types.js";
import { Alert } from "../ui/Alert.js";
import { ConfirmDialog } from "../ui/ConfirmDialog.js";
import { Spinner } from "../ui/Spinner.js";
import { ActionStatusBadge } from "./ActionStatusBadge.js";
import { ActionFormModal } from "./ActionFormModal.js";

// BR-05: actions are added or changed only while the Ticket is being worked.
const ACTIONABLE: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

interface ActionsTakenSectionProps {
  ticketId: number;
  ticketStatus: TicketStatus;
  // Changes whenever the Ticket row changes (e.g. cancelling a Ticket cancels its Planned actions), so the
  // list is fetched again.
  ticketVersion: number;
  // "staff" can add and edit; "requester" sees the same list read-only (BR-04).
  mode: "staff" | "requester";
  assignees?: StaffAssignee[];
}

const when = (iso: string) => new Date(iso).toLocaleString();

function FollowUp({ action }: { action: ActionTaken }) {
  if (!action.followUpRequired) return <>No</>;
  return (
    <>
      <div>Yes</div>
      {action.followUpNote && <div className="small text-secondary">{action.followUpNote}</div>}
    </>
  );
}

// ui-spec.md §4: Actions Taken on Ticket Detail — a table on desktop, one card per action below 992px,
// ordered by date (the server sorts, BR-12). Staff add and edit through the shared modal; a Requester
// sees every field and no controls.
export function ActionsTakenSection({ ticketId, ticketStatus, ticketVersion, mode, assignees = [] }: ActionsTakenSectionProps) {
  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<{ action: ActionTaken | null; startCompleted: boolean } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ActionTaken | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const isStaff = mode === "staff";
  const actionable = ACTIONABLE.includes(ticketStatus);

  const load = useCallback(async () => {
    setState("loading");
    try {
      setActions(await listActions(ticketId));
      setState("success");
    } catch {
      setState("error");
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load, ticketVersion]);

  async function reloadOne(actionId: number): Promise<ActionTaken | null> {
    try {
      const latest = await listActions(ticketId);
      setActions(latest);
      return latest.find((a) => a.id === actionId) ?? null;
    } catch {
      return null;
    }
  }

  function handleSaved(saved: ActionTaken, created: boolean) {
    setActions((current) => {
      const next = created ? [...current, saved] : current.map((a) => (a.id === saved.id ? saved : a));
      return next.sort((a, b) => a.actionDateTime.localeCompare(b.actionDateTime) || a.id - b.id);
    });
    setEditing(null);
    setSuccess(created ? "Action added." : saved.status === "COMPLETED" ? "Action saved." : "Action updated.");
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const saved = await updateAction(ticketId, cancelTarget.id, { version: cancelTarget.version, status: "CANCELLED" });
      setActions((current) => current.map((a) => (a.id === saved.id ? saved : a)));
      setCancelTarget(null);
      setSuccess("Action cancelled.");
    } catch (err) {
      const code = err instanceof ApiError ? ((err.body ?? {}) as { code?: string }).code : undefined;
      setCancelError(
        code === "STALE_VERSION"
          ? "This action was changed by someone else. Close this window, reload the list and try again."
          : code === "TICKET_NOT_ACTIONABLE" && err instanceof ApiError
            ? err.message
            : "Unable to cancel this action. Please try again."
      );
    } finally {
      setCancelling(false);
    }
  }

  // A plain function (not a nested component) so the buttons keep keyboard focus across re-renders.
  function rowButtons(action: ActionTaken) {
    const open = action.status === "PLANNED";
    return (
      <div className="d-flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          disabled={!actionable && action.status !== "CANCELLED"}
          onClick={() => setEditing({ action, startCompleted: false })}
        >
          {action.status === "CANCELLED" ? "View" : "Edit"}
          <span className="visually-hidden"> action: {action.description}</span>
        </button>
        {open && (
          <>
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              disabled={!actionable}
              onClick={() => setEditing({ action, startCompleted: true })}
            >
              Complete<span className="visually-hidden"> action: {action.description}</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              disabled={!actionable}
              onClick={() => {
                setCancelError("");
                setCancelTarget(action);
              }}
            >
              Cancel<span className="visually-hidden"> action: {action.description}</span>
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="tk-surface p-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h2 className="h5 mb-0">Actions Taken</h2>
        {isStaff && (
          <button type="button" className="btn btn-primary" disabled={!actionable} onClick={() => setEditing({ action: null, startCompleted: false })}>
            Add Action
          </button>
        )}
      </div>

      {isStaff && !actionable && (
        <p className="small text-secondary">
          Actions can be added or changed only while the ticket is Open, In Progress, Waiting for Requester or Reopened.
        </p>
      )}

      {success && (
        <div className="mb-3">
          <Alert variant="success">{success}</Alert>
        </div>
      )}

      {state === "loading" && <Spinner label="Loading actions…" />}

      {state === "error" && (
        <Alert variant="error">
          <div>Unable to load the actions for this ticket.</div>
          <button type="button" className="btn btn-sm btn-outline-danger mt-2" onClick={() => void load()}>
            Retry
          </button>
        </Alert>
      )}

      {state === "success" && actions.length === 0 && <p className="text-secondary mb-0">No actions have been recorded for this ticket yet.</p>}

      {state === "success" && actions.length > 0 && (
        <>
          <div className="table-responsive d-none d-lg-block">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th scope="col">Date/Time</th>
                  <th scope="col">Description</th>
                  <th scope="col">Result</th>
                  <th scope="col">Assignee</th>
                  <th scope="col">Performed By</th>
                  <th scope="col">Status</th>
                  <th scope="col">Follow-Up</th>
                  <th scope="col">Attachment Notes</th>
                  {isStaff && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td>{when(a.actionDateTime)}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{a.description}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{a.result ?? "—"}</td>
                    <td>{a.assignee.fullName}</td>
                    <td>{a.performedBy?.fullName ?? "—"}</td>
                    <td>
                      <ActionStatusBadge status={a.status} />
                    </td>
                    <td>
                      <FollowUp action={a} />
                    </td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{a.attachmentNotes ?? "—"}</td>
                    {isStaff && (
                      <td>{rowButtons(a)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="list-unstyled d-lg-none mb-0" data-testid="action-cards">
            {actions.map((a) => (
              <li key={a.id} className="border rounded p-3 mb-2">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <span className="small text-secondary">{when(a.actionDateTime)}</span>
                  <ActionStatusBadge status={a.status} />
                </div>
                <div className="fw-semibold mb-2" style={{ whiteSpace: "pre-wrap" }}>
                  {a.description}
                </div>
                <dl className="row small mb-2">
                  <dt className="col-5">Result</dt>
                  <dd className="col-7" style={{ whiteSpace: "pre-wrap" }}>
                    {a.result ?? "—"}
                  </dd>
                  <dt className="col-5">Assignee</dt>
                  <dd className="col-7">{a.assignee.fullName}</dd>
                  <dt className="col-5">Performed By</dt>
                  <dd className="col-7">{a.performedBy?.fullName ?? "—"}</dd>
                  <dt className="col-5">Follow-Up</dt>
                  <dd className="col-7">
                    <FollowUp action={a} />
                  </dd>
                  <dt className="col-5">Attachment Notes</dt>
                  <dd className="col-7 mb-0" style={{ whiteSpace: "pre-wrap" }}>
                    {a.attachmentNotes ?? "—"}
                  </dd>
                </dl>
                {isStaff && rowButtons(a)}
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <ActionFormModal
          ticketId={ticketId}
          action={editing.action}
          assignees={assignees}
          startCompleted={editing.startCompleted}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onReload={reloadOne}
        />
      )}

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this action?"
          confirmLabel={cancelling ? "Cancelling…" : "Cancel action"}
          confirmDisabled={cancelling}
          onCancel={() => setCancelTarget(null)}
          onConfirm={() => void confirmCancel()}
        >
          {cancelError && <Alert variant="error">{cancelError}</Alert>}
          <p className="mb-0">
            “{cancelTarget.description}” will be marked Cancelled and can no longer be changed. Cancelled actions stay on the ticket for the record.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
