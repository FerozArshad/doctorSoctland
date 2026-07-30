/** Fix porposal_ready → proposal_ready in WhatsAppSettings DB row. */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const row = await db.whatsAppSettings.findUnique({ where: { id: "default" } });
if (!row) {
  console.log("No WhatsAppSettings row — nothing to fix.");
} else if (row.tplReminder === "porposal_ready") {
  await db.whatsAppSettings.update({
    where: { id: "default" },
    data: { tplReminder: "proposal_ready" },
  });
  console.log("Updated tplReminder: porposal_ready → proposal_ready");
} else {
  console.log(`tplReminder already "${row.tplReminder}" — no change.`);
}
await db.$disconnect();
