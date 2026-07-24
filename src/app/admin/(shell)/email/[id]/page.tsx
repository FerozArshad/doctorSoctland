import Link from "next/link";
import { redirect } from "next/navigation";
import FormSubmitButton from "@/components/FormSubmitButton";
import TopBar from "@/components/TopBar";
import { retryEmailLog } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { getEmailLogDetail } from "@/lib/email-log";

export const dynamic = "force-dynamic";

function fmtDt(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default async function EmailLogDetailPage({ params }: { params: { id: string } }) {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");

  const row = await getEmailLogDetail(params.id);
  if (!row) redirect("/admin/email");

  const canRetry = ["failed", "deferred", "bounced"].includes(row.status) && row.retryCount < row.maxRetries && !!row.htmlBody;

  return (
    <>
      <TopBar
        title="Email log detail"
        sub={row.subject}
        actions={
          <Link href="/admin/email" className="btn btn-outline" style={{ padding: "9px 16px", textDecoration: "none", fontSize: 13.5 }}>
            ← Back to logs
          </Link>
        }
      />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, fontSize: 14 }}>
              <div><div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase" }}>Status</div><div style={{ fontWeight: 800, marginTop: 4 }}>{row.status}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase" }}>To</div><div style={{ marginTop: 4 }}>{row.to}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase" }}>From</div><div style={{ marginTop: 4 }}>{row.fromAddress || "—"}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase" }}>Provider</div><div style={{ marginTop: 4 }}>{row.provider || "—"}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase" }}>Category</div><div style={{ marginTop: 4 }}>{row.category}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase" }}>Created</div><div style={{ marginTop: 4 }}>{fmtDt(row.createdAt)}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase" }}>Sent</div><div style={{ marginTop: 4 }}>{fmtDt(row.sentAt)}</div></div>
              <div><div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase" }}>Retries</div><div style={{ marginTop: 4 }}>{row.retryCount} / {row.maxRetries}</div></div>
            </div>

            {row.providerMessageId && (
              <div style={{ marginTop: 18, fontSize: 13 }}>
                <strong>Provider message ID:</strong> <code style={{ fontSize: 12 }}>{row.providerMessageId}</code>
              </div>
            )}

            {row.errorMessage && (
              <div style={{ marginTop: 18, padding: 14, background: "#FEF2F2", borderRadius: 10, fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 800, color: "#B91C1C" }}>{row.errorType || "error"} {row.errorCode ? `(${row.errorCode})` : ""}</div>
                <div style={{ marginTop: 6, color: "#7A2E2E" }}>{row.errorMessage}</div>
              </div>
            )}

            {row.apiResponse && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase", marginBottom: 8 }}>API response</div>
                <pre style={{ background: "#0E1A2B", color: "#A8D4C8", padding: 14, borderRadius: 10, fontSize: 12, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {row.apiResponse}
                </pre>
              </div>
            )}

            {canRetry && (
              <form action={retryEmailLog} style={{ marginTop: 20 }}>
                <input type="hidden" name="logId" value={row.id} />
                <FormSubmitButton className="btn btn-teal" label="Retry this email" pendingLabel="Sending…" />
              </form>
            )}
          </div>

          {row.metadata && row.metadata !== "{}" && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8A96A5", textTransform: "uppercase", marginBottom: 8 }}>Metadata</div>
              <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{row.metadata}</pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
