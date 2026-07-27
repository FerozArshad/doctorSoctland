// Payment receipt generation, storage, and email delivery — only after paid status.
import type { Patient, Payment } from "@prisma/client";
import { db } from "./db";
import { fmt, fullPricePence, netPricePence } from "./pricing";
import { brandedEmail, escapeHtml, sendEmail } from "./notify";
import { paymentReceiptLabel, paymentServiceDescription, treatmentCopy } from "./treatments";
import { stripe, stripeConfigured } from "./stripe";
import { log, summarizeError } from "./log";

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export type ReceiptLine = { label: string; value: string };

export type ReceiptData = {
  receiptNumber: string;
  patient: Pick<Patient, "id" | "firstName" | "lastName" | "email" | "phone" | "alignerCount" | "pkg" | "proposalToken" | "treatmentType" | "includeWhitening">;
  amountPence: number;
  paidAt: Date;
  paymentMethod: string;
  transactionId: string;
  serviceDescription: string;
  outstandingBalancePence: number;
  lines: ReceiptLine[];
  receiptUrl: string;
};

function paymentTypeLabel(type: string, treatmentType: string | null | undefined): string {
  return paymentReceiptLabel(type, treatmentType);
}

function serviceDescription(patient: Patient, payment: Payment): string {
  const base = paymentServiceDescription(patient.treatmentType, patient.pkg, patient.alignerCount, patient.includeWhitening);
  if (payment.type === "full") return `${base} — paid in full`;
  if (payment.type === "deposit") return `${base} — deposit`;
  if (payment.type === "instalment") return `${base} — instalment payment`;
  return base;
}

async function resolvePaymentMethod(payment: Payment): Promise<string> {
  if (payment.type === "manual") return "Recorded by practice";
  if (!payment.stripePaymentIntentId || !stripeConfigured()) return "Card (Stripe)";
  try {
    const pi = await stripe().paymentIntents.retrieve(payment.stripePaymentIntentId);
    if (typeof pi.payment_method === "string") {
      const pm = await stripe().paymentMethods.retrieve(pi.payment_method);
      if (pm.card) {
        const brand = pm.card.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : "Card";
        return `${brand} •••• ${pm.card.last4}`;
      }
    }
    return "Card (Stripe)";
  } catch {
    return "Card (Stripe)";
  }
}

async function nextReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DS-${year}-`;
  const latest = await db.paymentReceipt.findFirst({
    where: { receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  const seq = latest ? parseInt(latest.receiptNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

export function buildReceiptHtml(data: ReceiptData): string {
  const rows = data.lines
    .map(
      (row) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #EEF2F6;font-size:13.5px;color:#5C6a79;width:42%;">${escapeHtml(row.label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #EEF2F6;font-size:13.5px;font-weight:700;color:#16202E;text-align:right;">${escapeHtml(row.value)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Receipt ${escapeHtml(data.receiptNumber)}</title></head>
<body style="margin:0;padding:24px 16px;background:#EAF0F2;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px -20px rgba(11,24,40,.25);">
    <div style="background:#0E1A2B;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <div style="color:#fff;font-size:22px;font-weight:800;">Dental Scotland</div>
        <div style="color:#8FA6C0;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-top:4px;">It's time to smile</div>
      </div>
      <div style="text-align:right;color:#C5D4E6;font-size:12px;line-height:1.5;">
        <div style="font-weight:800;color:#fff;font-size:13px;">PAYMENT RECEIPT</div>
        <div>${escapeHtml(data.receiptNumber)}</div>
      </div>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="margin-top:20px;padding:16px 18px;border-radius:12px;background:#F0FBF8;border:1px solid #CFEDE5;display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <span style="font-size:14px;font-weight:800;color:#0B7A6E;">Amount paid</span>
        <span style="font-size:26px;font-weight:800;color:#0B7A6E;">${fmt(data.amountPence)}</span>
      </div>
      ${
        data.outstandingBalancePence > 0
          ? `<p style="margin:14px 0 0;font-size:13.5px;color:#5C6a79;line-height:1.55;">Outstanding balance after this payment: <strong>${fmt(data.outstandingBalancePence)}</strong></p>`
          : `<p style="margin:14px 0 0;font-size:13.5px;color:#1C7C3A;font-weight:700;">No outstanding balance — thank you.</p>`
      }
      <p style="margin:18px 0 0;font-size:12.5px;color:#9AA6B4;line-height:1.6;">
        This receipt was issued by Dental Scotland. For queries contact concierge@dentalscotland.com.
      </p>
    </div>
  </div>
</body></html>`;
}

