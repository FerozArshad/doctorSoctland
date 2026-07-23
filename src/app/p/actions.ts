"use server";
// Patient-facing actions: account creation, login, payments, interest signals.

import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createPatientSession, getAdmin, getPatientSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { fmt, fullPricePence, netPricePence } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-settings";
import { brandedEmail, notifyAdmin, sendEmail, sendLoginCodeWhatsApp, whatsappConfigured } from "@/lib/notify";
import { log, summarizeError } from "@/lib/log";
import type Stripe from "stripe";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { gmailConfigured } from "@/lib/google";
import { allowDevOtpDisplay } from "@/lib/secure";
import { checkoutAssetUrl, stripeCheckoutBranding, stripeCheckoutCustomText } from "@/lib/stripe-branding";
import { BRAND } from "@/lib/brand";
import { patientTemplateText, patientTemplateTitle } from "@/lib/patient-templates";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";

/** Valid bcrypt hash used only to equalise login timing when the account is missing. */
const LOGIN_DUMMY_HASH = "$2a$10$jIXu5fFVbg3ikfyxoWTwL.sLkQyG8lo/95eoTH8DTmJLzZCI7uUs2";

async function passwordMatches(password: string, hash: string | null | undefined) {
  try {
    return await bcrypt.compare(password || " ", hash || LOGIN_DUMMY_HASH);
  } catch {
    return false;
  }
}

function toastUrl(base: string, msg: string, icon = "✓", bg = "#0E9384") {
  const q = new URLSearchParams({ toast: msg, ticon: icon, tbg: bg });
  return `${base}?${q.toString()}`;
}

async function byToken(token: string) {
  return db.patient.findUniqueOrThrow({ where: { proposalToken: token } });
}

// The proposal link alone is NOT enough to act as the patient — they must
// have passed the one-time-code gate (or logged in with their password).
// Prevents anyone holding a forwarded email from paying, signalling
// interest, or hijacking the account by setting a password.
async function requireVerified(token: string) {
  const patient = await byToken(token);
  const session = await getPatientSession();
  if (session?.id === patient.id) return patient;
  if (await getAdmin()) {
    const q = new URLSearchParams({ preview: "admin", toast: "Preview mode — patient actions are disabled", ticon: "!", tbg: "#E0A429" });
    redirect(`/p/${token}?${q.toString()}`);
  }
  redirect(`/p/${token}`); // back to the verification gate
}

// ── One-time login code (email / WhatsApp) ─────────────────────────────
const OTP_TTL_MS = 10 * 60 * 1000; // codes valid for 10 minutes
const OTP_MAX_ATTEMPTS = 5;

async function channelReady(channel: "email" | "whatsapp") {
  if (channel === "whatsapp") return whatsappConfigured();
  // Real mail = Gmail OAuth (primary) or Resend fallback
  return gmailConfigured() || !!process.env.RESEND_API_KEY;
}

