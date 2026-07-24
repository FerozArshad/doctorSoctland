// 7-touch follow-up sequence for unconverted Invisalign quotes.
// Fires on days 1, 4, 10, 20, 26, 29, 30 after the proposal is sent.
// The quote is price-locked for 30 days from proposalSentAt.
//
// Every figure is computed from the patient's own record — never hardcoded.
import type { Patient } from "@prisma/client";
import { brandedEmail } from "./notify";
import { coordinatorFor, signOff, followUpBookingUrl, type Coordinator } from "./coordinators";
import { fmt, finance36Pence, fullPricePence, instalmentPence, netPricePence, type PricingConfig } from "./pricing";

export const LOCK_DAYS = 30;
export const TOUCH_DAYS = [1, 4, 10, 20, 26, 29, 30] as const;

// Real, substantiated social proof (supplied by the practice).
const PATIENTS_TREATED = "1,200+ patients";
const GOOGLE_RATING = "4.9★ from 800+ reviews";
const SOCIAL_PROOF = `Rated ${GOOGLE_RATING}`;

export type SeqValues = {
  full: string; // pay-in-full price after discount
  spread: string; // balance if spreading (no discount)
  deposit: string;
  instal: string; // per month on the deposit plan
  fromMonth: string; // lowest monthly (0% finance over 36)
  discountPct: number;
  lockDate: string; // e.g. "16 August 2026"
  daysLeft: number;
  link: string;
  /** Proposal page anchor where patient books a follow-up call (not admin). */
  callUrl: string;
  /** Direct LeadConnector URL — used only on the proposal page button. */
  bookingUrl: string;
  co: Coordinator;
};

export function seqValues(p: Patient, cfg: PricingConfig, appUrl: string): SeqValues {
  const net = netPricePence(p.pricePence, p.upfrontPaidPence);
  const start = p.proposalSentAt ?? p.createdAt;
  const lock = new Date(start.getTime() + LOCK_DAYS * 86400000);
  const daysLeft = Math.max(0, Math.ceil((lock.getTime() - Date.now()) / 86400000));
  const base = `${appUrl.replace(/\/$/, "")}/p/${p.proposalToken}`;
  const co = coordinatorFor(p.sentByName, p.sentByEmail);
  return {
    full: fmt(fullPricePence(net, p.discountPct)),
    spread: fmt(net),
    deposit: fmt(cfg.depositPence),
    instal: fmt(instalmentPence(net, cfg.depositPence)),
    fromMonth: fmt(finance36Pence(net)),
    discountPct: p.discountPct,
    lockDate: lock.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    daysLeft,
    link: base,
    callUrl: `${base}#book-call`,
    bookingUrl: followUpBookingUrl(co),
    co,
  };
}

const P = (s: string) => `<p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:0 0 14px;">${s}</p>`;
const CTA = (link: string) =>
  `<div style="text-align:center;margin:24px 0 8px;"><a href="${link}" style="display:inline-block;background:#0E9384;color:#ffffff;text-decoration:none;padding:15px 32px;border-radius:11px;font-weight:800;font-size:15px;">Review your plan &amp; choose a payment option →</a></div>`;
const PS = (s: string) => `<p style="font-size:13px;line-height:1.7;color:#7A8696;margin:18px 0 0;font-style:italic;">P.S. ${s}</p>`;
const SIGN = (v: SeqValues) => `<p style="font-size:15px;line-height:1.7;color:#3C4a59;margin:18px 0 0;">${signOff(v.co)}</p>`;

export type Touch = {
  n: number;
  day: number;
  label: string;
  subject: (p: Patient, v: SeqValues) => string;
  html: (p: Patient, v: SeqValues) => string;
  /** WhatsApp body for this touch — free-form Cloud API text. */
  whatsapp: (p: Patient, v: SeqValues) => string;
};

