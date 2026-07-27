import { Suspense } from "react";
import { db } from "@/lib/db";
import { patientWhere, requireAdmin } from "@/lib/auth";
import { initials } from "@/lib/status";
import AdminShellFrame from "@/components/AdminShellFrame";
import Toast from "@/components/Toast";
import { MessageNotificationsProvider } from "@/components/MessageNotificationsContext";

export const dynamic = "force-dynamic";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const patientCount = await db.patient.count({ where: patientWhere(admin) });
  const [first, ...rest] = admin.name.replace(/^Dr\.?\s+/i, "").split(" ");

  return (
    <MessageNotificationsProvider>
      <AdminShellFrame
        sidebar={{
          patientCount,
          adminName: admin.name,
          adminRole: admin.role,
          isSuperAdmin: admin.isSuperAdmin,
          adminInitials: initials(first || "?", rest.join(" ")),
        }}
      >
        {children}
      </AdminShellFrame>
      <Suspense>
        <Toast />
      </Suspense>
    </MessageNotificationsProvider>
  );
}
