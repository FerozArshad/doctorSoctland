/**
 * Prove outbound WhatsApp works — sends Meta's pre-approved hello_world template.
 * Usage: node scripts/test-whatsapp-hello.mjs 447700900123
 *   (digits only, no + — must NOT be the business sender +447915357177)
 */
import { PrismaClient } from "@prisma/client";

const to = (process.argv[2] || process.env.WHATSAPP_TEST_TO || "").replace(/\D/g, "");
const BUSINESS_SENDER_SUFFIX = "7915357177";

function pick(dbVal, envVal) {
  const d = (dbVal || "").trim();
  if (d) return d;
  return (envVal || "").trim();
}

if (!to || to.length < 10) {
  console.error("Usage: node scripts/test-whatsapp-hello.mjs <recipient_digits_no_plus>");
  console.error("Example: node scripts/test-whatsapp-hello.mjs 447700900123");
  process.exit(1);
}

if (to.endsWith(BUSINESS_SENDER_SUFFIX)) {
  console.error("Do not send to the business number (+44 7915 357177) — use your personal mobile.");
  process.exit(1);
}

const db = new PrismaClient();
const row = await db.whatsAppSettings.findUnique({ where: { id: "default" } }).catch(() => null);
const token = pick(row?.token, process.env.WHATSAPP_TOKEN);
const phoneNumberId = pick(row?.phoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID);

if (!token || !phoneNumberId) {
  console.error("Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
  process.exit(1);
}

const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: "hello_world",
      language: { code: "en_US" },
    },
  }),
});

const json = await res.json();
console.log(JSON.stringify({ status: res.status, ...json }, null, 2));

if (res.ok && json.messages?.[0]?.id) {
  console.log("\n✓ Send accepted — check your phone for the hello_world message.");
} else {
  process.exit(1);
}

await db.$disconnect();
