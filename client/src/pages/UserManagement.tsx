import { useEffect, useState, type FormEvent } from "react";
import { listUsers, type AdminUser, type UserQuery } from "../api/admin.js";
import { useAuth } from "../context/AuthContext.js";
import type { Role } from "../api/types.js";
import { RoleBadge } from "../components/ui/RoleBadge.js";
import { ActiveBadge } from "../components/ui/ActiveBadge.js";
import { UserFormModal } from "../components/admin/UserFormModal.js";
import { ResetPasswordModal } from "../components/admin/ResetPasswordModal.js";
import { Spinner } from "../components/ui/Spinner.js";
import { Alert } from "../components/ui/Alert.js";
import { EmptyState } from "../components/ui/EmptyState.js";

const ROLE_OPTIONS: Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

type LoadState = "loading" | "success" | "error";
type ModalState = { kind: "create" } | { kind: "edit"; user: AdminUser } | { kind: "reset"; user: AdminUser } | null;

// ui-spec.md §5: single screen, no route nesting, no pagination/multi-sort.
export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState<UserQuery>({});
  const [searchInput, setSearchInput] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [successMessage, setSuccessMessage] = useState("");

  function refetch() {
    setState("loading");
    listUsers(query)
      .then((data) => {
        setUsers(data);
        setState("success");
      })
      .catch(() => setState("error"));
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setQuery((q) => ({ ...q, q: searchInput || undefined }));
  }

  // Lab 3 §8.6: clear feedback for success states too, not just errors.
  function closeWithSuccess(message: string) {
    setModal(null);
    setSuccessMessage(message);
    refetch();
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h1 className="h4 mb-0">User Management</h1>
          <p className="text-secondary mb-0">Create, edit, and manage TokTickIT accounts.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setSuccessMessage("");
            setModal({ kind: "create" });
          }}
        >
          Create User
        </button>
      </div>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <div className="tk-surface p-3 mb-3">
        <form className="row g-2 align-items-end" onSubmit={handleSearchSubmit}>
          <div className="col-12 col-md-6">
            <label htmlFor="user-search" className="form-label small fw-semibold">
              Search
            </label>
            <input
              id="user-search"
              type="search"
              className="form-control"
              placeholder="Name or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="col-6 col-md-3">
            <label htmlFor="user-role-filter" className="form-label small fw-semibold">
              Role
            </label>
            <select
              id="user-role-filter"
              className="form-select"
              value={query.role ?? ""}
              onChange={(e) => setQuery((q) => ({ ...q, role: e.target.value ? (e.target.value as Role) : undefined }))}
            >
              <option value="">All Roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <button type="submit" className="btn btn-primary btn-sm w-100">
              Search
            </button>
          </div>
        </form>
      </div>

      {state === "loading" && <Spinner label="Loading users…" />}
      {state === "error" && <Alert variant="error">Unable to load users. Please try again.</Alert>}

      {state === "success" && users.length === 0 && (
        <EmptyState title="No users match your search" description="Try adjusting the search or role filter." />
      )}

      {state === "success" && users.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>
                    <RoleBadge role={u.role} />
                  </td>
                  <td>
                    <ActiveBadge isActive={u.isActive} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        setSuccessMessage("");
                        setModal({ kind: "edit", user: u });
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.kind === "create" && currentUser && (
        <UserFormModal
          currentUserId={currentUser.id}
          onCancel={() => setModal(null)}
          onSaved={() => closeWithSuccess("User created.")}
        />
      )}

      {modal?.kind === "edit" && currentUser && (
        <UserFormModal
          user={modal.user}
          currentUserId={currentUser.id}
          onCancel={() => setModal(null)}
          onSaved={() => closeWithSuccess("Changes saved.")}
          onResetPassword={(user) => setModal({ kind: "reset", user })}
        />
      )}

      {modal?.kind === "reset" && (
        <ResetPasswordModal
          user={modal.user}
          onCancel={() => setModal({ kind: "edit", user: modal.user })}
          onDone={() => closeWithSuccess("Password reset.")}
        />
      )}
    </div>
  );
}
