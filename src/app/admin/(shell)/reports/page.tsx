// Automated monthly Invisalign report — fully computed from live data, no
// manual edits. Segment by staff (sent-by coordinator) and flick months.
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmt, netPricePence } from "@/lib/pricing";
import { COORDINATORS, FALLBACK_COORDINATOR } from "@/lib/coordinators";
import { firstNameOf } from "@/lib/status";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

type StaffKey = "all" | string;

function staffOf(email: string): string {
  return COORDINATORS.find((c) => c.email === email)?.key ?? "other";
}

function staffLabel(key: StaffKey) {
  if (key === "all") return "All staff";
  if (key === "other") return "Other";
  return COORDINATORS.find((c) => c.key === key)?.name || key;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { m?: string; s?: string };
}) {
  const me = await requireAdmin();

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

  const staffKey = (searchParams.s || "all") as StaffKey;
  const knownKeys = new Set(COORDINATORS.map((c) => c.key));
  if (staffKey !== "all" && staffKey !== "other" && !knownKeys.has(staffKey)) {
    redirect(`/admin/reports?m=${year}-${pad(month)}`);
  }

  // Plain admins only see their own attributed patients; Super Admin can segment anyone.
  const baseWhere = me.isSuperAdmin
    ? {}
    : { OR: [{ ownerId: me.id }, { sentByEmail: me.email }] };

  const [patients, payments] = await Promise.all([
    db.patient.findMany({
      where: baseWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        pricePence: true,
        upfrontPaidPence: true,
        proposalSentAt: true,
        sentByEmail: true,
        sentByName: true,
        ownerId: true,
      },
    }),
    db.payment.findMany({
      where: { status: "paid", patient: baseWhere, paidAt: { gte: start, lt: end } },
      select: {
        patientId: true,
        amountPence: true,
        paidAt: true,
        type: true,
        patient: { select: { firstName: true, lastName: true, email: true, sentByEmail: true } },
      },
    }),
  ]);

  const inMonth = (d: Date | null | undefined) => !!d && d >= start && d < end;

  const matchStaff = (email: string) => {
    if (staffKey === "all") return true;
    return staffOf(email) === staffKey;
  };

  const scopedPatients = patients.filter((p) => matchStaff(p.sentByEmail || ""));
  const proposals = scopedPatients
    .filter((p) => inMonth(p.proposalSentAt))
    .sort((a, b) => (a.proposalSentAt!.getTime() - b.proposalSentAt!.getTime()));

  const firstPay = new Map<string, Date>();
  for (const p of payments) {
    if (!p.paidAt) continue;
    if (!matchStaff(p.patient.sentByEmail || "")) continue;
    const cur = firstPay.get(p.patientId);
    if (!cur || p.paidAt < cur) firstPay.set(p.patientId, p.paidAt);
  }
  const orderIds = Array.from(firstPay.entries())
    .filter(([, d]) => inMonth(d))
    .map(([id]) => id);
  const patientById = new Map(patients.map((p) => [p.id, p]));
  const orders = orderIds.map((id) => {
    const p = patientById.get(id)!;
    return {
      id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      email: p.email,
      amountPence: netPricePence(p.pricePence, p.upfrontPaidPence),
      staff: staffLabel(staffOf(p.sentByEmail || "")),
    };
  });

  const monthPayments = payments
    .filter((p) => inMonth(p.paidAt) && matchStaff(p.patient.sentByEmail || ""))
    .sort((a, b) => (a.paidAt && b.paidAt ? a.paidAt.getTime() - b.paidAt.getTime() : 0));

  const proposalCount = proposals.length;
  const orderCount = orders.length;
  const conversion = proposalCount > 0 ? Math.round((100 * orderCount) / proposalCount) : null;
  const orderValueSum = orders.reduce((a, o) => a + o.amountPence, 0);
  const avgRevenue = orderCount > 0 ? Math.round(orderValueSum / orderCount) : 0;
  const incomePence = monthPayments.reduce((a, p) => a + p.amountPence, 0);

  // Staff picker counts for this month (Super Admin only).
  const staffTabs: Array<{ key: StaffKey; label: string }> = [
    { key: "all", label: "All staff" },
    ...COORDINATORS.map((c) => ({ key: c.key, label: firstNameOf(c.name) })),
    { key: "other", label: "Other" },
  ];

  const qs = (d: Date, s: StaffKey = staffKey) =>
    `?m=${d.getFullYear()}-${pad(d.getMonth() + 1)}&s=${s}`;

  const stat = (label: string, value: string, sub: string) => (
    <div key={label} className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#3C4a59", marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#8A96A5", marginTop: 2 }}>{sub}</div>
    </div>
  );

  const exportHref = (format: string) =>
    `/api/admin/reports/export?format=${format}&m=${year}-${pad(month)}&s=${staffKey}`;

  return (
    <>
      <TopBar title="Monthly reports" sub="Automated Invisalign volume, conversion & value — locked, not editable" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div className="ds-view">
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {me.isSuperAdmin && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {staffTabs.map((t) => (
                  <Link
                    key={t.key}
                    href={qs(start, t.key)}
                    style={{
                      padding: "7px 13px",
                      borderRadius: 9,
                      fontSize: 13,
                      fontWeight: 700,
                      textDecoration: "none",
                      border: "1px solid " + (t.key === staffKey ? "#0E9384" : "#E1E7EE"),
                      background: t.key === staffKey ? "#0E9384" : "#fff",
                      color: t.key === staffKey ? "#fff" : "#5C6a79",
                    }}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            )}
            {!me.isSuperAdmin && (
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#3C4a59" }}>
                Your performance · {me.name}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
              <Link href={qs(prev)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E1E7EE", textDecoration: "none", color: "#3C4a59", fontWeight: 700 }}>‹</Link>
              <span style={{ fontSize: 15, fontWeight: 800, minWidth: 140, textAlign: "center" }}>{monthName}</span>
              {isCurrentMonth ? (
                <span style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #F1F4F8", color: "#C6CFDA", fontWeight: 700 }}>›</span>
              ) : (
                <Link href={qs(next)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E1E7EE", textDecoration: "none", color: "#3C4a59", fontWeight: 700 }}>›</Link>
              )}
              <a href={exportHref("csv")} className="btn btn-outline" style={{ padding: "7px 12px", fontSize: 12.5, textDecoration: "none" }}>Export CSV</a>
              <a href={exportHref("xlsx")} className="btn btn-outline" style={{ padding: "7px 12px", fontSize: 12.5, textDecoration: "none" }}>Excel</a>
              <a href={exportHref("pdf")} className="btn btn-teal" style={{ padding: "7px 12px", fontSize: 12.5, textDecoration: "none" }}>PDF for management</a>
            </div>
          </div>

          <div style={{ marginTop: 14, padding: "12px 18px", borderRadius: 12, background: "#F4FCFA", border: "1px solid #CFEDE5", fontSize: 13.5, color: "#0B7A6E", fontWeight: 600 }}>
            Live from patient &amp; payment records · {staffLabel(staffKey)} · not editable
          </div>

          <div className="ds-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 14 }}>
            {stat("Proposals sent", String(proposalCount), `secure links sent in ${monthName}`)}
            {stat("Invisalign orders", String(orderCount), "patients who went ahead (first payment)")}
            {stat("Conversion rate", conversion === null ? "—" : `${conversion}%`, "orders ÷ proposals sent")}
            {stat("Avg revenue / patient", avgRevenue ? fmt(avgRevenue) : "—", "average treatment value of new orders")}
          </div>

          <div className="ds-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18, alignItems: "start" }}>
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #EEF2F6" }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Proposals sent</div>
                <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>Read-only · patient name</div>
              </div>
              {proposals.length === 0 ? (
                <div style={{ padding: 24, fontSize: 13.5, color: "#9AA6B4" }}>No proposals sent in {monthName}.</div>
              ) : (
                proposals.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: "1px solid #F1F4F8" }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{`${p.firstName} ${p.lastName}`.trim()}</div>
                      <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 2 }}>{p.email}</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#5C6a79", textAlign: "right" }}>
                      {fmt(netPricePence(p.pricePence, p.upfrontPaidPence))}
                      <div style={{ fontSize: 11, color: "#9AA6B4", marginTop: 2 }}>{staffLabel(staffOf(p.sentByEmail || ""))}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #EEF2F6" }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Orders this month</div>
                <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>Read-only · patient name &amp; amount</div>
              </div>
              {orders.length === 0 ? (
                <div style={{ padding: 24, fontSize: 13.5, color: "#9AA6B4" }}>No new orders in {monthName}.</div>
              ) : (
                <>
                  {orders.map((o) => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: "1px solid #F1F4F8" }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{o.name}</div>
                        <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 2 }}>{o.email}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0B7A6E", textAlign: "right" }}>
                        {fmt(o.amountPence)}
                        <div style={{ fontSize: 11, color: "#9AA6B4", fontWeight: 600, marginTop: 2 }}>{o.staff}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #E7ECF2", background: "#F4FCFA", fontWeight: 800 }}>
                    <span style={{ fontSize: 13, color: "#0B7A6E" }}>Collected in month</span>
                    <span style={{ fontSize: 15, color: "#0B7A6E" }}>{fmt(incomePence)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: 18, fontSize: 12.5, color: "#9AA6B4", lineHeight: 1.55 }}>
            Conversion = orders ÷ proposals sent for {monthName}
            {staffKey !== "all" ? ` (${staffLabel(staffKey)})` : ""}. Average revenue uses treatment value of new orders.
            {me.isSuperAdmin ? "" : ` Showing only patients attributed to ${me.name} (${me.email}).`}
            {" "}Fallback sender: {FALLBACK_COORDINATOR.email}.
          </div>
        </div>
      </div>
    </>
  );
}
