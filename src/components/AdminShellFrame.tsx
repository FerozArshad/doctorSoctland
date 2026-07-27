"use client";

import Sidebar from "@/components/Sidebar";
import { AdminShellProvider, useAdminShell } from "@/components/AdminShellContext";

type SidebarProps = React.ComponentProps<typeof Sidebar>;

function ShellInner({ children, sidebar }: { children: React.ReactNode; sidebar: SidebarProps }) {
  const { navOpen, closeNav } = useAdminShell();

  return (
    <div className="ds-admin-shell">
      <button
        type="button"
        className={"ds-sidebar-backdrop" + (navOpen ? " is-open" : "")}
        aria-label="Close navigation"
        tabIndex={navOpen ? 0 : -1}
        onClick={closeNav}
      />
      <Sidebar {...sidebar} />
      <main className="ds-admin-main">{children}</main>
    </div>
  );
}

export default function AdminShellFrame({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: SidebarProps;
}) {
  return (
    <AdminShellProvider>
      <ShellInner sidebar={sidebar}>{children}</ShellInner>
    </AdminShellProvider>
  );
}
