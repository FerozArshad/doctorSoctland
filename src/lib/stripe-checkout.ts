// Shared Stripe Checkout completion logic — used by webhook and fallback sync.
import type Stripe from "stripe";
import { db } from "./db";
import { stripe } from "./stripe";
import { fmt, fullPricePence, instalmentPence, netPricePence } from "./pricing";
import { getPricing } from "./pricing-settings";
import { notifyAdmin, depositScheduleEmailHtml, sendEmail } from "./notify";
import { issuePaymentReceipt } from "./payment-receipt";
import { log, summarizeError } from "./log";
import { FOLLOW_UPS_COMPLETE_TOUCH } from "./follow-ups";

export type CheckoutType = "full" | "deposit";

export async function applyCheckoutSessionPaid(
  session: Stripe.Checkout.Session,
  patientId: string,
  type: CheckoutType
): Promise<{ applied: boolean; reason?: string }> {
  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) return { applied: false, reason: "patient_not_found" };

  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { applied: false, reason: "session_not_paid" };
  }

  const amount = session.amount_total ?? 0;
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  const existing = await db.payment.findUnique({ where: { stripeSessionId: session.id } });
  if (existing?.status === "paid") return { applied: false, reason: "already_paid" };

  const paymentRecord = await db.payment.upsert({
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
        sequenceTouch: FOLLOW_UPS_COMPLETE_TOUCH,
        activities: { create: { text: `Paid in full via secure link — ${fmt(amount)}` } },
      },
    });
    await issuePaymentReceipt(paymentRecord.id).catch((e) => log.error("payment.receipt.fail", summarizeError(e)));
    await notifyAdmin(
      `💚 ${patient.firstName} ${patient.lastName} paid in full`,
      `${fmt(amount)} received via Stripe.${piId ? ` Transaction: ${piId}.` : ""} Their aligners can be ordered now. View: ${(process.env.APP_URL || "https://dashboard.dentalscotland.com").replace(/\/$/, "")}/admin/patients/${patientId}`
    );
    log.info("stripe.checkout.applied", { patientId, type, sessionId: session.id, amount });
    return { applied: true };
  }

  let pmId: string | null = null;
  if (piId) {
    try {
      const pi = await stripe().paymentIntents.retrieve(piId);
      pmId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null;
    } catch (e) {
      log.error("stripe.payment_method.fail", summarizeError(e));
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
        sequenceTouch: FOLLOW_UPS_COMPLETE_TOUCH,
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
    "Deposit received — your instalment plan is set — Dental Scotland",
    depositScheduleEmailHtml(patient, amount, per, dueDates)
  ).catch((e) => log.error("stripe.deposit.email.fail", summarizeError(e)));
  await issuePaymentReceipt(paymentRecord.id).catch((e) => log.error("payment.receipt.fail", summarizeError(e)));
  await notifyAdmin(
    `💚 ${patient.firstName} ${patient.lastName} paid the ${fmt(amount)} deposit`,
    `3 instalments of ${fmt(per)} scheduled monthly on their saved card.${piId ? ` Transaction: ${piId}.` : ""} View: ${(process.env.APP_URL || "https://dashboard.dentalscotland.com").replace(/\/$/, "")}/admin/patients/${patientId}`
  );
  log.info("stripe.checkout.applied", { patientId, type, sessionId: session.id, amount });
  return { applied: true };
}

/** Sync a single Stripe Checkout session by ID (fallback when webhook missed). */
export async function syncCheckoutSession(sessionId: string): Promise<{ applied: boolean; reason?: string }> {
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  const patientId = session.metadata?.patientId;
  const type = session.metadata?.type;
  if (!patientId || (type !== "full" && type !== "deposit")) {
    return { applied: false, reason: "invalid_metadata" };
  }
  return applyCheckoutSessionPaid(session, patientId, type);
}

/** Sync all pending Stripe payments for a patient (e.g. after return from Checkout). */
export async function syncPatientStripePayments(patientId: string): Promise<{ synced: number }> {
  const pending = await db.payment.findMany({
    where: {
      patientId,
      status: { in: ["pending", "failed"] },
      stripeSessionId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  let synced = 0;
  for (const p of pending) {
    if (!p.stripeSessionId) continue;
    try {
      const result = await syncCheckoutSession(p.stripeSessionId);
      if (result.applied) synced++;
    } catch (e) {
      log.error("stripe.sync.session.fail", { patientId, sessionId: p.stripeSessionId, ...summarizeError(e) });
    }
  }
  return { synced };
}

/** Bulk sync: pending DB rows + recent completed Stripe Checkout sessions with patient metadata. */
export async function syncAllStripePayments(opts?: { days?: number }): Promise<{
  synced: number;
  checked: number;
  skipped: number;
  errors: number;
}> {
  const days = opts?.days ?? 90;
  const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  let synced = 0;
  let checked = 0;
  let skipped = 0;
  let errors = 0;

  const pending = await db.payment.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      stripeSessionId: { not: null },
    },
    select: { stripeSessionId: true, patientId: true },
  });
  const sessionIds = new Set<string>();
  for (const p of pending) {
    if (p.stripeSessionId) sessionIds.add(p.stripeSessionId);
  }

  // Also pull completed sessions from Stripe (catches paid checkouts with no pending row).
  let startingAfter: string | undefined;
  for (let page = 0; page < 20; page++) {
    const list = await stripe().checkout.sessions.list({
      limit: 100,
      created: { gte: since },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const s of list.data) {
      if (s.payment_status === "paid" || s.status === "complete") {
        if (s.metadata?.patientId) sessionIds.add(s.id);
      }
    }
    if (!list.has_more || !list.data.length) break;
    startingAfter = list.data[list.data.length - 1]?.id;
  }

  for (const sessionId of Array.from(sessionIds)) {
    checked++;
    try {
      const result = await syncCheckoutSession(sessionId);
      if (result.applied) synced++;
      else skipped++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/no such checkout\.session/i.test(msg)) {
        // Only mark failed when the session truly doesn't exist in this Stripe account.
        // Wrong API key (test vs live) also returns this — leave the row retryable.
        const key = process.env.STRIPE_SECRET_KEY || "";
        const liveSession = sessionId.startsWith("cs_live_");
        const testSession = sessionId.startsWith("cs_test_");
        const keyMismatch =
          (liveSession && key.startsWith("sk_test_")) || (testSession && key.startsWith("sk_live_"));
        if (!keyMismatch) {
          await db.payment.updateMany({
            where: { stripeSessionId: sessionId, status: { in: ["pending", "failed"] } },
            data: { status: "failed" },
          });
        }
        skipped++;
      } else {
        errors++;
        log.error("stripe.sync.all.fail", { sessionId, ...summarizeError(e) });
      }
    }
  }

  log.info("stripe.sync.all.done", { synced, checked, skipped, errors });
  return { synced, checked, skipped, errors };
}
