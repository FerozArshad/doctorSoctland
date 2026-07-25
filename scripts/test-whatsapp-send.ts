import { db } from "../src/lib/db";
import { getWhatsAppConfig, getWhatsAppHealth } from "../src/lib/whatsapp-settings";
import { sendWhatsApp, sendWhatsAppTemplate, normalisePhone } from "../src/lib/notify";

const target = process.argv[2] || "03030777067";

async function listTemplates(wabaId: string, token: string) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(wabaId)}/message_templates?limit=25`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  const json = (await res.json()) as {
    data?: Array<{ name: string; status: string; language: string; category?: string }>;
    error?: { message?: string; code?: number };
  };
  console.log("template_list_status:", res.status);
  if (json.error) {
    console.log("template_list_error:", JSON.stringify(json.error, null, 2));
    return [];
  }
  for (const t of json.data || []) {
    console.log(`  - ${t.name} [${t.language}] status=${t.status} category=${t.category || "?"}`);
  }
  return json.data || [];
}

async function main() {
  console.log("target:", target);
  console.log("normalised:", normalisePhone(target));

  const cfg = await getWhatsAppConfig();
  console.log("config:", {
    source: cfg.source,
    phoneNumberId: cfg.phoneNumberId,
    hasToken: !!cfg.token,
    templatesEnabled: cfg.templatesEnabled,
    tplLogin: cfg.tplLogin,
    tplProposal: cfg.tplProposal,
    templateLang: cfg.templateLang,
  });

  const health = await getWhatsAppHealth({ probeMessaging: true });
  console.log("health:", JSON.stringify({ ok: health?.ok, summary: health?.summary, wabaId: health?.wabaId, advisories: health?.advisories }, null, 2));

  const wabaId = health?.wabaId || "1839924533652808";
  console.log("\n--- Approved templates on WABA ---");
  const templates = await listTemplates(wabaId, cfg.token);
  const approved = templates.filter((t) => t.status === "APPROVED");

  console.log("\n--- Attempt 1: free-form text (often NOT delivered outside 24h window) ---");
  const textResult = await sendWhatsApp(target, "Dental Scotland test — please reply YES if you see this.");
  console.log("text_send:", JSON.stringify(textResult, null, 2));

  console.log("\n--- Attempt 2: login_code template ---");
  const loginResult = await sendWhatsAppTemplate(target, cfg.tplLogin || "login_code", ["847291"], { buttonCode: "847291" });
  console.log("login_template:", JSON.stringify(loginResult, null, 2));

  if (approved.some((t) => t.name === "jaspers_market_plain_text_v1")) {
    console.log("\n--- Attempt 3: jaspers_market_plain_text_v1 (Meta API setup test template) ---");
    const jasperResult = await sendWhatsAppTemplate(target, "jaspers_market_plain_text_v1", []);
    console.log("jasper_template:", JSON.stringify(jasperResult, null, 2));
  }

  if (approved.some((t) => t.name === (cfg.tplProposal || "payment_reminder"))) {
    console.log("\n--- Attempt 4: proposal template ---");
    const propResult = await sendWhatsAppTemplate(target, cfg.tplProposal || "payment_reminder", [
      "Test",
      "https://dashboard.dentalscotland.com/p/test",
    ]);
    console.log("proposal_template:", JSON.stringify(propResult, null, 2));
  }

  console.log("\nNOTE: Meta returns messageId + accepted even when delivery fails later.");
  console.log("Check webhook logs for failed/undeliverable status, or WhatsApp on the phone in 1-2 min.");
}

main()
  .catch((e) => {
    console.error("fatal:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
