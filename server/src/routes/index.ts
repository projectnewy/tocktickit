import { Router } from "express";
import healthRouter from "./health.routes.js";
import referenceRouter from "./reference.routes.js";
import ticketsRouter from "./tickets.routes.js";
import attachmentsRouter from "./attachments.routes.js";

const router = Router();
router.use(healthRouter);
router.use(referenceRouter);
// Mounted at a path prefix (not bare `router.use(ticketsRouter)`) so that
// ticketsRouter's requesterContext middleware only ever runs for /tickets/*
// requests — mounting it unprefixed made requesterContext fire for every
// request through this router, including unrelated 404s (caught by a test).
router.use("/tickets", ticketsRouter);
router.use("/attachments", attachmentsRouter);

export default router;