export async function sendOtp(formData: FormData) {
  const token = String(formData.get("token"));
  const channel = formData.get("channel") === "whatsapp" ? "whatsapp" : "email";
  const patient = await byToken(token);

  // Max 3 codes per link per 10 minutes — stops code-spamming the patient.
  if (!rateLimit(`otp:${patient.id}`, 3, OTP_TTL_MS)) {
    redirect(toastUrl(`/p/${token}`, "Too many codes requested — please wait a few minutes", "!", "#E0A429"));
  }

  if (channel === "whatsapp" && (!patient.phone || patient.phone === "—")) {
    redirect(toastUrl(`/p/${token}`, "No phone number on this proposal — try email instead", "!", "#E0A429"));
  }

  if (!(await channelReady(channel)) && !allowDevOtpDisplay()) {
    log.error("otp.channel.unconfigured", { channel, patientId: patient.id });
    redirect(
      toastUrl(
        `/p/${token}`,
        channel === "whatsapp"
          ? "WhatsApp isn't available right now — please try email"
          : "Email isn't available right now — please try WhatsApp or contact the practice",
        "!",
        "#E0A429"
      )
    );
  }

  const code = String(crypto.randomInt(100000, 1000000)); // crypto-secure 6 digits
  await db.patient.update({
    where: { id: patient.id },
    data: {
      otpHash: await bcrypt.hash(code, 12),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      otpAttempts: 0,
    },
  });

  try {
    if (channel === "whatsapp") {
      const r = await sendLoginCodeWhatsApp(patient.phone, code);
      if (r.error || r.simulated) {
        log.error("otp.whatsapp.fail", {
          patientId: patient.id,
          simulated: !!r.simulated,
          ...(r.error ? summarizeError(r.error) : { message: "simulated" }),
        });
        throw new Error("WhatsApp OTP failed");
      }
      log.info("otp.whatsapp.ok", { patientId: patient.id });
    } else {
      const r = await sendEmail(
        patient.email,
        `${code} is your Dental Scotland verification code`,
        brandedEmail(
          "Your verification code",
          `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${patient.firstName}, use this code to open your Invisalign proposal. It expires in 10 minutes and can only be used once.</p>
           <div style="text-align:center;margin:22px 0;"><span style="display:inline-block;background:#F0FBF8;color:#0B7A6E;font-size:34px;font-weight:800;letter-spacing:.35em;padding:16px 28px 16px 38px;border-radius:14px;">${code}</span></div>
           <p style="font-size:12.5px;color:#9AA6B4;">If you didn't request this, you can safely ignore this email.</p>`
        )
      );
      if (r.simulated && !allowDevOtpDisplay()) {
        log.error("otp.email.simulated", { patientId: patient.id });
        throw new Error("Email OTP simulated");
      }
      log.info("otp.email.ok", { patientId: patient.id, via: "via" in r ? r.via : "resend" });
    }
  } catch (e) {
    // Invalidate the stored hash so a failed send cannot be guessed from a partial leak.
    await db.patient.update({
      where: { id: patient.id },
      data: { otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
    });
    log.error("otp.send.fail", { patientId: patient.id, channel, ...summarizeError(e) });
    redirect(toastUrl(`/p/${token}`, "We couldn't send your code — please try again or use the other option", "!", "#E0A429"));
  }

  const q = new URLSearchParams({ otp: "sent", channel });
  // Dev-only: never expose OTP in production URLs or HTML.
  if (allowDevOtpDisplay() && !(await channelReady(channel))) q.set("devcode", code);
  redirect(`/p/${token}?${q.toString()}`);
}

export async function verifyOtp(formData: FormData) {
  const token = String(formData.get("token"));
  const code = String(formData.get("code") || "").replace(/\D/g, "");
  const patient = await byToken(token);

  const fail = (msg: string) =>
    redirect(`/p/${token}?otp=sent&${new URLSearchParams({ toast: msg, ticon: "!", tbg: "#E0A429" })}`);

  if (code.length !== 6) {
    fail("Enter the 6-digit code we sent you");
  }
  if (!patient.otpHash || !patient.otpExpiresAt || patient.otpExpiresAt < new Date()) {
    fail("That code has expired — please request a new one");
  }
  if (patient.otpAttempts >= OTP_MAX_ATTEMPTS) {
    await db.patient.update({
      where: { id: patient.id },
      data: { otpHash: null, otpExpiresAt: null },
    });
    fail("Too many attempts — please request a new code");
  }
  if (!(await bcrypt.compare(code, patient.otpHash!))) {
    const attempts = patient.otpAttempts + 1;
    await db.patient.update({
      where: { id: patient.id },
      data: {
        otpAttempts: { increment: 1 },
        ...(attempts >= OTP_MAX_ATTEMPTS ? { otpHash: null, otpExpiresAt: null } : {}),
      },
    });
    fail("That code isn't right — please check and try again");
  }

  // One-time use: clear hash immediately on success.
  await db.patient.update({
    where: { id: patient.id },
    data: {
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      activities: { create: { text: "Verified identity with a one-time code" } },
    },
  });
  await createPatientSession(patient.id);
  log.info("otp.verify.ok", { patientId: patient.id });
  redirect(`/p/${token}`);
}

// ── Account ─────────────────────────────────────────────────────────────
export async function setPatientPassword(formData: FormData) {
  const token = String(formData.get("token"));
  const password = String(formData.get("password") || "");
  const patient = await requireVerified(token);
  if (password.length < 8) {
    redirect(toastUrl(`/p/${token}`, "Password must be at least 8 characters", "!", "#E0A429"));
  }
  await db.patient.update({
    where: { id: patient.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      activities: { create: { text: "Created their patient account" } },
    },
  });
  await createPatientSession(patient.id);
  redirect(toastUrl(`/p/${token}`, "Account created — you can now log in any time"));
}

export async function patientLogin(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  // Max 5 attempts per email per 15 minutes
  if (!rateLimit(`plogin:${email}`, 5, 15 * 60 * 1000)) redirect("/login?error=1");
  const patient = await db.patient.findUnique({ where: { email } });
  const ok = await passwordMatches(password, patient?.passwordHash);
  if (!patient?.passwordHash || !ok) {
    redirect("/login?error=1");
  }
  await createPatientSession(patient.id);
  redirect(`/p/${patient.proposalToken}`);
}

// ── Stripe checkout ─────────────────────────────────────────────────────
async function launchCheckout(token: string, type: "full" | "deposit"): Promise<never> {
  const patient = await requireVerified(token);

  if (!stripeConfigured()) {
    redirect(toastUrl(`/p/${token}`, "Payments not configured yet — please contact the practice", "!", "#E0A429"));
  }

  const s = stripe();
  let customerId = patient.stripeCustomerId;
  if (!customerId) {
    const customer = await s.customers.create({
      email: patient.email,
      name: `${patient.firstName} ${patient.lastName}`.trim(),
      metadata: { patientId: patient.id },
    });
    customerId = customer.id;
    await db.patient.update({ where: { id: patient.id }, data: { stripeCustomerId: customerId } });
  }

  // Charge on the net total (treatment price minus any upfront already paid).
  const cfg = await getPricing();
  const net = netPricePence(patient.pricePence, patient.upfrontPaidPence);
  const full = fullPricePence(net, patient.discountPct);
  const amount = type === "full" ? full : cfg.depositPence;
  const name =
    type === "full"
      ? `Invisalign ${patient.pkg} — pay in full (${patient.discountPct}% discount)`
      : `Invisalign ${patient.pkg} — ${fmt(cfg.depositPence)} deposit (then 3 monthly instalments)`;
  const description =
    type === "full"
      ? `${BRAND.name} · personalised Invisalign treatment paid in full`
      : `${BRAND.name} · deposit today; 3 remaining payments collected automatically each month`;

  const branding = stripeCheckoutBranding();
  const logoUrl = checkoutAssetUrl("/logo.webp");

  // branding_settings needs a recent Stripe API; request it per-call and fall back if unsupported.
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: amount,
          product_data: {
            name,
            description,
            images: [logoUrl],
            metadata: { brand: BRAND.name },
          },
        },
      },
    ],
    // Deposit flow: save the card so the 3 monthly instalments can be
    // collected automatically off-session (not an open-ended subscription).
    payment_intent_data: {
      description: name,
      ...(type === "deposit" ? { setup_future_usage: "off_session" as const } : {}),
    },
    custom_text: stripeCheckoutCustomText(type),
    billing_address_collection: "auto",
    locale: "en-GB",
    metadata: { patientId: patient.id, type, brand: BRAND.name },
    success_url: `${appUrl()}/p/${token}?paid=${type}`,
    cancel_url: `${appUrl()}/p/${token}?cancelled=1`,
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await s.checkout.sessions.create({
      ...sessionParams,
      // branding_settings is available on newer Stripe APIs than our typed version.
      ...( { branding_settings: branding } as Stripe.Checkout.SessionCreateParams ),
    });
  } catch (e) {
    log.warn("stripe.checkout.branding_fallback", { ...summarizeError(e) });
    session = await s.checkout.sessions.create(sessionParams);
  }

  await db.payment.create({
    data: { patientId: patient.id, amountPence: amount, type, status: "pending", stripeSessionId: session.id },
  });

  redirect(session.url!);
}

