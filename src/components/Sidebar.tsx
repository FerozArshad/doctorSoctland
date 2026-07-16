"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { key: "dashboard", label: "Dashboard", href: "/admin", d: "M4 4h6v7H4V4zm10 0h6v5h-6V4zM4 15h6v5H4v-5zm10-2h6v7h-6v-7z" },
  { key: "patients", label: "Patients", href: "/admin/patients", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { key: "add", label: "New patient", href: "/admin/patients/new", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" },
  { key: "proposals", label: "Proposals", href: "/admin/patients", d: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h4" },
  { key: "settings", label: "Settings", href: "/admin/settings", d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" },
];

export default function Sidebar({
  patientCount,
  adminName,
  adminRole,
  isSuperAdmin,
  adminInitials,
}: {
  patientCount: number;
  adminName: string;
  adminRole: string;
  isSuperAdmin: boolean;
  adminInitials: string;
}) {
  const pathname = usePathname();
  const activeKey =
    pathname === "/admin"
      ? "dashboard"
      : pathname.startsWith("/admin/settings")
        ? "settings"
        : pathname.startsWith("/admin/patients/new")
          ? "add"
          : pathname.startsWith("/admin/patients")
            ? "patients"
            : "dashboard";

  return (
    <aside style={{ width: 248, flex: "none", background: "#0E1A2B", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
      <div style={{ padding: "26px 22px 18px" }}>
        <Image src="/logo.webp" alt="Dental Scotland" width={140} height={38} style={{ height: 38, width: "auto" }} />
      </div>
      <div style={{ padding: "6px 14px", flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#4E6178", padding: "8px 12px 6px" }}>Practice</div>
        {NAV.map((n) => {
          const active = n.key === activeKey;
          return (
            <Link
              key={n.key}
              href={n.href}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "11px 12px", margin: "2px 0", borderRadius: 10, textDecoration: "none",
                fontSize: 14, fontWeight: active ? 700 : 600,
                background: active ? "rgba(14,147,132,.16)" : "transparent",
                color: active ? "#fff" : "#8695AB",
                boxShadow: active ? "inset 3px 0 0 #0E9384" : "none",
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                <path d={n.d} />
              </svg>
              <span style={{ flex: 1, textAlign: "left" }}>{n.label}</span>
              {n.key === "patients" && (
                <span style={{ background: "#0E9384", color: "#fff", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20 }}>{patientCount}</span>
              )}
            </Link>
          );
        })}
      </div>
      <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0E9384", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, flex: "none" }}>{adminInitials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{adminName}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span
              title={isSuperAdmin ? "Full access, including revenue" : "No access to revenue figures"}
              style={{
                fontSize: 10, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase",
                padding: "2px 7px", borderRadius: 20, whiteSpace: "nowrap",
                background: isSuperAdmin ? "#0E9384" : "#33465F",
                color: isSuperAdmin ? "#fff" : "#B9C7D9",
              }}
            >
              {isSuperAdmin ? "Super Admin" : "Admin"}
            </span>
            <span style={{ color: "#6E819A", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{adminRole}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
