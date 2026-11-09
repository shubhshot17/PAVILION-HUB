import { Router } from "express";
import { body } from "../lib/validate.js";
import {
  registerUser,
  verifyUser,
  userApi,
  findUserById,
} from "../models/users.js";
import { HttpError } from "../middleware/errorHandler.js";
import {
  signSession,
  setSessionCookie,
  clearSessionCookie,
  readSession,
} from "../lib/session.js";

const router = Router();

/** POST /api/auth/register — create an account and start a session. */
router.post("/register", async (req, res) => {
  const data = body(req);
  if (data.password !== data.confirmPassword) {
    throw new HttpError(400, "Passwords do not match");
  }
  const user = await registerUser(data);
  const token = signSession(user._id);
  setSessionCookie(res, token);
  res.status(201).json({ user });
});

/** POST /api/auth/login — verify credentials and start a session. */
router.post("/login", async (req, res) => {
  const data = body(req);
  const user = await verifyUser(data.email, data.password);
  if (!user) throw new HttpError(401, "Incorrect email or password");
  setSessionCookie(res, signSession(user._id));
  res.json({ user: userApi(user) });
});

/** POST /api/auth/logout — clear the session cookie. */
router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

/** GET /api/auth/me — the signed-in user, or 401. */
router.get("/me", async (req, res) => {
  const session = readSession(req);
  const user = session ? await findUserById(session.userId) : null;
  if (!user) throw new HttpError(401, "Not signed in");
  res.json({ user: userApi(user) });
});

export default router;
