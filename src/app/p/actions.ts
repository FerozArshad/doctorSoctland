"use server";
// Patient-facing actions: account creation, login, payments, interest signals.

import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createPatientSession, getAdmin, getPatientSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { DEPOSIT_PENCE, fmt, fullPricePence } from "@/lib/pricing";
import { brandedEmail, notifyAdmin, sendEmail, sendWhatsApp } from "@/lib/notify";
import { stripe, stripeConfigured } from "@/lib/stripe";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";

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

export async function sendOtp(formData: FormData) {
  const token = String(formData.get("token"));
  const channel = formData.get("channel") === "whatsapp" ? "whatsapp" : "email";
  const patient = await byToken(token);

  // Max 3 codes per link per 10 minutes — stops code-spamming the patient.
  if (!rateLimit(`otp:${patient.id}`, 3, OTP_TTL_MS)) {
    redirect(toastUrl(`/p/${token}`, "Too many codes requested — please wait a few minutes", "!", "#E0A429"));
  }

  const code = String(crypto.randomInt(100000, 1000000)); // crypto-secure 6 digits
  await db.patient.update({
    where: { id: patient.id },
    data: {
      otpHash: await bcrypt.hash(code, 10),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      otpAttempts: 0,
    },
  });

  // Show the code on-screen ONLY when the channel genuinely has no keys
  // configured (local testing). A real send failure must never leak the code.
  const emailConfigured = !!process.env.RESEND_API_KEY;
  const waConfigured = !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

  try {
    if (channel === "whatsapp" && patient.phone) {
      await sendWhatsApp(
        patient.phone,
        `Your Dental Scotland verification code is *${code}*. It expires in 10 minutes. Never share this code.`
      );
    } else {
      await sendEmail(
        patient.email,
        `${code} is your Dental Scotland verification code`,
        brandedEmail(
          "Your verification code",
          `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">Hi ${patient.firstName}, use this code to open your Invisalign proposal. It expires in 10 minutes.</p>
           <div style="text-align:center;margin:22px 0;"><span style="display:inline-block;background:#F0FBF8;color:#0B7A6E;font-size:34px;font-weight:800;letter-spacing:.35em;padding:16px 28px 16px 38px;border-radius:14px;">${code}</span></div>
           <p style="font-size:12.5px;color:#9AA6B4;">If you didn't request this, you can safely ignore this email.</p>`
        )
      );
    }
  } catch (e) {
    console.error("OTP send failed:", e);
    redirect(toastUrl(`/p/${token}`, "We couldn't send your code — please try again or use the other option", "!", "#E0A429"));
  }

  const q = new URLSearchParams({ otp: "sent", channel });
  const unconfigured = channel === "whatsapp" ? !waConfigured : !emailConfigured;
  if (unconfigured) q.set("devcode", code);
  redirect(`/p/${token}?${q.toString()}`);
}

export async function verifyOtp(formData: FormData) {
  const token = String(formData.get("token"));
  const code = String(formData.get("code") || "").replace(/\D/g, "");
  const patient = await byToken(token);

  const fail = (msg: string) =>
    redirect(`/p/${token}?otp=sent&${new URLSearchParams({ toast: msg, ticon: "!", tbg: "#E0A429" })}`);

  if (!patient.otpHash || !patient.otpExpiresAt || patient.otpExpiresAt < new Date()) {
    fail("That code has expired — please request a new one");
  }
  if (patient.otpAttempts >= OTP_MAX_ATTEMPTS) {
    fail("Too many attempts — please request a new code");
  }
  if (!(await bcrypt.compare(code, patient.otpHash!))) {
    await db.patient.update({ where: { id: patient.id }, data: { otpAttempts: { increment: 1 } } });
    fail("That code isn't right — please check and try again");
  }

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
  if (!patient?.passwordHash || !(await bcrypt.compare(password, patient.passwordHash))) {
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

  const full = fullPricePence(patient.pricePence, patient.discountPct);
  const amount = type === "full" ? full : DEPOSIT_PENCE;
  const name =
    type === "full"
      ? `Invisalign ${patient.pkg} — pay in full (${patient.discountPct}% discount)`
      : `Invisalign ${patient.pkg} — £700 deposit (3 monthly instalments to follow)`;

  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: { currency: "gbp", unit_amount: amount, product_data: { name } },
      },
    ],
    // Deposit flow: save the card so the 3 monthly instalments can be
    // collected automatically off-session.
    payment_intent_data:
      type === "deposit" ? { setup_future_usage: "off_session" } : undefined,
    metadata: { patientId: patient.id, type },
    success_url: `${appUrl()}/p/${token}?paid=${type}`,
    cancel_url: `${appUrl()}/p/${token}?cancelled=1`,
  });

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

// ── Payment option form: patient picks a route, admin is kept in the loop ──
export async function selectPaymentOption(formData: FormData) {
  const token = String(formData.get("token"));
  const choice = String(formData.get("choice") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  const patient = await requireVerified(token);

  const labels: Record<string, string> = {
    full: "Pay in full",
    deposit: "£700 deposit + 3 instalments",
    finance: "0% finance",
  };
  if (!labels[choice]) redirect(`/p/${token}`);

  // Record the preference + note, and tell the practice what was chosen.
  await db.patient.update({
    where: { id: patient.id },
    data: {
      paymentPreference: choice,
      activities: {
        create: [
          { text: `Chose payment option: ${labels[choice]}` },
          ...(note ? [{ text: `Message from patient: “${note}”` }] : []),
        ],
      },
    },
  });
  await notifyAdmin(
    `💷 ${patient.firstName} ${patient.lastName} chose: ${labels[choice]}`,
    `${patient.firstName} selected “${labels[choice]}” on their ${fmt(patient.pricePence)} proposal.` +
      (note ? ` Their message: “${note}”` : "") +
      ` View: ${appUrl()}/admin/patients/${patient.id}`
  );

  // Instant-pay routes go straight to Stripe Checkout.
  if (choice === "full" || choice === "deposit") {
    await launchCheckout(token, choice);
  }

  // Finance: log + hand over to the external lender's application.
  await db.patient.update({
    where: { id: patient.id },
    data: { status: patient.status === "paid" || patient.status === "deposit" ? patient.status : "awaiting" },
  });
  const financeUrl = process.env.FINANCE_APPLY_URL;
  if (financeUrl && !financeUrl.includes("example.com")) redirect(financeUrl);
  redirect(toastUrl(`/p/${token}`, "Finance application noted — our team will send your application link", "⏳", "#E0A429"));
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
  await notifyAdmin(
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
  await notifyAdmin(
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
      activities: { create: { text: "Applied for 0% finance — awaiting approval" } },
    },
  });
  await notifyAdmin(
    `💷 ${patient.firstName} ${patient.lastName} applied for 0% finance`,
    `${patient.firstName} started a finance application for their ${fmt(patient.pricePence)} plan. View: ${appUrl()}/admin/patients/${patient.id}`
  );
  const financeUrl = process.env.FINANCE_APPLY_URL;
  if (financeUrl && !financeUrl.includes("example.com")) redirect(financeUrl);
  redirect(toastUrl(`/p/${token}`, "Finance application noted — our team will send your application link", "⏳", "#E0A429"));
}
