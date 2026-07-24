import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

/** bcrypt cost — 12 is a good balance for admin credentials. */
export const ADMIN_BCRYPT_ROUNDS = 12;

const MIN_LEN = 8;
const MAX_LEN = 128;

/** Hash an admin password for storage (never store plaintext). */
export async function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ADMIN_BCRYPT_ROUNDS);
}

/** Constant-time password check against a stored hash. */
export async function verifyAdminPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const dummy = "$2a$12$jIXu5fFVbg3ikfyxoWTwL.sLkQyG8lo/95eoTH8DTmJLzZCI7uUs2";
  try {
    return await bcrypt.compare(password || " ", hash || dummy);
  } catch {
    return false;
  }
}

/** Validate password meets minimum policy. Returns an error message or null if OK. */
export function validateAdminPassword(password: string): string | null {
  if (password.length < MIN_LEN) return `Password must be at least ${MIN_LEN} characters`;
  if (password.length > MAX_LEN) return `Password must be under ${MAX_LEN} characters`;
  return null;
}

const CHARSET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";

/** Cryptographically secure temporary password for emailed admin resets. */
export function generateSecureAdminPassword(length = 16): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i]! % CHARSET.length];
  }
  // Ensure at least one of each class for basic policy compliance.
  if (!/[a-z]/.test(out)) out = "a" + out.slice(1);
  if (!/[A-Z]/.test(out)) out = out.slice(0, 1) + "A" + out.slice(2);
  if (!/[0-9]/.test(out)) out = out.slice(0, 2) + "7" + out.slice(3);
  if (!/[!@#$%&*]/.test(out)) out = out.slice(0, 3) + "!" + out.slice(4);
  return out;
}
