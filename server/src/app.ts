import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env.js";
import apiRouter from "./routes/index.js";
import { notFound } from "./http/notFound.js";
import { errorHandler } from "./http/errorHandler.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// credentials:true is required for the tk_session cookie (see http/authContext.ts)
// to be sent/received cross-origin between the Vite client and this API.
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
    allowedHeaders: ["Content-Type"],
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(cookieParser());
app.use(express.json());

app.use("/api", apiRouter);
app.use("/api", notFound);

app.use(errorHandler);

export default app;
