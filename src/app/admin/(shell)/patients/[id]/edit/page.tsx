import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import EditPatientForm from "@/components/EditPatientForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditPatientPage({ params }: { params: { id: string } }) {
  const p = await db.patient.findUnique({ where: { id: params.id } });
  if (!p) notFound();

  return (
    <>
      <TopBar title={`Edit — ${p.firstName} ${p.lastName}`.trim()} sub="Update patient details and pricing" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <EditPatientForm
          patient={{
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            phone: p.phone,
            alignerCount: p.alignerCount,
            pkg: p.pkg === "Express" ? "Express" : "Go",
            videoUrl: p.videoUrl,
            notes: p.notes,
            paidUpfront: p.upfrontPaidPence > 0,
          }}
        />
      </div>
    </>
  );
}
