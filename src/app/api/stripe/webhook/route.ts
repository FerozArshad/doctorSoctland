// Stripe webhook: confirms payments, updates patient status, schedules
// the 3 monthly instalments after a deposit, and sends receipts/alerts.
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { applyCheckoutSessionPaid } from "@/lib/stripe-checkout";
import { log, summarizeError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Browser / health-check — Stripe delivers events via POST only. */
export async function GET() {
  const configured = !!process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return NextResponse.json({
    ok: true,
    endpoint: "stripe-webhook",
    message: "This URL is for Stripe webhooks (POST only). Opening it in a browser is normal — configure it in Stripe Dashboard → Developers → Webhooks.",
    webhookSecretConfigured: configured,
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 500 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    log.warn("stripe.webhook.invalid_signature", summarizeError(e));
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const patientId = session.metadata?.patientId;
      const type = session.metadata?.type;
      if (patientId && (type === "full" || type === "deposit")) {
        await applyCheckoutSessionPaid(session, patientId, type);
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const sessionId = typeof pi.metadata?.checkout_session_id === "string" ? pi.metadata.checkout_session_id : null;
      if (sessionId) {
        const session = await stripe().checkout.sessions.retrieve(sessionId);
        const patientId = session.metadata?.patientId;
        const type = session.metadata?.type;
        if (patientId && (type === "full" || type === "deposit")) {
          await applyCheckoutSessionPaid(session, patientId, type);
        }
      }
    }
  } catch (e) {
    log.error("stripe.webhook.handler.fail", { type: event.type, ...summarizeError(e) });
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
