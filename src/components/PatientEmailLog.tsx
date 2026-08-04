import Link from "next/link";
import EmailHtmlPreview from "@/components/EmailHtmlPreview";
import { categoryLabel } from "@/lib/email-log";

type Row = {
  id: string;
  to: string;
  subject: string;
  status: string;
  category: string;
  htmlBody: string;
  sentAt: Date | null;
  createdAt: Date;
  errorMessage: string;
};

function fmtDt(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  sent: { bg: "#F0FBF8", color: "#0B7A6E" },
  delivered: { bg: "#F0FBF8", color: "#0B7A6E" },
  queued: { bg: "#F7FAFC", color: "#5A6A7E" },
  failed: { bg: "#FEF2F2", color: "#B91C1C" },
  bounced: { bg: "#FFF7ED", color: "#C2410C" },
  deferred: { bg: "#FFFBEB", color: "#B45309" },
};

export default function PatientEmailLog({ rows, isSuperAdmin }: { rows: Row[]; isSuperAdmin: boolean }) {
  return (
    <div className="card ds-patient-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Emails sent to patient</div>
          <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 4, lineHeight: 1.5 }}>
            Proposals, payments, receipts, finance, and reminders logged for this record.
          </div>
        </div>
        {isSuperAdmin && (
          <Link href="/admin/email?category=payment" className="btn btn-outline" style={{ padding: "8px 12px", fontSize: 12.5, textDecoration: "none", flex: "none" }}>
            All payment logs →
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "#7A8696", margin: 0 }}>No emails logged for this patient yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map((row) => {
            const sc = STATUS_COLORS[row.status] || STATUS_COLORS.queued;
            return (
              <div key={row.id} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #EEF2F6", background: "#FAFCFD" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#16202E" }}>{row.subject}</div>
                    <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 4 }}>
                      {fmtDt(row.sentAt || row.createdAt)} · {categoryLabel(row.category)} · {row.to}
                    </div>
                    {row.errorMessage && (
                      <div style={{ fontSize: 12, color: "#B45309", marginTop: 6 }}>{row.errorMessage}</div>
                    )}
                  </div>
                  <span style={{ background: sc.bg, color: sc.color, fontWeight: 800, fontSize: 11, padding: "3px 8px", borderRadius: 20, textTransform: "uppercase", flex: "none" }}>
                    {row.status}
                  </span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <EmailHtmlPreview html={row.htmlBody} />
                </div>
                {isSuperAdmin && (
                  <div style={{ marginTop: 10 }}>
                    <Link href={`/admin/email/${row.id}`} style={{ fontSize: 12.5, color: "#0E9384", fontWeight: 700 }}>
                      Full log details →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
