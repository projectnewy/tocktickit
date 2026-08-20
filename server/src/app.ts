import express from "express";
import cors from "cors";
import { env } from "./env.js";
import apiRouter from "./routes/index.js";
import { notFound } from "./http/notFound.js";
import { errorHandler } from "./http/errorHandler.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// A custom X-Requester-Id header (see http/requesterContext.ts) triggers a
// CORS preflight on every POST, so the allowed headers are explicit rather
// than relying on cors()'s permissive default.
app.use(
  cors({
    origin: env.clientOrigin,
    allowedHeaders: ["Content-Type", "X-Requester-Id"],
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(express.json());

app.use("/api", apiRouter);
app.use("/api", notFound);

app.use(errorHandler);

export default app;
