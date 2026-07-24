// Drives the 7-touch follow-up sequence for unconverted quotes.
// Run DAILY: GET /api/cron/reminders with Authorization: Bearer <CRON_SECRET>
// Touches fire on days 1,4,10,20,26,29,30 after proposalSentAt. At day 30 the
// price lock expires — we stop emailing and flag the patient for a requote.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { warmGoogleAccessToken } from "@/lib/google";
import { brandedEmail, notifyAdmin, sendEmail, sendWhatsApp } from "@/lib/notify";
import { firstNameOf } from "@/lib/status";
import { getPricing } from "@/lib/pricing-settings";
import { receivesProposalFollowUps } from "@/lib/follow-ups";
import { LOCK_DAYS, TOUCHES, dueTouch, seqValues } from "@/lib/sequence";
import { fromHeader } from "@/lib/coordinators";
import { bearerMatches } from "@/lib/secure";
import { log, summarizeError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proposal delivered but not yet converted. Paid/deposit/finance patients are
// filtered in code via receivesProposalFollowUps().
const UNPAID_STATUSES = ["sent", "interested", "awaiting"];

export async function GET(req: NextRequest) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  // Keep the Gmail access token warm before the daily email batch.
  if (process.env.GMAIL_REFRESH_TOKEN) {
    warmGoogleAccessToken().catch((e) =>
      log.warn("gmail.token.warm.fail", { error: summarizeError(e) })
    );
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const cfg = await getPricing();

  // 1st of the month: remind every admin to file last month's report (this
  // route runs daily at 09:00, so the reminder lands that morning).
  const today = new Date();
  if (today.getDate() === 1) {
    const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const monthName = last.toLocaleString("en-GB", { month: "long", year: "numeric" });
    const link = `${appUrl}/admin/reports?m=${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
    const admins = await db.admin.findMany();
    for (const a of admins) {
      const filed = await db.monthlyReport.findUnique({
        where: { adminId_year_month: { adminId: a.id, year: last.getFullYear(), month: last.getMonth() + 1 } },
      });
      if (filed) continue; // already on record — no nag needed
      await sendEmail(
        a.email,
        `Monthly report due — ${monthName}`,
        brandedEmail(
          "Your monthly report is due",
          `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${firstNameOf(a.name)},</p>
           <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Your <strong>${monthName}</strong> report is due today. It takes about two minutes — consults seen, how many went ahead, and bonding/veneer figures. Invisalign orders and income are calculated for you.</p>
           <div style="text-align:center;margin:22px 0 8px;"><a href="${link}" style="display:inline-block;background:#0E9384;color:#fff;text-decoration:none;padding:13px 26px;border-radius:11px;font-weight:800;font-size:14.5px;">File your ${monthName} report →</a></div>`
        )
      ).catch(console.error);
    }
  }
  const patients = await db.patient.findMany({
    where: { sequenceTouch: { lt: TOUCHES.length }, priceLockExpired: false },
  });

  const results: Array<{ patient: string; touch: number | null; sent: boolean; note?: string }> = [];

  for (const p of patients) {
    if (!receivesProposalFollowUps(p)) {
      results.push({ patient: `${p.firstName} ${p.lastName}`.trim(), touch: null, sent: false, note: "follow-ups stopped" });
      continue;
    }
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

    // WhatsApp on every touch (copy matches the 7-message sequence).
    let waNote = "";
    if (sent && p.phone && p.phone !== "—") {
      const waBody = touch.whatsapp(p, v);
      try {
        const r = await sendWhatsApp(p.phone, waBody);
        if (r.error) {
          log.error("sequence.whatsapp.fail", { patientId: p.id, touch: touch.n, ...summarizeError(r.error) });
          waNote = " · WhatsApp not sent";
        } else if (r.simulated) {
          waNote = " · WhatsApp not sent";
          log.warn("sequence.whatsapp.simulated", { patientId: p.id, touch: touch.n });
        } else {
          waNote = " · WhatsApp sent";
          log.info("sequence.whatsapp.ok", { patientId: p.id, touch: touch.n, messageId: r.messageId || null });
        }
      } catch (e) {
        waNote = " · WhatsApp not sent";
        log.error("sequence.whatsapp.fail", { patientId: p.id, touch: touch.n, ...summarizeError(e) });
      }
    }

    if (sent) {
      await db.patient.update({
        where: { id: p.id },
        data: {
          sequenceTouch: touch.n,
          activities: { create: { text: `Follow-up ${touch.n}/7 sent — ${touch.label}${waNote}` } },
        },
      });
    }
    results.push({ patient: `${p.firstName} ${p.lastName}`.trim(), touch: touch.n, sent });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
