import TopBar from "@/components/TopBar";
import NewPatientForm from "@/components/NewPatientForm";

export const dynamic = "force-dynamic";

export default function NewPatientPage() {
  return (
    <>
      <TopBar title="New patient" sub="Add contact details — proposal is built on the next step" />
      <div className="ds-scroll ds-admin-pad" style={{ flex: 1, overflow: "auto" }}>
        <NewPatientForm />
      </div>
    </>
  );
}
