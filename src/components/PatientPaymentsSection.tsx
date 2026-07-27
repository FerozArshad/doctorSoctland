import { fmt } from "@/lib/pricing";
import { reportPaymentType, type ReportPaymentType } from "@/lib/report-metrics";

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
  finance: "Finance (external)",
  booking_credit: "Booking credit",
};

const PAYMENT_TYPE_STYLE: Record<ReportPaymentType, { fg: string; bg: string }> = {
  Deposit: { fg: "#B7791F", bg: "#FBF3E2" },
  "Paid in Full": { fg: "#1C7C3A", bg: "#E6F6EA" },
  Finance: { fg: "#7A3EC0", bg: "#F3EBFC" },
};

export default function PatientPaymentsSection({
  payments,
  patient,
  bookingCreditPence = 0,
}: {
  payments: PaymentRow[];
  patient?: {
    status: string;
    paymentPreference: string | null;
    financeStatus: string;
    payments?: Array<{ type: string; status: string; paidAt: Date | null }>;
  };
  bookingCreditPence?: number;
}) {
  const paymentType = patient
    ? reportPaymentType({
        id: "",
        firstName: "",
        lastName: "",
        email: "",
        pricePence: 0,
        upfrontPaidPence: bookingCreditPence,
        status: patient.status,
        paymentPreference: patient.paymentPreference,
        financeStatus: patient.financeStatus,
        financeApprovedAt: null,
        consentSignedAt: null,
        sentByEmail: "",
        payments: patient.payments || payments.map((p) => ({ type: p.type, status: p.status, paidAt: p.paidAt })),
      })
    : null;

  const ptStyle = paymentType ? PAYMENT_TYPE_STYLE[paymentType] : null;
  const showFinanceRow =
    paymentType === "Finance" &&
    !payments.some((p) => p.type === "finance" && p.status === "paid");

  const showCreditRow =
    bookingCreditPence > 0 && !payments.some((p) => p.type === "booking_credit");

  const rows = [...payments];
  if (showCreditRow) {
    rows.unshift({
      id: "booking-credit",
      amountPence: bookingCreditPence,
      type: "booking_credit",
      status: "paid",
      paidAt: null,
      createdAt: new Date(),
      stripeSessionId: null,
      stripePaymentIntentId: null,
    });
  }
  if (showFinanceRow) {
    rows.push({
      id: "finance-external",
      amountPence: 0,
      type: "finance",
      status: "paid",
      paidAt: null,
      createdAt: new Date(),
      stripeSessionId: null,
      stripePaymentIntentId: null,
    });
  }

  return (
    <div style={{ marginTop: 16, border: "1px solid #EEF2F6", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", background: "#FAFBFC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8A96A5" }}>
          Payment history
        </div>
        {paymentType && ptStyle && (
          <span className="badge" style={{ color: ptStyle.fg, background: ptStyle.bg, padding: "3px 9px", fontSize: 11.5 }}>
            {paymentType}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "14px", fontSize: 13, color: "#7A8696", lineHeight: 1.5 }}>
          No payments recorded yet. A pending row appears when the patient opens Stripe Checkout; it turns green after Stripe confirms payment.
        </div>
      ) : (
        rows.map((p) => {
          const when = p.paidAt || p.createdAt;
          const ref = p.stripePaymentIntentId || p.stripeSessionId;
          const isFinancePlaceholder = p.id === "finance-external";
          const isCredit = p.type === "booking_credit";
          const status = isFinancePlaceholder
            ? { label: "Finance", fg: "#7A3EC0", bg: "#F3EBFC" }
            : p.status === "paid"
              ? { label: "Paid", fg: "#1C7C3A", bg: "#E6F6EA" }
              : p.status === "failed"
                ? { label: "Failed", fg: "#C23B34", bg: "#FBE9E8" }
                : { label: "Pending", fg: "#B7791F", bg: "#FBF3E2" };
          return (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: "1px solid #F1F4F8", fontSize: 13.5, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800, color: "#16202E" }}>
                  {isFinancePlaceholder ? "Via finance provider" : isCredit ? fmt(p.amountPence) : fmt(p.amountPence)}
                </div>
                <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>
                  {TYPE_LABELS[p.type] || p.type}
                  {!isFinancePlaceholder && !isCredit
                    ? ` · ${when.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                    : isCredit
                      ? " · credited against treatment total"
                      : " · net value appears in monthly reports when entered"}
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
