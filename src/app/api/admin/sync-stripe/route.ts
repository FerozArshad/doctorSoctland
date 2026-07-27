import { NextRequest, NextResponse } from "next/server";
import { syncAllStripePayments } from "@/lib/stripe-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-off / cron sync — uses Vercel production Stripe keys. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.nextUrl.searchParams.get("secret");
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await syncAllStripePayments({ days: 120 });
  return NextResponse.json({ ok: true, ...result });
}
