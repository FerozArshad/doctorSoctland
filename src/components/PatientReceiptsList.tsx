import Link from "next/link";
import { fmt } from "@/lib/pricing";

export type PatientReceiptRow = {
  id: string;
  receiptNumber: string;
  amountPence: number;
  createdAt: Date;
  payment: { paidAt: Date | null; type: string };
};

export default function PatientReceiptsList({ receipts }: { receipts: PatientReceiptRow[] }) {
  if (receipts.length === 0) return null;

  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 8px", color: "#0E1A2B" }}>Your receipts</h2>
      <p style={{ fontSize: 12.5, color: "#6B7785", margin: "0 0 10px", lineHeight: 1.45 }}>
        Payment receipts for your Invisalign treatment. A copy was also emailed to you.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {receipts.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #E1E7EE",
              background: "#fff",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#16202E" }}>{r.receiptNumber}</div>
              <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 2 }}>
                {fmt(r.amountPence)} · {(r.payment.paidAt || r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flex: "none" }}>
              <Link
                href={`/api/receipts/${r.id}`}
                target="_blank"
                style={{ fontSize: 12.5, fontWeight: 700, color: "#0E9384", textDecoration: "none" }}
              >
                View
              </Link>
              <Link
                href={`/api/receipts/${r.id}?download=1`}
                style={{ fontSize: 12.5, fontWeight: 700, color: "#1EA8D8", textDecoration: "none" }}
              >
                Download
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
