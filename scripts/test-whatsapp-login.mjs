/** Test login_code OTP template. Usage: node --env-file=.env scripts/test-whatsapp-login.mjs 923030777067 */
import { PrismaClient } from "@prisma/client";

const to = (process.argv[2] || "").replace(/\D/g, "");
if (!to) {
  console.error("Usage: node scripts/test-whatsapp-login.mjs <recipient_digits>");
  process.exit(1);
}

function pick(dbVal, envVal, fallback = "") {
  const d = (dbVal || "").trim();
  if (d) return d;
  return (envVal || "").trim() || fallback;
}

const db = new PrismaClient();
const row = await db.whatsAppSettings.findUnique({ where: { id: "default" } }).catch(() => null);
const token = pick(row?.token, process.env.WHATSAPP_TOKEN);
const phoneNumberId = pick(row?.phoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID);
const lang = pick(row?.templateLang, process.env.WHATSAPP_TEMPLATE_LANG, "en_GB");
const tpl = pick(row?.tplLogin, process.env.WHATSAPP_TPL_LOGIN, "login_code");
const code = String(Math.floor(100000 + Math.random() * 900000));

const body = {
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: {
    name: tpl,
    language: { code: lang },
    components: [
      { type: "body", parameters: [{ type: "text", text: code }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
    ],
  },
};

console.log("Sending", tpl, "to", to, "code", code);
const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const json = await res.json();
console.log(JSON.stringify({ status: res.status, ...json }, null, 2));
await db.$disconnect();
process.exit(res.ok ? 0 : 1);
