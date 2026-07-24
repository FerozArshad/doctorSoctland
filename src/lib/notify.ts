// Outbound messaging: email via Resend, WhatsApp via Meta Business Cloud API.
// Both degrade gracefully when keys are missing (logged to server console),
// so the app is fully usable in dev before credentials are added.
import { Resend } from "resend";
import type { Patient } from "@prisma/client";
import { db } from "./db";
import { estMonths, fmt, fullPricePence, instalmentPence, netPricePence, PRICING_DEFAULTS, type PricingConfig } from "./pricing";
import { gmailConfigured, sendGmail } from "./google";
import { log, summarizeError } from "./log";
import { getWhatsAppConfig, getWhatsAppHealth } from "./whatsapp-settings";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";

// Escape user-supplied text before interpolating it into email HTML.
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

// ── Email ────────────────────────────────────────────────────────────────
// fromOverride lets a proposal/sequence email come from the coordinator who sent
// it (e.g. "Millie Buchanan <millie@dentalscotland.com>"). The address must be a
// verified send-as alias on the authorised Gmail account, or Gmail rewrites it.
export async function sendEmail(to: string, subject: string, html: string, fromOverride?: string) {
  const from = fromOverride || process.env.EMAIL_FROM || "Dental Scotland <concierge@dentalscotland.com>";

  // Prefer Gmail when it's connected (GOOGLE_CLIENT_ID/SECRET + GMAIL_REFRESH_TOKEN).
  if (gmailConfigured()) {
    await sendGmail(to, subject, html, from);
    return { simulated: false, via: "gmail" as const };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:simulated] to=${to} subject="${subject}" (connect Gmail or set RESEND_API_KEY to send for real)`);
    return { simulated: true };
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });
  if (error) throw new Error("Email failed: " + error.message);
  return { simulated: false };
}

// ── WhatsApp (Meta Business Cloud API) ──────────────────────────────────
// Credentials: Super Admin portal (/admin/whatsapp) in DB, with env fallback.

export type WhatsAppSendResult = {
  simulated: boolean;
  error?: string;
  via?: "text" | "template";
  messageId?: string;
  waId?: string;
  messageStatus?: string;
};

/** True when Cloud API credentials are present (portal DB or env). */
export async function whatsappConfigured() {
  const c = await getWhatsAppConfig();
  return !!(c.token && c.phoneNumberId);
}

function resolveTemplateName(raw: string, fallback: string): string {
  const name = (raw || fallback).trim();
  const aliases: Record<string, string> = {
    proposal_ready: "payment_reminder",
    proposal: "payment_reminder",
    reminder: "porposal_ready",
    payment_reminder_correct: "porposal_ready",
  };
  return aliases[name] || name;
}

function langCode(raw: string) {
  const t = (raw || "en_GB").trim();
  if (t === "en") return "en_GB";
  return t || "en_GB";
}

async function graphSend(to: string, payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const c = await getWhatsAppConfig();
  const token = c.token.trim();
  const phoneId = c.phoneNumberId.trim();
  if (!token || !phoneId) return { simulated: true };

  // Meta may return HTTP 200 "accepted" even when the WABA cannot deliver.
  // Fail early with the real health_status blocker (e.g. 141008 inactive WABA).
  const health = await getWhatsAppHealth();
  if (health && !health.ok) {
    const top = health.blockers[0];
    const detail = top
      ? `${top.description}${top.code ? ` (code ${top.code})` : ""}${top.solution ? ` — ${top.solution}` : ""}`
      : health.summary;
    const error = JSON.stringify({
      error: {
        message: detail,
        code: top?.code || 0,
        error_data: { details: health.summary, waba_id: health.wabaId || null },
      },
    });
    log.error("whatsapp.send.blocked", {
      to,
      wabaId: health.wabaId || null,
      blockers: health.blockers,
      via: payload.type,
    });
    return { simulated: false, error };
  }

  // Cloud API expects digits only (no +).
  const toDigits = to.replace(/\D/g, "");
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", to: toDigits, ...payload }),
  });
  const raw = await res.text();
  let json: {
    error?: unknown;
    messages?: Array<{ id?: string; message_status?: string }>;
    contacts?: Array<{ input?: string; wa_id?: string }>;
  } = {};
  try {
    json = JSON.parse(raw);
  } catch {
    json = {};
  }
  if (!res.ok) {
    const summary = summarizeError(raw);
    log.error("whatsapp.send", { to: toDigits, ...summary, via: payload.type });
    return { simulated: false, error: raw };
  }
  const messageId = json.messages?.[0]?.id;
  const messageStatus = json.messages?.[0]?.message_status;
  const waId = json.contacts?.[0]?.wa_id;
  log.info("whatsapp.send", {
    to: toDigits,
    waId: waId || null,
    messageId: messageId ? messageId.slice(0, 28) + "…" : null,
    messageStatus: messageStatus || "accepted",
    via: payload.type,
    ok: true,
  });
  return {
    simulated: false,
    via: payload.type === "template" ? "template" : "text",
    messageId,
    waId,
    messageStatus,
  };
}

export async function sendWhatsApp(toPhone: string, body: string): Promise<WhatsAppSendResult> {
  const to = normalisePhone(toPhone);
  if (!(await whatsappConfigured()) || !to) {
    console.log(`[whatsapp:simulated] to=${toPhone} body="${body.slice(0, 80)}…"`);
    return { simulated: true };
  }
  const r = await graphSend(to, { type: "text", text: { preview_url: true, body } });
  return { ...r, via: "text" };
}

export async function sendWhatsAppTemplate(
  toPhone: string,
  templateName: string,
  bodyParams: string[] = [],
  opts?: { buttonCode?: string }
): Promise<WhatsAppSendResult> {
  const to = normalisePhone(toPhone);
  const c = await getWhatsAppConfig();
  if (!(await whatsappConfigured()) || !to) {
    console.log(`[whatsapp:simulated:template] to=${toPhone} name=${templateName} params=${JSON.stringify(bodyParams)}`);
    return { simulated: true };
  }
  const lang = langCode(c.templateLang);
  const components: Array<Record<string, unknown>> = [];
  if (bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    });
  }
  if (opts?.buttonCode) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: opts.buttonCode }],
    });
  }
  const r = await graphSend(to, {
    type: "template",
    template: {
      name: templateName,
      language: { code: lang },
      ...(components.length ? { components } : {}),
    },
  });
  if (r.error) {
    log.error("whatsapp.template", { to, template: templateName, lang, ...summarizeError(r.error) });
  }
  return { ...r, via: "template" };
}

export async function sendProposalWhatsApp(p: Patient): Promise<WhatsAppSendResult> {
  const body = proposalWhatsAppText(p);
  const c = await getWhatsAppConfig();
  if (c.templatesEnabled) {
    return sendWhatsAppTemplate(p.phone, resolveTemplateName(c.tplProposal, "payment_reminder"), [p.firstName, proposalLink(p)]);
  }
  if (await whatsappConfigured()) {
    console.warn("[whatsapp] templates disabled — sending free-form text (enable in Admin → WhatsApp)");
  }
  return sendWhatsApp(p.phone, body);
}

export async function sendReminderWhatsApp(p: Patient, cfg: PricingConfig = PRICING_DEFAULTS): Promise<WhatsAppSendResult> {
  const body = reminderWhatsAppText(p, cfg);
  const c = await getWhatsAppConfig();
  if (c.templatesEnabled) {
    return sendWhatsAppTemplate(p.phone, resolveTemplateName(c.tplReminder, "porposal_ready"), [p.firstName, proposalLink(p)]);
  }
  return sendWhatsApp(p.phone, body);
}

export async function sendLoginCodeWhatsApp(toPhone: string, code: string): Promise<WhatsAppSendResult> {
  const c = await getWhatsAppConfig();
  if (c.templatesEnabled) {
    return sendWhatsAppTemplate(toPhone, resolveTemplateName(c.tplLogin, "login_code"), [code], { buttonCode: code });
  }
  return sendWhatsApp(
    toPhone,
    `Your Dental Scotland verification code is *${code}*. It expires in 10 minutes. Never share this code.`
  );
}

// E.164 normalisation for common practice inputs.
// UK: 07… → +44… | Pakistan: 03… → +92… | already +country kept as-is.
export function normalisePhone(phone: string): string | null {
  let digits = (phone || "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  // Keep a single leading +
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (digits.startsWith("+")) {
    const rest = digits.slice(1).replace(/\D/g, "");
    return rest ? `+${rest}` : null;
  }
  const only = digits.replace(/\D/g, "");
  // UK mobiles
  if (only.startsWith("07") && only.length === 11) return "+44" + only.slice(1);
  if (only.startsWith("44") && only.length >= 12) return "+" + only;
  // Pakistan mobiles (03XXXXXXXXX → +923XXXXXXXXX)
  if (only.startsWith("03") && only.length === 11) return "+92" + only.slice(1);
  if (only.startsWith("92") && only.length >= 12) return "+" + only;
  // Fallback: assume already includes country code without +
  if (only.length >= 10) return "+" + only;
  return null;
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
  const waCfg = await getWhatsAppConfig();
  const wa = waCfg.adminNotifyWhatsApp;
  if (wa) {
    jobs.push(sendWhatsApp(wa, `${subject}\n${text}`).catch((e) => console.error(e)));
  }
  await Promise.all(jobs);
}

/** Email the coordinator + admin when a patient applies for finance. */
export async function notifyFinanceApplication(
  patient: Pick<Patient, "id" | "firstName" | "lastName" | "email" | "sentByEmail" | "ownerId">,
  note?: string
) {
  const name = `${patient.firstName} ${patient.lastName}`.trim();
  const link = `${appUrl()}/admin/patients/${patient.id}`;
  const subject = `📝 ${name} applied for 0% finance`;
  const text =
    `${name} (${patient.email}) signed consent and applied for 0% finance on their Invisalign proposal.` +
    (note ? ` Message: “${note}”` : "") +
    ` View: ${link}`;

  const recipients = new Set<string>();
  if (process.env.ADMIN_NOTIFY_EMAIL) recipients.add(process.env.ADMIN_NOTIFY_EMAIL);
  if (patient.sentByEmail && /.+@.+\..+/.test(patient.sentByEmail)) recipients.add(patient.sentByEmail);
  if (patient.ownerId) {
    const owner = await db.admin.findUnique({ where: { id: patient.ownerId }, select: { email: true } });
    if (owner?.email && /.+@.+\..+/.test(owner.email)) recipients.add(owner.email);
  }

  const html = brandedEmail(
    "Finance application received",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;"><strong>${escapeHtml(name)}</strong> has applied for 0% finance.</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Patient email: ${escapeHtml(patient.email)}</p>
     ${note ? `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Their message: “${escapeHtml(note)}”</p>` : ""}
     <div style="text-align:center;margin:22px 0 8px;"><a href="${link}" style="display:inline-block;background:#0E9384;color:#fff;text-decoration:none;padding:13px 26px;border-radius:11px;font-weight:800;font-size:14.5px;">Open patient record →</a></div>`
  );

  const jobs: Promise<unknown>[] = Array.from(recipients).map((to) =>
    sendEmail(to, subject, html).catch((e) => console.error("finance.notify.email.fail", to, e))
  );

  const waCfg = await getWhatsAppConfig();
  if (waCfg.adminNotifyWhatsApp) {
    jobs.push(sendWhatsApp(waCfg.adminNotifyWhatsApp, `${subject}\n${text}`).catch((e) => console.error(e)));
  }

  await Promise.all(jobs);
}

