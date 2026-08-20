import { useState, type ChangeEvent } from "react";
import type { AttachmentMeta } from "../../api/types.js";
import { uploadAttachment, removeAttachment as removeAttachmentApi, downloadAttachment } from "../../api/attachments.js";
import { ApiError } from "../../api/client.js";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_ACTIVE_ATTACHMENTS, MAX_FILE_BYTES } from "../../config.js";
import { Alert } from "../ui/Alert.js";
import { RemoveAttachmentDialog } from "./RemoveAttachmentDialog.js";

interface AttachmentSectionProps {
  ticketId: number;
  attachments: AttachmentMeta[];
  onAttachmentsChange: (attachments: AttachmentMeta[]) => void;
}

function validateFile(file: File): string | undefined {
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return "File type not allowed. Use JPG, PNG, WEBP, or PDF.";
  }
  if (file.size > MAX_FILE_BYTES) return "File exceeds the 5 MB limit.";
  return undefined;
}

export function AttachmentSection({ ticketId, attachments, onAttachmentsChange }: AttachmentSectionProps) {
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AttachmentMeta | null>(null);
  const [removing, setRemoving] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const activeAttachments = attachments.filter((a) => !a.isRemoved);
  const removedAttachments = attachments.filter((a) => a.isRemoved);
  const atLimit = activeAttachments.length >= MAX_ACTIVE_ATTACHMENTS;

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const clientError = validateFile(file);
    if (clientError) {
      setUploadError(clientError);
      return;
    }

    setUploadError("");
    setUploading(true);
    try {
      const created = await uploadAttachment(ticketId, file);
      onAttachmentsChange([...attachments, created]);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Unable to upload the file. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmRemove(reason: string) {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const updated = await removeAttachmentApi(removeTarget.id, reason);
      onAttachmentsChange(attachments.map((a) => (a.id === updated.id ? updated : a)));
      setRemoveTarget(null);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Unable to remove the attachment. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  async function handleDownload(attachment: AttachmentMeta) {
    setDownloadError("");
    try {
      await downloadAttachment(attachment.id, attachment.originalFilename);
    } catch {
      setDownloadError("Unable to download this file. Please try again.");
    }
  }

  return (
    <div className="tk-surface p-3">
      <h2 className="h5 mb-3">Attachments</h2>

      {uploadError && <Alert variant="error">{uploadError}</Alert>}
      {downloadError && <Alert variant="error">{downloadError}</Alert>}

      {activeAttachments.length === 0 && removedAttachments.length === 0 && (
        <p className="text-secondary">No attachments yet.</p>
      )}

      {activeAttachments.length > 0 && (
        <ul className="list-unstyled">
          {activeAttachments.map((a) => (
            <li
              key={a.id}
              className="d-flex align-items-center justify-content-between border rounded px-2 py-2 mb-2 gap-2"
            >
              <div className="text-truncate">
                <div className="fw-semibold text-truncate">{a.originalFilename}</div>
                <div className="text-secondary small">
                  {(a.sizeBytes / 1024).toFixed(0)} KB · Uploaded by {a.uploadedBy.fullName}
                </div>
              </div>
              <div className="d-flex gap-2 flex-shrink-0">
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleDownload(a)}>
                  Download
                </button>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setRemoveTarget(a)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {removedAttachments.length > 0 && (
        <>
          <h3 className="h6 text-secondary mt-3">Removed</h3>
          <ul className="list-unstyled">
            {removedAttachments.map((a) => (
              <li
                key={a.id}
                className="d-flex align-items-center justify-content-between border rounded px-2 py-2 mb-2 text-secondary"
              >
                <div className="text-truncate">
                  <div className="text-decoration-line-through text-truncate">{a.originalFilename}</div>
                  <div className="small">Removed: {a.removedReason}</div>
                </div>
                <span className="badge text-bg-secondary">Removed</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-3">
        <label htmlFor="attachment-upload" className="form-label fw-semibold">
          Add attachment
        </label>
        <input
          id="attachment-upload"
          type="file"
          className="form-control"
          accept={ALLOWED_EXTENSIONS.join(",")}
          disabled={uploading || atLimit}
          onChange={handleFileSelect}
        />
        {atLimit && (
          <p className="tk-help mb-0">Maximum of 5 active attachments reached. Remove one to add another.</p>
        )}
      </div>

      {removeTarget && (
        <RemoveAttachmentDialog
          filename={removeTarget.originalFilename}
          submitting={removing}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={handleConfirmRemove}
        />
      )}
    </div>
  );
}
