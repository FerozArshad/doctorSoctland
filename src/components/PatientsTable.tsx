"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS, StatusKey } from "@/lib/status";
import { treatmentLabel } from "@/lib/treatments";
import { fmt, veneerPricePence } from "@/lib/pricing";

export type PatientRow = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarBg: string;
  alignerCount: number;
  pkg: string;
  treatmentType: string;
  priceFmt: string;
  status: string;
  financeStatus: string; // none | applied | accepted | declined
  lastAgo: string;
  coord: string; // millie | michelle | rochelle | other
};

const CHIP_DEFS: Array<[string, string]> = [
  ["all", "All"], ["draft", "Draft"], ["sent", "Sent"], ["interested", "Interested"],
  ["awaiting", "Awaiting"], ["deposit", "Deposit"], ["paid", "Paid"], ["overdue", "Overdue"],
  ["finance", "Finance"],
];

const COORD_CHIPS: Array<[string, string]> = [
  ["all", "Anyone"], ["millie", "Millie"], ["michelle", "Michelle"], ["rochelle", "Rochelle"], ["other", "Other"],
];

const FINANCE_BADGE: Record<string, { label: string; fg: string; bg: string }> = {
  applied: { label: "Finance pending", fg: "#7A3EC0", bg: "#F3EBFC" },
  accepted: { label: "Finance accepted", fg: "#1C7C3A", bg: "#E6F6EA" },
  declined: { label: "Finance not accepted", fg: "#C23B34", bg: "#FBE9E8" },
};

export default function PatientsTable({ rows }: { rows: PatientRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [coordFilter, setCoordFilter] = useState("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, finance: 0 };
    for (const r of rows) {
      c[r.status] = (c[r.status] || 0) + 1;
      if (r.financeStatus && r.financeStatus !== "none") c.finance += 1;
    }
    return c;
  }, [rows]);

  const coordCounts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.coord] = (c[r.coord] || 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let f = rows;
    if (filter === "finance") {
      f = f.filter((r) => r.financeStatus && r.financeStatus !== "none");
    } else if (filter !== "all") {
      f = f.filter((r) => r.status === filter);
    }
    f = f.filter((r) => coordFilter === "all" || r.coord === coordFilter);
    if (q) f = f.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    return f;
  }, [rows, search, filter, coordFilter]);

  const grid = "2.4fr 1.3fr 1fr 1.4fr 1.2fr 0.5fr";

  return (
    <div className="ds-view card ds-patients-card" style={{ overflow: "hidden" }}>
      <div className="ds-patients-toolbar">
        <div className="ds-patients-search">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9AA6B4" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 13, top: 11 }}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients or email…"
            style={{ width: "100%", padding: "10px 12px 10px 38px", border: "1px solid #E1E7EE", borderRadius: 10, fontSize: 14, background: "#FBFCFD" }}
          />
        </div>
        <div className="ds-filter-chips">
          {CHIP_DEFS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: "1px solid transparent",
                background: filter === k ? "#0E1A2B" : "#F4F6F9",
                color: filter === k ? "#fff" : "#5C6a79",
              }}
            >
              {label} <span style={{ opacity: 0.6 }}>{counts[k] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* sent-by filter */}
      <div className="ds-filter-row">
        <span className="ds-filter-row-label">Sent by</span>
        <div className="ds-filter-chips">
          {COORD_CHIPS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setCoordFilter(k)}
              style={{
                padding: "6px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                border: "1px solid " + (coordFilter === k ? "#0E9384" : "#E1E7EE"),
                background: coordFilter === k ? "#0E9384" : "#fff",
                color: coordFilter === k ? "#fff" : "#5C6a79",
              }}
            >
              {label} <span style={{ opacity: 0.6 }}>{coordCounts[k] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ds-patients-head" style={{ gridTemplateColumns: grid }}>
        <div>Patient</div><div>Plan</div><div>Value</div><div>Status</div><div>Last activity</div><div></div>
      </div>

      {filtered.map((r) => {
        const st = STATUS[(r.status as StatusKey) in STATUS ? (r.status as StatusKey) : "draft"];
        return (
          <div
            key={r.id}
            className="row-hover ds-patients-row"
            onClick={() => router.push(r.status === "draft" ? `/admin/patients/${r.id}/proposal` : `/admin/patients/${r.id}`)}
            style={{ gridTemplateColumns: grid }}
          >
            <div className="ds-pat-col-patient" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: r.avatarBg, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, flex: "none" }}>{r.initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className="ds-pat-text-truncate" style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div className="ds-pat-text-truncate" style={{ fontSize: 12.5, color: "#8A96A5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}</div>
              </div>
            </div>
            <div className="ds-pat-col-plan" style={{ fontSize: 13.5, color: "#3C4a59" }}>
              <div className="ds-pat-mobile-label">Plan</div>
              <div style={{ fontWeight: 700 }}>{treatmentLabel(r.treatmentType)}</div>
              {r.treatmentType === "invisalign" && (
                <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 2 }}>
                  {r.alignerCount} aligners · {r.pkg}
                </div>
              )}
              {(r.treatmentType === "veneers") && (
                <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 2 }}>
                  {r.alignerCount} teeth · {fmt(veneerPricePence(r.alignerCount))}
                </div>
              )}
              {r.treatmentType === "composite_bonding" && (
                <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 2 }}>
                  {r.alignerCount} teeth
                </div>
              )}
            </div>
            <div className="ds-pat-col-value" style={{ fontSize: 14.5, fontWeight: 800 }}>
              <div className="ds-pat-mobile-label">Value</div>
              {r.priceFmt}
            </div>
            <div className="ds-pat-col-status">
              <div className="ds-pat-mobile-label">Status</div>
              <span className="badge" style={{ color: st.fg, background: st.bg }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot }} />
                {st.label}
              </span>
              {r.financeStatus && FINANCE_BADGE[r.financeStatus] && (
                <div style={{ marginTop: 6 }}>
                  <span
                    className="badge"
                    style={{
                      color: FINANCE_BADGE[r.financeStatus].fg,
                      background: FINANCE_BADGE[r.financeStatus].bg,
                      fontSize: 11,
                    }}
                  >
                    {FINANCE_BADGE[r.financeStatus].label}
                  </span>
                </div>
              )}
            </div>
            <div className="ds-pat-col-activity" style={{ fontSize: 13, color: "#7A8696" }}>
              <div className="ds-pat-mobile-label">Last activity</div>
              {r.lastAgo}
            </div>
            <div className="ds-pat-col-arrow" style={{ textAlign: "right", color: "#B4BECB", fontSize: 12, fontWeight: 700 }}>
              {r.status === "draft" ? (
                <span style={{ color: "#0E9384" }}>Continue →</span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              )}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div style={{ padding: 50, textAlign: "center", color: "#9AA6B4", fontSize: 14 }}>No patients match your filters.</div>
      )}
    </div>
  );
}