/** Welcome email when a Super Admin creates a team login. */
export function adminWelcomeEmailHtml(name: string, email: string, password: string, loginUrl: string) {
  return brandedEmail(
    "Your Dental Scotland admin login",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${escapeHtml(name)},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">A Super Admin has created your account on the Dental Scotland patient dashboard.</p>
     <table style="width:100%;border:1px solid #E7ECF2;border-radius:14px;border-collapse:separate;border-spacing:0;overflow:hidden;margin:18px 0;">
       <tr><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:13px;color:#7A8696;">Login URL</td><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:14px;font-weight:700;text-align:right;"><a href="${loginUrl}" style="color:#0E9384;">${escapeHtml(loginUrl)}</a></td></tr>
       <tr><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:13px;color:#7A8696;">Email</td><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(email)}</td></tr>
       <tr><td style="padding:12px 16px;font-size:13px;color:#7A8696;">Password</td><td style="padding:12px 16px;font-size:14px;font-weight:800;text-align:right;">${escapeHtml(password)}</td></tr>
     </table>
     <p style="font-size:13px;line-height:1.7;color:#7A8696;">Please sign in and change your password in Settings after your first login.</p>
     <div style="text-align:center;margin:22px 0 8px;"><a href="${loginUrl}" style="display:inline-block;background:#0E9384;color:#fff;text-decoration:none;padding:13px 26px;border-radius:11px;font-weight:800;font-size:14.5px;">Sign in →</a></div>`
  );
}

/** Password reset email when a Super Admin resets an existing admin login. */
export function adminPasswordResetEmailHtml(name: string, email: string, password: string, loginUrl: string) {
  return brandedEmail(
    "Your admin password has been reset",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${escapeHtml(name)},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">A Super Admin has reset your Dental Scotland dashboard password. Use the details below to sign in — this replaces any previous password.</p>
     <table style="width:100%;border:1px solid #E7ECF2;border-radius:14px;border-collapse:separate;border-spacing:0;overflow:hidden;margin:18px 0;">
       <tr><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:13px;color:#7A8696;">Login URL</td><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:14px;font-weight:700;text-align:right;"><a href="${loginUrl}" style="color:#0E9384;">${escapeHtml(loginUrl)}</a></td></tr>
       <tr><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:13px;color:#7A8696;">Email</td><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(email)}</td></tr>
       <tr><td style="padding:12px 16px;font-size:13px;color:#7A8696;">New temporary password</td><td style="padding:12px 16px;font-size:14px;font-weight:800;text-align:right;font-family:ui-monospace,monospace;">${escapeHtml(password)}</td></tr>
     </table>
     <p style="font-size:13px;line-height:1.7;color:#7A8696;">For security, change this password in <strong>Settings</strong> after you sign in. Do not share this email.</p>
     <div style="text-align:center;margin:22px 0 8px;"><a href="${loginUrl}" style="display:inline-block;background:#0E9384;color:#fff;text-decoration:none;padding:13px 26px;border-radius:11px;font-weight:800;font-size:14.5px;">Sign in with new password →</a></div>`
  );
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

export function proposalEmailHtml(p: Patient, cfg: PricingConfig = PRICING_DEFAULTS) {
  const net = netPricePence(p.pricePence, p.upfrontPaidPence);
  const full = fullPricePence(net, p.discountPct);
  const instal = instalmentPence(net, cfg.depositPence);
  const link = proposalLink(p);
  const row = (l: string, v: string, hl = false) =>
    `<tr><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:13px;color:${hl ? "#0B7A6E" : "#7A8696"};${hl ? "background:#F0FBF8;font-weight:600;" : ""}">${l}</td><td style="padding:12px 16px;border-bottom:1px solid #F1F4F8;font-size:14px;font-weight:800;text-align:right;color:${hl ? "#0B7A6E" : "#16202E"};${hl ? "background:#F0FBF8;" : ""}">${v}</td></tr>`;
  const upfrontRow =
    p.upfrontPaidPence > 0
      ? row("Booking payment received", "− " + fmt(p.upfrontPaidPence), true) +
        row("Balance remaining", fmt(net), true)
      : "";
  return brandedEmail(
    "Your Invisalign Treatment Proposal",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:0 0 8px;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:0 0 20px;">Thank you for attending your Invisalign assessment with Dental Scotland. Your personalised ClinCheck treatment plan is now complete — view it, watch your smile transformation video, and choose how you'd like to pay.</p>
     <table style="width:100%;border:1px solid #E7ECF2;border-radius:14px;border-collapse:separate;border-spacing:0;overflow:hidden;">
       ${row("Number of aligners", String(p.alignerCount))}
       ${row("Estimated treatment time", "≈ " + estMonths(p.alignerCount) + " months")}
       ${row("Treatment package", "Invisalign " + p.pkg)}
       ${row("Total investment", fmt(p.pricePence), true)}
       ${upfrontRow}
     </table>
     <p style="font-size:14px;line-height:1.7;color:#3C4a59;margin:20px 0 6px;"><strong>Your payment options:</strong></p>
     <ul style="font-size:14px;line-height:1.9;color:#3C4a59;margin:0 0 24px;padding-left:20px;">
       <li>Pay in full today — <strong>${fmt(full)}</strong> (${p.discountPct}% discount)</li>
       <li>${fmt(cfg.depositPence)} deposit, then 3 monthly instalments of <strong>${fmt(instal)}</strong></li>
       <li>0% interest-free finance over 12, 24 or 36 months</li>
     </ul>
     <div style="text-align:center;">
       <a href="${link}" style="display:inline-block;background:#0E9384;color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:11px;font-weight:800;font-size:15px;">View your proposal &amp; smile video →</a>
     </div>
     <p style="font-size:12.5px;color:#9AA6B4;text-align:center;margin:16px 0 0;">This secure link is personal to you.</p>`
  );
}

export function proposalWhatsAppText(p: Patient) {
  return `Hi ${p.firstName}! 🦷 Your personalised Invisalign treatment proposal from Dental Scotland is ready.\n\n✅ ${p.alignerCount} aligners · ≈${estMonths(p.alignerCount)} months · ${fmt(netPricePence(p.pricePence, p.upfrontPaidPence))} to pay${p.upfrontPaidPence > 0 ? ` (includes ${fmt(p.upfrontPaidPence)} booking credit)` : ""}\n🎬 Watch your smile transformation video and choose a payment option here:\n${proposalLink(p)}\n\nQuestions? Just reply to this message.`;
}

export function receiptEmailHtml(p: Patient, amountPence: number, what: string) {
  return brandedEmail(
    "Payment received — thank you!",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">We've received your payment of <strong style="color:#0B7A6E;">${fmt(amountPence)}</strong> (${what}). Our Treatment Coordinator will be in touch shortly to arrange your aligner fitting.</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">We can't wait to see your new smile!</p>`
  );
}

/** Sent after deposit — explains the 3 automatic monthly card charges. */
export function depositScheduleEmailHtml(
  p: Patient,
  depositPence: number,
  perInstalmentPence: number,
  dueDates: Date[]
) {
  const rows = dueDates
    .map(
      (d, i) =>
        `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #F1F4F8;font-size:14px;color:#3C4a59;">Instalment ${i + 1} of 3</td>
          <td style="padding:10px 14px;border-bottom:1px solid #F1F4F8;font-size:14px;font-weight:700;text-align:right;color:#16202E;">${fmt(perInstalmentPence)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #F1F4F8;font-size:13px;text-align:right;color:#7A8696;">${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
        </tr>`
    )
    .join("");
  return brandedEmail(
    "Deposit received — your instalment plan is set",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Thank you — we've received your <strong style="color:#0B7A6E;">${fmt(depositPence)}</strong> deposit. Your card has been saved securely with Stripe for <strong>exactly 3 monthly payments</strong> (not an open-ended subscription).</p>
     <table style="width:100%;border:1px solid #E7ECF2;border-radius:14px;border-collapse:separate;border-spacing:0;overflow:hidden;margin:18px 0;">
       <tr style="background:#F7FAFC;">
         <td style="padding:10px 14px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8A96A5;">Payment</td>
         <td style="padding:10px 14px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8A96A5;text-align:right;">Amount</td>
         <td style="padding:10px 14px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8A96A5;text-align:right;">Due</td>
       </tr>
       ${rows}
     </table>
     <p style="font-size:14px;line-height:1.7;color:#3C4a59;">We'll email you a reminder a few days before each charge. Receipts are sent after every successful payment.</p>
     <p style="font-size:14px;line-height:1.7;color:#3C4a59;">Questions? Just reply to this email — the Dental Scotland team is here to help.</p>`
  );
}

/** Reminder ~3 days before an automatic instalment charge. */
export function instalmentReminderEmailHtml(p: Patient, number: number, amountPence: number, dueDate: Date) {
  const when = dueDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return brandedEmail(
    `Reminder: instalment ${number}/3 due soon`,
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Friendly heads-up from Dental Scotland: instalment <strong>${number} of 3</strong> for your Invisalign treatment (<strong style="color:#0B7A6E;">${fmt(amountPence)}</strong>) is due on <strong>${when}</strong>.</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">We'll collect it automatically from the card you used for your deposit — no action needed unless your card details have changed. If they have, reply to this email and we'll help update them.</p>
     <p style="font-size:14px;line-height:1.7;color:#7A8696;">You'll get a receipt as soon as the payment goes through.</p>`
  );
}

/** Sent when an instalment charge fails or is overdue. */
export function instalmentFailedEmailHtml(p: Patient, number: number, amountPence: number, reason: string) {
  const link = proposalLink(p);
  return brandedEmail(
    `Action needed: instalment ${number}/3 payment`,
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">We weren't able to collect instalment <strong>${number} of 3</strong> (<strong style="color:#B4530A;">${fmt(amountPence)}</strong>) for your Invisalign treatment.</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Please reply to this email or contact us so we can update your payment details and keep your treatment on track.</p>
     <div style="text-align:center;margin:22px 0 8px;"><a href="${link}" style="display:inline-block;background:#0E9384;color:#fff;text-decoration:none;padding:13px 26px;border-radius:11px;font-weight:800;font-size:14.5px;">View your proposal →</a></div>`
  );
}

/** Sent when an instalment is past due but not yet collected. */
export function instalmentOverdueEmailHtml(p: Patient, number: number, amountPence: number, dueDate: Date) {
  const when = dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const link = proposalLink(p);
  return brandedEmail(
    `Overdue: instalment ${number}/3`,
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Instalment <strong>${number} of 3</strong> (<strong style="color:#B4530A;">${fmt(amountPence)}</strong>) was due on <strong>${when}</strong> and has not been collected yet.</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Please check your card details are up to date, or reply to this email and we'll help sort it out.</p>
     <div style="text-align:center;margin:22px 0 8px;"><a href="${link}" style="display:inline-block;background:#0E9384;color:#fff;text-decoration:none;padding:13px 26px;border-radius:11px;font-weight:800;font-size:14.5px;">View your proposal →</a></div>`
  );
}

export function instalmentReminderWhatsApp(p: Patient, number: number, amountPence: number, dueDate: Date) {
  const when = dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `Hi ${p.firstName} — Dental Scotland here. Friendly reminder: instalment ${number}/3 (${fmt(amountPence)}) is due on ${when}. We'll collect it automatically from your saved card. Reply if your details have changed.`;
}

export function instalmentOverdueWhatsApp(p: Patient, number: number, amountPence: number) {
  return `Hi ${p.firstName} — Dental Scotland. Instalment ${number}/3 (${fmt(amountPence)}) is overdue. Please reply so we can update your payment details and keep your treatment on track.`;
}

// ── Payment reminder (for patients who've had a proposal but not yet paid) ──
// Written in a warm, personal coordinator's voice — deliberately not generic.
export function reminderEmailHtml(p: Patient, cfg: PricingConfig = PRICING_DEFAULTS) {
  const net = netPricePence(p.pricePence, p.upfrontPaidPence);
  const full = fullPricePence(net, p.discountPct);
  const link = proposalLink(p);
  const creditLine =
    p.upfrontPaidPence > 0
      ? `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Your <strong>${fmt(p.upfrontPaidPence)}</strong> booking payment is already credited, so there's just <strong style="color:#0B7A6E;">${fmt(net)}</strong> left on your treatment.</p>`
      : `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Your treatment comes to <strong style="color:#0B7A6E;">${fmt(net)}</strong>, and you can settle it however suits you best.</p>`;
  return brandedEmail(
    `Still thinking it over, ${p.firstName}?`,
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:0 0 16px;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:0 0 16px;">It's Dental Scotland here — just a friendly note to say your personalised Invisalign plan is still ready and waiting whenever you are. There's no rush, but we didn't want you to miss it.</p>
     ${creditLine}
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:16px 0;">Prefer to pay in one go? You'll save ${p.discountPct}% and settle at <strong>${fmt(full)}</strong>. Or spread it with our ${fmt(cfg.depositPence)}-deposit plan or 0% finance — whatever feels right for you.</p>
     <div style="text-align:center;margin-top:8px;">
       <a href="${link}" style="display:inline-block;background:#0E9384;color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:11px;font-weight:800;font-size:15px;">Review your plan &amp; choose a payment option →</a>
     </div>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:20px 0 0;">If anything's holding you back or you have a question, just reply to this email — a real person will get straight back to you.</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:14px 0 0;">Warmly,<br/>The team at Dental Scotland</p>`
  );
}

// Sent when an admin approves a finance application and attaches the lender link.
export function financeLinkEmailHtml(p: Patient, link: string) {
  return brandedEmail(
    "Your 0% finance application is ready",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${p.firstName},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Thank you for applying for 0% interest-free finance for your Invisalign treatment. Your application has been reviewed and approved to proceed.</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Please continue your application with our finance partner using the secure link below:</p>
     <div style="text-align:center;margin:22px 0 6px;">
       <a href="${link}" style="display:inline-block;background:#0E9384;color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:11px;font-weight:800;font-size:15px;">Complete your finance application →</a>
     </div>
     <p style="font-size:13px;line-height:1.7;color:#7A8696;margin-top:18px;">If the button doesn't work, copy and paste this link into your browser:<br/><span style="color:#0E9384;word-break:break-all;">${link}</span></p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;margin-top:16px;">Any questions, just reply to this email — we're here to help.</p>`
  );
}

export function reminderWhatsAppText(p: Patient, cfg: PricingConfig = PRICING_DEFAULTS) {
  const net = netPricePence(p.pricePence, p.upfrontPaidPence);
  const full = fullPricePence(net, p.discountPct);
  const balance = p.upfrontPaidPence > 0 ? `${fmt(net)} to pay (includes ${fmt(p.upfrontPaidPence)} booking credit)` : `${fmt(net)}`;
  return `Hi ${p.firstName}, it's Dental Scotland 🦷 Your Invisalign plan is still saved for you — no rush at all, we just didn't want you to miss it.\n\nThere's ${balance}, and paying in full saves ${p.discountPct}% (${fmt(full)}). You can also spread it with a ${fmt(cfg.depositPence)} deposit or 0% finance.\n\nHave a look and pick what suits you here:\n${proposalLink(p)}\n\nAny questions, just reply — a real person will help. 😊`;
}
