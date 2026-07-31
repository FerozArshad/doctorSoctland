// Forward inbound Meta webhook payloads to affiliate (Gold Card) — dashboard stays primary callback.
// Affiliate rules: docs/GOLD_CARD_WHATSAPP.md (REF-GOLD only, wamid dedup, consent records).
import { log } from "./log";

function envBool(v: string | undefined) {
  const s = (v || "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function whatsAppForwardEnabled(): boolean {
  return envBool(process.env.WHATSAPP_FORWARD_ENABLED);
}

export function whatsAppForwardUrl(): string {
  return (process.env.WHATSAPP_FORWARD_URL || "").trim();
}

/** Forward raw Meta payload to affiliate. Awaited inside waitUntil — do not void-fetch. */
export async function forwardWhatsAppWebhook(rawBody: string, metaSignature: string | null): Promise<void> {
  if (!whatsAppForwardEnabled()) return;
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
      log.warn("whatsapp.webhook.forward.fail", { status: res.status, url });
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
