import TopBar from "@/components/TopBar";
import AdminPasswordForm from "@/components/AdminPasswordForm";
import AdminProfileForm from "@/components/AdminProfileForm";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireAdmin();
  return (
    <>
      <TopBar title="Settings" sub="Your profile and password" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 480px))", gap: 18 }}>
          <AdminProfileForm name={me.name} email={me.email} role={me.role} isSuperAdmin={me.isSuperAdmin} />
          <AdminPasswordForm adminName={me.name} adminEmail={me.email} />
        </div>
      </div>
    </>
  );
}
