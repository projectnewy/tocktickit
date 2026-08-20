import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 3000,
  // Restricts CORS to the real client origin now that requests carry a custom
  // X-Requester-Id header (which triggers preflight on every POST).
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  // Resolved against process.cwd() in src/upload/storage.ts. Both `npm run
  // dev` (tsx) and `npm start` (node dist/index.js) run with cwd = server/.
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
};
