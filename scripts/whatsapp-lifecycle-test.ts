/**
 * Full delivery lifecycle test: send login_code template and poll DB for webhook events.
 * Usage: npx tsx --env-file=.env scripts/whatsapp-lifecycle-test.ts 03030777067
 *
 * Requires production webhook deployed (Meta posts to APP_URL/api/whatsapp/webhook).
 */
import { db } from "../src/lib/db";
import { getWhatsAppConfig, WHATSAPP_GRAPH_VERSION } from "../src/lib/whatsapp-settings";
import { sendWhatsAppTemplate, normalisePhone } from "../src/lib/notify";
import { getDeliveryLifecycle } from "../src/lib/whatsapp-delivery-log";

const APP_ID = "2093913674807269";
const WABA_ID = "1839924533652808";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function checkWebhookSubscription(token: string) {
  console.log("\n=== WEBHOOK SUBSCRIPTION CHECK ===");
  const appUrl = (process.env.APP_URL || "https://dashboard.dentalscotland.com").replace(/\/$/, "");
  console.log("Expected callback URL:", `${appUrl}/api/whatsapp/webhook`);

  const subs = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${APP_ID}/subscriptions`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  console.log("\nGET /{app-id}/subscriptions HTTP:", subs.status);
  console.log(await subs.text());

  const wabaApps = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WABA_ID}/subscribed_apps`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  console.log("\nGET /{waba-id}/subscribed_apps HTTP:", wabaApps.status);
  console.log(await wabaApps.text());
}

async function main() {
  const target = process.argv[2] || "03030777067";
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const normalised = normalisePhone(target);

  console.log("=== LIFECYCLE TEST ===");
  console.log("Target:", target, "→", normalised);
  console.log("OTP code:", code);
  console.log("Time:", new Date().toISOString());

  const cfg = await getWhatsAppConfig();
  await checkWebhookSubscription(cfg.token);

  console.log("\n=== OUTBOUND: login_code template ===");
  const sendResult = await sendWhatsAppTemplate(target, cfg.tplLogin || "login_code", [code], { buttonCode: code });
  console.log("Send result:", JSON.stringify(sendResult, null, 2));

  const messageId = sendResult.messageId;
  if (!messageId) {
    console.error("No messageId — cannot trace lifecycle");
    process.exit(1);
  }

  console.log("\nMessage ID:", messageId);
  console.log("Polling DB for webhook status events (90s)…\n");

  const expectedStatuses = ["sent", "delivered", "read", "failed", "undeliverable"];
  const seen = new Set<string>();

  for (let i = 0; i < 18; i++) {
    await sleep(5000);
    const { outbound, events } = await getDeliveryLifecycle(messageId);
    console.log(`--- Poll ${i + 1} (${(i + 1) * 5}s) ---`);

    if (outbound) {
      console.log("OUTBOUND LOG:");
      console.log("  httpStatus:", outbound.httpStatus);
      console.log("  requestBody:", JSON.stringify(outbound.requestBody, null, 2));
      console.log("  responseBody:", JSON.stringify(outbound.responseBody, null, 2));
    }

    if (events.length === 0) {
      console.log("WEBHOOK EVENTS: (none yet)");
    } else {
      for (const ev of events) {
        const key = `${ev.status}-${ev.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          console.log(`WEBHOOK STATUS: ${ev.status.toUpperCase()}`);
          console.log("  messageId:", ev.messageId);
          console.log("  recipientId:", ev.recipientId);
          console.log("  eventTimestamp:", ev.eventTimestamp?.toISOString() || null);
          console.log("  errorCode:", ev.errorCode);
          console.log("  errorTitle:", ev.errorTitle);
          console.log("  errorMessage:", ev.errorMessage);
          console.log("  errorsJson:", JSON.stringify(ev.errorsJson, null, 2));
          console.log("  conversation:", JSON.stringify(ev.conversation, null, 2));
          console.log("  pricing:", JSON.stringify(ev.pricing, null, 2));
          console.log("  metadata:", JSON.stringify(ev.metadata, null, 2));
          console.log("  rawPayload:", JSON.stringify(ev.rawPayload, null, 2));
        }
      }
    }

    const hasTerminal = events.some((ev) => ["delivered", "read", "failed", "undeliverable"].includes(ev.status));
    if (hasTerminal) break;
  }

  console.log("\n=== FINAL LIFECYCLE SUMMARY ===");
  const final = await getDeliveryLifecycle(messageId);
  console.log("Outbound:", final.outbound ? "logged" : "MISSING");
  console.log(
    "Webhook events:",
    final.events.map((ev) => ev.status).join(" → ") || "NONE"
  );

  if (final.events.length === 0) {
    console.log("\n⚠ NO WEBHOOK EVENTS RECEIVED");
    console.log("Possible causes:");
    console.log("  1. Production deploy not live yet (webhook code not deployed)");
    console.log("  2. Meta webhook signature rejected (check metaAppSecret)");
    console.log("  3. Meta not subscribed to messages field");
    console.log("  4. Callback URL mismatch");
    console.log("  5. Meta still processing (check again in 2-5 min)");
  }

  const missing = expectedStatuses.filter((s) => !final.events.some((ev) => ev.status === s));
  console.log("Statuses not received:", missing.join(", ") || "all expected received");
}

main()
  .catch((e) => {
    console.error("fatal:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
