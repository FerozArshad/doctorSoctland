# Session Handoff — Dental Scotland (Invisalign Proposals, Payments & Reporting)

Last updated: **2026-07-21**. Complete working state — anyone (or a new session) can
pick up from this file without re-deriving context. **No secrets live here** — real
values are only in local `.env` (gitignored) and Vercel → Settings → Environment Variables.

---

## 1. What this is

Next.js 14 (App Router) + Prisma + Postgres app for dentalscotland.com:

- **Admin side**: dashboard, patient list (status + sent-by filters), proposal builder,
  edit patient (any status, incl. owner reassignment), payment tracking, messaging,
  finance approval, **team management (create admins)**, **monthly per-admin reports**,
  editable pricing settings.
- **Patient side**: OTP-gated proposal page (`/p/[token]`) with payment options,
  £250 upfront credit, **required T&C tick before any payment route**, consent +
  signature modal for finance.
- **Payment options**: Pay-in-full (5% off), £700 deposit + 3 auto-collected
  instalments, 0% finance.

- **Repo:** https://github.com/FerozArshad/doctorSoctland (branch `main` auto-deploys to Vercel)
- **Live URL:** https://dashboard.dentalscotland.com
- **Local clone:** `D:\Work\doctorSoctland`

## 2. Environments & database

- **Single shared Supabase Postgres across local AND production** — any local change
  writes to the same DB production reads. Be careful.
- Supabase host: `db.mkzauukubdxsuadiwcvv.supabase.co` (pooler:
  `aws-1-eu-west-2.pooler.supabase.com`). Values in `.env` / Vercel.
- Local dev: `http://localhost:3000`. Prod deploys automatically on push to `main`;
  env-var changes need a manual Redeploy.

## 3. Logins

| Account | Email | Password | Access |
|---|---|---|---|
| Super Admin | concierge@dentalscotland.com | superadmin2026 | Everything: all patients, revenue, Team, all reports |
| Plain Admin | coordinator@dentalscotland.com | admin2026 | Own patients only, own reports, no revenue |

- **Millie / Rochelle have NO admin logins yet** — create at `/admin/team` (Super Admin).
- Login: 10 attempts / 15 min per email. "Too many attempts" = lockout (in-memory —
  a redeploy clears it). Passwords are NOT trimmed — beware trailing spaces.
- Patient test record: `asadqureshi1908@gmail.com` / `test1234` (delete when done).
- Demo patients password: `dental123`.
- ⚠️ Default admin passwords should still be changed.

## 4. Per-admin isolation (added 2026-07-21)

- `Patient.ownerId` → owning `Admin`. **Plain admins see only patients they own OR
  sent** (`sentByEmail` matches their email); Super Admins see everything. Enforced
  via `patientWhere()` / `canAccessPatient()` in `src/lib/auth.ts` on: dashboard,
  patient list, profile, edit page, sidebar count, and ALL server actions
  (`requireOwnedPatient` in `src/app/admin/actions.ts`).
- Patient ownership is set automatically on creation; a **Super Admin can reassign**
  via Edit patient → "Belongs to admin" dropdown.
- Legacy patients (null owner, no sender) are Super-Admin-only.
- Demo state: **Grace Stewart is assigned to coordinator@** as an isolation demo.
- `/admin/team` (Super Admin only): lists admins with patient counts; creates new
  admin logins (name, email, password ≥8 chars, role title, optional Super Admin).

## 5. Monthly reports (added 2026-07-21)

`/admin/reports` (sidebar → "Monthly reports"):

- **Computed live** per admin+month (attribution = owned OR sent-by): Invisalign
  orders (patients whose *first* successful payment fell in the month), income
  collected that month, avg treatment value per new aligner patient.
- **Manual template fields**: Invisalign consults seen / went ahead; composite
  bonding consults / went ahead / income; veneers the same; notes. Derived: consult
  conversion %, avg per bonding patient, avg per veneer patient.
- **Held records**: one `MonthlyReport` row per admin+month (unique), filed/adjusted
  timestamps shown in the Report log; saving again adjusts the record.
- **Notifications**: save → confirmation email to that admin with figures + next due
  date. **1st of each month 09:00** the reminders cron emails every admin who hasn't
  filed the previous month (skips those who have).
- Super Admin switches admins via name chips; months via ‹ › (future months blocked).
- ⚠️ A **demo July 2026 report** was filed under Rhona (notes say "Demo entry") —
  replace with real figures.

## 6. Pricing & treatment months (updated 2026-07-21)

- **Tiers: ≤7 → £1,500 · 8–15 → £2,250 · 16+ → £2,750** (boundary changed from 20→15
  in both the DB `Pricing` row and code defaults).
- Editable at `/admin/settings`; `src/lib/pricing.ts` is pure/client-safe;
  `pricing-settings.ts` (`getPricing()`) is server-only with fallback defaults.
- **The New/Edit patient forms read the live config** (they previously had hardcoded
  price tables — fixed). Hint text, £250 labels, discount % all follow Settings.
- **Estimated treatment time is tier-based**: ≤7 → 6 months · 8–15 → 10 · 16+ → 12
  (`estMonths` in pricing.ts; used by proposal page, forms, emails).
