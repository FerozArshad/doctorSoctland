import Link from "next/link";
import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import EmailLogsTable from "@/components/EmailLogsTable";
import { requireAdmin } from "@/lib/auth";
import { queryEmailLogs } from "@/lib/email-log";

export const dynamic = "force-dynamic";

export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");

  const sp = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v || "";
  };

  const page = Math.max(1, parseInt(sp("page") || "1", 10) || 1);
  const filters = {
    status: sp("status"),
    errorType: sp("errorType"),
    to: sp("to"),
    q: sp("q"),
    page: String(page),
  };

  const { rows, total, pageSize, counts } = await queryEmailLogs({
    status: filters.status || undefined,
    errorType: filters.errorType || undefined,
    to: filters.to || undefined,
    q: filters.q || undefined,
    page,
  });

  return (
    <>
      <TopBar
        title="Email logs"
        sub="Delivery audit trail — filter, search, and retry failed sends"
        actions={
          <Link href="/admin/email/settings" className="btn btn-outline" style={{ padding: "9px 16px", textDecoration: "none", fontSize: 13.5 }}>
            Alert settings
          </Link>
        }
      />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <EmailLogsTable rows={rows} total={total} page={page} pageSize={pageSize} counts={counts} filters={filters} />
      </div>
    </>
  );
}
