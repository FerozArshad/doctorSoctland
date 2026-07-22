# Dental Scotland — Roadmap

Last updated: 2026-07-21. Companion to `SESSION_HANDOFF.md` (operational detail lives
there). This is the product picture: what's built, what remains, where it ends up.

---

## ✅ Done

### Core platform
- [x] Next.js 14 + Prisma + Supabase Postgres, live at dashboard.dentalscotland.com,
      auto-deploy from `main` (Vercel)
- [x] Admin dashboard — real metrics (no mockup numbers), pipeline, activity feed,
      6-month revenue chart, responsive down to 375px

### Patient journey
- [x] Secure proposal page (`/p/[token]`) — OTP identity gate, ClinCheck video,
      plan summary with tier-based treatment time (≤7→6mo · 8–15→10mo · 16+→12mo)
- [x] Payment options: pay-in-full (5% off) · £700 deposit + 3 instalments · 0% finance
- [x] **Required T&C tick** before any payment route (client + server enforced,
      logged with timestamp for audit)
- [x] Stripe verified end-to-end: checkout, webhook, receipts; **instalments collect
      automatically** off the saved card daily; failures flag `overdue` + alert admin
- [x] £250 booking credit deducted from every charge site
- [x] Consent + drawn signature + DOB for finance; admin approval emails the lender link
- [x] Patient accounts + login

### Sales automation
- [x] 7-touch email follow-up sequence (days 1,4,10,20,26,29,30) with honest 30-day
      price lock, professional subjects, auto-stop on payment/lock-expiry
- [x] Per-coordinator sending (Millie / Rochelle / Other) + "Sent by" filter on the
      patient list
- [x] Professional sender identity ("Dental Scotland" fallback)
- [x] Admin alerts for every patient action (interested, option chosen, paid, overdue…)

### Practice management
- [x] Editable pricing at `/admin/settings` — tiers **≤7 £1,500 · 8–15 £2,250 ·
      16+ £2,750**, deposit, credit, discount; forms read live config; existing
      quotes never change retroactively
- [x] **Super Admin vs Admin roles with full per-admin isolation** — each admin sees
      only their own patients & stats; direct-URL and server-action guarded
- [x] **Team management** (`/admin/team`) — Super Admin creates admin logins
- [x] Patient ownership reassignment (Edit → "Belongs to admin")
- [x] **Monthly per-admin reports** (`/admin/reports`) — auto-computed Invisalign
      orders / income / avg per patient + manually entered consult & bonding/veneer
      figures with averages; held records with filed/adjusted timestamps; save
      confirmation email; 1st-of-month reminder email to each admin

---

## 🔜 Remaining

### 1. WhatsApp go-live (biggest missing piece — business verification approved ✅)
- [ ] Register +44 7915 357177 in WhatsApp Manager (display name "Dental Scotland")
- [ ] Env vars: `WHATSAPP_PHONE_NUMBER_ID`, permanent `WHATSAPP_TOKEN` (System User),
      `ADMIN_NOTIFY_WHATSAPP` (Vercel + local)
- [ ] Approve 3 templates: `proposal_ready` (Utility), `payment_reminder` (Utility),
      `login_code` (Authentication) → then swap `type:"text"` → `type:"template"`
      in `sendWhatsApp`
- [ ] **Phase 2 — two-way WhatsApp**: `/api/whatsapp/webhook` receiving patient
      replies → conditional/AI auto-replies in our own code → admin inbox in the
      dashboard for human takeover (24h service window) → alerts when a human is
      needed. No BSP, no n8n — all in-house.

### 2. Configuration & content (needs input from the practice)
- [ ] T&C document text or URL — link it from the payment tick
- [ ] Create Millie & Rochelle admin logins at `/admin/team`; assign their patients
- [ ] Verify Gmail send-as for millie@/rochelle@ (check `[SEND-AS TEST]` emails);
      fall back to Reply-To if aliases aren't verified
- [ ] Review sequence emails 4–7 copy (in asadqureshi1908@ inbox, tagged [4/7]…[7/7])

### 3. Housekeeping
- [ ] Change default admin passwords
- [ ] Replace the demo July 2026 report with real figures
- [ ] Delete test patient asadqureshi1908@ when testing is finished
- [ ] Delete `client_secret_*.json` from Downloads

### 4. Tech debt / smaller items
- [ ] Rate limiter is in-memory → move to Redis/Upstash for serverless consistency
- [ ] Dead "monthly" label on the patient profile
- [ ] Report export (PDF / spreadsheet) if the practice wants reports outside the app

---

## 🎯 Final product

**A single system that takes a patient from consult to completed treatment with
almost no manual chasing, and gives the practice per-coordinator accountability:**

1. **Convert** — after a consult, the coordinator creates a proposal in one minute;
   the patient gets a personal, OTP-secured page with their price locked for 30 days
   and three ways to pay.
2. **Chase automatically** — email touches on a proven 7-step cadence and WhatsApp
   messages from the practice number; replies flow back into the dashboard where an
   AI layer answers routine questions and hands anything human to the coordinator.
3. **Collect** — Stripe takes full payments and deposits; instalments come off the
   saved card by themselves; finance applications carry a signed consent trail; every
   acceptance (T&C, consent) is time-stamped and auditable.
4. **Manage the team** — each coordinator (Millie, Rochelle, future hires) runs their
   own isolated patient book with their own dashboard, and files a 2-minute monthly
   report; Invisalign orders, income and averages are computed for them, bonding and
   veneer numbers are typed in, and the record is held with dates and reminders.
5. **See the whole practice** — the Super Admin sees combined revenue, every
   pipeline, every report, and manages logins and pricing from one place.

When the WhatsApp phase 2 inbox ships and the content items (T&C, send-as, sequence
copy) are signed off, the product is feature-complete for daily practice use.
