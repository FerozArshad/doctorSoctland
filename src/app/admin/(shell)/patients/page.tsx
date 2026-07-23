import { db } from "@/lib/db";
import { patientWhere, requireAdmin } from "@/lib/auth";
import { COORDINATORS } from "@/lib/coordinators";
import { fmt, netPricePence } from "@/lib/pricing";
import { avatarBg, initials, timeAgo } from "@/lib/status";
import TopBar from "@/components/TopBar";
import PatientsTable, { PatientRow } from "@/components/PatientsTable";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const admin = await requireAdmin();
  const patients = await db.patient.findMany({
    where: patientWhere(admin),
    include: { activities: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });

  const rows: PatientRow[] = patients.map((c) => ({
    id: c.id,
    name: c.firstName + " " + c.lastName,
    email: c.email,
    initials: initials(c.firstName, c.lastName),
    avatarBg: avatarBg(c.id),
    alignerCount: c.alignerCount,
    pkg: c.pkg,
    priceFmt: fmt(netPricePence(c.pricePence, c.upfrontPaidPence)),
    status: c.status,
    financeStatus: c.financeStatus || "none",
    lastAgo: c.activities[0] ? timeAgo(c.activities[0].createdAt) : "—",
    coord: COORDINATORS.find((x) => x.email === c.sentByEmail)?.key ?? "other",
  }));

  return (
    <>
      <TopBar title="Patients" sub="Manage records & proposals" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <PatientsTable rows={rows} />
      </div>
    </>
  );
}
