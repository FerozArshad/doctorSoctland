import TopBar from "@/components/TopBar";
import PricingSettingsForm from "@/components/PricingSettingsForm";
import { getPricing } from "@/lib/pricing-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const cfg = await getPricing();
  return (
    <>
      <TopBar title="Settings" sub="Practice pricing & payment options" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <PricingSettingsForm cfg={cfg} />
      </div>
    </>
  );
}
