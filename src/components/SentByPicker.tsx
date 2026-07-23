"use client";
// "Sent by" picker — the chosen coordinator becomes the email's From and
// signature, so the patient gets a reply from a real person.
import { useState } from "react";
import { COORDINATORS } from "@/lib/coordinators";

export default function SentByPicker({ compact = false }: { compact?: boolean }) {
  const [key, setKey] = useState(COORDINATORS[0]?.key ?? "millie");
  const isOther = key === "other";

  const btn = (active: boolean): React.CSSProperties => ({
    padding: compact ? "8px 12px" : "11px 14px",
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
    background: active ? "#0E9384" : "#fff",
    color: active ? "#fff" : "#3C4a59",
    border: active ? "1.5px solid #0E9384" : "1.5px solid #E1E7EE",
  });

  return (
    <div>
      <label className="label">Sent by</label>
      <input type="hidden" name="sentByKey" value={key} />
      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        {COORDINATORS.map((c) => (
          <button key={c.key} type="button" onClick={() => setKey(c.key)} style={btn(key === c.key)}>
            {c.name}
          </button>
        ))}
        <button type="button" onClick={() => setKey("other")} style={btn(isOther)}>
          Other…
        </button>
      </div>

      {isOther ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <input className="input" name="sentByOtherName" placeholder="Full name" />
          <input className="input" name="sentByOtherEmail" type="email" placeholder="name@example.com" />
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 6, lineHeight: 1.5 }}>
          The proposal and all follow-ups come from {COORDINATORS.find((c) => c.key === key)?.email ?? "the practice"} and are signed by them.
        </div>
      )}
    </div>
  );
}
