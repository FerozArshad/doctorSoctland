import type { Admin } from "@prisma/client";
import { db } from "@/lib/db";
import { patientWhere } from "@/lib/auth";
import { buildMessageNotifications, type MessageNotifications } from "@/lib/messages";

/** Load notification bell data — used by the client API route only (not the shell layout). */
export async function loadAdminNotifications(admin: Admin): Promise<MessageNotifications> {
  const where = patientWhere(admin);

  const [patientsForMessages, instalmentsForAlerts] = await Promise.all([
    db.patient.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        proposalSentAt: true,
        sequenceTouch: true,
        priceLockExpired: true,
        financeStatus: true,
        paymentPreference: true,
        phone: true,
        activities: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    }),
    db.instalment.findMany({
      where: {
        status: { in: ["scheduled", "failed"] },
        patient: where,
      },
      select: {
        id: true,
        number: true,
        amountPence: true,
        dueDate: true,
        status: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
  ]);

  return buildMessageNotifications(
    patientsForMessages,
    {
      readKeys: admin.notifReadKeys,
      dismissedKeys: admin.notifDismissedKeys,
    },
    instalmentsForAlerts
  );
}
