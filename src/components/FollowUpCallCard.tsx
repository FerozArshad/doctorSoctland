"use client";

import { logFollowUpCall } from "@/app/p/actions";

/** Patient-facing follow-up consult booking — coordinator-specific LeadConnector link. */
export default function FollowUpCallCard({
  token,
  coordinatorName,
  bookingUrl,
  compact = false,
}: {
  token: string;
  coordinatorName: string;
  bookingUrl: string;
  compact?: boolean;
}) {
  const first = coordinatorName.split(" ")[0] || "your coordinator";

  return (
    <section
      id="book-call"
      style={{
        marginTop: compact ? 0 : 14,
        padding: compact ? "12px 12px" : "14px 14px",
        borderRadius: 13,
        border: "1px solid #D7E3E9",
        background: "linear-gradient(180deg, #F8FCFD 0%, #F3F8F9 100%)",
      }}
    >
      <div style={{ fontSize: compact ? 13.5 : 14, fontWeight: 800, color: "#0E1A2B", lineHeight: 1.35 }}>
        Prefer to talk it through first?
      </div>
      <p style={{ fontSize: compact ? 11.5 : 12.5, color: "#5C6a79", margin: "5px 0 10px", lineHeight: 1.45 }}>
        Book a free virtual follow-up with {first} — no obligation, about 10 minutes.
      </p>
      <a
        href={bookingUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          void logFollowUpCall(token);
        }}
        className="btn btn-outline"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: compact ? "9px 14px" : "10px 16px",
          fontSize: compact ? 12.5 : 13.5,
          fontWeight: 800,
          textDecoration: "none",
          borderColor: "#0E9384",
          color: "#0B7A6E",
          background: "#fff",
        }}
      >
        Book a follow-up call with {first} →
      </a>
    </section>
  );
}
