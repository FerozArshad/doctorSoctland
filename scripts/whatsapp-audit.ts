/**
 * Read-only WhatsApp evidence audit — prints Meta Graph responses and config provenance.
 * Usage: WHATSAPP_DEBUG=1 npx tsx --env-file=.env scripts/whatsapp-audit.ts
 */
import { db } from "../src/lib/db";
import { getWhatsAppConfig, getWhatsAppHealth, WHATSAPP_GRAPH_VERSION } from "../src/lib/whatsapp-settings";

const SUSPECT_PHONE_ID = "1283239378199903";
const PRODUCTION_PHONE_ID = "1186752691194998";
const WABA_ID = "1839924533652808";

async function graphGet(token: string, path: string) {
  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token.trim()}` }, cache: "no-store" });
  const raw = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = { _parseError: true, raw };
  }
  return { url, status: res.status, raw, json };
}

async function main() {
  console.log("=== 1. PHONE NUMBER ID PROVENANCE ===");
  console.log(`Search repo for ${SUSPECT_PHONE_ID}: NOT IN APPLICATION CODE (only appeared in user-provided curl)`);
  console.log(`Application documented production Phone Number ID: ${PRODUCTION_PHONE_ID}`);

  const row = await db.whatsAppSettings.findUnique({ where: { id: "default" } });
  const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const envToken = process.env.WHATSAPP_TOKEN || "";
  console.log("\nDB WhatsAppSettings.phoneNumberId:", row?.phoneNumberId || "(empty)");
  console.log("DB WhatsAppSettings.token present:", !!(row?.token || "").trim());
  console.log("ENV WHATSAPP_PHONE_NUMBER_ID:", envPhone || "(empty)");
  console.log("ENV WHATSAPP_TOKEN present:", !!envToken.trim());

  const cfg = await getWhatsAppConfig();
  const token = cfg.token.trim();
  console.log("\nResolved backend config:");
  console.log("  configSource:", cfg.source);
  console.log("  phoneNumberId:", cfg.phoneNumberId);
  console.log("  tokenPrefix:", token.slice(0, 12) + "…");
  console.log("  tokenLength:", token.length);

  console.log("\n=== 2. TOKEN IDENTITY (debug_token) ===");
  const appId = process.env.META_APP_ID || "";
  if (appId) {
    const dbg = await graphGet(token, `debug_token?input_token=${encodeURIComponent(token)}`);
    console.log("debug_token URL:", dbg.url.replace(token, "[TOKEN]"));
    console.log("HTTP:", dbg.status);
    console.log("Body:", dbg.raw);
  } else {
    // Meta allows debug_token with the token itself as input when using app access token;
    // try with the user token as both (limited info).
    const dbg = await graphGet(token, `debug_token?input_token=${encodeURIComponent(token)}`);
    console.log("debug_token (self) HTTP:", dbg.status);
    console.log("Body:", dbg.raw);
  }

  console.log("\n=== 3. PRODUCTION PHONE NUMBER NODE ===");
  const prodPhone = await graphGet(
    token,
    `${PRODUCTION_PHONE_ID}?fields=id,display_phone_number,verified_name,quality_rating,platform_type,throughput,health_status`
  );
  console.log("URL:", prodPhone.url);
  console.log("HTTP:", prodPhone.status);
  console.log("RAW:", prodPhone.raw);

  console.log(`\n=== 4. SUSPECT PHONE NUMBER NODE (${SUSPECT_PHONE_ID}) ===`);
  const suspectPhone = await graphGet(
    token,
    `${SUSPECT_PHONE_ID}?fields=id,display_phone_number,verified_name,quality_rating,platform_type,health_status`
  );
  console.log("URL:", suspectPhone.url);
  console.log("HTTP:", suspectPhone.status);
  console.log("RAW:", suspectPhone.raw);

  console.log("\n=== 5. ALL PHONE NUMBERS ON WABA ===");
  const wabaPhones = await graphGet(token, `${WABA_ID}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status`);
  console.log("URL:", wabaPhones.url);
  console.log("HTTP:", wabaPhones.status);
  console.log("RAW:", wabaPhones.raw);

  console.log("\n=== 6. WABA DETAILS ===");
  const waba = await graphGet(
    token,
    `${WABA_ID}?fields=id,name,account_review_status,message_template_namespace,timezone_id`
  );
  console.log("HTTP:", waba.status);
  console.log("RAW:", waba.raw);

  const wabaApps = await graphGet(token, `${WABA_ID}/subscribed_apps`);
  console.log("\nWABA subscribed_apps HTTP:", wabaApps.status);
  console.log("RAW:", wabaApps.raw);

  console.log("\n=== 7. HEALTH CHECK FUNCTION OUTPUT ===");
  const health = await getWhatsAppHealth({ probeMessaging: true });
  console.log(JSON.stringify(health, null, 2));

  console.log("\n=== 8. WEBHOOK / DB EVIDENCE ===");
  const waSettings = await db.whatsAppSettings.findUnique({ where: { id: "default" } });
  console.log("webhookVerifyToken configured:", !!(waSettings?.webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim());
  console.log("metaAppSecret configured:", !!(waSettings?.metaAppSecret || process.env.META_APP_SECRET || "").trim());

  const activities = await db.activity.findMany({
    where: { OR: [{ text: { contains: "WhatsApp" } }, { text: { contains: "whatsapp" } }] },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, text: true, createdAt: true, patient: { select: { phone: true, firstName: true, lastName: true } } },
  });
  console.log("\nRecent WhatsApp-related activity rows:", activities.length);
  for (const a of activities) {
    console.log(`  ${a.createdAt.toISOString()} | ${a.patient?.phone || "?"} | ${a.text}`);
  }

  const pkPatient = await db.patient.findFirst({
    where: { phone: { contains: "3030777067" } },
    select: { id: true, phone: true, firstName: true },
  });
  console.log("\nPatient record for 03030777067:", pkPatient || "NOT FOUND — webhook statuses discarded by findPatientByWaId");

  console.log("\n=== 9. MESSAGE IDS FROM LAST TEST (cannot poll status via Graph — webhook only) ===");
  const testIds = [
    "wamid.HBgMOTIzMDMwNzc3MDY3FQIAERgSNjVFODgyNkIxRkM1RTk2ODFDAA==",
    "wamid.HBgMOTIzMDMwNzc3MDY3FQIAERgSQTlGRjM2N0EwOEZCMTI5QjU5AA==",
    "wamid.HBgMOTIzMDMwNzc3MDY3FQIAERgSQ0UxMDVEMUU1Nzg2Q0FBRTNEAA==",
    "wamid.HBgMOTIzMDMwNzc3MDY3FQIAERgSODU4NEVBNTEyQjVGQjY3RkE5AA==",
  ];
  for (const id of testIds) {
    const probe = await graphGet(token, encodeURIComponent(id));
    console.log(`GET /${id.slice(0, 30)}… HTTP ${probe.status}:`, probe.raw.slice(0, 200));
  }
}

main()
  .catch((e) => {
    console.error("fatal", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
