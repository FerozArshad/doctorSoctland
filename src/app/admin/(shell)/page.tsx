import Link from "next/link";
import { db } from "@/lib/db";
import { fmt } from "@/lib/pricing";
import { avatarBg, initials, statusOf, timeAgo, STATUS, StatusKey } from "@/lib/status";
import TopBar from "@/components/TopBar";
import { getAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // Only a Super Admin sees earnings (revenue cards + revenue chart).
  const me = await getAdmin();
  const isSuper = !!me?.isSuperAdmin;

  const patients = await db.patient.findMany({
    include: { activities: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  const paidPayments = await db.payment.findMany({ where: { status: "paid" } });

  // ── Stats ──
  const collected = patients.reduce((a, c) => a + c.amountPaidPence, 0);
  const active = patients.filter((c) => c.status !== "draft");
  const pending = active
    .filter((c) => c.status !== "paid")
    .reduce((a, c) => a + (c.pricePence - c.amountPaidPence), 0);
  const won = patients.filter((c) => c.status === "paid" || c.status === "deposit").length;
  const conv = active.length ? Math.round((100 * won) / active.length) : 0;
  const overdueCount = patients.filter((c) => c.status === "overdue").length;

  const statCards = [
    { label: "Active patients", value: String(patients.length), delta: "+3 this wk", deltaColor: "#1C7C3A", deltaBg: "#E6F6EA", iconBg: "#EAF0FE", iconFg: "#2E6BFF", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
    // Earnings — Super Admin only.
    ...(isSuper
      ? [
          { label: "Revenue collected", value: fmt(collected), delta: "+12%", deltaColor: "#1C7C3A", deltaBg: "#E6F6EA", iconBg: "#E3F6F0", iconFg: "#0B7A6E", d: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
          { label: "Pending revenue", value: fmt(pending), delta: overdueCount + " overdue", deltaColor: "#C23B34", deltaBg: "#FBE9E8", iconBg: "#FBF3E2", iconFg: "#B7791F", d: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
        ]
      : [
          { label: "Awaiting payment", value: String(active.filter((c) => c.status !== "paid" && c.status !== "deposit").length), delta: overdueCount + " overdue", deltaColor: "#C23B34", deltaBg: "#FBE9E8", iconBg: "#FBF3E2", iconFg: "#B7791F", d: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
        ]),
    { label: "Conversion rate", value: conv + "%", delta: won + "/" + active.length + " won", deltaColor: "#1D4FD8", deltaBg: "#EAF0FE", iconBg: "#F3EBFC", iconFg: "#9B51E0", d: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" },
  ];

  // ── Revenue chart: real Stripe/manual payments, last 6 months ──
  const now = new Date();
  const monthly: { month: string; v: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const v = paidPayments
      .filter((p) => p.paidAt && p.paidAt >= start && p.paidAt < end)
      .reduce((a, p) => a + p.amountPence, 0);
    monthly.push({ month: start.toLocaleString("en-GB", { month: "short" }), v });
  }
  const max = Math.max(1, ...monthly.map((m) => m.v));
  const chartTotal = fmt(monthly.reduce((a, m) => a + m.v, 0));

  // ── Pipeline ──
  const order: StatusKey[] = ["sent", "interested", "awaiting", "deposit", "paid"];
  const countFor = (k: StatusKey) =>
    patients.filter((c) => c.status === k || (k === "awaiting" && c.status === "overdue")).length;
  const pmax = Math.max(1, ...order.map(countFor));

  // ── Activity feed ──
  const feed = patients
    .flatMap((c) =>
      c.activities.map((a) => ({
        ts: a.createdAt,
        text: a.text,
        name: c.firstName + " " + c.lastName,
        initials: initials(c.firstName, c.lastName),
        bg: avatarBg(c.id),
      }))
    )
    .sort((a, b) => b.ts.getTime() - a.ts.getTime())
    .slice(0, 6);

  // ── Follow-ups ──
  const followUps = patients
    .filter((c) => ["sent", "interested", "awaiting", "overdue"].includes(c.status))
    .slice(0, 4);

  return (
    <>
      <TopBar title="Dashboard" sub="Practice overview & activity" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div className="ds-view">
          {/* stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${statCards.length},1fr)`, gap: 18 }}>
            {statCards.map((s) => (
              <div key={s.label} className="card" style={{ padding: 20, boxShadow: "0 1px 2px rgba(16,32,54,.03)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: s.iconBg, color: s.iconFg }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={s.d} /></svg>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.deltaColor, background: s.deltaBg, padding: "3px 8px", borderRadius: 20 }}>{s.delta}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 16, letterSpacing: "-.02em" }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* chart (Super Admin only) + pipeline */}
          <div style={{ display: "grid", gridTemplateColumns: isSuper ? "1.6fr 1fr" : "1fr", gap: 18, marginTop: 18 }}>
            {isSuper && (
              <div className="card" style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>Revenue collected</div>
                    <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>Last 6 months</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{chartTotal}</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 150, marginTop: 22 }}>
                  {monthly.map((b, i) => (
                    <div key={b.month + i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#5C6a79" }}>{fmt(b.v)}</div>
                      <div style={{ width: "100%", borderRadius: "8px 8px 3px 3px", background: i === 5 ? "#0E9384" : "#CDE9E4", height: Math.round(18 + (b.v / max) * 82) + "%" }} />
                      <div style={{ fontSize: 11, color: "#9AA6B4", fontWeight: 600 }}>{b.month}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Pipeline</div>
              <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>Patients by stage</div>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                {order.map((k) => {
                  const count = countFor(k);
                  return (
                    <div key={k}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, color: "#3C4a59" }}>{STATUS[k].label}</span>
                        <span style={{ fontWeight: 700, color: "#16202E" }}>{count}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 6, background: "#F0F3F7", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 6, background: STATUS[k].dot, width: Math.round((count / pmax) * 100) + "%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* activity + follow-ups */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
            <div className="card" style={{ padding: 22 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Recent activity</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {feed.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: "1px solid #F1F4F8" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: a.bg, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 11, flex: "none" }}>{a.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "#2C3847", lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700 }}>{a.name}</span> — {a.text}
                      </div>
                      <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 2 }}>{timeAgo(a.ts)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Needs follow-up</div>
                <Link href="/admin/patients" style={{ color: "#0E9384", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>View all →</Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {followUps.map((c) => {
                  const st = statusOf(c.status);
                  return (
                    <Link key={c.id} href={`/admin/patients/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 11, border: "1px solid #EEF2F6", background: "#FBFCFD", textDecoration: "none", width: "100%" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: avatarBg(c.id), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flex: "none" }}>{initials(c.firstName, c.lastName)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#16202E" }}>{c.firstName} {c.lastName}</div>
                        <span className="badge" style={{ fontSize: 11.5, color: st.fg, background: st.bg, padding: "1px 8px" }}>{st.label}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#16202E" }}>{fmt(c.pricePence)}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
