# Gold Card WhatsApp — affiliate implementation rules

Dashboard (`doctorSoctland`) forwards inbound Meta webhooks to  
`https://affiliate.dentalscotland.com/api/whatsapp/webhook`.

**This document is for the affiliate repo.** Dashboard implements forwarding, dedup, and `waitUntil` only.

## Dashboard (done here)

- Meta callback stays on `dashboard.dentalscotland.com`
- `waitUntil()` from `@vercel/functions` — forwards complete after response
- Payload dedup table `WhatsAppWebhookDedup` — identical Meta retries skipped
- Forwards raw body + `X-Hub-Signature-256` + `X-Dashboard-Forward-Secret`

## Affiliate (must implement)

### 1. Session start — REF-GOLD only

**Do not** start a session on `Hi`, `YES`, or generic greetings.

| Action | Rule |
|--------|------|
| Start session | Inbound text contains `REF-GOLD` (case-insensitive), e.g. from desk QR `wa.me` prefilled message |
| Advance session | `YES` only when a session already exists for that `wa_id` |
| Ignore | All other inbound text with no active session (including patients replying to proposal templates) |

### 2. Idempotency — non-negotiable

```sql
-- unique index on Meta message id
CREATE UNIQUE INDEX ON gold_card_events (wamid);
```

Before the state machine: `INSERT … ON CONFLICT DO NOTHING` on `messages[].id`.  
If duplicate → return 200, no signup, no reply.

Meta retries failed webhooks for up to **7 days**. Without this you get duplicate signups.

### 3. Session expiry — 24 hours

- Session `expiresAt = createdAt + 24h`
- After expiry: delete or mark dead; **no** free-form nudge
- User must rescan QR (new `REF-GOLD-…` message) to restart
- Do not build recovery templates for v1

### 4. Consent — record, not just YES

Store for each signup:

| Field | Example |
|-------|---------|
| `wa_id` | Meta WhatsApp id |
| `membershipConsentText` | Exact wording shown before YES |
| `membershipConsentedAt` | ISO timestamp |
| `marketingConsent` | separate boolean + text + timestamp if collected |

**Membership consent** ≠ **marketing consent**. You need both on file under UK GDPR before marketing templates.

### 5. Webhook auth

Require `X-Dashboard-Forward-Secret` matching dashboard `WHATSAPP_FORWARD_SECRET`.  
Optionally verify `X-Hub-Signature-256` with the same `META_APP_SECRET`.

### 6. Outbound

Same `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` as dashboard.  
Inside 24h after user message: free-form replies OK.  
Outside 24h: **approved templates only** (Meta policy).

## Meta / policy alignment

| Topic | Dashboard | Affiliate |
|-------|-----------|-----------|
| Proposal / OTP | Utility + auth templates | N/A |
| Follow-up sequence | `proposal_ready` template when `WHATSAPP_TEMPLATES_ENABLED=1` | N/A |
| Gold Card signup | Forwards only | REF-GOLD session + consent records |
| Marketing | Not sent without consent | Separate opt-in required |

## Known gaps (be honest)

1. **STOP replies** — Privacy policy tells users to reply STOP; you must honour opt-outs in your DB and stop sends. Meta does not auto-unsubscribe for Cloud API.
2. **Shared number** — Proposal patients messaging “Hi” must **not** enter Gold Card (REF-GOLD rule).
3. **Affiliate privacy policy** — Gold Card signup on `affiliate.dentalscotland.com` needs its own policy or a linked section; dashboard policy covers treatment data, not membership programme alone.
