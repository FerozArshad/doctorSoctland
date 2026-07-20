import TopBar from "@/components/TopBar";
import NewPatientForm from "@/components/NewPatientForm";
import { getPricing } from "@/lib/pricing-settings";

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  const cfg = await getPricing();
  return (
    <>
      <TopBar title="New patient" sub="Create a proposal from the assessment" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <NewPatientForm cfg={cfg} />
      </div>
    </>
  );
}
