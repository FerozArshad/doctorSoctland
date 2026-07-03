// Outbound messaging: email via Resend, WhatsApp via Meta Business Cloud API.
// Both degrade gracefully when keys are missing (logged to server console),
// so the app is fully usable in dev before credentials are added.
import { Resend } from "resend";
import type { Patient } from "@prisma/client";
import { estMonths, fmt, fullPricePence, instalmentPence } from "./pricing";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";

// Escape user-supplied text before interpolating it into email HTML.
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

// ── Email ────────────────────────────────────────────────────────────────
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:simulated] to=${to} subject="${subject}" (set RESEND_API_KEY to send for real)`);
    return { simulated: true };
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Dental Scotland <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  if (error) throw new Error("Email failed: " + error.message);
  return { simulated: false };
}

// ── WhatsApp (Meta Business Cloud API) ──────────────────────────────────
// Note: business-initiated conversations outside a 24h window require an
// approved message template. This sends a plain text message, which works
// inside an open conversation window and in the API test environment.
export async function sendWhatsApp(toPhone: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = normalisePhone(toPhone);
  if (!token || !phoneId || !to) {
    console.log(`[whatsapp:simulated] to=${toPhone} body="${body.slice(0, 80)}…"`);
    return { simulated: true };
  }
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: true, body },
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    console.error("WhatsApp send failed:", detail);
    return { simulated: false, error: detail };
  }
  return { simulated: false };
}

// UK mobiles: 07700 900123 → +447700900123
export function normalisePhone(phone: string): string | null {
  const digits = (phone || "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("07")) return "+44" + digits.slice(1);
  if (digits.startsWith("44")) return "+" + digits;
  return "+" + digits;
}

// ── Admin alerts (email + WhatsApp to the practice) ─────────────────────
export async function notifyAdmin(subject: string, text: string) {
  const jobs: Promise<unknown>[] = [];
  const email = process.env.ADMIN_NOTIFY_EMAIL;
  if (email) {
    jobs.push(
      sendEmail(email, subject, brandedEmail(escapeHtml(subject), `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">${escapeHtml(text)}</p>`)).catch((e) => console.error(e))
    );
  }
  const wa = process.env.ADMIN_NOTIFY_WHATSAPP;
  if (wa) {
    jobs.push(sendWhatsApp(wa, `${subject}\n${text}`).catch((e) => console.error(e)));
  }
  await Promise.all(jobs);
}

// ── Templates ───────────────────────────────────────────────────────────
export function proposalLink(p: Patient) {
  return `${appUrl()}/p/${p.proposalToken}`;
}

export function brandedEmail(title: string, bodyHtml: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#EAF0F2;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px -20px rgba(11,24,40,.3);">
      <div style="background:#0E1A2B;padding:26px 36px;">
        <div style="color:#ffffff;font-size:20px;font-weight:800;">Dental Scotland</div>
        <div style="color:#8FA6C0;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-top:2px;">It's time to smile</div>
      </div>
      <div style="padding:34px 36px;">
        <h1 style="font-size:24px;font-weight:800;margin:0 0 16px;color:#16202E;">${title}</h1>
        ${bodyHtml}
      </div>
    </div>
    <div style="text-align:center;color:#9AA6B4;font-size:12px;line-height:1.7;margin-top:20px;">Dental Scotland · dentalscotland.com<br>This proposal is valid for 30 days.</div>
  </div>
</body></html>`;
}

export function proposalEmailHtml(p: Patient) {
  const full = fullPricePence(p.pricePence, p.discountPct);
  const instal = instalmentPence(p.pricePence);
  const link = proposalLink(p);
  const row = (l: string, v: string, hl = false) =>
    `<tr><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:13px;color:${hl ? "#0B7A6E" : "#7A8696"};${hl ? "background:#F0FBF8;font-weight:600;" : ""}">${l}</td><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:14px;font-weight:800;text-align:right;color:${hl ? "#0B7A6E" : "#16202E"};${hl ? "background:#F0FBF8;" : ""}">${v}</td></tr>`;
  return brandedEmail(
    "Your Invisalign Treatment Proposal",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:0 0 8px;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:0 0 20px;">Thank you for attending your Invisalign assessment with Dental Scotland. Your personalised ClinCheck treatment plan is now complete — view it, watch your smile transformation video, and choose how you'd like to pay.</p>
     <table style="width:100%;border:1px solid #E7ECF2;border-radius:14px;border-collapse:separate;border-spacing:0;overflow:hidden;">
       ${row("Number of aligners", String(p.alignerCount))}
       ${row("Estimated treatment time", "≈ " + estMonths(p.alignerCount) + " months")}
       ${row("Treatment package", "Invisalign " + p.pkg)}
       ${row("Total investment", fmt(p.pricePence), true)}
     </table>
     <p style="font-size:14px;line-height:1.7;color:#3C4a59;margin:20px 0 6px;"><strong>Your payment options:</strong></p>
     <ul style="font-size:14px;line-height:1.9;color:#3C4a59;margin:0 0 24px;padding-left:20px;">
       <li>Pay in full today — <strong>${fmt(full)}</strong> (${p.discountPct}% discount)</li>
       <li>£700 deposit, then 3 monthly instalments of <strong>${fmt(instal)}</strong></li>
       <li>0% interest-free finance over 12, 24 or 36 months</li>
     </ul>
     <div style="text-align:center;">
       <a href="${link}" style="display:inline-block;background:#0E9384;color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:11px;font-weight:800;font-size:15px;">View your proposal &amp; smile video →</a>
     </div>
     <p style="font-size:12.5px;color:#9AA6B4;text-align:center;margin:16px 0 0;">This secure link is personal to you.</p>`
  );
}

export function proposalWhatsAppText(p: Patient) {
  return `Hi ${p.firstName}! 🦷 Your personalised Invisalign treatment proposal from Dental Scotland is ready.\n\n✅ ${p.alignerCount} aligners · ≈${estMonths(p.alignerCount)} months · ${fmt(p.pricePence)}\n🎬 Watch your smile transformation video and choose a payment option here:\n${proposalLink(p)}\n\nQuestions? Just reply to this message.`;
}

export function receiptEmailHtml(p: Patient, amountPence: number, what: string) {
  return brandedEmail(
    "Payment received — thank you!",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">We've received your payment of <strong style="color:#0B7A6E;">${fmt(amountPence)}</strong> (${what}). Our Treatment Coordinator will be in touch shortly to arrange your aligner fitting.</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">We can't wait to see your new smile!</p>`
  );
}
