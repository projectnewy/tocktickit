import { Router } from "express";
import { asyncHandler } from "../http/asyncHandler.js";
import { identifyUser } from "../http/authContext.js";
import { loginSchema, changePasswordSchema } from "../validation/auth.schemas.js";
import * as authService from "../services/auth.service.js";
import { SESSION_COOKIE, sessionCookieOptions, verifySession } from "../auth/token.js";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { user, token } = await authService.login(email, password);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
    res.status(200).json({ user });
  })
);

router.post("/logout", (_req, res) => {
  // maxAge deliberately omitted — clearCookie ignores it in Express 5 and
  // warns about it in Express 4; httpOnly/sameSite/secure must still match
  // the cookie that was set, or the browser won't recognize it to clear.
  const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions;
  res.clearCookie(SESSION_COOKIE, clearOptions);
  res.status(204).end();
});

// Asked on every page load. A visitor with no valid session gets 200 {"user":null} rather than a 401, so the
// browser does not log a failed request for the normal signed-out case. /me keeps its Lab 3 contract (401).
router.get(
  "/session",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    const payload = token ? verifySession(token) : null;
    const user = payload ? await authService.findActiveUser(payload.userId) : null;
    res.status(200).json({ user });
  })
);

router.get(
  "/me",
  identifyUser,
  asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.requesterId!);
    res.status(200).json({ user });
  })
);

router.post(
  "/change-password",
  identifyUser,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.requesterId!, currentPassword, newPassword);
    res.status(200).json({ ok: true });
  })
);

export default router;
