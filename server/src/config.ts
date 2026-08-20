export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB, fixed by the labsheet

export const MAX_ACTIVE_ATTACHMENTS_PER_TICKET = 5; // fixed by the labsheet

export const ALLOWED_ATTACHMENT_TYPES = [
  { mimeType: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  { mimeType: "image/png", extensions: [".png"] },
  { mimeType: "image/webp", extensions: [".webp"] },
  { mimeType: "application/pdf", extensions: [".pdf"] },
] as const;

export const ALLOWED_MIME_TYPES: readonly string[] = ALLOWED_ATTACHMENT_TYPES.map((t) => t.mimeType);
export const ALLOWED_EXTENSIONS: readonly string[] = ALLOWED_ATTACHMENT_TYPES.flatMap((t) => t.extensions);
