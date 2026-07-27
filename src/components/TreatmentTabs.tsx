"use client";

import { TREATMENT_TYPES, TREATMENT_TAG_STYLE, type TreatmentType } from "@/lib/treatments";

export default function TreatmentTabs({
  value,
  onChange,
  error,
}: {
  value: TreatmentType;
  onChange: (key: TreatmentType) => void;
  error?: boolean;
}) {
  return (
    <div>
      <label className="label">Select treatment *</label>
      {error && (
        <div style={{ fontSize: 12.5, color: "#C23B34", marginTop: 4 }}>Please select a treatment type.</div>
      )}
      <div
        className="ds-treatment-tabs"
        role="tablist"
        aria-label="Treatment type"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}
      >
        {TREATMENT_TYPES.map((t) => {
          const active = value === t.key;
          const tag = TREATMENT_TAG_STYLE[t.key];
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.key)}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                border: active ? `2px solid ${tag.fg}` : "1.5px solid #E1E7EE",
                background: active ? tag.bg : "#fff",
                color: active ? tag.fg : "#5C6a79",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
