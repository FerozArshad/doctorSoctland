import { switchToCardPayment } from "@/app/p/actions";
import FormSubmitButton from "@/components/FormSubmitButton";
import { patientTemplateText, patientTemplateTitle } from "@/lib/patient-templates";

/** Inline confirmation after finance application — replaces payment options (no popup). */
export default function FinanceAppliedBox({ firstName, token }: { firstName: string; token: string }) {
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

        <form action={switchToCardPayment} style={{ marginTop: 16 }}>
          <input type="hidden" name="token" value={token} />
          <div
            style={{
              marginTop: 4,
              padding: "14px 14px 13px",
              borderRadius: 12,
              border: "1.5px solid #D7E8E4",
              background: "#F8FCFB",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.55, color: "#3C4a59", fontWeight: 600 }}>
              Has your finance been declined or want to pay with a 5% additional discount?
            </p>
            <FormSubmitButton
              label="Click here to pay another way"
              pendingLabel="Loading payment options…"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 10,
                background: "#fff",
                border: "2px solid #0E9384",
                color: "#0B7A6E",
              }}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
