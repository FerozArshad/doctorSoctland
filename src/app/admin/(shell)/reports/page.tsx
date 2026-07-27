// Automated monthly treatment report — fully computed from live data, no
// manual edits. Segment by staff (sent-by coordinator) and flick months.
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmt } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-settings";
import { COORDINATORS, FALLBACK_COORDINATOR } from "@/lib/coordinators";
import { firstNameOf } from "@/lib/status";
import { buildMonthlyReportData, pad, staffLabel } from "@/lib/build-monthly-report";
import { TREATMENT_TYPES } from "@/lib/treatments";
import { PAYMENT_LINE_TYPE_LABELS, type ReportPaymentType } from "@/lib/report-metrics";
import TopBar from "@/components/TopBar";
import ReportPdfExportButton from "@/components/ReportPdfExportButton";

export const dynamic = "force-dynamic";

type StaffKey = "all" | string;

const PAYMENT_TYPE_STYLE: Record<ReportPaymentType, { fg: string; bg: string }> = {
  Deposit: { fg: "#B7791F", bg: "#FBF3E2" },
  "Paid in Full": { fg: "#1C7C3A", bg: "#E6F6EA" },
  Finance: { fg: "#7A3EC0", bg: "#F3EBFC" },
};

function PaymentTypeBadge({ type }: { type: ReportPaymentType }) {
  const s = PAYMENT_TYPE_STYLE[type];
  return (
    <span className="badge" style={{ color: s.fg, background: s.bg, padding: "3px 9px", fontSize: 11.5, whiteSpace: "nowrap" }}>
      {type}
    </span>
  );
}

