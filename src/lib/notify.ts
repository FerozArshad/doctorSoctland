// Outbound messaging: email via Resend, WhatsApp via Meta Business Cloud API.
// Both degrade gracefully when keys are missing (logged to server console),
// so the app is fully usable in dev before credentials are added.
import { Resend } from "resend";
import type { Patient } from "@prisma/client";
import { estMonths, fmt, fullPricePence, instalmentPence, netPricePence, PRICING_DEFAULTS, type PricingConfig } from "./pricing";
import { gmailConfigured, sendGmail } from "./google";
import { log, summarizeError } from "./log";

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
// Keys: WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID (already in env).
// Business-initiated messages need approved templates. Flip
// WHATSAPP_TEMPLATES_ENABLED=1 after Meta approves display name + templates.
// Until then we fall back to free-form text (works in test / open 24h window).

export type WhatsAppSendResult = {
  simulated: boolean;
  error?: string;
  via?: "text" | "template";
  messageId?: string;
  waId?: string;
  messageStatus?: string;
};

/** True when Cloud API credentials are present. */
export function whatsappConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** True when we're allowed to send approved templates (go-live switch). */
export function whatsappTemplatesEnabled() {
  const v = (process.env.WHATSAPP_TEMPLATES_ENABLED || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const waLang = () => {
  const raw = (process.env.WHATSAPP_TEMPLATE_LANG || "en_GB").trim();
  // Meta templates are en_GB — bare "en" causes (#132001) Template name does not exist in the translation
  if (raw === "en") return "en_GB";
  return raw || "en_GB";
};

/**
 * Template names — must match WhatsApp Manager exactly.
 * Note (2026-07-23): Meta templates were created with a typo + swapped bodies:
 *  - `payment_reminder` body = "plan is ready…" (use for proposal send)
 *  - `porposal_ready` body = "reminder…" (use for reminder send)
 * Aliases map common mistakes (proposal_ready / en) so Vercel misconfig still works.
 */
function resolveTemplateName(raw: string, fallback: string): string {
  const name = (raw || fallback).trim();
  const aliases: Record<string, string> = {
    proposal_ready: "payment_reminder", // never created in Meta; body lives on payment_reminder
    proposal: "payment_reminder",
    reminder: "porposal_ready",
    payment_reminder_correct: "porposal_ready",
  };
  return aliases[name] || name;
}

export const WA_TEMPLATES = {
  proposal: resolveTemplateName(process.env.WHATSAPP_TPL_PROPOSAL || "", "payment_reminder"),
  reminder: resolveTemplateName(process.env.WHATSAPP_TPL_REMINDER || "", "porposal_ready"),
  loginCode: resolveTemplateName(process.env.WHATSAPP_TPL_LOGIN || "", "login_code"),
} as const;

async function graphSend(to: string, payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_TOKEN!.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
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
    log.error("whatsapp.send", { to, ...summary, via: payload.type });
    return { simulated: false, error: raw };
  }
  const messageId = json.messages?.[0]?.id;
  const messageStatus = json.messages?.[0]?.message_status;
  const waId = json.contacts?.[0]?.wa_id;
  log.info("whatsapp.send", {
    to,
    waId: waId || null,
    messageId: messageId || null,
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

/** Free-form text (24h service window / test numbers). */
export async function sendWhatsApp(toPhone: string, body: string): Promise<WhatsAppSendResult> {
  const to = normalisePhone(toPhone);
  if (!whatsappConfigured() || !to) {
    console.log(`[whatsapp:simulated] to=${toPhone} body="${body.slice(0, 80)}…"`);
    return { simulated: true };
  }
  const r = await graphSend(to, { type: "text", text: { preview_url: true, body } });
  return { ...r, via: "text" };
}

/** Named utility / auth template with body {{1}}, {{2}}, … parameters.
 *  Auth copy-code templates also need the OTP repeated on the URL button.
 */
export async function sendWhatsAppTemplate(
  toPhone: string,
  templateName: string,
  bodyParams: string[] = [],
  opts?: { buttonCode?: string }
): Promise<WhatsAppSendResult> {
  const to = normalisePhone(toPhone);
  if (!whatsappConfigured() || !to) {
    console.log(`[whatsapp:simulated:template] to=${toPhone} name=${templateName} params=${JSON.stringify(bodyParams)}`);
    return { simulated: true };
  }
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
      language: { code: waLang() },
      ...(components.length ? { components } : {}),
    },
  });
  if (r.error) {
    log.error("whatsapp.template", {
      to,
      template: templateName,
      lang: waLang(),
      ...summarizeError(r.error),
    });
  }
  return { ...r, via: "template" };
}

/**
 * Proposal outbound: template when enabled, else text fallback.
 * Uses Meta template whose body is the "plan is ready" copy (see WA_TEMPLATES).
 */
export async function sendProposalWhatsApp(p: Patient): Promise<WhatsAppSendResult> {
  const body = proposalWhatsAppText(p);
  if (whatsappTemplatesEnabled()) {
    return sendWhatsAppTemplate(p.phone, WA_TEMPLATES.proposal, [p.firstName, proposalLink(p)]);
  }
  if (whatsappConfigured()) {
    console.warn("[whatsapp] WHATSAPP_TEMPLATES_ENABLED is off — sending free-form text (set to 1 after Meta approves templates)");
  }
  return sendWhatsApp(p.phone, body);
}

/**
 * Day-1 sequence reminder.
 * Uses Meta template whose body is the reminder copy (see WA_TEMPLATES).
 */
export async function sendReminderWhatsApp(p: Patient, cfg: PricingConfig = PRICING_DEFAULTS): Promise<WhatsAppSendResult> {
  const body = reminderWhatsAppText(p, cfg);
  if (whatsappTemplatesEnabled()) {
    return sendWhatsAppTemplate(p.phone, WA_TEMPLATES.reminder, [p.firstName, proposalLink(p)]);
  }
  return sendWhatsApp(p.phone, body);
}

/**
 * OTP / login code.
 * Authentication template `login_code` needs body {{1}} + Copy-code button param.
 */
export async function sendLoginCodeWhatsApp(toPhone: string, code: string): Promise<WhatsAppSendResult> {
  if (whatsappTemplatesEnabled()) {
    return sendWhatsAppTemplate(toPhone, WA_TEMPLATES.loginCode, [code], { buttonCode: code });
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
  const balance = p.upfrontPaidPence > 0 ? `just ${fmt(net)} left (your ${fmt(p.upfrontPaidPence)} booking is already credited)` : `${fmt(net)}`;
  return `Hi ${p.firstName}, it's Dental Scotland 🦷 Your Invisalign plan is still saved for you — no rush at all, we just didn't want you to miss it.\n\nThere's ${balance}, and paying in full saves ${p.discountPct}% (${fmt(full)}). You can also spread it with a ${fmt(cfg.depositPence)} deposit or 0% finance.\n\nHave a look and pick what suits you here:\n${proposalLink(p)}\n\nAny questions, just reply — a real person will help. 😊`;
}
