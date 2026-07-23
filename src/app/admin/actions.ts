"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { canAccessPatient, clearAdminSession, createAdminSession, requireAdmin } from "@/lib/auth";
import { fmt, fullPricePence, netPricePence, priceForPence } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-settings";
import { COORDINATORS, coordinatorFor, fromHeader, FALLBACK_COORDINATOR, type Coordinator } from "@/lib/coordinators";
import { brandedEmail, financeLinkEmailHtml, proposalEmailHtml, sendEmail, sendProposalWhatsApp, sendWhatsApp, escapeHtml } from "@/lib/notify";
import { firstNameOf } from "@/lib/status";
import { log, summarizeError } from "@/lib/log";
import { patientTemplateText, patientTemplateTitle, type PatientTemplateId } from "@/lib/patient-templates";
import { getWhatsAppConfig } from "@/lib/whatsapp-settings";

const ADMIN_LOGIN_DUMMY = "$2a$10$jIXu5fFVbg3ikfyxoWTwL.sLkQyG8lo/95eoTH8DTmJLzZCI7uUs2";

async function adminPasswordMatches(password: string, hash: string | null | undefined) {
  try {
    return await bcrypt.compare(password || " ", hash || ADMIN_LOGIN_DUMMY);
  } catch {
    return false;
  }
}

function toastUrl(base: string, msg: string, icon = "✓", bg = "#0E9384") {
  const q = new URLSearchParams({ toast: msg, ticon: icon, tbg: bg });
  return `${base}?${q.toString()}`;
}

// ── Auth ────────────────────────────────────────────────────────────────
export async function adminLogin(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const { rateLimit } = await import("@/lib/ratelimit");
  if (!rateLimit(`alogin:${email}`, 10, 15 * 60 * 1000)) redirect("/admin/login?error=locked");
  const admin = await db.admin.findUnique({ where: { email } });
  const ok = await adminPasswordMatches(password, admin?.passwordHash);
  if (!admin || !ok) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession(admin.id);
  redirect("/admin");
}

export async function adminLogout() {
  clearAdminSession();
  redirect("/admin/login");
}

/** Any logged-in Admin or Super Admin can reset their own password. */
export async function changeAdminPassword(formData: FormData) {
  const me = await requireAdmin();
  const { rateLimit } = await import("@/lib/ratelimit");
  if (!rateLimit(`apw:${me.id}`, 5, 15 * 60 * 1000)) {
    redirect(toastUrl("/admin/settings", "Too many password attempts — wait a few minutes", "!", "#E0A429"));
  }

  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  const confirm = String(formData.get("confirmPassword") || "");

  const ok = await adminPasswordMatches(current, me.passwordHash);
  if (!ok) {
    redirect(toastUrl("/admin/settings", "Current password is incorrect", "!", "#E0A429"));
  }
  if (next.length < 8) {
    redirect(toastUrl("/admin/settings", "New password must be at least 8 characters", "!", "#E0A429"));
  }
  if (next !== confirm) {
    redirect(toastUrl("/admin/settings", "New password and confirmation do not match", "!", "#E0A429"));
  }
  if (current === next) {
    redirect(toastUrl("/admin/settings", "Choose a different password from your current one", "!", "#E0A429"));
  }

  await db.admin.update({
    where: { id: me.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });
  log.info("admin.password.changed", { adminId: me.id });
  redirect(toastUrl("/admin/settings", "Password updated — use it next time you sign in", "✓"));
}

/** Any logged-in Admin or Super Admin can update their own profile. */
export async function updateAdminProfile(formData: FormData) {
  const me = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "").trim() || "Treatment Coordinator";

  if (!name || name.length < 2) {
    redirect(toastUrl("/admin/settings", "Enter your full name", "!", "#E0A429"));
  }
  if (!/.+@.+\..+/.test(email)) {
    redirect(toastUrl("/admin/settings", "Enter a valid email address", "!", "#E0A429"));
  }
  if (email !== me.email) {
    const clash = await db.admin.findUnique({ where: { email } });
    if (clash) {
      redirect(toastUrl("/admin/settings", "That email is already used by another admin", "!", "#E0A429"));
    }
  }

  await db.admin.update({
    where: { id: me.id },
    data: { name, email, role },
  });
  log.info("admin.profile.updated", { adminId: me.id });
  redirect(toastUrl("/admin/settings", "Profile updated", "✓"));
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
    redirect(toastUrl("/admin/pricing", "Deposit must be less than the lowest treatment price", "!", "#E0A429"));
  }

  await db.pricing.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  redirect(toastUrl("/admin/pricing", "Pricing updated — applies to new & edited proposals", "✓"));
}

