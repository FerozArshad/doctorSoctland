import TopBar from "@/components/TopBar";
import ProposalForm, { NEW_PROPOSAL_PATIENT } from "@/components/ProposalForm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPricing } from "@/lib/pricing-settings";

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  const admin = await requireAdmin();
  const cfg = await getPricing();
  const owners = admin.isSuperAdmin
    ? await db.admin.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } })
    : undefined;

  return (
    <>
      <TopBar title="New patient" sub="Contact details, treatment plan and pricing in one step" />
      <div className="ds-scroll ds-admin-pad" style={{ flex: 1, overflow: "auto" }}>
        <ProposalForm
          isNew
          patient={{ ...NEW_PROPOSAL_PATIENT, ownerId: admin.id }}
          cfg={cfg}
          owners={owners}
        />
      </div>
    </>
  );
}
