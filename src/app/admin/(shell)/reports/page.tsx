// Monthly per-admin performance reports.
// Invisalign orders & income are computed live from that admin's patients
// (owned or sent by them); consult and bonding/veneer figures are entered
// manually in the report template below. Each saved report is a held record
// with filed/adjusted timestamps, and the next due date is always shown.
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmt, netPricePence } from "@/lib/pricing";
import { firstNameOf } from "@/lib/status";
import { saveMonthlyReport } from "@/app/admin/actions";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

export default async function ReportsPage({ searchParams }: { searchParams: { m?: string; a?: string } }) {
  const me = await requireAdmin();

  // Which admin's report — Super Admins can view anyone's.
  let target = me;
  if (searchParams.a && searchParams.a !== me.id) {
    if (!me.isSuperAdmin) redirect("/admin/reports");
    target = (await db.admin.findUnique({ where: { id: searchParams.a } })) ?? me;
  }
  const admins = me.isSuperAdmin ? await db.admin.findMany({ orderBy: { createdAt: "asc" } }) : [me];

  // Which month — default: the current one.
  const now = new Date();
  const mMatch = /^(\d{4})-(\d{2})$/.exec(searchParams.m || "");
  const year = mMatch ? parseInt(mMatch[1], 10) : now.getFullYear();
  const month = mMatch ? Math.min(12, Math.max(1, parseInt(mMatch[2], 10))) : now.getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const monthName = start.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const qs = (d: Date) => `?m=${d.getFullYear()}-${pad(d.getMonth() + 1)}&a=${target.id}`;

  // ── Computed Invisalign figures for this admin & month ──
  const attribution = { OR: [{ ownerId: target.id }, { sentByEmail: target.email }] };
  const [attributedPatients, paidPayments] = await Promise.all([
    db.patient.findMany({ where: attribution, select: { id: true, pricePence: true, upfrontPaidPence: true } }),
    db.payment.findMany({
      where: { status: "paid", patient: attribution },
      select: { patientId: true, amountPence: true, paidAt: true },
    }),
  ]);
  const inMonth = (d: Date | null) => !!d && d >= start && d < end;
  const incomePence = paidPayments.filter((p) => inMonth(p.paidAt)).reduce((a, p) => a + p.amountPence, 0);
  // An "order" = a patient whose first successful payment landed in this month.
  const firstPay = new Map<string, Date>();
  for (const p of paidPayments) {
    if (!p.paidAt) continue;
    const cur = firstPay.get(p.patientId);
    if (!cur || p.paidAt < cur) firstPay.set(p.patientId, p.paidAt);
  }
  const orderIds = Array.from(firstPay.entries()).filter(([, d]) => inMonth(d)).map(([id]) => id);
  const orderValueSum = attributedPatients
    .filter((p) => orderIds.includes(p.id))
    .reduce((a, p) => a + netPricePence(p.pricePence, p.upfrontPaidPence), 0);
  const avgAligner = orderIds.length ? Math.round(orderValueSum / orderIds.length) : 0;

  // ── Saved report + history log ──
  const report = await db.monthlyReport.findUnique({
    where: { adminId_year_month: { adminId: target.id, year, month } },
  });
  const history = await db.monthlyReport.findMany({
    where: { adminId: target.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 12,
  });
  const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const stamp = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const avgOf = (incomePence: number, n: number) => (n > 0 ? fmt(Math.round(incomePence / n)) : "—");
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) + "%" : "—");

  const stat = (label: string, value: string, sub: string) => (
    <div key={label} className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#3C4a59", marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#8A96A5", marginTop: 2 }}>{sub}</div>
    </div>
  );

  const numField = (label: string, name: string, value: number, step = "1") => (
    <div>
      <label className="label">{label}</label>
      <input className="input" name={name} type="number" min={0} step={step} defaultValue={step === "1" ? value : value / 100} />
    </div>
  );

  return (
    <>
      <TopBar title="Monthly reports" sub="Per-admin performance, filed monthly" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div className="ds-view">
          {/* controls: admin picker (super) + month nav + due banner */}
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {me.isSuperAdmin && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {admins.map((a) => (
                  <Link
                    key={a.id}
                    href={`?m=${year}-${pad(month)}&a=${a.id}`}
                    style={{
                      padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none",
                      border: "1px solid " + (a.id === target.id ? "#0E9384" : "#E1E7EE"),
                      background: a.id === target.id ? "#0E9384" : "#fff",
                      color: a.id === target.id ? "#fff" : "#5C6a79",
                    }}
                  >
                    {firstNameOf(a.name)}
                  </Link>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
              <Link href={qs(prev)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E1E7EE", textDecoration: "none", color: "#3C4a59", fontWeight: 700 }}>‹</Link>
              <span style={{ fontSize: 15, fontWeight: 800, minWidth: 130, textAlign: "center" }}>{monthName}</span>
              {isCurrentMonth
                ? <span style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #F1F4F8", color: "#C6CFDA", fontWeight: 700 }}>›</span>
                : <Link href={qs(next)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E1E7EE", textDecoration: "none", color: "#3C4a59", fontWeight: 700 }}>›</Link>}
            </div>
          </div>

          <div style={{ marginTop: 14, padding: "12px 18px", borderRadius: 12, background: "#F4FCFA", border: "1px solid #CFEDE5", fontSize: 13.5, color: "#0B7A6E", fontWeight: 600 }}>
            {report
              ? <>✓ {monthName} report filed {stamp(report.createdAt)}{report.updatedAt.getTime() - report.createdAt.getTime() > 60000 ? ` · last adjusted ${stamp(report.updatedAt)}` : ""} — next report due {nextDue.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</>
              : <>Next report due <strong>{nextDue.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong> — a reminder email goes out that morning. {monthName} hasn&apos;t been filed yet.</>}
          </div>

          {/* computed Invisalign stats */}
          <div className="ds-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 14 }}>
            {stat("Invisalign orders", String(orderIds.length), `patients who went ahead in ${monthName}`)}
            {stat("Invisalign income", fmt(incomePence), "payments collected this month")}
            {stat("Avg per aligner patient", avgAligner ? fmt(avgAligner) : "—", "average treatment value of new orders")}
            {stat("Consult conversion", report ? pct(report.consultsProceeded, report.consultsSeen) : "—", "from the figures entered below")}
          </div>

          <div className="ds-split" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginTop: 18, alignItems: "start" }}>
            {/* report template */}
            <form action={saveMonthlyReport} className="card" style={{ padding: 24 }}>
              <input type="hidden" name="adminId" value={target.id} />
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="month" value={month} />
              <div style={{ fontSize: 16, fontWeight: 800 }}>{firstNameOf(target.name)}&apos;s report — {monthName}</div>
              <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2, lineHeight: 1.6 }}>
                Enter the consult numbers for the month. Invisalign orders and income above are calculated automatically. Saving again adjusts the held record.
              </div>

              <div style={{ fontSize: 13, fontWeight: 800, margin: "20px 0 8px", color: "#0B7A6E", textTransform: "uppercase", letterSpacing: ".05em" }}>Invisalign</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {numField("Consults seen", "consultsSeen", report?.consultsSeen ?? 0)}
                {numField("…went ahead", "consultsProceeded", report?.consultsProceeded ?? 0)}
              </div>

              <div style={{ fontSize: 13, fontWeight: 800, margin: "20px 0 8px", color: "#0B7A6E", textTransform: "uppercase", letterSpacing: ".05em" }}>Composite bonding</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {numField("Consults seen", "bondingConsults", report?.bondingConsults ?? 0)}
                {numField("…went ahead", "bondingProceeded", report?.bondingProceeded ?? 0)}
                {numField("Income (£)", "bondingIncome", report?.bondingIncomePence ?? 0, "0.01")}
              </div>
              <div style={{ fontSize: 12.5, color: "#8A96A5", marginTop: 6 }}>
                Avg per bonding patient: <strong>{avgOf(report?.bondingIncomePence ?? 0, report?.bondingProceeded ?? 0)}</strong>
              </div>

              <div style={{ fontSize: 13, fontWeight: 800, margin: "20px 0 8px", color: "#0B7A6E", textTransform: "uppercase", letterSpacing: ".05em" }}>Veneers</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {numField("Consults seen", "veneerConsults", report?.veneerConsults ?? 0)}
                {numField("…went ahead", "veneerProceeded", report?.veneerProceeded ?? 0)}
                {numField("Income (£)", "veneerIncome", report?.veneerIncomePence ?? 0, "0.01")}
              </div>
              <div style={{ fontSize: 12.5, color: "#8A96A5", marginTop: 6 }}>
                Avg per veneer patient: <strong>{avgOf(report?.veneerIncomePence ?? 0, report?.veneerProceeded ?? 0)}</strong>
              </div>

              <div style={{ marginTop: 18 }}>
                <label className="label">Notes</label>
                <textarea className="input" name="notes" rows={2} defaultValue={report?.notes ?? ""} placeholder="Anything worth recording for this month…" style={{ resize: "vertical" }} />
              </div>

              <button className="btn btn-teal" style={{ marginTop: 18, width: "100%", padding: 13 }}>
                {report ? "Update report (adjust held record)" : "Save report — file & log"}
              </button>
              <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 10, textAlign: "center" }}>
                A confirmation email goes to {target.email} with the figures and the next due date.
              </div>
            </form>

            {/* held records log */}
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF2F6" }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Report log</div>
                <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>Held records for {firstNameOf(target.name)} — filed &amp; adjusted times</div>
              </div>
              {history.length === 0 && (
                <div style={{ padding: 30, textAlign: "center", color: "#9AA6B4", fontSize: 13.5 }}>No reports filed yet.</div>
              )}
              {history.map((r) => (
                <Link
                  key={r.id}
                  href={`?m=${r.year}-${pad(r.month)}&a=${target.id}`}
                  style={{ display: "block", padding: "13px 20px", borderBottom: "1px solid #F1F4F8", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#16202E" }}>
                      {new Date(r.year, r.month - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" })}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0B7A6E" }}>
                      {fmt(r.bondingIncomePence + r.veneerIncomePence)} bonding+veneers
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#5C6a79", marginTop: 3 }}>
                    Invisalign {r.consultsProceeded}/{r.consultsSeen} · bonding {r.bondingProceeded}/{r.bondingConsults} · veneers {r.veneerProceeded}/{r.veneerConsults}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 3 }}>
                    Filed {stamp(r.createdAt)}{r.updatedAt.getTime() - r.createdAt.getTime() > 60000 ? ` · adjusted ${stamp(r.updatedAt)}` : ""}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
