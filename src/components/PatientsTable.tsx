"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS, StatusKey } from "@/lib/status";

export type PatientRow = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarBg: string;
  alignerCount: number;
  pkg: string;
  priceFmt: string;
  status: string;
  lastAgo: string;
  coord: string; // "millie" | "rochelle" | "other" — who the proposal was sent by
};

const CHIP_DEFS: Array<[string, string]> = [
  ["all", "All"], ["draft", "Draft"], ["sent", "Sent"], ["interested", "Interested"],
  ["awaiting", "Awaiting"], ["deposit", "Deposit"], ["paid", "Paid"], ["overdue", "Overdue"],
];

const COORD_CHIPS: Array<[string, string]> = [
  ["all", "Anyone"], ["millie", "Millie"], ["rochelle", "Rochelle"], ["other", "Other"],
];

export default function PatientsTable({ rows }: { rows: PatientRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [coordFilter, setCoordFilter] = useState("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  const coordCounts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.coord] = (c[r.coord] || 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let f = rows.filter((r) => filter === "all" || r.status === filter);
    f = f.filter((r) => coordFilter === "all" || r.coord === coordFilter);
    if (q) f = f.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    return f;
  }, [rows, search, filter, coordFilter]);

  const grid = "2.4fr 1.3fr 1fr 1.4fr 1.2fr 0.5fr";

  return (
    <div className="ds-view card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", borderBottom: "1px solid #EEF2F6" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 340 }}>
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
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
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
      <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "1px solid #EEF2F6", background: "#FBFCFD" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8A96A5" }}>Sent by</span>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: grid, padding: "12px 20px", fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8A96A5", borderBottom: "1px solid #EEF2F6", background: "#FAFBFC" }}>
        <div>Patient</div><div>Plan</div><div>Value</div><div>Status</div><div>Last activity</div><div></div>
      </div>

      {filtered.map((r) => {
        const st = STATUS[(r.status as StatusKey) in STATUS ? (r.status as StatusKey) : "draft"];
        return (
          <div
            key={r.id}
            className="row-hover"
            onClick={() => router.push(`/admin/patients/${r.id}`)}
            style={{ display: "grid", gridTemplateColumns: grid, padding: "14px 20px", alignItems: "center", borderBottom: "1px solid #F1F4F8", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: r.avatarBg, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, flex: "none" }}>{r.initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: "#8A96A5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}</div>
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: "#3C4a59" }}>
              <span style={{ fontWeight: 700 }}>{r.alignerCount}</span> aligners
              <div style={{ fontSize: 12, color: "#9AA6B4" }}>Invisalign {r.pkg}</div>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>{r.priceFmt}</div>
            <div>
              <span className="badge" style={{ color: st.fg, background: st.bg }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot }} />
                {st.label}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#7A8696" }}>{r.lastAgo}</div>
            <div style={{ textAlign: "right", color: "#B4BECB" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
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
