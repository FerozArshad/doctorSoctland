import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const secret = () => {
  const s = process.env.AUTH_SECRET;
  // Never allow a guessable signing key outside local dev — forged session
  // cookies would grant admin access.
  if (process.env.NODE_ENV === "production" && (!s || s.length < 32 || s.startsWith("dev-only") || s.startsWith("change-me"))) {
    throw new Error("AUTH_SECRET must be set to a long random value in production (openssl rand -hex 32).");
  }
  return new TextEncoder().encode(s || "dev-only-secret");
};

const ADMIN_COOKIE = "ds_admin";
const PATIENT_COOKIE = "ds_patient";

async function sign(sub: string, kind: "admin" | "patient") {
  return new SignJWT({ kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

async function verify(token: string | undefined, kind: "admin" | "patient") {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.kind !== kind || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function createAdminSession(adminId: string) {
  cookies().set(ADMIN_COOKIE, await sign(adminId, "admin"), cookieOpts);
}

export async function createPatientSession(patientId: string) {
  cookies().set(PATIENT_COOKIE, await sign(patientId, "patient"), cookieOpts);
}

export function clearAdminSession() {
  cookies().delete(ADMIN_COOKIE);
}

export async function getAdmin() {
  const id = await verify(cookies().get(ADMIN_COOKIE)?.value, "admin");
  if (!id) return null;
  return db.admin.findUnique({ where: { id } });
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function getPatientSession() {
  const id = await verify(cookies().get(PATIENT_COOKIE)?.value, "patient");
  if (!id) return null;
  return db.patient.findUnique({ where: { id } });
}