export async function startCheckout(formData: FormData) {
  const token = String(formData.get("token"));
  const type = formData.get("type") === "deposit" ? "deposit" : "full";
  await launchCheckout(token, type);
}

const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const UPLOAD_MAX_FILES = 5;
const UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** Patient attaches a photo/PDF on their proposal page. */
export async function uploadPatientFile(formData: FormData): Promise<
  { error: string; upload?: undefined } | { error?: undefined; upload: { id: string; fileName: string; sizeBytes: number } }
> {
  const token = String(formData.get("token") || "");
  const file = formData.get("file");
  if (!token || !(file instanceof File)) return { error: "No file selected" };

  const patient = await byToken(token);
  const session = await getPatientSession();
  const admin = await getAdmin();
  // Patient session, or Super Admin / admin preview testing the link.
  if (session?.id !== patient.id && !admin) {
    return { error: "Please verify your identity first" };
  }

  const count = await db.patientUpload.count({ where: { patientId: patient.id } });
  if (count >= UPLOAD_MAX_FILES) return { error: `Maximum ${UPLOAD_MAX_FILES} files` };
  if (!UPLOAD_TYPES.has(file.type)) return { error: "Only JPG, PNG, WebP or PDF allowed" };
  if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES) return { error: "Each file must be under 2 MB" };

  const buf = Buffer.from(await file.arrayBuffer());
  const created = await db.patientUpload.create({
    data: {
      patientId: patient.id,
      fileName: file.name.slice(0, 180),
      mimeType: file.type,
      sizeBytes: file.size,
      dataBase64: buf.toString("base64"),
      uploadedBy: admin && session?.id !== patient.id ? "admin" : "patient",
    },
  });
  await db.activity.create({
    data: { patientId: patient.id, text: `Uploaded file: ${created.fileName}` },
  });
  await notifyAdmin(
    `📎 ${patient.firstName} uploaded ${created.fileName}`,
    `View: ${appUrl()}/admin/patients/${patient.id}`
  ).catch(() => {});

  return { upload: { id: created.id, fileName: created.fileName, sizeBytes: created.sizeBytes } };
}

