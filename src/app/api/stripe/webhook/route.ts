// Stripe webhook: confirms payments, updates patient status, schedules
// the 3 monthly instalments after a deposit, and sends receipts/alerts.
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { fmt, fullPricePence, instalmentPence, netPricePence } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-settings";
import { notifyAdmin, receiptEmailHtml, sendEmail } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 500 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const patientId = session.metadata?.patientId;
    const type = session.metadata?.type; // full | deposit
    if (patientId && (type === "full" || type === "deposit")) {
      await handleCheckoutPaid(session, patientId, type);
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutPaid(
  session: Stripe.Checkout.Session,
  patientId: string,
  type: "full" | "deposit"
) {
  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) return;
  const amount = session.amount_total ?? 0;
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  // Idempotency: skip if this session was already processed
  const existing = await db.payment.findUnique({ where: { stripeSessionId: session.id } });
  if (existing?.status === "paid") return;

  await db.payment.upsert({
    where: { stripeSessionId: session.id },
    update: { status: "paid", paidAt: new Date(), stripePaymentIntentId: piId },
    create: {
      patientId,
      amountPence: amount,
      type,
      status: "paid",
      paidAt: new Date(),
      stripeSessionId: session.id,
      stripePaymentIntentId: piId,
    },
  });

  if (type === "full") {
    await db.patient.update({
      where: { id: patientId },
      data: {
        status: "paid",
        amountPaidPence: fullPricePence(netPricePence(patient.pricePence, patient.upfrontPaidPence), patient.discountPct),
        activities: { create: { text: `Paid in full via secure link — ${fmt(amount)}` } },
      },
    });
    await sendEmail(patient.email, "Payment received — Dental Scotland", receiptEmailHtml(patient, amount, "paid in full")).catch(console.error);
    await notifyAdmin(`💚 ${patient.firstName} ${patient.lastName} paid in full`, `${fmt(amount)} received via Stripe. Their aligners can be ordered now.`);
    return;
  }

  // Deposit: save card for off-session charges + schedule 3 monthly instalments
  let pmId: string | null = null;
  if (piId) {
    try {
      const pi = await stripe().paymentIntents.retrieve(piId);
      pmId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null;
    } catch (e) {
      console.error("Could not retrieve payment method:", e);
    }
  }

  const cfg = await getPricing();
  const per = instalmentPence(netPricePence(patient.pricePence, patient.upfrontPaidPence), cfg.depositPence);
  const dueDates = [1, 2, 3].map((m) => {
    const d = new Date();
    d.setMonth(d.getMonth() + m);
    return d;
  });

  await db.$transaction([
    db.instalment.deleteMany({ where: { patientId, status: "scheduled" } }),
    db.patient.update({
      where: { id: patientId },
      data: {
        status: "deposit",
        // Record what Stripe actually took, not a hardcoded figure.
        amountPaidPence: amount,
        stripePaymentMethodId: pmId,
        activities: {
          create: [
            { text: `${fmt(amount)} deposit paid via secure link` },
            { text: `3 monthly instalments of ${fmt(per)} scheduled` },
          ],
        },
      },
    }),
    ...dueDates.map((dueDate, i) =>
      db.instalment.create({
        data: { patientId, number: i + 1, amountPence: per, dueDate },
      })
    ),
  ]);

  await sendEmail(
    patient.email,
    "Deposit received — Dental Scotland",
    receiptEmailHtml(patient, amount, `deposit — 3 monthly instalments of ${fmt(per)} will follow automatically`)
  ).catch(console.error);
  await notifyAdmin(
    `💚 ${patient.firstName} ${patient.lastName} paid the ${fmt(amount)} deposit`,
    `3 instalments of ${fmt(per)} scheduled monthly on their saved card.`
  );
}
