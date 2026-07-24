// Collects due instalments off-session using each patient's saved card.
// Also emails/WhatsApps reminders ~3 days before each charge, and alerts
// admin + patient when overdue or failed.
//   GET /api/cron/instalments  with header  Authorization: Bearer <CRON_SECRET>
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { fmt, netPricePence } from "@/lib/pricing";
import {
  instalmentFailedEmailHtml,
  instalmentOverdueEmailHtml,
  instalmentOverdueWhatsApp,
  instalmentReminderEmailHtml,
  instalmentReminderWhatsApp,
  notifyAdmin,
  receiptEmailHtml,
  sendEmail,
  sendWhatsApp,
} from "@/lib/notify";
import { bearerMatches } from "@/lib/secure";
import { log, summarizeError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDER_DAYS = 3;
const OVERDUE_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function dueLabel(dueDate: Date) {
  return dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

async function alertedRecently(patientId: string, prefix: string) {
  const since = new Date(Date.now() - OVERDUE_ALERT_COOLDOWN_MS);
  const recent = await db.activity.findFirst({
    where: { patientId, text: { startsWith: prefix }, createdAt: { gte: since } },
    select: { id: true },
  });
  return !!recent;
}

export async function GET(req: NextRequest) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 500 });
  }

  const now = new Date();
  const reminderHorizon = new Date(now.getTime() + REMINDER_DAYS * 86400000);

  // ── 1. Pre-charge reminders (due within 3 days) ───────────────────────
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
      const p = inst.patient;
      await sendEmail(
        p.email,
        `Reminder: instalment ${inst.number}/3 due soon — Dental Scotland`,
        instalmentReminderEmailHtml(p, inst.number, inst.amountPence, inst.dueDate)
      );
      if (p.phone) {
        await sendWhatsApp(p.phone, instalmentReminderWhatsApp(p, inst.number, inst.amountPence, inst.dueDate));
      }
      await notifyAdmin(
        `📅 Instalment due soon — ${p.firstName} ${p.lastName}`,
        `Instalment ${inst.number}/3 (${fmt(inst.amountPence)}) due ${dueLabel(inst.dueDate)}. Reminder sent to patient.`
      );
      await db.instalment.update({
        where: { id: inst.id },
        data: { reminderSentAt: new Date() },
      });
      await db.activity.create({
        data: {
          patientId: inst.patientId,
          text: `Instalment ${inst.number}/3 reminder sent (${fmt(inst.amountPence)} due ${dueLabel(inst.dueDate)})`,
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
      const reason = "no saved card on file";
      results.push({ instalment: inst.id, ok: false, detail: reason });
      const prefix = `Instalment overdue alert:`;
      if (!(await alertedRecently(p.id, prefix))) {
        await sendEmail(
          p.email,
          `Overdue: instalment ${inst.number}/3 — Dental Scotland`,
          instalmentOverdueEmailHtml(p, inst.number, inst.amountPence, inst.dueDate)
        ).catch(console.error);
        if (p.phone) {
          await sendWhatsApp(p.phone, instalmentOverdueWhatsApp(p, inst.number, inst.amountPence)).catch(console.error);
        }
        await notifyAdmin(
          `⚠️ Instalment overdue — ${p.firstName} ${p.lastName}`,
          `Instalment ${inst.number}/3 (${fmt(inst.amountPence)}) was due ${dueLabel(inst.dueDate)} but ${reason}. Patient alerted.`
        );
        await db.activity.create({
          data: {
            patientId: p.id,
            text: `${prefix} ${inst.number}/3 — ${reason} (${fmt(inst.amountPence)} due ${dueLabel(inst.dueDate)})`,
          },
        });
      }
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
      await sendEmail(
        p.email,
        `Action needed: instalment ${inst.number}/3 — Dental Scotland`,
        instalmentFailedEmailHtml(p, inst.number, inst.amountPence, detail)
      ).catch(console.error);
      if (p.phone) {
        await sendWhatsApp(
          p.phone,
          `Hi ${p.firstName} — Dental Scotland. We couldn't collect instalment ${inst.number}/3 (${fmt(inst.amountPence)}). Please reply so we can update your payment details.`
        ).catch(console.error);
      }
      await notifyAdmin(
        `⚠️ Instalment failed for ${p.firstName} ${p.lastName}`,
        `Instalment ${inst.number}/3 (${fmt(inst.amountPence)}) could not be collected: ${detail}. Patient alerted.`
      );
      results.push({ instalment: inst.id, ok: false, detail });
      log.error("instalment.charge.fail", { instalmentId: inst.id, ...summarizeError(e) });
    }
  }

  // ── 3. Daily overdue follow-up for failed instalments ─────────────────
  let overdueAlerts = 0;
  const failed = await db.instalment.findMany({
    where: { status: "failed" },
    include: { patient: true },
  });
  for (const inst of failed) {
    const p = inst.patient;
    const prefix = `Instalment failed alert:`;
    if (await alertedRecently(p.id, prefix)) continue;
    await sendEmail(
      p.email,
      `Reminder: instalment ${inst.number}/3 still outstanding — Dental Scotland`,
      instalmentFailedEmailHtml(p, inst.number, inst.amountPence, "previous collection attempt failed")
    ).catch(console.error);
    if (p.phone) {
      await sendWhatsApp(p.phone, instalmentOverdueWhatsApp(p, inst.number, inst.amountPence)).catch(console.error);
    }
    await notifyAdmin(
      `⚠️ Instalment still outstanding — ${p.firstName} ${p.lastName}`,
      `Instalment ${inst.number}/3 (${fmt(inst.amountPence)}) remains unpaid after a failed charge. Patient reminded.`
    );
    await db.activity.create({
      data: {
        patientId: p.id,
        text: `${prefix} ${inst.number}/3 (${fmt(inst.amountPence)})`,
      },
    });
    overdueAlerts++;
  }

  return NextResponse.json({
    remindersSent,
    processed: results.length,
    overdueAlerts,
    results,
  });
}
