import { PrismaClient } from "@prisma/client";

function pick(dbVal, envVal) {
  const d = (dbVal || "").trim();
  if (d) return d;
  return (envVal || "").trim();
}

const db = new PrismaClient();
const row = await db.whatsAppSettings.findUnique({ where: { id: "default" } }).catch(() => null);
const token = pick(row?.token, process.env.WHATSAPP_TOKEN);
const waba = process.env.WHATSAPP_WABA_ID || "2294276881326866";

if (!token) {
  console.error("Missing WHATSAPP_TOKEN");
  process.exit(1);
}

const res = await fetch(
  `https://graph.facebook.com/v21.0/${encodeURIComponent(waba)}/message_templates?limit=50&fields=name,status,language,category,components`,
  { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
);
const json = await res.json();
console.log(JSON.stringify({ status: res.status, ...json }, null, 2));
await db.$disconnect();
