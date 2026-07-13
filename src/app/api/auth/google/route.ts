import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getAdmin } from "@/lib/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/google";

// GET /api/auth/google — admin starts the Gmail authorisation.
// Redirects to Google's consent screen; the callback finishes the exchange.
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.redirect(new URL("/admin/login", process.env.APP_URL || "http://localhost:3000"));

  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first." },
      { status: 400 }
    );
  }

  // CSRF: random state echoed back by Google and matched in the callback.
  const state = randomUUID();
  cookies().set("g_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(googleAuthUrl(state));
}
