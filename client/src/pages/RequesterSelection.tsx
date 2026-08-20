import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listRequesters } from "../api/reference.js";
import type { Requester } from "../api/types.js";
import { useSelectedRequester } from "../context/RequesterContext.js";
import { Alert } from "../components/ui/Alert.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Spinner } from "../components/ui/Spinner.js";

type LoadState = "loading" | "success" | "empty" | "error";

interface LocationState {
  from?: { pathname?: string };
}

export default function RequesterSelection() {
  const [state, setState] = useState<LoadState>("loading");
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const { selectRequester } = useSelectedRequester();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    listRequesters()
      .then((data) => {
        if (cancelled) return;
        setRequesters(data);
        setState(data.length === 0 ? "empty" : "success");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleContinue() {
    const requester = requesters.find((r) => r.id === selectedId);
    if (!requester) return;
    selectRequester(requester);
    const from = (location.state as LocationState | null)?.from?.pathname;
    navigate(from || "/tickets", { replace: true });
  }

  return (
    <div className="tk-page d-flex align-items-center justify-content-center py-5">
      <div className="tk-surface p-4" style={{ maxWidth: 480, width: "100%" }}>
        <h1 className="h4 mb-2">TokTickIT</h1>
        <h2 className="h5 mb-1">Select Development Requester</h2>
        <p className="text-secondary mb-4">
          This selector is used for Lab 2 testing only. Authentication and role-based access will be
          introduced in Lab 3.
        </p>

        {state === "loading" && <Spinner label="Loading requesters…" />}

        {state === "error" && (
          <Alert variant="error">Unable to load development requesters. Please try again.</Alert>
        )}

        {state === "empty" && (
          <EmptyState
            title="No active development requesters"
            description="Ask an administrator to seed at least one active requester."
          />
        )}

        {state === "success" && (
          <>
            <label htmlFor="requester-select" className="form-label fw-semibold">
              Development Requester <span className="text-danger">*</span>
            </label>
            <select
              id="requester-select"
              className="form-select mb-2"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choose a requester…</option>
              {requesters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
            <p className="tk-help mb-4">Only active development requesters are shown.</p>

            <button
              type="button"
              className="btn btn-primary w-100"
              disabled={selectedId === ""}
              onClick={handleContinue}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
