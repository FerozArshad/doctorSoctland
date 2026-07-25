import Link from "next/link";
import { fmt } from "@/lib/pricing";
import FormSubmitButton from "@/components/FormSubmitButton";
import { resendReceipt } from "@/app/admin/actions";

export type ReceiptRow = {
  id: string;
  receiptNumber: string;
  amountPence: number;
  paymentMethod: string;
  transactionId: string;
  serviceDescription: string;
  outstandingBalancePence: number;
  emailSentAt: Date | null;
  createdAt: Date;
  payment: { type: string; paidAt: Date | null };
};

export default function PaymentReceiptsSection({ patientId, receipts }: { patientId: string; receipts: ReceiptRow[] }) {
  if (receipts.length === 0) return null;

  return (
    <div style={{ marginTop: 16, border: "1px solid #EEF2F6", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", background: "#FAFBFC", fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8A96A5" }}>
        Payment receipts
      </div>
      {receipts.map((r) => (
        <div key={r.id} style={{ padding: "12px 14px", borderTop: "1px solid #F1F4F8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#16202E" }}>{r.receiptNumber}</div>
              <div style={{ fontSize: 13, color: "#5C6a79", marginTop: 4, lineHeight: 1.45 }}>
                {fmt(r.amountPence)} · {r.payment.type} · {(r.payment.paidAt || r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
              <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 4 }}>
                {r.paymentMethod}
                {r.emailSentAt ? ` · Emailed ${r.emailSentAt.toLocaleDateString("en-GB")}` : " · Email not sent"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a
                href={`/api/receipts/${r.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12.5, fontWeight: 700, color: "#0E9384", textDecoration: "none", padding: "6px 10px", border: "1px solid #CFEDE5", borderRadius: 8, background: "#F4FCFA" }}
              >
                View
              </a>
              <a
                href={`/api/receipts/${r.id}?download=1`}
                style={{ fontSize: 12.5, fontWeight: 700, color: "#1EA8D8", textDecoration: "none", padding: "6px 10px", border: "1px solid #D7EEF9", borderRadius: 8, background: "#F3FBFE" }}
              >
                Download
              </a>
              <form action={resendReceipt}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="receiptId" value={r.id} />
                <FormSubmitButton
                  label="Resend"
                  pendingLabel="Sending…"
                  style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 8, background: "#fff", border: "1px solid #E1E7EE", color: "#5C6a79" }}
                />
              </form>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
