import { useEffect, useState, type ChangeEvent } from "react";
import { listCategories, listRelatedSystems } from "../../api/reference.js";
import type { Category, RelatedSystem } from "../../api/types.js";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_ACTIVE_ATTACHMENTS,
  MAX_FILE_BYTES,
  PRIORITY_OPTIONS,
} from "../../config.js";
import { FormField } from "../ui/FormField.js";
import { Alert } from "../ui/Alert.js";
import { Spinner } from "../ui/Spinner.js";

export interface TicketFormValues {
  categoryId: string;
  relatedSystemId: string;
  summary: string;
  description: string;
  requestedPriority: string;
}

export interface PendingFile {
  file: File;
  error?: string;
}

interface TicketFormProps {
  values: TicketFormValues;
  onChange: (values: TicketFormValues) => void;
  files: PendingFile[];
  onFilesChange: (files: PendingFile[]) => void;
  fieldErrors?: Record<string, string>;
  disabled?: boolean;
}

function validateFile(file: File): string | undefined {
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return "File type not allowed. Use JPG, PNG, WEBP, or PDF.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "File exceeds the 5 MB limit.";
  }
  return undefined;
}

export function TicketForm({ values, onChange, files, onFilesChange, fieldErrors = {}, disabled }: TicketFormProps) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[] | null>(null);
  const [referenceError, setReferenceError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCategories(), listRelatedSystems()])
      .then(([cats, systems]) => {
        if (cancelled) return;
        setCategories(cats);
        setRelatedSystems(systems);
      })
      .catch(() => {
        if (!cancelled) setReferenceError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof TicketFormValues>(key: K, value: TicketFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting a file with the same name after removal
    const remainingSlots = Math.max(0, MAX_ACTIVE_ATTACHMENTS - files.length);
    const toAdd = selected.slice(0, remainingSlots).map((file) => ({ file, error: validateFile(file) }));
    onFilesChange([...files, ...toAdd]);
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  if (referenceError) {
    return <Alert variant="error">Unable to load categories and related systems. Please refresh the page.</Alert>;
  }

  if (!categories || !relatedSystems) {
    return <Spinner label="Loading form…" />;
  }

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-4">
        <FormField id="category" label="Category" required error={fieldErrors.categoryId}>
          <select
            id="category"
            className="form-select"
            value={values.categoryId}
            disabled={disabled}
            onChange={(e) => update("categoryId", e.target.value)}
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="col-12 col-lg-4">
        <FormField id="related-system" label="Related System" required error={fieldErrors.relatedSystemId}>
          <select
            id="related-system"
            className="form-select"
            value={values.relatedSystemId}
            disabled={disabled}
            onChange={(e) => update("relatedSystemId", e.target.value)}
          >
            <option value="">Select a related system…</option>
            {relatedSystems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="col-12 col-lg-4">
        <FormField id="requestedPriority" label="Requested Priority" required error={fieldErrors.requestedPriority}>
          <select
            id="requestedPriority"
            className="form-select"
            value={values.requestedPriority}
            disabled={disabled}
            onChange={(e) => update("requestedPriority", e.target.value)}
          >
            <option value="">Select a priority…</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="col-12">
        <FormField id="summary" label="Ticket Summary" required error={fieldErrors.summary} help="5–150 characters.">
          <input
            id="summary"
            type="text"
            className="form-control"
            value={values.summary}
            disabled={disabled}
            onChange={(e) => update("summary", e.target.value)}
          />
        </FormField>
      </div>

      <div className="col-12">
        <FormField
          id="description"
          label="Description"
          required
          error={fieldErrors.description}
          help="10–4000 characters."
        >
          <textarea
            id="description"
            className="form-control"
            rows={5}
            value={values.description}
            disabled={disabled}
            onChange={(e) => update("description", e.target.value)}
          />
        </FormField>
      </div>

      <div className="col-12">
        <FormField
          id="attachments"
          label="Attachments"
          help="JPG, PNG, WEBP, or PDF. Up to 5 files, 5 MB each."
        >
          <input
            id="attachments"
            type="file"
            className="form-control"
            multiple
            accept={ALLOWED_EXTENSIONS.join(",")}
            disabled={disabled || files.length >= MAX_ACTIVE_ATTACHMENTS}
            onChange={handleFileSelect}
          />
        </FormField>
        {files.length > 0 && (
          <ul className="list-unstyled">
            {files.map((f, i) => (
              <li
                key={`${f.file.name}-${i}`}
                className="d-flex align-items-center justify-content-between border rounded px-2 py-1 mb-1 gap-2"
              >
                <span className="text-truncate">{f.file.name}</span>
                {f.error ? (
                  <span className="tk-field-error mb-0">{f.error}</span>
                ) : (
                  <span className="text-secondary small">{(f.file.size / 1024).toFixed(0)} KB</span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => removeFile(i)}
                  disabled={disabled}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
