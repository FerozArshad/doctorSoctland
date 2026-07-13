# Session Handoff — Dental Scotland (Invisalign Proposal & Payments)

Last updated: 2026-07-14. This file captures the current working state so anyone
(or a new session) can pick up without re-deriving context. **No secrets are in
this file** — real values live only in local `.env` (gitignored) and in Vercel →
Settings → Environment Variables.

---

## 1. What this is
- Next.js 14 (App Router) + Prisma + Postgres app for dentalscotland.com.
- Admin side: dashboard, patient list, proposal builder, **edit patient (any status)**,
  payment tracking, messaging, **finance-application approval**.
- Patient side: OTP-gated proposal page (`/p/[token]`) with payment options,
  **£250 upfront credit**, **consent + signature modal** for finance/interest.
- Payment options: Pay-in-full (5% off), £700 deposit + 3 instalments, 0% finance.
  ("Monthly payments" was removed.)
- **Repo:** https://github.com/FerozArshad/doctorSoctland (branch `main`, auto-deploys to Vercel)
- **Live URL:** https://dashboard.dentalscotland.com
- **Local clone:** `D:\Work\doctorSoctland`

## 2. Environments & database
- **Single shared database (Supabase)** across local *and* production — per project
  design. **Any local change writes to the same DB production reads.** Be careful.
- Supabase project host: `db.mkzauukubdxsuadiwcvv.supabase.co` (pooler:
  `aws-1-eu-west-2.pooler.supabase.com`). Values in `.env` / Vercel.
- Local dev server: `http://localhost:3000`
- Public demo tunnel (ephemeral — dies if machine sleeps / ngrok restarts):
  `https://aida-snaky-unvisibly.ngrok-free.dev`

## 3. Logins
- **Admin:** `concierge@dentalscotland.com` / `dental123`
  (change the password later via `npm run admin:password -- NewPass123`)
- **Demo patients:** 9 seeded, password `dental123`. Emails are fake gmail
  addresses (emma.macleod@gmail.com, sophie.b@, etc.) — see `src/lib/seed-data.ts`.
  ⚠️ **Never trigger real patient-facing email/WhatsApp to these** — they could be
  real strangers. Test sends only to `concierge@dentalscotland.com` / your own number.

## 4. Integration status
| Integration | Status | Notes |
|---|---|---|
| Database (Supabase Postgres) | ✅ working | schema pushed + seeded from local |
| Auth (`AUTH_SECRET`) | ✅ working | set in Vercel + local |
| **Email (Gmail send)** | ✅ working | Google OAuth `gmail.send`; verified live send. Falls back to Resend → simulated |
| WhatsApp (Meta Cloud API) | ⏳ pending keys | code ready; simulated to console until keys set |
| Stripe (payments) | ⏳ pending keys | code ready; buttons show "not configured" toast until `STRIPE_SECRET_KEY` set |
| Payment reminders (email + WhatsApp) | ✅ email works | `/api/cron/reminders`, twice daily (09:00 + 17:00). WhatsApp part waits on keys. See cron-plan note in §9 |

## 5. Environment variables (names only — values in `.env` / Vercel)
Core: `DATABASE_URL`* , `AUTH_SECRET`, `APP_URL`, `CRON_SECRET`
Email/Gmail: `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, (`RESEND_API_KEY` optional)
Notifications: `ADMIN_NOTIFY_EMAIL` (=concierge@), `ADMIN_NOTIFY_WHATSAPP`
WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
Finance/pricing: `FINANCE_APPLY_URL`, `PAY_DISCOUNT_PCT`

\* **`DATABASE_URL` is optional on Vercel:** the app now falls back to the
Supabase integration's `POSTGRES_PRISMA_URL` / `POSTGRES_URL` automatically
(see `src/lib/database-url.ts`). Set `DATABASE_URL` locally (session-pooler /
port-5432 URL) for `prisma db push`.

## 6. Run locally
```bash
cd D:\Work\doctorSoctland
npm install
# .env must exist with DATABASE_URL etc. (gitignored — not in repo)
npm run dev            # http://localhost:3000
# schema/seed (stop the dev server first on Windows — Prisma engine file lock):
npm run db:push
npm run db:seed
```
Expose via ngrok (optional): `ngrok http 3000` → grab URL from http://localhost:4040/api/tunnels

## 7. Gmail send — how it was set up
- OAuth client (Google Cloud project `valued-ceiling-502310-j6`), scope `gmail.send`.
- **Authorized redirect URI** (must match `<APP_URL>/api/auth/google/callback`):
  - `https://dashboard.dentalscotland.com/api/auth/google/callback` (prod)
  - `https://aida-snaky-unvisibly.ngrok-free.dev/api/auth/google/callback` (local test)
- Flow: admin logs in → visits `/api/auth/google` → consent → callback shows the
  refresh token → stored as `GMAIL_REFRESH_TOKEN` (in Vercel + local `.env`).
- Code: `src/lib/google.ts` (OAuth + Gmail REST send), wired into
  `src/lib/notify.ts` `sendEmail` (Gmail → Resend → simulated).
- Sender address = `EMAIL_FROM` (`concierge@dentalscotland.com`) — must be the
  authorised mailbox or a verified send-as alias.

