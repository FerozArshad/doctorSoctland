"use client";

import Link from "next/link";
import NotificationsBell from "@/components/NotificationsBell";
import { useAdminShell } from "@/components/AdminShellContext";

export default function TopBar({ title, sub, actions }: { title: string; sub: string; actions?: React.ReactNode }) {
  const { openNav } = useAdminShell();

  return (
    <header className="ds-topbar">
      <div className="ds-topbar-left">
        <button type="button" className="ds-topbar-menu" onClick={openNav} aria-label="Open navigation">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="ds-topbar-titles">
          <div className="ds-topbar-title">{title}</div>
          <div className="ds-topbar-sub">{sub}</div>
        </div>
      </div>
      <div className="ds-topbar-actions">
        {actions}
        <NotificationsBell />
        <Link href="/admin/patients/new" className="ds-topbar-new btn btn-teal">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="ds-topbar-new-label">New patient</span>
        </Link>
      </div>
    </header>
  );
}
