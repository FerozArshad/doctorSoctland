// Forward inbound Meta webhook payloads to affiliate (Gold Card) — dashboard stays primary callback.
// Affiliate rules: docs/GOLD_CARD_WHATSAPP.md (REF-GOLD only, wamid dedup, consent records).
import { log } from "./log";

function envBool(v: string | undefined) {
  const s = (v || "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

const DEFAULT_FORWARD_URL = "https://affiliate.dentalscotland.com/api/whatsapp/webhook";

export function whatsAppForwardEnabled(): boolean {
  const v = (process.env.WHATSAPP_FORWARD_ENABLED || "").toLowerCase().trim();
  // Explicit kill switch only
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

export function whatsAppForwardUrl(): string {
  return (process.env.WHATSAPP_FORWARD_URL || DEFAULT_FORWARD_URL).trim();
}

/** Forward raw Meta payload to affiliate. Awaited inside waitUntil — do not void-fetch. */
export async function forwardWhatsAppWebhook(rawBody: string, metaSignature: string | null): Promise<void> {
  if (!whatsAppForwardEnabled()) {
    log.warn("whatsapp.webhook.forward.skipped", {
      reason: "forward disabled (set WHATSAPP_FORWARD_ENABLED=1 or WHATSAPP_FORWARD_URL)",
    });
    return;
  }
  const url = whatsAppForwardUrl();
  if (!url) {
    log.warn("whatsapp.webhook.forward.skipped", { reason: "WHATSAPP_FORWARD_URL not set" });
    return;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (metaSignature) headers["X-Hub-Signature-256"] = metaSignature;
  const secret = (process.env.WHATSAPP_FORWARD_SECRET || "").trim();
  if (secret) headers["X-Dashboard-Forward-Secret"] = secret;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      log.warn("whatsapp.webhook.forward.fail", {
        status: res.status,
        url,
        body: errBody.slice(0, 200),
      });
      return;
    }
    log.info("whatsapp.webhook.forward.ok", { status: res.status });
  } catch (e) {
    log.warn("whatsapp.webhook.forward.error", {
      message: e instanceof Error ? e.message : String(e),
      url,
    });
  }
}
