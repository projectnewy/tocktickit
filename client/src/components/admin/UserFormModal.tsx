import { useState, type FormEvent } from "react";
import type { AdminUser } from "../../api/admin.js";
import { createUser, updateUser } from "../../api/admin.js";
import { ApiError } from "../../api/client.js";
import type { Role } from "../../api/types.js";
import { Alert } from "../ui/Alert.js";

const ROLE_OPTIONS: Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

interface UserFormModalProps {
  user?: AdminUser; // present = edit mode, absent = create mode
  currentUserId: number; // BR-25: disables the Active toggle when editing self
  onCancel: () => void;
  onSaved: (user: AdminUser) => void;
  onResetPassword?: (user: AdminUser) => void; // edit mode only
}

// ui-spec.md §5: "ConfirmDialog-style, hand-rolled" — same modal chrome as
// ConfirmDialog, but this form has multiple fields and its own inline
// validation/error handling, so it isn't built on top of that component.
export function UserFormModal({ user, currentUserId, onCancel, onSaved, onResetPassword }: UserFormModalProps) {
  const isSelf = user?.id === currentUserId;
  const isEdit = !!user;
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "REQUESTER");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [initialPassword, setInitialPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const saved = isEdit
        ? await updateUser(user!.id, { fullName, email, role, isActive })
        : await createUser({ fullName, email, role, initialPassword });
      onSaved(saved);
    } catch (err) {
      // BR-24 (duplicate email), BR-25/BR-26 (self-deactivate / last admin):
      // shown inline in the modal, never a silent no-op (ui-spec.md §5).
      setError(err instanceof ApiError ? err.message : "Unable to save this user. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="user-form-title" tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5" id="user-form-title">
                {isEdit ? `Edit ${user!.fullName}` : "Create User"}
              </h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onCancel} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <Alert variant="error">{error}</Alert>}

                <div className="mb-3">
                  <label htmlFor="user-full-name" className="form-label fw-semibold">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="user-full-name"
                    type="text"
                    className="form-control"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    maxLength={100}
                    disabled={submitting}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="user-email" className="form-label fw-semibold">
                    Email <span className="text-danger">*</span>
                  </label>
                  <input
                    id="user-email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="user-role" className="form-label fw-semibold">
                    Role <span className="text-danger">*</span>
                  </label>
                  <select
                    id="user-role"
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    disabled={submitting}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {isEdit && (
                  <div className="mb-3">
                    <div className="form-check form-switch">
                      <input
                        id="user-active"
                        type="checkbox"
                        className="form-check-input"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        disabled={submitting || isSelf}
                      />
                      <label htmlFor="user-active" className="form-check-label">
                        Active
                      </label>
                    </div>
                    {/* BR-25: disabled rather than left to error on submit — a
                        clearer signal than a round-trip failure, per the
                        reviewer's UI-hint request on PR #43. */}
                    {isSelf && <p className="tk-help mb-0">You can't deactivate your own account.</p>}
                  </div>
                )}

                {!isEdit && (
                  <div className="mb-1">
                    <label htmlFor="user-initial-password" className="form-label fw-semibold">
                      Initial Password <span className="text-danger">*</span>
                    </label>
                    <input
                      id="user-initial-password"
                      type="password"
                      className="form-control"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={72}
                      disabled={submitting}
                    />
                  </div>
                )}
                {!isEdit && <p className="tk-help mb-0">8–72 characters. The user must change it at first login.</p>}

                {isEdit && onResetPassword && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={submitting}
                    onClick={() => onResetPassword(user!)}
                  >
                    Set new password…
                  </button>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
