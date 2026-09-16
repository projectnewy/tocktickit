import { useEffect, useState, type FormEvent } from "react";
import type { Comment } from "../../api/types.js";
import { listNotes, addNote } from "../../api/notes.js";
import { ApiError } from "../../api/client.js";
import { Alert } from "../ui/Alert.js";
import { Spinner } from "../ui/Spinner.js";

const MAX_LENGTH = 2000;

// ui-spec.md §4: pale-amber background + "Staff only" badge is the primary
// safeguard against posting private content publicly by mistake — the color
// difference must be visually obvious next to CommentsSection's white card.
export function InternalNotesSection({ ticketId }: { ticketId: number }) {
  const [notes, setNotes] = useState<Comment[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listNotes(ticketId)
      .then((data) => {
        if (!cancelled) {
          setNotes(data);
          setLoadState("success");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setError("");
    setSubmitting(true);
    try {
      const created = await addNote(ticketId, body);
      setNotes((prev) => [...prev, created]);
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to post the note. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tk-surface p-3" style={{ backgroundColor: "#fdf6e3" }}>
      <div className="d-flex align-items-center gap-2 mb-3">
        <h2 className="h5 mb-0">Internal Notes</h2>
        <span className="badge text-bg-warning">Staff only</span>
      </div>

      {loadState === "loading" && <Spinner label="Loading internal notes…" />}
      {loadState === "error" && <Alert variant="error">Unable to load internal notes.</Alert>}

      {loadState === "success" && (
        <>
          {notes.length === 0 && <p className="text-secondary">No internal notes yet.</p>}
          {notes.length > 0 && (
            <ul className="list-unstyled">
              {notes.map((n) => (
                <li key={n.id} className="border rounded px-2 py-2 mb-2 bg-white">
                  <div className="d-flex justify-content-between text-secondary small mb-1">
                    <span className="fw-semibold">{n.author.fullName}</span>
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="mt-3">
        <label htmlFor="new-note" className="form-label fw-semibold">
          Add an internal note
        </label>
        <textarea
          id="new-note"
          className="form-control mb-2"
          rows={2}
          maxLength={MAX_LENGTH}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={submitting}
        />
        <button type="submit" className="btn btn-warning text-dark" disabled={submitting || !draft.trim()}>
          {submitting ? "Posting…" : "Post Internal Note"}
        </button>
      </form>
    </div>
  );
}
