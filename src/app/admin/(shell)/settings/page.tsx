import TopBar from "@/components/TopBar";
import PricingSettingsForm from "@/components/PricingSettingsForm";
import AdminPasswordForm from "@/components/AdminPasswordForm";
import { getPricing } from "@/lib/pricing-settings";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireAdmin();
  const cfg = await getPricing();
  return (
    <>
      <TopBar title="Settings" sub="Account password, practice pricing & payment options" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <AdminPasswordForm adminName={me.name} adminEmail={me.email} />
          <PricingSettingsForm cfg={cfg} />
        </div>
      </div>
    </>
  );
}
