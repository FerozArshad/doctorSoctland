import { PrismaClient } from "@prisma/client";

const PHONE_NUMBER_ID = "1240334725831342";
const db = new PrismaClient();

const row = await db.whatsAppSettings.upsert({
  where: { id: "default" },
  update: { phoneNumberId: PHONE_NUMBER_ID },
  create: { id: "default", phoneNumberId: PHONE_NUMBER_ID },
});

console.log(JSON.stringify({ ok: true, phoneNumberId: row.phoneNumberId, wabaId: "2294276881326866" }, null, 2));
await db.$disconnect();
