"use client";

import FormSubmitButton from "@/components/FormSubmitButton";
import { deletePatient } from "@/app/admin/actions";

export default function DeletePatientButton({
  patientId,
  patientName,
  label = "Remove patient",
  confirmMessage,
}: {
  patientId: string;
  patientName: string;
  label?: string;
  confirmMessage?: string;
}) {
  return (
    <form
      action={deletePatient}
      onSubmit={(e) => {
        if (!confirm(confirmMessage || `Permanently remove ${patientName}? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="patientId" value={patientId} />
      <FormSubmitButton
        className="btn btn-outline"
        style={{ padding: "11px 16px", fontSize: 13.5, color: "#C23B34", borderColor: "#F0C4C0" }}
        label={label}
        pendingLabel="Removing…"
      />
    </form>
  );
}
