import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { getStaffTicket, claimTicket, setTicketPriority, setTicketStatus } from "../api/staff.js";
import { ApiError } from "../api/client.js";
import type { Priority, TicketDetail, TicketStatus } from "../api/types.js";
import { PRIORITY_OPTIONS } from "../config.js";
import { STATUS_TRANSITIONS } from "../config/statusTransitions.js";
import { StaffAttachmentsList } from "../components/staff/StaffAttachmentsList.js";
import { CommentsSection } from "../components/comments/CommentsSection.js";
import { InternalNotesSection } from "../components/notes/InternalNotesSection.js";
import { StatusBadge } from "../components/ui/StatusBadge.js";
import { PriorityBadge } from "../components/ui/PriorityBadge.js";
import { Alert } from "../components/ui/Alert.js";
import { Spinner } from "../components/ui/Spinner.js";

type LoadState = "loading" | "success" | "error";

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  full?: boolean;
  multiline?: boolean;
}

function ReadOnlyField({ label, value, full, multiline }: ReadOnlyFieldProps) {
  return (
    <div className={full ? "col-12" : "col-12 col-md-6"}>
      <div className="form-label fw-semibold mb-1">{label}</div>
      <div className="tk-field-readonly rounded px-2 py-1" style={multiline ? { whiteSpace: "pre-wrap" } : undefined}>
        {value}
      </div>
    </div>
  );
}

// ui-spec.md §4: extends Lab 2's read-only ticket-info block with
// Owner/Claim-Reassign, IT Priority, and Status controls, plus Public
// Comments and Internal Notes sections below Attachments.
export default function StaffTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>("loading");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [actionError, setActionError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = Number(ticketId);
    if (!Number.isInteger(id) || id <= 0) {
      setState("error");
      return;
    }

    setState("loading");
    getStaffTicket(id)
      .then((data) => {
        if (cancelled) return;
        setTicket(data);
        setState("success");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (state === "loading") return <Spinner label="Loading ticket…" />;
  if (state === "error" || !ticket) return <Alert variant="error">Ticket not found.</Alert>;

  const isOwnedByMe = ticket.ticketOwner?.id === user?.id;

  async function handleClaim() {
    setActionError("");
    setClaiming(true);
    try {
      const updated = await claimTicket(ticket!.id);
      setTicket(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Unable to update ownership. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  async function handlePriorityChange(itPriority: string) {
    setActionError("");
    setSavingPriority(true);
    try {
      const updated = await setTicketPriority(ticket!.id, itPriority as Priority);
      setTicket(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Unable to update IT Priority. Please try again.");
    } finally {
      setSavingPriority(false);
    }
  }

  async function handleStatusChange(status: string) {
    setActionError("");
    setSavingStatus(true);
    try {
      const updated = await setTicketStatus(ticket!.id, status as TicketStatus);
      setTicket(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Unable to update status. Please try again.");
    } finally {
      setSavingStatus(false);
    }
  }

  const statusOptions = STATUS_TRANSITIONS[ticket.status];

  return (
    <div className="d-flex flex-column gap-3">
      <div className="tk-surface p-3">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
          <h1 className="h4 mb-0">{ticket.ticketNumber}</h1>
          <div className="d-flex gap-2">
            <PriorityBadge priority={ticket.requestedPriority} />
            <StatusBadge status={ticket.status} />
          </div>
        </div>

        <div className="row g-3">
          <ReadOnlyField label="Ticket Date" value={new Date(ticket.ticketDate).toLocaleString()} />
          <ReadOnlyField label="Category" value={ticket.category.name} />
          <ReadOnlyField label="Related System" value={ticket.relatedSystem.name} />
          <ReadOnlyField label="Requester" value={ticket.requester.fullName} />

          <div className="col-12 col-md-6">
            <div className="form-label fw-semibold mb-1">Owner</div>
            <div className="d-flex align-items-center gap-2">
              <span>{ticket.ticketOwner?.fullName ?? "Unassigned"}</span>
              {!isOwnedByMe && (
                <button type="button" className="btn btn-sm btn-outline-primary" disabled={claiming} onClick={handleClaim}>
                  {claiming ? "Saving…" : ticket.ticketOwner ? "Reassign to Me" : "Claim"}
                </button>
              )}
            </div>
          </div>

          <div className="col-12 col-md-6">
            <label htmlFor="it-priority" className="form-label fw-semibold mb-1">
              IT Priority
            </label>
            <select
              id="it-priority"
              className="form-select"
              value={ticket.itPriority ?? ""}
              disabled={savingPriority}
              onChange={(e) => handlePriorityChange(e.target.value)}
            >
              {!ticket.itPriority && (
                <option value="" disabled>
                  Not set
                </option>
              )}
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6">
            <label htmlFor="ticket-status" className="form-label fw-semibold mb-1">
              Status
            </label>
            <select
              id="ticket-status"
              className="form-select"
              value=""
              disabled={savingStatus || statusOptions.length === 0}
              onChange={(e) => {
                if (e.target.value) handleStatusChange(e.target.value);
              }}
            >
              <option value="">
                {statusOptions.length === 0 ? "No further transitions" : "Change status…"}
              </option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <ReadOnlyField label="Summary" value={ticket.summary} full />
          <ReadOnlyField label="Description" value={ticket.description} full multiline />
        </div>

        {actionError && (
          <div className="mt-3">
            <Alert variant="error">{actionError}</Alert>
          </div>
        )}

        {ticket.resolutionIndicated && (
          <div className="mt-3">
            <span className="badge text-bg-success">Requester marked this problem as appearing resolved</span>
          </div>
        )}
      </div>

      <StaffAttachmentsList attachments={ticket.attachments} />

      <CommentsSection ticketId={ticket.id} />

      <InternalNotesSection ticketId={ticket.id} />
    </div>
  );
}
