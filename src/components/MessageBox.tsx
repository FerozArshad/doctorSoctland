"use client";
// Admin → patient message composer (email / WhatsApp / both).
import { useState } from "react";
import { sendMessage } from "@/app/admin/actions";

export default function MessageBox({ patientId, hasPhone }: { patientId: string; hasPhone: boolean }) {
  const [channel, setChannel] = useState<"email" | "whatsapp" | "both">(hasPhone ? "both" : "email");
  const [body, setBody] = useState("");

  const chip = (k: "email" | "whatsapp" | "both", label: string, disabled = false) => (
    <button
      type="button"
      key={k}
      disabled={disabled}
      onClick={() => setChannel(k)}
      style={{
        padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", border: "1px solid transparent",
        background: channel === k ? "#0E1A2B" : "#F4F6F9",
        color: disabled ? "#B4BECB" : channel === k ? "#fff" : "#5C6a79",
      }}
    >
      {label}
    </button>
  );

  return (
    <form action={sendMessage} className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Message patient</div>
        <div style={{ display: "flex", gap: 7 }}>
          {chip("email", "✉ Email")}
          {chip("whatsapp", "💬 WhatsApp", !hasPhone)}
          {chip("both", "Both", !hasPhone)}
        </div>
      </div>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="channel" value={channel} />
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="e.g. Hi! Just checking you received your proposal — happy to answer any questions about the payment options…"
        className="input"
        style={{ marginTop: 0, resize: "vertical" }}
      />
      <button className="btn btn-dark" disabled={!body.trim()} style={{ marginTop: 12, padding: "11px 22px", fontSize: 13.5 }}>
        Send {channel === "both" ? "email + WhatsApp" : channel === "email" ? "email" : "WhatsApp"} →
      </button>
    </form>
  );
}
