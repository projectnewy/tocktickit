import { Router } from "express";
import healthRouter from "./health.routes.js";
import referenceRouter from "./reference.routes.js";

// Ticket and attachment routers are added in Issues 8–9.
const router = Router();
router.use(healthRouter);
router.use(referenceRouter);

export default router;
