import Link from "next/link";
import FormSubmitButton from "@/components/FormSubmitButton";
import { retryEmailLog } from "@/app/admin/actions";
import { EMAIL_ERROR_TYPES, EMAIL_STATUSES } from "@/lib/email-log";

type LogRow = {
  id: string;
  to: string;
  fromAddress: string;
  subject: string;
  status: string;
  provider: string;
  providerMessageId: string;
  category: string;
  errorCode: string;
  errorMessage: string;
  errorType: string;
  retryCount: number;
  maxRetries: number;
  parentLogId: string | null;
  patientId: string | null;
  sentAt: Date | null;
  createdAt: Date;
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  sent: { bg: "#F0FBF8", color: "#0B7A6E" },
  delivered: { bg: "#F0FBF8", color: "#0B7A6E" },
  queued: { bg: "#F7FAFC", color: "#5A6A7E" },
  failed: { bg: "#FEF2F2", color: "#B91C1C" },
  bounced: { bg: "#FFF7ED", color: "#C2410C" },
  deferred: { bg: "#FFFBEB", color: "#B45309" },
};

function fmtDt(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EmailLogsTable({
  rows,
  total,
  page,
  pageSize,
  counts,
  filters,
}: {
  rows: LogRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  filters: Record<string, string>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageUrl(nextPage: number) {
    const q = new URLSearchParams(filters);
    q.set("page", String(nextPage));
    return `/admin/email?${q.toString()}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <form method="get" className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div>
            <label className="label">Status</label>
            <select className="input" name="status" defaultValue={filters.status || "all"}>
              <option value="all">All statuses</option>
              {EMAIL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s} {counts[s] != null ? `(${counts[s]})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Error type</label>
            <select className="input" name="errorType" defaultValue={filters.errorType || "all"}>
              <option value="all">All types</option>
              {EMAIL_ERROR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Recipient</label>
            <input className="input" name="to" defaultValue={filters.to || ""} placeholder="email@example.com" />
          </div>
          <div>
            <label className="label">Search</label>
            <input className="input" name="q" defaultValue={filters.q || ""} placeholder="Subject or error…" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-teal" style={{ padding: "10px 18px" }}>
            Apply filters
          </button>
          <Link href="/admin/email" className="btn btn-outline" style={{ padding: "10px 18px", textDecoration: "none" }}>
            Clear
          </Link>
        </div>
      </form>

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "#F7FAFC", textAlign: "left" }}>
                {["Time", "Status", "To", "Subject", "Provider", "Error", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#8A96A5", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#7A8696" }}>
                    No email logs match your filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const sc = STATUS_COLORS[row.status] || STATUS_COLORS.queued;
                  const canRetry = ["failed", "deferred", "bounced"].includes(row.status) && row.retryCount < row.maxRetries;
                  return (
                    <tr key={row.id} style={{ borderTop: "1px solid #F1F4F8" }}>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap", color: "#5A6A7E", fontSize: 12.5 }}>{fmtDt(row.createdAt)}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: sc.bg, color: sc.color, fontWeight: 800, fontSize: 11, padding: "3px 8px", borderRadius: 20, textTransform: "uppercase" }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{row.to}</td>
                      <td style={{ padding: "12px 14px", maxWidth: 260 }}>
                        <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.subject}</div>
                        <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 2 }}>{row.category}</div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12.5, color: "#5A6A7E" }}>{row.provider || "—"}</td>
                      <td style={{ padding: "12px 14px", maxWidth: 220 }}>
                        {row.errorMessage ? (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#B45309" }}>{row.errorType || "error"}</div>
                            <div style={{ fontSize: 12, color: "#7A8696", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.errorMessage}>
                              {row.errorMessage}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <Link href={`/admin/email/${row.id}`} style={{ color: "#0E9384", fontWeight: 700, fontSize: 12.5, marginRight: 10 }}>
                          Details
                        </Link>
                        {canRetry && (
                          <form action={retryEmailLog} style={{ display: "inline" }}>
                            <input type="hidden" name="logId" value={row.id} />
                            <FormSubmitButton variant="link" label="Retry" pendingLabel="…" style={{ fontSize: 12.5 }} />
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderTop: "1px solid #F1F4F8", fontSize: 13, color: "#7A8696" }}>
          <span>
            {total} log{total === 1 ? "" : "s"} · page {page} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {page > 1 && (
              <Link href={pageUrl(page - 1)} className="btn btn-outline" style={{ padding: "6px 12px", fontSize: 12.5, textDecoration: "none" }}>
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageUrl(page + 1)} className="btn btn-outline" style={{ padding: "6px 12px", fontSize: 12.5, textDecoration: "none" }}>
                Next →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
