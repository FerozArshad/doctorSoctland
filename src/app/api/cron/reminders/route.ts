// Drives the 7-touch follow-up sequence for unconverted quotes.
// Run DAILY: GET /api/cron/reminders with Authorization: Bearer <CRON_SECRET>
// Touches fire on days 1,4,10,20,26,29,30 after proposalSentAt. At day 30 the
// price lock expires — we stop emailing and flag the patient for a requote.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyAdmin, sendEmail, sendWhatsApp, reminderWhatsAppText } from "@/lib/notify";
import { getPricing } from "@/lib/pricing-settings";
import { dueTouch, seqValues, LOCK_DAYS, TOUCHES } from "@/lib/sequence";
import { fromHeader } from "@/lib/coordinators";

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

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const cfg = await getPricing();
  const patients = await db.patient.findMany({
    where: { status: { in: UNPAID_STATUSES }, sequenceTouch: { lt: TOUCHES.length }, priceLockExpired: false },
  });

  const results: Array<{ patient: string; touch: number | null; sent: boolean; note?: string }> = [];

  for (const p of patients) {
    const start = p.proposalSentAt ?? p.createdAt;
    const days = Math.floor((Date.now() - start.getTime()) / 86400000);

    // Past the lock window: stop the sequence and flag for a requote.
    if (days > LOCK_DAYS) {
      await db.patient.update({
        where: { id: p.id },
        data: {
          priceLockExpired: true,
          activities: { create: { text: `${LOCK_DAYS}-day price lock expired — requote needed` } },
        },
      });
      await notifyAdmin(
        `⏳ Price lock expired — ${p.firstName} ${p.lastName}`.trim(),
        `Their ${LOCK_DAYS}-day quote window has closed and the follow-up sequence has stopped. Requote if you want to re-engage: ${appUrl}/admin/patients/${p.id}`
      );
      results.push({ patient: `${p.firstName} ${p.lastName}`.trim(), touch: null, sent: false, note: "lock expired" });
      continue;
    }

    const touch = dueTouch(days, p.sequenceTouch);
    if (!touch) {
      results.push({ patient: `${p.firstName} ${p.lastName}`.trim(), touch: null, sent: false, note: `day ${days} — nothing due` });
      continue;
    }

    const v = seqValues(p, cfg, appUrl);
    let sent = false;
    try {
      await sendEmail(p.email, touch.subject(p, v), touch.html(p, v), fromHeader(v.co));
      sent = true;
    } catch (e) {
      console.error(`sequence touch ${touch.n} to ${p.email} failed:`, e);
    }

    // WhatsApp only on the first touch — daily WhatsApp would be intrusive.
    if (sent && touch.n === 1 && p.phone && p.phone !== "—") {
      await sendWhatsApp(p.phone, reminderWhatsAppText(p, cfg)).catch(() => {});
    }

    if (sent) {
      await db.patient.update({
        where: { id: p.id },
        data: {
          sequenceTouch: touch.n,
          activities: { create: { text: `Follow-up ${touch.n}/7 sent — ${touch.label}` } },
        },
      });
    }
    results.push({ patient: `${p.firstName} ${p.lastName}`.trim(), touch: touch.n, sent });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
