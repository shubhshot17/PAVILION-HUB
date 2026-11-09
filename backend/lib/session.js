import crypto from "node:crypto";
import { config } from "../config.js";
import { HttpError } from "../middleware/errorHandler.js";

/*
 * Stateless HMAC-signed session tokens ("JWT-lite"): base64url(payload)
 * + '.' + base64url(HMAC-SHA256(payload, secret)). Verified in constant
 * time; no external dependency needed.
 */

const REMEMBER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 1 day

function secret() {
  const value = config.sessionSecret;
  if (!value) {
    throw new HttpError(
      500,
      "SESSION_SECRET is not configured; set it in backend/.env",
    );
  }
  return value;
}

const b64url = (buffer) => Buffer.from(buffer).toString("base64url");

export function signSession(userId, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const payload = b64url(
    JSON.stringify({
      userId,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    }),
  );
  const signature = b64url(
    crypto.createHmac("sha256", secret()).update(payload).digest(),
  );
  return `${payload}.${signature}`;
}

export function readSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest();
  const given = Buffer.from(signature, "base64url");
  if (
    given.length !== expected.length ||
    !crypto.timingSafeEqual(given, expected)
  ) {
    return null;
  }
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof session.exp !== "number" || session.exp * 1000 < Date.now())
      return null;
    return session;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = "ph_session";

/**
 * Sets the session cookie. Without `remember` the cookie is a browser-session
 * cookie (cleared when the browser closes); with it, it persists 30 days.
 */
export function setSessionCookie(res, token, remember = true) {
  const maxAge = remember ? REMEMBER_TTL_SECONDS * 1000 : undefined;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    ...(maxAge ? { maxAge } : {}),
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}
