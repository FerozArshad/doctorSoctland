import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { log } from "@/lib/log";
import { timingSafeEqualStr } from "@/lib/secure";
import { claimWhatsAppWebhookPayload } from "@/lib/whatsapp-webhook-dedup";
import { processWhatsAppWebhookPost } from "@/lib/whatsapp-webhook-process";
import { getWhatsAppConfig } from "@/lib/whatsapp-settings";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API webhook.
 * Configure in Meta App → WhatsApp → Configuration:
 *   Callback URL: https://dashboard.dentalscotland.com/api/whatsapp/webhook
 *   Verify token: same as saved in Admin → WhatsApp (or WHATSAPP_WEBHOOK_VERIFY_TOKEN)
 * Subscribe to field: messages (includes inbound messages + delivery statuses)
 *
 * Inbound POSTs are optionally forwarded to affiliate (Gold Card) via WHATSAPP_FORWARD_* env.
 * Meta callback URL stays on this app only. Processing uses waitUntil + payload dedup.
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

  let body: Parameters<typeof processWhatsAppWebhookPost>[2];
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const claimed = await claimWhatsAppWebhookPayload(rawBody);
  if (!claimed) {
    return NextResponse.json({ ok: true });
  }

  waitUntil(
    processWhatsAppWebhookPost(rawBody, metaSignature, body).catch((e) => {
      log.error("whatsapp.webhook.process.fail", { message: e instanceof Error ? e.message : String(e) });
    })
  );

  return NextResponse.json({ ok: true });
}