function valueNote(gross: number, credit: number, net: number) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0B7A6E" }}>{fmt(net)}</div>
      {credit > 0 && (
        <div style={{ fontSize: 11, color: "#9AA6B4", marginTop: 2 }}>
          {fmt(gross)} − {fmt(credit)} credit
        </div>
      )}
    </div>
  );
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
  const monthName = start.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const staffKey = (searchParams.s || "all") as StaffKey;
  const knownKeys = new Set(COORDINATORS.map((c) => c.key));
  if (staffKey !== "all" && staffKey !== "other" && !knownKeys.has(staffKey)) {
    redirect(`/admin/reports?m=${year}-${pad(month)}`);
  }

  const baseWhere = me.isSuperAdmin
    ? {}
    : { OR: [{ ownerId: me.id }, { sentByEmail: me.email }] };

  const cfg = await getPricing();

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
        status: true,
        paymentPreference: true,
        financeStatus: true,
        financeApprovedAt: true,
        consentSignedAt: true,
        proposalSentAt: true,
        sentByEmail: true,
        sentByName: true,
        treatmentType: true,
        ownerId: true,
        payments: {
          where: { status: "paid" },
          select: { type: true, status: true, paidAt: true },
        },
      },
    }),
    db.payment.findMany({
      where: { status: "paid", patient: baseWhere },
      select: {
        patientId: true,
        amountPence: true,
        paidAt: true,
        type: true,
        patient: { select: { firstName: true, lastName: true, email: true, sentByEmail: true } },
      },
    }),
  ]);

  const scopeLabel = me.isSuperAdmin ? staffLabel(staffKey) : `${me.name} (${me.email})`;

  const report = buildMonthlyReportData({
    patients,
    payments,
    year,
    month,
    staffKey,
    scopeLabel,
    defaultCreditPence: cfg.upfrontPence,
    isSuperAdmin: me.isSuperAdmin,
    adminEmail: me.email,
    adminId: me.id,
  });

  const staffTabs: Array<{ key: StaffKey; label: string }> = [
    { key: "all", label: "All staff" },
    ...COORDINATORS.map((c) => ({ key: c.key, label: firstNameOf(c.name) })),
    { key: "other", label: "Other" },
  ];

  const qs = (d: Date, s: StaffKey = staffKey) =>
    `?m=${d.getFullYear()}-${pad(d.getMonth() + 1)}&s=${s}`;

  const exportHref = (format: string) =>
    `/api/admin/reports/export?format=${format}&m=${year}-${pad(month)}&s=${staffKey}`;

  const stat = (label: string, value: string, sub: string) => (
    <div key={label} className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#3C4a59", marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#8A96A5", marginTop: 2 }}>{sub}</div>
    </div>
  );

  return (
    <>
      <TopBar title="Monthly reports" sub="Automated treatment volume, conversion & value — locked, not editable" />
      <div className="ds-scroll ds-admin-pad" style={{ flex: 1, overflow: "auto" }}>
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
              <ReportPdfExportButton
                monthKey={`${year}-${pad(month)}`}
                staffKey={staffKey}
                financePatients={report.financePatients}
              />
            </div>
          </div>

          <div style={{ marginTop: 14, padding: "12px 18px", borderRadius: 12, background: "#F4FCFA", border: "1px solid #CFEDE5", fontSize: 13.5, color: "#0B7A6E", fontWeight: 600 }}>
            Live from patient &amp; payment records · {staffLabel(staffKey)} · booking credit included per patient record
          </div>

          <div className="ds-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 14 }}>
            {stat("Proposals sent", String(report.proposalCount), `secure links sent in ${monthName}`)}
            {stat("Treatment orders", String(report.orderCount), "patients who went ahead (payment or finance)")}
            {stat("Conversion rate", report.conversionPct === null ? "—" : `${report.conversionPct}%`, "orders ÷ proposals sent")}
            {stat("Avg revenue / patient", report.avgOrderPence ? fmt(report.avgOrderPence) : "—", "gross treatment value incl. booking credit")}
          </div>

          <div className="card" style={{ marginTop: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>By treatment</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              {TREATMENT_TYPES.map((t) => (
                <div key={t.key} style={{ padding: "10px 12px", borderRadius: 10, background: "#F6F9FA", border: "1px solid #EEF2F6" }}>
                  <div style={{ fontSize: 12, color: "#7A8696", fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{report.ordersByTreatment[t.label] || 0}</div>
                  <div style={{ fontSize: 11, color: "#9AA6B4", marginTop: 2 }}>{report.proposalsByTreatment[t.label] || 0} proposals</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>Income this month</div>
            <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "#5C6a79" }}>Card / Stripe collected</span>
                <strong>{fmt(report.cashCollectedPence)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "#5C6a79" }}>Booking credit (all treatments)</span>
                <strong>{fmt(report.bookingCreditPence)}</strong>
              </div>
              {report.financePatients.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "#5C6a79" }}>Finance net (enter on PDF export)</span>
                  <strong>{report.financeIncomePence ? fmt(report.financeIncomePence) : "—"}</strong>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 8, borderTop: "1px solid #EEF2F6", fontWeight: 800 }}>
                <span>Total income</span>
                <span style={{ color: "#0B7A6E" }}>{fmt(report.totalIncomePence)}</span>
              </div>
            </div>
          </div>

          <div className="ds-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18, alignItems: "start" }}>
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #EEF2F6" }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Proposals sent</div>
                <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>Patient · treatment · payment type · value</div>
              </div>
              {report.proposals.length === 0 ? (
                <div style={{ padding: 24, fontSize: 13.5, color: "#9AA6B4" }}>No proposals sent in {monthName}.</div>
              ) : (
                report.proposals.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: "1px solid #F1F4F8", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.patientName}</div>
                      <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 2 }}>{p.email}</div>
                      <div style={{ fontSize: 11.5, color: "#5C6a79", marginTop: 4, fontWeight: 600 }}>{p.treatment}</div>
                      <div style={{ marginTop: 8 }}>
                        <PaymentTypeBadge type={p.paymentType} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {valueNote(p.grossPence, p.bookingCreditPence, p.netPence)}
                      <div style={{ fontSize: 11, color: "#9AA6B4", marginTop: 4 }}>{p.staff}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #EEF2F6" }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Orders this month</div>
                <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>Patient · treatment · payment type · value</div>
              </div>
              {report.orders.length === 0 ? (
                <div style={{ padding: 24, fontSize: 13.5, color: "#9AA6B4" }}>No new orders in {monthName}.</div>
              ) : (
                report.orders.map((o) => (
                  <div key={o.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: "1px solid #F1F4F8", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{o.patientName}</div>
                      <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 2 }}>{o.email}</div>
                      <div style={{ fontSize: 11.5, color: "#5C6a79", marginTop: 4, fontWeight: 600 }}>{o.treatment}</div>
                      <div style={{ marginTop: 8 }}>
                        <PaymentTypeBadge type={o.paymentType} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {valueNote(o.grossPence, o.bookingCreditPence, o.netPence)}
                      <div style={{ fontSize: 11, color: "#9AA6B4", marginTop: 4 }}>{o.staff}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 18, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #EEF2F6" }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Payments &amp; income</div>
              <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>
                Card payments, booking credit, and finance (when net value entered for PDF)
              </div>
            </div>
            {report.paymentLines.length === 0 ? (
              <div style={{ padding: 24, fontSize: 13.5, color: "#9AA6B4" }}>No payment activity in {monthName}.</div>
            ) : (
              report.paymentLines.map((line, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: "1px solid #F1F4F8", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{line.patientName}</div>
                    <div style={{ fontSize: 12, color: "#7A8696", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{PAYMENT_LINE_TYPE_LABELS[line.type] || line.type}</span>
                      <PaymentTypeBadge type={line.paymentType} />
                    </div>
                    {line.note && <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 4 }}>{line.note}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0B7A6E" }}>{fmt(line.amountPence)}</div>
                    <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 2 }}>{line.paidAt}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 18, fontSize: 12.5, color: "#9AA6B4", lineHeight: 1.55 }}>
            Conversion = orders ÷ proposals sent for {monthName}
            {staffKey !== "all" ? ` (${staffLabel(staffKey)})` : ""}. Payment type shows Deposit, Paid in Full, or Finance.
            Finance orders are included when finance is accepted or the patient applies. Booking credit is added to income for each new order based on the patient record.
            {me.isSuperAdmin ? "" : ` Showing only patients attributed to ${me.name} (${me.email}).`}
            {" "}Fallback sender: {FALLBACK_COORDINATOR.email}.
          </div>
        </div>
      </div>
    </>
  );
}
