import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 3000,
  // Restricts CORS to the real client origin now that requests carry a custom
  // X-Requester-Id header (which triggers preflight on every POST).
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
};
