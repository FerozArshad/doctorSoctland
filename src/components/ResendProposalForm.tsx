"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SentByPicker from "@/components/SentByPicker";
import FormSubmitButton from "@/components/FormSubmitButton";
import { sendProposal } from "@/app/admin/actions";

export default function ResendProposalForm({
  patientId,
  isDraft,
  defaultSentByKey,
}: {
  patientId: string;
  isDraft: boolean;
  defaultSentByKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const label = isDraft ? "Send proposal" : "Resend proposal";

  useEffect(() => setMounted(true), []);

  const modal = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resend-proposal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(11,24,40,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 30px 60px -20px rgba(11,24,40,.5)",
          padding: 24,
        }}
      >
        <div id="resend-proposal-title" style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
          {label}
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#7A8696", lineHeight: 1.55 }}>
          Choose who the proposal is sent from. This sets the email signature and who can see the patient.
        </p>
        <form
          action={sendProposal}
          onSubmit={(e) => {
            const fd = new FormData(e.currentTarget);
            if (!String(fd.get("sentByKey") || "").trim()) {
              e.preventDefault();
              alert("Choose who the proposal is sent from.");
            }
          }}
        >
          <input type="hidden" name="patientId" value={patientId} />
          <SentByPicker defaultKey={defaultSentByKey} />
          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button type="button" className="btn btn-outline" onClick={() => setOpen(false)} style={{ flex: 1, padding: 12 }}>
              Cancel
            </button>
            <FormSubmitButton
              className="btn btn-teal"
              style={{ flex: 1.4, padding: 12 }}
              label={label}
              pendingLabel="Sending…"
            />
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setOpen(true)}
        style={{ padding: "11px 16px", fontSize: 13.5, whiteSpace: "nowrap" }}
      >
        {label}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