// ── WhatsApp Cloud API (Super Admin) ────────────────────────────────────
export async function saveWhatsAppSettings(formData: FormData) {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");

  const current = await getWhatsAppConfig();
  const keepOrSet = (key: string, existing: string) => {
    const v = String(formData.get(key) || "").trim();
    return v || existing;
  };

  const phoneNumberId = String(formData.get("phoneNumberId") || "").trim();
  if (!phoneNumberId) {
    redirect(toastUrl("/admin/whatsapp", "Phone Number ID is required", "!", "#E0A429"));
  }

  const data = {
    phoneNumberId,
    token: keepOrSet("token", current.token),
    templatesEnabled: formData.get("templatesEnabled") === "on",
    templateLang: String(formData.get("templateLang") || "en_GB").trim() || "en_GB",
    tplProposal: String(formData.get("tplProposal") || "payment_reminder").trim() || "payment_reminder",
    tplReminder: String(formData.get("tplReminder") || "porposal_ready").trim() || "porposal_ready",
    tplLogin: String(formData.get("tplLogin") || "login_code").trim() || "login_code",
    webhookVerifyToken: String(formData.get("webhookVerifyToken") || "").trim(),
    metaAppSecret: keepOrSet("metaAppSecret", current.metaAppSecret),
    adminNotifyWhatsApp: String(formData.get("adminNotifyWhatsApp") || "").trim(),
    updatedByEmail: me.email,
  };

  if (!data.token) {
    redirect(toastUrl("/admin/whatsapp", "Access token is required (paste your System User token)", "!", "#E0A429"));
  }

  await db.whatsAppSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
  log.info("whatsapp.settings.save", { adminId: me.id, phoneNumberId: data.phoneNumberId });
  redirect(toastUrl("/admin/whatsapp", "WhatsApp Cloud API settings saved — live for local and production", "✓"));
}

