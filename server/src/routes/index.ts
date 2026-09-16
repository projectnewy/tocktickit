import { Router } from "express";
import healthRouter from "./health.routes.js";
import referenceRouter from "./reference.routes.js";
import authRouter from "./auth.routes.js";
import ticketsRouter from "./tickets.routes.js";
import attachmentsRouter from "./attachments.routes.js";
import staffRouter from "./staff.routes.js";
import adminRouter from "./admin.routes.js";

const router = Router();
router.use(healthRouter);
router.use(referenceRouter);
router.use("/auth", authRouter);
// Mounted at a path prefix (not bare `router.use(ticketsRouter)`) so that
// ticketsRouter's authContext middleware only ever runs for /tickets/*
// requests — mounting it unprefixed made the old requesterContext fire for
// every request through this router, including unrelated 404s (caught by a
// test in Lab 2; same trap applies here).
router.use("/tickets", ticketsRouter);
router.use("/attachments", attachmentsRouter);
router.use("/staff", staffRouter);
router.use("/admin", adminRouter);

export default router;
