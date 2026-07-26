import { fmt } from "@/lib/pricing";

export type PaymentRow = {
  id: string;
  amountPence: number;
  type: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  full: "Pay in full",
  deposit: "Deposit",
  instalment: "Instalment",
  manual: "Manual (admin)",
};

export default function PatientPaymentsSection({ payments }: { payments: PaymentRow[] }) {
  return (
    <div style={{ marginTop: 16, border: "1px solid #EEF2F6", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", background: "#FAFBFC", fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8A96A5" }}>
        Payment history
      </div>
      {payments.length === 0 ? (
        <div style={{ padding: "14px", fontSize: 13, color: "#7A8696", lineHeight: 1.5 }}>
          No payments recorded yet. A pending row appears when the patient opens Stripe Checkout; it turns green after Stripe confirms payment.
        </div>
      ) : (
        payments.map((p) => {
          const when = p.paidAt || p.createdAt;
          const ref = p.stripePaymentIntentId || p.stripeSessionId;
          const status = p.status === "paid" ? { label: "Paid", fg: "#1C7C3A", bg: "#E6F6EA" } : p.status === "failed" ? { label: "Failed", fg: "#C23B34", bg: "#FBE9E8" } : { label: "Pending", fg: "#B7791F", bg: "#FBF3E2" };
          return (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: "1px solid #F1F4F8", fontSize: 13.5, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800, color: "#16202E" }}>{fmt(p.amountPence)}</div>
                <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>
                  {TYPE_LABELS[p.type] || p.type} · {when.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
                {ref ? (
                  <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 4, wordBreak: "break-all", fontFamily: "ui-monospace, monospace" }}>
                    {p.stripePaymentIntentId ? "Transaction" : "Checkout"}: {ref}
                  </div>
                ) : null}
              </div>
              <span className="badge" style={{ color: status.fg, background: status.bg }}>
                {status.label}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
