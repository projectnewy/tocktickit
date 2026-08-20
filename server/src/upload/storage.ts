import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { env } from "../env.js";

// Never express.static-served — see attachments.routes.ts. Sibling of src/,
// resolved against process.cwd() (server/) rather than __dirname, since the
// compiled dist/ build's directory depth differs from src/.
const UPLOAD_ROOT = path.resolve(process.cwd(), env.uploadDir);

export function ticketUploadDir(ticketId: number): string {
  return path.join(UPLOAD_ROOT, "tickets", String(ticketId));
}

export function attachmentAbsolutePath(ticketId: number, storedFilename: string): string {
  return path.join(ticketUploadDir(ticketId), storedFilename);
}

export async function ensureTicketUploadDir(ticketId: number): Promise<string> {
  const dir = ticketUploadDir(ticketId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// file.originalname is attacker-controlled (can contain .., /, \, or control
// characters) and never touches the filesystem — only the UUID-based name does.
export function generateStoredFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${randomUUID()}${ext}`;
}

export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    // The file becomes an unreferenced, harmless orphan if this fails too —
    // logged rather than thrown so it never masks the original error.
    console.error(`Failed to remove orphaned upload at ${filePath}`, err);
  }
}
