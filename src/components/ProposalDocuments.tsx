"use client";

import { useEffect, useState } from "react";

export type ProposalDoc = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

function DocumentPreview({ url, doc }: { url: string; doc: ProposalDoc }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isImage = doc.mimeType.startsWith("image/");
  const isPdf = doc.mimeType === "application/pdf";

  useEffect(() => {
    if (isImage) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    fetch(url, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Please sign in again to view this file." : `Could not load file (${res.status})`);
        const blob = await res.blob();
        if (!blob.size) throw new Error("File is empty.");
        return blob;
      })
      .then((blob) => {
        if (cancelled) return;
        const typed = isPdf ? new Blob([blob], { type: "application/pdf" }) : blob;
        objectUrl = URL.createObjectURL(typed);
        setBlobUrl(objectUrl);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load preview");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, isImage, isPdf]);

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={doc.fileName}
        style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain", display: "block", margin: "0 auto" }}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#7A8696", fontSize: 14 }}>
        Loading document…
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div style={{ padding: 32, textAlign: "center", maxWidth: 360 }}>
        <p style={{ fontSize: 14, color: "#7A8696", lineHeight: 1.6, margin: "0 0 16px" }}>
          {error || "Preview unavailable in this browser."}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            background: "#0E9384",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Open PDF in new tab
        </a>
      </div>
    );
  }

  return (
    <object
      data={`${blobUrl}#toolbar=1&navpanes=0`}
      type="application/pdf"
      aria-label={doc.fileName}
      style={{ width: "100%", height: "78vh", display: "block", background: "#fff" }}
    >
      <embed
        src={blobUrl}
        type="application/pdf"
        style={{ width: "100%", height: "78vh", display: "block" }}
      />
      <p style={{ padding: 24, textAlign: "center", fontSize: 14, color: "#7A8696" }}>
        PDF preview not supported.{" "}
        <a href={url} target="_blank" rel="noreferrer" style={{ color: "#0E9384", fontWeight: 700 }}>
          Open in new tab
        </a>
      </p>
    </object>
  );
}

export default function ProposalDocuments({
  token,
  docs,
  compact = false,
}: {
  token: string;
  docs: ProposalDoc[];
  compact?: boolean;
}) {
  const [active, setActive] = useState<ProposalDoc | null>(null);
  if (docs.length === 0) return null;

  const urlFor = (id: string) => `/api/p/${encodeURIComponent(token)}/files/${encodeURIComponent(id)}`;

  return (
    <>
      <section style={{ marginTop: compact ? 14 : 18 }}>
        <h2 style={{ fontSize: compact ? 13.5 : 15, fontWeight: 800, margin: "0 0 6px", color: "#0E1A2B" }}>
          {compact ? "Attached documents" : "Documents from the practice"}
        </h2>
        <p style={{ fontSize: compact ? 11.5 : 12.5, color: "#6B7785", margin: "0 0 10px", lineHeight: 1.45 }}>
          {compact
            ? "Review these before signing — view only."
            : "Tap a file to open it. These were shared by Dental Scotland for you to review."}
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
            <div style={{ flex: 1, minHeight: 320, background: "#F4F6F9", overflow: "auto" }}>
              <DocumentPreview key={active.id} url={urlFor(active.id)} doc={active} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
