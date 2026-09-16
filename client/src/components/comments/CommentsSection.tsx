import { useEffect, useState, type FormEvent } from "react";
import type { Comment } from "../../api/types.js";
import { listComments, addComment } from "../../api/comments.js";
import { ApiError } from "../../api/client.js";
import { Alert } from "../ui/Alert.js";
import { Spinner } from "../ui/Spinner.js";

const MAX_LENGTH = 2000;

export function CommentsSection({ ticketId }: { ticketId: number }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listComments(ticketId)
      .then((data) => {
        if (!cancelled) {
          setComments(data);
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
      const created = await addComment(ticketId, body);
      setComments((prev) => [...prev, created]);
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to post the comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="tk-surface p-3">
      <h2 className="h5 mb-3">Public Comments</h2>

      {loadState === "loading" && <Spinner label="Loading comments…" />}
      {loadState === "error" && <Alert variant="error">Unable to load comments.</Alert>}

      {loadState === "success" && (
        <>
          {comments.length === 0 && <p className="text-secondary">No comments yet.</p>}
          {comments.length > 0 && (
            <ul className="list-unstyled">
              {comments.map((c) => (
                <li key={c.id} className="border rounded px-2 py-2 mb-2">
                  <div className="d-flex justify-content-between text-secondary small mb-1">
                    <span className="fw-semibold">{c.author.fullName}</span>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="mt-3">
        <label htmlFor="new-comment" className="form-label fw-semibold">
          Add a comment
        </label>
        <textarea
          id="new-comment"
          className="form-control mb-2"
          rows={2}
          maxLength={MAX_LENGTH}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={submitting}
        />
        <button type="submit" className="btn btn-outline-primary" disabled={submitting || !draft.trim()}>
          {submitting ? "Posting…" : "Post Comment"}
        </button>
      </form>
    </div>
  );
}
