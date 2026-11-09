import bcrypt from "bcrypt";
import { HttpError } from "../middleware/errorHandler.js";
import { db, newId } from "../db/mongo.js";

const BCRYPT_ROUNDS = 12;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public shape of a user — the password hash must never leave the server. */
export function userApi(user) {
  if (!user) return user;
  const { _id, passwordHash, ...rest } = user;
  return { id: _id, ...rest };
}

/**
 * Validates registration input and creates a new user.
 * Emails are stored lower-cased; the unique case-insensitive index in
 * mongo.js catches races, while this check gives a friendly 409 first.
 */
export async function registerUser(input) {
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(input.password ?? "");

  if (!name) throw new HttpError(400, "Full name is required");
  if (name.length > 80)
    throw new HttpError(400, "Full name must be at most 80 characters");
  if (!email) throw new HttpError(400, "Email address is required");
  if (!EMAIL_PATTERN.test(email))
    throw new HttpError(400, "Email address is not valid");
  if (email.length > 120)
    throw new HttpError(400, "Email address must be at most 120 characters");
  if (password.length < 8)
    throw new HttpError(400, "Password must be at least 8 characters");
  if (password.length > 100)
    throw new HttpError(400, "Password must be at most 100 characters");

  const existing = await db().users.findOne({ email });
  if (existing)
    throw new HttpError(409, "This email address is already registered");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = {
    _id: newId(),
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  try {
    await db().users.insertOne(user);
  } catch (error) {
    if (error.code === 11000)
      throw new HttpError(409, "This email address is already registered");
    throw error;
  }
  return userApi(user);
}

/** Verifies credentials and returns the user document (or null). Used by login. */
export async function verifyUser(email, password) {
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();
  const user = normalized
    ? await db().users.findOne({ email: normalized })
    : null;
  if (!user || typeof password !== "string") return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export async function findUserById(id) {
  if (!id) return null;
  return db().users.findOne({ _id: String(id) });
}
