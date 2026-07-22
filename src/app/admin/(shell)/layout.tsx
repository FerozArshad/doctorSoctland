import { Suspense } from "react";
import { db } from "@/lib/db";
import { patientWhere, requireAdmin } from "@/lib/auth";
import { buildMessageNotifications } from "@/lib/messages";
import { initials } from "@/lib/status";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";
import { MessageNotificationsProvider } from "@/components/MessageNotificationsContext";

export const dynamic = "force-dynamic";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const patientCount = await db.patient.count({ where: patientWhere(admin) });
  const [first, ...rest] = admin.name.replace(/^Dr\.?\s+/i, "").split(" ");
  const patientsForMessages = await db.patient.findMany({
    where: patientWhere(admin),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      proposalSentAt: true,
      sequenceTouch: true,
      priceLockExpired: true,
      phone: true,
      activities: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  const messageNotifications = buildMessageNotifications(patientsForMessages);

  return (
    <MessageNotificationsProvider data={messageNotifications}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar
          patientCount={patientCount}
          adminName={admin.name}
          adminRole={admin.role}
          isSuperAdmin={admin.isSuperAdmin}
          adminInitials={initials(first || "?", rest.join(" "))}
        />
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
          {children}
        </main>
        <Suspense>
          <Toast />
        </Suspense>
      </div>
    </MessageNotificationsProvider>
  );
}