- **Changing pricing never alters an existing patient's quote** — `pricePence` /
  `discountPct` are captured at proposal time.

## 7. Integration status

| Integration | Status | Notes |
|---|---|---|
| Database (Supabase) | ✅ | schema pushed incl. `ownerId` + `MonthlyReport` |
| Auth (`AUTH_SECRET`) | ✅ | Vercel + local |
| Email (Gmail send) | ✅ | OAuth `gmail.send`, falls back Resend → simulated |
| WhatsApp (Meta Cloud API) | ⏳ | code ready, simulated until keys. **Business verification approved** — see §11 |
| Stripe | ✅ verified e2e | LIVE keys in Vercel, TEST keys local — keep it that way |
| Editable pricing | ✅ | `/admin/settings` |
| Super Admin / Admin roles | ✅ | now with full patient isolation |
| 7-touch sequence | ✅ | days 1,4,10,20,26,29,30 + 30-day price lock |
| Per-coordinator sending | ⚠️ verify | check `[SEND-AS TEST]` emails in concierge@ — if From was rewritten, aliases unverified → use Reply-To |
| Responsive | ✅ | 375px + 1280px verified |
| Crons | ✅ | 2 daily @ 09:00 (Hobby-compatible): instalments + reminders/sequence/report-reminders |
| Monthly reports | ✅ | see §5 |
| T&C tick | ✅ | see §8 — **needs the real T&C document/URL** |

## 8. Patient payment flow

- **T&C tick (added 2026-07-20)**: proposal page payment options require a ticked
  "I agree to the Terms & Conditions" before the button enables (all 3 routes);
  server-side enforced in `selectPaymentOption`; logged to the activity timeline
  ("Accepted the Terms & Conditions") for audit. ⚠️ The label links to no document
  yet — **provide the T&C text or URL**.
- **Instalments are fully automatic**: deposit checkout saves the card
  (`setup_future_usage: off_session`), webhook schedules 3 monthly instalments, the
  daily instalments cron charges the saved card off-session; receipts emailed;
  failures mark patient `overdue` + admin alert.
- **£250 upfront credit**: `Patient.upfrontPaidPence`, toggled on the edit form;
  everything charges on net (price − credit); pay-in-full = net then 5% off.
- **Consent + finance**: 0% finance opens `ConsentModal` (consent text in
  `src/lib/consent.ts`, drawn signature, DOB); admin approves → finance link emailed.

## 9. Follow-up sequence & sender

- `src/lib/sequence.ts` — 7 touches, clock = `proposalSentAt`, price locked 30 days,
  day-30 sets `priceLockExpired` + admin alert. Resending restarts the clock.
  WhatsApp only on touch 1. **Subjects rewritten professional (2026-07-20)** — e.g.
  "Your personalised Invisalign plan, Emma — price locked for 30 days".
- **Fallback sender is "Dental Scotland"** (was "The team at Dental Scotland") —
  `FALLBACK_COORDINATOR` in `src/lib/coordinators.ts`. Used when no coordinator
  picked; otherwise From = Millie/Rochelle (needs verified send-as aliases, §7).
- Patients list has a **"Sent by" filter** (Anyone/Millie/Rochelle/Other) —
  populates as proposals are sent through the picker.

## 10. Where notifications fire (all via `src/lib/notify.ts`)

- Proposal sent / free-form message: `src/app/admin/actions.ts`
- OTP code, interested / call-back / payment-option alerts: `src/app/p/actions.ts`
- Paid / deposit alerts + receipts: `src/app/api/stripe/webhook/route.ts`
- Instalment collection + receipts / failures: `src/app/api/cron/instalments/route.ts`
- Sequence touches + price-lock expiry + **monthly-report reminders (1st)**:
  `src/app/api/cron/reminders/route.ts`
- Report-saved confirmation: `saveMonthlyReport` in `src/app/admin/actions.ts`
- Finance link on approval: `approveFinance` in `src/app/admin/actions.ts`

## 11. WhatsApp — current plan (discussed 2026-07-20)

Business verification is **approved**. To go live, in Meta/WhatsApp Manager:
1. Register **+44 7915 357177** to the WABA (2-number cap lifted post-verification;
   the old practice number can't be used — it's on the consumer app, and coexistence
   needs a Tech Provider/BSP — `/admin/whatsapp-connect` is a dormant dead end).
2. Set env vars (Vercel + `.env`): `WHATSAPP_PHONE_NUMBER_ID` (API Setup page),
   `WHATSAPP_TOKEN` (**permanent** System-User token with `whatsapp_business_messaging`
   + `whatsapp_business_management` — the API-Setup token dies in 24h),
   `ADMIN_NOTIFY_WHATSAPP`.
3. Create templates: `proposal_ready` (Utility), `payment_reminder` (Utility),
   `login_code` (**Authentication** category — required for OTP). Then a code change
   swaps `type:"text"` → `type:"template"` in `sendWhatsApp` (`src/lib/notify.ts`).
