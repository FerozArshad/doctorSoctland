"use client";

import { useState } from "react";

export default function EmailHtmlPreview({ html, defaultOpen = false }: { html: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!html?.trim()) {
    return <p style={{ fontSize: 13, color: "#7A8696", margin: 0 }}>No email body stored for this log entry.</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-outline"
        style={{ padding: "8px 14px", fontSize: 13, marginBottom: open ? 12 : 0 }}
      >
        {open ? "Hide email content" : "View exact email sent"}
      </button>
      {open && (
        <div
          style={{
            border: "1px solid #E7ECF2",
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <iframe
            title="Email preview"
            srcDoc={html}
            sandbox=""
            style={{ width: "100%", minHeight: 480, border: "none", display: "block" }}
          />
        </div>
      )}
    </div>
  );
}