## 8. Where notifications fire (all use `src/lib/notify.ts`)
- Proposal sent (email + WhatsApp): `src/app/admin/actions.ts`
- Free-form message (email + WhatsApp): `src/app/admin/actions.ts`
- OTP login code (email + WhatsApp): `src/app/p/actions.ts`
- Admin alerts — interested / call-back / payment-option chosen: `src/app/p/actions.ts`
- Admin alerts — paid / deposit (+ receipts): `src/app/api/stripe/webhook/route.ts`
- Admin alert — overdue instalment (+ receipt): `src/app/api/cron/instalments/route.ts`
- Admin alert — consent signed / finance applied: `submitApplication` in `src/app/p/actions.ts`
- Payment reminders (email + WhatsApp) to unpaid patients: `src/app/api/cron/reminders/route.ts`
- Finance link to patient (on admin approval): `approveFinance` in `src/app/admin/actions.ts`

## 8b. Feature map (added this session)
- **£250 upfront credit:** `Patient.upfrontPaidPence`; toggled on the edit form. Net
  total = price − £250; helper `netPricePence()` in `src/lib/pricing.ts`. Rule is
  "minus £250, then 5% off" for pay-in-full. All charge sites use net (proposal
  page, Stripe checkout, mark-paid, webhook, instalments cron, proposal email).
- **Edit patient (any status):** `/admin/patients/[id]/edit` +
  `src/components/EditPatientForm.tsx` + `updatePatient` action; "Edit" button on
  the profile.
- **Twice-daily reminders:** `/api/cron/reminders` (statuses sent/interested/
  awaiting/overdue). Personalised templates `reminderEmailHtml` /
  `reminderWhatsAppText`. Scheduled in `vercel.json` at 09:00 + 17:00.
- **Consent + signature + finance:** selecting 0% finance or "I'm interested"
  opens `src/components/ConsentModal.tsx` (Invisalign consent text in
  `src/lib/consent.ts`, drawn-signature pad, basic info + DOB). Submits via
  `submitApplication`; patient sees "check inbox, email in 2–3 hours". Admin
  approves on the profile → `approveFinance` auto-emails the finance link
  (`financeLinkEmailHtml`). Fields: `dateOfBirth`, `consentSignedAt`,
  `consentSignature`, `financeLink`, `financeApprovedAt`.

## 9. Pending / next steps
- [ ] **Stripe:** provide `STRIPE_SECRET_KEY` (test `sk_test_…`). Register webhook
      `https://dashboard.dentalscotland.com/api/stripe/webhook` (event
      `checkout.session.completed`) → `STRIPE_WEBHOOK_SECRET`. Then test card
      `4242 4242 4242 4242`.
- [ ] **WhatsApp:** provide `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN`,
      `ADMIN_NOTIFY_WHATSAPP`; add own number as verified test recipient. For
      business-initiated sends outside the 24h window, create an approved Meta
      template and swap `type:"text"` in `src/lib/notify.ts` (`sendWhatsApp`).
- [ ] Set `ADMIN_NOTIFY_EMAIL` + `EMAIL_FROM` = concierge@ in **Vercel** (local done).
- [ ] Delete the downloaded `client_secret_*.json` from Downloads (secret in plaintext).
- [ ] Optional: change admin password from the default.
- [ ] **Reminders cron plan:** there are now 3 Vercel crons (instalments + 2
      reminders). Vercel **Hobby** allows only ~2 crons and runs them once/day, so
      true twice-daily reminders need **Vercel Pro** — or drop the 17:00 entry and
      hit `/api/cron/reminders` from an external scheduler with the CRON_SECRET.
      `CRON_SECRET` must be set in Vercel (Vercel auto-sends it as the Bearer token).
- [ ] Visually confirm the signature pad in a browser (build-verified; the in-app
      browser tool was unavailable when it was built).

## 10. Gotchas / operational notes
- **Windows Prisma lock:** stop the dev server before `npm run db:push`
  (Windows locks the query-engine DLL; `db push` succeeds but client regen EPERMs).
- **`.next` cache corruption:** if you see `__webpack_require__.n is not a function`
  or stale-chunk errors, stop the server, `rm -rf .next`, restart, hard-refresh browser.
- **Shared DB:** local and prod use the SAME Supabase DB — local edits hit prod data.
- **ngrok URL is ephemeral** — regenerate and re-register the OAuth redirect URI if it changes.
- **Prod deploys** happen automatically on push to `main`. Env-var changes need a Redeploy.
- **Never commit secrets** — `.env` is gitignored; keep it that way.

## 11. Changes made this session (git history)
- `cc4518e` Add Gmail send via Google OAuth; remove "Monthly payments" option
- `a7fc778` Use concierge@dentalscotland.com as the single practice email
- `d867df8` Fall back to Supabase POSTGRES_* when DATABASE_URL is unset (fixed prod 500)
- `2f0d731` Document Gmail-primary email, Supabase fallback, WhatsApp setup in .env.example
- `f64f739` Editable patients, £250 upfront credit, twice-daily payment reminders
- `9a70603` Consent + signature flow for finance / interest, with admin approval

## 12. Demo data notes
- **Sophie Brown** has £250 marked as paid upfront (showcases the credit: £2,250 →
  £2,000 balance → £1,900 pay-in-full).
- **Jack Wilson** has a signed finance application (status "awaiting") so the admin
  finance-approval card is visible on his profile. Revert via the Edit form if needed.
