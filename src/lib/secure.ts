import crypto from "crypto";

/** Constant-time string compare for secrets / bearer tokens. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still do a compare to reduce length-oracle timing noise on short secrets.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function bearerMatches(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || secret.startsWith("change-me") || secret.startsWith("dev-cron") || secret.length < 16) {
    return false;
  }
  const expected = `Bearer ${secret}`;
  return timingSafeEqualStr(authHeader || "", expected);
}

/** Dev-only OTP on-screen leak. Never in production. */
export function allowDevOtpDisplay(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_OTP === "1";
}
