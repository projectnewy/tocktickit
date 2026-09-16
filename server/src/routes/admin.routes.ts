import { Router } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import { authContext, requireRole } from "../http/authContext.js";
import { BadRequestError } from "../http/errors.js";
import { createUserSchema, resetPasswordSchema, updateUserSchema, userQuerySchema } from "../validation/admin.schemas.js";
import * as adminService from "../services/admin.service.js";

const router = Router();
router.use(authContext, requireRole("ADMINISTRATOR"));

function parseUserId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequestError("Invalid user id");
  return id;
}

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const query = userQuerySchema.parse(req.query);
    const users = await adminService.listUsers(query);
    res.status(200).json(users);
  })
);

router.post(
  "/users",
  asyncHandler(async (req, res) => {
    const input = createUserSchema.parse(req.body);
    const user = await adminService.createUser(input);
    res.status(201).json(user);
  })
);

router.patch(
  "/users/:userId",
  asyncHandler(async (req, res) => {
    const userId = parseUserId(req.params.userId);
    const input = updateUserSchema.parse(req.body);
    const user = await adminService.updateUser(req.requesterId!, userId, input);
    res.status(200).json(user);
  })
);

router.post(
  "/users/:userId/reset-password",
  asyncHandler(async (req, res) => {
    const userId = parseUserId(req.params.userId);
    const { newPassword } = resetPasswordSchema.parse(req.body);
    const user = await adminService.resetPassword(userId, newPassword);
    res.status(200).json(user);
  })
);

export default router;
