import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function pick(dbVal, envVal, fallback = "") {
  const d = (dbVal || "").trim();
  if (d) return d;
  return (envVal || "").trim() || fallback;
}

async function getConfig() {
  let row = null;
  try {
    row = await db.whatsAppSettings.findUnique({ where: { id: "default" } });
  } catch {
    row = null;
  }
  const token = pick(row?.token, process.env.WHATSAPP_TOKEN);
  const phoneNumberId = pick(row?.phoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID);
  const dbHasCreds = !!(row?.token?.trim() || row?.phoneNumberId?.trim());
  const envHasCreds = !!(process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
  let source = "none";
  if (dbHasCreds && envHasCreds) source = "mixed";
  else if (dbHasCreds) source = "database";
  else if (envHasCreds) source = "env";
  return { token, phoneNumberId, source, templatesEnabled: row?.templatesEnabled ?? false };
}

async function getHealth(token, phoneNumberId) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,health_status`,
    { headers: { Authorization: `Bearer ${token.trim()}` } }
  );
  return res.json();
}

const cfg = await getConfig();
console.log("CONFIG:", JSON.stringify({ source: cfg.source, phoneNumberId: cfg.phoneNumberId, hasToken: !!cfg.token, templatesEnabled: cfg.templatesEnabled }, null, 2));
if (!cfg.token || !cfg.phoneNumberId) {
  console.log("STATUS: NOT CONFIGURED");
  await db.$disconnect();
  process.exit(0);
}
const health = await getHealth(cfg.token, cfg.phoneNumberId);
console.log("META:", JSON.stringify(health, null, 2));
await db.$disconnect();
