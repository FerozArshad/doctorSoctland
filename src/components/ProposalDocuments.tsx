"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ProposalDoc = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

function DocumentPreview({ url, doc }: { url: string; doc: ProposalDoc }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = doc.mimeType.startsWith("image/");
  const isPdf = doc.mimeType === "application/pdf";

  useEffect(() => {
    setReady(false);
    setError(null);
  }, [url]);

  if (isImage) {
    return (
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, padding: 12 }}>
        {!ready && !error && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#7A8696", fontSize: 14 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span className="ds-spinner ds-spinner-dark" aria-hidden="true" />
              Loading image…
            </span>
          </div>
        )}
        {error ? (
          <p style={{ fontSize: 14, color: "#7A8696", textAlign: "center", margin: 0 }}>{error}</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={doc.fileName}
            decoding="async"
            onLoad={() => setReady(true)}
            onError={() => setError("Could not load image.")}
            style={{
              maxWidth: "100%",
              maxHeight: "min(72dvh, 640px)",
              objectFit: "contain",
              display: "block",
              opacity: ready ? 1 : 0,
              transition: "opacity .15s ease",
            }}
          />
        )}
      </div>
    );
  }

  if (isPdf) {
    return (
      <object
        data={`${url}#toolbar=1&navpanes=0`}
        type="application/pdf"
        aria-label={doc.fileName}
        style={{ width: "100%", height: "min(72dvh, 640px)", display: "block", background: "#fff" }}
      >
        <embed src={url} type="application/pdf" style={{ width: "100%", height: "min(72dvh, 640px)", display: "block" }} />
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#7A8696", margin: "0 0 12px" }}>PDF preview not supported in this browser.</p>
          <a href={url} target="_blank" rel="noreferrer" style={{ color: "#0E9384", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            Open PDF in new tab
          </a>
        </div>
      </object>
    );
  }

  return (
    <div style={{ padding: 32, textAlign: "center" }}>
      <p style={{ fontSize: 14, color: "#7A8696", margin: "0 0 16px" }}>Preview not available for this file type.</p>
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
        Download file
      </a>
    </div>
  );
}

function DocumentViewerModal({
  doc,
  url,
  onClose,
}: {
  doc: ProposalDoc;
  url: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={doc.fileName}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(11,24,40,.72)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))",
        overflowY: "auto",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 920,
          margin: "auto",
          maxHeight: "none",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 30px 60px -20px rgba(11,24,40,.55)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderBottom: "1px solid #EEF2F6",
            flex: "none",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {doc.fileName}
          </div>
          <div style={{ display: "flex", gap: 4, flex: "none" }}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12.5, fontWeight: 700, color: "#0E9384", textDecoration: "none", padding: "6px 10px" }}
            >
              Open tab
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ background: "transparent", border: "none", fontSize: 22, lineHeight: 1, color: "#7A8696", cursor: "pointer", padding: "4px 8px" }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ position: "relative", flex: 1, background: "#F4F6F9", overflow: "auto" }}>
          <DocumentPreview url={url} doc={doc} />
        </div>
      </div>
    </div>
  );
}

export default function ProposalDocuments({
  token,
  docs,
  compact = false,
  embedded = false,
}: {
  token: string;
  docs: ProposalDoc[];
  compact?: boolean;
  /** Inside consent modal — minimal chrome */
  embedded?: boolean;
}) {
  const [active, setActive] = useState<ProposalDoc | null>(null);
  const [mounted, setMounted] = useState(false);
  const prefetched = useRef(new Set<string>());

  const urlFor = useCallback((id: string) => `/api/p/${encodeURIComponent(token)}/files/${encodeURIComponent(id)}`, [token]);

  const prefetch = useCallback(
    (doc: ProposalDoc) => {
      const url = urlFor(doc.id);
      if (prefetched.current.has(url)) return;
      prefetched.current.add(url);
      if (doc.mimeType.startsWith("image/")) {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        return;
      }
      if (doc.mimeType === "application/pdf") {
        void fetch(url, { credentials: "include", cache: "force-cache" }).catch(() => {
          prefetched.current.delete(url);
        });
      }
    },
    [urlFor]
  );

  useEffect(() => setMounted(true), []);

  if (docs.length === 0) return null;

  return (
    <>
      <section style={{ marginTop: embedded ? 12 : compact ? 14 : 18 }}>
        {!embedded && (
          <>
            <h2 style={{ fontSize: compact ? 13.5 : 15, fontWeight: 800, margin: "0 0 6px", color: "#0E1A2B" }}>
              {compact ? "Attached documents" : "Documents from the practice"}
            </h2>
            <p style={{ fontSize: compact ? 11.5 : 12.5, color: "#6B7785", margin: "0 0 10px", lineHeight: 1.45 }}>
              {compact
                ? "Review these before signing — view only."
                : "Tap a file to open it. These were shared by Dental Scotland for you to review."}
            </p>
          </>
        )}
        {embedded && (
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#16202E", marginBottom: 8 }}>
            Attached documents ({docs.length})
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: embedded ? 6 : 8 }}>
          {docs.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                prefetch(d);
                setActive(d);
              }}
              onMouseEnter={() => prefetch(d)}
              onFocus={() => prefetch(d)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: embedded ? "10px 12px" : "12px 14px",
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

      {active && mounted
        ? createPortal(
            <DocumentViewerModal doc={active} url={urlFor(active.id)} onClose={() => setActive(null)} />,
            document.body
          )
        : null}
    </>
  );
}