/**
 * Consent + e-signature gate for every payment route.
 * Previously only finance opened the modal — full/deposit skipped it.
 * Returns a success payload for finance/interested (client shows SuccessModal).
 * full/deposit redirect into Stripe Checkout and never return.
 */
export async function completePaymentConsent(
  formData: FormData
): Promise<{ ok: true; title: string; body: string } | void> {
  const token = String(formData.get("token"));
  const choiceRaw = String(formData.get("choice") || "");
  const choice = (["full", "deposit", "finance", "interested"].includes(choiceRaw) ? choiceRaw : "") as
    | "full"
    | "deposit"
    | "finance"
    | "interested"
    | "";
  const consent = formData.get("consent") === "on";
  const signature = String(formData.get("signature") || "");
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const dob = String(formData.get("dob") || "").trim();
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  const patient = await requireVerified(token);

  if (!choice) redirect(`/p/${token}`);
  if (!consent || !signature.startsWith("data:image")) {
    redirect(toastUrl(`/p/${token}`, "Please tick the consent box and add your e-signature to continue", "!", "#E0A429"));
  }

  const optCfg = await getPricing();
  const labels: Record<string, string> = {
    full: "Pay in full",
    deposit: `${fmt(optCfg.depositPence)} deposit + 3 instalments`,
    finance: "0% finance",
    interested: "Registered interest",
  };

  const keep = patient.status === "paid" || patient.status === "deposit";
  const nextStatus =
    keep
      ? patient.status
      : choice === "finance"
        ? "awaiting"
        : choice === "interested"
          ? "interested"
          : patient.status === "draft"
            ? "sent"
            : patient.status;

  await db.patient.update({
    where: { id: patient.id },
    data: {
      firstName: firstName || patient.firstName,
      lastName: lastName || patient.lastName,
      phone: phone || patient.phone,
      dateOfBirth: dob || patient.dateOfBirth,
      consentSignedAt: new Date(),
      consentSignature: signature,
      status: nextStatus,
      paymentPreference: choice === "interested" ? patient.paymentPreference : choice,
      ...(choice === "finance" ? { financeStatus: "applied" } : {}),
      activities: {
        create: [
          { text: "Agreed and consented (e-signed)" },
          { text: `Chose payment option: ${labels[choice]}` },
          ...(note ? [{ text: `Message from patient: “${note}”` }] : []),
        ],
      },
    },
  });

  const name = `${firstName || patient.firstName} ${lastName || patient.lastName}`.trim();
  const greet = firstName || patient.firstName;
  // Don't block the patient on admin email/WhatsApp.
  void notifyAdmin(
    choice === "finance"
      ? `📝 ${name} applied for 0% finance (consent signed)`
      : choice === "interested"
        ? `⭐ ${name} is interested (consent signed)`
        : `💷 ${name} chose: ${labels[choice]} (consent signed)`,
    `${name} signed consent${dob ? `, DOB ${dob}` : ""} and selected “${labels[choice]}”. View: ${appUrl()}/admin/patients/${patient.id}` +
      (note ? ` — Their message: “${note}”` : "")
  );

  if (choice === "full" || choice === "deposit") {
    await launchCheckout(token, choice);
  }

  if (choice === "finance") {
    const financeUrl = process.env.FINANCE_APPLY_URL;
    if (financeUrl && !financeUrl.includes("example.com")) redirect(financeUrl);
    return {
      ok: true,
      title: patientTemplateTitle("finance_received"),
      body: patientTemplateText("finance_received", greet),
    };
  }

  return {
    ok: true,
    title: "Thank you",
    body: `Hi ${greet}, thanks so much for choosing Dental Scotland. We've noted your interest — a Treatment Coordinator will be in touch shortly.`,
  };
}