4. **Agreed direction for human replies**: our own webhook (`/api/whatsapp/webhook`,
   to build) + admin-dashboard inbox — free, official, one number. Conditional/AI
   auto-replies live in our code (no n8n/BSP). Free-form replies allowed inside the
   24h service window; outside it, templates only. The phone app CANNOT share the
   API number without a BSP/Tech Provider — ruled out unofficial libraries (ban risk).

## 12. Cron jobs (`vercel.json` — exactly 2, fits Hobby)

| Path | Schedule | Does |
|---|---|---|
| `/api/cron/instalments` | 09:00 daily | charges due instalments off-session |
| `/api/cron/reminders` | 09:00 daily | 7-touch sequence; day-30 lock expiry; **on the 1st: monthly-report reminder emails** |

Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel sends automatically; must be set).
Crons are registered in Vercel (confirmed firing 2026-07-21, ~10:17 first observed).

## 13. Demo data state

- 9 seeded demo patients (`src/lib/seed-data.ts`, fake-looking Gmail addresses).
  **Neutralized 2026-07-17**: the 5 in sequence-eligible statuses were set to
  `draft`; none had received a sequence email (`sequenceTouch=0`). Statuses now:
  drafts + Emma/Callum `deposit`, Liam `paid`. ⚠️ Never send real email/WhatsApp to
  these addresses — they could be real strangers. Test only with concierge@ / own number.
- Millie Buchanan + Rochelle Copland exist as **test patients** (millie@/rochelle@
  addresses) for send-as testing — they receive sequence touches (internal, fine).
- Grace Stewart → owned by coordinator@ (isolation demo). Demo July report under
  Rhona (§5). Test patient Asad (§3).

## 14. Environment variables (names only)

Core: `DATABASE_URL`*, `AUTH_SECRET`, `APP_URL`, `CRON_SECRET`
Gmail: `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, (`RESEND_API_KEY` optional)
Notify: `ADMIN_NOTIFY_EMAIL` (=concierge@), `ADMIN_NOTIFY_WHATSAPP`
WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
Finance: `FINANCE_APPLY_URL`, `PAY_DISCOUNT_PCT`

\* Optional on Vercel — falls back to Supabase `POSTGRES_PRISMA_URL`/`POSTGRES_URL`
(`src/lib/database-url.ts`). Needed locally (port-5432 session pooler) for `db push`.

## 15. Run locally

```bash
cd D:\Work\doctorSoctland
npm install          # .env must exist (gitignored)
npm run dev          # http://localhost:3000
# schema/seed — STOP the dev server first (Windows Prisma DLL lock):
npm run db:push
npm run db:seed
```

Gmail OAuth (if re-authing): admin login → `/api/auth/google` → consent → refresh
token → `GMAIL_REFRESH_TOKEN`. Redirect URI must match `<APP_URL>/api/auth/google/callback`
(Google Cloud project `valued-ceiling-502310-j6`).

## 16. Open items / next steps

- [ ] **T&C document**: get the terms text or URL and link it from the payment tick.
- [ ] **Create Millie & Rochelle admin logins** at `/admin/team`; optionally assign
      their existing patients via Edit → "Belongs to admin".
- [ ] **WhatsApp go-live** (§11): number, 3 env vars, 3 templates → then the
      `type:"template"` code change; later the webhook + admin inbox.
- [ ] **Verify Gmail send-as** for millie@/rochelle@ (`[SEND-AS TEST]` emails in
      concierge@) — the touch-1 emails to Millie/Rochelle test patients came from the
      concierge fallback, so this is STILL unanswered.
- [ ] Review sequence emails 4–7 copy (tagged `[4/7]`…`[7/7]` in asadqureshi1908@ inbox).
- [ ] Replace the demo July 2026 report with real figures.
- [ ] Change default admin passwords; delete Downloads `client_secret_*.json`.
- [ ] Delete test patient asadqureshi1908@ when testing is done.
- [ ] Rate limiter is in-memory → inconsistent on serverless (Redis would fix).
- [ ] Dead `monthly` label lingers on the profile (trivial).

## 17. Gotchas

- **Windows Prisma lock**: stop dev server before `npm run db:push`.
- **`.next` cache corruption** (`__webpack_require__.n is not a function`): stop
  server, delete `.next`, restart, hard-refresh.
- **Shared DB**: local edits hit prod data (this is by design — stay careful).
- **Never commit secrets** — `.env` stays gitignored.
- Inline styles beat class selectors → mobile overrides in `globals.css` need `!important`.

## 18. Commit history (newest first)

| Commit | What |
|---|---|
| `c1f9cca` | Per-admin isolation, team management, monthly performance reports |
| `47778ec` | T&C tick before payment, tier-based treatment months, sent-by filter |
| `ec3077d` | New pricing tiers (8–15 / 16+); forms read live config |
| `58aea25` | Professional sender name and follow-up subject lines |
| `19bbaac` | Handoff: demo patients neutralized, cron plan resolved |
| `96c2e7f`…`7c3621d` | Session 2: 7-touch sequence, responsive, QA fixes, editable pricing, roles, WhatsApp dead-end |
| `cc4518e`…`9a70603` | Session 1: Gmail OAuth, £250 credit, editable patients, consent+signature |
