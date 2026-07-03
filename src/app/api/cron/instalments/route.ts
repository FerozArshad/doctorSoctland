// Collects due instalments off-session using each patient's saved card.
// Call daily (Vercel Cron / Windows Task Scheduler / any scheduler):
//   GET /api/cron/instalments  with header  Authorization: Bearer <CRON_SECRET>
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { fmt, fullPricePence } from "@/lib/pricing";
import { notifyAdmin, receiptEmailHtml, sendEmail } from "@/lib/notify";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  // Missing/placeholder CRON_SECRET must fail closed, not compare equal.
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.startsWith("change-me") || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 500 });
  }

  const due = await db.instalment.findMany({
    where: { status: "scheduled", dueDate: { lte: new Date() } },
    include: { patient: true },
  });

  const results: Array<{ instalment: string; ok: boolean; detail?: string }> = [];

  for (const inst of due) {
    const p = inst.patient;
    if (!p.stripeCustomerId || !p.stripePaymentMethodId) {
      results.push({ instalment: inst.id, ok: false, detail: "no saved card" });
      continue;
    }
    try {
      const pi = await stripe().paymentIntents.create({
        amount: inst.amountPence,
        currency: "gbp",
        customer: p.stripeCustomerId,
        payment_method: p.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Invisalign instalment ${inst.number}/3 — ${p.firstName} ${p.lastName}`,
      });

      const newPaid = p.amountPaidPence + inst.amountPence;
      const fullTarget = fullPricePence(p.pricePence, 0); // instalment plan pays full price
      const done = inst.number === 3 || newPaid >= fullTarget;

      await db.$transaction([
        db.instalment.update({
          where: { id: inst.id },
          data: { status: "paid", paidAt: new Date(), stripePaymentIntentId: pi.id },
        }),
        db.payment.create({
          data: { patientId: p.id, amountPence: inst.amountPence, type: "instalment", status: "paid", paidAt: new Date(), stripePaymentIntentId: pi.id },
        }),
        db.patient.update({
          where: { id: p.id },
          data: {
            amountPaidPence: newPaid,
            status: done ? "paid" : "deposit",
            activities: { create: { text: `Instalment ${inst.number}/3 collected — ${fmt(inst.amountPence)}` } },
          },
        }),
      ]);

      await sendEmail(p.email, "Instalment received — Dental Scotland", receiptEmailHtml(p, inst.amountPence, `instalment ${inst.number} of 3`)).catch(console.error);
      results.push({ instalment: inst.id, ok: true });
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e);
      await db.$transaction([
        db.instalment.update({ where: { id: inst.id }, data: { status: "failed" } }),
        db.patient.update({
          where: { id: p.id },
          data: {
            status: "overdue",
            activities: { create: { text: `Instalment ${inst.number}/3 failed — ${detail.slice(0, 120)}` } },
          },
        }),
      ]);
      await notifyAdmin(
        `⚠️ Instalment failed for ${p.firstName} ${p.lastName}`,
        `Instalment ${inst.number}/3 (${fmt(inst.amountPence)}) could not be collected: ${detail}`
      );
      results.push({ instalment: inst.id, ok: false, detail });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