export async function testWhatsAppConnection() {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");
  const cfg = await getWhatsAppConfig();
  if (!cfg.token || !cfg.phoneNumberId) {
    redirect(toastUrl("/admin/whatsapp", "Save Phone Number ID + token first", "!", "#E0A429"));
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${cfg.token}` } }
    );
    const json = (await res.json()) as {
      error?: { message?: string };
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
    };
    if (!res.ok) {
      redirect(
        toastUrl("/admin/whatsapp", `Meta error: ${json.error?.message || "connection failed"}`, "!", "#E0A429")
      );
    }
    redirect(
      toastUrl(
        "/admin/whatsapp",
        `Connected: ${json.verified_name || "WhatsApp"} · ${json.display_phone_number || cfg.phoneNumberId}${
          json.quality_rating ? ` · quality ${json.quality_rating}` : ""
        }`,
        "✓"
      )
    );
  } catch (e) {
    redirect(toastUrl("/admin/whatsapp", e instanceof Error ? e.message : "Test failed", "!", "#E0A429"));
  }
}

// ── Team (Super Admin only) ─────────────────────────────────────────────
// Creates a new admin login. Each plain admin is isolated: they see only the
// patients they own or sent, plus their own stats and monthly reports.
export async function createAdminAccount(formData: FormData) {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "").trim() || "Treatment Coordinator";
  // Super Admin cannot mint more Super Admins — team members are Admin only.
  const isSuperAdmin = false;

  if (!name || !/.+@.+\..+/.test(email)) {
    redirect(toastUrl("/admin/team", "A name and a valid email are required", "!", "#E0A429"));
  }
  if (password.length < 8) {
    redirect(toastUrl("/admin/team", "Password must be at least 8 characters", "!", "#E0A429"));
  }
  if (await db.admin.findUnique({ where: { email } })) {
    redirect(toastUrl("/admin/team", "An admin with that email already exists", "!", "#E0A429"));
  }

  await db.admin.create({
    data: { name, email, role, isSuperAdmin, passwordHash: await bcrypt.hash(password, 10) },
  });
  redirect(toastUrl("/admin/team", `${name} can now log in as ${email} (Admin)`, "✓"));
}

/** Super Admin only — remove another Admin/Super Admin. Cannot remove yourself or the last Super Admin. */
export async function deleteAdminAccount(formData: FormData) {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");

  const adminId = String(formData.get("adminId") || "").trim();
  if (!adminId) {
    redirect(toastUrl("/admin/team", "Missing admin account", "!", "#E0A429"));
  }
  if (adminId === me.id) {
    redirect(toastUrl("/admin/team", "You cannot remove your own account", "!", "#E0A429"));
  }

  const target = await db.admin.findUnique({ where: { id: adminId } });
  if (!target) {
    redirect(toastUrl("/admin/team", "That admin was already removed", "!", "#E0A429"));
  }

  if (target.isSuperAdmin) {
    const superCount = await db.admin.count({ where: { isSuperAdmin: true } });
    if (superCount <= 1) {
      redirect(toastUrl("/admin/team", "Cannot remove the last Super Admin", "!", "#E0A429"));
    }
  }

  await db.admin.delete({ where: { id: adminId } });
  log.info("admin.account.deleted", { by: me.id, removedId: adminId, removedEmail: target.email });
  redirect(toastUrl("/admin/team", `${target.name} removed from the team`, "✓"));
}

// ── Monthly reports ─────────────────────────────────────────────────────
// Saves (or updates) an admin's monthly report. Every save is a logged, held
// record: createdAt/updatedAt timestamps show exactly when it was filed and
// last adjusted. A confirmation email tells the admin it's saved and when the
// next report is due.
export async function saveMonthlyReport(formData: FormData) {
  const me = await requireAdmin();
  const adminId = String(formData.get("adminId") || me.id);
  // A plain admin can only file their own report; a Super Admin can file anyone's.
  if (adminId !== me.id && !me.isSuperAdmin) redirect("/admin/reports");
  const target = adminId === me.id ? me : await db.admin.findUniqueOrThrow({ where: { id: adminId } });

  const year = Math.min(2100, Math.max(2020, parseInt(String(formData.get("year")), 10) || new Date().getFullYear()));
  const month = Math.min(12, Math.max(1, parseInt(String(formData.get("month")), 10) || new Date().getMonth() + 1));
  const num = (k: string) => Math.max(0, parseInt(String(formData.get(k) ?? ""), 10) || 0);
  const pounds = (k: string) => {
    const n = Math.round(parseFloat(String(formData.get(k) ?? "")) * 100);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const data = {
    consultsSeen: num("consultsSeen"),
    consultsProceeded: num("consultsProceeded"),
    bondingConsults: num("bondingConsults"),
    bondingProceeded: num("bondingProceeded"),
    bondingIncomePence: pounds("bondingIncome"),
    veneerConsults: num("veneerConsults"),
    veneerProceeded: num("veneerProceeded"),
    veneerIncomePence: pounds("veneerIncome"),
    notes: String(formData.get("notes") || "").trim().slice(0, 1000),
  };

  await db.monthlyReport.upsert({
    where: { adminId_year_month: { adminId, year, month } },
    update: data,
    create: { adminId, year, month, ...data },
  });

  const monthName = new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
  const now = new Date();
  const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const savedAt = now.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const row = (label: string, v: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#5C6a79;font-size:14px;">${label}</td><td style="padding:6px 0;font-weight:700;font-size:14px;color:#16202E;">${v}</td></tr>`;
  await sendEmail(
    target.email,
    `Monthly report saved — ${monthName}`,
    brandedEmail(
      "Monthly report saved",
      `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${firstNameOf(target.name)},</p>
       <p style="font-size:15px;line-height:1.7;color:#3C4a59;">Your report for <strong>${monthName}</strong> was saved on ${savedAt} by ${me.name}. It's held on record — you can adjust it any time from the Monthly reports page.</p>
       <table style="margin:10px 0;">
         ${row("Invisalign consults seen", String(data.consultsSeen))}
         ${row("…went ahead", String(data.consultsProceeded))}
         ${row("Bonding consults / went ahead", `${data.bondingConsults} / ${data.bondingProceeded}`)}
         ${row("Bonding income", fmt(data.bondingIncomePence))}
         ${row("Veneer consults / went ahead", `${data.veneerConsults} / ${data.veneerProceeded}`)}
         ${row("Veneer income", fmt(data.veneerIncomePence))}
       </table>
       <p style="font-size:14px;line-height:1.7;color:#5C6a79;">Your next report is due on <strong>${nextDue}</strong> — you'll get a reminder that morning.</p>`
    )
  ).catch(console.error);

  redirect(toastUrl(`/admin/reports?m=${year}-${String(month).padStart(2, "0")}&a=${adminId}`, `Report for ${monthName} saved & logged`, "✓"));
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

// Loads a patient the current admin is allowed to act on — a plain admin is
// bounced off patients that aren't theirs (isolation per admin).
async function requireOwnedPatient(id: string) {
  const admin = await requireAdmin();
  const patient = await db.patient.findUniqueOrThrow({ where: { id } });
  if (!canAccessPatient(admin, patient)) redirect("/admin/patients");
  return { admin, patient };
}

// ── Patients ────────────────────────────────────────────────────────────
export async function createPatient(formData: FormData) {
  const admin = await requireAdmin();
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
    if (!canAccessPatient(admin, existing)) {
      redirect(
        toastUrl(
          "/admin/patients/new",
          "A patient with that email already exists (owned by another admin). Ask a Super Admin to open or reassign them.",
          "!",
          "#E0A429"
        )
      );
    }
    // Same patient, accessible — if they chose Create & send, deliver on the existing record.
    if (send) {
      await deliverProposal(existing.id, pickCoordinator(formData));
      redirect(
        toastUrl(
          `/admin/patients/${existing.id}`,
          `That email is already on file — proposal sent to ${existing.firstName}`,
          "✉"
        )
      );
    }
    redirect(
      toastUrl(
        `/admin/patients/${existing.id}`,
        "A patient with that email already exists — use Send proposal on their profile",
        "!",
        "#E0A429"
      )
    );
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
      ownerId: admin.id,
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
  const cfg = await getPricing();
  const id = String(formData.get("patientId"));
  const { admin } = await requireOwnedPatient(id);
  // Only a Super Admin may reassign ownership (the field only renders for them).
  const ownerRaw = formData.get("ownerId");
  const ownerChange =
    admin.isSuperAdmin && ownerRaw !== null ? { ownerId: String(ownerRaw) || null } : {};
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
      ...ownerChange,
      activities: { create: { text: "Patient details updated by admin" } },
    },
  });
  redirect(toastUrl(`/admin/patients/${id}`, "Patient details updated", "✓"));
}