export const TOUCHES: Touch[] = [
  // ── 1 · Day 1 — price-lock + micro-CTA ──
  {
    n: 1,
    day: 1,
    label: "Price-lock + micro-CTA",
    subject: (p) => `Your personalised Invisalign plan, ${p.firstName} — price locked for ${LOCK_DAYS} days`,
    html: (p, v) =>
      brandedEmail(
        "Your price is locked in",
        P(`Hi ${p.firstName},`) +
          P(
            `It's Dental Scotland here. As Scotland's largest and lowest-priced Invisalign provider, we wanted to make sure your personalised plan hasn't slipped by.`
          ) +
          P(`Your price is currently locked in at:`) +
          `<ul style="font-size:15px;line-height:1.9;color:#3C4a59;margin:0 0 14px;padding-left:20px;">
             <li><strong>${v.full}</strong> if paid in full (${v.discountPct}% saving), or</li>
             <li><strong>${v.spread}</strong> spread via our ${v.deposit}-deposit plan or 0% finance — from as little as <strong>${v.fromMonth}/month</strong></li>
           </ul>` +
          P(
            `This price is guaranteed for the next ${LOCK_DAYS} days, so there's no rush — but we didn't want you to lose it without realising.`
          ) +
          CTA(v.link) +
          P(
            `Prefer to talk it through first? <a href="${v.callUrl}" style="color:#0E9384;font-weight:700;">Book a follow-up call on your proposal</a>.`
          ) +
          SIGN(v) +
          PS(
            `After your ${LOCK_DAYS}-day window closes, we'd need to requote at current pricing — so it's worth locking in now if you're leaning that way.`
          )
      ),
    whatsapp: (p, v) =>
      `Hi ${p.firstName}! 😊 Just a friendly note from Dental Scotland — your Invisalign plan is ready and your price is locked in:\n\n` +
      `💰 ${v.full} if paid in full (${v.discountPct}% off), or\n` +
      `💳 ${v.spread} spread via ${v.deposit} deposit or 0% finance — from as little as ${v.fromMonth}/month\n\n` +
      `No rush, but didn't want you to miss it! 👉 ${v.link}\n\n` +
      `Prefer to talk it through first? Book a call on your proposal: ${v.callUrl}`,
  },

  // ── 2 · Day 4 — monthly framing + proof ──
  {
    n: 2,
    day: 4,
    label: "Monthly framing + proof",
    subject: (p, v) => `Invisalign from ${v.fromMonth}/month — your payment options, ${p.firstName}`,
    html: (p, v) =>
      brandedEmail(
        `From ${v.fromMonth}/month`,
        P(`Hi ${p.firstName},`) +
          P(
            `A lot of patients tell us the hardest part isn't deciding to do it — it's figuring out how to pay for it. As Scotland's largest Invisalign provider, here's your plan broken down simply:`
          ) +
          `<ul style="font-size:15px;line-height:1.9;color:#3C4a59;margin:0 0 14px;padding-left:20px;">
             <li><strong>Pay in full:</strong> ${v.full} (save ${v.discountPct}%)</li>
             <li><strong>Deposit plan:</strong> ${v.deposit} down, then ${v.instal}/month</li>
             <li><strong>0% finance:</strong> no interest, from ${v.fromMonth}/month</li>
           </ul>` +
          P(`You'd be joining ${PATIENTS_TREATED} who've already transformed their smile with us — ${SOCIAL_PROOF}.`) +
          CTA(v.link) +
          P(`Want to talk it through? <a href="${v.callUrl}" style="color:#0E9384;font-weight:700;">Book a quick call</a>.`) +
          SIGN(v) +
          PS(`Most patients choose the deposit or finance option — full payment isn't required to get started.`)
      ),
    whatsapp: (p, v) =>
      `Hi ${p.firstName}, quick breakdown of your Invisalign payment options:\n\n` +
      `✅ Pay in full: ${v.full} (save ${v.discountPct}%)\n` +
      `✅ Deposit plan: ${v.deposit} down, then ${v.instal}/month\n` +
      `✅ 0% finance: from ${v.fromMonth}/month\n\n` +
      `You'd be joining ${PATIENTS_TREATED} who've already transformed their smile with us 🦷✨\n\n` +
      `👉 ${v.link}\n\n` +
      `Want to talk it through? Book a call on your proposal: ${v.callUrl}`,
  },

  // ── 3 · Day 10 — trust and reassurance ──
  {
    n: 3,
    day: 10,
    label: "Trust and reassurance",
    subject: (p) => `Why patients choose Dental Scotland for Invisalign, ${p.firstName}`,
    html: (p, v) =>
      brandedEmail(
        "Why patients choose us",
        P(`Hi ${p.firstName},`) +
          P(`Checking in again on your Invisalign plan. A few reasons patients choose us:`) +
          `<ul style="font-size:15px;line-height:1.9;color:#3C4a59;margin:0 0 14px;padding-left:20px;">
             <li>Scotland's largest and lowest-priced Invisalign provider</li>
             <li>${PATIENTS_TREATED} treated</li>
             <li>${GOOGLE_RATING}</li>
           </ul>` +
          P(`Your price is still locked at <strong>${v.full}</strong> (or <strong>${v.fromMonth}/month</strong> spread).`) +
          CTA(v.link) +
          P(`Got questions? <a href="${v.callUrl}" style="color:#0E9384;font-weight:700;">Book a 10-min call</a>.`) +
          SIGN(v) +
          PS(`Your current price is only guaranteed until <strong>${v.lockDate}</strong> — after that, we'd need to requote.`)
      ),
    whatsapp: (p, v) =>
      `Hi ${p.firstName}, checking in on your Invisalign plan 😊\n\n` +
      `A few reasons patients choose us:\n` +
      `⭐ Scotland's largest & lowest-priced Invisalign provider\n` +
      `⭐ ${PATIENTS_TREATED} treated\n` +
      `⭐ ${GOOGLE_RATING}\n\n` +
      `Your price is still locked at ${v.full} (or ${v.fromMonth}/month spread).\n\n` +
      `👉 ${v.link}\n\n` +
      `Got questions? Book a call on your proposal: ${v.callUrl}`,
  },

  // ── 4 · Day 20 — urgency begins (10 days left) ──
  {
    n: 4,
    day: 20,
    label: "Urgency begins (10 days left)",
    subject: (p, v) => `${v.daysLeft} days left on your locked-in Invisalign price, ${p.firstName}`,
    html: (p, v) =>
      brandedEmail(
        "10 days left on your price",
        P(`Hi ${p.firstName},`) +
          P(
            `A quick heads-up: your locked-in price runs out on <strong>${v.lockDate}</strong> — that's about <strong>${v.daysLeft} days</strong> away.`
          ) +
          P(
            `Nothing changes about your plan between now and then. But after that date we'd have to requote you at current pricing, and we'd rather you kept the price you were quoted:`
          ) +
          `<ul style="font-size:15px;line-height:1.9;color:#3C4a59;margin:0 0 14px;padding-left:20px;">
             <li><strong>${v.full}</strong> paid in full (${v.discountPct}% saving)</li>
             <li><strong>${v.deposit}</strong> deposit, then ${v.instal}/month</li>
             <li>0% finance from <strong>${v.fromMonth}/month</strong></li>
           </ul>` +
          CTA(v.link) +
          P(`Want to chat first? <a href="${v.callUrl}" style="color:#0E9384;font-weight:700;">Book a call</a>.`) +
          SIGN(v) +
          PS(`If now isn't the right time, that's completely fine — just reply and let us know, and we'll stop the reminders.`)
      ),
    whatsapp: (p, v) =>
      `Hi ${p.firstName} ⏰ just a heads-up — your Invisalign price expires in ${v.daysLeft} days.\n\n` +
      `Lock in now and keep:\n` +
      `✅ ${v.full} (vs. full price after expiry)\n` +
      `✅ ${v.fromMonth}/month deposit or finance option\n` +
      `✅ No new consultation needed\n\n` +
      `👉 ${v.link}\n\n` +
      `Want to chat first? Book a call on your proposal: ${v.callUrl}`,
  },

  // ── 5 · Day 26 — urgency escalates (4 days left) ──
  {
    n: 5,
    day: 26,
    label: "Urgency escalates (4 days left)",
    subject: (p, v) => `Your Invisalign price is held until ${v.lockDate}, ${p.firstName}`,
    html: (p, v) =>
      brandedEmail(
        `${v.daysLeft} days left`,
        P(`Hi ${p.firstName},`) +
          P(
            `Your Invisalign price is locked until <strong>${v.lockDate}</strong> — just <strong>${v.daysLeft} days</strong> from now.`
          ) +
          P(
            `To be straight with you: after that we can't hold <strong>${v.full}</strong>. Prices move, and we'd need to requote you at whatever's current.`
          ) +
          P(
            `If cost is the sticking point, the deposit plan gets you started for <strong>${v.deposit}</strong> today — the rest is ${v.instal}/month, collected automatically. No credit checks.`
          ) +
          CTA(v.link) +
          P(
            `Want to talk it through? No pressure — <a href="${v.callUrl}" style="color:#0E9384;font-weight:700;">book a quick call</a>.`
          ) +
          SIGN(v) +
          PS(`It takes about two minutes to secure your price — you can always ask us questions afterwards.`)
      ),
    whatsapp: (p, v) =>
      `Hi ${p.firstName}, only ${v.daysLeft} days left on your Invisalign price! ⏳\n\n` +
      `Quick recap:\n` +
      `💰 ${v.full} in full, or ${v.fromMonth}/month via finance\n` +
      `✅ Ready to activate right now\n\n` +
      `👉 ${v.link}\n\n` +
      `Want to talk it through? Book a call on your proposal: ${v.callUrl}`,
  },

  // ── 6 · Day 29 — final chance (1 day left) ──
  {
    n: 6,
    day: 29,
    label: "Final chance (1 day left)",
    subject: (p) => `Your locked-in Invisalign price expires tomorrow, ${p.firstName}`,
    html: (p, v) =>
      brandedEmail(
        "Your price expires tomorrow",
        P(`Hi ${p.firstName},`) +
          P(
            `This is the last reminder while your price still stands. <strong>${v.full}</strong> (or ${v.deposit} down, then ${v.instal}/month) is guaranteed until <strong>${v.lockDate}</strong> — <strong>tomorrow</strong>.`
          ) +
          P(`After that your plan stays on file, but we'd need to requote at current pricing.`) +
          CTA(v.link) +
          P(
            `Not today? Totally fine — <a href="${v.callUrl}" style="color:#0E9384;font-weight:700;">book a call slot instead</a>.`
          ) +
          SIGN(v) +
          PS(`No hard feelings if the answer's no — a one-word reply and we'll leave you in peace.`)
      ),
    whatsapp: (p, v) =>
      `Hi ${p.firstName}, your ${v.full} Invisalign price expires tomorrow ⚠️\n\n` +
      `After that we'd need to book a new consultation and requote.\n\n` +
      `👉 ${v.link}\n\n` +
      `Not today? Book a call on your proposal: ${v.callUrl}`,
  },

  // ── 7 · Day 30 — last hours ──
  {
    n: 7,
    day: 30,
    label: "Last hours",
    subject: (p) => `Your Invisalign price expires today, ${p.firstName}`,
    html: (p, v) =>
      brandedEmail(
        "Last hours",
        P(`Hi ${p.firstName},`) +
          P(`Your locked price ends today.`) +
          P(`<strong>${v.full}</strong> paid in full, or <strong>${v.deposit}</strong> to get started.`) +
          CTA(v.link) +
          P(
            `Want to talk it through first? <a href="${v.callUrl}" style="color:#0E9384;font-weight:700;">Book a call now</a>.`
          ) +
          P(`After today, we requote.`) +
          SIGN(v)
      ),
    whatsapp: (p, v) =>
      `Hi ${p.firstName}, final call — your Invisalign price expires today ⏰\n\n` +
      `👉 ${v.link}\n\n` +
      `Want to talk it through? Book a call on your proposal: ${v.callUrl}`,
  },
];

/** The touch that is due for a patient, or null. Never re-sends an earlier one. */
export function dueTouch(daysSinceSent: number, alreadySent: number): Touch | null {
  const due = TOUCHES.filter((t) => t.day <= daysSinceSent && t.n > alreadySent);
  return due.length ? due[due.length - 1] : null; // most advanced due touch
}
