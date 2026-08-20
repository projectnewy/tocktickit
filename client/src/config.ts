export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB, fixed by the labsheet
export const MAX_ACTIVE_ATTACHMENTS = 5; // fixed by the labsheet

export const ALLOWED_FILE_TYPES = [
  { mimeType: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  { mimeType: "image/png", extensions: [".png"] },
  { mimeType: "image/webp", extensions: [".webp"] },
  { mimeType: "application/pdf", extensions: [".pdf"] },
] as const;

export const ALLOWED_MIME_TYPES: readonly string[] = ALLOWED_FILE_TYPES.map((t) => t.mimeType);
export const ALLOWED_EXTENSIONS: readonly string[] = ALLOWED_FILE_TYPES.flatMap((t) => t.extensions);

export const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const REMOVAL_REASONS = [
  "Uploaded by mistake",
  "Wrong file",
  "Contains sensitive information",
  "No longer relevant",
  "Other",
] as const;