// Approve a finance application: save the lender link and auto-email it to the patient.
export async function approveFinance(formData: FormData) {
  const id = String(formData.get("patientId"));
  const financeLink = String(formData.get("financeLink") || "").trim();
  if (!/^https?:\/\/.+/i.test(financeLink)) {
    redirect(toastUrl(`/admin/patients/${id}`, "Enter a valid finance link (https://…)", "!", "#E0A429"));
  }
  const { patient } = await requireOwnedPatient(id);

  await db.patient.update({
    where: { id },
    data: {
      financeLink,
      financeApprovedAt: new Date(),
      financeStatus: "accepted",
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

/** Super Admin / Admin — mark external finance accepted or declined (status persists). */
export async function setFinanceStatus(formData: FormData) {
  const id = String(formData.get("patientId"));
  const status = String(formData.get("financeStatus") || "").trim();
  if (status !== "accepted" && status !== "declined" && status !== "applied") {
    redirect(toastUrl(`/admin/patients/${id}`, "Invalid finance status", "!", "#E0A429"));
  }
  const { patient } = await requireOwnedPatient(id);
  const label = status === "accepted" ? "accepted" : status === "declined" ? "not accepted" : "applied (pending)";
  await db.patient.update({
    where: { id },
    data: {
      financeStatus: status,
      ...(status === "accepted" && !patient.financeApprovedAt ? { financeApprovedAt: new Date() } : {}),
      activities: { create: { text: `Finance marked as ${label}` } },
    },
  });
  redirect(toastUrl(`/admin/patients/${id}`, `Finance marked as ${label}`, "✓"));
}

const ADMIN_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const ADMIN_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const ADMIN_UPLOAD_MAX_FILES = 12;

/** Admin uploads a file onto a patient record (visible on their proposal). */
export async function adminUploadPatientFile(formData: FormData) {
  const id = String(formData.get("patientId"));
  await requireOwnedPatient(id);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    redirect(toastUrl(`/admin/patients/${id}`, "Choose a file to upload", "!", "#E0A429"));
  }
  const count = await db.patientUpload.count({ where: { patientId: id } });
  if (count >= ADMIN_UPLOAD_MAX_FILES) {
    redirect(toastUrl(`/admin/patients/${id}`, `Maximum ${ADMIN_UPLOAD_MAX_FILES} files`, "!", "#E0A429"));
  }
  if (!ADMIN_UPLOAD_TYPES.has(file.type)) {
    redirect(toastUrl(`/admin/patients/${id}`, "Only JPG, PNG, WebP or PDF allowed", "!", "#E0A429"));
  }
  if (file.size > ADMIN_UPLOAD_MAX_BYTES) {
    redirect(toastUrl(`/admin/patients/${id}`, "Each file must be under 2 MB", "!", "#E0A429"));
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const created = await db.patientUpload.create({
    data: {
      patientId: id,
      fileName: file.name.slice(0, 180),
      mimeType: file.type,
      sizeBytes: file.size,
      dataBase64: buf.toString("base64"),
      uploadedBy: "admin",
    },
  });
  await db.activity.create({
    data: { patientId: id, text: `Admin uploaded file: ${created.fileName}` },
  });
  redirect(toastUrl(`/admin/patients/${id}`, `Uploaded ${created.fileName}`, "✓"));
}

// Sends the proposal by email + WhatsApp and logs activity.
// `sentBy` is the coordinator the proposal goes out from; it also starts the
// 30-day price lock and the 7-touch follow-up sequence.
async function deliverProposal(patientId: string, sentBy?: Coordinator) {
  const cfg = await getPricing();
  const patient = await db.patient.findUniqueOrThrow({ where: { id: patientId } });
  const co = sentBy ?? coordinatorFor(patient.sentByName, patient.sentByEmail);
  const results: string[] = [];
  log.info("proposal.deliver.start", { patientId, email: patient.email, phone: patient.phone || null });
  try {
    await sendEmail(
      patient.email,
      "Your Invisalign Treatment Proposal — Dental Scotland",
      proposalEmailHtml(patient, cfg),
      fromHeader(co)
    );
    results.push(`Proposal emailed to ${patient.email} from ${co.name}`);
    log.info("proposal.email.ok", { patientId });
  } catch (e) {
    const summary = summarizeError(e);
    log.error("proposal.email.fail", { patientId, ...summary });
    results.push(`Email to ${patient.email} failed — ${summary.message}`);
  }
  if (patient.phone && patient.phone !== "—") {
    const r = await sendProposalWhatsApp(patient);
    if (r.error) {
      const summary = summarizeError(r.error);
      results.push(`WhatsApp to ${patient.phone} failed — ${summary.message}`);
      log.error("proposal.whatsapp.fail", { patientId, phone: patient.phone, ...summary });
    } else if (r.simulated) {
      results.push(`WhatsApp to ${patient.phone} simulated (check keys)`);
      log.warn("proposal.whatsapp.simulated", { patientId, phone: patient.phone });
    } else {
      // Meta "accepted" ≠ delivered — webhook reports delivered/failed (e.g. 131042 billing).
      const bits = [
        `WhatsApp accepted for ${patient.phone} (queued by Meta — delivery status follows)`,
        r.waId ? `wa_id=${r.waId}` : null,
        r.messageStatus ? `status=${r.messageStatus}` : null,
        r.messageId ? `id=${r.messageId.slice(0, 24)}…` : null,
      ].filter(Boolean);
      results.push(bits.join(" · "));
      log.info("proposal.whatsapp.ok", {
        patientId,
        phone: patient.phone,
        waId: r.waId || null,
        messageStatus: r.messageStatus || null,
        messageId: r.messageId || null,
      });
    }
  } else {
    log.info("proposal.whatsapp.skip", { patientId, reason: "no_phone" });
  }
  await db.patient.update({
    where: { id: patientId },
    data: {
      status: patient.status === "draft" ? "sent" : patient.status,
      proposalSentAt: new Date(),
      sequenceTouch: 0,
      priceLockExpired: false,
      sentByName: co.name,
      sentByEmail: co.email,
      activities: { create: results.map((text) => ({ text })) },
    },
  });
  log.info("proposal.deliver.done", { patientId, results: results.length });
  return results;
}

export async function sendProposal(formData: FormData) {
  const id = String(formData.get("patientId"));
  await requireOwnedPatient(id);
  const co = pickCoordinator(formData);
  const results = await deliverProposal(id, co);
  const wa = results.find((r) => r.startsWith("WhatsApp"));
  const emailFailed = results.some((r) => r.includes("Email") && r.includes("failed"));
  const msg = emailFailed
    ? `Email failed — ${wa || "check configuration"}`
    : wa?.includes("failed")
      ? `Proposal emailed from ${co.name}, but WhatsApp failed`
      : wa?.includes("simulated")
        ? `Proposal emailed from ${co.name} (WhatsApp not live yet)`
        : wa
          ? `Proposal sent by email + WhatsApp from ${co.name}`
          : `Proposal emailed to patient from ${co.name}`;
  const warn = emailFailed || wa?.includes("failed") || wa?.includes("simulated");
  redirect(toastUrl(`/admin/patients/${id}`, msg, warn ? "!" : "✉", warn ? "#E0A429" : "#0E9384"));
}

export async function recordDeposit(formData: FormData) {
  const cfg = await getPricing();
  const dep = cfg.depositPence;
  const id = String(formData.get("patientId"));
  await requireOwnedPatient(id);
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
  const id = String(formData.get("patientId"));
  const { patient } = await requireOwnedPatient(id);
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

/** Super Admin only — permanently remove a patient and related records. */
export async function deletePatient(formData: FormData) {
  const id = String(formData.get("patientId"));
  const me = await requireAdmin();
  if (!me.isSuperAdmin) {
    redirect(toastUrl(`/admin/patients/${id}`, "Only a Super Admin can remove patients", "!", "#E0A429"));
  }
  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) redirect("/admin/patients");
  const label = `${patient.firstName} ${patient.lastName}`.trim() || patient.email;
  await db.patient.delete({ where: { id } });
  log.info("patient.delete", { adminId: me.id, patientId: id, email: patient.email });
  redirect(toastUrl("/admin/patients", `Removed ${label}`, "✓"));
}

/** Send a canned patient message (email + WhatsApp when possible). */
export async function sendPatientTemplate(formData: FormData) {
  const id = String(formData.get("patientId"));
  const template = String(formData.get("template") || "") as PatientTemplateId;
  if (template !== "invisalign_ordered" && template !== "finance_received") {
    redirect(toastUrl(`/admin/patients/${id}`, "Unknown message template", "!", "#E0A429"));
  }
  const { patient } = await requireOwnedPatient(id);
  const text = patientTemplateText(template, patient.firstName);
  const title = patientTemplateTitle(template);

  const emailHtml = brandedEmail(
    title,
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;white-space:pre-wrap;">${escapeHtml(text)}</p>`
  );

  let emailOk = false;
  try {
    await sendEmail(patient.email, `${title} — Dental Scotland`, emailHtml);
    emailOk = true;
  } catch (e) {
    log.error("template.email.fail", { patientId: id, template, ...summarizeError(e) });
  }

  let waOk = false;
  if (patient.phone) {
    try {
      const r = await sendWhatsApp(patient.phone, text);
      waOk = !r.simulated && !r.error;
    } catch (e) {
      log.error("template.wa.fail", { patientId: id, template, ...summarizeError(e) });
    }
  }

  await db.activity.create({
    data: {
      patientId: id,
      text: `Sent “${title}” template${emailOk ? " · email" : ""}${waOk ? " · WhatsApp" : ""}`,
    },
  });

  if (!emailOk && !waOk) {
    redirect(toastUrl(`/admin/patients/${id}`, "Could not send message — check email/WhatsApp config", "!", "#E0A429"));
  }
  redirect(
    toastUrl(
      `/admin/patients/${id}`,
      `Sent “${title}”${emailOk ? " by email" : ""}${waOk ? " + WhatsApp" : ""}`,
      "✉"
    )
  );
}

