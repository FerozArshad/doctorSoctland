// Sends a friendly payment reminder to patients who have a proposal but haven't
// paid yet. Intended to run twice a day (e.g. 09:00 and 17:00).
//   GET /api/cron/reminders  with header  Authorization: Bearer <CRON_SECRET>
// Delivers by email AND WhatsApp (each degrades gracefully if unconfigured).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reminderEmailHtml, reminderWhatsAppText, sendEmail, sendWhatsApp } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proposal delivered but not yet paid. Excludes draft (not sent), deposit & paid.
const UNPAID_STATUSES = ["sent", "interested", "awaiting", "overdue"];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.startsWith("change-me") || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const patients = await db.patient.findMany({ where: { status: { in: UNPAID_STATUSES } } });

  const results: Array<{ patient: string; email: boolean; whatsapp: boolean }> = [];
  for (const p of patients) {
    let emailOk = false;
    let waOk = false;
    try {
      await sendEmail(p.email, `Your Invisalign plan is waiting, ${p.firstName}`, reminderEmailHtml(p));
      emailOk = true;
    } catch (e) {
      console.error(`reminder email to ${p.email} failed:`, e);
    }
    if (p.phone && p.phone !== "—") {
      const r = await sendWhatsApp(p.phone, reminderWhatsAppText(p));
      waOk = !("error" in r && r.error);
    }
    await db.patient.update({
      where: { id: p.id },
      data: { activities: { create: { text: `Payment reminder sent${emailOk ? " (email)" : ""}${waOk ? " (WhatsApp)" : ""}`.trim() } } },
    });
    results.push({ patient: `${p.firstName} ${p.lastName}`.trim(), email: emailOk, whatsapp: waOk });
  }

  return NextResponse.json({ ok: true, remindersSent: results.length, results });
}
