import TopBar from "@/components/TopBar";
import NewPatientForm from "@/components/NewPatientForm";

export const dynamic = "force-dynamic";

export default function NewPatientPage() {
  return (
    <>
      <TopBar title="New patient" sub="Create a proposal from the assessment" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <NewPatientForm />
      </div>
    </>
  );
}
