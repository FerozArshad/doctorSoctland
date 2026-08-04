import FormSubmitButton from "@/components/FormSubmitButton";
import { reassignPatient } from "@/app/admin/actions";

type AdminOption = { id: string; name: string; email: string };

export default function ReassignPatientForm({
  patientId,
  currentOwnerId,
  currentSentByEmail,
  currentSentByName,
  admins,
}: {
  patientId: string;
  currentOwnerId: string | null;
  currentSentByEmail: string;
  currentSentByName: string;
  admins: AdminOption[];
}) {
  const defaultId =
    currentOwnerId ||
    admins.find((a) => a.email.toLowerCase() === (currentSentByEmail || "").toLowerCase())?.id ||
    admins[0]?.id ||
    "";
  return (
    <form action={reassignPatient} className="card ds-patient-card">
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Assign coordinator</div>
      <p style={{ fontSize: 12.5, color: "#7A8696", marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
        Reassign this patient to a Treatment Coordinator. Updates who sees them in the dashboard and who receives activity alerts.
        {currentSentByName ? ` Currently: ${currentSentByName}.` : ""}
      </p>
      <label className="label">Assigned to</label>
      <select className="input" name="assignToId" defaultValue={defaultId} required>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.email})
          </option>
        ))}
      </select>
      <input type="hidden" name="patientId" value={patientId} />
      <FormSubmitButton
        className="btn btn-teal"
        style={{ marginTop: 14, width: "100%", padding: 12, fontSize: 13.5 }}
        label="Save assignment"
        pendingLabel="Saving…"
      />
    </form>
  );
}
