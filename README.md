# Dental Scotland — Invisalign Proposal & Payments

Full-stack app implementing the approved Claude Design mockup (`Invisalign Dashboard.dc.html`) for **dentalscotland.com**.

**Admin side** (Treatment Coordinator): dashboard with revenue/pipeline analytics, patient list, proposal builder with live preview and auto-pricing, patient profiles with payment tracking, one-click proposal delivery by **email + WhatsApp**, and a free-form message composer.

**Patient side**: branded proposal page with the ClinCheck smile video, "why us" section, complimentary items, three payment options (**Stripe** pay-in-full with discount, **£700 deposit + 3 auto-collected monthly instalments**, external **0% finance** application), *I'M INTERESTED* / call-back buttons that alert the practice, plus **account creation** (set a password → log in any time at `/login`).

**Patient access is two-factor**: the emailed/WhatsApp'd secure link opens an identity gate — the patient requests a **6-digit one-time code by email or WhatsApp** (valid 10 min, 5 attempts, bcrypt-hashed at rest) and only then sees the proposal. Returning patients can also log in with their password. While email/WhatsApp keys are unset, the code is shown on-screen in a clearly-marked test-mode box so you can try the flow; that box disappears automatically once real keys are configured. Demo patients seeded with password `dental123` for testing.

## Quick start (local)

```bash
npm install
npm run db:push     # creates dev.db (SQLite)
npm run db:seed     # admin login + 9 demo patients
npm run dev         # http://localhost:3000
```

**Admin login:** `concierge@dentalscotland.com` / `dental123` — change this after first login (or edit `prisma/seed.ts` before seeding a fresh DB).

---

## 🤝 Handoff — everything a new developer needs

Clone the repo, then run the commands below. There is **no `.env` in git** (it holds secrets) — copy the example and fill it in.

### 1. First-time setup
```bash
git clone https://github.com/FerozArshad/doctorSoctland.git
cd doctorSoctland
npm install                 # install dependencies
cp .env.example .env        # then edit .env (see the integrations table below)
npm run db:push             # create the database from prisma/schema.prisma
npm run db:seed             # seed admin + 9 demo patients
npm run dev                 # start on http://localhost:3000
```

### 2. Everyday commands
| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (hot reload) at http://localhost:3000 |
| `npm run build` | Production build — run this before deploying to catch type errors |
| `npm run start` | Serve the production build locally |
| `npm run db:push` | Apply `prisma/schema.prisma` changes to the database |
| `npm run db:seed` | Load the admin account + demo patients (skips if patients already exist) |
| `npm run admin:password -- NewPass123` | Change the admin password from the terminal |
| `npx prisma studio` | Open a visual database browser to view/edit records |
| `npx tsc --noEmit` | Type-check the whole project without building |

> **Windows note:** stop the dev server before running `npm run db:push` — Windows locks Prisma's engine file while the server is running.

### 3. Key URLs
| URL | Page |
|---|---|
| `/admin/login` | Staff login |
| `/admin` | Dashboard (analytics, activity, follow-ups) |
| `/admin/patients` | Patient list (search + filters) |
| `/admin/patients/new` | Create a proposal |
| `/admin/patients/[id]` | Patient profile — payments, messaging, "Open pay link" |
| `/p/[token]` | The patient's secure proposal page (OTP-gated) |
| `/login` | Returning-patient login |

### 4. Going live (Vercel)
```bash
# 1. Push code to GitHub (already done — this repo)
# 2. Import the repo at vercel.com → New Project
# 3. In Vercel → Settings → Environment Variables, add everything from .env.example
#    with REAL values (AUTH_SECRET: run `openssl rand -hex 32`)
# 4. Switch prisma/schema.prisma datasource provider "sqlite" → "postgresql"
#    and set DATABASE_URL to a hosted Postgres (Neon/Supabase/Vercel Postgres)
# 5. Deploy. Set APP_URL to your domain e.g. https://smile.dentalscotland.com
# 6. In Stripe → Webhooks, add https://<domain>/api/stripe/webhook
#    (event: checkout.session.completed)
```
`vercel.json` already schedules the daily instalment-collection cron at 09:00.

### 5. What still needs YOUR keys (paste into `.env`)
Stripe · Resend (email) · WhatsApp Cloud API · Finance provider URL · admin alert contacts. See the **integrations table** further down. Until they're set, messaging is *simulated* (logged to the console) and Stripe buttons show a friendly "not configured" toast — everything else works.

## Connecting your real services

Copy `.env.example` over `.env` and fill in:

