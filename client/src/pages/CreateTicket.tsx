import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createTicket } from "../api/tickets.js";
import { uploadAttachment } from "../api/attachments.js";
import { ApiError } from "../api/client.js";
import type { Priority, TicketDetail } from "../api/types.js";
import { TicketForm, type PendingFile, type TicketFormValues } from "../components/tickets/TicketForm.js";
import { Alert } from "../components/ui/Alert.js";

type SubmitState = "idle" | "submitting" | "success" | "error";

const EMPTY_VALUES: TicketFormValues = {
  categoryId: "",
  relatedSystemId: "",
  summary: "",
  description: "",
  requestedPriority: "",
};

function validate(values: TicketFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.categoryId) errors.categoryId = "Category is required.";
  if (!values.relatedSystemId) errors.relatedSystemId = "Related System is required.";
  if (!values.requestedPriority) errors.requestedPriority = "Requested Priority is required.";

  const summary = values.summary.trim();
  if (summary.length < 5 || summary.length > 150) {
    errors.summary = "Summary must be between 5 and 150 characters.";
  }
  const description = values.description.trim();
  if (description.length < 10 || description.length > 4000) {
    errors.description = "Description must be between 10 and 4000 characters.";
  }
  return errors;
}

function canSubmit(values: TicketFormValues, files: PendingFile[]): boolean {
  return (
    !!values.categoryId &&
    !!values.relatedSystemId &&
    !!values.requestedPriority &&
    values.summary.trim().length > 0 &&
    values.description.trim().length > 0 &&
    !files.some((f) => f.error)
  );
}

export default function CreateTicket() {
  const [values, setValues] = useState<TicketFormValues>(EMPTY_VALUES);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [createdTicket, setCreatedTicket] = useState<TicketDetail | null>(null);
  const [failedUploads, setFailedUploads] = useState<string[]>([]);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setState("submitting");
    setErrorMessage("");

    try {
      const ticket = await createTicket({
        categoryId: Number(values.categoryId),
        relatedSystemId: Number(values.relatedSystemId),
        summary: values.summary.trim(),
        description: values.description.trim(),
        requestedPriority: values.requestedPriority as Priority,
      });

      // Two-phase create (see specification.md BR-18): the ticket is never
      // rolled back because an attachment failed. Uploads run sequentially
      // and every failure is surfaced by filename so the requester can
      // retry from the ticket detail page.
      const failed: string[] = [];
      for (const pending of files) {
        try {
          await uploadAttachment(ticket.id, pending.file);
        } catch {
          failed.push(pending.file.name);
        }
      }

      setCreatedTicket(ticket);
      setFailedUploads(failed);
      setState("success");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to reach the server. Please try again.";
      setErrorMessage(message);
      setState("error");
    }
  }

  function resetForm() {
    setValues(EMPTY_VALUES);
    setFiles([]);
    setFieldErrors({});
    setCreatedTicket(null);
    setFailedUploads([]);
    setState("idle");
  }

  if (state === "success" && createdTicket) {
    return (
      <div className="tk-surface p-4">
        <Alert variant="success">
          Ticket <strong>{createdTicket.ticketNumber}</strong> created successfully.
        </Alert>
        {failedUploads.length > 0 && (
          <Alert variant="warning">
            {failedUploads.length} file(s) could not be uploaded: {failedUploads.join(", ")}. You can add
            them again from the ticket detail page.
          </Alert>
        )}
        <div className="d-flex gap-2 mt-3">
          <button type="button" className="btn btn-primary" onClick={() => navigate("/tickets")}>
            Back to My Tickets
          </button>
          <button type="button" className="btn btn-outline-primary" onClick={resetForm}>
            Create Another Ticket
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="tk-surface p-4" onSubmit={handleSubmit} noValidate>
      <h1 className="h4 mb-4">Create Ticket</h1>

      {state === "error" && (
        <Alert variant="error">{errorMessage}</Alert>
      )}

      <TicketForm
        values={values}
        onChange={setValues}
        files={files}
        onFilesChange={setFiles}
        fieldErrors={fieldErrors}
        disabled={state === "submitting"}
      />

      <button
        type="submit"
        className="btn btn-primary"
        disabled={state === "submitting" || !canSubmit(values, files)}
      >
        {state === "submitting" ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
            Saving…
          </>
        ) : (
          "Submit Ticket"
        )}
      </button>
    </form>
  );
}
