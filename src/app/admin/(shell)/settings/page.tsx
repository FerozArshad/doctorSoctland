import TopBar from "@/components/TopBar";
import PricingSettingsForm from "@/components/PricingSettingsForm";
import AdminPasswordForm from "@/components/AdminPasswordForm";
import AdminProfileForm from "@/components/AdminProfileForm";
import { getPricing } from "@/lib/pricing-settings";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireAdmin();
  const cfg = await getPricing();
  return (
    <>
      <TopBar title="Settings" sub="Your profile, password, and practice pricing" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 480px))", gap: 18 }}>
            <AdminProfileForm name={me.name} email={me.email} role={me.role} isSuperAdmin={me.isSuperAdmin} />
            <AdminPasswordForm adminName={me.name} adminEmail={me.email} />
          </div>
          <PricingSettingsForm cfg={cfg} />
        </div>
      </div>
    </>
  );
}
