"use client";

import SentByPicker from "@/components/SentByPicker";
import FormSubmitButton from "@/components/FormSubmitButton";
import { sendProposal } from "@/app/admin/actions";

export default function ResendProposalForm({
  patientId,
  isDraft,
}: {
  patientId: string;
  isDraft: boolean;
}) {
  return (
    <form
      action={sendProposal}
      onSubmit={(e) => {
        const fd = new FormData(e.currentTarget);
        if (!String(fd.get("sentByKey") || "").trim()) {
          e.preventDefault();
          alert("Choose who the proposal is sent from.");
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 280 }}
    >
      <input type="hidden" name="patientId" value={patientId} />
      <SentByPicker compact />
      <FormSubmitButton
        className="btn btn-outline"
        style={{ padding: "11px 16px", fontSize: 13.5, width: "100%" }}
        label={isDraft ? "Send proposal" : "Resend proposal"}
        pendingLabel="Sending…"
      />
    </form>
  );
}
