import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { timingSafeEqualStr } from "@/lib/secure";
import { forwardWhatsAppWebhook } from "@/lib/whatsapp-forward";
import { getWhatsAppConfig } from "@/lib/whatsapp-settings";

export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API webhook.
 * Configure in Meta App → WhatsApp → Configuration:
 *   Callback URL: https://dashboard.dentalscotland.com/api/whatsapp/webhook
 *   Verify token: same as saved in Admin → WhatsApp (or WHATSAPP_WEBHOOK_VERIFY_TOKEN)
 * Subscribe to field: messages (includes inbound messages + delivery statuses)
 *
 * Inbound POSTs are optionally forwarded to affiliate (Gold Card) via WHATSAPP_FORWARD_* env.
 * Meta callback URL stays on this app only.
 */

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

/** Meta GET verification — must echo hub.challenge as plain text. */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = decodeParam(req.nextUrl.searchParams.get("hub.verify_token") || "");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const cfg = await getWhatsAppConfig();
  const expected = (cfg.webhookVerifyToken || "").trim();

  // Browser visit without Meta params — not an error; endpoint is alive.
  if (!mode && !token && !challenge) {
    return new NextResponse(
      "WhatsApp webhook endpoint is active. Meta verifies with GET hub.mode=subscribe; events arrive via POST with X-Hub-Signature-256.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  if (mode !== "subscribe") {
    log.warn("whatsapp.webhook.verify", { ok: false, reason: "bad_mode", mode });
    return NextResponse.json({ error: "Forbidden", detail: "hub.mode must be subscribe" }, { status: 403 });
  }

  if (!expected || expected.length < 8) {
    log.warn("whatsapp.webhook.verify", { ok: false, reason: "verify_token_not_configured" });
    return NextResponse.json(
      { error: "Forbidden", detail: "Webhook verify token not configured in Admin → WhatsApp" },
      { status: 403 }
    );
  }

  if (!challenge) {
    log.warn("whatsapp.webhook.verify", { ok: false, reason: "missing_challenge" });
    return NextResponse.json({ error: "Forbidden", detail: "hub.challenge is required" }, { status: 403 });
  }

  if (!timingSafeEqualStr(token, expected)) {
    log.warn("whatsapp.webhook.verify", { ok: false, reason: "token_mismatch" });
    return NextResponse.json(
      { error: "Forbidden", detail: "Verify token does not match Admin → WhatsApp settings" },
      { status: 403 }
    );
  }

  log.info("whatsapp.webhook.verify", { ok: true });
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

type Status = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
};

async function verifyMetaSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const cfg = await getWhatsAppConfig();
  const secret = (cfg.metaAppSecret || "").trim();
  if (!secret || secret.length < 16) {
    log.warn("whatsapp.webhook.signature_skipped", {
      reason: secret ? "secret_too_short" : "META_APP_SECRET missing — set in Admin → WhatsApp",
    });
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  return timingSafeEqualStr(expected, provided);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const metaSignature = req.headers.get("x-hub-signature-256");
  if (!(await verifyMetaSignature(rawBody, metaSignature))) {
    log.warn("whatsapp.webhook.bad_signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          statuses?: Status[];
          messages?: Array<{ from?: string; type?: string; text?: { body?: string }; id?: string }>;
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          metadata?: { phone_number_id?: string; display_phone_number?: string };
        };
      }>;
    }>;
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const jobs: Promise<unknown>[] = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      for (const st of value.statuses || []) {
        jobs.push(handleStatus(st));
      }

      for (const msg of value.messages || []) {
        if (msg.type === "text" && msg.text?.body) {
          log.info("whatsapp.inbound", {
            from: msg.from || null,
            messageId: msg.id ? msg.id.slice(0, 28) + "…" : null,
            preview: msg.text.body.slice(0, 120),
          });
        }
      }
    }
  }

  await Promise.allSettled(jobs);
  forwardWhatsAppWebhook(rawBody, metaSignature);
  return NextResponse.json({ ok: true });
}

async function handleStatus(st: Status) {
  const status = (st.status || "").toLowerCase();
  const waId = st.recipient_id || "";
  const messageId = st.id || "";
  const err = st.errors?.[0];
  const errMsg = err?.message || err?.title || err?.error_data?.details || "";

  log.info("whatsapp.status", {
    status,
    waId: waId || null,
    messageId: messageId ? messageId.slice(0, 28) + "…" : null,
    code: err?.code || null,
    message: errMsg ? errMsg.slice(0, 160) : null,
  });

  if (!waId || (status !== "failed" && status !== "undeliverable" && status !== "delivered")) return;

  const patient = await findPatientByWaId(waId);
  if (!patient) {
    log.warn("whatsapp.status.unmatched", { waId, status });
    return;
  }

  let text: string;
  if (status === "delivered") {
    text = "WhatsApp delivered";
  } else {
    log.error("whatsapp.delivery.failed", {
      patientId: patient.id,
      waId,
      status,
      messageId: messageId || null,
      code: err?.code || null,
      message: errMsg || null,
      errors: st.errors,
    });
    text = "WhatsApp not delivered";
  }
  await db.activity.create({ data: { patientId: patient.id, text } });
}

async function findPatientByWaId(waId: string) {
  const digits = waId.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const patients = await db.patient.findMany({
    where: { phone: { contains: digits.slice(-10) } },
    select: { id: true, phone: true },
    take: 5,
  });
  return (
    patients.find((p) => (p.phone || "").replace(/\D/g, "").endsWith(digits) || digits.endsWith((p.phone || "").replace(/\D/g, "").slice(-10))) ||
    patients[0] ||
    null
  );
}