/** @deprecated use completePaymentConsent */
export async function submitApplication(formData: FormData) {
  const intent = formData.get("intent") === "finance" ? "finance" : "interested";
  formData.set("choice", intent);
  await completePaymentConsent(formData);
}

/** @deprecated payment form now uses completePaymentConsent via the modal */
export async function selectPaymentOption(formData: FormData) {
  const choice = String(formData.get("choice") || "");
  formData.set("consent", "on");
  // Legacy path without signature — force them back to sign.
  if (!String(formData.get("signature") || "").startsWith("data:image")) {
    const token = String(formData.get("token"));
    redirect(toastUrl(`/p/${token}`, "Please agree and e-sign to continue", "!", "#E0A429"));
  }
  formData.set("choice", choice);
  await completePaymentConsent(formData);
}

// ── Interest / finance / call-back ──────────────────────────────────────
export async function markInterested(formData: FormData) {
  const token = String(formData.get("token"));
  const patient = await requireVerified(token);
  await db.patient.update({
    where: { id: patient.id },
    data: {
      status: patient.status === "paid" || patient.status === "deposit" ? patient.status : "interested",
      activities: { create: { text: "Replied “I’M INTERESTED”" } },
    },
  });
  void notifyAdmin(
    `⭐ ${patient.firstName} ${patient.lastName} is interested!`,
    `${patient.firstName} clicked I'M INTERESTED on their ${fmt(patient.pricePence)} Invisalign proposal. View: ${appUrl()}/admin/patients/${patient.id}`
  );
  redirect(toastUrl(`/p/${token}`, "Brilliant! We've let your Treatment Coordinator know", "★", "#9B51E0"));
}

export async function bookCall(formData: FormData) {
  const token = String(formData.get("token"));
  const patient = await requireVerified(token);
  await db.patient.update({
    where: { id: patient.id },
    data: {
      status: patient.status === "paid" || patient.status === "deposit" ? patient.status : "interested",
      activities: { create: { text: "Requested a follow-up call" } },
    },
  });
  void notifyAdmin(
    `📞 ${patient.firstName} ${patient.lastName} requested a call`,
    `Please call ${patient.firstName} on ${patient.phone || patient.email} about their Invisalign proposal. View: ${appUrl()}/admin/patients/${patient.id}`
  );
  redirect(toastUrl(`/p/${token}`, "Call requested — we'll be in touch shortly", "📞", "#2E6BFF"));
}

export async function chooseFinance(formData: FormData) {
  const token = String(formData.get("token"));
  const patient = await requireVerified(token);
  await db.patient.update({
    where: { id: patient.id },
    data: {
      status: "awaiting",
      paymentPreference: "finance",
      financeStatus: "applied",
      activities: { create: { text: "Applied for 0% finance — awaiting approval" } },
    },
  });
  void notifyAdmin(
    `💷 ${patient.firstName} ${patient.lastName} applied for 0% finance`,
    `${patient.firstName} started a finance application for their ${fmt(patient.pricePence)} plan. View: ${appUrl()}/admin/patients/${patient.id}`
  );
  const financeUrl = process.env.FINANCE_APPLY_URL;
  if (financeUrl && !financeUrl.includes("example.com")) redirect(financeUrl);
  redirect(toastUrl(`/p/${token}`, "Finance application noted — our team will send your application link", "⏳", "#E0A429"));
}
