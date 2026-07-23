"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { adminLogout } from "@/app/admin/actions";

const NAV = [
  { key: "dashboard", label: "Dashboard", href: "/admin", d: "M4 4h6v7H4V4zm10 0h6v5h-6V4zM4 15h6v5H4v-5zm10-2h6v7h-6v-7z" },
  { key: "patients", label: "Patients", href: "/admin/patients", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { key: "add", label: "New patient", href: "/admin/patients/new", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" },
  { key: "proposals", label: "Proposals", href: "/admin/patients", d: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h4" },
  { key: "reports", label: "Monthly reports", href: "/admin/reports", d: "M3 3v18h18M8 17V9M13 17V5M18 17v-7" },
  { key: "pricing", label: "Pricing tiers", href: "/admin/pricing", d: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { key: "whatsapp", label: "WhatsApp", href: "/admin/whatsapp", superOnly: true, d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" },
  { key: "team", label: "Team", href: "/admin/team", superOnly: true, d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
] as Array<{ key: string; label: string; href: string; superOnly?: boolean; d: string }>;

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeKey =
    pathname === "/admin"
      ? "dashboard"
      : pathname.startsWith("/admin/pricing")
        ? "pricing"
        : pathname.startsWith("/admin/reports")
          ? "reports"
        : pathname.startsWith("/admin/whatsapp")
          ? "whatsapp"
          : pathname.startsWith("/admin/team")
            ? "team"
            : pathname.startsWith("/admin/patients/new")
              ? "add"
              : pathname.startsWith("/admin/patients")
                ? "patients"
                : "dashboard";

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <aside className="ds-sidebar" style={{ width: 248, flex: "none", background: "#0B1828", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflow: "visible" }}>
      <div className="ds-sb-logo" style={{ padding: "26px 22px 18px" }}>
        <BrandLogo width={140} height={38} />
      </div>
      <nav className="ds-sb-nav" style={{ padding: "6px 12px", flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div className="ds-sb-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#4E6178", padding: "8px 12px 6px" }}>
          Practice
        </div>
        {NAV.filter((n) => !n.superOnly || isSuperAdmin).map((n) => {
          const active = n.key === activeKey;
          return (
            <Link
              key={n.key}
              href={n.href}
              title={n.label}
              className={"ds-sb-link" + (active ? " is-active" : "")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "11px 12px",
                margin: "2px 0",
                borderRadius: 10,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: active ? 700 : 600,
                background: active ? "rgba(60,199,247,.16)" : "transparent",
                color: active ? "#fff" : "#8695AB",
                boxShadow: active ? "inset 3px 0 0 #3CC7F7" : "none",
                position: "relative",
                boxSizing: "border-box",
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden>
                <path d={n.d} />
              </svg>
              <span className="ds-sb-label" style={{ flex: 1, textAlign: "left", minWidth: 0 }}>{n.label}</span>
              {n.key === "patients" && (
                <span className="ds-sb-count" style={{ background: "#3CC7F7", color: "#06101C", fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 20, flex: "none" }}>
                  {patientCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="ds-sb-footer" style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 10, overflow: "visible", position: "relative" }}>
        <div className="ds-sb-avatar" style={{ width: 36, height: 36, borderRadius: "50%", background: "#3CC7F7", color: "#06101C", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, flex: "none" }} title={adminName}>
          {adminInitials}
        </div>
        <div className="ds-sb-label" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{adminName}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span
              title={isSuperAdmin ? "Full access, including revenue" : "No access to revenue figures"}
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: ".04em",
                textTransform: "uppercase",
                padding: "2px 7px",
                borderRadius: 20,
                whiteSpace: "nowrap",
                background: isSuperAdmin ? "#3CC7F7" : "#33465F",
                color: isSuperAdmin ? "#06101C" : "#B9C7D9",
              }}
            >
              {isSuperAdmin ? "Super Admin" : "Admin"}
            </span>
          </div>
        </div>

        <div ref={menuRef} style={{ position: "relative", flex: "none" }}>
          <button
            type="button"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              background: menuOpen ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.08)",
              color: "#E8EEF6",
              padding: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {menuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                bottom: "calc(100% + 8px)",
                width: 188,
                background: "#132234",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 12,
                boxShadow: "0 12px 32px rgba(0,0,0,.45)",
                padding: 6,
                zIndex: 50,
              }}
            >
              <Link
                href="/admin/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "#E8EEF6",
                  fontSize: 13.5,
                  fontWeight: 650,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Edit profile
              </Link>
              <form action={adminLogout}>
                <button
                  type="submit"
                  role="menuitem"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#F2A7A0",
                    fontSize: 13.5,
                    fontWeight: 650,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Log out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
