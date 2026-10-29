import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client.js";
import { createAction, updateAction, type ActionTaken, type CreateActionBody, type UpdateActionBody } from "../../api/actions.js";
import type { StaffAssignee } from "../../api/staff.js";
import { Modal } from "../ui/Modal.js";
import { FormField } from "../ui/FormField.js";
import { Alert } from "../ui/Alert.js";
import { ActionStatusBadge } from "./ActionStatusBadge.js";

// Same limits as the server (docs/lab-04/specification.md BR-07); the server stays the authority.
const LIMITS = { description: 2000, result: 2000, followUpNote: 1000, attachmentNotes: 500 };

type FieldName = "description" | "actionDateTime" | "assigneeId" | "result" | "followUpNote" | "attachmentNotes";
type FieldErrors = Partial<Record<FieldName, string>>;
const FIELD_NAMES: FieldName[] = ["description", "actionDateTime", "assigneeId", "result", "followUpNote", "attachmentNotes"];

// <input type="datetime-local"> works in local time without a zone.
function toLocalInput(value: Date): string {
  const shifted = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

// crypto.randomUUID needs a secure context in browsers; the fallback keeps the id's UUID shape.
function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

interface ActionFormModalProps {
  ticketId: number;
  // null = create mode; otherwise view/edit mode for that action.
  action: ActionTaken | null;
  assignees: StaffAssignee[];
  // Opened from the "Complete" row button: the completion box starts ticked.
  startCompleted?: boolean;
  onClose: () => void;
  onSaved: (action: ActionTaken, created: boolean) => void;
  // Fetches the newest copy of this action after a stale-version conflict.
  onReload: (actionId: number) => Promise<ActionTaken | null>;
}

// ui-spec.md §4: create/edit modal on the shared Modal. Validation messages sit directly below each
// field, what was typed survives any recoverable failure, and Submit is disabled only while a request is
// in flight (never because the form is invalid, so the messages can actually be reached by a click).
export function ActionFormModal({ ticketId, action, assignees, startCompleted, onClose, onSaved, onReload }: ActionFormModalProps) {
  const isCreate = action === null;
  const isCancelled = action?.status === "CANCELLED";
  const isCompleted = action?.status === "COMPLETED";
  const contentLocked = isCancelled;
  const assigneeLocked = isCompleted || isCancelled;
  const canComplete = !isCancelled && !isCompleted;

  const initialDateTime = toLocalInput(action ? new Date(action.actionDateTime) : new Date());
  const [description, setDescription] = useState(action?.description ?? "");
  const [actionDateTime, setActionDateTime] = useState(initialDateTime);
  const [assigneeId, setAssigneeId] = useState(action ? String(action.assignee.id) : "");
  const [complete, setComplete] = useState(Boolean(startCompleted) && canComplete);
  const [result, setResult] = useState(action?.result ?? "");
  const [followUpRequired, setFollowUpRequired] = useState(action?.followUpRequired ?? false);
  const [followUpNote, setFollowUpNote] = useState(action?.followUpNote ?? "");
  const [attachmentNotes, setAttachmentNotes] = useState(action?.attachmentNotes ?? "");

  const [version, setVersion] = useState(action?.version ?? 0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const savingRef = useRef(false);
  const requestId = useRef(newRequestId());

  const willBeCompleted = complete || isCompleted;

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    const desc = description.trim();
    if (!desc) found.description = "Description is required.";
    else if (desc.length > LIMITS.description) found.description = `Description must be at most ${LIMITS.description} characters.`;

    if (!actionDateTime || Number.isNaN(new Date(actionDateTime).getTime())) found.actionDateTime = "Action date and time is required.";

    const res = result.trim();
    if (willBeCompleted && !res) found.result = "Result is required to complete an action.";
    else if (res.length > LIMITS.result) found.result = `Result must be at most ${LIMITS.result} characters.`;

    if (followUpRequired) {
      const note = followUpNote.trim();
      if (!note) found.followUpNote = "Follow-up note is required when follow-up is required.";
      else if (note.length > LIMITS.followUpNote) found.followUpNote = `Follow-up note must be at most ${LIMITS.followUpNote} characters.`;
    }

    if (attachmentNotes.trim().length > LIMITS.attachmentNotes) {
      found.attachmentNotes = `Attachment notes must be at most ${LIMITS.attachmentNotes} characters.`;
    }
    return found;
  }

  // Maps a failed request onto the field it belongs to, or a message at the top. Never a raw code,
  // and nothing the user typed is cleared.
  function showFailure(err: unknown) {
    if (!(err instanceof ApiError)) {
      setFormError("Unable to save this action. Your entries are kept — please try again.");
      return;
    }
    const body = (err.body ?? {}) as { code?: string; details?: { field: string; message: string }[] };

    if (err.status === 400 && body.details?.length) {
      const mapped: FieldErrors = {};
      for (const detail of body.details) {
        if ((FIELD_NAMES as string[]).includes(detail.field)) mapped[detail.field as FieldName] = detail.message;
      }
      if (Object.keys(mapped).length > 0) {
        setErrors(mapped);
        return;
      }
    }
    if (err.status === 422) {
      setErrors({ assigneeId: "Choose an active IT Staff member or Administrator." });
      return;
    }
    if (err.status === 409 && body.code === "STALE_VERSION") {
      setStale(true);
      return;
    }
    if (err.status === 409 && body.code === "INVALID_ACTION_STATE") {
      setFormError("This action can no longer be changed that way. Reload the ticket to see its current state.");
      return;
    }
    if (err.status === 409 && body.code === "TICKET_NOT_ACTIONABLE") {
      setFormError(err.message);
      return;
    }
    setFormError("Unable to save this action. Your entries are kept — please try again.");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current || contentLocked) return; // a second click while a request is in flight is ignored

    const found = validate();
    setErrors(found);
    setFormError("");
    setNotice("");
    setStale(false);
    if (Object.keys(found).length > 0) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const resultValue = result.trim() || null;
      const noteValue = followUpRequired ? followUpNote.trim() : null;
      const attachmentValue = attachmentNotes.trim() || null;
      const dateChanged = actionDateTime !== initialDateTime;

      if (isCreate) {
        const body: CreateActionBody = {
          description: description.trim(),
          actionDateTime: new Date(actionDateTime).toISOString(),
          ...(assigneeId ? { assigneeId: Number(assigneeId) } : {}),
          status: complete ? "COMPLETED" : "PLANNED",
          result: resultValue,
          followUpRequired,
          followUpNote: noteValue,
          attachmentNotes: attachmentValue,
          clientRequestId: requestId.current,
        };
        onSaved(await createAction(ticketId, body), true);
      } else {
        const body: UpdateActionBody = {
          version,
          description: description.trim(),
          result: resultValue,
          followUpRequired,
          followUpNote: noteValue,
          attachmentNotes: attachmentValue,
          ...(dateChanged ? { actionDateTime: new Date(actionDateTime).toISOString() } : {}),
          ...(!assigneeLocked && assigneeId && Number(assigneeId) !== action!.assignee.id ? { assigneeId: Number(assigneeId) } : {}),
          ...(complete && canComplete ? { status: "COMPLETED" as const } : {}),
        };
        onSaved(await updateAction(ticketId, action!.id, body), false);
      }
    } catch (err) {
      showFailure(err);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleReload() {
    if (!action) return;
    setReloading(true);
    try {
      const latest = await onReload(action.id);
      if (latest) {
        setVersion(latest.version);
        setStale(false);
        setNotice("Loaded the latest version. Your entries were kept — review them and save again.");
      } else {
        setFormError("Unable to reload this action. Close this window and open the ticket again.");
      }
    } finally {
      setReloading(false);
    }
  }

  const title = isCreate ? "Add Action Taken" : isCancelled ? "Action Taken (cancelled)" : "Edit Action Taken";
  const assigneeOptions = [...assignees];
  if (action && !assigneeOptions.some((a) => a.id === action.assignee.id)) {
    assigneeOptions.unshift({ id: action.assignee.id, fullName: action.assignee.fullName, role: "IT_STAFF" });
  }

  return (
    <Modal title={title} onClose={onClose} closeDisabled={saving}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          {isCancelled && <Alert variant="info">This action was cancelled, so it is read-only.</Alert>}
          {formError && <Alert variant="error">{formError}</Alert>}
          {stale && (
            <Alert variant="error">
              <div>This action was changed by someone else.</div>
              <button type="button" className="btn btn-sm btn-outline-danger mt-2" disabled={reloading} onClick={handleReload}>
                {reloading ? "Reloading…" : "Reload"}
              </button>
            </Alert>
          )}
          {notice && !stale && <Alert variant="info">{notice}</Alert>}

          <FormField id="action-description" label="Description" required error={errors.description}>
            <textarea
              id="action-description"
              className="form-control"
              rows={3}
              value={description}
              readOnly={contentLocked}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          <FormField id="action-datetime" label="Action date and time" required error={errors.actionDateTime}>
            <input
              id="action-datetime"
              type="datetime-local"
              className="form-control"
              value={actionDateTime}
              readOnly={contentLocked}
              onChange={(e) => setActionDateTime(e.target.value)}
            />
          </FormField>

          <FormField id="action-assignee" label="Assignee" error={errors.assigneeId}>
            <select
              id="action-assignee"
              className="form-select"
              value={assigneeId}
              disabled={assigneeLocked}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              {isCreate && <option value="">Me (default)</option>}
              {assigneeOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </FormField>

          <div className="mb-3">
            <div className="form-label fw-semibold">Status</div>
            <div className="tk-field-readonly rounded px-2 py-1 d-inline-block">
              <ActionStatusBadge status={isCreate ? (complete ? "COMPLETED" : "PLANNED") : action!.status} />
            </div>
            {canComplete && (
              <div className="form-check mt-2">
                <input
                  id="action-complete"
                  type="checkbox"
                  className="form-check-input"
                  checked={complete}
                  onChange={(e) => setComplete(e.target.checked)}
                />
                <label htmlFor="action-complete" className="form-check-label">
                  Mark completed
                </label>
              </div>
            )}
            {complete && canComplete && (
              <div className="small text-secondary mt-1">
                Completing records you as Performed By, requires a result, and the assignee can no longer be changed.
              </div>
            )}
          </div>

          <FormField id="action-result" label={willBeCompleted ? "Result" : "Result (required when completing)"} required={willBeCompleted} error={errors.result}>
            <textarea
              id="action-result"
              className="form-control"
              rows={2}
              value={result}
              readOnly={contentLocked}
              onChange={(e) => setResult(e.target.value)}
            />
          </FormField>

          <div className="form-check mb-3">
            <input
              id="action-followup"
              type="checkbox"
              className="form-check-input"
              checked={followUpRequired}
              disabled={contentLocked}
              onChange={(e) => setFollowUpRequired(e.target.checked)}
            />
            <label htmlFor="action-followup" className="form-check-label">
              Follow-up required
            </label>
          </div>

          {followUpRequired && (
            <FormField id="action-followup-note" label="Follow-up note" required error={errors.followUpNote}>
              <textarea
                id="action-followup-note"
                className="form-control"
                rows={2}
                value={followUpNote}
                readOnly={contentLocked}
                onChange={(e) => setFollowUpNote(e.target.value)}
              />
            </FormField>
          )}

          <FormField
            id="action-attachment-notes"
            label="Attachment notes"
            help="Say which file on the ticket to look at. Files themselves stay under Attachments."
            error={errors.attachmentNotes}
          >
            <textarea
              id="action-attachment-notes"
              className="form-control"
              rows={2}
              value={attachmentNotes}
              readOnly={contentLocked}
              onChange={(e) => setAttachmentNotes(e.target.value)}
            />
          </FormField>

          {!isCreate && (
            <dl className="row small text-secondary mb-0">
              <dt className="col-5">Created by</dt>
              <dd className="col-7">{action!.createdBy.fullName}</dd>
              <dt className="col-5">Performed by</dt>
              <dd className="col-7 mb-0">{action!.performedBy?.fullName ?? "Not performed yet"}</dd>
            </dl>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
            {contentLocked ? "Close" : "Cancel"}
          </button>
          {!contentLocked && (
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : complete && canComplete ? "Complete action" : isCreate ? "Create action" : "Save changes"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
