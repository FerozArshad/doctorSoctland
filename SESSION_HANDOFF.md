# Session Handoff — Dental Scotland (Invisalign Proposals, Payments & Reporting)

Last updated: **2026-07-22**. Complete working state — anyone (or a new session) can
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
| WhatsApp (Meta Cloud API) | ⏳ blocked | Code + templates + display name ready; number still **PENDING / not registered** and **no Meta App subscribed to the WABA** — see **§11** (full dossier) |
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

## 11. WhatsApp — full integration dossier (updated 2026-07-22)

### 11.1 Goal (Phase 1 — outbound only)
Business-initiated messages to patients via **WhatsApp Cloud API** (no BSP, no n8n):
- Proposal link when admin clicks **Send / Resend proposal**
- Payment reminder on sequence **touch 1** only
- OTP / login code when patient chooses WhatsApp on `/p/[token]`
- Admin alerts to `ADMIN_NOTIFY_WHATSAPP` (still free-form text; may fail outside 24h window)

**Phase 2 (not built):** inbound webhook + conversation history / admin inbox.
Outbound “Messages sent” history already exists on the patient profile (`MessageLog`).

### 11.2 Meta account facts (verified via Graph API 2026-07-22)

| Item | Value / status |
|---|---|
| Business verification | ✅ Verified |
| WABA name | Dental Scotland |
| **WABA ID** | `1839924533652808` ← **NOT** the phone number ID |
| **Phone Number ID** (correct) | `1186752691194998` |
| Display phone | **+44 7915 357177** |
| Display name | **Dental Scotland** — ✅ **APPROVED** (do not use “Dental Scotland Care”; that was rejected) |
| Code verification | `VERIFIED` |
| Account / phone `status` | **`CONNECTED`** ✅ (registered via API / Postman 2026-07-23) |
| `platform_type` | `NOT_APPLICABLE` |
| `is_on_biz_app` | `false` |
| WABA `subscribed_apps` | **`[]` empty** ← why number does **not** show under App → WhatsApp → API Setup |
| Meta App ID (in `.env`) | `2093913674807269` |
| Token type used | Permanent **System User** token with scopes `whatsapp_business_messaging`, `whatsapp_business_management` |
| Token identity seen via API | “Conversions API System User” — token works against the WABA, but the **developer app is not subscribed** to the WABA |

⚠️ **Critical mix-up that burned time:** local/Vercel previously had
`WHATSAPP_PHONE_NUMBER_ID=1839924533652808` (the **WABA** id). Graph returns WABA
fields (`message_template_namespace`, currency…) for that id. Messaging
`/{id}/messages` then fails with “Object does not exist / missing permissions”.
**Always use Phone Number ID `1186752691194998` for sends.**

### 11.3 Why the number does not appear in Meta “API Setup”
The number **exists on the WABA** (API lists it). It does **not** appear in
**developers.facebook.com → App → WhatsApp → API Setup** because:

1. **`subscribed_apps` is empty** — the Meta App is not linked to WABA `1839924533652808`.
2. Phone was **PENDING**; registration completed → now **CONNECTED**.
3. **Do not send test messages to +44 7915 357177 itself** (that is the business
   sender). Use a personal mobile on the patient record.

**Do not keep “adding” the same number again** — that creates duplicates/confusion.
**Link the existing WABA to the app**, then **Register** the existing number.

