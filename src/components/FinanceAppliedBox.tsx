import { patientTemplateText, patientTemplateTitle } from "@/lib/patient-templates";

/** Inline confirmation after finance application — replaces payment options (no popup). */
export default function FinanceAppliedBox({ firstName }: { firstName: string }) {
  const title = patientTemplateTitle("finance_received");
  const body = patientTemplateText("finance_received", firstName);

  return (
    <div
      style={{
        border: "2px solid #0E9384",
        borderRadius: 14,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 8px 24px -12px rgba(14,147,132,.35)",
      }}
    >
      <div style={{ background: "#0E1A2B", padding: "18px 16px", textAlign: "center" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#0E9384",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 20,
            fontWeight: 800,
            margin: "0 auto 10px",
          }}
        >
          ✓
        </div>
        <div style={{ color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "-.01em" }}>{title}</div>
      </div>
      <div style={{ padding: "16px 16px 18px", background: "linear-gradient(180deg, #F4FCFA 0%, #fff 100%)" }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#3C4a59", whiteSpace: "pre-wrap" }}>{body}</p>
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "#7A8696", lineHeight: 1.5 }}>
          Our team has been notified and will email your secure finance link shortly. You can close this page — we&apos;ll be in touch.
        </p>
      </div>
    </div>
  );
}
