import type { AttachmentMeta } from "../../api/types.js";

// Read-only for IT Staff/Admin: the labsheet scope for Issue #35 is
// ownership/priority/status/comments/notes — upload/remove/download stay
// Requester-only actions (attachment.service.ts's ownership checks are
// unchanged), so this only renders what's already embedded in the ticket
// detail response rather than adding new attachment endpoints.
export function StaffAttachmentsList({ attachments }: { attachments: AttachmentMeta[] }) {
  const active = attachments.filter((a) => !a.isRemoved);
  const removed = attachments.filter((a) => a.isRemoved);

  return (
    <div className="tk-surface p-3">
      <h2 className="h5 mb-3">Attachments</h2>

      {active.length === 0 && removed.length === 0 && <p className="text-secondary">No attachments yet.</p>}

      {active.length > 0 && (
        <ul className="list-unstyled">
          {active.map((a) => (
            <li key={a.id} className="border rounded px-2 py-2 mb-2">
              <div className="fw-semibold text-truncate">{a.originalFilename}</div>
              <div className="text-secondary small">
                {(a.sizeBytes / 1024).toFixed(0)} KB · Uploaded by {a.uploadedBy.fullName}
              </div>
            </li>
          ))}
        </ul>
      )}

      {removed.length > 0 && (
        <>
          <h3 className="h6 text-secondary mt-3">Removed</h3>
          <ul className="list-unstyled">
            {removed.map((a) => (
              <li key={a.id} className="border rounded px-2 py-2 mb-2 text-secondary">
                <div className="text-decoration-line-through text-truncate">{a.originalFilename}</div>
                <div className="small">Removed: {a.removedReason}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