**Fix steps (practice / Meta admin):**
1. [Meta Business Settings](https://business.facebook.com/settings) → **Accounts →
   WhatsApp accounts → Dental Scotland** → **Apps / Connected apps** → **Add** app
   `2093913674807269` with WhatsApp messaging permissions.
2. Or: [developers.facebook.com](https://developers.facebook.com) → correct app →
   **WhatsApp → API Setup** → connect / select WABA **Dental Scotland** (existing).
3. After it appears: open **+44 7915 357177** → complete **Register / Activate**
   (set a **6-digit two-step PIN**). Status must become **CONNECTED** (not PENDING).
4. Optional API register (once app is subscribed):  
   `POST /v21.0/1186752691194998/register`  
   body `{ "messaging_product": "whatsapp", "pin": "<6-digit-PIN>" }`  
   — only with a PIN the practice chooses and stores safely.

Until status is CONNECTED, sends fail with:
`(#133010) Account not registered`.

### 11.4 Templates (approved — create body rules)
Language: **`en_GB`** (must match `WHATSAPP_TEMPLATE_LANG`).

Meta **rejects variables at the very start or end** of the body. Use static text
before `{{1}}` and after `{{2}}`.

| Meta name (as created) | Category | Actual body text | App uses for |
|---|---|---|---|
| `payment_reminder` | Utility | Hello {{1}}, … plan is **ready**. Open … {{2}} Thanks… | **Proposal send** (`WHATSAPP_TPL_PROPOSAL`) |
| `porposal_ready` *(typo)* | Utility | Hello {{1}}, a **reminder** … {{2}} Thanks… | **Reminder** (`WHATSAPP_TPL_REMINDER`) |
| `login_code` | Authentication | `*{{1}}* is your verification code…` + Copy code button | OTP (`button` URL param = code) |

⚠️ There is **no** template named `proposal_ready`. Code defaults were updated
2026-07-23 to match Meta. Prefer recreating correctly named templates later.

Sample values when submitting: `{{1}}=Sarah`,
`{{2}}=https://dashboard.dentalscotland.com/p/example`.

Optional overrides in env if Meta names differ:
`WHATSAPP_TPL_PROPOSAL`, `WHATSAPP_TPL_REMINDER`, `WHATSAPP_TPL_LOGIN`.

### 11.5 Code (already on `main`)
File: `src/lib/notify.ts`

| Helper | Used by | Behaviour |
|---|---|---|
| `sendProposalWhatsApp(patient)` | `deliverProposal` in `src/app/admin/actions.ts` | Template `proposal_ready` if `WHATSAPP_TEMPLATES_ENABLED=1`, else free-form text |
| `sendReminderWhatsApp(patient)` | `src/app/api/cron/reminders/route.ts` (touch 1 only) | Template `payment_reminder` |
| `sendLoginCodeWhatsApp(phone, code)` | `sendOtp` in `src/app/p/actions.ts` | Template `login_code` |
| `sendWhatsApp(phone, text)` | Admin notify + fallbacks | Free-form text |
| `whatsappConfigured()` / `whatsappTemplatesEnabled()` | gating | Token + phone id; templates flag |

Go-live switch: **`WHATSAPP_TEMPLATES_ENABLED=1`** (local already `1`).
Production needs the same on **Vercel** + Redeploy or templates stay off / text fallback.

Send-proposal UX (2026-07-22):
- Loader spinner on **Send / Resend proposal** (and create & send, deposit, mark paid,
  finance approve) via `FormSubmitButton` / `NewPatientActions`.
- Toast reports email + WhatsApp outcome (incl. WhatsApp failed).

Patient access gotcha (fixed 2026-07-22): creating a patient whose email already
exists redirected to their profile → **404** if current admin couldn’t access them.
Now: access-aware redirect; if owned + “Create & send”, proposal is sent on the
existing record. **Grace Stewart** (demo) is owned by `coordinator@` —
profile id `cmrj4e00t000turyapyziq2ir`.

### 11.6 Environment variables (WhatsApp)

| Name | Purpose | Correct / notes |
|---|---|---|
| `WHATSAPP_TOKEN` | Permanent System User token | Not the 24h API-Setup test token |
| `WHATSAPP_PHONE_NUMBER_ID` | **Phone Number ID** | **`1186752691194998`** — never the WABA id |
| `WHATSAPP_TEMPLATES_ENABLED` | `1` / `true` to send templates | Local `1`; set on Vercel + redeploy |
| `WHATSAPP_TEMPLATE_LANG` | Template language code | `en_GB` |
| `ADMIN_NOTIFY_WHATSAPP` | Practice alert number | e.g. `+447915357177` (E.164) |
| `WHATSAPP_TPL_*` | Optional template name overrides | Defaults: `proposal_ready`, `payment_reminder`, `login_code` |
| `NEXT_PUBLIC_META_APP_ID` | Embedded signup / Meta app | `2093913674807269` |
| `NEXT_PUBLIC_META_CONFIG_ID` | Embedded signup config | present in `.env` |
| `META_APP_SECRET` | Embedded signup | present in `.env` |

`/admin/whatsapp-connect` (Embedded Signup / coexistence) is a **dormant dead end**
for the practice’s consumer WhatsApp Business app number — ruled out without a
BSP/Tech Provider. Cloud API number above is the path.

### 11.7 How to test (once CONNECTED + app subscribed + Vercel env correct)

1. Confirm Vercel: `WHATSAPP_PHONE_NUMBER_ID=1186752691194998`,
   `WHATSAPP_TEMPLATES_ENABLED=1`, token set → **Redeploy**.
2. Log in (Super Admin sees all patients; coordinator only own).
3. Open a patient with **your** mobile in E.164 (`+44…`) — not a fake demo number.
4. Patient profile → **Resend proposal** → expect WhatsApp template + email; toast
   should say email + WhatsApp (not “WhatsApp failed”).
5. Open proposal link → **WhatsApp a code** → receive OTP template.
6. Check activity / **Messages sent** on the profile.

Graph quick checks (no secrets in handoff):
- `GET /{waba-id}/phone_numbers` → status should be CONNECTED
- `GET /{waba-id}/subscribed_apps` → should list the Meta App (not `[]`)
- `POST /{phone-number-id}/messages` with `proposal_ready` → `messages[0].id`

### 11.8 Known errors & meanings

| Error / symptom | Meaning | Fix |
|---|---|---|
| `#133010 Account not registered` | Phone still PENDING / not registered for Cloud API | Register number (PIN); wait for CONNECTED |
| `Object with ID '18399…' does not exist` on `/messages` | Using **WABA id** as phone id | Use `1186752691194998` |
| Number missing in App → API Setup | App not subscribed to WABA | Link app in Business Settings (§11.3) |
| Variable at start/end rejected | Meta template rule | Static text before first & after last variable |
| Zero-tap needs package name / signature | Android autofill OTP | Use **Copy code** auth template |
| Send proposal “stuck”, no loader | Button had no pending UI | Fixed — spinner on send buttons |
| 404 on `/admin/patients/{id}` after “email already exists” | Admin couldn’t access that patient | Fixed access-aware redirect; use Super Admin or owner login |
| Free-form text to patients | Templates disabled or outside 24h window | Keep `WHATSAPP_TEMPLATES_ENABLED=1` for business-initiated |

### 11.9 Remaining WhatsApp checklist
- [x] Register +44 7915 357177 → status **CONNECTED**
- [ ] Link Meta App to WABA (`subscribed_apps` was still empty when last checked)
- [ ] Vercel: `WHATSAPP_PHONE_NUMBER_ID=1186752691194998`,
      `WHATSAPP_TEMPLATES_ENABLED=1`, optional `WHATSAPP_TPL_PROPOSAL=payment_reminder`,
      `WHATSAPP_TPL_REMINDER=porposal_ready` + Redeploy
- [ ] Smoke-test proposal WhatsApp + OTP to a **personal** handset (not the business number)
- [ ] Phase 2: webhook + conversation history / inbox
- [ ] Optional: recreate templates with correct names (`proposal_ready` / `payment_reminder`)

### 11.10 Display-name request copy (for Meta, if ever re-submitted)
Reason used / recommended:
> Official trading name of our dental practice. Matches our website
> dentalscotland.com, patient emails, and clinic branding. Patients recognise us
> as Dental Scotland.

Business website: `https://dentalscotland.com`

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
WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (**=`1186752691194998`**, not WABA id),
  `WHATSAPP_TEMPLATES_ENABLED`, `WHATSAPP_TEMPLATE_LANG` (`en_GB`), optional `WHATSAPP_TPL_*`
  (+ Embedded Signup: `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`, `META_APP_SECRET`)
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

(Full done / remaining / product-vision picture: see `ROADMAP.md`.)

- [ ] **T&C document**: get the terms text or URL and link it from the payment tick.
- [ ] **Create Millie & Rochelle admin logins** at `/admin/team`; optionally assign
      their existing patients via Edit → "Belongs to admin".
- [ ] **WhatsApp go-live** (§11 full dossier): link Meta App to WABA → register
      number to CONNECTED → Vercel phone id `1186752691194998` +
      `WHATSAPP_TEMPLATES_ENABLED=1` + redeploy → smoke-test; later webhook + inbox.
- [ ] **Verify Gmail send-as** for millie@/rochelle@ (`[SEND-AS TEST]` emails in
      concierge@) — the touch-1 emails to Millie/Rochelle test patients came from the
      concierge fallback, so this is STILL unanswered.
- [ ] Review sequence emails 4–7 copy (tagged `[4/7]`…`[7/7]` in asadqureshi1908@ inbox).
- [ ] Replace the demo July 2026 report with real figures.
- [ ] Change default admin passwords; delete Downloads `client_secret_*.json`.
- [ ] Delete test patient asadqureshi1908@ when testing is done.
- [ ] Rate limiter is in-memory → inconsistent on serverless (Redis would fix).

## 17. Gotchas

- **Windows Prisma lock**: stop dev server before `npm run db:push`.
- **`.next` cache corruption** (`__webpack_require__.n is not a function`): stop
  server, delete `.next`, restart, hard-refresh.
- **Shared DB**: local edits hit prod data (this is by design — stay careful).
- **Never commit secrets** — `.env` stays gitignored.
- Inline styles beat class selectors → mobile overrides in `globals.css` need `!important`.
- **WhatsApp IDs**: WABA id ≠ Phone Number ID — see §11.2. Wrong id looks “set up”
  but every send fails.
- **WhatsApp UI vs API**: number can exist on WABA via API while App → API Setup is
  empty if `subscribed_apps` is empty (§11.3).

## 18. Commit history (newest first)

| Commit | What |
|---|---|
| `04f786a` | Send-proposal loaders + WhatsApp outcome in toast |
| `18e707d` | Fix 404 when email already exists / access denied |
| `20df07f` | WhatsApp template messaging + brand/proposal UI |
| `60e678b` | Consent + e-sign all payment routes; patient uploads |
| `d56dea7` | Message history + notifications (replace free-form composer) |
| `c1f9cca` | Per-admin isolation, team management, monthly performance reports |
| `47778ec` | T&C tick before payment, tier-based treatment months, sent-by filter |
| `ec3077d` | New pricing tiers (8–15 / 16+); forms read live config |
| `58aea25` | Professional sender name and follow-up subject lines |
| `19bbaac` | Handoff: demo patients neutralized, cron plan resolved |
| `96c2e7f`…`7c3621d` | Session 2: 7-touch sequence, responsive, QA fixes, editable pricing, roles, WhatsApp dead-end |
| `cc4518e`…`9a70603` | Session 1: Gmail OAuth, £250 credit, editable patients, consent+signature |
