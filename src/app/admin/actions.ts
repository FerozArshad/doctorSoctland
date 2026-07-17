"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clearAdminSession, createAdminSession, requireAdmin } from "@/lib/auth";
import { fmt, fullPricePence, netPricePence, priceForPence } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-settings";
import { COORDINATORS, coordinatorFor, fromHeader, FALLBACK_COORDINATOR, type Coordinator } from "@/lib/coordinators";
import { financeLinkEmailHtml, proposalEmailHtml, proposalWhatsAppText, sendEmail, sendWhatsApp } from "@/lib/notify";

function toastUrl(base: string, msg: string, icon = "✓", bg = "#0E9384") {
  const q = new URLSearchParams({ toast: msg, ticon: icon, tbg: bg });
  return `${base}?${q.toString()}`;
}

// ── Auth ────────────────────────────────────────────────────────────────
export async function adminLogin(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  // Max 10 attempts per email per 15 minutes — enough to stop brute force, but
  // forgiving of a few mistyped attempts. Distinct error so a lockout isn't
  // indistinguishable from a wrong password (correct creds would fail silently).
  // NOTE: in-memory, so it resets on redeploy and is per-instance on serverless.
  const { rateLimit } = await import("@/lib/ratelimit");
  if (!rateLimit(`alogin:${email}`, 10, 15 * 60 * 1000)) redirect("/admin/login?error=locked");
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

// ── Pricing settings ────────────────────────────────────────────────────
// Editable by any admin. Changing these affects NEW/edited proposals only —
// existing patients keep the pricePence/discountPct captured at proposal time,
// so no one's agreed price ever changes retroactively.
export async function updatePricing(formData: FormData) {
  const admin = await requireAdmin();
  const cur = await getPricing();

  // Form takes pounds; we store pence.
  const pence = (key: string, fallback: number) => {
    const n = Math.round(parseFloat(String(formData.get(key) ?? "")) * 100);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const whole = (key: string, fallback: number, max: number) => {
    const n = parseInt(String(formData.get(key) ?? ""), 10);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
  };

  const data = {
    tier1MaxAligners: whole("tier1MaxAligners", cur.tier1MaxAligners, 40),
    tier1Pence: pence("tier1Pounds", cur.tier1Pence),
    tier2MaxAligners: whole("tier2MaxAligners", cur.tier2MaxAligners, 40),
    tier2Pence: pence("tier2Pounds", cur.tier2Pence),
    tier3Pence: pence("tier3Pounds", cur.tier3Pence),
    depositPence: pence("depositPounds", cur.depositPence),
    upfrontPence: pence("upfrontPounds", cur.upfrontPence),
    discountPct: whole("discountPct", cur.discountPct, 100),
    updatedByEmail: admin.email,
  };

  // A deposit above the cheapest treatment would make instalments negative.
  if (data.depositPence >= data.tier1Pence) {
    redirect(toastUrl("/admin/settings", "Deposit must be less than the lowest treatment price", "!", "#E0A429"));
  }

  await db.pricing.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  redirect(toastUrl("/admin/settings", "Pricing updated — applies to new & edited proposals", "✓"));
}

// Reads the "sent by" picker: a known coordinator key, or "other" + free text.
function pickCoordinator(formData: FormData): Coordinator {
  const key = String(formData.get("sentByKey") || "");
  const known = COORDINATORS.find((c) => c.key === key);
  if (known) return known;
  if (key === "other") {
    const name = String(formData.get("sentByOtherName") || "").trim();
    const email = String(formData.get("sentByOtherEmail") || "").trim().toLowerCase();
    if (name && /.+@.+\..+/.test(email)) return { key: "other", name, email, title: "Treatment Coordinator" };
  }
  return FALLBACK_COORDINATOR;
}

// ── Patients ────────────────────────────────────────────────────────────
export async function createPatient(formData: FormData) {
  await requireAdmin();
  const cfg = await getPricing();
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
      pricePence: priceForPence(alignerCount, cfg),
      discountPct: cfg.discountPct,
      activities: { create: { text: "Draft proposal created" } },
    },
  });

  if (send) {
    await deliverProposal(patient.id, pickCoordinator(formData));
    redirect(toastUrl(`/admin/patients/${patient.id}`, `Patient created & proposal sent to ${firstName}`, "✉"));
  }
  redirect(toastUrl(`/admin/patients/${patient.id}`, `Draft saved for ${firstName}`));
}

// Edit an existing patient — allowed at any status (even after paid/done).
export async function updatePatient(formData: FormData) {
  await requireAdmin();
  const cfg = await getPricing();
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
      pricePence: priceForPence(alignerCount, cfg),
      upfrontPaidPence: paidUpfront ? cfg.upfrontPence : 0,
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
// `sentBy` is the coordinator the proposal goes out from; it also starts the
// 30-day price lock and the 7-touch follow-up sequence.
async function deliverProposal(patientId: string, sentBy?: Coordinator) {
  const cfg = await getPricing();
  const patient = await db.patient.findUniqueOrThrow({ where: { id: patientId } });
  const co = sentBy ?? coordinatorFor(patient.sentByName, patient.sentByEmail);
  const results: string[] = [];
  try {
    await sendEmail(
      patient.email,
      "Your Invisalign Treatment Proposal — Dental Scotland",
      proposalEmailHtml(patient, cfg),
      fromHeader(co)
    );
    results.push(`Proposal emailed to ${patient.email} from ${co.name}`);
  } catch (e) {
    console.error(e);
    results.push(`Email to ${patient.email} failed — check the email configuration`);
  }
  if (patient.phone && patient.phone !== "—") {
    const r = await sendWhatsApp(patient.phone, proposalWhatsAppText(patient));
    if (!("error" in r && r.error)) results.push(`WhatsApp sent to ${patient.phone}`);
  }
  await db.patient.update({
    where: { id: patientId },
    data: {
      status: patient.status === "draft" ? "sent" : patient.status,
      // Restart the clock + sequence on every (re)send so the price lock is honest.
      proposalSentAt: new Date(),
      sequenceTouch: 0,
      priceLockExpired: false,
      sentByName: co.name,
      sentByEmail: co.email,
      activities: { create: results.map((text) => ({ text })) },
    },
  });
}

export async function sendProposal(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("patientId"));
  const patient = await db.patient.findUniqueOrThrow({ where: { id } });
  const co = pickCoordinator(formData);
  await deliverProposal(id, co);
  redirect(toastUrl(`/admin/patients/${id}`, `Proposal emailed to ${patient.firstName} from ${co.name}`, "✉"));
}

export async function recordDeposit(formData: FormData) {
  await requireAdmin();
  const cfg = await getPricing();
  const dep = cfg.depositPence;
  const id = String(formData.get("patientId"));
  await db.patient.update({
    where: { id },
    data: {
      status: "deposit",
      amountPaidPence: dep,
      activities: { create: { text: `${fmt(dep)} deposit recorded` } },
      payments: { create: { amountPence: dep, type: "manual", status: "paid", paidAt: new Date() } },
    },
  });
  redirect(toastUrl(`/admin/patients/${id}`, `${fmt(dep)} deposit recorded`));
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
