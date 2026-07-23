// Collects due instalments off-session using each patient's saved card.
// Also emails reminders ~3 days before each charge.
//   GET /api/cron/instalments  with header  Authorization: Bearer <CRON_SECRET>
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { fmt, netPricePence } from "@/lib/pricing";
import { instalmentReminderEmailHtml, notifyAdmin, receiptEmailHtml, sendEmail } from "@/lib/notify";
import { bearerMatches } from "@/lib/secure";
import { log, summarizeError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDER_DAYS = 3;

export async function GET(req: NextRequest) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 500 });
  }

  const now = new Date();
  const reminderHorizon = new Date(now.getTime() + REMINDER_DAYS * 86400000);

  // ── 1. Pre-charge reminders ───────────────────────────────────────────
  const upcoming = await db.instalment.findMany({
    where: {
      status: "scheduled",
      reminderSentAt: null,
      dueDate: { gt: now, lte: reminderHorizon },
    },
    include: { patient: true },
  });

  let remindersSent = 0;
  for (const inst of upcoming) {
    try {
      await sendEmail(
        inst.patient.email,
        `Reminder: instalment ${inst.number}/3 due soon — Dental Scotland`,
        instalmentReminderEmailHtml(inst.patient, inst.number, inst.amountPence, inst.dueDate)
      );
      await db.instalment.update({
        where: { id: inst.id },
        data: {
          reminderSentAt: new Date(),
        },
      });
      await db.activity.create({
        data: {
          patientId: inst.patientId,
          text: `Instalment ${inst.number}/3 reminder emailed (${fmt(inst.amountPence)} due ${inst.dueDate.toLocaleDateString("en-GB")})`,
        },
      });
      remindersSent++;
    } catch (e) {
      log.error("instalment.reminder.fail", { instalmentId: inst.id, ...summarizeError(e) });
    }
  }

  // ── 2. Collect due instalments ────────────────────────────────────────
  const due = await db.instalment.findMany({
    where: { status: "scheduled", dueDate: { lte: now } },
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
        statement_descriptor_suffix: "DENTAL",
      });

      const newPaid = p.amountPaidPence + inst.amountPence;
      const fullTarget = netPricePence(p.pricePence, p.upfrontPaidPence);
      const done = inst.number === 3 || newPaid >= fullTarget;

      await db.$transaction([
        db.instalment.update({
          where: { id: inst.id },
          data: { status: "paid", paidAt: new Date(), stripePaymentIntentId: pi.id },
        }),
        db.payment.create({
          data: {
            patientId: p.id,
            amountPence: inst.amountPence,
            type: "instalment",
            status: "paid",
            paidAt: new Date(),
            stripePaymentIntentId: pi.id,
          },
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

      await sendEmail(
        p.email,
        `Instalment ${inst.number}/3 received — Dental Scotland`,
        receiptEmailHtml(p, inst.amountPence, `instalment ${inst.number} of 3`)
      ).catch(console.error);
      results.push({ instalment: inst.id, ok: true });
      log.info("instalment.charge.ok", { instalmentId: inst.id, number: inst.number, patientId: p.id });
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
      log.error("instalment.charge.fail", { instalmentId: inst.id, ...summarizeError(e) });
    }
  }

  return NextResponse.json({
    remindersSent,
    processed: results.length,
    results,
  });
}