export function paymentConfirmationEmailHtml(data: ReceiptData): string {
  const copy = treatmentCopy(data.patient.treatmentType);
  const paidAt = data.paidAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return brandedEmail(
    "Payment received — thank you!",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${escapeHtml(data.patient.firstName)},</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">We've successfully received your payment. Here are the details:</p>
     <table style="width:100%;border:1px solid #E7ECF2;border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden;margin:16px 0;">
       <tr style="background:#F7FAFC;"><td style="padding:10px 14px;font-size:13px;color:#5C6a79;">Patient</td><td style="padding:10px 14px;font-size:13px;font-weight:700;text-align:right;color:#16202E;">${escapeHtml(data.patient.firstName)} ${escapeHtml(data.patient.lastName)}</td></tr>
       <tr><td style="padding:10px 14px;font-size:13px;color:#5C6a79;border-top:1px solid #EEF2F6;">Amount</td><td style="padding:10px 14px;font-size:13px;font-weight:800;text-align:right;color:#0B7A6E;border-top:1px solid #EEF2F6;">${fmt(data.amountPence)}</td></tr>
       <tr><td style="padding:10px 14px;font-size:13px;color:#5C6a79;border-top:1px solid #EEF2F6;">Date &amp; time</td><td style="padding:10px 14px;font-size:13px;font-weight:700;text-align:right;color:#16202E;border-top:1px solid #EEF2F6;">${escapeHtml(paidAt)}</td></tr>
       <tr><td style="padding:10px 14px;font-size:13px;color:#5C6a79;border-top:1px solid #EEF2F6;">Payment method</td><td style="padding:10px 14px;font-size:13px;font-weight:700;text-align:right;color:#16202E;border-top:1px solid #EEF2F6;">${escapeHtml(data.paymentMethod)}</td></tr>
       <tr><td style="padding:10px 14px;font-size:13px;color:#5C6a79;border-top:1px solid #EEF2F6;">Transaction ID</td><td style="padding:10px 14px;font-size:11px;font-weight:600;text-align:right;color:#16202E;border-top:1px solid #EEF2F6;word-break:break-all;">${escapeHtml(data.transactionId || "—")}</td></tr>
       <tr><td style="padding:10px 14px;font-size:13px;color:#5C6a79;border-top:1px solid #EEF2F6;">For</td><td style="padding:10px 14px;font-size:13px;font-weight:700;text-align:right;color:#16202E;border-top:1px solid #EEF2F6;">${escapeHtml(data.serviceDescription)}</td></tr>
       ${
         data.outstandingBalancePence > 0
           ? `<tr><td style="padding:10px 14px;font-size:13px;color:#5C6a79;border-top:1px solid #EEF2F6;">Outstanding</td><td style="padding:10px 14px;font-size:13px;font-weight:700;text-align:right;color:#B7791F;border-top:1px solid #EEF2F6;">${fmt(data.outstandingBalancePence)}</td></tr>`
           : ""
       }
     </table>
     <p style="font-size:14px;line-height:1.7;color:#3C4a59;">Your receipt <strong>${escapeHtml(data.receiptNumber)}</strong> is available in your proposal portal.</p>
     <div style="text-align:center;margin:22px 0 8px;">
       <a href="${data.receiptUrl}" style="display:inline-block;background:#0E9384;color:#fff;text-decoration:none;padding:13px 26px;border-radius:11px;font-weight:800;font-size:14.5px;">View receipt →</a>
     </div>
     <p style="font-size:14px;line-height:1.7;color:#3C4a59;">${copy.receiptNextSteps}</p>`
  );
}

export function receiptEmailBodyHtml(data: ReceiptData, receiptHtml: string): string {
  return (
    brandedEmail(
      `Your receipt ${data.receiptNumber}`,
      `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${escapeHtml(data.patient.firstName)},</p>
       <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Please find your payment receipt for <strong style="color:#0B7A6E;">${fmt(data.amountPence)}</strong>.</p>
       <p style="font-size:14px;line-height:1.7;color:#3C4a59;">Receipt: <strong>${escapeHtml(data.receiptNumber)}</strong> · Transaction: ${escapeHtml(data.transactionId || "—")}</p>
       <div style="text-align:center;margin:22px 0 8px;">
         <a href="${data.receiptUrl}" style="display:inline-block;background:#0E9384;color:#fff;text-decoration:none;padding:13px 26px;border-radius:11px;font-weight:800;font-size:14.5px;">View / download receipt →</a>
       </div>`
    ) +
    `<div style="max-width:640px;margin:12px auto 0;padding:0 16px;">${receiptHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || ""}</div>`
  );
}

async function buildReceiptData(patient: Patient, payment: Payment): Promise<ReceiptData> {
  const net = netPricePence(patient.pricePence, patient.upfrontPaidPence);
  const fullTarget = fullPricePence(net, patient.discountPct);
  const outstanding = Math.max(0, fullTarget - patient.amountPaidPence);
  const paidAt = payment.paidAt || new Date();
  const paymentMethod = await resolvePaymentMethod(payment);
  const transactionId = payment.stripePaymentIntentId || payment.stripeSessionId || payment.id;
  const receiptNumber = await nextReceiptNumber();

  const lines: ReceiptLine[] = [
    { label: "Receipt number", value: receiptNumber },
    { label: "Patient", value: `${patient.firstName} ${patient.lastName}`.trim() },
    { label: "Email", value: patient.email },
    ...(patient.phone ? [{ label: "Phone", value: patient.phone }] : []),
    {
      label: "Payment date",
      value: paidAt.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    },
    { label: "Payment method", value: paymentMethod },
    { label: "Transaction ID", value: transactionId },
    { label: "Services", value: serviceDescription(patient, payment) },
    { label: "Payment type", value: paymentTypeLabel(payment.type, patient.treatmentType) },
  ];

  return {
    receiptNumber,
    patient,
    amountPence: payment.amountPence,
    paidAt,
    paymentMethod,
    transactionId,
    serviceDescription: serviceDescription(patient, payment),
    outstandingBalancePence: outstanding,
    lines,
    receiptUrl: "",
  };
}

/** Create receipt + send confirmation & receipt emails. Only for status=paid. Idempotent. */
export async function issuePaymentReceipt(paymentId: string): Promise<{ receiptId: string; emailed: boolean } | null> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { patient: true, receipt: true },
  });
  if (!payment || payment.status !== "paid") return null;
  if (payment.receipt) return { receiptId: payment.receipt.id, emailed: !!payment.receipt.emailSentAt };

  const freshPatient = await db.patient.findUnique({ where: { id: payment.patientId } });
  if (!freshPatient) return null;

  const data = await buildReceiptData(freshPatient, payment);
  const htmlBody = buildReceiptHtml(data);

  const receipt = await db.paymentReceipt.create({
    data: {
      receiptNumber: data.receiptNumber,
      patientId: payment.patientId,
      paymentId: payment.id,
      amountPence: payment.amountPence,
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId,
      serviceDescription: data.serviceDescription,
      outstandingBalancePence: data.outstandingBalancePence,
      htmlBody,
    },
  });

  data.receiptUrl = `${appUrl()}/api/receipts/${receipt.id}`;

  let emailed = false;
  let emailLogId = "";

  try {
    const confirm = await sendEmail(
      payment.patient.email,
      `Payment received — ${fmt(payment.amountPence)} — Dental Scotland`,
      paymentConfirmationEmailHtml(data),
      undefined,
      { category: "payment_confirmation", patientId: payment.patientId, metadata: { receiptId: receipt.id, paymentId } }
    );
    emailLogId = confirm.logId || "";
    emailed = true;
  } catch (e) {
    log.error("payment.confirmation.email.fail", { paymentId, ...summarizeError(e) });
  }

  try {
    const receiptMail = await sendEmail(
      payment.patient.email,
      `Receipt ${data.receiptNumber} — Dental Scotland`,
      receiptEmailBodyHtml(data, htmlBody),
      undefined,
      { category: "receipt", patientId: payment.patientId, metadata: { receiptId: receipt.id, paymentId } }
    );
    if (!emailLogId) emailLogId = receiptMail.logId || "";
    emailed = true;
  } catch (e) {
    log.error("payment.receipt.email.fail", { paymentId, ...summarizeError(e) });
  }

  if (emailed) {
    await db.paymentReceipt.update({
      where: { id: receipt.id },
      data: { emailSentAt: new Date(), emailLogId },
    });
  }

  await db.activity.create({
    data: {
      patientId: payment.patientId,
      text: `Receipt ${data.receiptNumber} issued for ${fmt(payment.amountPence)}${emailed ? " — emailed to patient" : " — email delivery failed"}`,
    },
  });

  log.info("payment.receipt.issued", {
    paymentId,
    receiptId: receipt.id,
    receiptNumber: data.receiptNumber,
    emailed,
  });

  return { receiptId: receipt.id, emailed };
}

/** Admin resend — does not create a new receipt. */
export async function resendPaymentReceipt(receiptId: string): Promise<{ ok: boolean; error?: string }> {
  const receipt = await db.paymentReceipt.findUnique({
    where: { id: receiptId },
    include: { patient: true, payment: true },
  });
  if (!receipt) return { ok: false, error: "Receipt not found" };
  if (receipt.payment.status !== "paid") return { ok: false, error: "Payment is not completed" };

  const data: ReceiptData = {
    receiptNumber: receipt.receiptNumber,
    patient: receipt.patient,
    amountPence: receipt.amountPence,
    paidAt: receipt.payment.paidAt || receipt.createdAt,
    paymentMethod: receipt.paymentMethod,
    transactionId: receipt.transactionId,
    serviceDescription: receipt.serviceDescription,
    outstandingBalancePence: receipt.outstandingBalancePence,
    lines: [],
    receiptUrl: `${appUrl()}/api/receipts/${receipt.id}`,
  };

  try {
    await sendEmail(
      receipt.patient.email,
      `Receipt ${receipt.receiptNumber} — Dental Scotland`,
      receiptEmailBodyHtml(data, receipt.htmlBody),
      undefined,
      { category: "receipt", patientId: receipt.patientId, metadata: { receiptId, resent: true } }
    );
    await db.paymentReceipt.update({ where: { id: receiptId }, data: { emailSentAt: new Date() } });
    await db.activity.create({
      data: { patientId: receipt.patientId, text: `Receipt ${receipt.receiptNumber} resent to patient by admin` },
    });
    return { ok: true };
  } catch (e) {
    log.error("payment.receipt.resend.fail", { receiptId, ...summarizeError(e) });
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}