| Service | Keys | Where to get them |
|---|---|---|
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com → Developers → API keys. For local webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook` |
| **Email** | `RESEND_API_KEY`, `EMAIL_FROM` | resend.com → verify the `dentalscotland.com` domain so mail comes from your address |
| **WhatsApp** | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | developers.facebook.com → your Meta app → WhatsApp → API Setup (WhatsApp **Business Cloud API** — the business phone *app* alone is not enough) |
| **Finance** | `FINANCE_APPLY_URL` | Your lender's application link (Tabeo, Chrysalis, DivideBuy…) |
| **Alerts** | `ADMIN_NOTIFY_EMAIL`, `ADMIN_NOTIFY_WHATSAPP` | Where "patient is interested / paid / instalment failed" alerts go |

Until keys are added, email/WhatsApp sends are **simulated** (logged to the server console) and Stripe buttons show a friendly "not configured" toast — the rest of the app works fully.

> **WhatsApp note:** Meta only allows free-form text inside a 24-hour customer-service window. For business-initiated proposal / reminder / OTP messages the app sends approved templates when `WHATSAPP_TEMPLATES_ENABLED=1` (see `src/lib/notify.ts`). Keep that flag off until Meta approves the display name and templates.

## How payments flow

The proposal page shows a compact **payment chooser form** — the patient picks one of four routes (plus an optional message), the choice is recorded on their record (`paymentPreference`, shown on the admin profile) and the practice is alerted by email/WhatsApp. Then:

1. **Pay in full** → straight to Stripe Checkout for the discounted price → webhook marks patient *Paid in Full*, emails a receipt, alerts the practice.
2. **Deposit + 3 instalments** → Stripe Checkout for £700 with the card saved for off-session use → webhook marks *Deposit Paid* and schedules 3 monthly `Instalment` records → `GET /api/cron/instalments` (daily, `Authorization: Bearer CRON_SECRET`) charges each one automatically when due; failures flag the patient *Overdue* and alert the practice.
3. **Monthly payments** → full price spread over the estimated treatment duration (min 6 months) — patient requests it, status becomes *Awaiting Payment*, and the practice sends the schedule (e.g. via the message composer).
4. **0% finance** → logs the application, alerts the practice, redirects the patient to `FINANCE_APPLY_URL`.

`vercel.json` already schedules the cron daily at 09:00 if you deploy on Vercel (add `CRON_SECRET` in project settings). Elsewhere, hit the endpoint from any scheduler.

## Deploying

- **Vercel** (recommended): push to GitHub → import → add env vars → set `APP_URL=https://smile.dentalscotland.com` (or your chosen subdomain) → point the DNS record at Vercel.
- Switch `datasource` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL` to a hosted Postgres (Neon/Supabase/Vercel Postgres) — SQLite is for local dev only.
- Add the production webhook in Stripe: `https://<your-domain>/api/stripe/webhook` (event: `checkout.session.completed`).

## Security model

- **Sessions**: signed JWTs in httpOnly, sameSite cookies (secure flag in production). The app refuses to start in production without a strong `AUTH_SECRET`.
- **Passwords & OTPs**: bcrypt-hashed at rest; OTP codes are crypto-random, expire in 10 min, max 5 verify attempts, max 3 sends per 10 min. On-screen test codes appear only when a channel has no keys configured — never on a send failure.
- **Patient actions** (pay, choose plan, set password, express interest) require a verified session — the secure link alone can't trigger them, so a forwarded email can't be abused.
- **Rate limiting**: 5 attempts / 15 min on both admin and patient logins (in-memory — swap for Redis if multi-instance).
- **Payments**: card data never touches the app (Stripe-hosted checkout); webhook signatures verified; amounts computed server-side; cron endpoint fails closed without `CRON_SECRET`.
- **Output safety**: patient-supplied text is HTML-escaped before being embedded in practice emails; React escapes everything rendered in the app.
- **Headers**: X-Frame-Options DENY (anti-clickjacking), nosniff, restrictive referrer & permissions policies.

Known gaps to accept or address before/after launch: no admin 2FA, JWT sessions can't be revoked server-side (30-day expiry), in-memory rate limits reset on redeploy, and `npm audit` reports advisories in Next 14 (several apply only to features this app doesn't use; upgrading to Next 15+ is the fix — a moderate refactor).

## Structure

```
prisma/schema.prisma        Admin, Patient, Activity, Payment, Instalment
src/lib/                    pricing rules, status palette, auth (JWT cookies),
                            Stripe client, email/WhatsApp senders
src/app/admin/              login + dashboard/patients/new/profile (auth-gated)
src/app/p/[token]/          customer proposal page (secure link)
src/app/login/              patient login
src/app/api/stripe/webhook  payment confirmation
src/app/api/cron/instalments  scheduled instalment collection
```
