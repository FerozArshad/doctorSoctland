"use client";

import Link from "next/link";
import NotificationsBell from "@/components/NotificationsBell";

export default function TopBar({ title, sub }: { title: string; sub: string }) {
  return (
    <header style={{ height: 70, flex: "none", background: "#fff", borderBottom: "1px solid #E7ECF2", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px" }}>
      <div>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <NotificationsBell />
        <Link
          href="/admin/patients/new"
          style={{ background: "#0E9384", color: "#fff", border: "none", padding: "11px 18px", borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New patient
        </Link>
      </div>
    </header>
  );
}
