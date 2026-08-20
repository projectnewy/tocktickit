import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTicket } from "../api/tickets.js";
import type { TicketDetail } from "../api/types.js";
import { AttachmentSection } from "../components/attachments/AttachmentSection.js";
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
      <div
        className="tk-field-readonly rounded px-2 py-1"
        style={multiline ? { whiteSpace: "pre-wrap" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

export default function RequesterTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [state, setState] = useState<LoadState>("loading");
  const [ticket, setTicket] = useState<TicketDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = Number(ticketId);
    if (!Number.isInteger(id) || id <= 0) {
      setState("error");
      return;
    }

    setState("loading");
    getTicket(id)
      .then((data) => {
        if (cancelled) return;
        setTicket(data);
        setState("success");
      })
      .catch(() => {
        // Deliberately generic: whether the ticket doesn't exist or belongs
        // to a different requester, the API (and this screen) give the same
        // safe message — see specification.md §11.
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (state === "loading") return <Spinner label="Loading ticket…" />;

  if (state === "error" || !ticket) {
    return <Alert variant="error">Ticket not found.</Alert>;
  }

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
          <ReadOnlyField label="IT Priority" value={ticket.itPriority ?? "—"} />
          <ReadOnlyField label="Ticket Owner" value={ticket.ticketOwner?.fullName ?? "Unassigned"} />
          <ReadOnlyField label="Summary" value={ticket.summary} full />
          <ReadOnlyField label="Description" value={ticket.description} full multiline />
        </div>
      </div>

      <AttachmentSection
        ticketId={ticket.id}
        attachments={ticket.attachments}
        onAttachmentsChange={(attachments) => setTicket({ ...ticket, attachments })}
      />
    </div>
  );
}
