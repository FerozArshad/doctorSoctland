"use client";

import { useState } from "react";

export type ProposalDoc = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export default function ProposalDocuments({
  token,
  docs,
}: {
  token: string;
  docs: ProposalDoc[];
}) {
  const [active, setActive] = useState<ProposalDoc | null>(null);
  if (docs.length === 0) return null;

  const urlFor = (id: string) => `/api/p/${encodeURIComponent(token)}/files/${encodeURIComponent(id)}`;

  return (
    <>
      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 6px", color: "#0E1A2B" }}>Documents from the practice</h2>
        <p style={{ fontSize: 12.5, color: "#6B7785", margin: "0 0 10px", lineHeight: 1.45 }}>
          Tap a file to open it. These were shared by Dental Scotland for you to review.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActive(d)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #E1E7EE",
                background: "#fff",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#16202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  📎 {d.fileName}
                </div>
                <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 2 }}>
                  {Math.max(1, Math.round(d.sizeBytes / 1024))} KB · {d.mimeType === "application/pdf" ? "PDF" : "Image"}
                </div>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0E9384", flex: "none" }}>View</span>
            </button>
          ))}
        </div>
      </section>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(11,24,40,.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActive(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 920,
              maxHeight: "92vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 30px 60px -20px rgba(11,24,40,.55)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: "1px solid #EEF2F6" }}>
              <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {active.fileName}
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                <a
                  href={urlFor(active.id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12.5, fontWeight: 700, color: "#0E9384", textDecoration: "none", padding: "6px 10px" }}
                >
                  Open tab
                </a>
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  aria-label="Close"
                  style={{ background: "transparent", border: "none", fontSize: 22, lineHeight: 1, color: "#7A8696", cursor: "pointer" }}
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 320, background: "#F4F6F9", display: "grid", placeItems: "center", overflow: "auto" }}>
              {active.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlFor(active.id)}
                  alt={active.fileName}
                  style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain" }}
                />
              ) : (
                <iframe
                  title={active.fileName}
                  src={urlFor(active.id)}
                  style={{ width: "100%", height: "78vh", border: "none", background: "#fff" }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
