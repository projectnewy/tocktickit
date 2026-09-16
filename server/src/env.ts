import "dotenv/config";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production");
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  // Resolved against process.cwd() in src/upload/storage.ts. Both `npm run
  // dev` (tsx) and `npm start` (node dist/index.js) run with cwd = server/.
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  // Lab 3: signs the auth cookie's JWT. Dev/test fallback only — never committed for real use.
  jwtSecret: process.env.JWT_SECRET || "dev-only-insecure-secret-change-me",
  jwtExpiresIn: "8h" as const,
};
