import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { initials } from "@/lib/status";
import Sidebar from "@/components/Sidebar";
import Toast from "@/components/Toast";

export const dynamic = "force-dynamic";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const patientCount = await db.patient.count();
  const [first, ...rest] = admin.name.replace(/^Dr\.?\s+/i, "").split(" ");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        patientCount={patientCount}
        adminName={admin.name}
        adminRole={admin.role}
        adminInitials={initials(first || "?", rest.join(" "))}
      />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
        {children}
      </main>
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}
