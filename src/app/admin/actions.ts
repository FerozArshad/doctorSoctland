"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clearAdminSession, createAdminSession, requireAdmin } from "@/lib/auth";
import { defaultDiscountPct, fmt, fullPricePence, netPricePence, priceForPence, UPFRONT_PENCE } from "@/lib/pricing";
import { financeLinkEmailHtml, proposalEmailHtml, proposalWhatsAppText, sendEmail, sendWhatsApp } from "@/lib/notify";

function toastUrl(base: string, msg: string, icon = "✓", bg = "#0E9384") {
  const q = new URLSearchParams({ toast: msg, ticon: icon, tbg: bg });
  return `${base}?${q.toString()}`;
}

// ── Auth ────────────────────────────────────────────────────────────────
export async function adminLogin(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  // Max 5 attempts per email per 15 minutes. Use a distinct error so a lockout
  // isn't indistinguishable from a wrong password (correct creds fail silently).
  const { rateLimit } = await import("@/lib/ratelimit");
  if (!rateLimit(`alogin:${email}`, 5, 15 * 60 * 1000)) redirect("/admin/login?error=locked");
  const admin = await db.admin.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession(admin.id);
  redirect("/admin");
}

export async function adminLogout() {
  clearAdminSession();
  redirect("/admin/login");
}

// ── Patients ────────────────────────────────────────────────────────────
export async function createPatient(formData: FormData) {
  await requireAdmin();
  const send = formData.get("intent") === "send";
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const alignerCount = Math.min(40, Math.max(1, parseInt(String(formData.get("alignerCount") || "14"), 10) || 14));
  const pkg = formData.get("pkg") === "Express" ? "Express" : "Go";
  const videoUrl = String(formData.get("videoUrl") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!firstName || !/.+@.+\..+/.test(email)) redirect("/admin/patients/new?error=1");

  const existing = await db.patient.findUnique({ where: { email } });
  if (existing) {
    redirect(toastUrl(`/admin/patients/${existing.id}`, "A patient with that email already exists", "!", "#E0A429"));
  }

  const patient = await db.patient.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      alignerCount,
      pkg,
      videoUrl,
      notes,
      status: "draft",
      pricePence: priceForPence(alignerCount),
      discountPct: defaultDiscountPct(),
      activities: { create: { text: "Draft proposal created" } },
    },
  });

  if (send) {
    await deliverProposal(patient.id);
    redirect(toastUrl(`/admin/patients/${patient.id}`, `Patient created & proposal sent to ${firstName}`, "✉"));
  }
  redirect(toastUrl(`/admin/patients/${patient.id}`, `Draft saved for ${firstName}`));
}

// Edit an existing patient — allowed at any status (even after paid/done).
export async function updatePatient(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("patientId"));
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const alignerCount = Math.min(40, Math.max(1, parseInt(String(formData.get("alignerCount") || "14"), 10) || 14));
  const pkg = formData.get("pkg") === "Express" ? "Express" : "Go";
  const videoUrl = String(formData.get("videoUrl") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const paidUpfront = formData.get("paidUpfront") === "on";

  if (!firstName || !/.+@.+\..+/.test(email)) {
    redirect(toastUrl(`/admin/patients/${id}/edit`, "A first name and valid email are required", "!", "#E0A429"));
  }
  const clash = await db.patient.findFirst({ where: { email, NOT: { id } } });
  if (clash) {
    redirect(toastUrl(`/admin/patients/${id}/edit`, "Another patient already uses that email", "!", "#E0A429"));
  }

  await db.patient.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      phone,
      alignerCount,
      pkg,
      videoUrl,
      notes,
      pricePence: priceForPence(alignerCount),
      upfrontPaidPence: paidUpfront ? UPFRONT_PENCE : 0,
      activities: { create: { text: "Patient details updated by admin" } },
    },
  });
  redirect(toastUrl(`/admin/patients/${id}`, "Patient details updated", "✓"));
}

