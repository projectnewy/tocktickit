import { useState, type FormEvent } from "react";
import type { AdminUser } from "../../api/admin.js";
import { createUser, updateUser } from "../../api/admin.js";
import { ApiError } from "../../api/client.js";
import type { Role } from "../../api/types.js";
import { ROLE_VALUES, roleLabel } from "../../config/labels.js";
import { Alert } from "../ui/Alert.js";
import { FormField } from "../ui/FormField.js";
import { Modal } from "../ui/Modal.js";

interface UserFormModalProps {
  user?: AdminUser; // present = edit mode, absent = create mode
  currentUserId: number; // BR-25: disables the Active toggle when editing self
  onCancel: () => void;
  onSaved: (user: AdminUser) => void;
  onResetPassword?: (user: AdminUser) => void; // edit mode only
}

type FieldErrors = Partial<Record<"fullName" | "email" | "initialPassword", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ui-spec.md §4/§6: built on the shared Modal (focus handling, Escape), with
// below-field validation messages and data kept after a recoverable failure.
export function UserFormModal({ user, currentUserId, onCancel, onSaved, onResetPassword }: UserFormModalProps) {
  const isEdit = !!user;
  const isSelf = user?.id === currentUserId;
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "REQUESTER");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [initialPassword, setInitialPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = "Name is required.";
    else if (fullName.trim().length > 100) errors.fullName = "Name must be at most 100 characters.";
    if (!email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!isEdit) {
      if (!initialPassword) errors.initialPassword = "Initial password is required.";
      else if (initialPassword.length < 8 || initialPassword.length > 72) {
        errors.initialPassword = "Password must be 8–72 characters.";
      }
    }
    return errors;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
    <Modal title={isEdit ? `Edit ${user!.fullName}` : "Create User"} onClose={onCancel} closeDisabled={submitting}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          {error && <Alert variant="error">{error}</Alert>}

          <FormField id="user-full-name" label="Name" required error={fieldErrors.fullName}>
            <input
              id="user-full-name"
              type="text"
              className="form-control"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              disabled={submitting}
            />
          </FormField>

          <FormField id="user-email" label="Email" required error={fieldErrors.email}>
            <input
              id="user-email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </FormField>

          <FormField id="user-role" label="Role" required>
            <select
              id="user-role"
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={submitting}
            >
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </FormField>

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
                  aria-describedby={isSelf ? "user-active-help" : undefined}
                />
                <label htmlFor="user-active" className="form-check-label">
                  Active
                </label>
              </div>
              {/* BR-25: disabled rather than left to error on submit — a
                  clearer signal than a round-trip failure. */}
              {isSelf && (
                <p className="tk-help mb-0" id="user-active-help">
                  You can't deactivate your own account.
                </p>
              )}
            </div>
          )}

          {!isEdit && (
            <FormField
              id="user-initial-password"
              label="Initial Password"
              required
              error={fieldErrors.initialPassword}
              help="8–72 characters. The user must change it at first login."
            >
              <input
                id="user-initial-password"
                type="password"
                className="form-control"
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                maxLength={72}
                autoComplete="new-password"
                disabled={submitting}
              />
            </FormField>
          )}

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
    </Modal>
  );
}
