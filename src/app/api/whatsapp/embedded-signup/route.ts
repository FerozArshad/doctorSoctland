// Exchanges the Embedded Signup authorisation code for a business access token.
// Admin-only. The token + phone number id are shown to the admin to store as
// WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID.
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { code } = await req.json().catch(() => ({}));
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const appId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!appId || !secret) {
    return NextResponse.json({ error: "META_APP_ID / META_APP_SECRET not configured on the server" }, { status: 400 });
  }

  // Embedded Signup code exchange — no redirect_uri (override_default_response_type).
  const url =
    `https://graph.facebook.com/v21.0/oauth/access_token` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(secret)}` +
    `&code=${encodeURIComponent(String(code))}`;

  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json?.error?.message || "token exchange failed" }, { status: 400 });
  }
  return NextResponse.json({
    access_token: json.access_token,
    token_type: json.token_type,
    expires_in: json.expires_in,
  });
}
