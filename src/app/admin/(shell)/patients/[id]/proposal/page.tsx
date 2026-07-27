import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import ProposalForm from "@/components/ProposalForm";
import AdminPatientFiles from "@/components/AdminPatientFiles";
import { canAccessPatient, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPricing } from "@/lib/pricing-settings";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const p = await db.patient.findUnique({
    where: { id: params.id },
    include: {
      uploads: {
        where: { uploadedBy: "admin" },
        orderBy: { createdAt: "desc" },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
    },
  });
  if (!p || !canAccessPatient(admin, p)) notFound();
  const cfg = await getPricing();
  const owners = admin.isSuperAdmin
    ? await db.admin.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } })
    : undefined;

  const name = `${p.firstName} ${p.lastName}`.trim();

  return (
    <>
      <TopBar
        title={`Proposal — ${name}`}
        sub={p.status === "draft" ? "Draft — save or send when ready" : "Edit treatment plan and pricing"}
      />
      <div className="ds-scroll ds-admin-pad" style={{ flex: 1, overflow: "auto" }}>
        <div className="ds-view" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <ProposalForm
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
              ownerId: p.ownerId,
              status: p.status,
              treatmentType: p.treatmentType || "invisalign",
              includeWhitening: p.includeWhitening ?? false,
            }}
            cfg={cfg}
            owners={owners}
            canDelete={admin.isSuperAdmin}
          />
          <AdminPatientFiles
            patientId={p.id}
            proposalToken={p.proposalToken}
            files={p.uploads}
            returnTo={`/admin/patients/${p.id}/proposal`}
          />
        </div>
      </div>
    </>
  );
}