// Approve a finance application: save the lender link and auto-email it to the patient.
export async function approveFinance(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("patientId"));
  const financeLink = String(formData.get("financeLink") || "").trim();
  if (!/^https?:\/\/.+/i.test(financeLink)) {
    redirect(toastUrl(`/admin/patients/${id}`, "Enter a valid finance link (https://…)", "!", "#E0A429"));
  }
  const patient = await db.patient.findUniqueOrThrow({ where: { id } });

  await db.patient.update({
    where: { id },
    data: {
      financeLink,
      financeApprovedAt: new Date(),
      activities: { create: { text: "Finance application approved — link emailed to patient" } },
    },
  });

  let emailOk = true;
  try {
    await sendEmail(patient.email, "Your 0% finance application is ready — Dental Scotland", financeLinkEmailHtml(patient, financeLink));
  } catch (e) {
    console.error(e);
    emailOk = false;
  }
  // redirect() throws NEXT_REDIRECT — must be called outside the try/catch.
  if (emailOk) redirect(toastUrl(`/admin/patients/${id}`, `Approved — finance link emailed to ${patient.firstName}`, "✉"));
  redirect(toastUrl(`/admin/patients/${id}`, "Saved, but the email failed to send — check email config", "!", "#E0A429"));
}

// Sends the proposal by email + WhatsApp and logs activity.
async function deliverProposal(patientId: string) {
  const patient = await db.patient.findUniqueOrThrow({ where: { id: patientId } });
  const results: string[] = [];
  try {
    await sendEmail(patient.email, "Your Invisalign Treatment Proposal — Dental Scotland", proposalEmailHtml(patient));
    results.push(`Proposal emailed to ${patient.email}`);
  } catch (e) {
    console.error(e);
    results.push(`Email to ${patient.email} failed — check RESEND_API_KEY`);
  }
  if (patient.phone && patient.phone !== "—") {
    const r = await sendWhatsApp(patient.phone, proposalWhatsAppText(patient));
    if (!("error" in r && r.error)) results.push(`WhatsApp sent to ${patient.phone}`);
  }
  await db.patient.update({
    where: { id: patientId },
    data: {
      status: patient.status === "draft" ? "sent" : patient.status,
      activities: { create: results.map((text) => ({ text })) },
    },
  });
}

export async function sendProposal(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("patientId"));
  const patient = await db.patient.findUniqueOrThrow({ where: { id } });
  await deliverProposal(id);
  redirect(toastUrl(`/admin/patients/${id}`, `Proposal emailed to ${patient.firstName}`, "✉"));
}

export async function recordDeposit(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("patientId"));
  await db.patient.update({
    where: { id },
    data: {
      status: "deposit",
      amountPaidPence: 70_000,
      activities: { create: { text: "£700 deposit recorded" } },
      payments: { create: { amountPence: 70_000, type: "manual", status: "paid", paidAt: new Date() } },
    },
  });
  redirect(toastUrl(`/admin/patients/${id}`, "£700 deposit recorded"));
}

export async function markPaid(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("patientId"));
  const patient = await db.patient.findUniqueOrThrow({ where: { id } });
  const full = fullPricePence(netPricePence(patient.pricePence, patient.upfrontPaidPence), patient.discountPct);
  await db.patient.update({
    where: { id },
    data: {
      status: "paid",
      amountPaidPence: full,
      activities: { create: { text: `Marked paid in full — ${fmt(full)}` } },
      payments: { create: { amountPence: full - patient.amountPaidPence, type: "manual", status: "paid", paidAt: new Date() } },
    },
  });
  redirect(toastUrl(`/admin/patients/${id}`, "Marked paid in full"));
}

// Free-form admin message to the patient (email and/or WhatsApp).
export async function sendMessage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("patientId"));
  const channel = String(formData.get("channel") || "email");
  const body = String(formData.get("body") || "").trim();
  const patient = await db.patient.findUniqueOrThrow({ where: { id } });
  if (!body) redirect(`/admin/patients/${id}`);

  const logs: string[] = [];
  if (channel === "email" || channel === "both") {
    try {
      const { brandedEmail, escapeHtml } = await import("@/lib/notify");
      await sendEmail(
        patient.email,
        "A message from Dental Scotland",
        brandedEmail("A message from your Treatment Coordinator", `<p style="font-size:15px;line-height:1.7;color:#3C4a59;white-space:pre-wrap;">${escapeHtml(body)}</p>`)
      );
      logs.push("Email sent: “" + body.slice(0, 60) + (body.length > 60 ? "…" : "") + "”");
    } catch (e) {
      console.error(e);
      logs.push("Email failed — check RESEND_API_KEY");
    }
  }
  if ((channel === "whatsapp" || channel === "both") && patient.phone) {
    await sendWhatsApp(patient.phone, body);
    logs.push("WhatsApp sent: “" + body.slice(0, 60) + (body.length > 60 ? "…" : "") + "”");
  }
  await db.patient.update({
    where: { id },
    data: { activities: { create: logs.map((text) => ({ text })) } },
  });
  redirect(toastUrl(`/admin/patients/${id}`, `Message sent to ${patient.firstName}`, "✉"));
}
