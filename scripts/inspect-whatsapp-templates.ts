import { db } from "../src/lib/db";
import { getWhatsAppConfig, getWhatsAppHealth } from "../src/lib/whatsapp-settings";

async function main() {
  const cfg = await getWhatsAppConfig();
  const health = await getWhatsAppHealth();
  const wabaId = health?.wabaId || "1839924533652808";
  const token = cfg.token.trim();

  for (const name of ["login_code", "payment_reminder", "porposal_ready"]) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=${encodeURIComponent(name)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await res.json();
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify(json, null, 2));
  }
}

main()
  .finally(() => db.$disconnect());
