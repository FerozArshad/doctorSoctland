import crypto from "crypto";
import { db } from "./db";
import { log } from "./log";

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002";
}

/** SHA-256 of raw Meta POST body — identical retries share one hash. */
export function whatsAppPayloadHash(rawBody: string): string {
  return crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
}

/**
 * Returns true if this payload is new and should be processed.
 * Meta may retry the same webhook for up to 7 days — skip duplicates.
 */
export async function claimWhatsAppWebhookPayload(rawBody: string): Promise<boolean> {
  const payloadHash = whatsAppPayloadHash(rawBody);
  try {
    await db.whatsAppWebhookDedup.create({ data: { payloadHash } });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) {
      log.info("whatsapp.webhook.duplicate", { payloadHash: payloadHash.slice(0, 16) });
      return false;
    }
    // Missing table / DB blip must not block Meta → forward to Gold Card.
    log.error("whatsapp.webhook.dedup.fail", {
      message: e instanceof Error ? e.message : String(e),
      payloadHash: payloadHash.slice(0, 16),
    });
    return true;
  }
}
