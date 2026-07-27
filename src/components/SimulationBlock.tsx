"use client";

/** Patient-facing AI smile simulator link card. */
export default function SimulationBlock({ url }: { url: string }) {
  const href = (url || "").trim();
  const hasLink = /^https?:\/\/.+/i.test(href);

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "linear-gradient(145deg,#0E1A2B 0%,#1B4D6E 55%,#0E9384 100%)",
        padding: "20px 18px",
        boxShadow: "0 12px 32px -16px rgba(11,24,40,.45)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15, color: "#fff", lineHeight: 1.4 }}>
        See your future smile via our AI Simulator tool.
      </div>
      {hasLink ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 14,
            padding: "10px 16px",
            borderRadius: 10,
            background: "rgba(255,255,255,.95)",
            color: "#0B7A6E",
            fontWeight: 800,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Open AI Simulator →
        </a>
      ) : (
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)", margin: "10px 0 0", lineHeight: 1.45 }}>
          Your personalised simulation link will appear here once your coordinator adds it.
        </p>
      )}
    </div>
  );
}
