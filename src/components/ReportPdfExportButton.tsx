"use client";

import { useState } from "react";

export type FinancePatientForExport = {
  id: string;
  name: string;
  email: string;
};

function poundsToPence(raw: string): number | null {
  const n = parseFloat(raw.replace(/[£,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export default function ReportPdfExportButton({
  monthKey,
  staffKey,
  financePatients,
}: {
  monthKey: string;
  staffKey: string;
  financePatients: FinancePatientForExport[];
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const base = `/api/admin/reports/export?format=pdf&m=${encodeURIComponent(monthKey)}&s=${encodeURIComponent(staffKey)}`;

  const openPdf = (financeNet?: Record<string, number>) => {
    const url = financeNet && Object.keys(financeNet).length
      ? `${base}&financeNet=${encodeURIComponent(JSON.stringify(financeNet))}`
      : base;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
    setError("");
  };

  const onClick = () => {
    if (financePatients.length === 0) {
      openPdf();
      return;
    }
    setValues(Object.fromEntries(financePatients.map((p) => [p.id, values[p.id] ?? ""])));
    setOpen(true);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const map: Record<string, number> = {};
    for (const p of financePatients) {
      const pence = poundsToPence(values[p.id] || "");
      if (!pence) {
        setError(`Enter the net value from finance for ${p.name}.`);
        return;
      }
      map[p.id] = pence;
    }
    openPdf(map);
  };

  return (
    <>
      <button type="button" className="btn btn-teal" onClick={onClick} style={{ padding: "7px 12px", fontSize: 12.5 }}>
        PDF for management
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-net-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
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
          <form
            onSubmit={onSubmit}
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              maxHeight: "90dvh",
              overflow: "auto",
              boxShadow: "0 30px 60px -20px rgba(11,24,40,.5)",
              padding: 24,
            }}
          >
            <div id="finance-net-title" style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
              Finance net values required
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "#7A8696", lineHeight: 1.55 }}>
              This report includes patients on finance. Enter the <strong>net value from the finance provider</strong> for each case before exporting the PDF.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {financePatients.map((p) => (
                <div key={p.id}>
                  <label className="label" htmlFor={`fn-${p.id}`}>
                    {p.name}
                  </label>
                  <div style={{ fontSize: 12, color: "#9AA6B4", marginBottom: 4 }}>{p.email}</div>
                  <input
                    id={`fn-${p.id}`}
                    className="input"
                    inputMode="decimal"
                    placeholder="e.g. 1900"
                    value={values[p.id] ?? ""}
                    onChange={(e) => setValues((s) => ({ ...s, [p.id]: e.target.value }))}
                    style={{ marginTop: 0 }}
                    required
                  />
                </div>
              ))}
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#FBE9E8", color: "#C23B34", fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)} style={{ flex: 1, padding: 12 }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-teal" style={{ flex: 1.4, padding: 12 }}>
                Export PDF
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
