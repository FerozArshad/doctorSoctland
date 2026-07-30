/**
 * Test proposal template send (payment_reminder).
 * Usage: node scripts/test-whatsapp-proposal.mjs 923186615562
 */
import { PrismaClient } from "@prisma/client";

const to = (process.argv[2] || "").replace(/\D/g, "");
const BUSINESS_SENDER_SUFFIX = "7915357177";

function pick(dbVal, envVal) {
  const d = (dbVal || "").trim();
  if (d) return d;
  return (envVal || "").trim();
}

if (!to || to.length < 10) {
  console.error("Usage: node scripts/test-whatsapp-proposal.mjs <recipient_digits>");
  process.exit(1);
}
if (to.endsWith(BUSINESS_SENDER_SUFFIX)) {
  console.error("Use a personal mobile, not the business sender.");
  process.exit(1);
}

const db = new PrismaClient();
const row = await db.whatsAppSettings.findUnique({ where: { id: "default" } }).catch(() => null);
const token = pick(row?.token, process.env.WHATSAPP_TOKEN);
const phoneNumberId = pick(row?.phoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID);
const lang = pick(row?.templateLang, process.env.WHATSAPP_TEMPLATE_LANG, "en_GB") || "en_GB";
const tpl = pick(row?.tplProposal, process.env.WHATSAPP_TPL_PROPOSAL, "payment_reminder") || "payment_reminder";
const link = `${(process.env.APP_URL || "https://dashboard.dentalscotland.com").replace(/\/$/, "")}/p/test-token`;

const body = {
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: {
    name: tpl,
    language: { code: lang },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Test" },
          { type: "text", text: link },
        ],
      },
    ],
  },
};

console.log("Sending template:", tpl, "lang:", lang, "to:", to);
const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const json = await res.json();
console.log(JSON.stringify({ status: res.status, ...json }, null, 2));
await db.$disconnect();
process.exit(res.ok ? 0 : 1);
